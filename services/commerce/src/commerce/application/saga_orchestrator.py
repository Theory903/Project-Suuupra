"""
Saga Orchestrator - Manages saga execution and coordination.

Provides the main interface for executing sagas, handling failures,
and managing compensation workflows.
"""

import asyncio
from typing import Dict, List, Optional, Type
from datetime import datetime, timezone

import structlog

from ..domain.sagas.base import BaseSaga, SagaInstance, SagaStatus, StepStatus
from ..domain.sagas.order_fulfillment_saga import OrderFulfillmentSaga
from ..infrastructure.persistence.saga_repository import SagaRepository
from ..utils.metrics import (
    saga_executions_total,
    saga_step_duration_seconds,
    saga_compensations_total,
)

logger = structlog.get_logger(__name__)


class SagaOrchestrator:
    """
    Main orchestrator for managing saga execution.
    
    Coordinates saga lifecycle, error handling, and compensation
    across distributed services.
    """
    
    def __init__(self, saga_repository: Optional[SagaRepository] = None):
        self.saga_repository = saga_repository or SagaRepository()
        self.saga_registry: Dict[str, Type[BaseSaga]] = {}
        self.running_sagas: Dict[str, asyncio.Task] = {}
        
        # Register saga types
        self._register_sagas()
    
    def _register_sagas(self) -> None:
        """Register available saga types."""
        self.saga_registry = {
            "order_fulfillment": OrderFulfillmentSaga,
        }
    
    async def start_saga(
        self,
        saga_type: str,
        correlation_id: str,
        context_data: Dict[str, any]
    ) -> str:
        """
        Start a new saga execution.
        
        Args:
            saga_type: Type of saga to execute
            correlation_id: Business correlation identifier
            context_data: Context data for saga execution
            
        Returns:
            The saga instance ID
        """
        saga_class = self.saga_registry.get(saga_type)
        if not saga_class:
            raise ValueError(f"Unknown saga type: {saga_type}")
        
        # Create saga instance
        saga = saga_class()
        instance = await saga.create_instance(correlation_id, context_data)
        
        # Persist saga instance
        await self.saga_repository.save(instance)
        
        # Start execution in background
        task = asyncio.create_task(
            self._execute_saga(saga, instance),
            name=f"saga-{instance.saga_id}"
        )
        self.running_sagas[instance.saga_id] = task
        
        # Record metrics
        saga_executions_total.labels(
            saga_type=saga_type,
            status="started"
        ).inc()
        
        logger.info(
            "Saga started",
            saga_id=instance.saga_id,
            saga_type=saga_type,
            correlation_id=correlation_id,
        )
        
        return instance.saga_id
    
    async def _execute_saga(self, saga: BaseSaga, instance: SagaInstance) -> None:
        """
        Execute a saga instance through all its steps.
        
        Args:
            saga: The saga implementation
            instance: The saga instance to execute
        """
        try:
            logger.info(
                "Executing saga",
                saga_id=instance.saga_id,
                saga_type=instance.saga_type,
                step_count=len(instance.steps),
            )
            
            # Execute each step in sequence
            while instance.current_step_index < len(instance.steps):
                current_step = instance.get_current_step()
                if not current_step:
                    break
                
                try:
                    # Execute step with timing
                    start_time = datetime.now(timezone.utc)
                    
                    await saga.execute_step(instance, current_step)
                    
                    # Record step timing
                    duration = (datetime.now(timezone.utc) - start_time).total_seconds()
                    saga_step_duration_seconds.labels(
                        saga_type=instance.saga_type,
                        step_name=current_step.step_name,
                        status="completed"
                    ).observe(duration)
                    
                    # Move to next step
                    if not instance.advance_to_next_step():
                        # All steps completed
                        break
                    
                    # Persist progress
                    await self.saga_repository.save(instance)
                    
                except Exception as step_error:
                    logger.error(
                        "Saga step failed",
                        saga_id=instance.saga_id,
                        step_name=current_step.step_name,
                        error=str(step_error),
                    )
                    
                    # Record step failure timing
                    duration = (datetime.now(timezone.utc) - start_time).total_seconds()
                    saga_step_duration_seconds.labels(
                        saga_type=instance.saga_type,
                        step_name=current_step.step_name,
                        status="failed"
                    ).observe(duration)
                    
                    # Check if step can be retried
                    if current_step.can_retry():
                        current_step.increment_retry()
                        logger.info(
                            "Retrying saga step",
                            saga_id=instance.saga_id,
                            step_name=current_step.step_name,
                            retry_count=current_step.retry_count,
                        )
                        continue  # Retry the same step
                    else:
                        # Step failed permanently, start compensation
                        instance.mark_failed(str(step_error))
                        await self._compensate_saga(saga, instance)
                        return
            
            # All steps completed successfully
            instance.mark_completed()
            await self.saga_repository.save(instance)
            
            saga_executions_total.labels(
                saga_type=instance.saga_type,
                status="completed"
            ).inc()
            
            logger.info(
                "Saga completed successfully",
                saga_id=instance.saga_id,
                saga_type=instance.saga_type,
                duration_seconds=(
                    instance.completed_at - instance.started_at
                ).total_seconds() if instance.completed_at and instance.started_at else None,
            )
            
        except Exception as e:
            logger.error(
                "Saga execution failed",
                saga_id=instance.saga_id,
                error=str(e),
            )
            
            instance.mark_failed(str(e))
            await self.saga_repository.save(instance)
            
            saga_executions_total.labels(
                saga_type=instance.saga_type,
                status="failed"
            ).inc()
            
            # Attempt compensation
            await self._compensate_saga(saga, instance)
        
        finally:
            # Remove from running sagas
            self.running_sagas.pop(instance.saga_id, None)
    
    async def _compensate_saga(self, saga: BaseSaga, instance: SagaInstance) -> None:
        """
        Execute compensation for a failed saga.
        
        Args:
            saga: The saga implementation
            instance: The failed saga instance
        """
        logger.info(
            "Starting saga compensation",
            saga_id=instance.saga_id,
            saga_type=instance.saga_type,
        )
        
        instance.mark_compensating()
        await self.saga_repository.save(instance)
        
        # Compensate completed steps in reverse order
        completed_steps = instance.get_completed_steps()
        compensation_errors = []
        
        for step in reversed(completed_steps):
            try:
                await saga.compensate_step(instance, step)
                
                saga_compensations_total.labels(
                    saga_type=instance.saga_type,
                    step_name=step.step_name
                ).inc()
                
            except Exception as e:
                error_msg = f"Compensation failed for step {step.step_name}: {str(e)}"
                compensation_errors.append(error_msg)
                logger.error(
                    "Saga compensation step failed",
                    saga_id=instance.saga_id,
                    step_name=step.step_name,
                    error=str(e),
                )
        
        if compensation_errors:
            instance.error_message = f"{instance.error_message}; Compensation errors: {'; '.join(compensation_errors)}"
        else:
            instance.mark_compensated()
        
        await self.saga_repository.save(instance)
        
        logger.info(
            "Saga compensation completed",
            saga_id=instance.saga_id,
            compensated_steps=len(completed_steps),
            compensation_errors=len(compensation_errors),
        )
    
    async def retry_saga(self, saga_id: str) -> bool:
        """
        Retry a failed saga from the last failed step.
        
        Args:
            saga_id: The saga instance ID
            
        Returns:
            True if retry was started, False if saga cannot be retried
        """
        instance = await self.saga_repository.get(saga_id)
        if not instance:
            logger.warning("Saga not found for retry", saga_id=saga_id)
            return False
        
        if instance.status not in [SagaStatus.FAILED, SagaStatus.COMPENSATED]:
            logger.warning(
                "Saga cannot be retried",
                saga_id=saga_id,
                status=instance.status,
            )
            return False
        
        # Reset saga status and retry from failed step
        instance.status = SagaStatus.RUNNING
        instance.error_message = None
        
        # Reset failed step
        current_step = instance.get_current_step()
        if current_step and current_step.status == StepStatus.FAILED:
            current_step.status = StepStatus.PENDING
            current_step.error_message = None
            current_step.failed_at = None
        
        await self.saga_repository.save(instance)
        
        # Get saga implementation and restart execution
        saga_class = self.saga_registry.get(instance.saga_type)
        if saga_class:
            saga = saga_class()
            task = asyncio.create_task(
                self._execute_saga(saga, instance),
                name=f"saga-retry-{instance.saga_id}"
            )
            self.running_sagas[instance.saga_id] = task
            
            logger.info("Saga retry started", saga_id=saga_id)
            return True
        
        return False
    
    async def get_saga_status(self, saga_id: str) -> Optional[SagaInstance]:
        """
        Get the current status of a saga.
        
        Args:
            saga_id: The saga instance ID
            
        Returns:
            The saga instance or None if not found
        """
        return await self.saga_repository.get(saga_id)
    
    async def list_running_sagas(self) -> List[SagaInstance]:
        """Get all currently running sagas."""
        return await self.saga_repository.get_running_sagas()
    
    async def list_failed_sagas(self) -> List[SagaInstance]:
        """Get all failed sagas that might need attention."""
        return await self.saga_repository.get_failed_sagas()
    
    async def get_saga_statistics(self) -> Dict[str, any]:
        """Get saga execution statistics."""
        return await self.saga_repository.get_saga_statistics()
    
    async def shutdown(self) -> None:
        """Gracefully shutdown the orchestrator."""
        logger.info("Shutting down saga orchestrator")
        
        # Cancel all running saga tasks
        for saga_id, task in self.running_sagas.items():
            if not task.done():
                logger.info("Cancelling running saga", saga_id=saga_id)
                task.cancel()
        
        # Wait for tasks to complete
        if self.running_sagas:
            await asyncio.gather(
                *self.running_sagas.values(),
                return_exceptions=True
            )
        
        self.running_sagas.clear()
        logger.info("Saga orchestrator shutdown complete")
