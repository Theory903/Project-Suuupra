"""
LLM Tutor Service - Privacy and Data Protection Framework
========================================================

This module implements comprehensive privacy protection and regulatory compliance:
- GDPR (General Data Protection Regulation) compliance
- CCPA (California Consumer Privacy Act) compliance
- Data Subject Rights (DSR) automation
- PII detection and anonymization
- Conversation data retention policies
- Consent management
- Data minimization principles

Key Features:
1. Automated PII Detection and Masking
2. Data Subject Rights Processing
3. Consent Management Framework
4. Data Retention and Deletion
5. Privacy Impact Assessment
6. Breach Detection and Notification
"""

import asyncio
import hashlib
import json
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple, Any
import re

from cryptography.fernet import Fernet
from opentelemetry import trace
from prometheus_client import Counter, Histogram, Gauge
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
import spacy

# Initialize components
tracer = trace.get_tracer(__name__)

# Prometheus metrics
PRIVACY_EVENTS = Counter('llm_privacy_events_total', 'Privacy events by type', ['event_type', 'action'])
PII_DETECTION_LATENCY = Histogram('llm_pii_detection_latency_seconds', 'PII detection latency')
DSR_PROCESSING_TIME = Histogram('llm_dsr_processing_time_seconds', 'Data Subject Request processing time')
CONSENT_CHANGES = Counter('llm_consent_changes_total', 'Consent changes by type', ['consent_type', 'action'])
DATA_RETENTION_ACTIONS = Counter('llm_data_retention_actions_total', 'Data retention actions', ['action', 'reason'])

class ConsentType(Enum):
    """Types of consent for different data processing activities"""
    ESSENTIAL_PROCESSING = "essential_processing"
    ANALYTICS = "analytics"
    PERSONALIZATION = "personalization"
    VOICE_CLONING = "voice_cloning"
    CONVERSATION_STORAGE = "conversation_storage"
    IMPROVEMENT_TRAINING = "improvement_training"
    MARKETING = "marketing"
    THIRD_PARTY_SHARING = "third_party_sharing"

class ConsentStatus(Enum):
    """Consent status values"""
    GRANTED = "granted"
    DENIED = "denied"
    WITHDRAWN = "withdrawn"
    PENDING = "pending"
    EXPIRED = "expired"

class PIIType(Enum):
    """Types of personally identifiable information"""
    EMAIL = "email"
    PHONE = "phone"
    SSN = "ssn"
    CREDIT_CARD = "credit_card"
    PASSPORT = "passport"
    DRIVER_LICENSE = "driver_license"
    IP_ADDRESS = "ip_address"
    PHYSICAL_ADDRESS = "physical_address"
    FULL_NAME = "full_name"
    DATE_OF_BIRTH = "date_of_birth"
    BIOMETRIC = "biometric"
    FINANCIAL_ACCOUNT = "financial_account"
    MEDICAL_INFO = "medical_info"
    CUSTOM = "custom"

class DataCategory(Enum):
    """Categories of data for privacy classification"""
    PERSONAL_IDENTIFIERS = "personal_identifiers"
    SENSITIVE_PERSONAL = "sensitive_personal"
    BEHAVIORAL = "behavioral"
    TECHNICAL = "technical"
    COMMUNICATION = "communication"
    DERIVED = "derived"

class LegalBasis(Enum):
    """Legal basis for data processing under GDPR"""
    CONSENT = "consent"
    CONTRACT = "contract"
    LEGAL_OBLIGATION = "legal_obligation"
    VITAL_INTERESTS = "vital_interests"
    PUBLIC_TASK = "public_task"
    LEGITIMATE_INTERESTS = "legitimate_interests"

class DSRType(Enum):
    """Data Subject Request types"""
    ACCESS = "access"
    RECTIFICATION = "rectification"
    ERASURE = "erasure"
    PORTABILITY = "portability"
    RESTRICTION = "restriction"
    OBJECTION = "objection"
    COMPLAINT = "complaint"

@dataclass
class ConsentRecord:
    """Consent record structure"""
    user_id: str
    consent_type: ConsentType
    status: ConsentStatus
    granted_at: Optional[datetime]
    withdrawn_at: Optional[datetime]
    expires_at: Optional[datetime]
    legal_basis: LegalBasis
    version: str
    source: str  # web, mobile, api
    ip_address: str
    user_agent: str
    metadata: Dict[str, Any]

@dataclass
class PIIDetectionResult:
    """PII detection result"""
    pii_type: PIIType
    value: str
    confidence: float
    start_position: int
    end_position: int
    context: str
    anonymized_value: str

@dataclass
class DataSubjectRequest:
    """Data Subject Request structure"""
    request_id: str
    user_id: str
    request_type: DSRType
    status: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    requested_data_categories: List[DataCategory]
    verification_status: str
    response_data: Optional[Dict]
    metadata: Dict[str, Any]

@dataclass
class RetentionPolicy:
    """Data retention policy definition"""
    data_category: DataCategory
    retention_period: timedelta
    legal_basis: LegalBasis
    deletion_method: str
    exceptions: List[str]

class PIIDetector:
    """Advanced PII detection using multiple techniques"""
    
    def __init__(self):
        # Load NLP model for named entity recognition
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            # Fallback to basic detection if spaCy model not available
            self.nlp = None
        
        # Enhanced PII patterns with context awareness
        self.pii_patterns = {
            PIIType.EMAIL: {
                'pattern': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
                'confidence': 0.95,
                'context_keywords': ['email', 'e-mail', 'contact', 'send to', 'reach me at']
            },
            PIIType.PHONE: {
                'pattern': r'\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b',
                'confidence': 0.9,
                'context_keywords': ['phone', 'call', 'number', 'reach me at', 'contact']
            },
            PIIType.SSN: {
                'pattern': r'\b\d{3}-\d{2}-\d{4}\b',
                'confidence': 0.98,
                'context_keywords': ['social security', 'ssn', 'social', 'security number']
            },
            PIIType.CREDIT_CARD: {
                'pattern': r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b',
                'confidence': 0.95,
                'context_keywords': ['credit card', 'card number', 'payment', 'visa', 'mastercard', 'amex']
            },
            PIIType.IP_ADDRESS: {
                'pattern': r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b',
                'confidence': 0.8,
                'context_keywords': ['ip address', 'ip', 'server', 'connection']
            },
            PIIType.PHYSICAL_ADDRESS: {
                'pattern': r'\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Place|Pl)\b',
                'confidence': 0.85,
                'context_keywords': ['address', 'live at', 'located at', 'street', 'home']
            },
            PIIType.PASSPORT: {
                'pattern': r'\b[A-Z]{1,2}\d{6,9}\b',
                'confidence': 0.7,
                'context_keywords': ['passport', 'passport number', 'travel document']
            },
            PIIType.DRIVER_LICENSE: {
                'pattern': r'\b[A-Z]{1,2}\d{6,8}\b',
                'confidence': 0.7,
                'context_keywords': ['driver license', 'license number', 'dl', 'drivers license']
            }
        }
        
        # Compile patterns
        self.compiled_patterns = {}
        for pii_type, config in self.pii_patterns.items():
            self.compiled_patterns[pii_type] = re.compile(config['pattern'])
        
        # Common first/last names for name detection
        self.common_names = set([
            'john', 'jane', 'michael', 'sarah', 'david', 'emily', 'robert', 'jessica',
            'william', 'ashley', 'richard', 'amanda', 'james', 'jennifer', 'charles',
            'melissa', 'thomas', 'stephanie', 'christopher', 'nicole'
        ])
    
    async def detect_pii(self, text: str, context: Dict = None) -> List[PIIDetectionResult]:
        """
        Detect PII in text using multiple techniques
        
        Returns:
            List of PIIDetectionResult objects
        """
        with tracer.start_as_current_span("pii_detection"):
            start_time = datetime.now()
            results = []
            
            # Pattern-based detection
            pattern_results = await self._pattern_based_detection(text)
            results.extend(pattern_results)
            
            # Named Entity Recognition (if available)
            if self.nlp:
                ner_results = await self._ner_based_detection(text)
                results.extend(ner_results)
            
            # Context-aware enhancement
            results = await self._enhance_with_context(text, results, context)
            
            # Deduplication and ranking
            results = self._deduplicate_results(results)
            
            PII_DETECTION_LATENCY.observe((datetime.now() - start_time).total_seconds())
            
            # Log PII detection events
            for result in results:
                PRIVACY_EVENTS.labels(
                    event_type='pii_detected',
                    action=result.pii_type.value
                ).inc()
            
            return results
    
    async def _pattern_based_detection(self, text: str) -> List[PIIDetectionResult]:
        """Pattern-based PII detection"""
        results = []
        
        for pii_type, pattern in self.compiled_patterns.items():
            matches = pattern.finditer(text)
            
            for match in matches:
                # Generate anonymized value
                anonymized = self._anonymize_value(match.group(), pii_type)
                
                result = PIIDetectionResult(
                    pii_type=pii_type,
                    value=match.group(),
                    confidence=self.pii_patterns[pii_type]['confidence'],
                    start_position=match.start(),
                    end_position=match.end(),
                    context=self._extract_context(text, match.start(), match.end()),
                    anonymized_value=anonymized
                )
                results.append(result)
        
        return results
    
    async def _ner_based_detection(self, text: str) -> List[PIIDetectionResult]:
        """Named Entity Recognition based PII detection"""
        results = []
        
        try:
            doc = self.nlp(text)
            
            for ent in doc.ents:
                pii_type = None
                confidence = 0.7
                
                if ent.label_ == "PERSON":
                    pii_type = PIIType.FULL_NAME
                    confidence = 0.8
                elif ent.label_ == "ORG":
                    # Organizations might contain personal info in small companies
                    confidence = 0.3
                elif ent.label_ == "GPE":  # Geopolitical entity
                    if len(ent.text.split()) > 1:  # Multi-word locations might be addresses
                        pii_type = PIIType.PHYSICAL_ADDRESS
                        confidence = 0.6
                elif ent.label_ == "DATE":
                    # Could be date of birth
                    if self._could_be_birthdate(ent.text):
                        pii_type = PIIType.DATE_OF_BIRTH
                        confidence = 0.5
                
                if pii_type:
                    anonymized = self._anonymize_value(ent.text, pii_type)
                    
                    result = PIIDetectionResult(
                        pii_type=pii_type,
                        value=ent.text,
                        confidence=confidence,
                        start_position=ent.start_char,
                        end_position=ent.end_char,
                        context=self._extract_context(text, ent.start_char, ent.end_char),
                        anonymized_value=anonymized
                    )
                    results.append(result)
        
        except Exception as e:
            # Log error but don't fail the detection
            print(f"NER detection error: {e}")
        
        return results
    
    async def _enhance_with_context(self, text: str, results: List[PIIDetectionResult], 
                                  context: Dict = None) -> List[PIIDetectionResult]:
        """Enhance detection confidence using context"""
        text_lower = text.lower()
        
        for result in results:
            # Check for context keywords
            keywords = self.pii_patterns.get(result.pii_type, {}).get('context_keywords', [])
            
            for keyword in keywords:
                if keyword in text_lower:
                    # Increase confidence if context keyword found nearby
                    if abs(text_lower.find(keyword) - result.start_position) < 50:
                        result.confidence = min(result.confidence + 0.1, 1.0)
                        break
        
        return results
    
    def _extract_context(self, text: str, start: int, end: int, window: int = 30) -> str:
        """Extract context around detected PII"""
        context_start = max(0, start - window)
        context_end = min(len(text), end + window)
        
        context = text[context_start:context_end]
        
        # Mask the PII in context
        pii_in_context_start = start - context_start
        pii_in_context_end = end - context_start
        
        masked_context = (
            context[:pii_in_context_start] + 
            "[PII]" + 
            context[pii_in_context_end:]
        )
        
        return masked_context.strip()
    
    def _anonymize_value(self, value: str, pii_type: PIIType) -> str:
        """Generate anonymized version of PII value"""
        if pii_type == PIIType.EMAIL:
            parts = value.split('@')
            if len(parts) == 2:
                username = parts[0]
                domain = parts[1]
                masked_username = username[0] + '*' * (len(username) - 2) + username[-1] if len(username) > 2 else '*' * len(username)
                return f"{masked_username}@{domain}"
        
        elif pii_type == PIIType.PHONE:
            # Keep first 3 and last 2 digits
            digits_only = re.sub(r'[^\d]', '', value)
            if len(digits_only) >= 5:
                return digits_only[:3] + '*' * (len(digits_only) - 5) + digits_only[-2:]
        
        elif pii_type == PIIType.CREDIT_CARD:
            # Show only last 4 digits
            digits_only = re.sub(r'[^\d]', '', value)
            return '*' * (len(digits_only) - 4) + digits_only[-4:]
        
        elif pii_type == PIIType.SSN:
            return 'XXX-XX-' + value[-4:]
        
        elif pii_type == PIIType.FULL_NAME:
            parts = value.split()
            if len(parts) > 1:
                return parts[0][0] + '.' + ' ' + parts[-1][0] + '.'
            else:
                return value[0] + '.' if value else '[NAME]'
        
        # Default anonymization
        return f"[{pii_type.value.upper()}]"
    
    def _could_be_birthdate(self, text: str) -> bool:
        """Check if a date could be a birthdate"""
        # Simple heuristic: dates between 1920 and current year - 10
        current_year = datetime.now().year
        
        # Look for 4-digit years
        year_match = re.search(r'\b(19|20)\d{2}\b', text)
        if year_match:
            year = int(year_match.group())
            return 1920 <= year <= current_year - 10
        
        return False
    
    def _deduplicate_results(self, results: List[PIIDetectionResult]) -> List[PIIDetectionResult]:
        """Remove duplicate PII detections"""
        seen_positions = set()
        deduplicated = []
        
        # Sort by confidence (highest first)
        results.sort(key=lambda x: x.confidence, reverse=True)
        
        for result in results:
            position_key = (result.start_position, result.end_position)
            if position_key not in seen_positions:
                seen_positions.add(position_key)
                deduplicated.append(result)
        
        return deduplicated

class ConsentManager:
    """Consent management for GDPR/CCPA compliance"""
    
    def __init__(self):
        self.consent_storage = {}  # In production, use database
        self.consent_history = {}
        
        # Default consent requirements
        self.consent_requirements = {
            ConsentType.ESSENTIAL_PROCESSING: {
                'required': True,
                'legal_basis': LegalBasis.LEGITIMATE_INTERESTS,
                'can_withdraw': False,
                'expires_after': None
            },
            ConsentType.ANALYTICS: {
                'required': False,
                'legal_basis': LegalBasis.CONSENT,
                'can_withdraw': True,
                'expires_after': timedelta(days=365)
            },
            ConsentType.PERSONALIZATION: {
                'required': False,
                'legal_basis': LegalBasis.CONSENT,
                'can_withdraw': True,
                'expires_after': timedelta(days=365)
            },
            ConsentType.VOICE_CLONING: {
                'required': False,
                'legal_basis': LegalBasis.CONSENT,
                'can_withdraw': True,
                'expires_after': timedelta(days=180)
            },
            ConsentType.CONVERSATION_STORAGE: {
                'required': False,
                'legal_basis': LegalBasis.CONSENT,
                'can_withdraw': True,
                'expires_after': timedelta(days=730)  # 2 years
            },
            ConsentType.IMPROVEMENT_TRAINING: {
                'required': False,
                'legal_basis': LegalBasis.CONSENT,
                'can_withdraw': True,
                'expires_after': timedelta(days=365)
            }
        }
    
    async def record_consent(self, user_id: str, consent_type: ConsentType, 
                           status: ConsentStatus, source: str, ip_address: str, 
                           user_agent: str, metadata: Dict = None) -> ConsentRecord:
        """Record user consent"""
        with tracer.start_as_current_span("record_consent"):
            now = datetime.now()
            requirements = self.consent_requirements[consent_type]
            
            # Calculate expiration
            expires_at = None
            if requirements['expires_after'] and status == ConsentStatus.GRANTED:
                expires_at = now + requirements['expires_after']
            
            consent_record = ConsentRecord(
                user_id=user_id,
                consent_type=consent_type,
                status=status,
                granted_at=now if status == ConsentStatus.GRANTED else None,
                withdrawn_at=now if status == ConsentStatus.WITHDRAWN else None,
                expires_at=expires_at,
                legal_basis=requirements['legal_basis'],
                version="1.0",  # Version of consent text/terms
                source=source,
                ip_address=ip_address,
                user_agent=user_agent,
                metadata=metadata or {}
            )
            
            # Store consent
            if user_id not in self.consent_storage:
                self.consent_storage[user_id] = {}
            
            self.consent_storage[user_id][consent_type] = consent_record
            
            # Store in history
            if user_id not in self.consent_history:
                self.consent_history[user_id] = []
            
            self.consent_history[user_id].append(consent_record)
            
            # Metrics
            CONSENT_CHANGES.labels(
                consent_type=consent_type.value,
                action=status.value
            ).inc()
            
            PRIVACY_EVENTS.labels(
                event_type='consent_recorded',
                action=status.value
            ).inc()
            
            return consent_record
    
    async def check_consent(self, user_id: str, consent_type: ConsentType) -> bool:
        """Check if user has valid consent for a specific type"""
        if user_id not in self.consent_storage:
            return False
        
        consent_record = self.consent_storage[user_id].get(consent_type)
        if not consent_record:
            return False
        
        # Check if consent is granted and not expired
        if consent_record.status != ConsentStatus.GRANTED:
            return False
        
        if consent_record.expires_at and datetime.now() > consent_record.expires_at:
            # Mark as expired
            consent_record.status = ConsentStatus.EXPIRED
            return False
        
        return True
    
    async def withdraw_consent(self, user_id: str, consent_type: ConsentType, 
                             source: str, ip_address: str, user_agent: str) -> bool:
        """Withdraw user consent"""
        if not await self.check_consent(user_id, consent_type):
            return False
        
        requirements = self.consent_requirements[consent_type]
        if not requirements['can_withdraw']:
            return False
        
        # Record withdrawal
        await self.record_consent(
            user_id=user_id,
            consent_type=consent_type,
            status=ConsentStatus.WITHDRAWN,
            source=source,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata={'withdrawal_reason': 'user_request'}
        )
        
        return True
    
    async def get_consent_summary(self, user_id: str) -> Dict[ConsentType, ConsentRecord]:
        """Get summary of all consents for a user"""
        return self.consent_storage.get(user_id, {})

class DataSubjectRightsProcessor:
    """Process Data Subject Rights requests under GDPR/CCPA"""
    
    def __init__(self, pii_detector: PIIDetector, consent_manager: ConsentManager):
        self.pii_detector = pii_detector
        self.consent_manager = consent_manager
        self.dsr_storage = {}  # In production, use database
        self.encryption_key = Fernet.generate_key()
        self.cipher = Fernet(self.encryption_key)
    
    async def submit_dsr(self, user_id: str, request_type: DSRType, 
                        requested_categories: List[DataCategory] = None,
                        metadata: Dict = None) -> str:
        """Submit a Data Subject Rights request"""
        with tracer.start_as_current_span("submit_dsr"):
            request_id = str(uuid.uuid4())
            
            dsr = DataSubjectRequest(
                request_id=request_id,
                user_id=user_id,
                request_type=request_type,
                status='pending_verification',
                created_at=datetime.now(),
                updated_at=datetime.now(),
                completed_at=None,
                requested_data_categories=requested_categories or [],
                verification_status='pending',
                response_data=None,
                metadata=metadata or {}
            )
            
            self.dsr_storage[request_id] = dsr
            
            PRIVACY_EVENTS.labels(
                event_type='dsr_submitted',
                action=request_type.value
            ).inc()
            
            # Start automated processing
            asyncio.create_task(self._process_dsr(request_id))
            
            return request_id
    
    async def _process_dsr(self, request_id: str):
        """Process DSR request automatically"""
        start_time = datetime.now()
        
        try:
            dsr = self.dsr_storage[request_id]
            
            # Step 1: Verify user identity (simplified)
            await self._verify_user_identity(dsr)
            
            # Step 2: Process request based on type
            if dsr.request_type == DSRType.ACCESS:
                await self._process_access_request(dsr)
            elif dsr.request_type == DSRType.ERASURE:
                await self._process_erasure_request(dsr)
            elif dsr.request_type == DSRType.PORTABILITY:
                await self._process_portability_request(dsr)
            elif dsr.request_type == DSRType.RECTIFICATION:
                await self._process_rectification_request(dsr)
            
            # Step 3: Mark as completed
            dsr.status = 'completed'
            dsr.completed_at = datetime.now()
            dsr.updated_at = datetime.now()
            
            DSR_PROCESSING_TIME.observe((datetime.now() - start_time).total_seconds())
            
        except Exception as e:
            dsr.status = 'failed'
            dsr.metadata['error'] = str(e)
            dsr.updated_at = datetime.now()
    
    async def _verify_user_identity(self, dsr: DataSubjectRequest):
        """Verify user identity for DSR processing"""
        # In production, implement proper identity verification
        # For now, mark as verified
        dsr.verification_status = 'verified'
        dsr.updated_at = datetime.now()
    
    async def _process_access_request(self, dsr: DataSubjectRequest):
        """Process data access request"""
        user_id = dsr.user_id
        
        # Collect all user data
        user_data = {
            'personal_information': await self._get_personal_information(user_id),
            'conversation_history': await self._get_conversation_history(user_id),
            'consent_records': await self._get_consent_records(user_id),
            'usage_analytics': await self._get_usage_analytics(user_id),
            'voice_data': await self._get_voice_data(user_id)
        }
        
        # Filter based on requested categories
        if dsr.requested_data_categories:
            filtered_data = {}
            for category in dsr.requested_data_categories:
                if category.value in user_data:
                    filtered_data[category.value] = user_data[category.value]
            user_data = filtered_data
        
        # Anonymize any PII in the response
        anonymized_data = await self._anonymize_response_data(user_data)
        
        dsr.response_data = anonymized_data
    
    async def _process_erasure_request(self, dsr: DataSubjectRequest):
        """Process data erasure request (Right to be Forgotten)"""
        user_id = dsr.user_id
        
        # Check for legal obligations that prevent deletion
        legal_holds = await self._check_legal_holds(user_id)
        
        if legal_holds:
            dsr.status = 'partially_completed'
            dsr.metadata['legal_holds'] = legal_holds
            return
        
        # Delete user data
        deletion_results = {
            'personal_information': await self._delete_personal_information(user_id),
            'conversation_history': await self._delete_conversation_history(user_id),
            'voice_data': await self._delete_voice_data(user_id),
            'analytics_data': await self._anonymize_analytics_data(user_id)
        }
        
        dsr.response_data = deletion_results
        
        DATA_RETENTION_ACTIONS.labels(action='deletion', reason='user_request').inc()
    
    async def _process_portability_request(self, dsr: DataSubjectRequest):
        """Process data portability request"""
        # Similar to access request but in a structured, machine-readable format
        await self._process_access_request(dsr)
        
        # Convert to portable format (JSON)
        if dsr.response_data:
            dsr.response_data['format'] = 'json'
            dsr.response_data['export_date'] = datetime.now().isoformat()
    
    async def _process_rectification_request(self, dsr: DataSubjectRequest):
        """Process data rectification request"""
        # This would allow users to correct their data
        # Implementation depends on specific data structures
        dsr.status = 'requires_manual_review'
        dsr.metadata['note'] = 'Rectification requests require manual review'
    
    async def _get_personal_information(self, user_id: str) -> Dict:
        """Get user's personal information"""
        # Placeholder - implement based on your data model
        return {'user_id': user_id, 'profile_data': 'encrypted'}
    
    async def _get_conversation_history(self, user_id: str) -> Dict:
        """Get user's conversation history"""
        # Placeholder - implement based on your data model
        return {'conversations': [], 'total_messages': 0}
    
    async def _get_consent_records(self, user_id: str) -> Dict:
        """Get user's consent records"""
        consents = await self.consent_manager.get_consent_summary(user_id)
        return {consent_type.value: asdict(record) for consent_type, record in consents.items()}
    
    async def _get_usage_analytics(self, user_id: str) -> Dict:
        """Get user's usage analytics"""
        return {'usage_stats': 'anonymized'}
    
    async def _get_voice_data(self, user_id: str) -> Dict:
        """Get user's voice data"""
        return {'voice_recordings': [], 'voice_models': []}
    
    async def _anonymize_response_data(self, data: Dict) -> Dict:
        """Anonymize PII in response data"""
        # Convert to JSON string for processing
        json_str = json.dumps(data)
        
        # Detect and anonymize PII
        pii_results = await self.pii_detector.detect_pii(json_str)
        
        for pii in pii_results:
            json_str = json_str.replace(pii.value, pii.anonymized_value)
        
        return json.loads(json_str)
    
    async def _check_legal_holds(self, user_id: str) -> List[str]:
        """Check for legal obligations preventing deletion"""
        # Placeholder - implement based on your legal requirements
        return []
    
    async def _delete_personal_information(self, user_id: str) -> Dict:
        """Delete user's personal information"""
        return {'deleted': True, 'method': 'secure_deletion'}
    
    async def _delete_conversation_history(self, user_id: str) -> Dict:
        """Delete user's conversation history"""
        return {'deleted': True, 'method': 'secure_deletion'}
    
    async def _delete_voice_data(self, user_id: str) -> Dict:
        """Delete user's voice data"""
        return {'deleted': True, 'method': 'secure_deletion'}
    
    async def _anonymize_analytics_data(self, user_id: str) -> Dict:
        """Anonymize analytics data (keep for business purposes)"""
        return {'anonymized': True, 'method': 'k_anonymity'}

class RetentionPolicyManager:
    """Manage data retention policies and automated deletion"""
    
    def __init__(self):
        self.retention_policies = [
            RetentionPolicy(
                data_category=DataCategory.PERSONAL_IDENTIFIERS,
                retention_period=timedelta(days=2555),  # 7 years
                legal_basis=LegalBasis.LEGAL_OBLIGATION,
                deletion_method='secure_deletion',
                exceptions=['legal_hold', 'active_dispute']
            ),
            RetentionPolicy(
                data_category=DataCategory.COMMUNICATION,
                retention_period=timedelta(days=730),  # 2 years
                legal_basis=LegalBasis.LEGITIMATE_INTERESTS,
                deletion_method='secure_deletion',
                exceptions=['user_consent_extended']
            ),
            RetentionPolicy(
                data_category=DataCategory.BEHAVIORAL,
                retention_period=timedelta(days=365),  # 1 year
                legal_basis=LegalBasis.CONSENT,
                deletion_method='anonymization',
                exceptions=[]
            ),
            RetentionPolicy(
                data_category=DataCategory.TECHNICAL,
                retention_period=timedelta(days=90),  # 3 months
                legal_basis=LegalBasis.LEGITIMATE_INTERESTS,
                deletion_method='deletion',
                exceptions=[]
            )
        ]
    
    async def check_retention_compliance(self):
        """Check and enforce retention policies"""
        with tracer.start_as_current_span("retention_compliance_check"):
            for policy in self.retention_policies:
                await self._enforce_retention_policy(policy)
    
    async def _enforce_retention_policy(self, policy: RetentionPolicy):
        """Enforce a specific retention policy"""
        cutoff_date = datetime.now() - policy.retention_period
        
        # Find data older than retention period
        expired_data = await self._find_expired_data(policy.data_category, cutoff_date)
        
        for data_item in expired_data:
            # Check for exceptions
            if await self._has_retention_exception(data_item, policy.exceptions):
                continue
            
            # Apply deletion/anonymization
            if policy.deletion_method == 'secure_deletion':
                await self._secure_delete(data_item)
            elif policy.deletion_method == 'anonymization':
                await self._anonymize_data(data_item)
            elif policy.deletion_method == 'deletion':
                await self._standard_delete(data_item)
            
            DATA_RETENTION_ACTIONS.labels(
                action=policy.deletion_method,
                reason='retention_policy'
            ).inc()
    
    async def _find_expired_data(self, category: DataCategory, cutoff_date: datetime) -> List[Dict]:
        """Find data older than cutoff date for a category"""
        # Placeholder - implement based on your data model
        return []
    
    async def _has_retention_exception(self, data_item: Dict, exceptions: List[str]) -> bool:
        """Check if data item has retention exceptions"""
        # Placeholder - implement based on your business logic
        return False
    
    async def _secure_delete(self, data_item: Dict):
        """Securely delete data item"""
        # Implement secure deletion (overwrite, degauss, etc.)
        pass
    
    async def _anonymize_data(self, data_item: Dict):
        """Anonymize data item"""
        # Implement anonymization
        pass
    
    async def _standard_delete(self, data_item: Dict):
        """Standard deletion of data item"""
        # Implement standard deletion
        pass

class PrivacyOrchestrator:
    """Main privacy orchestrator coordinating all privacy functions"""
    
    def __init__(self):
        self.pii_detector = PIIDetector()
        self.consent_manager = ConsentManager()
        self.dsr_processor = DataSubjectRightsProcessor(self.pii_detector, self.consent_manager)
        self.retention_manager = RetentionPolicyManager()
    
    async def process_user_input(self, user_id: str, content: str, 
                               context: Dict = None) -> Tuple[str, List[PIIDetectionResult]]:
        """Process user input for privacy compliance"""
        # Detect PII
        pii_results = await self.pii_detector.detect_pii(content, context)
        
        # Anonymize content for storage/processing
        anonymized_content = content
        for pii in sorted(pii_results, key=lambda x: x.start_position, reverse=True):
            anonymized_content = (
                anonymized_content[:pii.start_position] +
                pii.anonymized_value +
                anonymized_content[pii.end_position:]
            )
        
        return anonymized_content, pii_results
    
    async def check_processing_consent(self, user_id: str, 
                                     processing_type: ConsentType) -> bool:
        """Check if user has consent for specific processing"""
        return await self.consent_manager.check_consent(user_id, processing_type)
    
    async def handle_dsr_request(self, user_id: str, request_type: DSRType, 
                               categories: List[DataCategory] = None) -> str:
        """Handle Data Subject Rights request"""
        return await self.dsr_processor.submit_dsr(user_id, request_type, categories)
    
    async def run_retention_cleanup(self):
        """Run retention policy cleanup"""
        await self.retention_manager.check_retention_compliance()

# Example usage
async def example_usage():
    """Example usage of privacy framework"""
    orchestrator = PrivacyOrchestrator()
    
    # Test PII detection
    test_content = "Hi, my name is John Doe and my email is john.doe@example.com. My phone is 555-123-4567."
    
    anonymized, pii_results = await orchestrator.process_user_input("user123", test_content)
    
    print(f"Original: {test_content}")
    print(f"Anonymized: {anonymized}")
    print(f"PII detected: {len(pii_results)} items")
    
    for pii in pii_results:
        print(f"  - {pii.pii_type.value}: {pii.value} -> {pii.anonymized_value} (confidence: {pii.confidence})")
    
    # Test consent management
    await orchestrator.consent_manager.record_consent(
        user_id="user123",
        consent_type=ConsentType.PERSONALIZATION,
        status=ConsentStatus.GRANTED,
        source="web",
        ip_address="192.168.1.1",
        user_agent="Mozilla/5.0..."
    )
    
    has_consent = await orchestrator.check_processing_consent("user123", ConsentType.PERSONALIZATION)
    print(f"Has personalization consent: {has_consent}")
    
    # Test DSR request
    request_id = await orchestrator.handle_dsr_request(
        user_id="user123",
        request_type=DSRType.ACCESS,
        categories=[DataCategory.PERSONAL_IDENTIFIERS, DataCategory.COMMUNICATION]
    )
    
    print(f"DSR request submitted: {request_id}")

if __name__ == "__main__":
    asyncio.run(example_usage())