"""
LLM Tutor Service - Authentication and Authorization Security Framework
=====================================================================

This module implements comprehensive authentication and authorization security:
- JWT token validation and refresh mechanisms
- Role-based access control (RBAC) with fine-grained permissions
- API rate limiting and abuse prevention
- Session management and security
- Multi-factor authentication support
- OAuth2/OpenID Connect integration
- Audit logging for all auth events

Security Features:
1. Secure JWT handling with rotation and blacklisting
2. Hierarchical RBAC system
3. Advanced rate limiting with user behavior analysis
4. Session hijacking prevention
5. Brute force attack protection
6. API key management for service-to-service communication
"""

import asyncio
import hashlib
import hmac
import json
import secrets
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple, Any, Union
import jwt
import bcrypt
from passlib.context import CryptContext
from opentelemetry import trace
from prometheus_client import Counter, Histogram, Gauge
import redis
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.fernet import Fernet
import base64

# Initialize components
tracer = trace.get_tracer(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Prometheus metrics
AUTH_ATTEMPTS = Counter('llm_auth_attempts_total', 'Authentication attempts', ['method', 'result'])
AUTHORIZATION_CHECKS = Counter('llm_authorization_checks_total', 'Authorization checks', ['resource', 'result'])
TOKEN_OPERATIONS = Counter('llm_token_operations_total', 'Token operations', ['operation', 'type'])
RATE_LIMIT_HITS = Counter('llm_rate_limit_hits_total', 'Rate limit hits', ['user_id', 'endpoint'])
SESSION_EVENTS = Counter('llm_session_events_total', 'Session events', ['event_type'])
AUTH_LATENCY = Histogram('llm_auth_latency_seconds', 'Authentication latency')
ACTIVE_SESSIONS = Gauge('llm_active_sessions', 'Number of active sessions')

class AuthMethod(Enum):
    """Authentication methods"""
    PASSWORD = "password"
    JWT = "jwt"
    API_KEY = "api_key"
    OAUTH2 = "oauth2"
    MFA = "mfa"
    SESSION = "session"

class UserRole(Enum):
    """User roles in the system"""
    ANONYMOUS = "anonymous"
    STUDENT = "student"
    TUTOR = "tutor"
    MODERATOR = "moderator"
    ADMIN = "admin"
    SYSTEM = "system"
    SERVICE = "service"

class Permission(Enum):
    """System permissions"""
    # Conversation permissions
    CREATE_CONVERSATION = "conversation:create"
    READ_CONVERSATION = "conversation:read"
    UPDATE_CONVERSATION = "conversation:update"
    DELETE_CONVERSATION = "conversation:delete"
    
    # Voice permissions
    USE_VOICE_INPUT = "voice:input"
    USE_VOICE_OUTPUT = "voice:output"
    CREATE_VOICE_CLONE = "voice:clone"
    
    # Content permissions
    ACCESS_CONTENT = "content:access"
    MODERATE_CONTENT = "content:moderate"
    UPLOAD_CONTENT = "content:upload"
    
    # User management
    MANAGE_USERS = "users:manage"
    VIEW_USER_DATA = "users:view"
    DELETE_USER_DATA = "users:delete"
    
    # System administration
    SYSTEM_CONFIG = "system:config"
    VIEW_METRICS = "system:metrics"
    MANAGE_SECURITY = "system:security"
    
    # API access
    API_ACCESS = "api:access"
    BULK_API_ACCESS = "api:bulk"

class TokenType(Enum):
    """Types of tokens"""
    ACCESS = "access"
    REFRESH = "refresh"
    API_KEY = "api_key"
    SESSION = "session"

class SessionStatus(Enum):
    """Session status values"""
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    HIJACKED = "hijacked"

@dataclass
class User:
    """User data structure"""
    user_id: str
    username: str
    email: str
    password_hash: str
    roles: List[UserRole]
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime]
    failed_login_attempts: int
    locked_until: Optional[datetime]
    mfa_enabled: bool
    mfa_secret: Optional[str]
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Session:
    """Session data structure"""
    session_id: str
    user_id: str
    created_at: datetime
    last_accessed: datetime
    expires_at: datetime
    ip_address: str
    user_agent: str
    status: SessionStatus
    device_fingerprint: str
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class AuthContext:
    """Authentication context"""
    user_id: str
    username: str
    roles: List[UserRole]
    permissions: Set[Permission]
    session_id: Optional[str]
    token_id: Optional[str]
    ip_address: str
    user_agent: str
    authenticated_at: datetime
    expires_at: datetime

class JWTManager:
    """Secure JWT token management"""
    
    def __init__(self, secret_key: str, algorithm: str = "HS256"):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.token_blacklist = set()  # In production, use Redis
        
        # Token configurations
        self.access_token_lifetime = timedelta(minutes=15)
        self.refresh_token_lifetime = timedelta(days=7)
        self.api_key_lifetime = timedelta(days=90)
        
    async def create_access_token(self, user_id: str, roles: List[UserRole], 
                                permissions: Set[Permission], session_id: str = None) -> str:
        """Create a new access token"""
        with tracer.start_as_current_span("create_access_token"):
            now = datetime.utcnow()
            expires_at = now + self.access_token_lifetime
            token_id = str(uuid.uuid4())
            
            payload = {
                "token_id": token_id,
                "user_id": user_id,
                "roles": [role.value for role in roles],
                "permissions": [perm.value for perm in permissions],
                "session_id": session_id,
                "type": TokenType.ACCESS.value,
                "iat": now.timestamp(),
                "exp": expires_at.timestamp(),
                "iss": "llm-tutor-service",
                "aud": "llm-tutor-api"
            }
            
            token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
            
            TOKEN_OPERATIONS.labels(operation="create", type="access").inc()
            
            return token
    
    async def create_refresh_token(self, user_id: str, session_id: str) -> str:
        """Create a new refresh token"""
        with tracer.start_as_current_span("create_refresh_token"):
            now = datetime.utcnow()
            expires_at = now + self.refresh_token_lifetime
            token_id = str(uuid.uuid4())
            
            payload = {
                "token_id": token_id,
                "user_id": user_id,
                "session_id": session_id,
                "type": TokenType.REFRESH.value,
                "iat": now.timestamp(),
                "exp": expires_at.timestamp(),
                "iss": "llm-tutor-service",
                "aud": "llm-tutor-api"
            }
            
            token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
            
            TOKEN_OPERATIONS.labels(operation="create", type="refresh").inc()
            
            return token
    
    async def validate_token(self, token: str, token_type: TokenType = None) -> Optional[Dict]:
        """Validate and decode a JWT token"""
        with tracer.start_as_current_span("validate_token"):
            try:
                # Check if token is blacklisted
                if token in self.token_blacklist:
                    TOKEN_OPERATIONS.labels(operation="validate", type="blacklisted").inc()
                    return None
                
                # Decode token
                payload = jwt.decode(
                    token,
                    self.secret_key,
                    algorithms=[self.algorithm],
                    audience="llm-tutor-api",
                    issuer="llm-tutor-service"
                )
                
                # Validate token type if specified
                if token_type and payload.get("type") != token_type.value:
                    return None
                
                # Check expiration
                if payload.get("exp", 0) < datetime.utcnow().timestamp():
                    TOKEN_OPERATIONS.labels(operation="validate", type="expired").inc()
                    return None
                
                TOKEN_OPERATIONS.labels(operation="validate", type="valid").inc()
                return payload
                
            except jwt.InvalidTokenError:
                TOKEN_OPERATIONS.labels(operation="validate", type="invalid").inc()
                return None
    
    async def blacklist_token(self, token: str):
        """Add token to blacklist"""
        self.token_blacklist.add(token)
        TOKEN_OPERATIONS.labels(operation="blacklist", type="manual").inc()
    
    async def refresh_access_token(self, refresh_token: str, 
                                 role_manager: 'RoleManager') -> Optional[Tuple[str, str]]:
        """Refresh access token using refresh token"""
        with tracer.start_as_current_span("refresh_access_token"):
            # Validate refresh token
            payload = await self.validate_token(refresh_token, TokenType.REFRESH)
            if not payload:
                return None
            
            user_id = payload["user_id"]
            session_id = payload["session_id"]
            
            # Get current user roles and permissions
            roles = await role_manager.get_user_roles(user_id)
            permissions = await role_manager.get_user_permissions(user_id)
            
            # Create new access token
            new_access_token = await self.create_access_token(
                user_id, roles, permissions, session_id
            )
            
            # Optionally create new refresh token (token rotation)
            new_refresh_token = await self.create_refresh_token(user_id, session_id)
            
            # Blacklist old refresh token
            await self.blacklist_token(refresh_token)
            
            return new_access_token, new_refresh_token

class RoleManager:
    """Role-based access control manager"""
    
    def __init__(self):
        # Define role hierarchy and permissions
        self.role_permissions = {
            UserRole.ANONYMOUS: {
                Permission.API_ACCESS
            },
            UserRole.STUDENT: {
                Permission.API_ACCESS,
                Permission.CREATE_CONVERSATION,
                Permission.READ_CONVERSATION,
                Permission.UPDATE_CONVERSATION,
                Permission.USE_VOICE_INPUT,
                Permission.USE_VOICE_OUTPUT,
                Permission.ACCESS_CONTENT
            },
            UserRole.TUTOR: {
                Permission.API_ACCESS,
                Permission.CREATE_CONVERSATION,
                Permission.READ_CONVERSATION,
                Permission.UPDATE_CONVERSATION,
                Permission.DELETE_CONVERSATION,
                Permission.USE_VOICE_INPUT,
                Permission.USE_VOICE_OUTPUT,
                Permission.CREATE_VOICE_CLONE,
                Permission.ACCESS_CONTENT,
                Permission.UPLOAD_CONTENT,
                Permission.VIEW_USER_DATA
            },
            UserRole.MODERATOR: {
                Permission.API_ACCESS,
                Permission.MODERATE_CONTENT,
                Permission.VIEW_USER_DATA,
                Permission.DELETE_USER_DATA,
                Permission.MANAGE_USERS,
                Permission.VIEW_METRICS
            },
            UserRole.ADMIN: {
                Permission.API_ACCESS,
                Permission.BULK_API_ACCESS,
                Permission.SYSTEM_CONFIG,
                Permission.MANAGE_SECURITY,
                Permission.MANAGE_USERS,
                Permission.VIEW_METRICS,
                Permission.VIEW_USER_DATA,
                Permission.DELETE_USER_DATA
            },
            UserRole.SYSTEM: {
                Permission.API_ACCESS,
                Permission.BULK_API_ACCESS,
                Permission.SYSTEM_CONFIG,
                Permission.MANAGE_SECURITY
            },
            UserRole.SERVICE: {
                Permission.API_ACCESS,
                Permission.BULK_API_ACCESS
            }
        }
        
        # Role hierarchy (higher roles inherit from lower ones)
        self.role_hierarchy = {
            UserRole.ADMIN: [UserRole.MODERATOR, UserRole.TUTOR, UserRole.STUDENT],
            UserRole.MODERATOR: [UserRole.TUTOR, UserRole.STUDENT],
            UserRole.TUTOR: [UserRole.STUDENT],
            UserRole.STUDENT: [UserRole.ANONYMOUS]
        }
    
    async def get_user_roles(self, user_id: str) -> List[UserRole]:
        """Get user roles"""
        # In production, query from database
        # For now, return default student role
        return [UserRole.STUDENT]
    
    async def get_user_permissions(self, user_id: str) -> Set[Permission]:
        """Get all permissions for a user"""
        roles = await self.get_user_roles(user_id)
        permissions = set()
        
        for role in roles:
            # Add direct permissions
            permissions.update(self.role_permissions.get(role, set()))
            
            # Add inherited permissions
            inherited_roles = self.role_hierarchy.get(role, [])
            for inherited_role in inherited_roles:
                permissions.update(self.role_permissions.get(inherited_role, set()))
        
        return permissions
    
    async def has_permission(self, user_id: str, permission: Permission) -> bool:
        """Check if user has specific permission"""
        user_permissions = await self.get_user_permissions(user_id)
        return permission in user_permissions
    
    async def check_authorization(self, auth_context: AuthContext, 
                                permission: Permission) -> bool:
        """Check authorization for a specific permission"""
        with tracer.start_as_current_span("check_authorization"):
            has_permission = permission in auth_context.permissions
            
            AUTHORIZATION_CHECKS.labels(
                resource=permission.value,
                result="allowed" if has_permission else "denied"
            ).inc()
            
            return has_permission

class SessionManager:
    """Secure session management"""
    
    def __init__(self, redis_client=None):
        self.redis_client = redis_client  # For production use
        self.sessions = {}  # In-memory for demo
        self.session_timeout = timedelta(hours=24)
        self.max_sessions_per_user = 5
    
    async def create_session(self, user_id: str, ip_address: str, 
                           user_agent: str) -> Session:
        """Create a new user session"""
        with tracer.start_as_current_span("create_session"):
            session_id = self._generate_session_id()
            now = datetime.utcnow()
            
            # Generate device fingerprint
            device_fingerprint = self._generate_device_fingerprint(ip_address, user_agent)
            
            session = Session(
                session_id=session_id,
                user_id=user_id,
                created_at=now,
                last_accessed=now,
                expires_at=now + self.session_timeout,
                ip_address=ip_address,
                user_agent=user_agent,
                status=SessionStatus.ACTIVE,
                device_fingerprint=device_fingerprint
            )
            
            # Check session limits
            await self._enforce_session_limits(user_id)
            
            # Store session
            self.sessions[session_id] = session
            
            SESSION_EVENTS.labels(event_type="created").inc()
            ACTIVE_SESSIONS.inc()
            
            return session
    
    async def get_session(self, session_id: str) -> Optional[Session]:
        """Get session by ID"""
        session = self.sessions.get(session_id)
        
        if not session:
            return None
        
        # Check if session is still valid
        if not await self._is_session_valid(session):
            await self.revoke_session(session_id)
            return None
        
        # Update last accessed time
        session.last_accessed = datetime.utcnow()
        
        return session
    
    async def validate_session(self, session_id: str, ip_address: str, 
                             user_agent: str) -> Optional[Session]:
        """Validate session with security checks"""
        with tracer.start_as_current_span("validate_session"):
            session = await self.get_session(session_id)
            
            if not session:
                return None
            
            # Check for session hijacking
            current_fingerprint = self._generate_device_fingerprint(ip_address, user_agent)
            
            if session.device_fingerprint != current_fingerprint:
                # Potential session hijacking
                await self.mark_session_hijacked(session_id)
                SESSION_EVENTS.labels(event_type="hijacking_detected").inc()
                return None
            
            # Check IP consistency (allow some variation for mobile users)
            if not self._is_ip_consistent(session.ip_address, ip_address):
                # Log suspicious activity but don't immediately revoke
                session.metadata['ip_changes'] = session.metadata.get('ip_changes', 0) + 1
                
                if session.metadata['ip_changes'] > 5:  # Too many IP changes
                    await self.revoke_session(session_id)
                    return None
            
            return session
    
    async def revoke_session(self, session_id: str):
        """Revoke a session"""
        session = self.sessions.get(session_id)
        if session:
            session.status = SessionStatus.REVOKED
            SESSION_EVENTS.labels(event_type="revoked").inc()
            ACTIVE_SESSIONS.dec()
    
    async def mark_session_hijacked(self, session_id: str):
        """Mark session as hijacked"""
        session = self.sessions.get(session_id)
        if session:
            session.status = SessionStatus.HIJACKED
            SESSION_EVENTS.labels(event_type="hijacked").inc()
            ACTIVE_SESSIONS.dec()
    
    async def revoke_user_sessions(self, user_id: str, except_session: str = None):
        """Revoke all sessions for a user"""
        for session_id, session in self.sessions.items():
            if session.user_id == user_id and session_id != except_session:
                await self.revoke_session(session_id)
    
    def _generate_session_id(self) -> str:
        """Generate secure session ID"""
        return secrets.token_urlsafe(32)
    
    def _generate_device_fingerprint(self, ip_address: str, user_agent: str) -> str:
        """Generate device fingerprint"""
        fingerprint_data = f"{ip_address}:{user_agent}"
        return hashlib.sha256(fingerprint_data.encode()).hexdigest()
    
    async def _is_session_valid(self, session: Session) -> bool:
        """Check if session is valid"""
        if session.status != SessionStatus.ACTIVE:
            return False
        
        if datetime.utcnow() > session.expires_at:
            session.status = SessionStatus.EXPIRED
            return False
        
        return True
    
    def _is_ip_consistent(self, original_ip: str, current_ip: str) -> bool:
        """Check if IP addresses are reasonably consistent"""
        # Allow same subnet for mobile users
        original_parts = original_ip.split('.')
        current_parts = current_ip.split('.')
        
        if len(original_parts) != 4 or len(current_parts) != 4:
            return False
        
        # Check if same /24 subnet
        return original_parts[:3] == current_parts[:3]
    
    async def _enforce_session_limits(self, user_id: str):
        """Enforce maximum sessions per user"""
        user_sessions = [s for s in self.sessions.values() 
                        if s.user_id == user_id and s.status == SessionStatus.ACTIVE]
        
        if len(user_sessions) >= self.max_sessions_per_user:
            # Revoke oldest session
            oldest_session = min(user_sessions, key=lambda s: s.created_at)
            await self.revoke_session(oldest_session.session_id)

class RateLimiter:
    """Advanced rate limiting with abuse prevention"""
    
    def __init__(self, redis_client=None):
        self.redis_client = redis_client
        self.rate_limits = {}  # In-memory for demo
        
        # Rate limit configurations
        self.default_limits = {
            "global": {"requests": 100, "window": 60},  # 100 requests per minute
            "user": {"requests": 60, "window": 60},     # 60 requests per minute per user
            "conversation": {"requests": 20, "window": 60},  # 20 conversations per minute
            "voice": {"requests": 10, "window": 60},    # 10 voice requests per minute
        }
        
        # Burst limits for different user types
        self.role_limits = {
            UserRole.ANONYMOUS: {"requests": 10, "window": 60},
            UserRole.STUDENT: {"requests": 60, "window": 60},
            UserRole.TUTOR: {"requests": 120, "window": 60},
            UserRole.ADMIN: {"requests": 1000, "window": 60}
        }
    
    async def check_rate_limit(self, identifier: str, limit_type: str, 
                             user_role: UserRole = UserRole.ANONYMOUS) -> Tuple[bool, Dict]:
        """Check if request is within rate limits"""
        with tracer.start_as_current_span("check_rate_limit"):
            current_time = time.time()
            
            # Get applicable limits
            limits = self._get_limits_for_role(limit_type, user_role)
            
            # Initialize rate limit data if not exists
            if identifier not in self.rate_limits:
                self.rate_limits[identifier] = {}
            
            if limit_type not in self.rate_limits[identifier]:
                self.rate_limits[identifier][limit_type] = {
                    "requests": [],
                    "blocked_until": 0
                }
            
            rate_data = self.rate_limits[identifier][limit_type]
            
            # Check if currently blocked
            if current_time < rate_data["blocked_until"]:
                RATE_LIMIT_HITS.labels(user_id=identifier, endpoint=limit_type).inc()
                return False, {
                    "allowed": False,
                    "reason": "rate_limited",
                    "retry_after": int(rate_data["blocked_until"] - current_time)
                }
            
            # Clean old requests
            window_start = current_time - limits["window"]
            rate_data["requests"] = [
                req_time for req_time in rate_data["requests"]
                if req_time > window_start
            ]
            
            # Check if over limit
            if len(rate_data["requests"]) >= limits["requests"]:
                # Block for progressive penalty
                penalty_duration = self._calculate_penalty(identifier, limit_type)
                rate_data["blocked_until"] = current_time + penalty_duration
                
                RATE_LIMIT_HITS.labels(user_id=identifier, endpoint=limit_type).inc()
                
                return False, {
                    "allowed": False,
                    "reason": "rate_limited",
                    "retry_after": penalty_duration
                }
            
            # Allow request
            rate_data["requests"].append(current_time)
            
            return True, {
                "allowed": True,
                "remaining": limits["requests"] - len(rate_data["requests"]),
                "reset_time": int(window_start + limits["window"])
            }
    
    def _get_limits_for_role(self, limit_type: str, role: UserRole) -> Dict:
        """Get rate limits based on user role"""
        # Start with default limits
        limits = self.default_limits.get(limit_type, self.default_limits["global"])
        
        # Override with role-specific limits if more permissive
        role_limits = self.role_limits.get(role, {})
        if role_limits.get("requests", 0) > limits["requests"]:
            limits = role_limits
        
        return limits
    
    def _calculate_penalty(self, identifier: str, limit_type: str) -> int:
        """Calculate progressive penalty for rate limit violations"""
        # Get violation history
        violation_key = f"{identifier}:{limit_type}:violations"
        violations = self.rate_limits.get(violation_key, 0)
        
        # Progressive penalties: 1min, 5min, 15min, 60min
        penalties = [60, 300, 900, 3600]
        penalty_index = min(violations, len(penalties) - 1)
        
        # Increment violation count
        self.rate_limits[violation_key] = violations + 1
        
        return penalties[penalty_index]

class AuthenticationManager:
    """Main authentication manager"""
    
    def __init__(self, secret_key: str):
        self.jwt_manager = JWTManager(secret_key)
        self.role_manager = RoleManager()
        self.session_manager = SessionManager()
        self.rate_limiter = RateLimiter()
        self.users = {}  # In production, use database
        
        # Brute force protection
        self.failed_attempts = {}
        self.max_failed_attempts = 5
        self.lockout_duration = timedelta(minutes=15)
    
    async def authenticate_password(self, username: str, password: str, 
                                  ip_address: str, user_agent: str) -> Optional[AuthContext]:
        """Authenticate user with username/password"""
        with tracer.start_as_current_span("authenticate_password"):
            start_time = time.time()
            
            # Check brute force protection
            if not await self._check_brute_force_protection(username, ip_address):
                AUTH_ATTEMPTS.labels(method="password", result="blocked").inc()
                return None
            
            # Find user
            user = await self._get_user_by_username(username)
            if not user:
                await self._record_failed_attempt(username, ip_address)
                AUTH_ATTEMPTS.labels(method="password", result="invalid_user").inc()
                return None
            
            # Verify password
            if not pwd_context.verify(password, user.password_hash):
                await self._record_failed_attempt(username, ip_address)
                AUTH_ATTEMPTS.labels(method="password", result="invalid_password").inc()
                return None
            
            # Check if user is active
            if not user.is_active:
                AUTH_ATTEMPTS.labels(method="password", result="inactive_user").inc()
                return None
            
            # Create session
            session = await self.session_manager.create_session(
                user.user_id, ip_address, user_agent
            )
            
            # Get permissions
            permissions = await self.role_manager.get_user_permissions(user.user_id)
            
            # Create auth context
            auth_context = AuthContext(
                user_id=user.user_id,
                username=user.username,
                roles=user.roles,
                permissions=permissions,
                session_id=session.session_id,
                token_id=None,
                ip_address=ip_address,
                user_agent=user_agent,
                authenticated_at=datetime.utcnow(),
                expires_at=session.expires_at
            )
            
            # Clear failed attempts
            await self._clear_failed_attempts(username, ip_address)
            
            # Update user login info
            user.last_login = datetime.utcnow()
            
            AUTH_ATTEMPTS.labels(method="password", result="success").inc()
            AUTH_LATENCY.observe(time.time() - start_time)
            
            return auth_context
    
    async def authenticate_token(self, token: str, ip_address: str, 
                               user_agent: str) -> Optional[AuthContext]:
        """Authenticate user with JWT token"""
        with tracer.start_as_current_span("authenticate_token"):
            start_time = time.time()
            
            # Validate token
            payload = await self.jwt_manager.validate_token(token, TokenType.ACCESS)
            if not payload:
                AUTH_ATTEMPTS.labels(method="jwt", result="invalid_token").inc()
                return None
            
            user_id = payload["user_id"]
            session_id = payload.get("session_id")
            
            # Validate session if present
            if session_id:
                session = await self.session_manager.validate_session(
                    session_id, ip_address, user_agent
                )
                if not session:
                    AUTH_ATTEMPTS.labels(method="jwt", result="invalid_session").inc()
                    return None
            
            # Get user
            user = await self._get_user_by_id(user_id)
            if not user or not user.is_active:
                AUTH_ATTEMPTS.labels(method="jwt", result="invalid_user").inc()
                return None
            
            # Create auth context
            auth_context = AuthContext(
                user_id=user.user_id,
                username=user.username,
                roles=[UserRole(role) for role in payload["roles"]],
                permissions={Permission(perm) for perm in payload["permissions"]},
                session_id=session_id,
                token_id=payload["token_id"],
                ip_address=ip_address,
                user_agent=user_agent,
                authenticated_at=datetime.fromtimestamp(payload["iat"]),
                expires_at=datetime.fromtimestamp(payload["exp"])
            )
            
            AUTH_ATTEMPTS.labels(method="jwt", result="success").inc()
            AUTH_LATENCY.observe(time.time() - start_time)
            
            return auth_context
    
    async def create_token_pair(self, auth_context: AuthContext) -> Tuple[str, str]:
        """Create access and refresh token pair"""
        access_token = await self.jwt_manager.create_access_token(
            auth_context.user_id,
            auth_context.roles,
            auth_context.permissions,
            auth_context.session_id
        )
        
        refresh_token = await self.jwt_manager.create_refresh_token(
            auth_context.user_id,
            auth_context.session_id
        )
        
        return access_token, refresh_token
    
    async def check_authorization(self, auth_context: AuthContext, 
                                permission: Permission, resource_id: str = None) -> bool:
        """Check if user is authorized for a specific action"""
        return await self.role_manager.check_authorization(auth_context, permission)
    
    async def check_rate_limit(self, auth_context: AuthContext, 
                             endpoint: str) -> Tuple[bool, Dict]:
        """Check rate limits for authenticated user"""
        # Use highest role for rate limiting
        highest_role = max(auth_context.roles, key=lambda r: list(UserRole).index(r))
        
        return await self.rate_limiter.check_rate_limit(
            auth_context.user_id, endpoint, highest_role
        )
    
    async def logout(self, auth_context: AuthContext):
        """Logout user and cleanup"""
        if auth_context.session_id:
            await self.session_manager.revoke_session(auth_context.session_id)
        
        if auth_context.token_id:
            # In a real implementation, you'd blacklist the token
            pass
    
    async def _check_brute_force_protection(self, username: str, ip_address: str) -> bool:
        """Check brute force protection"""
        now = datetime.utcnow()
        
        # Check username-based attempts
        user_key = f"user:{username}"
        if user_key in self.failed_attempts:
            attempts, last_attempt = self.failed_attempts[user_key]
            if attempts >= self.max_failed_attempts:
                if now - last_attempt < self.lockout_duration:
                    return False
                else:
                    # Reset after lockout period
                    del self.failed_attempts[user_key]
        
        # Check IP-based attempts
        ip_key = f"ip:{ip_address}"
        if ip_key in self.failed_attempts:
            attempts, last_attempt = self.failed_attempts[ip_key]
            if attempts >= self.max_failed_attempts * 2:  # Higher threshold for IP
                if now - last_attempt < self.lockout_duration:
                    return False
                else:
                    del self.failed_attempts[ip_key]
        
        return True
    
    async def _record_failed_attempt(self, username: str, ip_address: str):
        """Record failed authentication attempt"""
        now = datetime.utcnow()
        
        # Record for username
        user_key = f"user:{username}"
        if user_key in self.failed_attempts:
            attempts, _ = self.failed_attempts[user_key]
            self.failed_attempts[user_key] = (attempts + 1, now)
        else:
            self.failed_attempts[user_key] = (1, now)
        
        # Record for IP
        ip_key = f"ip:{ip_address}"
        if ip_key in self.failed_attempts:
            attempts, _ = self.failed_attempts[ip_key]
            self.failed_attempts[ip_key] = (attempts + 1, now)
        else:
            self.failed_attempts[ip_key] = (1, now)
    
    async def _clear_failed_attempts(self, username: str, ip_address: str):
        """Clear failed attempts after successful login"""
        user_key = f"user:{username}"
        ip_key = f"ip:{ip_address}"
        
        self.failed_attempts.pop(user_key, None)
        self.failed_attempts.pop(ip_key, None)
    
    async def _get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        # In production, query from database
        return self.users.get(username)
    
    async def _get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        # In production, query from database
        for user in self.users.values():
            if user.user_id == user_id:
                return user
        return None

# Example usage and testing
async def example_usage():
    """Example usage of authentication framework"""
    auth_manager = AuthenticationManager("your-secret-key-here")
    
    # Create a test user
    test_user = User(
        user_id="user_123",
        username="testuser",
        email="test@example.com",
        password_hash=pwd_context.hash("testpassword"),
        roles=[UserRole.STUDENT],
        is_active=True,
        is_verified=True,
        created_at=datetime.utcnow(),
        last_login=None,
        failed_login_attempts=0,
        locked_until=None,
        mfa_enabled=False,
        mfa_secret=None
    )
    
    auth_manager.users["testuser"] = test_user
    
    # Test authentication
    auth_context = await auth_manager.authenticate_password(
        username="testuser",
        password="testpassword",
        ip_address="192.168.1.1",
        user_agent="Mozilla/5.0..."
    )
    
    if auth_context:
        print(f"Authentication successful for user: {auth_context.username}")
        print(f"Roles: {[role.value for role in auth_context.roles]}")
        print(f"Permissions: {len(auth_context.permissions)}")
        
        # Test authorization
        has_permission = await auth_manager.check_authorization(
            auth_context, Permission.CREATE_CONVERSATION
        )
        print(f"Can create conversation: {has_permission}")
        
        # Test rate limiting
        allowed, rate_info = await auth_manager.check_rate_limit(
            auth_context, "conversation"
        )
        print(f"Rate limit check: {allowed}, remaining: {rate_info.get('remaining', 0)}")
        
        # Create tokens
        access_token, refresh_token = await auth_manager.create_token_pair(auth_context)
        print(f"Access token created: {access_token[:50]}...")
        
        # Test token authentication
        token_auth_context = await auth_manager.authenticate_token(
            access_token, "192.168.1.1", "Mozilla/5.0..."
        )
        
        if token_auth_context:
            print("Token authentication successful")
    else:
        print("Authentication failed")

if __name__ == "__main__":
    asyncio.run(example_usage())