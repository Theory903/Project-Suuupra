# 🔔 Notifications Service - Implementation Guide

## 📋 Service Overview

**Role**: Multi-channel notification delivery system handling push notifications, email, SMS, WebSocket real-time messaging, and in-app notifications. Acts as the central messaging hub for all Suuupra platform communications with guaranteed delivery, priority queues, and personalization.

**Learning Objectives**: 
- Master message queue architectures and priority systems
- Implement multi-channel notification delivery with fallbacks
- Design template engines with dynamic personalization
- Understand delivery guarantees and retry mechanisms
- Apply distributed systems patterns for reliable messaging

**System Requirements**:
- Handle 1M+ notifications per day across all channels
- Support real-time WebSocket delivery with <100ms latency
- 99.9% delivery success rate with retry mechanisms
- Template rendering under 50ms for personalized content
- GDPR compliant with user preference management

---

## 🏗️ Architecture & Design

### Core Components Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                 Notifications Service                       │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Message Queue  │   Channel Mgmt   │    Template Engine      │
│   - Priority Q  │   - Push (FCM)   │   - Jinja2 Templates   │
│   - Dead Letter │   - Email (SES)  │   - Personalization    │
│   - Scheduling  │   - SMS (Twilio) │   - Multi-language     │
├─────────────────┼─────────────────┼─────────────────────────┤
│ Delivery Engine │   User Prefs     │    Analytics           │
│   - Retry Logic │   - Opt-in/out   │   - Delivery Metrics   │
│   - Rate Limit  │   - Channels     │   - Open/Click Rates   │
│   - Fallbacks   │   - Quiet Hours  │   - A/B Testing        │
├─────────────────┼─────────────────┼─────────────────────────┤
│ WebSocket Hub   │   Batch Process  │    Audit & Compliance  │
│   - Real-time   │   - Bulk Sends   │   - GDPR Controls      │
│   - Room Mgmt   │   - Newsletter   │   - Delivery Logs      │
│   - Presence    │   - Campaigns    │   - Retention Policy   │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Technology Stack
- **Runtime**: Python 3.11+ with Django 4.2
- **Framework**: Django REST Framework, Celery for async tasks
- **Message Queue**: Redis 7+ with RedisJSON for complex data
- **Database**: PostgreSQL 15 (primary), MongoDB (logs)
- **External APIs**: FCM (push), AWS SES (email), Twilio (SMS)
- **Real-time**: WebSocket with Django Channels, Redis pub/sub

### Data Structures & Algorithms

**Priority Queue for Message Delivery**:
```python
import heapq
from dataclasses import dataclass, field
from typing import Any
from enum import IntEnum

class Priority(IntEnum):
    CRITICAL = 1    # System alerts, security
    HIGH = 2        # Payment confirmations, course deadlines
    MEDIUM = 3      # Content updates, reminders
    LOW = 4         # Marketing, newsletters

@dataclass
class NotificationMessage:
    priority: Priority
    user_id: str
    channel: str
    template_id: str
    payload: dict
    scheduled_at: datetime
    attempts: int = 0
    max_attempts: int = 3
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    
    def __lt__(self, other):
        # Higher priority (lower number) comes first
        if self.priority != other.priority:
            return self.priority < other.priority
        # Earlier scheduled time comes first for same priority
        return self.scheduled_at < other.scheduled_at

class PriorityNotificationQueue:
    def __init__(self):
        self._queue = []
        self._entry_finder = {}
        self._counter = itertools.count()
        self.REMOVED = '<removed-task>'
    
    def push(self, message: NotificationMessage):
        if message.id in self._entry_finder:
            self.remove_message(message.id)
        
        count = next(self._counter)
        entry = [message.priority, count, message]
        self._entry_finder[message.id] = entry
        heapq.heappush(self._queue, entry)
    
    def pop(self) -> NotificationMessage:
        while self._queue:
            priority, count, message = heapq.heappop(self._queue)
            if message is not self.REMOVED:
                del self._entry_finder[message.id]
                return message
        raise KeyError('pop from empty priority queue')
    
    def remove_message(self, message_id: str):
        entry = self._entry_finder.pop(message_id)
        entry[2] = self.REMOVED
```

**Exponential Backoff for Retry Logic**:
```python
import random
import time
from typing import Callable, Any

class ExponentialBackoffRetry:
    def __init__(self, 
                 max_retries: int = 3,
                 base_delay: float = 1.0,
                 max_delay: float = 300.0,
                 jitter: bool = True):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter = jitter
    
    def calculate_delay(self, attempt: int) -> float:
        delay = min(self.base_delay * (2 ** attempt), self.max_delay)
        
        if self.jitter:
            # Add ±25% jitter to prevent thundering herd
            jitter_range = delay * 0.25
            delay += random.uniform(-jitter_range, jitter_range)
        
        return max(0, delay)
    
    async def retry_with_backoff(self, 
                                func: Callable, 
                                *args, **kwargs) -> Any:
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                
                if attempt == self.max_retries:
                    break
                
                delay = self.calculate_delay(attempt)
                await asyncio.sleep(delay)
        
        raise last_exception
```

**Trie for Template Path Matching**:
```python
class TemplateTrie:
    def __init__(self):
        self.root = {}
        self.templates = {}
    
    def insert(self, path: str, template_id: str):
        node = self.root
        for part in path.split('.'):
            if part not in node:
                node[part] = {}
            node = node[part]
        node['_template_id'] = template_id
    
    def find_template(self, path: str) -> str:
        node = self.root
        for part in path.split('.'):
            if part in node:
                node = node[part]
            elif '*' in node:  # Wildcard support
                node = node['*']
            else:
                return None
        
        return node.get('_template_id')
    
    # Example usage:
    # trie.insert("user.payment.success", "payment_success_template")
    # trie.insert("user.course.*", "course_generic_template")
    # template_id = trie.find_template("user.course.enrollment")
```

---

## 📅 Week-by-Week Implementation Plan

### Week 1: Core Infrastructure & Message Queue (Days 1-7)

#### Day 1-2: Django Setup & Message Queue Foundation
**Learning Focus**: Django setup, message queue patterns, Redis integration

**Tasks**:
- [ ] Initialize Django project with REST framework
- [ ] Setup Celery with Redis as message broker
- [ ] Implement priority queue for message processing
- [ ] Create basic notification models and serializers
- [ ] Setup database schema with proper indexing

**Core Models**:
```python
from django.db import models
from django.contrib.auth import get_user_model
import uuid
from enum import TextChoices

User = get_user_model()

class NotificationChannel(TextChoices):
    PUSH = 'push', 'Push Notification'
    EMAIL = 'email', 'Email'
    SMS = 'sms', 'SMS'
    WEBSOCKET = 'websocket', 'WebSocket'
    IN_APP = 'in_app', 'In-App'

class NotificationPriority(models.IntegerChoices):
    CRITICAL = 1, 'Critical'
    HIGH = 2, 'High'
    MEDIUM = 3, 'Medium'
    LOW = 4, 'Low'

class NotificationTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=100, unique=True)
    path = models.CharField(max_length=200, unique=True)  # e.g., "user.payment.success"
    
    # Multi-channel templates
    push_template = models.TextField(blank=True)
    email_subject_template = models.CharField(max_length=200, blank=True)
    email_body_template = models.TextField(blank=True)
    sms_template = models.CharField(max_length=160, blank=True)
    
    # Template metadata
    supported_channels = models.JSONField(default=list)
    required_variables = models.JSONField(default=list)
    optional_variables = models.JSONField(default=list)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class NotificationMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_index=True)
    template = models.ForeignKey(NotificationTemplate, on_delete=models.CASCADE)
    
    channel = models.CharField(max_length=20, choices=NotificationChannel.choices)
    priority = models.IntegerField(choices=NotificationPriority.choices, default=3)
    
    # Message content (rendered from template)
    title = models.CharField(max_length=200)
    body = models.TextField()
    data = models.JSONField(default=dict)  # Additional payload
    
    # Scheduling and delivery
    scheduled_at = models.DateTimeField()
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    # Retry management
    attempts = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=3)
    last_error = models.TextField(blank=True)
    
    # Status tracking
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled')
    ], default='pending')
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['status', 'scheduled_at']),
            models.Index(fields=['channel', 'priority', 'scheduled_at']),
        ]
```

#### Day 3-4: Template Engine & Personalization
**Learning Focus**: Template rendering, Jinja2, dynamic content generation

**Tasks**:
- [ ] Implement Jinja2 template engine with custom filters
- [ ] Create template management system with versioning
- [ ] Build personalization engine with user context
- [ ] Add multi-language template support
- [ ] Implement template validation and testing

**Template Engine Implementation**:
```python
from jinja2 import Environment, DictLoader, TemplateError
from typing import Dict, Any
import re

class NotificationTemplateEngine:
    def __init__(self):
        self.env = Environment(loader=DictLoader({}))
        self._setup_custom_filters()
    
    def _setup_custom_filters(self):
        """Add custom filters for notifications"""
        
        def currency_filter(value, currency='USD'):
            """Format currency values"""
            if currency == 'USD':
                return f"${value:,.2f}"
            elif currency == 'EUR':
                return f"€{value:,.2f}"
            return f"{value:,.2f} {currency}"
        
        def time_ago_filter(datetime_value):
            """Human readable time difference"""
            now = timezone.now()
            diff = now - datetime_value
            
            if diff.days > 0:
                return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
            elif diff.seconds > 3600:
                hours = diff.seconds // 3600
                return f"{hours} hour{'s' if hours > 1 else ''} ago"
            else:
                minutes = diff.seconds // 60
                return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
        
        def truncate_words_filter(text, length=50):
            """Truncate text to specified word count"""
            words = text.split()
            if len(words) <= length:
                return text
            return ' '.join(words[:length]) + '...'
        
        self.env.filters['currency'] = currency_filter
        self.env.filters['time_ago'] = time_ago_filter
        self.env.filters['truncate_words'] = truncate_words_filter
    
    def render_template(self, 
                       template_content: str, 
                       context: Dict[str, Any]) -> str:
        try:
            template = self.env.from_string(template_content)
            return template.render(**context)
        except TemplateError as e:
            raise NotificationTemplateError(f"Template rendering failed: {e}")
    
    def validate_template(self, 
                         template_content: str, 
                         required_vars: list) -> Dict[str, Any]:
        """Validate template syntax and required variables"""
        try:
            template = self.env.from_string(template_content)
            
            # Extract variables from template
            ast = self.env.parse(template_content)
            template_vars = meta.find_undeclared_variables(ast)
            
            # Check required variables
            missing_vars = set(required_vars) - template_vars
            extra_vars = template_vars - set(required_vars)
            
            return {
                'valid': len(missing_vars) == 0,
                'missing_variables': list(missing_vars),
                'extra_variables': list(extra_vars),
                'all_variables': list(template_vars)
            }
        except TemplateError as e:
            return {
                'valid': False,
                'error': str(e)
            }

class PersonalizationService:
    def __init__(self):
        self.template_engine = NotificationTemplateEngine()
    
    def build_user_context(self, user: User, extra_context: Dict = None) -> Dict:
        """Build comprehensive user context for personalization"""
        context = {
            'user': {
                'id': str(user.id),
                'first_name': user.first_name,
                'last_name': user.last_name,
                'full_name': user.get_full_name(),
                'email': user.email,
                'timezone': getattr(user, 'timezone', 'UTC'),
                'locale': getattr(user, 'locale', 'en_US'),
            },
            'current_time': timezone.now(),
            'app_name': settings.APP_NAME,
            'app_url': settings.FRONTEND_URL,
        }
        
        # Add user profile information if available
        if hasattr(user, 'profile'):
            context['user'].update({
                'avatar_url': user.profile.avatar_url,
                'subscription_tier': getattr(user.profile, 'subscription_tier', 'free'),
                'join_date': user.date_joined,
                'last_login': user.last_login,
            })
        
        # Merge extra context
        if extra_context:
            context.update(extra_context)
        
        return context
```

#### Day 5-7: Channel Providers Implementation
**Learning Focus**: External API integrations, error handling, rate limiting

**Tasks**:
- [ ] Implement Firebase Cloud Messaging (FCM) for push notifications
- [ ] Setup AWS SES integration for email delivery
- [ ] Integrate Twilio for SMS messaging
- [ ] Create WebSocket notification delivery
- [ ] Build unified channel interface with fallbacks

**Channel Provider Implementation**:
```python
from abc import ABC, abstractmethod
import asyncio
import httpx
from typing import Optional, Dict, Any

class NotificationChannelProvider(ABC):
    @abstractmethod
    async def send(self, 
                   recipient: str, 
                   message: Dict[str, Any]) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    async def validate_recipient(self, recipient: str) -> bool:
        pass

class FCMPushProvider(NotificationChannelProvider):
    def __init__(self, server_key: str):
        self.server_key = server_key
        self.base_url = "https://fcm.googleapis.com/fcm/send"
        self.headers = {
            'Authorization': f'key={server_key}',
            'Content-Type': 'application/json'
        }
    
    async def send(self, recipient: str, message: Dict[str, Any]) -> Dict[str, Any]:
        payload = {
            'to': recipient,
            'notification': {
                'title': message['title'],
                'body': message['body'],
                'icon': message.get('icon', '/static/icon-192.png'),
                'click_action': message.get('url', settings.FRONTEND_URL)
            },
            'data': message.get('data', {}),
            'priority': 'high' if message.get('priority', 3) <= 2 else 'normal'
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.base_url,
                json=payload,
                headers=self.headers,
                timeout=30.0
            )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success') == 1:
                return {
                    'success': True,
                    'message_id': result.get('results', [{}])[0].get('message_id'),
                    'provider_response': result
                }
            else:
                error = result.get('results', [{}])[0].get('error', 'Unknown error')
                return {
                    'success': False,
                    'error': error,
                    'retry': error in ['Unavailable', 'InternalServerError']
                }
        else:
            return {
                'success': False,
                'error': f'HTTP {response.status_code}: {response.text}',
                'retry': response.status_code >= 500
            }
    
    async def validate_recipient(self, token: str) -> bool:
        # Validate FCM token format
        return bool(token and len(token) > 100 and ':' in token)

class AWSSESEmailProvider(NotificationChannelProvider):
    def __init__(self, aws_access_key: str, aws_secret_key: str, region: str):
        self.aws_access_key = aws_access_key
        self.aws_secret_key = aws_secret_key
        self.region = region
        self.client = boto3.client(
            'ses',
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=region
        )
    
    async def send(self, recipient: str, message: Dict[str, Any]) -> Dict[str, Any]:
        try:
            response = await asyncio.to_thread(
                self.client.send_email,
                Source=settings.DEFAULT_FROM_EMAIL,
                Destination={'ToAddresses': [recipient]},
                Message={
                    'Subject': {'Data': message['subject'], 'Charset': 'UTF-8'},
                    'Body': {
                        'Html': {'Data': message.get('html_body', ''), 'Charset': 'UTF-8'},
                        'Text': {'Data': message.get('text_body', message['body']), 'Charset': 'UTF-8'}
                    }
                },
                Tags=[
                    {'Name': 'NotificationType', 'Value': message.get('type', 'notification')},
                    {'Name': 'Priority', 'Value': str(message.get('priority', 3))}
                ]
            )
            
            return {
                'success': True,
                'message_id': response['MessageId'],
                'provider_response': response
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            retry = error_code in ['Throttling', 'ServiceUnavailable']
            
            return {
                'success': False,
                'error': e.response['Error']['Message'],
                'error_code': error_code,
                'retry': retry
            }
    
    async def validate_recipient(self, email: str) -> bool:
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(email_pattern, email))

class TwilioSMSProvider(NotificationChannelProvider):
    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.client = Client(account_sid, auth_token)
        self.from_number = from_number
    
    async def send(self, recipient: str, message: Dict[str, Any]) -> Dict[str, Any]:
        try:
            message_obj = await asyncio.to_thread(
                self.client.messages.create,
                body=message['body'],
                from_=self.from_number,
                to=recipient
            )
            
            return {
                'success': True,
                'message_id': message_obj.sid,
                'provider_response': {
                    'sid': message_obj.sid,
                    'status': message_obj.status,
                    'price': message_obj.price,
                    'direction': message_obj.direction
                }
            }
            
        except TwilioRestException as e:
            retry = e.status >= 500 or e.code in [20429]  # Rate limit
            
            return {
                'success': False,
                'error': e.msg,
                'error_code': e.code,
                'retry': retry
            }
    
    async def validate_recipient(self, phone: str) -> bool:
        # Basic E.164 format validation
        import re
        phone_pattern = r'^\+[1-9]\d{1,14}$'
        return bool(re.match(phone_pattern, phone))
```

### Week 2: Delivery Engine & User Preferences (Days 8-14)

#### Day 8-10: Delivery Engine with Retry Logic
**Learning Focus**: Reliability patterns, circuit breakers, dead letter queues

**Tasks**:
- [ ] Implement delivery engine with exponential backoff
- [ ] Create circuit breaker for external service failures
- [ ] Build dead letter queue for failed messages
- [ ] Add rate limiting per channel provider
- [ ] Implement delivery status tracking and callbacks

**Delivery Engine Implementation**:
```python
import asyncio
from datetime import datetime, timedelta
import logging
from typing import List, Optional
from dataclasses import dataclass

@dataclass
class DeliveryResult:
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None
    retry: bool = False
    provider_response: Optional[dict] = None

class CircuitBreaker:
    def __init__(self, 
                 failure_threshold: int = 5,
                 timeout: int = 60,
                 expected_exception: type = Exception):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
    
    async def call(self, func, *args, **kwargs):
        if self.state == 'OPEN':
            if self._should_attempt_reset():
                self.state = 'HALF_OPEN'
            else:
                raise Exception("Circuit breaker is OPEN")
        
        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except self.expected_exception as e:
            self._on_failure()
            raise e
    
    def _should_attempt_reset(self) -> bool:
        return (datetime.now() - self.last_failure_time).seconds >= self.timeout
    
    def _on_success(self):
        self.failure_count = 0
        self.state = 'CLOSED'
    
    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.failure_threshold:
            self.state = 'OPEN'

class NotificationDeliveryEngine:
    def __init__(self):
        self.providers = {
            'push': FCMPushProvider(settings.FCM_SERVER_KEY),
            'email': AWSSESEmailProvider(
                settings.AWS_ACCESS_KEY,
                settings.AWS_SECRET_KEY,
                settings.AWS_REGION
            ),
            'sms': TwilioSMSProvider(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_AUTH_TOKEN,
                settings.TWILIO_FROM_NUMBER
            )
        }
        
        # Circuit breakers per provider
        self.circuit_breakers = {
            channel: CircuitBreaker(failure_threshold=5, timeout=60)
            for channel in self.providers.keys()
        }
        
        # Rate limiters per provider
        self.rate_limiters = {
            'push': AsyncRateLimiter(rate=100, period=60),      # 100/min
            'email': AsyncRateLimiter(rate=14, period=1),       # 14/sec (SES limit)
            'sms': AsyncRateLimiter(rate=1, period=1),          # 1/sec (Twilio)
        }
        
        self.retry_handler = ExponentialBackoffRetry(
            max_retries=3,
            base_delay=2.0,
            max_delay=300.0
        )
    
    async def deliver_message(self, message: NotificationMessage) -> DeliveryResult:
        """Deliver a single message with retry logic"""
        channel = message.channel
        provider = self.providers.get(channel)
        
        if not provider:
            return DeliveryResult(
                success=False,
                error=f"No provider configured for channel: {channel}"
            )
        
        # Rate limiting
        rate_limiter = self.rate_limiters.get(channel)
        if rate_limiter:
            await rate_limiter.acquire()
        
        # Circuit breaker protection
        circuit_breaker = self.circuit_breakers[channel]
        
        try:
            result = await circuit_breaker.call(
                self.retry_handler.retry_with_backoff,
                self._send_with_provider,
                provider,
                message
            )
            
            # Update message status
            if result['success']:
                message.status = 'sent'
                message.sent_at = timezone.now()
                
                # Schedule delivery confirmation check
                if channel in ['email', 'sms']:
                    self._schedule_delivery_check(message, result['message_id'])
            else:
                message.attempts += 1
                message.last_error = result.get('error', 'Unknown error')
                
                if message.attempts >= message.max_attempts:
                    message.status = 'failed'
                    await self._send_to_dead_letter_queue(message, result)
                else:
                    message.status = 'pending'
                    # Reschedule with backoff
                    delay = self.retry_handler.calculate_delay(message.attempts)
                    message.scheduled_at = timezone.now() + timedelta(seconds=delay)
            
            message.save()
            
            return DeliveryResult(
                success=result['success'],
                message_id=result.get('message_id'),
                error=result.get('error'),
                provider_response=result.get('provider_response')
            )
            
        except Exception as e:
            logging.error(f"Delivery failed for message {message.id}: {e}")
            
            message.attempts += 1
            message.last_error = str(e)
            message.status = 'failed' if message.attempts >= message.max_attempts else 'pending'
            message.save()
            
            return DeliveryResult(success=False, error=str(e))
    
    async def _send_with_provider(self, 
                                 provider: NotificationChannelProvider,
                                 message: NotificationMessage) -> dict:
        """Send message using specific provider"""
        
        # Build message payload based on channel
        if message.channel == 'push':
            payload = {
                'title': message.title,
                'body': message.body,
                'data': message.data,
                'priority': message.priority
            }
            recipient = message.user.fcm_token
            
        elif message.channel == 'email':
            payload = {
                'subject': message.title,
                'body': message.body,
                'html_body': message.data.get('html_body'),
                'priority': message.priority
            }
            recipient = message.user.email
            
        elif message.channel == 'sms':
            payload = {
                'body': f"{message.title}\n{message.body}",
                'priority': message.priority
            }
            recipient = message.user.phone_number
        
        else:
            raise ValueError(f"Unsupported channel: {message.channel}")
        
        # Validate recipient
        if not await provider.validate_recipient(recipient):
            raise ValueError(f"Invalid recipient: {recipient}")
        
        return await provider.send(recipient, payload)
    
    async def _send_to_dead_letter_queue(self, 
                                       message: NotificationMessage,
                                       last_result: dict):
        """Send failed messages to dead letter queue for manual review"""
        dead_letter_data = {
            'message_id': str(message.id),
            'user_id': str(message.user.id),
            'channel': message.channel,
            'template_id': str(message.template.id),
            'attempts': message.attempts,
            'last_error': message.last_error,
            'last_result': last_result,
            'created_at': message.created_at.isoformat(),
            'failed_at': timezone.now().isoformat()
        }
        
        # Store in Redis for manual processing
        redis_client = get_redis_client()
        await redis_client.lpush(
            'notification_dead_letter_queue',
            json.dumps(dead_letter_data)
        )
        
        # Log critical failure
        logging.critical(
            f"Message {message.id} sent to dead letter queue after {message.attempts} attempts"
        )
```

#### Day 11-12: User Preferences & Consent Management
**Learning Focus**: GDPR compliance, preference management, opt-in/opt-out systems

**Tasks**:
- [ ] Build user notification preferences system
- [ ] Implement channel-specific opt-in/opt-out
- [ ] Create quiet hours and do-not-disturb functionality
- [ ] Add GDPR compliance with data export/deletion
- [ ] Build preference inheritance and defaults

**User Preferences Implementation**:
```python
class UserNotificationPreference(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='notification_preferences')
    
    # Global preferences
    notifications_enabled = models.BooleanField(default=True)
    marketing_enabled = models.BooleanField(default=False)
    
    # Channel preferences
    push_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)  # Opt-in only
    
    # Quiet hours (in user's timezone)
    quiet_hours_enabled = models.BooleanField(default=False)
    quiet_hours_start = models.TimeField(default=time(22, 0))  # 10 PM
    quiet_hours_end = models.TimeField(default=time(8, 0))     # 8 AM
    
    # Frequency preferences
    digest_frequency = models.CharField(
        max_length=20,
        choices=[
            ('immediate', 'Immediate'),
            ('hourly', 'Hourly'),
            ('daily', 'Daily'),
            ('weekly', 'Weekly'),
            ('never', 'Never')
        ],
        default='immediate'
    )
    
    # GDPR compliance
    consent_given_at = models.DateTimeField(null=True, blank=True)
    consent_withdrawn_at = models.DateTimeField(null=True, blank=True)
    data_processing_consent = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class NotificationCategoryPreference(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    category = models.CharField(max_length=50)  # e.g., 'course', 'payment', 'marketing'
    
    # Channel-specific preferences for this category
    push_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'category']

class UserPreferenceService:
    def __init__(self):
        self.cache = get_redis_client()
        self.cache_ttl = 3600  # 1 hour
    
    async def get_user_preferences(self, user: User) -> dict:
        """Get user preferences with caching"""
        cache_key = f"user_prefs:{user.id}"
        
        # Try cache first
        cached_prefs = await self.cache.get(cache_key)
        if cached_prefs:
            return json.loads(cached_prefs)
        
        # Load from database
        prefs, created = await UserNotificationPreference.objects.aget_or_create(
            user=user,
            defaults={
                'notifications_enabled': True,
                'data_processing_consent': False
            }
        )
        
        # Get category-specific preferences
        category_prefs = {}
        async for cat_pref in NotificationCategoryPreference.objects.filter(user=user):
            category_prefs[cat_pref.category] = {
                'push_enabled': cat_pref.push_enabled,
                'email_enabled': cat_pref.email_enabled,
                'sms_enabled': cat_pref.sms_enabled,
            }
        
        preferences = {
            'global': {
                'notifications_enabled': prefs.notifications_enabled,
                'marketing_enabled': prefs.marketing_enabled,
                'push_enabled': prefs.push_enabled,
                'email_enabled': prefs.email_enabled,
                'sms_enabled': prefs.sms_enabled,
                'quiet_hours_enabled': prefs.quiet_hours_enabled,
                'quiet_hours_start': prefs.quiet_hours_start.isoformat(),
                'quiet_hours_end': prefs.quiet_hours_end.isoformat(),
                'digest_frequency': prefs.digest_frequency,
                'data_processing_consent': prefs.data_processing_consent,
            },
            'categories': category_prefs
        }
        
        # Cache for 1 hour
        await self.cache.setex(
            cache_key,
            self.cache_ttl,
            json.dumps(preferences, default=str)
        )
        
        return preferences
    
    async def should_send_notification(self, 
                                     user: User,
                                     channel: str,
                                     category: str = None,
                                     priority: int = 3) -> bool:
        """Check if notification should be sent based on user preferences"""
        
        prefs = await self.get_user_preferences(user)
        
        # Check global consent
        if not prefs['global']['data_processing_consent']:
            return False
        
        # Check global notifications
        if not prefs['global']['notifications_enabled']:
            return priority <= 2  # Only critical/high priority
        
        # Check channel enabled
        if not prefs['global'].get(f'{channel}_enabled', False):
            return priority == 1  # Only critical
        
        # Check category-specific preferences
        if category and category in prefs['categories']:
            cat_prefs = prefs['categories'][category]
            if not cat_prefs.get(f'{channel}_enabled', False):
                return priority == 1  # Only critical
        
        # Check quiet hours
        if prefs['global']['quiet_hours_enabled'] and priority > 2:
            user_tz = pytz.timezone(getattr(user, 'timezone', 'UTC'))
            now = timezone.now().astimezone(user_tz).time()
            
            start_time = datetime.strptime(prefs['global']['quiet_hours_start'], '%H:%M:%S').time()
            end_time = datetime.strptime(prefs['global']['quiet_hours_end'], '%H:%M:%S').time()
            
            if start_time <= end_time:
                # Same day: 22:00 - 08:00
                in_quiet_hours = start_time <= now <= end_time
            else:
                # Across midnight: 22:00 - 08:00 next day
                in_quiet_hours = now >= start_time or now <= end_time
            
            if in_quiet_hours:
                return False
        
        return True
    
    async def invalidate_user_preferences(self, user: User):
        """Invalidate cached preferences when updated"""
        cache_key = f"user_prefs:{user.id}"
        await self.cache.delete(cache_key)
```

#### Day 13-14: WebSocket Real-time Notifications
**Learning Focus**: WebSocket management, real-time messaging, connection handling

**Tasks**:
- [ ] Setup Django Channels for WebSocket support
- [ ] Implement WebSocket connection management
- [ ] Create real-time notification delivery
- [ ] Build room-based notifications (courses, groups)
- [ ] Add presence tracking and online status

**WebSocket Implementation**:
```python
# consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
import jwt
from datetime import datetime

User = get_user_model()

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get user from JWT token
        token = self.scope.get('query_string', b'').decode().split('token=')[-1]
        
        try:
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=['HS256']
            )
            self.user = await self.get_user(payload['user_id'])
        except (jwt.InvalidTokenError, KeyError):
            await self.close()
            return
        
        if not self.user:
            await self.close()
            return
        
        # Join user's personal notification room
        self.user_room = f"user_{self.user.id}"
        await self.channel_layer.group_add(
            self.user_room,
            self.channel_name
        )
        
        # Track connection
        await self.track_connection()
        
        await self.accept()
        
        # Send pending notifications
        await self.send_pending_notifications()
    
    async def disconnect(self, close_code):
        # Leave user room
        await self.channel_layer.group_discard(
            self.user_room,
            self.channel_name
        )
        
        # Remove connection tracking
        await self.remove_connection_tracking()
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'mark_read':
                await self.mark_notification_read(data.get('notification_id'))
            elif message_type == 'mark_all_read':
                await self.mark_all_notifications_read()
            elif message_type == 'join_room':
                await self.join_notification_room(data.get('room'))
            elif message_type == 'leave_room':
                await self.leave_notification_room(data.get('room'))
        
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
    
    async def notification_message(self, event):
        """Send notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': event['data']
        }))
    
    async def presence_update(self, event):
        """Send presence update"""
        await self.send(text_data=json.dumps({
            'type': 'presence',
            'data': event['data']
        }))
    
    @database_sync_to_async
    def get_user(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None
    
    async def track_connection(self):
        """Track user connection for presence"""
        redis_client = get_redis_client()
        
        # Track connection
        await redis_client.setex(
            f"ws_connection:{self.user.id}:{self.channel_name}",
            300,  # 5 minutes
            json.dumps({
                'user_id': str(self.user.id),
                'connected_at': datetime.now().isoformat(),
                'channel_name': self.channel_name
            })
        )
        
        # Add to user's connection set
        await redis_client.sadd(
            f"user_connections:{self.user.id}",
            self.channel_name
        )
        
        # Update user online status
        await redis_client.setex(
            f"user_online:{self.user.id}",
            300,
            "true"
        )
    
    async def send_pending_notifications(self):
        """Send unread notifications to newly connected user"""
        unread_notifications = await self.get_unread_notifications()
        
        for notification in unread_notifications:
            await self.send(text_data=json.dumps({
                'type': 'notification',
                'data': {
                    'id': str(notification.id),
                    'title': notification.title,
                    'body': notification.body,
                    'data': notification.data,
                    'created_at': notification.created_at.isoformat(),
                    'priority': notification.priority
                }
            }))
    
    @database_sync_to_async
    def get_unread_notifications(self):
        return list(
            NotificationMessage.objects.filter(
                user=self.user,
                channel='in_app',
                status='sent',
                read_at__isnull=True
            ).order_by('-created_at')[:50]
        )

# WebSocket notification service
class WebSocketNotificationService:
    def __init__(self):
        self.redis_client = get_redis_client()
        self.channel_layer = get_channel_layer()
    
    async def send_realtime_notification(self, 
                                       user: User,
                                       notification_data: dict):
        """Send real-time notification via WebSocket"""
        
        # Check if user is online
        is_online = await self.is_user_online(user.id)
        if not is_online:
            return False
        
        # Send to user's room
        user_room = f"user_{user.id}"
        await self.channel_layer.group_send(
            user_room,
            {
                'type': 'notification_message',
                'data': notification_data
            }
        )
        
        return True
    
    async def send_room_notification(self, 
                                   room_name: str,
                                   notification_data: dict,
                                   exclude_users: list = None):
        """Send notification to all users in a room"""
        
        await self.channel_layer.group_send(
            room_name,
            {
                'type': 'notification_message',
                'data': notification_data
            }
        )
    
    async def is_user_online(self, user_id: str) -> bool:
        """Check if user has active WebSocket connections"""
        online_status = await self.redis_client.get(f"user_online:{user_id}")
        return online_status == "true"
    
    async def get_online_users_in_room(self, room_name: str) -> list:
        """Get list of online users in a specific room"""
        room_members = await self.redis_client.smembers(f"room_members:{room_name}")
        online_users = []
        
        for user_id in room_members:
            if await self.is_user_online(user_id):
                online_users.append(user_id)
        
        return online_users
```

### Week 3: Analytics, Batching & Advanced Features (Days 15-21)

#### Day 15-17: Analytics & A/B Testing
**Learning Focus**: Event tracking, metrics collection, A/B testing for notifications

**Tasks**:
- [ ] Implement notification analytics and tracking
- [ ] Build open/click rate tracking for emails
- [ ] Create A/B testing framework for notification content
- [ ] Add conversion tracking and attribution
- [ ] Build analytics dashboard and reporting

**Analytics Implementation**:
```python
class NotificationAnalytics(models.Model):
    notification = models.OneToOneField(NotificationMessage, on_delete=models.CASCADE)
    
    # Delivery tracking
    queued_at = models.DateTimeField()
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    
    # Engagement tracking
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    converted_at = models.DateTimeField(null=True, blank=True)
    
    # Device and location info
    opened_from_device = models.CharField(max_length=50, blank=True)
    opened_from_location = models.JSONField(default=dict)
    user_agent = models.TextField(blank=True)
    
    # A/B testing
    ab_test_variant = models.CharField(max_length=50, blank=True)
    ab_test_group = models.CharField(max_length=50, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

class NotificationABTest(models.Model):
    name = models.CharField(max_length=100)
    template = models.ForeignKey(NotificationTemplate, on_delete=models.CASCADE)
    
    # Test configuration
    traffic_percentage = models.PositiveIntegerField(default=50)  # 0-100
    variant_a_content = models.JSONField()
    variant_b_content = models.JSONField()
    
    # Test parameters
    metric = models.CharField(max_length=50, default='click_rate')  # open_rate, click_rate, conversion_rate
    minimum_sample_size = models.PositiveIntegerField(default=1000)
    confidence_level = models.FloatField(default=0.95)
    
    # Status
    status = models.CharField(max_length=20, choices=[
        ('draft', 'Draft'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('paused', 'Paused')
    ], default='draft')
    
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    winner_variant = models.CharField(max_length=10, blank=True)  # 'A' or 'B'
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class NotificationAnalyticsService:
    def __init__(self):
        self.redis_client = get_redis_client()
    
    async def track_notification_sent(self, notification: NotificationMessage):
        """Track when notification is sent"""
        analytics, created = await NotificationAnalytics.objects.aget_or_create(
            notification=notification,
            defaults={
                'queued_at': notification.created_at,
                'sent_at': timezone.now()
            }
        )
        
        if not created:
            analytics.sent_at = timezone.now()
            await analytics.asave()
        
        # Update Redis counters
        date_key = timezone.now().strftime('%Y-%m-%d')
        await self.redis_client.hincrby(
            f"notification_stats:{date_key}",
            f"{notification.channel}_sent",
            1
        )
    
    async def track_notification_opened(self, 
                                      notification_id: str,
                                      request_info: dict):
        """Track when notification is opened"""
        try:
            notification = await NotificationMessage.objects.aget(id=notification_id)
            analytics = await NotificationAnalytics.objects.aget(notification=notification)
            
            if not analytics.opened_at:
                analytics.opened_at = timezone.now()
                analytics.opened_from_device = request_info.get('device', '')
                analytics.user_agent = request_info.get('user_agent', '')
                analytics.opened_from_location = request_info.get('location', {})
                await analytics.asave()
                
                # Update counters
                date_key = timezone.now().strftime('%Y-%m-%d')
                await self.redis_client.hincrby(
                    f"notification_stats:{date_key}",
                    f"{notification.channel}_opened",
                    1
                )
        
        except NotificationMessage.DoesNotExist:
            pass
    
    async def track_notification_clicked(self, 
                                       notification_id: str,
                                       click_url: str):
        """Track when notification link is clicked"""
        try:
            notification = await NotificationMessage.objects.aget(id=notification_id)
            analytics = await NotificationAnalytics.objects.aget(notification=notification)
            
            if not analytics.clicked_at:
                analytics.clicked_at = timezone.now()
                await analytics.asave()
                
                # Update counters
                date_key = timezone.now().strftime('%Y-%m-%d')
                await self.redis_client.hincrby(
                    f"notification_stats:{date_key}",
                    f"{notification.channel}_clicked",
                    1
                )
                
                # Track click URL
                await self.redis_client.zincrby(
                    f"notification_clicks:{date_key}",
                    1,
                    click_url
                )
        
        except NotificationMessage.DoesNotExist:
            pass
    
    async def get_notification_metrics(self, 
                                     start_date: datetime,
                                     end_date: datetime,
                                     channel: str = None) -> dict:
        """Get aggregated notification metrics"""
        
        metrics = {
            'sent': 0,
            'delivered': 0,
            'opened': 0,
            'clicked': 0,
            'open_rate': 0.0,
            'click_rate': 0.0,
            'delivery_rate': 0.0
        }
        
        # Get data from Redis for recent dates, database for historical
        current_date = start_date
        while current_date <= end_date:
            date_key = current_date.strftime('%Y-%m-%d')
            
            if channel:
                sent_key = f"{channel}_sent"
                opened_key = f"{channel}_opened"
                clicked_key = f"{channel}_clicked"
            else:
                # Sum all channels
                daily_stats = await self.redis_client.hgetall(f"notification_stats:{date_key}")
                sent_count = sum(int(v) for k, v in daily_stats.items() if k.endswith('_sent'))
                opened_count = sum(int(v) for k, v in daily_stats.items() if k.endswith('_opened'))
                clicked_count = sum(int(v) for k, v in daily_stats.items() if k.endswith('_clicked'))
                
                metrics['sent'] += sent_count
                metrics['opened'] += opened_count
                metrics['clicked'] += clicked_count
            
            current_date += timedelta(days=1)
        
        # Calculate rates
        if metrics['sent'] > 0:
            metrics['open_rate'] = metrics['opened'] / metrics['sent']
            metrics['click_rate'] = metrics['clicked'] / metrics['sent']
            metrics['delivery_rate'] = metrics['delivered'] / metrics['sent']
        
        return metrics

class ABTestingService:
    def __init__(self):
        self.redis_client = get_redis_client()
    
    async def assign_variant(self, 
                           user: User,
                           ab_test: NotificationABTest) -> str:
        """Assign user to A/B test variant"""
        
        # Check if user already assigned
        cache_key = f"ab_test:{ab_test.id}:user:{user.id}"
        existing_variant = await self.redis_client.get(cache_key)
        
        if existing_variant:
            return existing_variant.decode()
        
        # Hash-based consistent assignment
        import hashlib
        hash_input = f"{ab_test.id}:{user.id}".encode()
        hash_value = int(hashlib.md5(hash_input).hexdigest()[:8], 16)
        
        # Assign based on traffic percentage
        assignment_threshold = (ab_test.traffic_percentage / 100.0) * (2**32)
        
        if hash_value < assignment_threshold:
            variant = 'A' if (hash_value % 2 == 0) else 'B'
        else:
            variant = 'control'  # Not in test
        
        # Cache assignment for 7 days
        await self.redis_client.setex(cache_key, 604800, variant)
        
        return variant
    
    async def get_test_content(self,
                             ab_test: NotificationABTest,
                             variant: str) -> dict:
        """Get content for specific test variant"""
        
        if variant == 'A':
            return ab_test.variant_a_content
        elif variant == 'B':
            return ab_test.variant_b_content
        else:
            # Return default template content
            return {}
    
    async def calculate_test_results(self, ab_test: NotificationABTest) -> dict:
        """Calculate A/B test statistical results"""
        
        # Get metrics for each variant
        variant_a_metrics = await self._get_variant_metrics(ab_test, 'A')
        variant_b_metrics = await self._get_variant_metrics(ab_test, 'B')
        
        # Statistical significance calculation
        from scipy import stats
        
        metric_name = ab_test.metric
        a_successes = variant_a_metrics[metric_name.replace('_rate', '')]
        a_total = variant_a_metrics['sent']
        b_successes = variant_b_metrics[metric_name.replace('_rate', '')]
        b_total = variant_b_metrics['sent']
        
        # Two-proportion z-test
        if a_total > 0 and b_total > 0:
            a_rate = a_successes / a_total
            b_rate = b_successes / b_total
            
            # Calculate pooled proportion
            pooled_p = (a_successes + b_successes) / (a_total + b_total)
            pooled_se = math.sqrt(pooled_p * (1 - pooled_p) * (1/a_total + 1/b_total))
            
            if pooled_se > 0:
                z_score = (b_rate - a_rate) / pooled_se
                p_value = 2 * (1 - stats.norm.cdf(abs(z_score)))
                
                # Determine winner
                confidence_threshold = 1 - ab_test.confidence_level
                is_significant = p_value < confidence_threshold
                
                winner = None
                if is_significant:
                    winner = 'B' if b_rate > a_rate else 'A'
                
                return {
                    'variant_a': {
                        'rate': a_rate,
                        'count': a_successes,
                        'total': a_total
                    },
                    'variant_b': {
                        'rate': b_rate,
                        'count': b_successes,
                        'total': b_total
                    },
                    'statistical_significance': {
                        'z_score': z_score,
                        'p_value': p_value,
                        'is_significant': is_significant,
                        'confidence_level': ab_test.confidence_level
                    },
                    'winner': winner,
                    'lift': (b_rate - a_rate) / a_rate if a_rate > 0 else 0
                }
        
        return {'error': 'Insufficient data for statistical analysis'}
```

#### Day 18-19: Batch Processing & Campaigns
**Learning Focus**: Bulk messaging, campaign management, performance optimization

**Tasks**:
- [ ] Build batch notification processing system
- [ ] Implement email campaign management
- [ ] Create newsletter and marketing automation
- [ ] Add subscriber management and segmentation
- [ ] Optimize batch processing performance

#### Day 20-21: Compliance & Advanced Features
**Learning Focus**: GDPR compliance, data retention, audit logging

**Tasks**:
- [ ] Implement comprehensive audit logging
- [ ] Build GDPR data export and deletion
- [ ] Create notification scheduling and timezone handling
- [ ] Add notification digest and summary features
- [ ] Implement advanced personalization with ML

---

## 📊 Database Schema Design

### PostgreSQL Schema
```sql
-- Notification templates with multi-channel support
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    path VARCHAR(200) UNIQUE NOT NULL,
    
    -- Multi-channel templates
    push_template TEXT,
    email_subject_template VARCHAR(200),
    email_body_template TEXT,
    email_html_template TEXT,
    sms_template VARCHAR(160),
    websocket_template TEXT,
    
    -- Template metadata
    supported_channels TEXT[] DEFAULT '{}',
    required_variables JSONB DEFAULT '[]',
    optional_variables JSONB DEFAULT '[]',
    default_priority INTEGER DEFAULT 3,
    
    -- Localization
    locale VARCHAR(10) DEFAULT 'en_US',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification messages
CREATE TABLE notification_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    template_id UUID REFERENCES notification_templates(id),
    
    channel VARCHAR(20) NOT NULL,
    priority INTEGER DEFAULT 3,
    
    -- Rendered content
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    
    -- Scheduling
    scheduled_at TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    
    -- Retry management
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    
    -- A/B testing
    ab_test_id UUID,
    ab_test_variant VARCHAR(10),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User notification preferences
CREATE TABLE user_notification_preferences (
    user_id UUID PRIMARY KEY,
    
    -- Global preferences
    notifications_enabled BOOLEAN DEFAULT TRUE,
    marketing_enabled BOOLEAN DEFAULT FALSE,
    
    -- Channel preferences
    push_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    websocket_enabled BOOLEAN DEFAULT TRUE,
    
    -- Timing preferences
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Frequency
    digest_frequency VARCHAR(20) DEFAULT 'immediate',
    
    -- GDPR
    consent_given_at TIMESTAMP,
    consent_withdrawn_at TIMESTAMP,
    data_processing_consent BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Category-specific preferences
CREATE TABLE notification_category_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category VARCHAR(50) NOT NULL,
    
    push_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    websocket_enabled BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, category)
);

-- A/B testing
CREATE TABLE notification_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    template_id UUID REFERENCES notification_templates(id),
    
    traffic_percentage INTEGER DEFAULT 50,
    variant_a_content JSONB NOT NULL,
    variant_b_content JSONB NOT NULL,
    
    metric VARCHAR(50) DEFAULT 'click_rate',
    minimum_sample_size INTEGER DEFAULT 1000,
    confidence_level DECIMAL(3,2) DEFAULT 0.95,
    
    status VARCHAR(20) DEFAULT 'draft',
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    winner_variant VARCHAR(10),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics and tracking
CREATE TABLE notification_analytics (
    notification_id UUID PRIMARY KEY REFERENCES notification_messages(id) ON DELETE CASCADE,
    
    queued_at TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    converted_at TIMESTAMP,
    
    -- Device info
    opened_from_device VARCHAR(50),
    opened_from_location JSONB,
    user_agent TEXT,
    
    -- A/B testing
    ab_test_variant VARCHAR(50),
    ab_test_group VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaign management
CREATE TABLE notification_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    template_id UUID REFERENCES notification_templates(id),
    channel VARCHAR(20) NOT NULL,
    
    -- Targeting
    target_audience JSONB, -- Segment criteria
    estimated_recipients INTEGER,
    
    -- Scheduling
    scheduled_at TIMESTAMP,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft',
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_notification_messages_user_created ON notification_messages(user_id, created_at DESC);
CREATE INDEX idx_notification_messages_status_scheduled ON notification_messages(status, scheduled_at);
CREATE INDEX idx_notification_messages_channel_priority ON notification_messages(channel, priority, scheduled_at);
CREATE INDEX idx_notification_analytics_opened ON notification_analytics(opened_at) WHERE opened_at IS NOT NULL;
CREATE INDEX idx_notification_analytics_clicked ON notification_analytics(clicked_at) WHERE clicked_at IS NOT NULL;
```

### Redis Schema for Queuing & Caching
```redis
# Priority queue for notifications
ZADD notification_priority_queue ${priority_score} "${message_id}:${channel}:${scheduled_timestamp}"

# User preference cache
SETEX user_prefs:${user_id} 3600 "${preferences_json}"

# WebSocket connection tracking
SETEX ws_connection:${user_id}:${channel_name} 300 "${connection_info}"
SADD user_connections:${user_id} "${channel_name}"
SETEX user_online:${user_id} 300 "true"

# Rate limiting per channel
SET rate_limit:push:${minute} 100 EX 60
SET rate_limit:email:${second} 14 EX 1
SET rate_limit:sms:${second} 1 EX 1

# Dead letter queue
LPUSH notification_dead_letter_queue "${failed_message_json}"

# A/B test assignments
SETEX ab_test:${test_id}:user:${user_id} 604800 "${variant}"

# Daily analytics counters
HINCRBY notification_stats:${date} "${channel}_sent" 1
HINCRBY notification_stats:${date} "${channel}_opened" 1
HINCRBY notification_stats:${date} "${channel}_clicked" 1

# Click URL tracking
ZINCRBY notification_clicks:${date} 1 "${click_url}"

# Template usage stats
ZINCRBY template_usage:${date} 1 "${template_id}"

# Circuit breaker state
SETEX circuit_breaker:${provider} 60 "${state}:${failure_count}:${last_failure}"
```

---

## 🔌 API Design & Specifications

### OpenAPI 3.0 Specification
```yaml
openapi: 3.0.3
info:
  title: Suuupra Notifications Service API
  version: 1.0.0
  description: Multi-channel notification delivery service

paths:
  # Notification Management
  /api/v1/notifications/send:
    post:
      summary: Send notification
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SendNotificationRequest'
      responses:
        '201':
          description: Notification queued
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NotificationResponse'
        '400':
          description: Invalid request
        '403':
          description: User opted out

  /api/v1/notifications/bulk:
    post:
      summary: Send bulk notifications
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BulkNotificationRequest'
      responses:
        '202':
          description: Bulk notifications queued
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BulkNotificationResponse'

  /api/v1/notifications/{notification_id}/status:
    get:
      summary: Get notification status
      security:
        - bearerAuth: []
      parameters:
        - name: notification_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Notification status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NotificationStatus'

  # User Preferences
  /api/v1/preferences:
    get:
      summary: Get user notification preferences
      security:
        - bearerAuth: []
      responses:
        '200':
          description: User preferences
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NotificationPreferences'

    put:
      summary: Update notification preferences
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdatePreferencesRequest'
      responses:
        '200':
          description: Preferences updated

  /api/v1/preferences/unsubscribe:
    post:
      summary: Unsubscribe from notifications
      parameters:
        - name: token
          in: query
          required: true
          schema:
            type: string
        - name: category
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Successfully unsubscribed

  # Templates
  /api/v1/templates:
    get:
      summary: List notification templates
      security:
        - bearerAuth: []
      parameters:
        - name: category
          in: query
          schema:
            type: string
        - name: channel
          in: query
          schema:
            type: string
            enum: [push, email, sms, websocket]
      responses:
        '200':
          description: Template list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/NotificationTemplate'

    post:
      summary: Create notification template
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTemplateRequest'
      responses:
        '201':
          description: Template created

  # Analytics
  /api/v1/analytics/metrics:
    get:
      summary: Get notification metrics
      security:
        - bearerAuth: []
      parameters:
        - name: start_date
          in: query
          required: true
          schema:
            type: string
            format: date
        - name: end_date
          in: query
          required: true
          schema:
            type: string
            format: date
        - name: channel
          in: query
          schema:
            type: string
        - name: template_id
          in: query
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Notification metrics
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NotificationMetrics'

  # Tracking endpoints
  /api/v1/track/open/{notification_id}:
    get:
      summary: Track notification open
      parameters:
        - name: notification_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Open tracked
          content:
            image/gif:
              schema:
                type: string
                format: binary

  /api/v1/track/click:
    get:
      summary: Track notification click
      parameters:
        - name: notification_id
          in: query
          required: true
          schema:
            type: string
            format: uuid
        - name: url
          in: query
          required: true
          schema:
            type: string
            format: uri
      responses:
        '302':
          description: Redirect to target URL

components:
  schemas:
    SendNotificationRequest:
      type: object
      required: [template_path, user_id, channel]
      properties:
        template_path:
          type: string
          example: "user.payment.success"
        user_id:
          type: string
          format: uuid
        channel:
          type: string
          enum: [push, email, sms, websocket, in_app]
        priority:
          type: integer
          enum: [1, 2, 3, 4]
          default: 3
        scheduled_at:
          type: string
          format: date-time
        context:
          type: object
          description: Template variables
        options:
          type: object
          properties:
            bypass_preferences:
              type: boolean
              default: false
            track_opens:
              type: boolean
              default: true
            track_clicks:
              type: boolean
              default: true

    NotificationResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
        status:
          type: string
          enum: [pending, processing, sent, delivered, failed]
        message:
          type: string
        estimated_delivery:
          type: string
          format: date-time

    NotificationPreferences:
      type: object
      properties:
        global:
          type: object
          properties:
            notifications_enabled:
              type: boolean
            marketing_enabled:
              type: boolean
            push_enabled:
              type: boolean
            email_enabled:
              type: boolean
            sms_enabled:
              type: boolean
            quiet_hours_enabled:
              type: boolean
            quiet_hours_start:
              type: string
              format: time
            quiet_hours_end:
              type: string
              format: time
            digest_frequency:
              type: string
              enum: [immediate, hourly, daily, weekly, never]
        categories:
          type: object
          additionalProperties:
            type: object
            properties:
              push_enabled:
                type: boolean
              email_enabled:
                type: boolean
              sms_enabled:
                type: boolean

    NotificationMetrics:
      type: object
      properties:
        period:
          type: object
          properties:
            start_date:
              type: string
              format: date
            end_date:
              type: string
              format: date
        total_sent:
          type: integer
        total_delivered:
          type: integer
        total_opened:
          type: integer
        total_clicked:
          type: integer
        delivery_rate:
          type: number
          format: float
        open_rate:
          type: number
          format: float
        click_rate:
          type: number
          format: float
        by_channel:
          type: object
          additionalProperties:
            type: object
            properties:
              sent:
                type: integer
              delivered:
                type: integer
              opened:
                type: integer
              clicked:
                type: integer

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

## 🧪 Testing Strategy

### Unit Tests (Target: 90% Coverage)
```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from django.test import TestCase
from django.contrib.auth import get_user_model

User = get_user_model()

class TestPriorityNotificationQueue(TestCase):
    def setUp(self):
        self.queue = PriorityNotificationQueue()
    
    def test_priority_ordering(self):
        # Create messages with different priorities
        critical_msg = NotificationMessage(
            priority=Priority.CRITICAL,
            user_id="user1",
            channel="push",
            template_id="template1",
            scheduled_at=datetime.now()
        )
        
        low_msg = NotificationMessage(
            priority=Priority.LOW,
            user_id="user2", 
            channel="email",
            template_id="template2",
            scheduled_at=datetime.now()
        )
        
        # Add in reverse priority order
        self.queue.push(low_msg)
        self.queue.push(critical_msg)
        
        # Critical should come out first
        first_out = self.queue.pop()
        self.assertEqual(first_out.priority, Priority.CRITICAL)
        
        second_out = self.queue.pop()
        self.assertEqual(second_out.priority, Priority.LOW)

class TestExponentialBackoffRetry(TestCase):
    def setUp(self):
        self.retry_handler = ExponentialBackoffRetry(
            max_retries=3,
            base_delay=1.0,
            jitter=False
        )
    
    def test_delay_calculation(self):
        # Test exponential backoff delays
        self.assertEqual(self.retry_handler.calculate_delay(0), 1.0)
        self.assertEqual(self.retry_handler.calculate_delay(1), 2.0)
        self.assertEqual(self.retry_handler.calculate_delay(2), 4.0)
        self.assertEqual(self.retry_handler.calculate_delay(3), 8.0)
    
    async def test_retry_success_on_second_attempt(self):
        attempts = 0
        
        async def failing_function():
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise Exception("First attempt fails")
            return "success"
        
        result = await self.retry_handler.retry_with_backoff(failing_function)
        self.assertEqual(result, "success")
        self.assertEqual(attempts, 2)
    
    async def test_retry_exhaustion(self):
        attempts = 0
        
        async def always_failing_function():
            nonlocal attempts
            attempts += 1
            raise Exception("Always fails")
        
        with self.assertRaises(Exception):
            await self.retry_handler.retry_with_backoff(always_failing_function)
        
        self.assertEqual(attempts, 4)  # Initial + 3 retries

@pytest.mark.asyncio
class TestNotificationDeliveryEngine:
    def setUp(self):
        self.engine = NotificationDeliveryEngine()
        self.user = User.objects.create(
            email="test@example.com",
            fcm_token="test_fcm_token"
        )
    
    @patch('notifications.services.FCMPushProvider.send')
    async def test_successful_push_delivery(self, mock_send):
        mock_send.return_value = {
            'success': True,
            'message_id': 'fcm_message_123'
        }
        
        message = NotificationMessage.objects.create(
            user=self.user,
            channel='push',
            title='Test Notification',
            body='Test body',
            scheduled_at=timezone.now()
        )
        
        result = await self.engine.deliver_message(message)
        
        self.assertTrue(result.success)
        self.assertEqual(result.message_id, 'fcm_message_123')
        
        message.refresh_from_db()
        self.assertEqual(message.status, 'sent')
    
    @patch('notifications.services.FCMPushProvider.send')
    async def test_failed_delivery_with_retry(self, mock_send):
        mock_send.side_effect = [
            {'success': False, 'error': 'Service unavailable', 'retry': True},
            {'success': True, 'message_id': 'fcm_message_456'}
        ]
        
        message = NotificationMessage.objects.create(
            user=self.user,
            channel='push',
            title='Test Notification',
            body='Test body',
            scheduled_at=timezone.now()
        )
        
        result = await self.engine.deliver_message(message)
        
        self.assertTrue(result.success)
        self.assertEqual(mock_send.call_count, 2)

class TestTemplateEngine(TestCase):
    def setUp(self):
        self.template_engine = NotificationTemplateEngine()
    
    def test_basic_template_rendering(self):
        template_content = "Hello {{ user.first_name }}, your payment of {{ amount|currency }} was processed."
        context = {
            'user': {'first_name': 'John'},
            'amount': 29.99
        }
        
        result = self.template_engine.render_template(template_content, context)
        expected = "Hello John, your payment of $29.99 was processed."
        
        self.assertEqual(result, expected)
    
    def test_custom_filters(self):
        # Test currency filter
        template_content = "Price: {{ amount|currency('EUR') }}"
        context = {'amount': 50.0}
        
        result = self.template_engine.render_template(template_content, context)
        self.assertEqual(result, "Price: €50.00")
    
    def test_template_validation(self):
        template_content = "Hello {{ user.name }}, you have {{ count }} messages."
        required_vars = ['user.name', 'count']
        
        validation = self.template_engine.validate_template(template_content, required_vars)
        
        self.assertTrue(validation['valid'])
        self.assertEqual(len(validation['missing_variables']), 0)

@pytest.mark.asyncio
class TestUserPreferenceService:
    def setUp(self):
        self.service = UserPreferenceService()
        self.user = User.objects.create(
            email="test@example.com",
            timezone="America/New_York"
        )
    
    async def test_should_send_notification_respect_global_preferences(self):
        # User has notifications disabled
        UserNotificationPreference.objects.create(
            user=self.user,
            notifications_enabled=False,
            data_processing_consent=True
        )
        
        # Low priority should be blocked
        should_send = await self.service.should_send_notification(
            self.user, 'push', 'course', priority=4
        )
        self.assertFalse(should_send)
        
        # Critical priority should go through
        should_send = await self.service.should_send_notification(
            self.user, 'push', 'course', priority=1
        )
        self.assertTrue(should_send)
    
    async def test_quiet_hours_enforcement(self):
        UserNotificationPreference.objects.create(
            user=self.user,
            notifications_enabled=True,
            quiet_hours_enabled=True,
            quiet_hours_start=time(22, 0),
            quiet_hours_end=time(8, 0),
            data_processing_consent=True
        )
        
        # Mock current time to be in quiet hours
        with patch('django.utils.timezone.now') as mock_now:
            # 11 PM in user's timezone
            mock_now.return_value = datetime(2023, 1, 1, 23, 0, tzinfo=pytz.UTC)
            
            should_send = await self.service.should_send_notification(
                self.user, 'push', 'marketing', priority=3
            )
            self.assertFalse(should_send)
            
            # Critical should still go through
            should_send = await self.service.should_send_notification(
                self.user, 'push', 'security', priority=1
            )
            self.assertTrue(should_send)
```

### Integration Tests
```python
@pytest.mark.django_db
class TestNotificationWorkflow:
    @pytest.fixture
    def setup_test_data(self):
        self.user = User.objects.create(
            email="integration@test.com",
            first_name="Integration",
            last_name="Test"
        )
        
        self.template = NotificationTemplate.objects.create(
            name="test_template",
            path="test.integration",
            push_template="Hello {{ user.first_name }}!",
            email_subject_template="Test Subject",
            email_body_template="Hello {{ user.first_name }}, this is a test.",
            supported_channels=['push', 'email'],
            required_variables=['user.first_name']
        )
    
    @patch('notifications.services.FCMPushProvider.send')
    async def test_end_to_end_notification_flow(self, mock_fcm_send, setup_test_data):
        mock_fcm_send.return_value = {
            'success': True,
            'message_id': 'test_message_id'
        }
        
        # Send notification via API
        client = APIClient()
        client.force_authenticate(user=self.user)
        
        response = await client.post('/api/v1/notifications/send', {
            'template_path': 'test.integration',
            'user_id': str(self.user.id),
            'channel': 'push',
            'priority': 2,
            'context': {'user': {'first_name': 'Integration'}}
        })
        
        self.assertEqual(response.status_code, 201)
        notification_id = response.data['id']
        
        # Process the notification
        message = await NotificationMessage.objects.aget(id=notification_id)
        
        delivery_engine = NotificationDeliveryEngine()
        result = await delivery_engine.deliver_message(message)
        
        self.assertTrue(result.success)
        
        # Verify message was marked as sent
        message.refresh_from_db()
        self.assertEqual(message.status, 'sent')
        self.assertIsNotNone(message.sent_at)
        
        # Verify FCM was called with correct payload
        mock_fcm_send.assert_called_once()
        call_args = mock_fcm_send.call_args[0]
        self.assertIn('Hello Integration!', str(call_args))

@pytest.mark.django_db
class TestWebSocketNotifications:
    @pytest.mark.asyncio
    async def test_websocket_real_time_delivery(self):
        user = User.objects.create(email="websocket@test.com")
        
        # Setup WebSocket consumer
        consumer = NotificationConsumer()
        consumer.scope = {
            'user': user,
            'query_string': f'token={generate_jwt_token(user)}'.encode()
        }
        
        # Mock channel layer
        consumer.channel_layer = AsyncMock()
        consumer.channel_name = 'test_channel'
        
        await consumer.connect()
        
        # Send real-time notification
        ws_service = WebSocketNotificationService()
        notification_data = {
            'id': str(uuid.uuid4()),
            'title': 'Real-time Test',
            'body': 'This is a real-time notification',
            'priority': 2
        }
        
        result = await ws_service.send_realtime_notification(user, notification_data)
        
        # Verify notification was sent to user's room
        consumer.channel_layer.group_send.assert_called_once_with(
            f"user_{user.id}",
            {
                'type': 'notification_message',
                'data': notification_data
            }
        )
```

### Load Tests (K6)
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 200 },  // Stay at 200 notifications/sec
    { duration: '2m', target: 500 },  // Spike test
    { duration: '1m', target: 500 },  // Hold spike
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'],  // 99% under 500ms
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
  },
};

let errorRate = new Rate('errors');

export default function () {
  // Test bulk notification endpoint
  let payload = JSON.stringify({
    template_path: 'test.load',
    recipients: [
      { user_id: __VU + '-' + __ITER, channel: 'push' },
      { user_id: __VU + '-' + __ITER, channel: 'email' }
    ],
    context: {
      user: { first_name: `User${__VU}` },
      timestamp: new Date().toISOString()
    }
  });

  let params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + __ENV.API_TOKEN,
    },
  };

  let response = http.post('http://localhost:8000/api/v1/notifications/bulk', payload, params);

  let success = check(response, {
    'bulk notification queued': (r) => r.status === 202,
    'response has job_id': (r) => JSON.parse(r.body).job_id !== undefined,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  if (!success) {
    errorRate.add(1);
  }

  // Test preference endpoint (read-heavy)
  let prefsResponse = http.get('http://localhost:8000/api/v1/preferences', {
    headers: { 'Authorization': 'Bearer ' + __ENV.API_TOKEN }
  });

  check(prefsResponse, {
    'preferences retrieved': (r) => r.status === 200,
    'preferences response time < 100ms': (r) => r.timings.duration < 100,
  });

  sleep(1);
}

// Test WebSocket connections
export function websocketTest() {
  let socket = new WebSocket('ws://localhost:8000/ws/notifications/?token=' + __ENV.WS_TOKEN);
  
  socket.onopen = function() {
    console.log('WebSocket connected');
  };
  
  socket.onmessage = function(event) {
    let data = JSON.parse(event.data);
    check(data, {
      'websocket message received': (d) => d.type === 'notification',
      'websocket message has data': (d) => d.data !== undefined,
    });
  };
  
  socket.onerror = function(error) {
    console.log('WebSocket error:', error);
  };
  
  // Keep connection alive for 30 seconds
  sleep(30);
  socket.close();
}
```

---

## 🚀 Performance Targets & Optimization

### Performance Requirements
- **Message Processing**: 10,000+ messages per second
- **Template Rendering**: <50ms p99 for personalized content
- **WebSocket Latency**: <100ms for real-time delivery
- **API Response Time**: <200ms p99 for all endpoints
- **Queue Processing**: <5 second delay from queue to delivery attempt

### Optimization Techniques

#### 1. Message Queue Optimization
```python
class OptimizedNotificationQueue:
    def __init__(self):
        self.redis_client = get_redis_client()
        self.batch_size = 100
        self.processing_workers = 8
    
    async def batch_process_notifications(self):
        """Process notifications in batches for better throughput"""
        
        while True:
            # Get batch of messages from priority queue
            messages = await self._get_message_batch()
            
            if not messages:
                await asyncio.sleep(0.1)
                continue
            
            # Group by channel for efficient provider usage
            channel_groups = self._group_by_channel(messages)
            
            # Process each channel group concurrently
            tasks = [
                self._process_channel_batch(channel, msgs)
                for channel, msgs in channel_groups.items()
            ]
            
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _get_message_batch(self) -> List[NotificationMessage]:
        """Get batch of high-priority messages from Redis queue"""
        
        # Get top priority messages
        message_ids = await self.redis_client.zrange(
            'notification_priority_queue',
            0, self.batch_size - 1
        )
        
        if not message_ids:
            return []
        
        # Remove from queue atomically
        pipe = self.redis_client.pipeline()
        for msg_id in message_ids:
            pipe.zrem('notification_priority_queue', msg_id)
        await pipe.execute()
        
        # Load message objects
        messages = await NotificationMessage.objects.filter(
            id__in=[msg_id.split(':')[0] for msg_id in message_ids]
        ).select_related('user', 'template').all()
        
        return messages
    
    def _group_by_channel(self, messages) -> Dict[str, List[NotificationMessage]]:
        """Group messages by channel for batch processing"""
        groups = {}
        for message in messages:
            channel = message.channel
            if channel not in groups:
                groups[channel] = []
            groups[channel].append(message)
        return groups
    
    async def _process_channel_batch(self, 
                                   channel: str, 
                                   messages: List[NotificationMessage]):
        """Process batch of messages for specific channel"""
        
        provider = self.get_provider(channel)
        rate_limiter = self.get_rate_limiter(channel)
        
        # Respect rate limits
        await rate_limiter.acquire_batch(len(messages))
        
        # Process concurrently with semaphore
        semaphore = asyncio.Semaphore(10)  # Limit concurrent per batch
        
        tasks = [
            self._process_single_message(semaphore, provider, msg)
            for msg in messages
        ]
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _process_single_message(self, 
                                    semaphore: asyncio.Semaphore,
                                    provider: NotificationChannelProvider,
                                    message: NotificationMessage):
        async with semaphore:
            try:
                result = await provider.send(message.get_recipient(), message.to_payload())
                await self._update_message_status(message, result)
            except Exception as e:
                await self._handle_message_error(message, str(e))
```

#### 2. Template Caching
```python
class CachedTemplateEngine(NotificationTemplateEngine):
    def __init__(self):
        super().__init__()
        self.template_cache = {}
        self.rendered_cache = LRUCache(maxsize=10000)
        self.cache_lock = asyncio.Lock()
    
    async def render_template_cached(self, 
                                   template_id: str,
                                   template_content: str,
                                   context: Dict[str, Any]) -> str:
        
        # Create cache key from context hash
        context_hash = hashlib.md5(
            json.dumps(context, sort_keys=True).encode()
        ).hexdigest()
        
        cache_key = f"{template_id}:{context_hash}"
        
        # Check cache first
        cached_result = self.rendered_cache.get(cache_key)
        if cached_result:
            return cached_result
        
        # Compile template if not in cache
        async with self.cache_lock:
            if template_id not in self.template_cache:
                compiled_template = self.env.from_string(template_content)
                self.template_cache[template_id] = compiled_template
        
        # Render and cache
        result = self.template_cache[template_id].render(**context)
        self.rendered_cache[cache_key] = result
        
        return result
    
    async def precompile_templates(self):
        """Precompile frequently used templates"""
        
        frequent_templates = await NotificationTemplate.objects.filter(
            is_active=True
        ).annotate(
            usage_count=Count('notificationmessage')
        ).filter(usage_count__gt=100).all()
        
        for template in frequent_templates:
            for channel in template.supported_channels:
                template_content = getattr(template, f'{channel}_template', '')
                if template_content:
                    compiled = self.env.from_string(template_content)
                    self.template_cache[f"{template.id}:{channel}"] = compiled
```

#### 3. Database Connection Pooling
```python
# settings.py database optimization
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'notifications',
        'USER': 'notifications_user',
        'PASSWORD': 'secure_password',
        'HOST': 'localhost',
        'PORT': '5432',
        'OPTIONS': {
            'MAX_CONNS': 50,
            'CONN_MAX_AGE': 600,
        }
    }
}

# Connection pooling with pgbouncer
CONN_HEALTH_CHECKS = True
CONN_MAX_AGE = 600  # 10 minutes

# Database query optimization
class OptimizedNotificationQueries:
    @staticmethod
    async def get_pending_notifications(limit: int = 1000):
        """Optimized query for pending notifications"""
        
        return await NotificationMessage.objects.filter(
            status='pending',
            scheduled_at__lte=timezone.now()
        ).select_related(
            'user',
            'template'
        ).prefetch_related(
            'user__notification_preferences',
            'user__notification_category_preferences'
        ).order_by(
            'priority', 'scheduled_at'
        )[:limit]
    
    @staticmethod
    async def bulk_update_notification_status(message_ids: List[str], status: str):
        """Bulk update notification status"""
        
        await NotificationMessage.objects.filter(
            id__in=message_ids
        ).update(
            status=status,
            updated_at=timezone.now()
        )
```

---

## 🔒 Security Considerations

### Security Requirements
- Secure API endpoints with authentication and authorization
- PII protection in notification content and logs
- Rate limiting to prevent abuse and spam
- Audit trail for all notification activities
- GDPR compliance for data handling

### Security Implementation

#### 1. API Security
```python
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle

class NotificationRateThrottle(UserRateThrottle):
    scope = 'notifications'
    rate = '100/hour'

class BulkNotificationThrottle(UserRateThrottle):
    scope = 'bulk_notifications'
    rate = '10/hour'

class SendNotificationView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [NotificationRateThrottle]
    
    def post(self, request):
        # Validate user can send notifications
        if not request.user.has_perm('notifications.send_notification'):
            return Response({'error': 'Permission denied'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        # Validate recipient permissions
        user_id = request.data.get('user_id')
        if user_id != str(request.user.id) and not request.user.is_staff:
            # Only allow sending to self unless staff
            return Response({'error': 'Cannot send to other users'}, 
                          status=status.HTTP_403_FORBIDDEN)
        
        # Process notification...
```

#### 2. Data Protection
```python
from cryptography.fernet import Fernet
import logging

class SecureNotificationData:
    def __init__(self):
        self.cipher = Fernet(settings.NOTIFICATION_ENCRYPTION_KEY)
        self.logger = logging.getLogger('notifications.security')
    
    def encrypt_pii(self, data: dict) -> dict:
        """Encrypt PII fields in notification data"""
        
        pii_fields = ['email', 'phone', 'full_name', 'address']
        encrypted_data = data.copy()
        
        for field in pii_fields:
            if field in data:
                encrypted_value = self.cipher.encrypt(
                    str(data[field]).encode()
                )
                encrypted_data[f"encrypted_{field}"] = encrypted_value.decode()
                del encrypted_data[field]
        
        return encrypted_data
    
    def decrypt_pii(self, data: dict) -> dict:
        """Decrypt PII fields for notification rendering"""
        
        decrypted_data = data.copy()
        
        for key, value in data.items():
            if key.startswith('encrypted_'):
                try:
                    original_field = key.replace('encrypted_', '')
                    decrypted_value = self.cipher.decrypt(value.encode())
                    decrypted_data[original_field] = decrypted_value.decode()
                    del decrypted_data[key]
                except Exception as e:
                    self.logger.error(f"Failed to decrypt {key}: {e}")
        
        return decrypted_data
    
    def sanitize_logs(self, message: str) -> str:
        """Remove PII from log messages"""
        
        import re
        
        # Remove email addresses
        message = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 
                        '[EMAIL]', message)
        
        # Remove phone numbers
        message = re.sub(r'\b\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b',
                        '[PHONE]', message)
        
        # Remove potential names (simple heuristic)
        message = re.sub(r'\b[A-Z][a-z]+ [A-Z][a-z]+\b', '[NAME]', message)
        
        return message

class SecureAuditLogger:
    def __init__(self):
        self.logger = logging.getLogger('notifications.audit')
        self.data_protector = SecureNotificationData()
    
    def log_notification_sent(self, 
                            notification: NotificationMessage,
                            result: dict,
                            request_user: User):
        """Log notification sending with audit trail"""
        
        audit_data = {
            'action': 'notification_sent',
            'notification_id': str(notification.id),
            'recipient_id': str(notification.user.id),
            'channel': notification.channel,
            'template_id': str(notification.template.id),
            'sender_id': str(request_user.id),
            'success': result.get('success', False),
            'timestamp': timezone.now().isoformat(),
            'ip_address': getattr(request_user, 'last_ip', None),
            'user_agent': getattr(request_user, 'last_user_agent', None)
        }
        
        # Remove PII and log
        safe_message = self.data_protector.sanitize_logs(str(audit_data))
        self.logger.info(safe_message)
    
    def log_preference_change(self, 
                            user: User,
                            changes: dict,
                            request_ip: str):
        """Log preference changes for audit"""
        
        audit_data = {
            'action': 'preference_update',
            'user_id': str(user.id),
            'changes': changes,
            'timestamp': timezone.now().isoformat(),
            'ip_address': request_ip
        }
        
        safe_message = self.data_protector.sanitize_logs(str(audit_data))
        self.logger.info(safe_message)
```

---

## 📊 Monitoring & Observability

### Metrics Collection
```python
from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry
import time

class NotificationMetrics:
    def __init__(self):
        self.registry = CollectorRegistry()
        
        self.notifications_sent = Counter(
            'notifications_sent_total',
            'Total notifications sent',
            ['channel', 'template', 'status'],
            registry=self.registry
        )
        
        self.notification_duration = Histogram(
            'notification_processing_duration_seconds',
            'Time spent processing notifications',
            ['channel', 'stage'],
            registry=self.registry
        )
        
        self.queue_size = Gauge(
            'notification_queue_size',
            'Current notification queue size',
            ['priority'],
            registry=self.registry
        )
        
        self.template_render_duration = Histogram(
            'template_render_duration_seconds',
            'Time spent rendering templates',
            ['template_id'],
            registry=self.registry
        )
    
    def record_notification_sent(self, 
                               channel: str,
                               template: str,
                               success: bool):
        status = 'success' if success else 'failure'
        self.notifications_sent.labels(
            channel=channel,
            template=template,
            status=status
        ).inc()
    
    def record_processing_time(self, 
                             channel: str,
                             stage: str,
                             duration: float):
        self.notification_duration.labels(
            channel=channel,
            stage=stage
        ).observe(duration)
    
    def update_queue_size(self, priority: str, size: int):
        self.queue_size.labels(priority=priority).set(size)
    
    def record_template_render_time(self, template_id: str, duration: float):
        self.template_render_duration.labels(
            template_id=template_id
        ).observe(duration)

# Metrics middleware
class NotificationMetricsMiddleware:
    def __init__(self):
        self.metrics = NotificationMetrics()
    
    async def process_notification(self, message: NotificationMessage):
        start_time = time.time()
        
        try:
            # Process notification
            result = await self._deliver_notification(message)
            
            # Record success metrics
            self.metrics.record_notification_sent(
                channel=message.channel,
                template=message.template.name,
                success=result.get('success', False)
            )
            
        except Exception as e:
            # Record failure metrics
            self.metrics.record_notification_sent(
                channel=message.channel,
                template=message.template.name,
                success=False
            )
            raise
        
        finally:
            # Record processing time
            duration = time.time() - start_time
            self.metrics.record_processing_time(
                channel=message.channel,
                stage='delivery',
                duration=duration
            )
```

### Health Checks
```python
from django.http import JsonResponse
from django.views import View
import asyncio

class HealthCheckView(View):
    async def get(self, request):
        health_status = {
            'status': 'healthy',
            'timestamp': timezone.now().isoformat(),
            'checks': {}
        }
        
        # Check database connectivity
        try:
            await NotificationMessage.objects.acount()
            health_status['checks']['database'] = {'status': 'healthy'}
        except Exception as e:
            health_status['checks']['database'] = {
                'status': 'unhealthy',
                'error': str(e)
            }
        
        # Check Redis connectivity
        try:
            redis_client = get_redis_client()
            await redis_client.ping()
            health_status['checks']['redis'] = {'status': 'healthy'}
        except Exception as e:
            health_status['checks']['redis'] = {
                'status': 'unhealthy',
                'error': str(e)
            }
        
        # Check external services
        health_status['checks']['external_services'] = await self._check_external_services()
        
        # Check queue sizes
        health_status['checks']['queues'] = await self._check_queue_health()
        
        # Determine overall status
        all_healthy = all(
            check['status'] == 'healthy' 
            for check in health_status['checks'].values()
            if isinstance(check, dict)
        )
        
        health_status['status'] = 'healthy' if all_healthy else 'degraded'
        
        status_code = 200 if all_healthy else 503
        return JsonResponse(health_status, status=status_code)
    
    async def _check_external_services(self):
        services = {}
        
        # Check FCM
        try:
            # Mock health check for FCM
            services['fcm'] = {'status': 'healthy'}
        except Exception as e:
            services['fcm'] = {'status': 'unhealthy', 'error': str(e)}
        
        # Check AWS SES
        try:
            # Mock health check for SES
            services['ses'] = {'status': 'healthy'}
        except Exception as e:
            services['ses'] = {'status': 'unhealthy', 'error': str(e)}
        
        # Check Twilio
        try:
            # Mock health check for Twilio
            services['twilio'] = {'status': 'healthy'}
        except Exception as e:
            services['twilio'] = {'status': 'unhealthy', 'error': str(e)}
        
        return services
    
    async def _check_queue_health(self):
        redis_client = get_redis_client()
        
        try:
            queue_size = await redis_client.zcard('notification_priority_queue')
            dead_letter_size = await redis_client.llen('notification_dead_letter_queue')
            
            return {
                'status': 'healthy',
                'priority_queue_size': queue_size,
                'dead_letter_queue_size': dead_letter_size,
                'queue_healthy': queue_size < 10000,  # Alert if queue too large
                'dead_letter_healthy': dead_letter_size < 100
            }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e)
            }
```

---

## 🎯 Learning Milestones & CS Concepts

### Week 1 Milestones
- [ ] **Priority Queue Mastery**: Understand heap data structure and priority-based message processing
- [ ] **Template Engine Design**: Learn parsing, compilation, and rendering patterns with Jinja2
- [ ] **Multi-Channel Architecture**: Design abstraction layers for different notification providers

### Week 2 Milestones
- [ ] **Reliability Patterns**: Master exponential backoff, circuit breakers, and dead letter queues
- [ ] **User Preference Systems**: Implement complex preference hierarchies and inheritance
- [ ] **Real-time Communication**: Understand WebSocket management and connection pooling

### Week 3 Milestones
- [ ] **Statistical Analysis**: Apply A/B testing with statistical significance calculations
- [ ] **Batch Processing**: Optimize throughput with batching and concurrent processing
- [ ] **Compliance Engineering**: Implement GDPR controls and audit logging

### Computer Science Concepts Applied

**Data Structures**:
- Priority Heaps: Message queue ordering by priority and timestamp
- Hash Tables: Template caching, user preference lookup, rate limiting
- Tries: Efficient template path matching with wildcard support
- LRU Cache: Rendered template caching for performance

**Algorithms**:
- Graph Traversal: Template dependency resolution and inheritance
- String Matching: Efficient template variable extraction and substitution
- Statistical Analysis: A/B test significance testing and confidence intervals
- Rate Limiting: Token bucket and sliding window algorithms

**Distributed Systems**:
- Message Queues: Reliable message delivery with ordering guarantees
- Circuit Breakers: Failure isolation and cascade prevention
- Eventual Consistency: Analytics data aggregation across distributed components
- Idempotency: Safe retry mechanisms for notification delivery

**Security & Compliance**:
- Data Encryption: PII protection in notification content and logs
- Audit Logging: Comprehensive activity tracking for compliance
- Rate Limiting: Abuse prevention and fair usage enforcement
- Access Control: Permission-based notification sending and management

---

## ✅ Completion Checklist

### Core Functionality
- [ ] Multi-channel notification delivery (Push, Email, SMS, WebSocket)
- [ ] Priority queue message processing with Redis
- [ ] Template engine with personalization and localization
- [ ] User preference management with GDPR compliance
- [ ] Retry logic with exponential backoff and dead letter queues
- [ ] Real-time WebSocket notifications with presence tracking
- [ ] Comprehensive analytics and delivery tracking

### Advanced Features
- [ ] A/B testing framework for notification optimization
- [ ] Batch processing and campaign management
- [ ] Circuit breakers for external service reliability
- [ ] Template caching and performance optimization
- [ ] Audit logging and security controls
- [ ] Notification scheduling and timezone handling
- [ ] Digest and summary notifications

### Performance & Scale
- [ ] Achieve 10k+ messages per second throughput
- [ ] Template rendering under 50ms p99
- [ ] WebSocket latency under 100ms
- [ ] Queue processing delay under 5 seconds
- [ ] Memory usage optimized with connection pooling

### Security & Compliance
- [ ] API security with authentication and rate limiting
- [ ] PII encryption and data protection
- [ ] GDPR compliance with data export and deletion
- [ ] Comprehensive audit trail and logging
- [ ] Secure external service integrations

### Monitoring & Operations
- [ ] Comprehensive Prometheus metrics collection
- [ ] Health checks for all dependencies and external services
- [ ] Performance monitoring and alerting
- [ ] Analytics dashboards for delivery metrics
- [ ] Dead letter queue monitoring and alerts

### Documentation & Testing
- [ ] OpenAPI specification with all endpoints
- [ ] Unit test coverage >90%
- [ ] Integration tests for all channels
- [ ] Load tests validating performance requirements
- [ ] Security testing and penetration testing

**Next Service**: Move to `services/admin/TODO.md` for administrative dashboard and management tools.

---

*This Notifications Service enables reliable, scalable, and personalized communication across the entire Suuupra platform. Master these messaging patterns and reliability techniques before proceeding to administrative services.*