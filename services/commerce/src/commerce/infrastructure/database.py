"""
Database connection and session management for Commerce Service.

Handles PostgreSQL connections for event store and read models.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import structlog
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
    AsyncEngine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from ..config.settings import get_settings

logger = structlog.get_logger(__name__)

# Global database engine and session factory
_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def init_database(database_url: str) -> None:
    """Initialize the database connection."""
    global _engine, _session_factory
    
    settings = get_settings()
    
    logger.info("Initializing database connection", url=database_url)
    
    # Create async engine
    _engine = create_async_engine(
        database_url,
        echo=settings.debug,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
        poolclass=NullPool if settings.is_testing else None,
        future=True,
    )
    
    # Create session factory
    _session_factory = async_sessionmaker(
        bind=_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=True,
        autocommit=False,
    )
    
    logger.info("Database connection initialized successfully")


async def close_database() -> None:
    """Close the database connection."""
    global _engine, _session_factory
    
    if _engine:
        logger.info("Closing database connection")
        await _engine.dispose()
        _engine = None
        _session_factory = None
        logger.info("Database connection closed")


def get_engine() -> AsyncEngine:
    """Get the database engine."""
    if _engine is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Get the session factory."""
    if _session_factory is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return _session_factory


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get a database session with automatic cleanup.
    
    Usage:
        async with get_db_session() as session:
            # Use session here
            pass
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables() -> None:
    """Create all database tables."""
    engine = get_engine()
    
    logger.info("Creating database tables")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    logger.info("Database tables created successfully")


async def drop_tables() -> None:
    """Drop all database tables (useful for testing)."""
    engine = get_engine()
    
    logger.info("Dropping database tables")
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    logger.info("Database tables dropped successfully")

