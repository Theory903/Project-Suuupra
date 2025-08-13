"""
Admin API routes.

Provides endpoints for administrative operations including saga management,
event store queries, and system analytics.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel

from ....utils.dependencies import get_current_admin_user, get_saga_orchestrator, get_cart_repository
from ....application.saga_orchestrator import SagaOrchestrator
from ....infrastructure.persistence.cart_repository import CartRepository

router = APIRouter()


# Response Models

class SagaStepResponse(BaseModel):
    """Response model for saga steps."""
    step_id: str
    step_name: str
    step_type: str
    status: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    failed_at: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0


class SagaInstanceResponse(BaseModel):
    """Response model for saga instances."""
    saga_id: str
    saga_type: str
    status: str
    correlation_id: str
    current_step_index: int
    steps: List[SagaStepResponse]
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error_message: Optional[str] = None


class SagaStatisticsResponse(BaseModel):
    """Response model for saga statistics."""
    by_status: Dict[str, int]
    by_type: Dict[str, int]
    total: int


class AnalyticsResponse(BaseModel):
    """Response model for analytics data."""
    total_carts: int
    abandoned_carts: int
    abandonment_rate: float


# Saga Management Endpoints

@router.get("/sagas", response_model=List[SagaInstanceResponse])
async def list_sagas(
    status_filter: Optional[str] = None,
    saga_type: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_admin_user),
    saga_orchestrator: SagaOrchestrator = Depends(get_saga_orchestrator),
) -> List[SagaInstanceResponse]:
    """List saga instances with optional filtering."""
    try:
        if status_filter == "failed":
            sagas = await saga_orchestrator.list_failed_sagas()
        elif status_filter == "running":
            sagas = await saga_orchestrator.list_running_sagas()
        else:
            # Get both running and failed for overview
            running = await saga_orchestrator.list_running_sagas()
            failed = await saga_orchestrator.list_failed_sagas()
            sagas = running + failed
        
        # Convert to response format
        saga_responses = []
        for saga in sagas[:limit]:
            steps = []
            for step in saga.steps:
                steps.append(SagaStepResponse(
                    step_id=step.step_id,
                    step_name=step.step_name,
                    step_type=step.step_type,
                    status=step.status.value,
                    started_at=step.started_at.isoformat() if step.started_at else None,
                    completed_at=step.completed_at.isoformat() if step.completed_at else None,
                    failed_at=step.failed_at.isoformat() if step.failed_at else None,
                    error_message=step.error_message,
                    retry_count=step.retry_count,
                ))
            
            saga_responses.append(SagaInstanceResponse(
                saga_id=saga.saga_id,
                saga_type=saga.saga_type,
                status=saga.status.value,
                correlation_id=saga.correlation_id,
                current_step_index=saga.current_step_index,
                steps=steps,
                created_at=saga.created_at.isoformat(),
                started_at=saga.started_at.isoformat() if saga.started_at else None,
                completed_at=saga.completed_at.isoformat() if saga.completed_at else None,
                error_message=saga.error_message,
            ))
        
        return saga_responses
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list sagas: {str(e)}"
        )


@router.get("/sagas/{saga_id}", response_model=SagaInstanceResponse)
async def get_saga(
    saga_id: str,
    current_user: dict = Depends(get_current_admin_user),
    saga_orchestrator: SagaOrchestrator = Depends(get_saga_orchestrator),
) -> SagaInstanceResponse:
    """Get details of a specific saga instance."""
    try:
        saga = await saga_orchestrator.get_saga_status(saga_id)
        
        if not saga:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Saga not found"
            )
        
        # Convert steps
        steps = []
        for step in saga.steps:
            steps.append(SagaStepResponse(
                step_id=step.step_id,
                step_name=step.step_name,
                step_type=step.step_type,
                status=step.status.value,
                started_at=step.started_at.isoformat() if step.started_at else None,
                completed_at=step.completed_at.isoformat() if step.completed_at else None,
                failed_at=step.failed_at.isoformat() if step.failed_at else None,
                error_message=step.error_message,
                retry_count=step.retry_count,
            ))
        
        return SagaInstanceResponse(
            saga_id=saga.saga_id,
            saga_type=saga.saga_type,
            status=saga.status.value,
            correlation_id=saga.correlation_id,
            current_step_index=saga.current_step_index,
            steps=steps,
            created_at=saga.created_at.isoformat(),
            started_at=saga.started_at.isoformat() if saga.started_at else None,
            completed_at=saga.completed_at.isoformat() if saga.completed_at else None,
            error_message=saga.error_message,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get saga: {str(e)}"
        )


@router.post("/sagas/{saga_id}/retry")
async def retry_saga(
    saga_id: str,
    current_user: dict = Depends(get_current_admin_user),
    saga_orchestrator: SagaOrchestrator = Depends(get_saga_orchestrator),
) -> Dict[str, Any]:
    """Retry a failed saga."""
    try:
        success = await saga_orchestrator.retry_saga(saga_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Saga cannot be retried or was not found"
            )
        
        return {
            "saga_id": saga_id,
            "status": "retry_started",
            "message": "Saga retry initiated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retry saga: {str(e)}"
        )


@router.get("/sagas/statistics", response_model=SagaStatisticsResponse)
async def get_saga_statistics(
    current_user: dict = Depends(get_current_admin_user),
    saga_orchestrator: SagaOrchestrator = Depends(get_saga_orchestrator),
) -> SagaStatisticsResponse:
    """Get saga execution statistics."""
    try:
        stats = await saga_orchestrator.get_saga_statistics()
        return SagaStatisticsResponse(**stats)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get saga statistics: {str(e)}"
        )


# Analytics Endpoints

@router.get("/analytics/carts", response_model=AnalyticsResponse)
async def get_cart_analytics(
    current_user: dict = Depends(get_current_admin_user),
    cart_repo: CartRepository = Depends(get_cart_repository),
) -> AnalyticsResponse:
    """Get cart analytics data."""
    try:
        analytics = await cart_repo.get_cart_analytics()
        
        return AnalyticsResponse(
            total_carts=analytics.get("total_carts", 0),
            abandoned_carts=analytics.get("abandoned_carts", 0),
            abandonment_rate=analytics.get("abandonment_rate", 0.0),
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get cart analytics: {str(e)}"
        )


@router.get("/analytics/abandoned-carts")
async def get_abandoned_carts(
    hours_ago: int = 24,
    limit: int = 100,
    current_user: dict = Depends(get_current_admin_user),
    cart_repo: CartRepository = Depends(get_cart_repository),
) -> List[Dict[str, Any]]:
    """Get abandoned carts for analysis."""
    try:
        abandoned_carts = await cart_repo.get_abandoned_carts(
            hours_ago=hours_ago,
            limit=limit
        )
        
        return abandoned_carts
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get abandoned carts: {str(e)}"
        )

