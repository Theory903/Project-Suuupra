import asyncio
import os
import subprocess
import json
from typing import Dict, List, Optional
from datetime import datetime
import ffmpeg
from celery import Celery
import boto3
from botocore.exceptions import ClientError

from src.core.config import settings
from src.core.database import async_session_maker
from src.models.video import Video, TranscodingJob, TranscodingStatus
from src.utils.logger import logger


class TranscodingService:
    """Production-ready video transcoding service with FFmpeg and Celery."""
    
    def __init__(self):
        self.celery_app = None
        self.s3_client = None
        self.quality_presets = {
            "240p": {"width": 426, "height": 240, "bitrate": "400k", "audio_bitrate": "64k"},
            "360p": {"width": 640, "height": 360, "bitrate": "800k", "audio_bitrate": "96k"},
            "480p": {"width": 854, "height": 480, "bitrate": "1200k", "audio_bitrate": "128k"},
            "720p": {"width": 1280, "height": 720, "bitrate": "2500k", "audio_bitrate": "192k"},
            "1080p": {"width": 1920, "height": 1080, "bitrate": "5000k", "audio_bitrate": "256k"}
        }
    
    async def initialize(self):
        """Initialize the transcoding service."""
        # Initialize Celery
        self.celery_app = Celery(
            'vod-transcoding',
            broker=settings.REDIS_URL,
            backend=settings.REDIS_URL
        )
        
        # Configure Celery
        self.celery_app.conf.update(
            task_serializer='json',
            accept_content=['json'],
            result_serializer='json',
            timezone='UTC',
            enable_utc=True,
            worker_prefetch_multiplier=1,
            task_acks_late=True,
            worker_max_tasks_per_child=50
        )
        
        # Initialize S3 client
        self.s3_client = boto3.client(
            's3',
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        )
        
        # Ensure directories exist
        os.makedirs(settings.VIDEO_STORAGE_PATH, exist_ok=True)
        os.makedirs(settings.OUTPUT_STORAGE_PATH, exist_ok=True)
        
        logger.info("Transcoding service initialized")
    
    async def start_transcoding(self, video_id: str) -> bool:
        """Start transcoding for a video."""
        try:
            async with async_session_maker() as session:
                # Get video
                video = await session.get(Video, video_id)
                if not video:
                    logger.error(f"Video not found: {video_id}")
                    return False
                
                # Update video status
                video.status = "transcoding"
                await session.commit()
                
                # Create transcoding jobs for each quality level
                for quality in settings.QUALITY_LEVELS:
                    for output_format in settings.OUTPUT_FORMATS:
                        job = TranscodingJob(
                            id=f"{video_id}_{quality}_{output_format}",
                            video_id=video_id,
                            output_format=output_format,
                            quality=quality,
                            status=TranscodingStatus.PENDING
                        )
                        session.add(job)
                
                await session.commit()
                
                # Submit Celery tasks
                for quality in settings.QUALITY_LEVELS:
                    for output_format in settings.OUTPUT_FORMATS:
                        self.celery_app.send_task(
                            'transcode_video',
                            args=[video_id, quality, output_format],
                            queue=settings.TRANSCODING_QUEUE
                        )
                
                logger.info(f"Transcoding started for video: {video_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error starting transcoding: {e}")
            return False
    
    async def transcode_video(self, video_id: str, quality: str, output_format: str) -> bool:
        """Transcode a video to specific quality and format."""
        job_id = f"{video_id}_{quality}_{output_format}"
        
        try:
            async with async_session_maker() as session:
                # Get job and video
                job = await session.get(TranscodingJob, job_id)
                video = await session.get(Video, video_id)
                
                if not job or not video:
                    logger.error(f"Job or video not found: {job_id}")
                    return False
                
                # Update job status
                job.status = TranscodingStatus.IN_PROGRESS
                job.started_at = datetime.utcnow()
                await session.commit()
                
                # Download original video from S3
                local_input_path = os.path.join(settings.VIDEO_STORAGE_PATH, f"{video_id}_original")
                await self._download_from_s3(video.s3_bucket, video.s3_key, local_input_path)
                
                # Prepare output path
                output_filename = f"{video_id}_{quality}.{output_format}"
                local_output_path = os.path.join(settings.OUTPUT_STORAGE_PATH, output_filename)
                
                # Get quality preset
                preset = self.quality_presets.get(quality)
                if not preset:
                    raise ValueError(f"Unknown quality preset: {quality}")
                
                # Transcode video
                success = await self._transcode_with_ffmpeg(
                    local_input_path,
                    local_output_path,
                    preset,
                    output_format,
                    job_id
                )
                
                if success:
                    # Upload transcoded video to S3
                    output_s3_key = f"videos/{video_id}/transcoded/{output_filename}"
                    await self._upload_to_s3(
                        local_output_path,
                        settings.S3_BUCKET_NAME,
                        output_s3_key
                    )
                    
                    # Get file info
                    file_size = os.path.getsize(local_output_path)
                    duration = await self._get_video_duration(local_output_path)
                    
                    # Update job
                    job.status = TranscodingStatus.COMPLETED
                    job.completed_at = datetime.utcnow()
                    job.output_s3_key = output_s3_key
                    job.output_file_size = file_size
                    job.output_duration = duration
                    job.progress = 100
                    
                    # Clean up local files
                    os.remove(local_input_path)
                    os.remove(local_output_path)
                    
                else:
                    job.status = TranscodingStatus.FAILED
                    job.error_message = "Transcoding failed"
                
                await session.commit()
                
                # Check if all jobs are complete
                await self._check_video_completion(video_id)
                
                logger.info(f"Transcoding job completed: {job_id}")
                return success
                
        except Exception as e:
            logger.error(f"Error transcoding video: {e}")
            
            # Update job status to failed
            try:
                async with async_session_maker() as session:
                    job = await session.get(TranscodingJob, job_id)
                    if job:
                        job.status = TranscodingStatus.FAILED
                        job.error_message = str(e)
                        await session.commit()
            except Exception:
                pass
            
            return False
    
    async def _transcode_with_ffmpeg(
        self,
        input_path: str,
        output_path: str,
        preset: Dict,
        output_format: str,
        job_id: str
    ) -> bool:
        """Transcode video using FFmpeg."""
        try:
            # Build FFmpeg command
            stream = ffmpeg.input(input_path)
            
            # Video encoding settings
            video_args = {
                'vcodec': 'libx264' if output_format == 'mp4' else 'libvpx-vp9',
                'vf': f"scale={preset['width']}:{preset['height']}",
                'b:v': preset['bitrate'],
                'preset': 'medium',
                'crf': 23
            }
            
            # Audio encoding settings
            audio_args = {
                'acodec': 'aac' if output_format == 'mp4' else 'libopus',
                'b:a': preset['audio_bitrate']
            }
            
            # Combine streams
            out = ffmpeg.output(
                stream,
                output_path,
                **video_args,
                **audio_args,
                movflags='faststart'  # Enable progressive download for MP4
            )
            
            # Run FFmpeg with progress tracking
            process = await asyncio.create_subprocess_exec(
                *ffmpeg.compile(out, overwrite_output=True),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                logger.info(f"FFmpeg transcoding successful: {job_id}")
                return True
            else:
                logger.error(f"FFmpeg transcoding failed: {stderr.decode()}")
                return False
                
        except Exception as e:
            logger.error(f"Error in FFmpeg transcoding: {e}")
            return False
    
    async def _download_from_s3(self, bucket: str, key: str, local_path: str):
        """Download file from S3."""
        try:
            self.s3_client.download_file(bucket, key, local_path)
            logger.debug(f"Downloaded from S3: {bucket}/{key}")
        except ClientError as e:
            logger.error(f"Error downloading from S3: {e}")
            raise
    
    async def _upload_to_s3(self, local_path: str, bucket: str, key: str):
        """Upload file to S3."""
        try:
            self.s3_client.upload_file(local_path, bucket, key)
            logger.debug(f"Uploaded to S3: {bucket}/{key}")
        except ClientError as e:
            logger.error(f"Error uploading to S3: {e}")
            raise
    
    async def _get_video_duration(self, video_path: str) -> int:
        """Get video duration in seconds."""
        try:
            probe = ffmpeg.probe(video_path)
            duration = float(probe['streams'][0]['duration'])
            return int(duration)
        except Exception as e:
            logger.error(f"Error getting video duration: {e}")
            return 0
    
    async def _check_video_completion(self, video_id: str):
        """Check if all transcoding jobs for a video are complete."""
        try:
            async with async_session_maker() as session:
                # Get all jobs for video
                jobs = await session.execute(
                    f"SELECT * FROM transcoding_jobs WHERE video_id = '{video_id}'"
                )
                jobs = jobs.fetchall()
                
                if not jobs:
                    return
                
                # Check if all jobs are complete
                all_complete = all(
                    job.status in [TranscodingStatus.COMPLETED, TranscodingStatus.FAILED]
                    for job in jobs
                )
                
                if all_complete:
                    # Check if any job succeeded
                    any_success = any(
                        job.status == TranscodingStatus.COMPLETED
                        for job in jobs
                    )
                    
                    # Update video status
                    video = await session.get(Video, video_id)
                    if video:
                        if any_success:
                            video.status = "completed"
                            video.processed_at = datetime.utcnow()
                            
                            # Generate CDN URLs
                            await self._generate_cdn_urls(video_id)
                        else:
                            video.status = "failed"
                            video.error_message = "All transcoding jobs failed"
                        
                        await session.commit()
                        logger.info(f"Video processing completed: {video_id}, status: {video.status}")
                
        except Exception as e:
            logger.error(f"Error checking video completion: {e}")
    
    async def _generate_cdn_urls(self, video_id: str):
        """Generate CDN URLs for transcoded videos."""
        try:
            # In a real implementation, this would:
            # 1. Create CloudFront distributions
            # 2. Configure cache behaviors
            # 3. Set up HLS/DASH manifests
            # 4. Update video record with CDN URLs
            
            cdn_url = f"{settings.CDN_BASE_URL}/videos/{video_id}/master.m3u8"
            
            async with async_session_maker() as session:
                video = await session.get(Video, video_id)
                if video:
                    video.cdn_url = cdn_url
                    await session.commit()
                    
            logger.info(f"CDN URLs generated for video: {video_id}")
            
        except Exception as e:
            logger.error(f"Error generating CDN URLs: {e}")
    
    async def generate_thumbnails(self, video_id: str) -> bool:
        """Generate thumbnails for a video."""
        try:
            async with async_session_maker() as session:
                video = await session.get(Video, video_id)
                if not video:
                    return False
                
                # Download original video
                local_input_path = os.path.join(settings.VIDEO_STORAGE_PATH, f"{video_id}_original")
                await self._download_from_s3(video.s3_bucket, video.s3_key, local_input_path)
                
                # Generate thumbnail at 10% of video duration
                thumbnail_path = os.path.join(settings.OUTPUT_STORAGE_PATH, f"{video_id}_thumb.jpg")
                
                # Get video duration first
                duration = await self._get_video_duration(local_input_path)
                thumbnail_time = max(1, duration * 0.1)  # 10% into the video
                
                # Generate thumbnail using FFmpeg
                (
                    ffmpeg
                    .input(local_input_path, ss=thumbnail_time)
                    .output(thumbnail_path, vframes=1, format='image2', vcodec='mjpeg')
                    .overwrite_output()
                    .run(quiet=True)
                )
                
                # Upload thumbnail to S3
                thumbnail_s3_key = f"videos/{video_id}/thumbnail.jpg"
                await self._upload_to_s3(
                    thumbnail_path,
                    settings.S3_BUCKET_NAME,
                    thumbnail_s3_key
                )
                
                # Update video record
                video.thumbnail_url = f"{settings.CDN_BASE_URL}/{thumbnail_s3_key}"
                await session.commit()
                
                # Clean up
                os.remove(local_input_path)
                os.remove(thumbnail_path)
                
                logger.info(f"Thumbnail generated for video: {video_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error generating thumbnails: {e}")
            return False
    
    async def generate_preview_gif(self, video_id: str) -> bool:
        """Generate a preview GIF for a video."""
        try:
            async with async_session_maker() as session:
                video = await session.get(Video, video_id)
                if not video:
                    return False
                
                # Download original video
                local_input_path = os.path.join(settings.VIDEO_STORAGE_PATH, f"{video_id}_original")
                await self._download_from_s3(video.s3_bucket, video.s3_key, local_input_path)
                
                # Generate 5-second preview GIF
                gif_path = os.path.join(settings.OUTPUT_STORAGE_PATH, f"{video_id}_preview.gif")
                
                # Get video duration
                duration = await self._get_video_duration(local_input_path)
                start_time = max(1, duration * 0.1)  # Start at 10%
                
                # Generate GIF using FFmpeg
                (
                    ffmpeg
                    .input(local_input_path, ss=start_time, t=5)
                    .output(
                        gif_path,
                        vf='fps=10,scale=320:-1:flags=lanczos,palettegen=reserve_transparent=0',
                        format='gif'
                    )
                    .overwrite_output()
                    .run(quiet=True)
                )
                
                # Upload GIF to S3
                gif_s3_key = f"videos/{video_id}/preview.gif"
                await self._upload_to_s3(
                    gif_path,
                    settings.S3_BUCKET_NAME,
                    gif_s3_key
                )
                
                # Update video record
                video.preview_gif_url = f"{settings.CDN_BASE_URL}/{gif_s3_key}"
                await session.commit()
                
                # Clean up
                os.remove(local_input_path)
                os.remove(gif_path)
                
                logger.info(f"Preview GIF generated for video: {video_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error generating preview GIF: {e}")
            return False
    
    async def generate_hls_manifest(self, video_id: str) -> bool:
        """Generate HLS manifest for adaptive bitrate streaming."""
        try:
            async with async_session_maker() as session:
                # Get completed transcoding jobs
                jobs = await session.execute(
                    f"""
                    SELECT * FROM transcoding_jobs 
                    WHERE video_id = '{video_id}' 
                    AND status = 'completed' 
                    AND output_format = 'mp4'
                    ORDER BY quality
                    """
                )
                jobs = jobs.fetchall()
                
                if not jobs:
                    logger.warning(f"No completed transcoding jobs found for video: {video_id}")
                    return False
                
                # Generate master playlist
                master_playlist = "#EXTM3U\n#EXT-X-VERSION:3\n\n"
                
                for job in jobs:
                    preset = self.quality_presets.get(job.quality)
                    if preset:
                        bitrate = int(preset['bitrate'].replace('k', '')) * 1000
                        resolution = f"{preset['width']}x{preset['height']}"
                        
                        master_playlist += f"""#EXT-X-STREAM-INF:BANDWIDTH={bitrate},RESOLUTION={resolution}
{job.quality}/index.m3u8

"""
                
                # Upload master playlist to S3
                master_playlist_key = f"videos/{video_id}/master.m3u8"
                await self._upload_text_to_s3(
                    master_playlist,
                    settings.S3_BUCKET_NAME,
                    master_playlist_key
                )
                
                # Update video CDN URL
                video = await session.get(Video, video_id)
                if video:
                    video.cdn_url = f"{settings.CDN_BASE_URL}/{master_playlist_key}"
                    await session.commit()
                
                logger.info(f"HLS manifest generated for video: {video_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error generating HLS manifest: {e}")
            return False
    
    async def _upload_text_to_s3(self, content: str, bucket: str, key: str):
        """Upload text content to S3."""
        try:
            self.s3_client.put_object(
                Bucket=bucket,
                Key=key,
                Body=content.encode('utf-8'),
                ContentType='application/x-mpegURL' if key.endswith('.m3u8') else 'text/plain'
            )
        except ClientError as e:
            logger.error(f"Error uploading text to S3: {e}")
            raise
    
    async def get_transcoding_progress(self, video_id: str) -> Dict:
        """Get transcoding progress for a video."""
        try:
            async with async_session_maker() as session:
                jobs = await session.execute(
                    f"SELECT * FROM transcoding_jobs WHERE video_id = '{video_id}'"
                )
                jobs = jobs.fetchall()
                
                if not jobs:
                    return {"progress": 0, "status": "not_started"}
                
                total_jobs = len(jobs)
                completed_jobs = sum(1 for job in jobs if job.status == TranscodingStatus.COMPLETED)
                failed_jobs = sum(1 for job in jobs if job.status == TranscodingStatus.FAILED)
                
                overall_progress = (completed_jobs / total_jobs) * 100
                
                if failed_jobs == total_jobs:
                    status = "failed"
                elif completed_jobs == total_jobs:
                    status = "completed"
                elif any(job.status == TranscodingStatus.IN_PROGRESS for job in jobs):
                    status = "in_progress"
                else:
                    status = "pending"
                
                return {
                    "progress": round(overall_progress, 2),
                    "status": status,
                    "total_jobs": total_jobs,
                    "completed_jobs": completed_jobs,
                    "failed_jobs": failed_jobs,
                    "jobs": [
                        {
                            "id": job.id,
                            "quality": job.quality,
                            "format": job.output_format,
                            "status": job.status,
                            "progress": job.progress
                        }
                        for job in jobs
                    ]
                }
                
        except Exception as e:
            logger.error(f"Error getting transcoding progress: {e}")
            return {"progress": 0, "status": "error"}
    
    async def cancel_transcoding(self, video_id: str) -> bool:
        """Cancel transcoding for a video."""
        try:
            async with async_session_maker() as session:
                # Update all pending/in-progress jobs
                await session.execute(
                    f"""
                    UPDATE transcoding_jobs 
                    SET status = 'failed', error_message = 'Cancelled by user'
                    WHERE video_id = '{video_id}' 
                    AND status IN ('pending', 'in_progress')
                    """
                )
                
                # Update video status
                video = await session.get(Video, video_id)
                if video:
                    video.status = "failed"
                    video.error_message = "Transcoding cancelled"
                
                await session.commit()
                
                logger.info(f"Transcoding cancelled for video: {video_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error cancelling transcoding: {e}")
            return False
    
    async def shutdown(self):
        """Shutdown the transcoding service."""
        if self.celery_app:
            self.celery_app.control.shutdown()
        logger.info("Transcoding service shut down")
