"""
Notification Service Integration for the Commerce Service.

This module provides integration with notification services for sending
emails, SMS, push notifications, and other communication channels.
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from uuid import uuid4
import structlog

from ...domain.events.base import DomainEvent
from ..messaging.event_bus import EventBus


logger = structlog.get_logger(__name__)


class NotificationChannel:
    """Base class for notification channels."""
    
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
    
    async def send(self, notification: Dict[str, Any]) -> Dict[str, Any]:
        """Send notification through this channel."""
        raise NotImplementedError
    
    async def get_delivery_status(self, notification_id: str) -> Dict[str, Any]:
        """Get delivery status for a notification."""
        raise NotImplementedError


class EmailChannel(NotificationChannel):
    """Email notification channel using SendGrid."""
    
    def __init__(self, api_key: str, from_email: str, from_name: str):
        super().__init__("email", {
            "api_key": api_key,
            "from_email": from_email,
            "from_name": from_name
        })
        self.base_url = "https://api.sendgrid.com/v3"
    
    async def send(self, notification: Dict[str, Any]) -> Dict[str, Any]:
        """Send email notification via SendGrid."""
        try:
            headers = {
                "Authorization": f"Bearer {self.config['api_key']}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "personalizations": [
                    {
                        "to": [{"email": notification["recipient"]}],
                        "subject": notification["subject"],
                        "dynamic_template_data": notification.get("data", {})
                    }
                ],
                "from": {
                    "email": self.config["from_email"],
                    "name": self.config["from_name"]
                },
                "template_id": notification.get("template_id")
            }
            
            # If no template, send with content
            if not notification.get("template_id"):
                payload["content"] = [
                    {
                        "type": "text/html",
                        "value": notification.get("content", notification.get("subject", ""))
                    }
                ]
            
            async with self.session.post(
                f"{self.base_url}/mail/send",
                headers=headers,
                json=payload
            ) as response:
                if response.status == 202:
                    return {
                        "success": True,
                        "notification_id": str(uuid4()),
                        "channel": "email",
                        "status": "sent"
                    }
                else:
                    error_text = await response.text()
                    return {
                        "success": False,
                        "error": f"SendGrid error: {error_text}",
                        "status_code": response.status
                    }
                    
        except Exception as e:
            logger.error("Email sending failed", error=str(e))
            return {"success": False, "error": str(e)}


class SMSChannel(NotificationChannel):
    """SMS notification channel using Twilio."""
    
    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        super().__init__("sms", {
            "account_sid": account_sid,
            "auth_token": auth_token,
            "from_number": from_number
        })
        self.base_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}"
    
    async def send(self, notification: Dict[str, Any]) -> Dict[str, Any]:
        """Send SMS notification via Twilio."""
        try:
            import base64
            
            # Basic auth for Twilio
            credentials = base64.b64encode(
                f"{self.config['account_sid']}:{self.config['auth_token']}".encode()
            ).decode()
            
            headers = {
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            data = {
                "From": self.config["from_number"],
                "To": notification["recipient"],
                "Body": notification["message"]
            }
            
            async with self.session.post(
                f"{self.base_url}/Messages.json",
                headers=headers,
                data=data
            ) as response:
                result = await response.json()
                
                if response.status == 201:
                    return {
                        "success": True,
                        "notification_id": result["sid"],
                        "channel": "sms",
                        "status": result["status"]
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("message", "Unknown error"),
                        "error_code": result.get("code")
                    }
                    
        except Exception as e:
            logger.error("SMS sending failed", error=str(e))
            return {"success": False, "error": str(e)}


class PushNotificationChannel(NotificationChannel):
    """Push notification channel using Firebase Cloud Messaging."""
    
    def __init__(self, server_key: str, project_id: str):
        super().__init__("push", {
            "server_key": server_key,
            "project_id": project_id
        })
        self.base_url = "https://fcm.googleapis.com/fcm/send"
    
    async def send(self, notification: Dict[str, Any]) -> Dict[str, Any]:
        """Send push notification via FCM."""
        try:
            headers = {
                "Authorization": f"key={self.config['server_key']}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "to": notification["recipient"],  # FCM token
                "notification": {
                    "title": notification["title"],
                    "body": notification["message"],
                    "icon": notification.get("icon", "default"),
                    "click_action": notification.get("click_action")
                },
                "data": notification.get("data", {})
            }
            
            async with self.session.post(
                self.base_url,
                headers=headers,
                json=payload
            ) as response:
                result = await response.json()
                
                if response.status == 200 and result.get("success") == 1:
                    return {
                        "success": True,
                        "notification_id": result["results"][0].get("message_id"),
                        "channel": "push",
                        "status": "sent"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("results", [{}])[0].get("error", "Unknown error")
                    }
                    
        except Exception as e:
            logger.error("Push notification sending failed", error=str(e))
            return {"success": False, "error": str(e)}


class SlackChannel(NotificationChannel):
    """Slack notification channel using webhooks."""
    
    def __init__(self, webhook_url: str):
        super().__init__("slack", {"webhook_url": webhook_url})
    
    async def send(self, notification: Dict[str, Any]) -> Dict[str, Any]:
        """Send Slack notification via webhook."""
        try:
            payload = {
                "text": notification["message"],
                "username": notification.get("username", "Commerce Bot"),
                "icon_emoji": notification.get("icon", ":shopping_cart:"),
                "channel": notification.get("channel", "#general")
            }
            
            # Add attachments for rich formatting
            if notification.get("attachments"):
                payload["attachments"] = notification["attachments"]
            
            async with self.session.post(
                self.config["webhook_url"],
                json=payload
            ) as response:
                if response.status == 200:
                    return {
                        "success": True,
                        "notification_id": str(uuid4()),
                        "channel": "slack",
                        "status": "sent"
                    }
                else:
                    error_text = await response.text()
                    return {
                        "success": False,
                        "error": f"Slack error: {error_text}"
                    }
                    
        except Exception as e:
            logger.error("Slack notification failed", error=str(e))
            return {"success": False, "error": str(e)}


class NotificationTemplate:
    """Notification template for different event types."""
    
    def __init__(self, template_id: str, event_type: str, channels: List[str]):
        self.template_id = template_id
        self.event_type = event_type
        self.channels = channels
        self.templates = {}
    
    def add_template(self, channel: str, template: Dict[str, Any]):
        """Add template for a specific channel."""
        self.templates[channel] = template
    
    def render(self, channel: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Render template for a specific channel."""
        if channel not in self.templates:
            return {}
        
        template = self.templates[channel]
        rendered = {}
        
        for key, value in template.items():
            if isinstance(value, str):
                # Simple template substitution
                rendered[key] = value.format(**data)
            else:
                rendered[key] = value
        
        return rendered


class NotificationServiceAdapter:
    """
    Notification Service Adapter.
    
    Provides a unified interface for sending notifications through multiple
    channels and manages notification templates and delivery tracking.
    """
    
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
        self.channels: Dict[str, NotificationChannel] = {}
        self.templates: Dict[str, NotificationTemplate] = {}
        self.notification_history: List[Dict[str, Any]] = []
        
        # Initialize channels and templates
        self._initialize_channels()
        self._initialize_templates()
    
    def _initialize_channels(self):
        """Initialize notification channels from configuration."""
        # Email channel (SendGrid)
        email_config = {
            "api_key": "your_sendgrid_api_key",
            "from_email": "noreply@suuupra.com",
            "from_name": "Suuupra Commerce"
        }
        
        # SMS channel (Twilio)
        sms_config = {
            "account_sid": "your_twilio_account_sid",
            "auth_token": "your_twilio_auth_token",
            "from_number": "+1234567890"
        }
        
        # Push notification channel (FCM)
        push_config = {
            "server_key": "your_fcm_server_key",
            "project_id": "your_firebase_project_id"
        }
        
        # Slack channel
        slack_config = {
            "webhook_url": "your_slack_webhook_url"
        }
        
        try:
            self.channels["email"] = EmailChannel(**email_config)
            self.channels["sms"] = SMSChannel(**sms_config)
            self.channels["push"] = PushNotificationChannel(**push_config)
            self.channels["slack"] = SlackChannel(slack_config["webhook_url"])
        except Exception as e:
            logger.warning("Failed to initialize some notification channels", error=str(e))
    
    def _initialize_templates(self):
        """Initialize notification templates."""
        # Order Created Template
        order_created = NotificationTemplate("order_created", "OrderCreatedEvent", ["email", "sms", "push"])
        order_created.add_template("email", {
            "subject": "Order Confirmation - #{order_id}",
            "template_id": "order_confirmation",
            "data": {
                "order_id": "{order_id}",
                "customer_name": "{customer_name}",
                "total_amount": "{total_amount}",
                "items": "{items}"
            }
        })
        order_created.add_template("sms", {
            "message": "Your order #{order_id} has been confirmed! Total: ${total_amount}. Track at suuupra.com/orders/{order_id}"
        })
        order_created.add_template("push", {
            "title": "Order Confirmed",
            "message": "Order #{order_id} confirmed - ${total_amount}",
            "click_action": "/orders/{order_id}"
        })
        
        # Order Cancelled Template
        order_cancelled = NotificationTemplate("order_cancelled", "OrderCancelledEvent", ["email", "sms"])
        order_cancelled.add_template("email", {
            "subject": "Order Cancelled - #{order_id}",
            "template_id": "order_cancellation",
            "data": {
                "order_id": "{order_id}",
                "cancellation_reason": "{cancellation_reason}",
                "refund_amount": "{refund_amount}"
            }
        })
        order_cancelled.add_template("sms", {
            "message": "Order #{order_id} has been cancelled. Refund of ${refund_amount} will be processed within 3-5 business days."
        })
        
        # Order Shipped Template
        order_shipped = NotificationTemplate("order_shipped", "OrderShippedEvent", ["email", "sms", "push"])
        order_shipped.add_template("email", {
            "subject": "Your Order Has Shipped - #{order_id}",
            "template_id": "order_shipped",
            "data": {
                "order_id": "{order_id}",
                "tracking_number": "{tracking_number}",
                "carrier": "{carrier}",
                "estimated_delivery": "{estimated_delivery}"
            }
        })
        order_shipped.add_template("sms", {
            "message": "Your order #{order_id} has shipped! Track with {carrier}: {tracking_number}"
        })
        order_shipped.add_template("push", {
            "title": "Order Shipped",
            "message": "Order #{order_id} is on its way!",
            "click_action": "/orders/{order_id}/tracking"
        })
        
        # Order Delivered Template
        order_delivered = NotificationTemplate("order_delivered", "OrderDeliveredEvent", ["email", "sms", "push"])
        order_delivered.add_template("email", {
            "subject": "Order Delivered - #{order_id}",
            "template_id": "order_delivered",
            "data": {
                "order_id": "{order_id}",
                "delivered_at": "{delivered_at}",
                "delivered_to": "{delivered_to}"
            }
        })
        order_delivered.add_template("sms", {
            "message": "Your order #{order_id} has been delivered! Enjoy your purchase."
        })
        order_delivered.add_template("push", {
            "title": "Order Delivered",
            "message": "Order #{order_id} has been delivered!",
            "click_action": "/orders/{order_id}"
        })
        
        # Low Stock Alert Template
        low_stock_alert = NotificationTemplate("low_stock_alert", "LowStockAlertEvent", ["slack", "email"])
        low_stock_alert.add_template("slack", {
            "message": "🚨 Low Stock Alert",
            "attachments": [
                {
                    "color": "warning",
                    "fields": [
                        {
                            "title": "Product",
                            "value": "{product_id} ({sku})",
                            "short": True
                        },
                        {
                            "title": "Current Stock",
                            "value": "{current_quantity}",
                            "short": True
                        },
                        {
                            "title": "Threshold",
                            "value": "{low_stock_threshold}",
                            "short": True
                        }
                    ]
                }
            ]
        })
        low_stock_alert.add_template("email", {
            "subject": "Low Stock Alert - {sku}",
            "template_id": "low_stock_alert",
            "data": {
                "product_id": "{product_id}",
                "sku": "{sku}",
                "current_quantity": "{current_quantity}",
                "low_stock_threshold": "{low_stock_threshold}"
            }
        })
        
        # Store templates
        self.templates["order_created"] = order_created
        self.templates["order_cancelled"] = order_cancelled
        self.templates["order_shipped"] = order_shipped
        self.templates["order_delivered"] = order_delivered
        self.templates["low_stock_alert"] = low_stock_alert
    
    async def send_notification(self, notification: Dict[str, Any]) -> Dict[str, Any]:
        """
        Send a single notification.
        
        Args:
            notification: Notification details including type, recipient, channel, etc.
            
        Returns:
            Sending result
        """
        try:
            channel = notification.get("channel")
            if channel not in self.channels:
                return {"success": False, "error": f"Channel {channel} not available"}
            
            # Send notification
            channel_instance = self.channels[channel]
            async with channel_instance:
                result = await channel_instance.send(notification)
            
            # Store in history
            history_entry = {
                "notification_id": result.get("notification_id", str(uuid4())),
                "type": notification.get("type"),
                "channel": channel,
                "recipient": notification.get("recipient"),
                "status": result.get("status", "failed" if not result.get("success") else "sent"),
                "sent_at": datetime.now(timezone.utc),
                "error": result.get("error")
            }
            self.notification_history.append(history_entry)
            
            logger.info(
                "Notification sent",
                notification_id=history_entry["notification_id"],
                channel=channel,
                success=result.get("success", False)
            )
            
            return result
            
        except Exception as e:
            logger.error("Notification sending failed", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def send_event_notification(self, event: DomainEvent) -> List[Dict[str, Any]]:
        """
        Send notifications for a domain event.
        
        Args:
            event: Domain event to send notifications for
            
        Returns:
            List of sending results
        """
        try:
            event_type = event.event_type
            template_key = self._get_template_key(event_type)
            
            if template_key not in self.templates:
                logger.debug(f"No notification template for event type: {event_type}")
                return []
            
            template = self.templates[template_key]
            results = []
            
            # Extract event data
            event_data = self._extract_event_data(event)
            
            # Send notifications for each configured channel
            for channel in template.channels:
                if channel not in self.channels:
                    continue
                
                # Render template
                rendered = template.render(channel, event_data)
                if not rendered:
                    continue
                
                # Prepare notification
                notification = {
                    "type": event_type,
                    "channel": channel,
                    "recipient": self._get_recipient(event, channel),
                    **rendered
                }
                
                # Send notification
                result = await self.send_notification(notification)
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error("Event notification failed", event_type=event.event_type, error=str(e))
            return []
    
    async def send_bulk_notifications(self, notifications: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Send multiple notifications concurrently.
        
        Args:
            notifications: List of notifications to send
            
        Returns:
            List of sending results
        """
        try:
            tasks = [self.send_notification(notification) for notification in notifications]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle exceptions in results
            processed_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    processed_results.append({
                        "success": False,
                        "error": str(result),
                        "notification_index": i
                    })
                else:
                    processed_results.append(result)
            
            return processed_results
            
        except Exception as e:
            logger.error("Bulk notification sending failed", error=str(e))
            return [{"success": False, "error": str(e)}] * len(notifications)
    
    def _get_template_key(self, event_type: str) -> str:
        """Map event type to template key."""
        mapping = {
            "OrderCreatedEvent": "order_created",
            "OrderCancelledEvent": "order_cancelled",
            "OrderShippedEvent": "order_shipped",
            "OrderDeliveredEvent": "order_delivered",
            "LowStockAlertEvent": "low_stock_alert",
            "ReorderRequiredEvent": "low_stock_alert"  # Reuse low stock template
        }
        return mapping.get(event_type, event_type.lower())
    
    def _extract_event_data(self, event: DomainEvent) -> Dict[str, Any]:
        """Extract data from domain event for template rendering."""
        data = event.model_dump()
        
        # Add formatted fields
        if hasattr(event, 'occurred_at'):
            data['formatted_date'] = event.occurred_at.strftime('%B %d, %Y at %I:%M %p')
        
        return data
    
    def _get_recipient(self, event: DomainEvent, channel: str) -> str:
        """Get notification recipient based on event and channel."""
        # This would typically look up user preferences and contact information
        if channel == "slack":
            return "#alerts"  # Slack channel
        elif hasattr(event, 'customer_id'):
            # Look up customer contact info
            return self._get_customer_contact(event.customer_id, channel)
        else:
            return "admin@suuupra.com"  # Default admin contact
    
    def _get_customer_contact(self, customer_id: str, channel: str) -> str:
        """Get customer contact information for the specified channel."""
        # This would typically query a customer service or user database
        # For now, return placeholder
        if channel == "email":
            return f"customer_{customer_id}@example.com"
        elif channel == "sms":
            return f"+1234567{customer_id[-3:]}"
        elif channel == "push":
            return f"fcm_token_{customer_id}"
        else:
            return customer_id
    
    async def get_notification_status(self, notification_id: str) -> Dict[str, Any]:
        """Get delivery status for a notification."""
        # Find in history
        for entry in self.notification_history:
            if entry["notification_id"] == notification_id:
                return {
                    "notification_id": notification_id,
                    "status": entry["status"],
                    "sent_at": entry["sent_at"],
                    "channel": entry["channel"],
                    "recipient": entry["recipient"]
                }
        
        return {"error": "Notification not found"}
    
    def get_notification_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent notification history."""
        return self.notification_history[-limit:]
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of all notification channels."""
        health_status = {
            "healthy": True,
            "channels": {}
        }
        
        for channel_name, channel_instance in self.channels.items():
            try:
                # Simple health check - this would be channel-specific
                health_status["channels"][channel_name] = {"status": "healthy"}
            except Exception as e:
                health_status["channels"][channel_name] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
                health_status["healthy"] = False
        
        return health_status
