"""
OpenTelemetry Tracing Implementation for LLM Tutor Service

This module provides comprehensive distributed tracing across:
- RAG pipeline operations (retrieval, reranking, context assembly)
- LLM inference spans with token-level metrics
- Vector database query tracing
- Voice processing pipeline traces (ASR/TTS)
- Safety filter operations

Follows OpenTelemetry semantic conventions for AI/ML workloads.
"""

import time
import json
from typing import Optional, Dict, Any, List
from functools import wraps
from contextlib import contextmanager

from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.trace import Status, StatusCode
from opentelemetry.semconv.trace import SpanAttributes

# LLM/AI specific semantic conventions
class LLMAttributes:
    """Custom semantic conventions for LLM and AI operations"""
    
    # LLM Inference
    LLM_MODEL_NAME = "llm.model.name"
    LLM_MODEL_VERSION = "llm.model.version"
    LLM_INPUT_TOKENS = "llm.usage.input_tokens"
    LLM_OUTPUT_TOKENS = "llm.usage.output_tokens"
    LLM_TOTAL_TOKENS = "llm.usage.total_tokens"
    LLM_TEMPERATURE = "llm.request.temperature"
    LLM_MAX_TOKENS = "llm.request.max_tokens"
    LLM_TOP_P = "llm.request.top_p"
    LLM_FREQUENCY_PENALTY = "llm.request.frequency_penalty"
    LLM_PRESENCE_PENALTY = "llm.request.presence_penalty"
    LLM_FIRST_TOKEN_LATENCY = "llm.latency.first_token_ms"
    LLM_TOTAL_LATENCY = "llm.latency.total_ms"
    LLM_TOKENS_PER_SECOND = "llm.performance.tokens_per_second"
    
    # RAG Pipeline
    RAG_QUERY = "rag.query.text"
    RAG_QUERY_TYPE = "rag.query.type"  # hybrid, vector, keyword
    RAG_RETRIEVAL_K = "rag.retrieval.k"
    RAG_RETRIEVAL_SOURCES = "rag.retrieval.sources_count"
    RAG_RERANK_ENABLED = "rag.rerank.enabled"
    RAG_RERANK_MODEL = "rag.rerank.model"
    RAG_CONTEXT_LENGTH = "rag.context.length_chars"
    RAG_CHUNK_COUNT = "rag.context.chunk_count"
    RAG_RELEVANCE_SCORE = "rag.retrieval.avg_relevance_score"
    RAG_HIT_RATE = "rag.retrieval.hit_rate"
    
    # Vector Database
    VECTOR_DB_TYPE = "vector_db.type"  # milvus, pinecone, chroma
    VECTOR_DB_COLLECTION = "vector_db.collection"
    VECTOR_DB_QUERY_VECTOR_DIM = "vector_db.query.vector_dimension"
    VECTOR_DB_SIMILARITY_METRIC = "vector_db.similarity.metric"
    VECTOR_DB_SIMILARITY_THRESHOLD = "vector_db.similarity.threshold"
    
    # Voice Processing
    VOICE_ASR_MODEL = "voice.asr.model"
    VOICE_ASR_LANGUAGE = "voice.asr.language"
    VOICE_ASR_CONFIDENCE = "voice.asr.confidence"
    VOICE_ASR_DURATION = "voice.asr.audio_duration_seconds"
    VOICE_ASR_WER = "voice.asr.word_error_rate"
    VOICE_TTS_MODEL = "voice.tts.model"
    VOICE_TTS_VOICE_ID = "voice.tts.voice_id"
    VOICE_TTS_LANGUAGE = "voice.tts.language"
    VOICE_TTS_SPEED = "voice.tts.speed"
    VOICE_TTS_OUTPUT_DURATION = "voice.tts.output_duration_seconds"
    
    # Safety & Moderation
    SAFETY_INPUT_CLASSIFICATION = "safety.input.classification"
    SAFETY_OUTPUT_CLASSIFICATION = "safety.output.classification"
    SAFETY_FILTER_TRIGGERED = "safety.filter.triggered"
    SAFETY_FILTER_REASON = "safety.filter.reason"
    SAFETY_CONFIDENCE_SCORE = "safety.confidence_score"
    
    # User Context
    USER_ID = "user.id"
    SESSION_ID = "session.id"
    LEARNING_CONTEXT = "learning.context"
    DIFFICULTY_LEVEL = "learning.difficulty_level"
    SUBJECT_AREA = "learning.subject_area"

class LLMTracer:
    """Enhanced tracer for LLM Tutor Service operations"""
    
    def __init__(self, service_name: str = "llm-tutor"):
        self.service_name = service_name
        self.tracer = trace.get_tracer(__name__)
        self._setup_instrumentation()
    
    def _setup_instrumentation(self):
        """Configure OpenTelemetry instrumentation for common libraries"""
        
        # Auto-instrument FastAPI
        FastAPIInstrumentor.instrument()
        
        # Auto-instrument HTTP requests
        RequestsInstrumentor.instrument()
        
        # Auto-instrument Redis
        RedisInstrumentor.instrument()
    
    @contextmanager
    def trace_llm_inference(
        self,
        model_name: str,
        input_text: str,
        **kwargs
    ):
        """Trace LLM inference with comprehensive metrics"""
        
        with self.tracer.start_as_current_span(
            "llm.inference",
            kind=trace.SpanKind.INTERNAL
        ) as span:
            # Set basic LLM attributes
            span.set_attribute(LLMAttributes.LLM_MODEL_NAME, model_name)
            span.set_attribute(LLMAttributes.LLM_INPUT_TOKENS, self._count_tokens(input_text))
            
            # Set inference parameters
            for param, value in kwargs.items():
                if param in ["temperature", "max_tokens", "top_p", "frequency_penalty", "presence_penalty"]:
                    span.set_attribute(f"llm.request.{param}", value)
            
            start_time = time.time()
            first_token_time = None
            
            try:
                # Context manager yields control to caller
                inference_result = yield {
                    "span": span,
                    "start_time": start_time,
                    "set_first_token_time": lambda: setattr(self, "_first_token_time", time.time())
                }
                
                # Set completion metrics
                end_time = time.time()
                total_latency = (end_time - start_time) * 1000
                
                if hasattr(self, "_first_token_time"):
                    first_token_latency = (self._first_token_time - start_time) * 1000
                    span.set_attribute(LLMAttributes.LLM_FIRST_TOKEN_LATENCY, first_token_latency)
                
                span.set_attribute(LLMAttributes.LLM_TOTAL_LATENCY, total_latency)
                
                if inference_result and "output_tokens" in inference_result:
                    output_tokens = inference_result["output_tokens"]
                    span.set_attribute(LLMAttributes.LLM_OUTPUT_TOKENS, output_tokens)
                    span.set_attribute(LLMAttributes.LLM_TOTAL_TOKENS, 
                                     self._count_tokens(input_text) + output_tokens)
                    
                    # Calculate tokens per second
                    if total_latency > 0:
                        tokens_per_sec = (output_tokens / total_latency) * 1000
                        span.set_attribute(LLMAttributes.LLM_TOKENS_PER_SECOND, tokens_per_sec)
                
                span.set_status(Status(StatusCode.OK))
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                raise
    
    @contextmanager
    def trace_rag_pipeline(
        self,
        query: str,
        query_type: str = "hybrid",
        k: int = 10
    ):
        """Trace RAG pipeline operations"""
        
        with self.tracer.start_as_current_span(
            "rag.pipeline",
            kind=trace.SpanKind.INTERNAL
        ) as span:
            span.set_attribute(LLMAttributes.RAG_QUERY, query[:500])  # Truncate long queries
            span.set_attribute(LLMAttributes.RAG_QUERY_TYPE, query_type)
            span.set_attribute(LLMAttributes.RAG_RETRIEVAL_K, k)
            
            try:
                # Yield control to RAG pipeline
                rag_result = yield {"span": span}
                
                # Set completion metrics
                if rag_result:
                    if "sources_count" in rag_result:
                        span.set_attribute(LLMAttributes.RAG_RETRIEVAL_SOURCES, rag_result["sources_count"])
                    
                    if "context_length" in rag_result:
                        span.set_attribute(LLMAttributes.RAG_CONTEXT_LENGTH, rag_result["context_length"])
                    
                    if "chunk_count" in rag_result:
                        span.set_attribute(LLMAttributes.RAG_CHUNK_COUNT, rag_result["chunk_count"])
                    
                    if "avg_relevance_score" in rag_result:
                        span.set_attribute(LLMAttributes.RAG_RELEVANCE_SCORE, rag_result["avg_relevance_score"])
                    
                    if "hit_rate" in rag_result:
                        span.set_attribute(LLMAttributes.RAG_HIT_RATE, rag_result["hit_rate"])
                
                span.set_status(Status(StatusCode.OK))
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                raise
    
    @contextmanager
    def trace_vector_search(
        self,
        vector_db_type: str,
        collection: str,
        query_vector_dim: int,
        similarity_metric: str = "cosine"
    ):
        """Trace vector database search operations"""
        
        with self.tracer.start_as_current_span(
            "vector_db.search",
            kind=trace.SpanKind.CLIENT
        ) as span:
            span.set_attribute(LLMAttributes.VECTOR_DB_TYPE, vector_db_type)
            span.set_attribute(LLMAttributes.VECTOR_DB_COLLECTION, collection)
            span.set_attribute(LLMAttributes.VECTOR_DB_QUERY_VECTOR_DIM, query_vector_dim)
            span.set_attribute(LLMAttributes.VECTOR_DB_SIMILARITY_METRIC, similarity_metric)
            
            try:
                search_result = yield {"span": span}
                
                if search_result and "similarity_threshold" in search_result:
                    span.set_attribute(LLMAttributes.VECTOR_DB_SIMILARITY_THRESHOLD, 
                                     search_result["similarity_threshold"])
                
                span.set_status(Status(StatusCode.OK))
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                raise
    
    @contextmanager
    def trace_voice_processing(
        self,
        operation: str,  # "asr" or "tts"
        model: str,
        language: str = "en"
    ):
        """Trace voice processing operations (ASR/TTS)"""
        
        operation_name = f"voice.{operation}"
        with self.tracer.start_as_current_span(
            operation_name,
            kind=trace.SpanKind.INTERNAL
        ) as span:
            if operation == "asr":
                span.set_attribute(LLMAttributes.VOICE_ASR_MODEL, model)
                span.set_attribute(LLMAttributes.VOICE_ASR_LANGUAGE, language)
            elif operation == "tts":
                span.set_attribute(LLMAttributes.VOICE_TTS_MODEL, model)
                span.set_attribute(LLMAttributes.VOICE_TTS_LANGUAGE, language)
            
            try:
                voice_result = yield {"span": span}
                
                # Set operation-specific metrics
                if voice_result:
                    if operation == "asr":
                        if "confidence" in voice_result:
                            span.set_attribute(LLMAttributes.VOICE_ASR_CONFIDENCE, voice_result["confidence"])
                        if "audio_duration" in voice_result:
                            span.set_attribute(LLMAttributes.VOICE_ASR_DURATION, voice_result["audio_duration"])
                        if "word_error_rate" in voice_result:
                            span.set_attribute(LLMAttributes.VOICE_ASR_WER, voice_result["word_error_rate"])
                    
                    elif operation == "tts":
                        if "voice_id" in voice_result:
                            span.set_attribute(LLMAttributes.VOICE_TTS_VOICE_ID, voice_result["voice_id"])
                        if "speed" in voice_result:
                            span.set_attribute(LLMAttributes.VOICE_TTS_SPEED, voice_result["speed"])
                        if "output_duration" in voice_result:
                            span.set_attribute(LLMAttributes.VOICE_TTS_OUTPUT_DURATION, voice_result["output_duration"])
                
                span.set_status(Status(StatusCode.OK))
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                raise
    
    @contextmanager
    def trace_safety_filter(
        self,
        filter_type: str,  # "input" or "output"
        content: str
    ):
        """Trace safety filter operations"""
        
        with self.tracer.start_as_current_span(
            f"safety.filter.{filter_type}",
            kind=trace.SpanKind.INTERNAL
        ) as span:
            span.set_attribute("safety.filter.type", filter_type)
            span.set_attribute("safety.content.length", len(content))
            
            try:
                safety_result = yield {"span": span}
                
                if safety_result:
                    if "classification" in safety_result:
                        if filter_type == "input":
                            span.set_attribute(LLMAttributes.SAFETY_INPUT_CLASSIFICATION, 
                                             safety_result["classification"])
                        else:
                            span.set_attribute(LLMAttributes.SAFETY_OUTPUT_CLASSIFICATION, 
                                             safety_result["classification"])
                    
                    if "filter_triggered" in safety_result:
                        span.set_attribute(LLMAttributes.SAFETY_FILTER_TRIGGERED, 
                                         safety_result["filter_triggered"])
                    
                    if "reason" in safety_result:
                        span.set_attribute(LLMAttributes.SAFETY_FILTER_REASON, 
                                         safety_result["reason"])
                    
                    if "confidence_score" in safety_result:
                        span.set_attribute(LLMAttributes.SAFETY_CONFIDENCE_SCORE, 
                                         safety_result["confidence_score"])
                
                span.set_status(Status(StatusCode.OK))
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                raise
    
    def set_user_context(self, user_id: str, session_id: str, **kwargs):
        """Set user context attributes on current span"""
        current_span = trace.get_current_span()
        if current_span:
            current_span.set_attribute(LLMAttributes.USER_ID, user_id)
            current_span.set_attribute(LLMAttributes.SESSION_ID, session_id)
            
            # Set learning context attributes
            for key, value in kwargs.items():
                if key in ["learning_context", "difficulty_level", "subject_area"]:
                    current_span.set_attribute(f"learning.{key}", str(value))
    
    def _count_tokens(self, text: str) -> int:
        """Simple token estimation (replace with actual tokenizer if needed)"""
        # Rough estimation: ~4 characters per token for English
        return len(text) // 4
    
    def trace_decorator(self, operation_name: str, **span_attributes):
        """Decorator for automatic tracing of functions"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                with self.tracer.start_as_current_span(
                    operation_name,
                    kind=trace.SpanKind.INTERNAL
                ) as span:
                    # Set custom attributes
                    for key, value in span_attributes.items():
                        span.set_attribute(key, value)
                    
                    try:
                        result = func(*args, **kwargs)
                        span.set_status(Status(StatusCode.OK))
                        return result
                    except Exception as e:
                        span.record_exception(e)
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        raise
            return wrapper
        return decorator

def setup_tracing(
    service_name: str = "llm-tutor",
    jaeger_endpoint: str = "http://localhost:14268/api/traces",
    environment: str = "development"
) -> LLMTracer:
    """Configure OpenTelemetry tracing for LLM Tutor service"""
    
    # Create tracer provider
    trace.set_tracer_provider(TracerProvider(
        resource=trace.Resource.create({
            "service.name": service_name,
            "service.version": "1.0.0",
            "deployment.environment": environment
        })
    ))
    
    # Configure Jaeger exporter
    jaeger_exporter = JaegerExporter(
        endpoint=jaeger_endpoint,
        collector_endpoint=jaeger_endpoint,
    )
    
    # Add span processor
    span_processor = BatchSpanProcessor(jaeger_exporter)
    trace.get_tracer_provider().add_span_processor(span_processor)
    
    return LLMTracer(service_name)

# Global tracer instance
llm_tracer: Optional[LLMTracer] = None

def get_tracer() -> LLMTracer:
    """Get the global LLM tracer instance"""
    global llm_tracer
    if llm_tracer is None:
        llm_tracer = setup_tracing()
    return llm_tracer