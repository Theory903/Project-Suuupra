"""
Prometheus Metrics Collection for LLM Tutor Service

This module provides comprehensive metrics collection for:
- LLM performance metrics (latency, tokens/sec, throughput)
- RAG retrieval metrics (hit@k, relevance scores)
- Safety filter metrics (blocked content rates)
- User engagement metrics (session duration, completion rates)
- Infrastructure metrics (GPU utilization, memory usage)
- Cost and resource utilization tracking

All metrics follow Prometheus naming conventions and include appropriate labels
for multi-dimensional analysis and alerting.
"""

import time
import psutil
import threading
from typing import Dict, List, Optional, Any
from functools import wraps
from contextlib import contextmanager

from prometheus_client import (
    Counter, Histogram, Gauge, Summary, Enum, Info,
    CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST
)

class LLMMetrics:
    """Comprehensive metrics collection for LLM Tutor Service"""
    
    def __init__(self, registry: Optional[CollectorRegistry] = None):
        self.registry = registry or CollectorRegistry()
        self._setup_metrics()
        self._start_system_metrics_collection()
    
    def _setup_metrics(self):
        """Initialize all metric collectors"""
        
        # === LLM PERFORMANCE METRICS ===
        
        # LLM inference latency
        self.llm_inference_duration = Histogram(
            name='llm_inference_duration_seconds',
            documentation='Time spent on LLM inference',
            labelnames=['model_name', 'model_version', 'request_type', 'status'],
            buckets=[0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0],
            registry=self.registry
        )
        
        # First token latency (TTFT - Time To First Token)
        self.llm_first_token_latency = Histogram(
            name='llm_first_token_latency_seconds',
            documentation='Time to first token generation',
            labelnames=['model_name', 'model_version'],
            buckets=[0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0],
            registry=self.registry
        )
        
        # Token generation rate
        self.llm_tokens_per_second = Histogram(
            name='llm_tokens_per_second',
            documentation='Token generation rate (tokens/second)',
            labelnames=['model_name', 'model_version'],
            buckets=[1, 5, 10, 20, 50, 100, 200, 500],
            registry=self.registry
        )
        
        # Token usage counters
        self.llm_tokens_total = Counter(
            name='llm_tokens_total',
            documentation='Total tokens processed',
            labelnames=['model_name', 'token_type', 'user_tier'],  # token_type: input/output
            registry=self.registry
        )
        
        # LLM request counters
        self.llm_requests_total = Counter(
            name='llm_requests_total',
            documentation='Total LLM requests',
            labelnames=['model_name', 'status', 'request_type'],
            registry=self.registry
        )
        
        # LLM errors
        self.llm_errors_total = Counter(
            name='llm_errors_total',
            documentation='Total LLM errors',
            labelnames=['model_name', 'error_type', 'error_code'],
            registry=self.registry
        )
        
        # Current active LLM requests
        self.llm_active_requests = Gauge(
            name='llm_active_requests',
            documentation='Number of active LLM requests',
            labelnames=['model_name'],
            registry=self.registry
        )
        
        # === RAG RETRIEVAL METRICS ===
        
        # RAG pipeline latency
        self.rag_pipeline_duration = Histogram(
            name='rag_pipeline_duration_seconds',
            documentation='Time spent in RAG pipeline',
            labelnames=['pipeline_stage', 'retrieval_type', 'status'],
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0],
            registry=self.registry
        )
        
        # Retrieval hit rate (hit@k metrics)
        self.rag_hit_rate = Histogram(
            name='rag_hit_rate',
            documentation='RAG retrieval hit rate at different k values',
            labelnames=['k_value', 'retrieval_type', 'subject_area'],
            buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
            registry=self.registry
        )
        
        # Relevance scores
        self.rag_relevance_score = Histogram(
            name='rag_relevance_score',
            documentation='RAG retrieval relevance scores',
            labelnames=['retrieval_type', 'rerank_enabled'],
            buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
            registry=self.registry
        )
        
        # Retrieved chunks count
        self.rag_chunks_retrieved = Histogram(
            name='rag_chunks_retrieved_count',
            documentation='Number of chunks retrieved by RAG',
            labelnames=['retrieval_type', 'query_complexity'],
            buckets=[1, 3, 5, 10, 15, 20, 30, 50],
            registry=self.registry
        )
        
        # Context length after RAG
        self.rag_context_length = Histogram(
            name='rag_context_length_chars',
            documentation='Character length of RAG context',
            labelnames=['retrieval_type'],
            buckets=[100, 500, 1000, 2000, 5000, 10000, 20000, 50000],
            registry=self.registry
        )
        
        # Vector database operation metrics
        self.vector_db_operations = Counter(
            name='vector_db_operations_total',
            documentation='Total vector database operations',
            labelnames=['operation', 'collection', 'status'],
            registry=self.registry
        )
        
        self.vector_db_latency = Histogram(
            name='vector_db_operation_duration_seconds',
            documentation='Vector database operation latency',
            labelnames=['operation', 'collection'],
            buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
            registry=self.registry
        )
        
        # === SAFETY & MODERATION METRICS ===
        
        # Safety filter results
        self.safety_filter_results = Counter(
            name='safety_filter_results_total',
            documentation='Safety filter classification results',
            labelnames=['filter_type', 'classification', 'action'],  # filter_type: input/output
            registry=self.registry
        )
        
        # Content blocked rates
        self.content_blocked_rate = Histogram(
            name='content_blocked_rate',
            documentation='Rate of content blocked by safety filters',
            labelnames=['filter_type', 'block_reason'],
            buckets=[0.0, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5],
            registry=self.registry
        )
        
        # Safety filter latency
        self.safety_filter_duration = Histogram(
            name='safety_filter_duration_seconds',
            documentation='Time spent in safety filtering',
            labelnames=['filter_type', 'model_name'],
            buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
            registry=self.registry
        )
        
        # Safety confidence scores
        self.safety_confidence_score = Histogram(
            name='safety_confidence_score',
            documentation='Safety classification confidence scores',
            labelnames=['filter_type', 'classification'],
            buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
            registry=self.registry
        )
        
        # === USER ENGAGEMENT METRICS ===
        
        # Session duration
        self.user_session_duration = Histogram(
            name='user_session_duration_seconds',
            documentation='User session duration',
            labelnames=['user_tier', 'subject_area', 'session_type'],
            buckets=[30, 60, 120, 300, 600, 1200, 1800, 3600, 7200],
            registry=self.registry
        )
        
        # Conversation completion rates
        self.conversation_completion_rate = Histogram(
            name='conversation_completion_rate',
            documentation='Rate of completed conversations',
            labelnames=['subject_area', 'difficulty_level'],
            buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
            registry=self.registry
        )
        
        # User interaction patterns
        self.user_interactions_total = Counter(
            name='user_interactions_total',
            documentation='Total user interactions',
            labelnames=['interaction_type', 'subject_area', 'user_tier'],
            registry=self.registry
        )
        
        # Learning progress metrics
        self.learning_progress_score = Histogram(
            name='learning_progress_score',
            documentation='Learning progress scores',
            labelnames=['subject_area', 'difficulty_level', 'assessment_type'],
            buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
            registry=self.registry
        )
        
        # === VOICE PROCESSING METRICS ===
        
        # ASR metrics
        self.voice_asr_duration = Histogram(
            name='voice_asr_duration_seconds',
            documentation='ASR processing time',
            labelnames=['model_name', 'language', 'audio_quality'],
            buckets=[0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0],
            registry=self.registry
        )
        
        self.voice_asr_confidence = Histogram(
            name='voice_asr_confidence_score',
            documentation='ASR confidence scores',
            labelnames=['model_name', 'language'],
            buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
            registry=self.registry
        )
        
        self.voice_asr_wer = Histogram(
            name='voice_asr_word_error_rate',
            documentation='ASR Word Error Rate',
            labelnames=['model_name', 'language', 'audio_quality'],
            buckets=[0.0, 0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5],
            registry=self.registry
        )
        
        # TTS metrics
        self.voice_tts_duration = Histogram(
            name='voice_tts_duration_seconds',
            documentation='TTS processing time',
            labelnames=['model_name', 'voice_id', 'language'],
            buckets=[0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0],
            registry=self.registry
        )
        
        self.voice_tts_quality_score = Histogram(
            name='voice_tts_quality_score',
            documentation='TTS output quality scores',
            labelnames=['model_name', 'voice_id'],
            buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
            registry=self.registry
        )
        
        # === INFRASTRUCTURE METRICS ===
        
        # System resource utilization
        self.system_cpu_usage = Gauge(
            name='system_cpu_usage_percent',
            documentation='System CPU usage percentage',
            registry=self.registry
        )
        
        self.system_memory_usage = Gauge(
            name='system_memory_usage_bytes',
            documentation='System memory usage in bytes',
            registry=self.registry
        )
        
        self.system_memory_usage_percent = Gauge(
            name='system_memory_usage_percent',
            documentation='System memory usage percentage',
            registry=self.registry
        )
        
        # GPU metrics (if available)
        self.gpu_usage_percent = Gauge(
            name='gpu_usage_percent',
            documentation='GPU utilization percentage',
            labelnames=['gpu_id', 'gpu_model'],
            registry=self.registry
        )
        
        self.gpu_memory_usage_bytes = Gauge(
            name='gpu_memory_usage_bytes',
            documentation='GPU memory usage in bytes',
            labelnames=['gpu_id', 'gpu_model'],
            registry=self.registry
        )
        
        self.gpu_temperature_celsius = Gauge(
            name='gpu_temperature_celsius',
            documentation='GPU temperature in Celsius',
            labelnames=['gpu_id', 'gpu_model'],
            registry=self.registry
        )
        
        # Model loading and caching
        self.model_cache_hits_total = Counter(
            name='model_cache_hits_total',
            documentation='Total model cache hits',
            labelnames=['model_name', 'cache_type'],
            registry=self.registry
        )
        
        self.model_cache_misses_total = Counter(
            name='model_cache_misses_total',
            documentation='Total model cache misses',
            labelnames=['model_name', 'cache_type'],
            registry=self.registry
        )
        
        self.model_loading_duration = Histogram(
            name='model_loading_duration_seconds',
            documentation='Time spent loading models',
            labelnames=['model_name', 'model_size'],
            buckets=[1, 5, 10, 30, 60, 120, 300, 600],
            registry=self.registry
        )
        
        # === COST METRICS ===
        
        # Cost per request
        self.cost_per_request = Histogram(
            name='cost_per_request_usd',
            documentation='Cost per request in USD',
            labelnames=['service_component', 'user_tier'],
            buckets=[0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0],
            registry=self.registry
        )
        
        # Token cost tracking
        self.token_cost_total = Counter(
            name='token_cost_total_usd',
            documentation='Total token cost in USD',
            labelnames=['model_name', 'token_type', 'user_tier'],
            registry=self.registry
        )
        
        # Resource cost tracking
        self.resource_cost_hourly = Gauge(
            name='resource_cost_hourly_usd',
            documentation='Hourly resource cost in USD',
            labelnames=['resource_type', 'resource_id'],
            registry=self.registry
        )
    
    def _start_system_metrics_collection(self):
        """Start background thread for system metrics collection"""
        def collect_system_metrics():
            while True:
                try:
                    # CPU usage
                    cpu_percent = psutil.cpu_percent(interval=1)
                    self.system_cpu_usage.set(cpu_percent)
                    
                    # Memory usage
                    memory = psutil.virtual_memory()
                    self.system_memory_usage.set(memory.used)
                    self.system_memory_usage_percent.set(memory.percent)
                    
                    # GPU metrics would be collected here if GPU monitoring library is available
                    # e.g., nvidia-ml-py, GPUtil, etc.
                    
                except Exception as e:
                    print(f"Error collecting system metrics: {e}")
                
                time.sleep(30)  # Collect every 30 seconds
        
        thread = threading.Thread(target=collect_system_metrics, daemon=True)
        thread.start()
    
    # === METRIC RECORDING METHODS ===
    
    @contextmanager
    def time_llm_inference(self, model_name: str, model_version: str = "latest", request_type: str = "chat"):
        """Context manager for timing LLM inference"""
        labels = {'model_name': model_name, 'model_version': model_version, 'request_type': request_type}
        
        self.llm_active_requests.labels(model_name=model_name).inc()
        start_time = time.time()
        first_token_time = None
        
        try:
            yield {
                'set_first_token_time': lambda: setattr(self, '_temp_first_token_time', time.time()),
                'labels': labels
            }
            
            # Record successful completion
            duration = time.time() - start_time
            self.llm_inference_duration.labels(**labels, status='success').observe(duration)
            
            # Record first token latency if set
            if hasattr(self, '_temp_first_token_time'):
                first_token_duration = self._temp_first_token_time - start_time
                self.llm_first_token_latency.labels(
                    model_name=model_name, 
                    model_version=model_version
                ).observe(first_token_duration)
                delattr(self, '_temp_first_token_time')
            
            self.llm_requests_total.labels(
                model_name=model_name, 
                status='success', 
                request_type=request_type
            ).inc()
            
        except Exception as e:
            # Record error
            duration = time.time() - start_time
            self.llm_inference_duration.labels(**labels, status='error').observe(duration)
            self.llm_requests_total.labels(
                model_name=model_name, 
                status='error', 
                request_type=request_type
            ).inc()
            self.llm_errors_total.labels(
                model_name=model_name,
                error_type=type(e).__name__,
                error_code=getattr(e, 'code', 'unknown')
            ).inc()
            raise
        finally:
            self.llm_active_requests.labels(model_name=model_name).dec()
    
    def record_token_usage(self, model_name: str, input_tokens: int, output_tokens: int, 
                          user_tier: str = "free", cost_per_token: float = 0.0):
        """Record token usage and costs"""
        
        self.llm_tokens_total.labels(
            model_name=model_name,
            token_type='input',
            user_tier=user_tier
        ).inc(input_tokens)
        
        self.llm_tokens_total.labels(
            model_name=model_name,
            token_type='output', 
            user_tier=user_tier
        ).inc(output_tokens)
        
        # Record costs if provided
        if cost_per_token > 0:
            input_cost = input_tokens * cost_per_token * 0.5  # Assuming input is 50% of output cost
            output_cost = output_tokens * cost_per_token
            
            self.token_cost_total.labels(
                model_name=model_name,
                token_type='input',
                user_tier=user_tier
            ).inc(input_cost)
            
            self.token_cost_total.labels(
                model_name=model_name,
                token_type='output',
                user_tier=user_tier
            ).inc(output_cost)
    
    def record_tokens_per_second(self, model_name: str, model_version: str, tokens_per_sec: float):
        """Record token generation rate"""
        self.llm_tokens_per_second.labels(
            model_name=model_name,
            model_version=model_version
        ).observe(tokens_per_sec)
    
    @contextmanager
    def time_rag_operation(self, pipeline_stage: str, retrieval_type: str = "hybrid"):
        """Context manager for timing RAG operations"""
        labels = {'pipeline_stage': pipeline_stage, 'retrieval_type': retrieval_type}
        start_time = time.time()
        
        try:
            yield labels
            duration = time.time() - start_time
            self.rag_pipeline_duration.labels(**labels, status='success').observe(duration)
        except Exception as e:
            duration = time.time() - start_time
            self.rag_pipeline_duration.labels(**labels, status='error').observe(duration)
            raise
    
    def record_rag_metrics(self, hit_rate: float, relevance_score: float, chunks_count: int,
                          context_length: int, retrieval_type: str = "hybrid", 
                          k_value: int = 10, subject_area: str = "general"):
        """Record RAG retrieval quality metrics"""
        
        self.rag_hit_rate.labels(
            k_value=str(k_value),
            retrieval_type=retrieval_type,
            subject_area=subject_area
        ).observe(hit_rate)
        
        self.rag_relevance_score.labels(
            retrieval_type=retrieval_type,
            rerank_enabled='true'  # Assume reranking is enabled
        ).observe(relevance_score)
        
        self.rag_chunks_retrieved.labels(
            retrieval_type=retrieval_type,
            query_complexity='medium'  # Could be determined dynamically
        ).observe(chunks_count)
        
        self.rag_context_length.labels(
            retrieval_type=retrieval_type
        ).observe(context_length)
    
    def record_safety_filter_result(self, filter_type: str, classification: str, 
                                   action: str, confidence_score: float,
                                   duration: float, model_name: str = "default"):
        """Record safety filter results and metrics"""
        
        self.safety_filter_results.labels(
            filter_type=filter_type,
            classification=classification,
            action=action
        ).inc()
        
        self.safety_confidence_score.labels(
            filter_type=filter_type,
            classification=classification
        ).observe(confidence_score)
        
        self.safety_filter_duration.labels(
            filter_type=filter_type,
            model_name=model_name
        ).observe(duration)
        
        # Record block rate if content was blocked
        if action == "block":
            self.content_blocked_rate.labels(
                filter_type=filter_type,
                block_reason=classification
            ).observe(1.0)
    
    def record_user_engagement(self, session_duration: float, completion_rate: float,
                              interaction_type: str, subject_area: str = "general",
                              user_tier: str = "free", difficulty_level: str = "medium"):
        """Record user engagement metrics"""
        
        self.user_session_duration.labels(
            user_tier=user_tier,
            subject_area=subject_area,
            session_type='tutoring'
        ).observe(session_duration)
        
        self.conversation_completion_rate.labels(
            subject_area=subject_area,
            difficulty_level=difficulty_level
        ).observe(completion_rate)
        
        self.user_interactions_total.labels(
            interaction_type=interaction_type,
            subject_area=subject_area,
            user_tier=user_tier
        ).inc()
    
    def record_voice_metrics(self, operation: str, duration: float, quality_score: float,
                           model_name: str, language: str = "en", **kwargs):
        """Record voice processing metrics"""
        
        if operation == "asr":
            self.voice_asr_duration.labels(
                model_name=model_name,
                language=language,
                audio_quality=kwargs.get('audio_quality', 'medium')
            ).observe(duration)
            
            if 'confidence' in kwargs:
                self.voice_asr_confidence.labels(
                    model_name=model_name,
                    language=language
                ).observe(kwargs['confidence'])
            
            if 'word_error_rate' in kwargs:
                self.voice_asr_wer.labels(
                    model_name=model_name,
                    language=language,
                    audio_quality=kwargs.get('audio_quality', 'medium')
                ).observe(kwargs['word_error_rate'])
        
        elif operation == "tts":
            self.voice_tts_duration.labels(
                model_name=model_name,
                voice_id=kwargs.get('voice_id', 'default'),
                language=language
            ).observe(duration)
            
            self.voice_tts_quality_score.labels(
                model_name=model_name,
                voice_id=kwargs.get('voice_id', 'default')
            ).observe(quality_score)
    
    def get_metrics(self) -> str:
        """Return current metrics in Prometheus format"""
        return generate_latest(self.registry)
    
    def get_content_type(self) -> str:
        """Return the content type for metrics endpoint"""
        return CONTENT_TYPE_LATEST

# Global metrics instance
llm_metrics: Optional[LLMMetrics] = None

def get_metrics() -> LLMMetrics:
    """Get the global metrics instance"""
    global llm_metrics
    if llm_metrics is None:
        llm_metrics = LLMMetrics()
    return llm_metrics

def metrics_middleware(app):
    """FastAPI middleware for automatic metrics collection"""
    from fastapi import Request, Response
    import time
    
    @app.middleware("http")
    async def collect_metrics(request: Request, call_next):
        start_time = time.time()
        
        try:
            response = await call_next(request)
            duration = time.time() - start_time
            
            # Record HTTP metrics
            metrics = get_metrics()
            # Implementation would need to be adapted based on specific FastAPI setup
            
            return response
        except Exception as e:
            duration = time.time() - start_time
            # Record error metrics
            raise
    
    return app