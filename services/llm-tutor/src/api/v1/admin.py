"""
Admin API endpoints for the LLM Tutor service
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete
from typing import List, Optional
import structlog
from datetime import datetime, timedelta

from ...core.database import get_db_session
from ...middleware.auth import get_current_user
from ...models.user import User, UserRole, LearningProfile, LearningProgress
from ...models.conversation import Conversation, Message, ConversationFeedback
from ...security.auth_security import UserRole as SecurityUserRole, Permission
from ... import schemas

logger = structlog.get_logger(__name__)
router = APIRouter()

def require_admin_role(current_user: User = Depends(get_current_user)):
    """Dependency to require admin role"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

@router.get("/stats", response_model=schemas.SystemStats)
async def get_system_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_admin_role)
):
    """Get system-wide statistics"""
    
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # User statistics
        total_users_result = await db.execute(select(func.count(User.id)))
        total_users = total_users_result.scalar() or 0
        
        active_users_result = await db.execute(
            select(func.count(User.id)).where(User.is_active == True)
        )
        active_users = active_users_result.scalar() or 0
        
        new_users_result = await db.execute(
            select(func.count(User.id)).where(User.created_at >= start_date)
        )
        new_users = new_users_result.scalar() or 0
        
        # Conversation statistics
        total_conversations_result = await db.execute(
            select(func.count(Conversation.id)).where(Conversation.created_at >= start_date)
        )
        total_conversations = total_conversations_result.scalar() or 0
        
        total_messages_result = await db.execute(
            select(func.count(Message.id)).where(Message.created_at >= start_date)
        )
        total_messages = total_messages_result.scalar() or 0
        
        # User role distribution
        role_distribution = {}
        for role in UserRole:
            role_result = await db.execute(
                select(func.count(User.id)).where(User.role == role.value)
            )
            role_distribution[role.value] = role_result.scalar() or 0
        
        # Daily activity for the last 7 days
        daily_activity = []
        for i in range(7):
            day_start = end_date.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            
            day_conversations_result = await db.execute(
                select(func.count(Conversation.id)).where(
                    Conversation.created_at >= day_start,
                    Conversation.created_at < day_end
                )
            )
            day_conversations = day_conversations_result.scalar() or 0
            
            day_users_result = await db.execute(
                select(func.count(func.distinct(Conversation.user_id))).where(
                    Conversation.created_at >= day_start,
                    Conversation.created_at < day_end
                )
            )
            day_active_users = day_users_result.scalar() or 0
            
            daily_activity.append({
                "date": day_start.date().isoformat(),
                "conversations": day_conversations,
                "active_users": day_active_users
            })
        
        daily_activity.reverse()
        
        return schemas.SystemStats(
            total_users=total_users,
            active_users=active_users,
            new_users_period=new_users,
            total_conversations_period=total_conversations,
            total_messages_period=total_messages,
            role_distribution=role_distribution,
            daily_activity=daily_activity,
            period_days=days,
            generated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error("Failed to get system stats", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system statistics"
        )

@router.get("/users", response_model=List[schemas.AdminUserView])
async def list_users(
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    role: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_admin_role)
):
    """List users with admin details"""
    
    try:
        query = select(User)
        
        if active_only:
            query = query.where(User.is_active == True)
        
        if role:
            query = query.where(User.role == role)
        
        query = query.offset(offset).limit(limit).order_by(User.created_at.desc())
        
        result = await db.execute(query)
        users = result.scalars().all()
        
        user_list = []
        for user in users:
            # Get user's conversation count
            conv_count_result = await db.execute(
                select(func.count(Conversation.id)).where(Conversation.user_id == user.id)
            )
            conversation_count = conv_count_result.scalar() or 0
            
            user_list.append(schemas.AdminUserView(
                id=str(user.id),
                external_id=user.external_id,
                email=user.email,
                username=user.username,
                full_name=user.full_name,
                role=user.role,
                is_active=user.is_active,
                is_verified=user.is_verified,
                is_premium=user.is_premium,
                created_at=user.created_at,
                last_login_at=user.last_login_at,
                conversation_count=conversation_count
            ))
        
        return user_list
        
    except Exception as e:
        logger.error("Failed to list users", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users"
        )

@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    request: schemas.AdminUserUpdate,
    db: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_admin_role)
):
    """Update user details (admin only)"""
    
    try:
        # Get user
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update user fields
        update_data = {}
        if request.role is not None:
            update_data['role'] = request.role
        if request.is_active is not None:
            update_data['is_active'] = request.is_active
        if request.is_verified is not None:
            update_data['is_verified'] = request.is_verified
        if request.is_premium is not None:
            update_data['is_premium'] = request.is_premium
        
        if update_data:
            update_data['updated_at'] = datetime.utcnow()
            await db.execute(
                update(User).where(User.id == user_id).values(**update_data)
            )
            await db.commit()
        
        logger.info(
            "User updated by admin",
            admin_id=str(admin_user.id),
            target_user_id=user_id,
            updates=update_data
        )
        
        return {"message": "User updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error("Failed to update user", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    permanent: bool = Query(False, description="Permanently delete user data"),
    db: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_admin_role)
):
    """Delete or deactivate user"""
    
    try:
        # Get user
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if permanent:
            # Permanently delete user and all data
            # Delete in order: conversations -> messages -> learning data -> user
            await db.execute(
                delete(Message).where(
                    Message.conversation_id.in_(
                        select(Conversation.id).where(Conversation.user_id == user_id)
                    )
                )
            )
            await db.execute(delete(Conversation).where(Conversation.user_id == user_id))
            await db.execute(delete(LearningProgress).where(LearningProgress.user_id == user_id))
            await db.execute(delete(LearningProfile).where(LearningProfile.user_id == user_id))
            await db.execute(delete(User).where(User.id == user_id))
            
            logger.warning(
                "User permanently deleted by admin",
                admin_id=str(admin_user.id),
                target_user_id=user_id,
                target_user_email=user.email
            )
            
            message = "User permanently deleted"
        else:
            # Soft delete - just deactivate
            await db.execute(
                update(User)
                .where(User.id == user_id)
                .values(is_active=False, updated_at=datetime.utcnow())
            )
            
            logger.info(
                "User deactivated by admin",
                admin_id=str(admin_user.id),
                target_user_id=user_id
            )
            
            message = "User deactivated"
        
        await db.commit()
        return {"message": message}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error("Failed to delete user", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )

@router.get("/conversations", response_model=List[schemas.AdminConversationView])
async def list_conversations(
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_admin_role)
):
    """List conversations for admin review"""
    
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        query = select(Conversation).where(Conversation.created_at >= start_date)
        
        if user_id:
            query = query.where(Conversation.user_id == user_id)
        
        query = query.offset(offset).limit(limit).order_by(Conversation.created_at.desc())
        
        result = await db.execute(query)
        conversations = result.scalars().all()
        
        conv_list = []
        for conv in conversations:
            # Get message count
            msg_count_result = await db.execute(
                select(func.count(Message.id)).where(Message.conversation_id == conv.id)
            )
            message_count = msg_count_result.scalar() or 0
            
            # Get user info
            user_result = await db.execute(select(User).where(User.id == conv.user_id))
            user = user_result.scalar_one_or_none()
            
            conv_list.append(schemas.AdminConversationView(
                id=str(conv.id),
                user_id=str(conv.user_id),
                user_email=user.email if user else "unknown",
                subject=conv.subject,
                message_count=message_count,
                created_at=conv.created_at,
                updated_at=conv.updated_at
            ))
        
        return conv_list
        
    except Exception as e:
        logger.error("Failed to list conversations", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversations"
        )

@router.get("/feedback", response_model=List[schemas.AdminFeedbackView])
async def list_feedback(
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    min_rating: Optional[int] = Query(None, ge=1, le=5),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    admin_user: User = Depends(require_admin_role)
):
    """List user feedback for admin review"""
    
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        query = select(ConversationFeedback).where(ConversationFeedback.created_at >= start_date)
        
        if min_rating is not None:
            query = query.where(ConversationFeedback.rating >= min_rating)
        
        query = query.offset(offset).limit(limit).order_by(ConversationFeedback.created_at.desc())
        
        result = await db.execute(query)
        feedback_records = result.scalars().all()
        
        feedback_list = []
        for feedback in feedback_records:
            # Get user info
            user_result = await db.execute(select(User).where(User.id == feedback.user_id))
            user = user_result.scalar_one_or_none()
            
            feedback_list.append(schemas.AdminFeedbackView(
                id=str(feedback.id),
                conversation_id=str(feedback.conversation_id),
                user_id=str(feedback.user_id),
                user_email=user.email if user else "unknown",
                rating=feedback.rating,
                comment=feedback.comment,
                created_at=feedback.created_at
            ))
        
        return feedback_list
        
    except Exception as e:
        logger.error("Failed to list feedback", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve feedback"
        )

@router.post("/maintenance")
async def toggle_maintenance_mode(
    enabled: bool = Query(..., description="Enable or disable maintenance mode"),
    message: Optional[str] = Query(None, description="Maintenance message"),
    admin_user: User = Depends(require_admin_role)
):
    """Toggle system maintenance mode"""
    
    try:
        # This would typically update a global setting or cache
        # For now, just log the action
        
        logger.warning(
            "Maintenance mode toggled",
            admin_id=str(admin_user.id),
            enabled=enabled,
            message=message
        )
        
        return {
            "maintenance_mode": enabled,
            "message": message or ("System is under maintenance" if enabled else "System is operational"),
            "updated_by": admin_user.email,
            "updated_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error("Failed to toggle maintenance mode", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update maintenance mode"
        )
