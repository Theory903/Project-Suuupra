import asyncio
import uvicorn
from contextlib import asynccontextmanager

from src.app import create_app
from src.core.config import settings
from src.core.database import init_db
from src.core.redis import init_redis
from src.core.storage import init_storage
from src.services.transcoding import TranscodingService
from src.utils.logger import logger


@asynccontextmanager
async def lifespan(app):
    """Application lifespan manager."""
    logger.info("🎬 Starting VOD Service...")
    
    # Initialize core services
    await init_db()
    logger.info("✅ Database initialized")
    
    await init_redis()
    logger.info("✅ Redis initialized")
    
    await init_storage()
    logger.info("✅ Storage initialized")
    
    # Initialize transcoding service
    transcoding_service = TranscodingService()
    await transcoding_service.initialize()
    app.state.transcoding_service = transcoding_service
    logger.info("✅ Transcoding service initialized")
    
    logger.info(f"🎥 VOD Service running on {settings.HOST}:{settings.PORT}")
    logger.info(f"📖 API Documentation: http://{settings.HOST}:{settings.PORT}/docs")
    logger.info(f"📊 Metrics: http://{settings.HOST}:{settings.PORT}/metrics")
    
    yield
    
    # Cleanup
    logger.info("🛑 Shutting down VOD Service...")
    await transcoding_service.shutdown()
    logger.info("✅ Graceful shutdown completed")


def main():
    """Main entry point."""
    app = create_app()
    
    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True,
        lifespan="on"
    )


if __name__ == "__main__":
    main()
