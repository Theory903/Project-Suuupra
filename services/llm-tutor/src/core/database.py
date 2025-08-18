"""
Database configuration and connection management
Handles PostgreSQL connections with async SQLAlchemy
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import structlog
from sqlalchemy import MetaData, create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool

from ..config.settings import settings

logger = structlog.get_logger(__name__)

# SQLAlchemy Base
Base = declarative_base()

# Metadata for migrations
metadata = MetaData()

# Global database engine
_async_engine = None
_sync_engine = None
_async_session_factory = None
_sync_session_factory = None


def get_sync_engine():
    """Get synchronous database engine for migrations"""
    global _sync_engine
    if _sync_engine is None:
        _sync_engine = create_engine(
            settings.database_url_sync,
            poolclass=QueuePool,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_pre_ping=True,
            echo=settings.DEBUG,
        )
    return _sync_engine


def get_async_engine():
    """Get async database engine"""
    global _async_engine
    if _async_engine is None:
        _async_engine = create_async_engine(
            settings.DATABASE_URL,
            poolclass=QueuePool,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_pre_ping=True,
            echo=settings.DEBUG,
        )
    return _async_engine


def get_sync_session_factory():
    """Get synchronous session factory"""
    global _sync_session_factory
    if _sync_session_factory is None:
        _sync_session_factory = sessionmaker(
            bind=get_sync_engine(),
            autocommit=False,
            autoflush=False,
        )
    return _sync_session_factory


def get_async_session_factory():
    """Get async session factory"""
    global _async_session_factory
    if _async_session_factory is None:
        _async_session_factory = async_sessionmaker(
            bind=get_async_engine(),
            class_=AsyncSession,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
    return _async_session_factory


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get async database session with automatic cleanup"""
    session_factory = get_async_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error("Database transaction failed", error=str(e))
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database connection and create tables"""
    try:
        engine = get_async_engine()
        
        # Test connection
        async with engine.begin() as conn:
            # Import all models to ensure they're registered with Base
            from ..models import user, conversation, content
            
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database initialized successfully")
        
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise


async def close_db():
    """Close database connections"""
    global _async_engine, _sync_engine
    
    if _async_engine:
        await _async_engine.dispose()
        _async_engine = None
    
    if _sync_engine:
        _sync_engine.dispose()
        _sync_engine = None
    
    logger.info("Database connections closed")


# Dependency for FastAPI
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions"""
    async with get_db_session() as session:
        yield session


class DatabaseHealthCheck:
    """Database health check utilities"""
    
    @staticmethod
    async def check_connection() -> bool:
        """Check if database connection is healthy"""
        try:
            async with get_db_session() as session:
                result = await session.execute("SELECT 1")
                return result.scalar() == 1
        except Exception as e:
            logger.error("Database health check failed", error=str(e))
            return False
    
    @staticmethod
    async def check_tables() -> dict:
        """Check if required tables exist"""
        table_status = {}
        
        try:
            async with get_db_session() as session:
                # Check each table
                tables_to_check = [
                    "users",
                    "learning_profiles", 
                    "conversations",
                    "messages",
                    "content_items",
                    "learning_progress"
                ]
                
                for table in tables_to_check:
                    try:
                        result = await session.execute(
                            f"SELECT COUNT(*) FROM {table} LIMIT 1"
                        )
                        table_status[table] = "exists"
                    except Exception:
                        table_status[table] = "missing"
                        
        except Exception as e:
            logger.error("Table check failed", error=str(e))
            table_status["error"] = str(e)
        
        return table_status


# Transaction management utilities
class TransactionManager:
    """Utility class for managing database transactions"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def save(self, obj):
        """Save object to database"""
        self.session.add(obj)
        await self.session.flush()
        return obj
    
    async def delete(self, obj):
        """Delete object from database"""
        await self.session.delete(obj)
        await self.session.flush()
    
    async def refresh(self, obj):
        """Refresh object from database"""
        await self.session.refresh(obj)
        return obj
    
    async def commit(self):
        """Commit transaction"""
        await self.session.commit()
    
    async def rollback(self):
        """Rollback transaction"""
        await self.session.rollback()


# Query utilities
class BaseRepository:
    """Base repository class with common database operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
        self.tx = TransactionManager(session)
    
    async def get_by_id(self, model_class, obj_id):
        """Get object by ID"""
        return await self.session.get(model_class, obj_id)
    
    async def get_by_field(self, model_class, field_name: str, value):
        """Get object by field value"""
        from sqlalchemy import select
        
        stmt = select(model_class).where(getattr(model_class, field_name) == value)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_all(self, model_class, limit: Optional[int] = None, offset: int = 0):
        """Get all objects with pagination"""
        from sqlalchemy import select
        
        stmt = select(model_class).offset(offset)
        if limit:
            stmt = stmt.limit(limit)
        
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def create(self, model_class, **kwargs):
        """Create new object"""
        obj = model_class(**kwargs)
        return await self.tx.save(obj)
    
    async def update(self, obj, **kwargs):
        """Update existing object"""
        for key, value in kwargs.items():
            setattr(obj, key, value)
        return await self.tx.save(obj)
    
    async def delete_by_id(self, model_class, obj_id):
        """Delete object by ID"""
        obj = await self.get_by_id(model_class, obj_id)
        if obj:
            await self.tx.delete(obj)
        return obj
