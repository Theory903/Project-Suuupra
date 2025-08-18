import asyncio
import json
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from redis import Redis
import logging

from ..config import Settings
from ..models.user_interaction import UserInteraction
from ..models.content import Content
from ..models.recommendation import Recommendation
from ..utils.ml_models import (
    CollaborativeFilteringModel,
    ContentBasedModel,
    HybridModel,
    PopularityModel
)
from ..utils.feature_engineering import FeatureEngineer
from ..utils.metrics import RecommendationMetrics

logger = logging.getLogger(__name__)

class RecommendationEngine:
    """
    Production-ready recommendation engine with multiple algorithms:
    - Collaborative Filtering (Matrix Factorization)
    - Content-Based Filtering (TF-IDF + Cosine Similarity)
    - Hybrid Model (Weighted combination)
    - Popularity-Based (Fallback for cold start)
    """
    
    def __init__(self, db: Session, redis: Redis, settings: Settings):
        self.db = db
        self.redis = redis
        self.settings = settings
        self.feature_engineer = FeatureEngineer()
        self.metrics = RecommendationMetrics()
        
        # ML Models
        self.collaborative_model = CollaborativeFilteringModel()
        self.content_model = ContentBasedModel()
        self.hybrid_model = HybridModel()
        self.popularity_model = PopularityModel()
        
        # Model weights for hybrid approach
        self.model_weights = {
            'collaborative': 0.4,
            'content': 0.3,
            'popularity': 0.2,
            'trending': 0.1
        }
        
        # Cache settings
        self.cache_ttl = settings.CACHE_TTL
        self.batch_size = settings.RECOMMENDATION_BATCH_SIZE
        
        self.is_initialized = False
        
    async def initialize(self):
        """Initialize the recommendation engine"""
        try:
            logger.info("Initializing recommendation engine...")
            
            # Load pre-trained models if available
            await self._load_models()
            
            # Initialize feature engineering pipeline
            await self.feature_engineer.initialize(self.db)
            
            # Warm up cache with popular recommendations
            await self._warm_up_cache()
            
            self.is_initialized = True
            logger.info("Recommendation engine initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize recommendation engine: {e}")
            raise
    
    async def get_recommendations(
        self,
        user_id: str,
        content_type: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 20,
        exclude_seen: bool = True,
        algorithm: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get personalized recommendations for a user
        
        Args:
            user_id: User identifier
            content_type: Filter by content type (video, article, course, etc.)
            category: Filter by category
            limit: Number of recommendations to return
            exclude_seen: Whether to exclude already seen content
            algorithm: Specific algorithm to use ('collaborative', 'content', 'hybrid', 'popularity')
        
        Returns:
            List of recommendation dictionaries with scores and explanations
        """
        if not self.is_initialized:
            raise RuntimeError("Recommendation engine not initialized")
        
        # Check cache first
        cache_key = f"recommendations:{user_id}:{content_type}:{category}:{limit}:{algorithm}"
        cached_result = await self._get_from_cache(cache_key)
        if cached_result:
            logger.info(f"Returning cached recommendations for user {user_id}")
            return cached_result
        
        try:
            # Get user profile and interaction history
            user_profile = await self._get_user_profile(user_id)
            user_interactions = await self._get_user_interactions(user_id)
            
            # Determine which algorithm to use
            if algorithm is None:
                algorithm = await self._select_algorithm(user_id, user_interactions)
            
            # Generate recommendations based on algorithm
            if algorithm == 'collaborative':
                recommendations = await self._collaborative_recommendations(
                    user_id, user_profile, limit, content_type, category
                )
            elif algorithm == 'content':
                recommendations = await self._content_based_recommendations(
                    user_id, user_profile, user_interactions, limit, content_type, category
                )
            elif algorithm == 'popularity':
                recommendations = await self._popularity_recommendations(
                    limit, content_type, category
                )
            else:  # hybrid (default)
                recommendations = await self._hybrid_recommendations(
                    user_id, user_profile, user_interactions, limit, content_type, category
                )
            
            # Post-process recommendations
            recommendations = await self._post_process_recommendations(
                recommendations, user_id, exclude_seen
            )
            
            # Add explanation and metadata
            recommendations = await self._add_explanations(recommendations, algorithm)
            
            # Cache results
            await self._cache_recommendations(cache_key, recommendations)
            
            # Log recommendation event
            await self._log_recommendation_event(user_id, algorithm, len(recommendations))
            
            logger.info(f"Generated {len(recommendations)} recommendations for user {user_id} using {algorithm}")
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating recommendations for user {user_id}: {e}")
            # Fallback to popularity-based recommendations
            return await self._popularity_recommendations(limit, content_type, category)
    
    async def _collaborative_recommendations(
        self,
        user_id: str,
        user_profile: Dict,
        limit: int,
        content_type: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate collaborative filtering recommendations"""
        
        # Get user-item interaction matrix
        interaction_matrix = await self._get_interaction_matrix()
        
        # Get user embeddings
        user_embedding = await self.collaborative_model.get_user_embedding(user_id)
        
        if user_embedding is None:
            # Cold start - fall back to popularity
            return await self._popularity_recommendations(limit, content_type, category)
        
        # Get item embeddings
        item_embeddings = await self.collaborative_model.get_item_embeddings()
        
        # Calculate similarity scores
        scores = np.dot(item_embeddings, user_embedding)
        
        # Get top items
        top_indices = np.argsort(scores)[::-1][:limit * 2]  # Get more for filtering
        
        recommendations = []
        for idx in top_indices:
            content_id = await self.collaborative_model.get_content_id_by_index(idx)
            content = await self._get_content_by_id(content_id)
            
            if content and self._matches_filters(content, content_type, category):
                recommendations.append({
                    'content_id': content_id,
                    'content': content,
                    'score': float(scores[idx]),
                    'algorithm': 'collaborative',
                    'reason': 'Users with similar preferences also liked this'
                })
                
                if len(recommendations) >= limit:
                    break
        
        return recommendations
    
    async def _content_based_recommendations(
        self,
        user_id: str,
        user_profile: Dict,
        user_interactions: List[Dict],
        limit: int,
        content_type: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate content-based recommendations"""
        
        # Build user preference profile from interactions
        user_preferences = await self._build_user_preference_profile(user_interactions)
        
        # Get content features
        content_features = await self.content_model.get_content_features()
        
        # Calculate content similarity to user preferences
        similarity_scores = await self.content_model.calculate_similarity(
            user_preferences, content_features
        )
        
        # Get top content
        top_indices = np.argsort(similarity_scores)[::-1][:limit * 2]
        
        recommendations = []
        for idx in top_indices:
            content_id = await self.content_model.get_content_id_by_index(idx)
            content = await self._get_content_by_id(content_id)
            
            if content and self._matches_filters(content, content_type, category):
                recommendations.append({
                    'content_id': content_id,
                    'content': content,
                    'score': float(similarity_scores[idx]),
                    'algorithm': 'content',
                    'reason': 'Similar to content you\'ve enjoyed before'
                })
                
                if len(recommendations) >= limit:
                    break
        
        return recommendations
    
    async def _hybrid_recommendations(
        self,
        user_id: str,
        user_profile: Dict,
        user_interactions: List[Dict],
        limit: int,
        content_type: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate hybrid recommendations combining multiple algorithms"""
        
        # Get recommendations from each algorithm
        collab_recs = await self._collaborative_recommendations(
            user_id, user_profile, limit, content_type, category
        )
        
        content_recs = await self._content_based_recommendations(
            user_id, user_profile, user_interactions, limit, content_type, category
        )
        
        popularity_recs = await self._popularity_recommendations(
            limit, content_type, category
        )
        
        # Combine and weight scores
        combined_scores = {}
        
        # Add collaborative filtering scores
        for rec in collab_recs:
            content_id = rec['content_id']
            combined_scores[content_id] = combined_scores.get(content_id, 0) + \
                rec['score'] * self.model_weights['collaborative']
        
        # Add content-based scores
        for rec in content_recs:
            content_id = rec['content_id']
            combined_scores[content_id] = combined_scores.get(content_id, 0) + \
                rec['score'] * self.model_weights['content']
        
        # Add popularity scores
        for rec in popularity_recs:
            content_id = rec['content_id']
            combined_scores[content_id] = combined_scores.get(content_id, 0) + \
                rec['score'] * self.model_weights['popularity']
        
        # Sort by combined score
        sorted_items = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)
        
        # Build final recommendations
        recommendations = []
        for content_id, score in sorted_items[:limit]:
            content = await self._get_content_by_id(content_id)
            if content:
                recommendations.append({
                    'content_id': content_id,
                    'content': content,
                    'score': float(score),
                    'algorithm': 'hybrid',
                    'reason': 'Recommended based on your preferences and similar users'
                })
        
        return recommendations
    
    async def _popularity_recommendations(
        self,
        limit: int,
        content_type: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate popularity-based recommendations (fallback for cold start)"""
        
        # Get trending content from cache or calculate
        cache_key = f"trending:{content_type}:{category}"
        trending_content = await self._get_from_cache(cache_key)
        
        if not trending_content:
            trending_content = await self._calculate_trending_content(content_type, category)
            await self._cache_result(cache_key, trending_content, ttl=3600)  # Cache for 1 hour
        
        recommendations = []
        for item in trending_content[:limit]:
            recommendations.append({
                'content_id': item['content_id'],
                'content': item,
                'score': item['popularity_score'],
                'algorithm': 'popularity',
                'reason': 'Trending and popular content'
            })
        
        return recommendations
    
    async def record_interaction(
        self,
        user_id: str,
        content_id: str,
        interaction_type: str,
        duration: Optional[int] = None,
        rating: Optional[float] = None,
        metadata: Optional[Dict] = None
    ):
        """Record user interaction for learning"""
        
        interaction = UserInteraction(
            user_id=user_id,
            content_id=content_id,
            interaction_type=interaction_type,
            duration=duration,
            rating=rating,
            metadata=metadata or {},
            timestamp=datetime.utcnow()
        )
        
        self.db.add(interaction)
        self.db.commit()
        
        # Update real-time features
        await self._update_real_time_features(user_id, content_id, interaction_type)
        
        # Invalidate cache for this user
        await self._invalidate_user_cache(user_id)
        
        logger.info(f"Recorded interaction: {user_id} -> {content_id} ({interaction_type})")
    
    async def start_background_tasks(self):
        """Start background tasks for model updates and cache maintenance"""
        
        asyncio.create_task(self._periodic_model_update())
        asyncio.create_task(self._cache_maintenance())
        asyncio.create_task(self._metrics_collection())
        
        logger.info("Background tasks started")
    
    async def _periodic_model_update(self):
        """Periodically retrain models with new data"""
        
        while True:
            try:
                await asyncio.sleep(3600)  # Update every hour
                
                logger.info("Starting periodic model update...")
                
                # Check if enough new data is available
                new_interactions = await self._count_new_interactions()
                
                if new_interactions > self.settings.MIN_INTERACTIONS_FOR_UPDATE:
                    # Retrain models
                    await self.collaborative_model.incremental_update(self.db)
                    await self.content_model.update_features(self.db)
                    
                    logger.info(f"Models updated with {new_interactions} new interactions")
                
            except Exception as e:
                logger.error(f"Error in periodic model update: {e}")
    
    async def cleanup(self):
        """Cleanup resources"""
        logger.info("Cleaning up recommendation engine...")
        # Close any open connections, save models, etc.
        pass
    
    # Helper methods
    async def _get_user_profile(self, user_id: str) -> Dict:
        """Get user profile and preferences"""
        # Implementation to fetch user profile
        pass
    
    async def _get_user_interactions(self, user_id: str) -> List[Dict]:
        """Get user interaction history"""
        # Implementation to fetch user interactions
        pass
    
    async def _get_content_by_id(self, content_id: str) -> Dict:
        """Get content details by ID"""
        # Implementation to fetch content
        pass
    
    async def _matches_filters(self, content: Dict, content_type: str, category: str) -> bool:
        """Check if content matches filters"""
        # Implementation for filtering logic
        return True
    
    async def _get_from_cache(self, key: str) -> Optional[List[Dict]]:
        """Get recommendations from cache"""
        cached = self.redis.get(key)
        if cached:
            return json.loads(cached)
        return None
    
    async def _cache_recommendations(self, key: str, recommendations: List[Dict]):
        """Cache recommendations"""
        self.redis.setex(key, self.cache_ttl, json.dumps(recommendations, default=str))
    
    # Additional helper methods would be implemented here...
