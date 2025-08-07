"""
Suuupra Global Logger - Python Implementation

Features:
- High-performance structured logging
- Wide events for Observability 2.0
- OpenTelemetry integration
- FastAPI/Django integration
- PII masking and security
- Context propagation
"""

import asyncio
import json
import logging
import re
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from enum import IntEnum
from typing import Any, Dict, List, Optional, Union, Callable
from dataclasses import dataclass, asdict
from urllib.parse import urlparse

import structlog
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode


# Context variables for request correlation
request_context: ContextVar[Dict[str, Any]] = ContextVar('request_context', default={})


class LogLevel(IntEnum):
    """Log levels following RFC 5424"""
    TRACE = 0
    DEBUG = 10
    INFO = 20
    WARN = 30
    ERROR = 40
    FATAL = 50


@dataclass
class LogContext:
    """Context information for log entries"""
    # Request Context
    request_id: Optional[str] = None
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    
    # Service Context
    service: str = "unknown-service"
    version: Optional[str] = None
    environment: str = "development"
    component: Optional[str] = None
    
    # Infrastructure Context
    instance_id: Optional[str] = None
    region: Optional[str] = None
    availability_zone: Optional[str] = None
    
    # Business Context
    tenant_id: Optional[str] = None
    organization_id: Optional[str] = None
    
    # Custom Context
    extra: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.extra is None:
            self.extra = {}


@dataclass
class LogEntry:
    """Structured log entry"""
    timestamp: str
    level: LogLevel
    message: str
    context: LogContext
    data: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Any]] = None
    http: Optional[Dict[str, Any]] = None
    database: Optional[Dict[str, Any]] = None
    security: Optional[Dict[str, Any]] = None


@dataclass
class WideEvent:
    """Wide event for Observability 2.0"""
    event_id: str
    event_type: str
    timestamp: str
    request_id: str
    trace_id: str
    span_id: Optional[str] = None
    service: str = ""
    version: Optional[str] = None
    environment: str = ""
    instance_id: Optional[str] = None
    region: Optional[str] = None
    http: Optional[Dict[str, Any]] = None
    user: Optional[Dict[str, Any]] = None
    business: Optional[Dict[str, Any]] = None
    performance: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    dimensions: Optional[Dict[str, Any]] = None


class PIIMasker:
    """PII masking utilities"""
    
    EMAIL_PATTERN = re.compile(r'\b[\w\.-]+@[\w\.-]+\.\w+\b')
    CREDIT_CARD_PATTERN = re.compile(r'\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b')
    SSN_PATTERN = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
    PHONE_PATTERN = re.compile(r'\b\d{3}-\d{3}-\d{4}\b')
    
    PII_FIELDS = {'password', 'token', 'secret', 'key', 'ssn', 'credit_card', 'creditcard'}
    
    @classmethod
    def mask_text(cls, text: str) -> str:
        """Mask PII in text"""
        text = cls.EMAIL_PATTERN.sub('[EMAIL]', text)
        text = cls.CREDIT_CARD_PATTERN.sub('[CARD]', text)
        text = cls.SSN_PATTERN.sub('[SSN]', text)
        text = cls.PHONE_PATTERN.sub('[PHONE]', text)
        return text
    
    @classmethod
    def mask_data(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """Mask PII in dictionary data"""
        if not data:
            return data
            
        masked = data.copy()
        for key, value in masked.items():
            if key.lower() in cls.PII_FIELDS:
                masked[key] = '[REDACTED]'
            elif isinstance(value, str):
                masked[key] = cls.mask_text(value)
            elif isinstance(value, dict):
                masked[key] = cls.mask_data(value)
        
        return masked


class Timer:
    """Performance timer"""
    
    def __init__(self, name: str, logger: 'SuuupraLogger'):
        self.name = name
        self.logger = logger
        self.start_time = time.perf_counter()
    
    def end(self, data: Optional[Dict[str, Any]] = None) -> float:
        """End timer and log duration"""
        duration = self.get_duration()
        self.logger.log_duration(self.name, duration, data)
        return duration
    
    def get_duration(self) -> float:
        """Get current duration in milliseconds"""
        return (time.perf_counter() - self.start_time) * 1000


class SuuupraLogger:
    """Main logger class implementing world's best practices"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = self._build_config(config or {})
        self.context = LogContext(
            service=self.config['service'],
            environment=self.config['environment'],
            version=self.config.get('version'),
            instance_id=self.config.get('instance_id', str(uuid.uuid4())),
            region=self.config.get('region'),
        )
        self.tracer = trace.get_tracer('suuupra-logger')
        
        # Configure structlog
        structlog.configure(
            processors=[
                structlog.contextvars.merge_contextvars,
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.add_logger_name,
                structlog.processors.add_log_level,
                structlog.processors.StackInfoRenderer(),
                structlog.dev.set_exc_info,
                structlog.processors.JSONRenderer()
            ],
            wrapper_class=structlog.make_filtering_bound_logger(self.config['level']),
            logger_factory=structlog.WriteLoggerFactory(),
            cache_logger_on_first_use=True,
        )
        
        self._logger = structlog.get_logger()
    
    def _build_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Build configuration with defaults"""
        return {
            'service': config.get('service', 'unknown-service'),
            'environment': config.get('environment', 'development'),
            'level': config.get('level', LogLevel.INFO),
            'format': config.get('format', 'json'),
            'mask_pii': config.get('mask_pii', True),
            'opentelemetry_enabled': config.get('opentelemetry_enabled', True),
            **config
        }
    
    def _should_log(self, level: LogLevel) -> bool:
        """Check if log level should be logged"""
        return level >= self.config['level']
    
    def _create_log_entry(
        self,
        level: LogLevel,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        error: Optional[Exception] = None,
        additional_context: Optional[Dict[str, Any]] = None
    ) -> LogEntry:
        """Create structured log entry"""
        timestamp = datetime.now(timezone.utc).isoformat()
        current_context = request_context.get({})
        
        # Merge contexts
        context = LogContext(
            **asdict(self.context),
            **current_context,
            **(additional_context or {})
        )
        
        # Mask PII if enabled
        if self.config['mask_pii']:
            message = PIIMasker.mask_text(message)
            if data:
                data = PIIMasker.mask_data(data)
        
        entry = LogEntry(
            timestamp=timestamp,
            level=level,
            message=message,
            context=context,
            data=data
        )
        
        if error:
            entry.error = {
                'type': type(error).__name__,
                'message': str(error),
                'traceback': str(error.__traceback__) if error.__traceback__ else None
            }
        
        return entry
    
    def _create_wide_event(
        self,
        event_type: str,
        data: Optional[Dict[str, Any]] = None
    ) -> WideEvent:
        """Create wide event for Observability 2.0"""
        current_context = request_context.get({})
        timestamp = datetime.now(timezone.utc).isoformat()
        
        return WideEvent(
            event_id=str(uuid.uuid4()),
            event_type=event_type,
            timestamp=timestamp,
            request_id=current_context.get('request_id', str(uuid.uuid4())),
            trace_id=current_context.get('trace_id', str(uuid.uuid4())),
            span_id=current_context.get('span_id'),
            service=self.context.service,
            version=self.context.version,
            environment=self.context.environment,
            instance_id=self.context.instance_id,
            region=self.context.region,
            dimensions=data
        )
    
    # Core logging methods
    def trace(
        self,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log trace level message"""
        if self._should_log(LogLevel.TRACE):
            entry = self._create_log_entry(LogLevel.TRACE, message, data, None, context)
            self._logger.debug(message, **asdict(entry))
    
    def debug(
        self,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log debug level message"""
        if self._should_log(LogLevel.DEBUG):
            entry = self._create_log_entry(LogLevel.DEBUG, message, data, None, context)
            self._logger.debug(message, **asdict(entry))
    
    def info(
        self,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log info level message"""
        if self._should_log(LogLevel.INFO):
            entry = self._create_log_entry(LogLevel.INFO, message, data, None, context)
            self._logger.info(message, **asdict(entry))
    
    def warn(
        self,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log warning level message"""
        if self._should_log(LogLevel.WARN):
            entry = self._create_log_entry(LogLevel.WARN, message, data, None, context)
            self._logger.warning(message, **asdict(entry))
    
    def error(
        self,
        message: str,
        error: Optional[Exception] = None,
        data: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log error level message"""
        if self._should_log(LogLevel.ERROR):
            entry = self._create_log_entry(LogLevel.ERROR, message, data, error, context)
            self._logger.error(message, **asdict(entry))
    
    def fatal(
        self,
        message: str,
        error: Optional[Exception] = None,
        data: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log fatal level message"""
        if self._should_log(LogLevel.FATAL):
            entry = self._create_log_entry(LogLevel.FATAL, message, data, error, context)
            self._logger.critical(message, **asdict(entry))
    
    # Context management
    def with_context(self, context: Dict[str, Any]) -> 'SuuupraLogger':
        """Create logger with additional context"""
        new_logger = SuuupraLogger(self.config)
        new_context = asdict(self.context)
        new_context.update(context)
        new_logger.context = LogContext(**new_context)
        return new_logger
    
    def with_request_id(self, request_id: str) -> 'SuuupraLogger':
        """Create logger with request ID"""
        return self.with_context({'request_id': request_id})
    
    def with_user_id(self, user_id: str) -> 'SuuupraLogger':
        """Create logger with user ID"""
        return self.with_context({'user_id': user_id})
    
    def with_trace_id(self, trace_id: str) -> 'SuuupraLogger':
        """Create logger with trace ID"""
        return self.with_context({'trace_id': trace_id})
    
    # Performance logging
    def start_timer(self, name: str) -> Timer:
        """Start a performance timer"""
        return Timer(name, self)
    
    def log_duration(
        self,
        name: str,
        duration: float,
        data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log duration measurement"""
        self.info(f"Timer: {name}", {
            'timer': name,
            'duration_ms': duration,
            **(data or {})
        })
    
    # Structured logging helpers
    def log_request(
        self,
        method: str,
        url: str,
        status_code: Optional[int] = None,
        duration: Optional[float] = None,
        **kwargs
    ) -> None:
        """Log HTTP request with wide event"""
        wide_event = self._create_wide_event('http_request', {
            'http': {
                'method': method,
                'url': url,
                'status_code': status_code,
                'duration_ms': duration,
                **kwargs
            }
        })
        
        self.info('HTTP Request', asdict(wide_event))
    
    def log_database_query(
        self,
        operation: str,
        table: str,
        duration: float,
        rows_affected: Optional[int] = None,
        error: Optional[Exception] = None
    ) -> None:
        """Log database query"""
        self.info('Database Query', {
            'database': {
                'operation': operation,
                'table': table,
                'duration_ms': duration,
                'rows_affected': rows_affected,
            },
            'error': {
                'type': type(error).__name__,
                'message': str(error)
            } if error else None
        })
    
    def log_security_event(
        self,
        event_type: str,
        severity: str,
        user_id: Optional[str] = None,
        ip: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log security event"""
        self.warn('Security Event', {
            'security': {
                'type': event_type,
                'severity': severity,
                'user_id': user_id,
                'ip': ip,
                'details': details or {}
            }
        })


# Context utilities
def create_request_context(request_id: Optional[str] = None) -> Dict[str, Any]:
    """Create request context"""
    return {
        'request_id': request_id or str(uuid.uuid4()),
        'trace_id': str(uuid.uuid4()),
    }


def set_context(context: Dict[str, Any]) -> None:
    """Set request context"""
    request_context.set(context)


def get_context() -> Dict[str, Any]:
    """Get current request context"""
    return request_context.get({})


# Factory function
def create_logger(config: Optional[Dict[str, Any]] = None) -> SuuupraLogger:
    """Create logger instance"""
    return SuuupraLogger(config)


# FastAPI middleware
class FastAPILoggingMiddleware:
    """FastAPI logging middleware"""
    
    def __init__(self, app, logger: SuuupraLogger):
        self.app = app
        self.logger = logger
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        # Create request context
        request_id = None
        for header_name, header_value in scope.get("headers", []):
            if header_name == b"x-request-id":
                request_id = header_value.decode("utf-8")
                break
        
        context = create_request_context(request_id)
        set_context(context)
        
        # Track request timing
        start_time = time.perf_counter()
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                duration = (time.perf_counter() - start_time) * 1000
                
                self.logger.log_request(
                    method=scope["method"],
                    url=str(scope["path"]),
                    status_code=message["status"],
                    duration=duration
                )
            
            await send(message)
        
        await self.app(scope, receive, send_wrapper)


# Django middleware
class DjangoLoggingMiddleware:
    """Django logging middleware"""
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.logger = create_logger()
    
    def __call__(self, request):
        # Create request context
        request_id = request.META.get('HTTP_X_REQUEST_ID') or str(uuid.uuid4())
        context = create_request_context(request_id)
        set_context(context)
        
        # Track request timing
        start_time = time.perf_counter()
        
        response = self.get_response(request)
        
        duration = (time.perf_counter() - start_time) * 1000
        
        self.logger.log_request(
            method=request.method,
            url=request.get_full_path(),
            status_code=response.status_code,
            duration=duration
        )
        
        return response


# Export main classes and functions
__all__ = [
    'SuuupraLogger',
    'LogLevel',
    'LogContext',
    'LogEntry',
    'WideEvent',
    'Timer',
    'create_logger',
    'create_request_context',
    'set_context',
    'get_context',
    'FastAPILoggingMiddleware',
    'DjangoLoggingMiddleware',
]
