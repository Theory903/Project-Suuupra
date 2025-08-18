"""
User management API endpoints for the LLM Tutor service
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional
import structlog
from datetime import datetime

from ...core.database import get_db_session
from ...middleware.auth import get_current_user, get_optional_user
from ...models.user import User, LearningProfile, LearningProgress
from ... import schemas

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("/profile", response_model=schemas.UserProfileResponse)
async def get_user_profile(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Get user profile with learning data"""
    
    try:
        # Get learning profile
        result = await db.execute(
            select(LearningProfile).where(LearningProfile.user_id == current_user.id)
        )
        learning_profile = result.scalar_one_or_none()
        
        # Get learning progress summary
        result = await db.execute(
            select(LearningProgress).where(LearningProgress.user_id == current_user.id)
        )
        progress_records = result.scalars().all()
        
        return schemas.UserProfileResponse(
            id=str(current_user.id),
            external_id=current_user.external_id,
            email=current_user.email,
            username=current_user.username,
            full_name=current_user.full_name,
            role=current_user.role,
            is_active=current_user.is_active,
            is_verified=current_user.is_verified,
            is_premium=current_user.is_premium,
            created_at=current_user.created_at,
            last_login_at=current_user.last_login_at,
            learning_profile=schemas.LearningProfileResponse(
                learning_style=learning_profile.learning_style if learning_profile else "visual",
                current_level=learning_profile.current_level if learning_profile else "beginner",
                preferred_difficulty=learning_profile.preferred_difficulty if learning_profile else "intermediate",
                subjects_of_interest=learning_profile.subjects_of_interest if learning_profile else [],
                learning_goals=learning_profile.learning_goals if learning_profile else [],
                voice_enabled=learning_profile.voice_enabled if learning_profile else True,
                total_study_time=learning_profile.total_study_time if learning_profile else 0,
                questions_answered=learning_profile.questions_answered if learning_profile else 0,
                correct_answers=learning_profile.correct_answers if learning_profile else 0,
                streak_days=learning_profile.streak_days if learning_profile else 0
            ) if learning_profile else None,
            progress_summary=len(progress_records)
        )
        
    except Exception as e:
        logger.error("Failed to get user profile", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user profile"
        )

@router.put("/profile", response_model=schemas.UserProfileResponse)
async def update_user_profile(
    request: schemas.UpdateUserProfileRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Update user profile"""
    
    try:
        # Update user basic info
        if request.full_name is not None:
            await db.execute(
                update(User)
                .where(User.id == current_user.id)
                .values(full_name=request.full_name, updated_at=datetime.utcnow())
            )
        
        # Update learning profile
        if request.learning_profile:
            # Get or create learning profile
            result = await db.execute(
                select(LearningProfile).where(LearningProfile.user_id == current_user.id)
            )
            learning_profile = result.scalar_one_or_none()
            
            if learning_profile:
                # Update existing profile
                update_data = {}
                if request.learning_profile.learning_style:
                    update_data['learning_style'] = request.learning_profile.learning_style
                if request.learning_profile.preferred_difficulty:
                    update_data['preferred_difficulty'] = request.learning_profile.preferred_difficulty
                if request.learning_profile.subjects_of_interest is not None:
                    update_data['subjects_of_interest'] = request.learning_profile.subjects_of_interest
                if request.learning_profile.learning_goals is not None:
                    update_data['learning_goals'] = request.learning_profile.learning_goals
                if request.learning_profile.voice_enabled is not None:
                    update_data['voice_enabled'] = request.learning_profile.voice_enabled
                
                if update_data:
                    update_data['updated_at'] = datetime.utcnow()
                    await db.execute(
                        update(LearningProfile)
                        .where(LearningProfile.user_id == current_user.id)
                        .values(**update_data)
                    )
            else:
                # Create new learning profile
                new_profile = LearningProfile(
                    user_id=current_user.id,
                    learning_style=request.learning_profile.learning_style or "visual",
                    preferred_difficulty=request.learning_profile.preferred_difficulty or "intermediate",
                    subjects_of_interest=request.learning_profile.subjects_of_interest or [],
                    learning_goals=request.learning_profile.learning_goals or [],
                    voice_enabled=request.learning_profile.voice_enabled if request.learning_profile.voice_enabled is not None else True
                )
                db.add(new_profile)
        
        await db.commit()
        
        logger.info("User profile updated", user_id=str(current_user.id))
        
        # Return updated profile
        return await get_user_profile(db, current_user)
        
    except Exception as e:
        await db.rollback()
        logger.error("Failed to update user profile", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile"
        )

@router.get("/progress", response_model=List[schemas.LearningProgressResponse])
async def get_learning_progress(
    subject: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Get user's learning progress"""
    
    try:
        query = select(LearningProgress).where(LearningProgress.user_id == current_user.id)
        
        if subject:
            query = query.where(LearningProgress.subject == subject)
        
        query = query.offset(offset).limit(limit).order_by(LearningProgress.last_attempt_at.desc())
        
        result = await db.execute(query)
        progress_records = result.scalars().all()
        
        return [
            schemas.LearningProgressResponse(
                id=str(record.id),
                subject=record.subject,
                topic=record.topic,
                skill=record.skill,
                mastery_level=record.mastery_level,
                confidence_score=record.confidence_score,
                difficulty_level=record.difficulty_level,
                total_time_spent=record.total_time_spent,
                total_questions=record.total_questions,
                correct_answers=record.correct_answers,
                accuracy_rate=record.get_accuracy_rate(),
                next_review_date=record.next_review_date,
                last_attempt_at=record.last_attempt_at
            )
            for record in progress_records
        ]
        
    except Exception as e:
        logger.error("Failed to get learning progress", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve learning progress"
        )

@router.get("/stats", response_model=schemas.UserStatsResponse)
async def get_user_stats(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Get user statistics and analytics"""
    
    try:
        # Get learning profile
        result = await db.execute(
            select(LearningProfile).where(LearningProfile.user_id == current_user.id)
        )
        learning_profile = result.scalar_one_or_none()
        
        # Get progress records
        result = await db.execute(
            select(LearningProgress).where(LearningProgress.user_id == current_user.id)
        )
        progress_records = result.scalars().all()
        
        # Calculate statistics
        total_subjects = len(set(record.subject for record in progress_records))
        total_skills = len(progress_records)
        average_mastery = sum(record.mastery_level for record in progress_records) / len(progress_records) if progress_records else 0
        
        # Skills by mastery level
        mastery_distribution = {
            "beginner": len([r for r in progress_records if r.mastery_level < 0.3]),
            "intermediate": len([r for r in progress_records if 0.3 <= r.mastery_level < 0.7]),
            "advanced": len([r for r in progress_records if r.mastery_level >= 0.7])
        }
        
        return schemas.UserStatsResponse(
            total_study_time=learning_profile.total_study_time if learning_profile else 0,
            total_questions=learning_profile.questions_answered if learning_profile else 0,
            correct_answers=learning_profile.correct_answers if learning_profile else 0,
            accuracy_rate=learning_profile.get_accuracy_rate() if learning_profile else 0,
            streak_days=learning_profile.streak_days if learning_profile else 0,
            total_subjects=total_subjects,
            total_skills=total_skills,
            average_mastery=average_mastery,
            mastery_distribution=mastery_distribution,
            engagement_score=learning_profile.engagement_score if learning_profile else 0,
            comprehension_score=learning_profile.comprehension_score if learning_profile else 0
        )
        
    except Exception as e:
        logger.error("Failed to get user stats", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user statistics"
        )

@router.delete("/account")
async def delete_user_account(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Delete user account and all associated data"""
    
    try:
        # This would trigger a full data deletion process
        # For now, just mark as inactive
        await db.execute(
            update(User)
            .where(User.id == current_user.id)
            .values(is_active=False, updated_at=datetime.utcnow())
        )
        
        await db.commit()
        
        logger.info("User account deleted", user_id=str(current_user.id))
        
        return {"message": "Account deletion initiated"}
        
    except Exception as e:
        await db.rollback()
        logger.error("Failed to delete user account", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account"
        )
