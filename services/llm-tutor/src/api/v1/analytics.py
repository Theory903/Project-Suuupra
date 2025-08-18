"""
Analytics API endpoints for the LLM Tutor service
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
import structlog
from datetime import datetime, timedelta

from ...core.database import get_db_session
from ...middleware.auth import get_current_user
from ...models.user import User, LearningProgress, UserSession
from ...models.conversation import Conversation, Message
from ... import schemas

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("/dashboard", response_model=schemas.AnalyticsDashboard)
async def get_analytics_dashboard(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Get user analytics dashboard data"""
    
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get conversation statistics
        conv_result = await db.execute(
            select(func.count(Conversation.id))
            .where(
                Conversation.user_id == current_user.id,
                Conversation.created_at >= start_date
            )
        )
        conversations_count = conv_result.scalar() or 0
        
        # Get message statistics
        msg_result = await db.execute(
            select(func.count(Message.id))
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(
                Conversation.user_id == current_user.id,
                Message.created_at >= start_date,
                Message.sender == "user"
            )
        )
        messages_count = msg_result.scalar() or 0
        
        # Get study time from sessions
        session_result = await db.execute(
            select(func.sum(UserSession.duration))
            .where(
                UserSession.user_id == current_user.id,
                UserSession.started_at >= start_date
            )
        )
        study_time = session_result.scalar() or 0
        
        # Get learning progress
        progress_result = await db.execute(
            select(LearningProgress)
            .where(
                LearningProgress.user_id == current_user.id,
                LearningProgress.last_attempt_at >= start_date
            )
        )
        progress_records = progress_result.scalars().all()
        
        # Calculate subject breakdown
        subject_stats = {}
        for record in progress_records:
            if record.subject not in subject_stats:
                subject_stats[record.subject] = {
                    "questions": 0,
                    "correct": 0,
                    "time_spent": 0,
                    "mastery": []
                }
            subject_stats[record.subject]["questions"] += record.total_questions
            subject_stats[record.subject]["correct"] += record.correct_answers
            subject_stats[record.subject]["time_spent"] += record.total_time_spent
            subject_stats[record.subject]["mastery"].append(record.mastery_level)
        
        # Calculate average mastery per subject
        for subject in subject_stats:
            mastery_scores = subject_stats[subject]["mastery"]
            subject_stats[subject]["avg_mastery"] = sum(mastery_scores) / len(mastery_scores) if mastery_scores else 0
            del subject_stats[subject]["mastery"]  # Remove raw mastery data
        
        # Get daily activity (last 7 days)
        daily_activity = []
        for i in range(7):
            day_start = end_date.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            
            day_conv_result = await db.execute(
                select(func.count(Conversation.id))
                .where(
                    Conversation.user_id == current_user.id,
                    Conversation.created_at >= day_start,
                    Conversation.created_at < day_end
                )
            )
            day_conversations = day_conv_result.scalar() or 0
            
            day_msg_result = await db.execute(
                select(func.count(Message.id))
                .join(Conversation, Message.conversation_id == Conversation.id)
                .where(
                    Conversation.user_id == current_user.id,
                    Message.created_at >= day_start,
                    Message.created_at < day_end,
                    Message.sender == "user"
                )
            )
            day_messages = day_msg_result.scalar() or 0
            
            daily_activity.append({
                "date": day_start.date().isoformat(),
                "conversations": day_conversations,
                "messages": day_messages
            })
        
        daily_activity.reverse()  # Show oldest to newest
        
        return schemas.AnalyticsDashboard(
            period_days=days,
            total_conversations=conversations_count,
            total_messages=messages_count,
            total_study_time=study_time,
            subjects_studied=len(subject_stats),
            subject_breakdown=subject_stats,
            daily_activity=daily_activity,
            generated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error("Failed to get analytics dashboard", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve analytics data"
        )

@router.get("/progress-trend", response_model=schemas.ProgressTrend)
async def get_progress_trend(
    subject: Optional[str] = Query(None, description="Filter by subject"),
    days: int = Query(30, ge=7, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Get learning progress trend over time"""
    
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Build query
        query = select(LearningProgress).where(
            LearningProgress.user_id == current_user.id,
            LearningProgress.last_attempt_at >= start_date
        )
        
        if subject:
            query = query.where(LearningProgress.subject == subject)
        
        query = query.order_by(LearningProgress.last_attempt_at)
        
        result = await db.execute(query)
        progress_records = result.scalars().all()
        
        # Group by day and calculate daily averages
        daily_progress = {}
        for record in progress_records:
            day_key = record.last_attempt_at.date().isoformat()
            if day_key not in daily_progress:
                daily_progress[day_key] = {
                    "mastery_scores": [],
                    "confidence_scores": [],
                    "accuracy_rates": []
                }
            
            daily_progress[day_key]["mastery_scores"].append(record.mastery_level)
            daily_progress[day_key]["confidence_scores"].append(record.confidence_score)
            daily_progress[day_key]["accuracy_rates"].append(record.get_accuracy_rate())
        
        # Calculate daily averages
        trend_data = []
        for day_key in sorted(daily_progress.keys()):
            day_data = daily_progress[day_key]
            trend_data.append({
                "date": day_key,
                "avg_mastery": sum(day_data["mastery_scores"]) / len(day_data["mastery_scores"]),
                "avg_confidence": sum(day_data["confidence_scores"]) / len(day_data["confidence_scores"]),
                "avg_accuracy": sum(day_data["accuracy_rates"]) / len(day_data["accuracy_rates"]),
                "sessions": len(day_data["mastery_scores"])
            })
        
        return schemas.ProgressTrend(
            subject=subject,
            period_days=days,
            trend_data=trend_data,
            total_sessions=len(progress_records),
            generated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error("Failed to get progress trend", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve progress trend"
        )

@router.get("/learning-patterns", response_model=schemas.LearningPatterns)
async def get_learning_patterns(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Get user's learning patterns and insights"""
    
    try:
        # Get all user sessions
        session_result = await db.execute(
            select(UserSession)
            .where(UserSession.user_id == current_user.id)
            .order_by(UserSession.started_at.desc())
            .limit(100)
        )
        sessions = session_result.scalars().all()
        
        # Analyze session patterns
        hourly_activity = [0] * 24
        daily_activity = [0] * 7  # Monday = 0, Sunday = 6
        session_lengths = []
        
        for session in sessions:
            if session.started_at and session.duration:
                hour = session.started_at.hour
                day_of_week = session.started_at.weekday()
                
                hourly_activity[hour] += 1
                daily_activity[day_of_week] += 1
                session_lengths.append(session.duration)
        
        # Calculate optimal study time
        peak_hour = hourly_activity.index(max(hourly_activity)) if max(hourly_activity) > 0 else 14
        peak_day = daily_activity.index(max(daily_activity)) if max(daily_activity) > 0 else 1
        
        # Calculate average session length
        avg_session_length = sum(session_lengths) / len(session_lengths) if session_lengths else 0
        
        # Get learning progress patterns
        progress_result = await db.execute(
            select(LearningProgress)
            .where(LearningProgress.user_id == current_user.id)
            .order_by(LearningProgress.last_attempt_at.desc())
            .limit(50)
        )
        progress_records = progress_result.scalars().all()
        
        # Analyze difficulty preferences
        difficulty_counts = {"beginner": 0, "intermediate": 0, "advanced": 0, "expert": 0}
        for record in progress_records:
            difficulty_counts[record.difficulty_level] += 1
        
        preferred_difficulty = max(difficulty_counts, key=difficulty_counts.get)
        
        # Generate insights
        insights = []
        
        if peak_hour:
            if 6 <= peak_hour <= 11:
                insights.append("You're most active in the morning. Consider scheduling challenging topics during this time.")
            elif 12 <= peak_hour <= 17:
                insights.append("Your peak learning time is in the afternoon.")
            else:
                insights.append("You prefer studying in the evening.")
        
        if avg_session_length > 0:
            if avg_session_length < 900:  # Less than 15 minutes
                insights.append("Your sessions are quite short. Consider longer study periods for better retention.")
            elif avg_session_length > 3600:  # More than 1 hour
                insights.append("You have long study sessions. Remember to take breaks to maintain focus.")
        
        if preferred_difficulty == "beginner":
            insights.append("You tend to prefer easier content. Try gradually increasing difficulty for better progress.")
        elif preferred_difficulty == "advanced":
            insights.append("You challenge yourself with advanced content. Great for accelerated learning!")
        
        return schemas.LearningPatterns(
            peak_study_hour=peak_hour,
            peak_study_day=peak_day,
            avg_session_length=avg_session_length,
            preferred_difficulty=preferred_difficulty,
            hourly_activity=hourly_activity,
            daily_activity=daily_activity,
            difficulty_distribution=difficulty_counts,
            insights=insights,
            generated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error("Failed to get learning patterns", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze learning patterns"
        )

@router.get("/recommendations", response_model=schemas.LearningRecommendations)
async def get_learning_recommendations(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
):
    """Get personalized learning recommendations"""
    
    try:
        # Get recent learning progress
        progress_result = await db.execute(
            select(LearningProgress)
            .where(LearningProgress.user_id == current_user.id)
            .order_by(LearningProgress.last_attempt_at.desc())
            .limit(20)
        )
        progress_records = progress_result.scalars().all()
        
        recommendations = []
        
        # Find subjects needing review
        subjects_needing_review = []
        for record in progress_records:
            if record.should_review_now():
                subjects_needing_review.append({
                    "subject": record.subject,
                    "topic": record.topic,
                    "mastery_level": record.mastery_level,
                    "days_since_review": (datetime.utcnow() - record.last_attempt_at).days
                })
        
        # Sort by urgency (lowest mastery + longest time since review)
        subjects_needing_review.sort(
            key=lambda x: x["mastery_level"] - (x["days_since_review"] * 0.1)
        )
        
        if subjects_needing_review:
            top_review = subjects_needing_review[0]
            recommendations.append({
                "type": "review",
                "priority": "high",
                "title": f"Review {top_review['topic']}",
                "description": f"It's been {top_review['days_since_review']} days since you last practiced this topic.",
                "subject": top_review["subject"],
                "estimated_time": 15
            })
        
        # Find subjects for advancement
        advanced_subjects = [
            record for record in progress_records
            if record.mastery_level > 0.8 and record.get_difficulty_recommendation() != record.difficulty_level
        ]
        
        if advanced_subjects:
            subject = advanced_subjects[0]
            recommendations.append({
                "type": "advance",
                "priority": "medium",
                "title": f"Try harder {subject.subject} problems",
                "description": f"You've mastered {subject.topic}. Ready for the next level?",
                "subject": subject.subject,
                "estimated_time": 20
            })
        
        # Find weak areas
        weak_subjects = [
            record for record in progress_records
            if record.mastery_level < 0.5 and record.total_questions > 5
        ]
        
        if weak_subjects:
            subject = weak_subjects[0]
            recommendations.append({
                "type": "practice",
                "priority": "high",
                "title": f"Practice {subject.topic}",
                "description": f"Your mastery level is {subject.mastery_level:.0%}. More practice will help!",
                "subject": subject.subject,
                "estimated_time": 25
            })
        
        # Study streak recommendations
        if not recommendations:
            recommendations.append({
                "type": "explore",
                "priority": "low",
                "title": "Explore new topics",
                "description": "You're doing great! Try learning something new today.",
                "subject": "general",
                "estimated_time": 30
            })
        
        return schemas.LearningRecommendations(
            recommendations=recommendations[:5],  # Limit to top 5
            generated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error("Failed to get recommendations", user_id=str(current_user.id), error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate recommendations"
        )
