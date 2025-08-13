"""
Base Saga implementation for orchestrating distributed transactions.

Implements the Saga pattern for coordinating long-running business processes
across multiple services with compensating transactions for rollback.
"""

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Any, Optional, Type, Callable

from pydantic import BaseModel, Field
import structlog

logger = structlog.get_logger(__name__)


class SagaStatus(str, Enum):
    """Saga execution status."""
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    COMPENSATING = "compensating"
    COMPENSATED = "compensated"


class StepStatus(str, Enum):
    """Individual step status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    COMPENSATED = "compensated"


class SagaStep(BaseModel):
    """Individual step in a saga."""
    
    step_id: str = Field(description="Unique step identifier")
    step_name: str = Field(description="Human-readable step name")
    step_type: str = Field(description="Step type for routing")
    status: StepStatus = Field(default=StepStatus.PENDING)
    
    # Step data
    input_data: Dict[str, Any] = Field(default_factory=dict)
    output_data: Dict[str, Any] = Field(default_factory=dict)
    
    # Execution tracking
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    
    # Error handling
    error_message: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    
    # Compensation
    compensation_data: Dict[str, Any] = Field(default_factory=dict)
    compensated_at: Optional[datetime] = None
    
    def mark_running(self) -> None:
        """Mark step as running."""
        self.status = StepStatus.RUNNING
        self.started_at = datetime.now(timezone.utc)
    
    def mark_completed(self, output_data: Dict[str, Any]) -> None:
        """Mark step as completed."""
        self.status = StepStatus.COMPLETED
        self.output_data = output_data
        self.completed_at = datetime.now(timezone.utc)
    
    def mark_failed(self, error_message: str) -> None:
        """Mark step as failed."""
        self.status = StepStatus.FAILED
        self.error_message = error_message
        self.failed_at = datetime.now(timezone.utc)
    
    def mark_compensated(self) -> None:
        """Mark step as compensated."""
        self.status = StepStatus.COMPENSATED
        self.compensated_at = datetime.now(timezone.utc)
    
    def can_retry(self) -> bool:
        """Check if step can be retried."""
        return self.retry_count < self.max_retries
    
    def increment_retry(self) -> None:
        """Increment retry count."""
        self.retry_count += 1


class SagaInstance(BaseModel):
    """
    Saga instance representing a running saga execution.
    
    Tracks the state of a distributed transaction across multiple services.
    """
    
    saga_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    saga_type: str = Field(description="Type of saga")
    status: SagaStatus = Field(default=SagaStatus.RUNNING)
    
    # Business context
    correlation_id: str = Field(description="Business correlation ID")
    context_data: Dict[str, Any] = Field(default_factory=dict)
    
    # Steps
    steps: List[SagaStep] = Field(default_factory=list)
    current_step_index: int = 0
    
    # Execution tracking
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    
    # Error handling
    error_message: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }
    
    def add_step(self, step: SagaStep) -> None:
        """Add a step to the saga."""
        self.steps.append(step)
    
    def get_current_step(self) -> Optional[SagaStep]:
        """Get the current step being executed."""
        if 0 <= self.current_step_index < len(self.steps):
            return self.steps[self.current_step_index]
        return None
    
    def get_completed_steps(self) -> List[SagaStep]:
        """Get all completed steps."""
        return [step for step in self.steps if step.status == StepStatus.COMPLETED]
    
    def advance_to_next_step(self) -> bool:
        """Advance to the next step. Returns True if there's a next step."""
        self.current_step_index += 1
        return self.current_step_index < len(self.steps)
    
    def is_completed(self) -> bool:
        """Check if saga is completed."""
        return all(step.status == StepStatus.COMPLETED for step in self.steps)
    
    def has_failed_steps(self) -> bool:
        """Check if any steps have failed."""
        return any(step.status == StepStatus.FAILED for step in self.steps)
    
    def mark_completed(self) -> None:
        """Mark saga as completed."""
        self.status = SagaStatus.COMPLETED
        self.completed_at = datetime.now(timezone.utc)
    
    def mark_failed(self, error_message: str) -> None:
        """Mark saga as failed."""
        self.status = SagaStatus.FAILED
        self.error_message = error_message
        self.failed_at = datetime.now(timezone.utc)
    
    def mark_compensating(self) -> None:
        """Mark saga as compensating."""
        self.status = SagaStatus.COMPENSATING
    
    def mark_compensated(self) -> None:
        """Mark saga as compensated."""
        self.status = SagaStatus.COMPENSATED


class BaseSaga(ABC):
    """
    Base class for all saga implementations.
    
    Provides the framework for defining saga steps, execution logic,
    and compensation handling.
    """
    
    def __init__(self):
        self.step_handlers: Dict[str, Callable] = {}
        self.compensation_handlers: Dict[str, Callable] = {}
        self._register_handlers()
    
    @property
    @abstractmethod
    def saga_type(self) -> str:
        """Return the saga type identifier."""
        pass
    
    @abstractmethod
    def define_steps(self, context_data: Dict[str, Any]) -> List[SagaStep]:
        """Define the steps for this saga based on context data."""
        pass
    
    @abstractmethod
    def _register_handlers(self) -> None:
        """Register step and compensation handlers."""
        pass
    
    async def create_instance(
        self,
        correlation_id: str,
        context_data: Dict[str, Any]
    ) -> SagaInstance:
        """Create a new saga instance."""
        instance = SagaInstance(
            saga_type=self.saga_type,
            correlation_id=correlation_id,
            context_data=context_data,
        )
        
        # Define steps based on context
        steps = self.define_steps(context_data)
        for step in steps:
            instance.add_step(step)
        
        instance.started_at = datetime.now(timezone.utc)
        
        logger.info(
            "Saga instance created",
            saga_id=instance.saga_id,
            saga_type=instance.saga_type,
            correlation_id=correlation_id,
            step_count=len(steps),
        )
        
        return instance
    
    async def execute_step(
        self,
        instance: SagaInstance,
        step: SagaStep
    ) -> Dict[str, Any]:
        """Execute a single saga step."""
        handler = self.step_handlers.get(step.step_type)
        if not handler:
            raise ValueError(f"No handler registered for step type: {step.step_type}")
        
        step.mark_running()
        
        try:
            logger.info(
                "Executing saga step",
                saga_id=instance.saga_id,
                step_id=step.step_id,
                step_name=step.step_name,
                step_type=step.step_type,
            )
            
            # Execute the step handler
            result = await handler(instance, step)
            
            step.mark_completed(result)
            
            logger.info(
                "Saga step completed",
                saga_id=instance.saga_id,
                step_id=step.step_id,
                step_name=step.step_name,
            )
            
            return result
            
        except Exception as e:
            error_msg = str(e)
            step.mark_failed(error_msg)
            
            logger.error(
                "Saga step failed",
                saga_id=instance.saga_id,
                step_id=step.step_id,
                step_name=step.step_name,
                error=error_msg,
            )
            
            raise
    
    async def compensate_step(
        self,
        instance: SagaInstance,
        step: SagaStep
    ) -> None:
        """Compensate a completed step."""
        if step.status != StepStatus.COMPLETED:
            return  # Only compensate completed steps
        
        compensation_handler = self.compensation_handlers.get(step.step_type)
        if not compensation_handler:
            logger.warning(
                "No compensation handler for step",
                saga_id=instance.saga_id,
                step_id=step.step_id,
                step_type=step.step_type,
            )
            return
        
        try:
            logger.info(
                "Compensating saga step",
                saga_id=instance.saga_id,
                step_id=step.step_id,
                step_name=step.step_name,
            )
            
            await compensation_handler(instance, step)
            step.mark_compensated()
            
            logger.info(
                "Saga step compensated",
                saga_id=instance.saga_id,
                step_id=step.step_id,
                step_name=step.step_name,
            )
            
        except Exception as e:
            logger.error(
                "Saga step compensation failed",
                saga_id=instance.saga_id,
                step_id=step.step_id,
                step_name=step.step_name,
                error=str(e),
            )
            # Continue with other compensations even if one fails


class SagaExecutionError(Exception):
    """Raised when saga execution fails."""
    
    def __init__(self, saga_id: str, step_name: str, message: str):
        self.saga_id = saga_id
        self.step_name = step_name
        super().__init__(f"Saga {saga_id} failed at step {step_name}: {message}")


class SagaCompensationError(Exception):
    """Raised when saga compensation fails."""
    
    def __init__(self, saga_id: str, step_name: str, message: str):
        self.saga_id = saga_id
        self.step_name = step_name
        super().__init__(f"Saga {saga_id} compensation failed at step {step_name}: {message}")
