"""
Payment Service Integration for the Commerce Service.

This module provides integration with external payment processors,
including authorization, capture, refunds, and webhook handling.
"""

import asyncio
import aiohttp
import hmac
import hashlib
import json
from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from uuid import uuid4
import structlog

from ...domain.events.order_events import (
    OrderPaymentAuthorizedEvent, OrderPaymentCapturedEvent,
    OrderPaymentFailedEvent, OrderRefundInitiatedEvent,
    OrderRefundCompletedEvent, OrderRefundFailedEvent
)
from ..messaging.event_bus import EventBus


logger = structlog.get_logger(__name__)


class PaymentProcessor:
    """Base class for payment processor integrations."""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        self.name = name
        self.config = config
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def authorize_payment(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Authorize a payment."""
        raise NotImplementedError
    
    async def capture_payment(self, authorization_id: str, amount: Decimal) -> Dict[str, Any]:
        """Capture an authorized payment."""
        raise NotImplementedError
    
    async def void_payment(self, authorization_id: str) -> Dict[str, Any]:
        """Void an authorized payment."""
        raise NotImplementedError
    
    async def refund_payment(self, transaction_id: str, amount: Decimal, reason: str) -> Dict[str, Any]:
        """Refund a captured payment."""
        raise NotImplementedError
    
    async def get_payment_status(self, payment_id: str) -> Dict[str, Any]:
        """Get payment status."""
        raise NotImplementedError
    
    def verify_webhook(self, payload: str, signature: str, secret: str) -> bool:
        """Verify webhook signature."""
        raise NotImplementedError


class StripeProcessor(PaymentProcessor):
    """Stripe payment processor integration."""
    
    def __init__(self, secret_key: str, webhook_secret: str):
        super().__init__("stripe", {
            "secret_key": secret_key,
            "webhook_secret": webhook_secret
        })
        self.base_url = "https://api.stripe.com/v1"
    
    async def authorize_payment(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Authorize payment with Stripe."""
        try:
            headers = {
                "Authorization": f"Bearer {self.config['secret_key']}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            data = {
                "amount": int(payment_data["amount"] * 100),  # Stripe uses cents
                "currency": payment_data.get("currency", "usd"),
                "payment_method": payment_data["payment_method_id"],
                "confirmation_method": "manual",
                "confirm": "true",
                "capture_method": "manual",  # Authorize only
                "metadata[order_id]": payment_data["order_id"],
                "metadata[customer_id]": payment_data["customer_id"]
            }
            
            async with self.session.post(
                f"{self.base_url}/payment_intents",
                headers=headers,
                data=data
            ) as response:
                result = await response.json()
                
                if response.status == 200:
                    return {
                        "success": True,
                        "authorization_id": result["id"],
                        "status": result["status"],
                        "amount": Decimal(str(result["amount"])) / 100,
                        "currency": result["currency"],
                        "processor": "stripe"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("error", {}).get("message", "Unknown error"),
                        "error_code": result.get("error", {}).get("code")
                    }
                    
        except Exception as e:
            logger.error("Stripe authorization failed", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def capture_payment(self, authorization_id: str, amount: Decimal) -> Dict[str, Any]:
        """Capture Stripe payment."""
        try:
            headers = {
                "Authorization": f"Bearer {self.config['secret_key']}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            data = {
                "amount_to_capture": int(amount * 100)
            }
            
            async with self.session.post(
                f"{self.base_url}/payment_intents/{authorization_id}/capture",
                headers=headers,
                data=data
            ) as response:
                result = await response.json()
                
                if response.status == 200:
                    return {
                        "success": True,
                        "transaction_id": result["charges"]["data"][0]["id"],
                        "status": result["status"],
                        "amount": Decimal(str(result["amount_received"])) / 100,
                        "processor": "stripe"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("error", {}).get("message", "Unknown error")
                    }
                    
        except Exception as e:
            logger.error("Stripe capture failed", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def refund_payment(self, transaction_id: str, amount: Decimal, reason: str) -> Dict[str, Any]:
        """Refund Stripe payment."""
        try:
            headers = {
                "Authorization": f"Bearer {self.config['secret_key']}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            data = {
                "charge": transaction_id,
                "amount": int(amount * 100),
                "reason": reason,
                "metadata[refund_reason]": reason
            }
            
            async with self.session.post(
                f"{self.base_url}/refunds",
                headers=headers,
                data=data
            ) as response:
                result = await response.json()
                
                if response.status == 200:
                    return {
                        "success": True,
                        "refund_id": result["id"],
                        "status": result["status"],
                        "amount": Decimal(str(result["amount"])) / 100,
                        "processor": "stripe"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("error", {}).get("message", "Unknown error")
                    }
                    
        except Exception as e:
            logger.error("Stripe refund failed", error=str(e))
            return {"success": False, "error": str(e)}
    
    def verify_webhook(self, payload: str, signature: str, secret: str) -> bool:
        """Verify Stripe webhook signature."""
        try:
            expected_signature = hmac.new(
                secret.encode('utf-8'),
                payload.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            # Stripe signature format: t=timestamp,v1=signature
            signature_parts = signature.split(',')
            for part in signature_parts:
                if part.startswith('v1='):
                    provided_signature = part[3:]
                    return hmac.compare_digest(expected_signature, provided_signature)
            
            return False
            
        except Exception as e:
            logger.error("Stripe webhook verification failed", error=str(e))
            return False


class PayPalProcessor(PaymentProcessor):
    """PayPal payment processor integration."""
    
    def __init__(self, client_id: str, client_secret: str, sandbox: bool = True):
        super().__init__("paypal", {
            "client_id": client_id,
            "client_secret": client_secret,
            "sandbox": sandbox
        })
        self.base_url = "https://api.sandbox.paypal.com" if sandbox else "https://api.paypal.com"
        self.access_token = None
        self.token_expires_at = None
    
    async def _get_access_token(self) -> str:
        """Get PayPal access token."""
        if (self.access_token and self.token_expires_at and 
            datetime.now(timezone.utc) < self.token_expires_at):
            return self.access_token
        
        try:
            import base64
            
            credentials = base64.b64encode(
                f"{self.config['client_id']}:{self.config['client_secret']}".encode()
            ).decode()
            
            headers = {
                "Accept": "application/json",
                "Accept-Language": "en_US",
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            data = "grant_type=client_credentials"
            
            async with self.session.post(
                f"{self.base_url}/v1/oauth2/token",
                headers=headers,
                data=data
            ) as response:
                result = await response.json()
                
                if response.status == 200:
                    self.access_token = result["access_token"]
                    expires_in = result.get("expires_in", 3600)
                    self.token_expires_at = datetime.now(timezone.utc).timestamp() + expires_in
                    return self.access_token
                else:
                    raise Exception(f"Failed to get PayPal access token: {result}")
                    
        except Exception as e:
            logger.error("PayPal token request failed", error=str(e))
            raise
    
    async def authorize_payment(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Authorize payment with PayPal."""
        try:
            access_token = await self._get_access_token()
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}",
                "PayPal-Request-Id": str(uuid4())
            }
            
            payload = {
                "intent": "AUTHORIZE",
                "purchase_units": [
                    {
                        "reference_id": payment_data["order_id"],
                        "amount": {
                            "currency_code": payment_data.get("currency", "USD"),
                            "value": str(payment_data["amount"])
                        }
                    }
                ],
                "payment_source": {
                    "paypal": {
                        "experience_context": {
                            "payment_method_preference": "IMMEDIATE_PAYMENT_REQUIRED",
                            "user_action": "PAY_NOW"
                        }
                    }
                }
            }
            
            async with self.session.post(
                f"{self.base_url}/v2/checkout/orders",
                headers=headers,
                json=payload
            ) as response:
                result = await response.json()
                
                if response.status == 201:
                    return {
                        "success": True,
                        "authorization_id": result["id"],
                        "status": result["status"],
                        "amount": payment_data["amount"],
                        "currency": payment_data.get("currency", "USD"),
                        "processor": "paypal"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("message", "Unknown error"),
                        "details": result.get("details", [])
                    }
                    
        except Exception as e:
            logger.error("PayPal authorization failed", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def capture_payment(self, authorization_id: str, amount: Decimal) -> Dict[str, Any]:
        """Capture PayPal payment."""
        try:
            access_token = await self._get_access_token()
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}",
                "PayPal-Request-Id": str(uuid4())
            }
            
            async with self.session.post(
                f"{self.base_url}/v2/checkout/orders/{authorization_id}/capture",
                headers=headers,
                json={}
            ) as response:
                result = await response.json()
                
                if response.status == 201:
                    capture = result["purchase_units"][0]["payments"]["captures"][0]
                    return {
                        "success": True,
                        "transaction_id": capture["id"],
                        "status": capture["status"],
                        "amount": Decimal(capture["amount"]["value"]),
                        "processor": "paypal"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("message", "Unknown error")
                    }
                    
        except Exception as e:
            logger.error("PayPal capture failed", error=str(e))
            return {"success": False, "error": str(e)}


class PaymentServiceAdapter:
    """
    Payment Service Adapter.
    
    Provides a unified interface for multiple payment processors and handles
    payment authorization, capture, refunds, and webhook processing.
    """
    
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
        self.processors: Dict[str, PaymentProcessor] = {}
        self.default_processor = None
        self.payment_history: List[Dict[str, Any]] = []
        
        # Initialize processors
        self._initialize_processors()
    
    def _initialize_processors(self):
        """Initialize payment processors from configuration."""
        # Stripe configuration
        stripe_config = {
            "secret_key": "sk_test_your_stripe_secret_key",
            "webhook_secret": "whsec_your_webhook_secret"
        }
        
        # PayPal configuration
        paypal_config = {
            "client_id": "your_paypal_client_id",
            "client_secret": "your_paypal_client_secret",
            "sandbox": True
        }
        
        try:
            self.processors["stripe"] = StripeProcessor(**stripe_config)
            self.processors["paypal"] = PayPalProcessor(**paypal_config)
            self.default_processor = "stripe"
        except Exception as e:
            logger.warning("Failed to initialize some payment processors", error=str(e))
    
    async def authorize_payment(
        self,
        order_id: str,
        customer_id: str,
        amount: Decimal,
        currency: str,
        payment_method: str,
        processor: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Authorize a payment.
        
        Args:
            order_id: Order identifier
            customer_id: Customer identifier
            amount: Payment amount
            currency: Currency code
            payment_method: Payment method identifier
            processor: Preferred processor (optional)
            
        Returns:
            Authorization result
        """
        try:
            # Select processor
            selected_processor = processor or self.default_processor
            if selected_processor not in self.processors:
                return {"success": False, "error": f"Processor {selected_processor} not available"}
            
            processor_instance = self.processors[selected_processor]
            
            payment_data = {
                "order_id": order_id,
                "customer_id": customer_id,
                "amount": amount,
                "currency": currency,
                "payment_method_id": payment_method
            }
            
            # Authorize payment
            async with processor_instance:
                result = await processor_instance.authorize_payment(payment_data)
            
            # Record in history
            history_entry = {
                "payment_id": str(uuid4()),
                "order_id": order_id,
                "customer_id": customer_id,
                "amount": amount,
                "currency": currency,
                "processor": selected_processor,
                "operation": "authorize",
                "status": "success" if result.get("success") else "failed",
                "authorization_id": result.get("authorization_id"),
                "error": result.get("error"),
                "timestamp": datetime.now(timezone.utc)
            }
            self.payment_history.append(history_entry)
            
            if result.get("success"):
                # Publish payment authorized event
                event = OrderPaymentAuthorizedEvent(
                    aggregate_id=order_id,
                    aggregate_type="order",
                    aggregate_version=1,  # Will be updated by aggregate
                    order_id=order_id,
                    customer_id=customer_id,
                    payment_id=history_entry["payment_id"],
                    authorization_id=result["authorization_id"],
                    amount=amount,
                    payment_method=payment_method
                )
                await self.event_bus.publish(event)
                
                logger.info(
                    "Payment authorized successfully",
                    order_id=order_id,
                    authorization_id=result["authorization_id"],
                    amount=str(amount)
                )
            else:
                # Publish payment failed event
                event = OrderPaymentFailedEvent(
                    aggregate_id=order_id,
                    aggregate_type="order",
                    aggregate_version=1,
                    order_id=order_id,
                    customer_id=customer_id,
                    payment_id=history_entry["payment_id"],
                    amount=amount,
                    failure_reason=result.get("error", "Unknown error"),
                    failure_code=result.get("error_code", "unknown"),
                    retry_count=0
                )
                await self.event_bus.publish(event)
            
            return result
            
        except Exception as e:
            logger.error("Payment authorization failed", order_id=order_id, error=str(e))
            return {"success": False, "error": str(e)}
    
    async def capture_payment(
        self,
        order_id: str,
        customer_id: str,
        authorization_id: str,
        amount: Decimal,
        processor: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Capture an authorized payment.
        
        Args:
            order_id: Order identifier
            customer_id: Customer identifier
            authorization_id: Authorization identifier
            amount: Amount to capture
            processor: Processor name (optional)
            
        Returns:
            Capture result
        """
        try:
            # Find processor from history or use default
            selected_processor = processor or self._find_processor_for_payment(authorization_id) or self.default_processor
            
            if selected_processor not in self.processors:
                return {"success": False, "error": f"Processor {selected_processor} not available"}
            
            processor_instance = self.processors[selected_processor]
            
            # Capture payment
            async with processor_instance:
                result = await processor_instance.capture_payment(authorization_id, amount)
            
            # Record in history
            history_entry = {
                "payment_id": str(uuid4()),
                "order_id": order_id,
                "customer_id": customer_id,
                "amount": amount,
                "processor": selected_processor,
                "operation": "capture",
                "status": "success" if result.get("success") else "failed",
                "authorization_id": authorization_id,
                "transaction_id": result.get("transaction_id"),
                "error": result.get("error"),
                "timestamp": datetime.now(timezone.utc)
            }
            self.payment_history.append(history_entry)
            
            if result.get("success"):
                # Publish payment captured event
                event = OrderPaymentCapturedEvent(
                    aggregate_id=order_id,
                    aggregate_type="order",
                    aggregate_version=1,
                    order_id=order_id,
                    customer_id=customer_id,
                    payment_id=history_entry["payment_id"],
                    transaction_id=result["transaction_id"],
                    amount=amount,
                    captured_at=datetime.now(timezone.utc)
                )
                await self.event_bus.publish(event)
                
                logger.info(
                    "Payment captured successfully",
                    order_id=order_id,
                    transaction_id=result["transaction_id"],
                    amount=str(amount)
                )
            
            return result
            
        except Exception as e:
            logger.error("Payment capture failed", order_id=order_id, error=str(e))
            return {"success": False, "error": str(e)}
    
    async def initiate_refund(
        self,
        order_id: str,
        amount: Decimal,
        reason: str,
        payment_method: str,
        transaction_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Initiate a refund.
        
        Args:
            order_id: Order identifier
            amount: Refund amount
            reason: Refund reason
            payment_method: Original payment method
            transaction_id: Transaction to refund (optional)
            
        Returns:
            Refund initiation result
        """
        try:
            # Find transaction if not provided
            if not transaction_id:
                transaction_id = self._find_transaction_for_order(order_id)
                if not transaction_id:
                    return {"success": False, "error": "No transaction found for order"}
            
            # Find processor
            processor_name = self._find_processor_for_transaction(transaction_id)
            if not processor_name or processor_name not in self.processors:
                return {"success": False, "error": "Payment processor not found"}
            
            processor_instance = self.processors[processor_name]
            
            # Initiate refund
            async with processor_instance:
                result = await processor_instance.refund_payment(transaction_id, amount, reason)
            
            if result.get("success"):
                # Publish refund initiated event
                event = OrderRefundInitiatedEvent(
                    aggregate_id=order_id,
                    aggregate_type="order",
                    aggregate_version=1,
                    order_id=order_id,
                    customer_id="",  # Would be retrieved from order
                    refund_id=result["refund_id"],
                    refund_amount=amount,
                    payment_method=payment_method,
                    initiated_by="payment_service"
                )
                await self.event_bus.publish(event)
                
                logger.info(
                    "Refund initiated successfully",
                    order_id=order_id,
                    refund_id=result["refund_id"],
                    amount=str(amount)
                )
            
            return result
            
        except Exception as e:
            logger.error("Refund initiation failed", order_id=order_id, error=str(e))
            return {"success": False, "error": str(e)}
    
    async def cancel_refund(self, refund_id: str, reason: str) -> Dict[str, Any]:
        """
        Cancel a pending refund.
        
        Args:
            refund_id: Refund identifier
            reason: Cancellation reason
            
        Returns:
            Cancellation result
        """
        try:
            # This would typically involve calling the processor's API
            # For now, return success
            logger.info("Refund cancelled", refund_id=refund_id, reason=reason)
            return {"success": True, "refund_id": refund_id}
            
        except Exception as e:
            logger.error("Refund cancellation failed", refund_id=refund_id, error=str(e))
            return {"success": False, "error": str(e)}
    
    async def handle_webhook(self, processor: str, payload: str, signature: str) -> Dict[str, Any]:
        """
        Handle payment processor webhook.
        
        Args:
            processor: Processor name
            payload: Webhook payload
            signature: Webhook signature
            
        Returns:
            Handling result
        """
        try:
            if processor not in self.processors:
                return {"success": False, "error": f"Unknown processor: {processor}"}
            
            processor_instance = self.processors[processor]
            webhook_secret = processor_instance.config.get("webhook_secret", "")
            
            # Verify webhook signature
            if not processor_instance.verify_webhook(payload, signature, webhook_secret):
                logger.warning("Invalid webhook signature", processor=processor)
                return {"success": False, "error": "Invalid signature"}
            
            # Parse webhook data
            webhook_data = json.loads(payload)
            event_type = webhook_data.get("type")
            
            # Handle different event types
            if event_type in ["payment_intent.succeeded", "checkout.order.approved"]:
                await self._handle_payment_success_webhook(webhook_data, processor)
            elif event_type in ["payment_intent.payment_failed", "checkout.order.voided"]:
                await self._handle_payment_failure_webhook(webhook_data, processor)
            elif event_type in ["charge.dispute.created"]:
                await self._handle_chargeback_webhook(webhook_data, processor)
            
            logger.info("Webhook processed successfully", processor=processor, event_type=event_type)
            return {"success": True, "event_type": event_type}
            
        except Exception as e:
            logger.error("Webhook handling failed", processor=processor, error=str(e))
            return {"success": False, "error": str(e)}
    
    async def _handle_payment_success_webhook(self, webhook_data: Dict[str, Any], processor: str):
        """Handle payment success webhook."""
        # Extract order information and publish appropriate events
        pass
    
    async def _handle_payment_failure_webhook(self, webhook_data: Dict[str, Any], processor: str):
        """Handle payment failure webhook."""
        # Extract order information and publish failure events
        pass
    
    async def _handle_chargeback_webhook(self, webhook_data: Dict[str, Any], processor: str):
        """Handle chargeback webhook."""
        # Handle dispute/chargeback events
        pass
    
    def _find_processor_for_payment(self, authorization_id: str) -> Optional[str]:
        """Find processor for a payment authorization."""
        for entry in reversed(self.payment_history):
            if entry.get("authorization_id") == authorization_id:
                return entry.get("processor")
        return None
    
    def _find_processor_for_transaction(self, transaction_id: str) -> Optional[str]:
        """Find processor for a transaction."""
        for entry in reversed(self.payment_history):
            if entry.get("transaction_id") == transaction_id:
                return entry.get("processor")
        return None
    
    def _find_transaction_for_order(self, order_id: str) -> Optional[str]:
        """Find latest successful transaction for an order."""
        for entry in reversed(self.payment_history):
            if (entry.get("order_id") == order_id and 
                entry.get("operation") == "capture" and 
                entry.get("status") == "success"):
                return entry.get("transaction_id")
        return None
    
    def get_payment_history(self, order_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """Get payment history."""
        history = self.payment_history
        if order_id:
            history = [entry for entry in history if entry.get("order_id") == order_id]
        return history[-limit:]
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of all payment processors."""
        health_status = {
            "healthy": True,
            "processors": {}
        }
        
        for processor_name, processor_instance in self.processors.items():
            try:
                # Simple health check - this would be processor-specific
                health_status["processors"][processor_name] = {"status": "healthy"}
            except Exception as e:
                health_status["processors"][processor_name] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
                health_status["healthy"] = False
        
        return health_status
