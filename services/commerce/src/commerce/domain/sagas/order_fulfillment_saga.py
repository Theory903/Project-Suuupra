"""
Order Fulfillment Saga - Orchestrates the complete order processing workflow.

This saga coordinates the distributed transaction for order fulfillment:
1. Authorize payment
2. Reserve inventory
3. Create shipping label
4. Confirm order
5. Capture payment
6. Send notifications

With compensating transactions for each step in case of failures.
"""

from typing import Dict, List, Any, Optional
from decimal import Decimal
import structlog

from .base import BaseSaga, SagaInstance, SagaStep, SagaExecutionError
from ..events.order_events import (
    OrderCreatedEvent,
    PaymentAuthorizedEvent,
    InventoryReservedEvent,
    OrderShippedEvent,
    OrderConfirmedEvent,
)

logger = structlog.get_logger(__name__)


class OrderFulfillmentSaga(BaseSaga):
    """
    Saga for orchestrating order fulfillment process.
    
    Handles the complete order lifecycle from creation to delivery,
    with proper error handling and compensating transactions.
    """
    
    @property
    def saga_type(self) -> str:
        return "order_fulfillment"
    
    def define_steps(self, context_data: Dict[str, Any]) -> List[SagaStep]:
        """
        Define the order fulfillment steps based on order context.
        
        Args:
            context_data: Order data including customer_id, items, payment_method, etc.
        """
        order_id = context_data.get("order_id")
        
        steps = [
            SagaStep(
                step_id=f"authorize_payment_{order_id}",
                step_name="Authorize Payment",
                step_type="authorize_payment",
                input_data={
                    "order_id": order_id,
                    "customer_id": context_data.get("customer_id"),
                    "payment_method": context_data.get("payment_method"),
                    "amount": context_data.get("total_amount"),
                    "currency": context_data.get("currency", "USD"),
                },
                max_retries=3,
            ),
            SagaStep(
                step_id=f"reserve_inventory_{order_id}",
                step_name="Reserve Inventory",
                step_type="reserve_inventory",
                input_data={
                    "order_id": order_id,
                    "items": context_data.get("items", []),
                },
                max_retries=2,
            ),
            SagaStep(
                step_id=f"create_shipment_{order_id}",
                step_name="Create Shipment",
                step_type="create_shipment",
                input_data={
                    "order_id": order_id,
                    "shipping_address": context_data.get("shipping_address"),
                    "items": context_data.get("items", []),
                },
                max_retries=2,
            ),
            SagaStep(
                step_id=f"confirm_order_{order_id}",
                step_name="Confirm Order",
                step_type="confirm_order",
                input_data={
                    "order_id": order_id,
                },
                max_retries=1,
            ),
            SagaStep(
                step_id=f"capture_payment_{order_id}",
                step_name="Capture Payment",
                step_type="capture_payment",
                input_data={
                    "order_id": order_id,
                },
                max_retries=3,
            ),
            SagaStep(
                step_id=f"send_confirmation_{order_id}",
                step_name="Send Order Confirmation",
                step_type="send_notification",
                input_data={
                    "order_id": order_id,
                    "customer_id": context_data.get("customer_id"),
                    "notification_type": "order_confirmation",
                },
                max_retries=2,
            ),
        ]
        
        return steps
    
    def _register_handlers(self) -> None:
        """Register step and compensation handlers."""
        # Step handlers
        self.step_handlers = {
            "authorize_payment": self._authorize_payment,
            "reserve_inventory": self._reserve_inventory,
            "create_shipment": self._create_shipment,
            "confirm_order": self._confirm_order,
            "capture_payment": self._capture_payment,
            "send_notification": self._send_notification,
        }
        
        # Compensation handlers
        self.compensation_handlers = {
            "authorize_payment": self._void_payment_authorization,
            "reserve_inventory": self._release_inventory_reservation,
            "create_shipment": self._cancel_shipment,
            "capture_payment": self._refund_payment,
        }
    
    # Step Handlers
    
    async def _authorize_payment(
        self,
        instance: SagaInstance,
        step: SagaStep
    ) -> Dict[str, Any]:
        """Authorize payment for the order."""
        input_data = step.input_data
        
        # Integrate with actual payment service
        try:
            import httpx
            import os
            from decimal import Decimal
            
            # Get payment service configuration
            payments_service_url = os.getenv('PAYMENTS_SERVICE_URL', 'http://localhost:8083')
            
            # Prepare payment authorization request
            payment_request = {
                "amount": str(input_data["amount"]),
                "currency": input_data.get("currency", "INR"),
                "payment_method": input_data["payment_method"],
                "merchant_id": input_data.get("merchant_id"),
                "customer_id": input_data.get("customer_id"),
                "description": f"Order payment for order {input_data['order_id']}",
                "metadata": {
                    "order_id": input_data["order_id"],
                    "saga_id": str(instance.saga_id),
                }
            }
            
            # Call payments service to create payment intent
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{payments_service_url}/api/v1/payment-intents",
                    json=payment_request,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 201:
                    error_detail = response.json().get("error", "Payment authorization failed")
                    raise SagaExecutionError(
                        instance.saga_id,
                        step.step_name,
                        f"Payment service error: {error_detail}"
                    )
                
                payment_intent = response.json()
                
                # Create actual payment
                payment_request_data = {
                    "payment_intent_id": payment_intent["id"],
                    "payment_method_details": {
                        "type": input_data["payment_method"],
                        "upi": {
                            "vpa": input_data.get("upi_vpa")
                        } if input_data["payment_method"] == "upi" else None
                    }
                }
                
                payment_response = await client.post(
                    f"{payments_service_url}/api/v1/payments",
                    json=payment_request_data,
                    headers={"Content-Type": "application/json"}
                )
                
                if payment_response.status_code != 201:
                    error_detail = payment_response.json().get("error", "Payment processing failed")
                    raise SagaExecutionError(
                        instance.saga_id,
                        step.step_name,
                        f"Payment processing error: {error_detail}"
                    )
                
                payment_result = payment_response.json()
                
                payment_data = {
                    "payment_intent_id": payment_intent["id"],
                    "payment_id": payment_result["id"],
                    "payment_transaction_id": payment_result.get("rail_transaction_id"),
                    "authorization_code": payment_result.get("authorization_code"),
                    "authorized_amount": payment_result["amount"],
                    "payment_method": payment_result["payment_method"],
                    "status": payment_result["status"],
                }
                
        except httpx.RequestError as e:
            raise SagaExecutionError(
                instance.saga_id,
                step.step_name,
                f"Payment service communication error: {str(e)}"
            )
        except Exception as e:
            raise SagaExecutionError(
                instance.saga_id,
                step.step_name,
                f"Payment authorization error: {str(e)}"
            )
        
        logger.info(
            "Payment authorized",
            saga_id=instance.saga_id,
            order_id=input_data["order_id"],
            amount=input_data["amount"],
            transaction_id=payment_data["payment_transaction_id"],
        )
        
        return payment_data
    
    async def _reserve_inventory(
        self,
        instance: SagaInstance,
        step: SagaStep
    ) -> Dict[str, Any]:
        """Reserve inventory for order items."""
        input_data = step.input_data
        items = input_data.get("items", [])
        
        # Integrate with actual inventory service
        try:
            import httpx
            import os
            
            # Get inventory service configuration
            inventory_service_url = os.getenv('INVENTORY_SERVICE_URL', 'http://localhost:8085')
            
            reservations = []
            reservation_errors = []
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                for item in items:
                    # Call inventory service to reserve each item
                    reservation_request = {
                        "product_id": item["product_id"],
                        "quantity": item["quantity"],
                        "reservation_reason": "order_fulfillment",
                        "reference_id": str(instance.saga_id),
                        "expires_at": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
                    }
                    
                    try:
                        response = await client.post(
                            f"{inventory_service_url}/api/v1/reservations",
                            json=reservation_request,
                            headers={"Content-Type": "application/json"}
                        )
                        
                        if response.status_code == 201:
                            reservation_result = response.json()
                            reservations.append({
                                "product_id": item["product_id"],
                                "quantity_reserved": reservation_result["quantity_reserved"],
                                "reservation_id": reservation_result["reservation_id"],
                                "expires_at": reservation_result["expires_at"],
                            })
                        else:
                            error_detail = response.json().get("error", "Inventory reservation failed")
                            reservation_errors.append(f"Product {item['product_id']}: {error_detail}")
                            
                    except httpx.RequestError as e:
                        reservation_errors.append(f"Product {item['product_id']}: Service communication error - {str(e)}")
                
                # If any reservations failed, this step should fail
                if reservation_errors:
                    raise SagaExecutionError(
                        instance.saga_id,
                        step.step_name,
                        f"Inventory reservation failed: {'; '.join(reservation_errors)}"
                    )
            
            reservation_data = {
                "reservation_id": f"order_res_{instance.saga_id}",
                "reservations": reservations,
                "total_items_reserved": len(reservations),
            }
            
        except SagaExecutionError:
            raise  # Re-raise saga errors
        except Exception as e:
            raise SagaExecutionError(
                instance.saga_id,
                step.step_name,
                f"Inventory reservation error: {str(e)}"
            )
        
        logger.info(
            "Inventory reserved",
            saga_id=instance.saga_id,
            order_id=input_data["order_id"],
            reservation_count=len(reservations),
        )
        
        return reservation_data
    
    async def _create_shipment(
        self,
        instance: SagaInstance,
        step: SagaStep
    ) -> Dict[str, Any]:
        """Create shipment and shipping label."""
        input_data = step.input_data
        
        # Integrate with actual shipping service
        try:
            import httpx
            import os
            
            # Get shipping service configuration
            shipping_service_url = os.getenv('SHIPPING_SERVICE_URL', 'http://localhost:8086')
            
            # Prepare shipment request
            shipment_request = {
                "order_id": input_data["order_id"],
                "customer_address": input_data["shipping_address"],
                "items": input_data.get("items", []),
                "shipping_method": input_data.get("shipping_method", "standard"),
                "reference_id": str(instance.saga_id),
                "metadata": {
                    "saga_id": str(instance.saga_id),
                    "order_type": "commerce",
                }
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{shipping_service_url}/api/v1/shipments",
                    json=shipment_request,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 201:
                    error_detail = response.json().get("error", "Shipment creation failed")
                    raise SagaExecutionError(
                        instance.saga_id,
                        step.step_name,
                        f"Shipping service error: {error_detail}"
                    )
                
                shipment_result = response.json()
                
                shipment_data = {
                    "shipment_id": shipment_result["shipment_id"],
                    "tracking_number": shipment_result["tracking_number"],
                    "carrier": shipment_result.get("carrier"),
                    "estimated_delivery": shipment_result.get("estimated_delivery"),
                    "shipping_cost": shipment_result.get("shipping_cost", 0),
                    "label_url": shipment_result.get("label_url"),
                }
                
        except httpx.RequestError as e:
            raise SagaExecutionError(
                instance.saga_id,
                step.step_name,
                f"Shipping service communication error: {str(e)}"
            )
        except Exception as e:
            raise SagaExecutionError(
                instance.saga_id,
                step.step_name,
                f"Shipment creation error: {str(e)}"
            )
        
        logger.info(
            "Shipment created",
            saga_id=instance.saga_id,
            order_id=input_data["order_id"],
            tracking_number=shipment_data["tracking_number"],
        )
        
        return shipment_data
    
    async def _confirm_order(
        self,
        instance: SagaInstance,
        step: SagaStep
    ) -> Dict[str, Any]:
        """Confirm the order after all prerequisites are met."""
        input_data = step.input_data
        
        # At this point, payment is authorized, inventory is reserved,
        # and shipment is ready. We can safely confirm the order.
        
        confirmation_data = {
            "order_confirmed": True,
            "confirmation_number": f"ORD{instance.saga_id[:8].upper()}",
            "confirmed_at": instance.created_at.isoformat(),
        }
        
        logger.info(
            "Order confirmed",
            saga_id=instance.saga_id,
            order_id=input_data["order_id"],
            confirmation_number=confirmation_data["confirmation_number"],
        )
        
        return confirmation_data
    
    async def _capture_payment(
        self,
        instance: SagaInstance,
        step: SagaStep
    ) -> Dict[str, Any]:
        """Capture the authorized payment."""
        input_data = step.input_data
        
        # Get payment authorization from previous step
        auth_step = next(
            s for s in instance.steps 
            if s.step_type == "authorize_payment"
        )
        auth_data = auth_step.output_data
        
        # Integrate with actual payment service for payment capture
        try:
            import httpx
            import os
            
            # Get payment service configuration
            payments_service_url = os.getenv('PAYMENTS_SERVICE_URL', 'http://localhost:8083')
            
            # Prepare payment capture request
            capture_request = {
                "payment_id": input_data["payment_id"],
                "amount": str(input_data["amount"]),
                "capture_reason": "order_fulfillment_completed",
                "metadata": {
                    "order_id": input_data["order_id"],
                    "saga_id": str(instance.saga_id),
                }
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{payments_service_url}/api/v1/payments/{input_data['payment_id']}/capture",
                    json=capture_request,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code != 200:
                    error_detail = response.json().get("error", "Payment capture failed")
                    raise SagaExecutionError(
                        instance.saga_id,
                        step.step_name,
                        f"Payment capture error: {error_detail}"
                    )
                
                capture_result = response.json()
                
                capture_data = {
                    "capture_transaction_id": capture_result.get("transaction_id"),
                    "captured_amount": capture_result["amount"],
                    "capture_status": capture_result["status"],
                    "captured_at": capture_result.get("captured_at"),
                    "fees": capture_result.get("fees", {}),
                }
                
        except httpx.RequestError as e:
            raise SagaExecutionError(
                instance.saga_id,
                step.step_name,
                f"Payment service communication error: {str(e)}"
            )
        except Exception as e:
            raise SagaExecutionError(
                instance.saga_id,
                step.step_name,
                f"Payment capture error: {str(e)}"
            )
        
        logger.info(
            "Payment captured",
            saga_id=instance.saga_id,
            order_id=input_data["order_id"],
            amount=capture_data["captured_amount"],
        )
        
        return capture_data
    
    async def _send_notification(
        self,
        instance: SagaInstance,
        step: SagaStep
    ) -> Dict[str, Any]:
        """Send order confirmation notification."""
        input_data = step.input_data
        
        # Integrate with actual notification service
        try:
            import httpx
            import os
            
            # Get notification service configuration
            notifications_service_url = os.getenv('NOTIFICATIONS_SERVICE_URL', 'http://localhost:8087')
            
            # Prepare notification request
            notification_request = {
                "customer_id": input_data["customer_id"],
                "type": "order_confirmation",
                "channel": "email",  # Could also be 'sms', 'push'
                "template": "order_confirmation",
                "data": {
                    "order_id": input_data["order_id"],
                    "customer_name": input_data.get("customer_name", "Valued Customer"),
                    "order_total": str(input_data.get("amount", 0)),
                    "items": input_data.get("items", []),
                    "tracking_number": input_data.get("tracking_number"),
                    "estimated_delivery": input_data.get("estimated_delivery"),
                },
                "metadata": {
                    "saga_id": str(instance.saga_id),
                    "order_type": "commerce",
                }
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{notifications_service_url}/api/v1/notifications",
                    json=notification_request,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code not in [200, 201]:
                    # Log error but don't fail the saga for notification failures
                    logger.warning(
                        "Notification sending failed",
                        saga_id=instance.saga_id,
                        order_id=input_data["order_id"],
                        error=response.json().get("error", "Unknown error")
                    )
                    
                    notification_data = {
                        "notification_id": f"failed_{instance.saga_id}",
                        "status": "failed",
                        "error": response.json().get("error", "Unknown error")
                    }
                else:
                    notification_result = response.json()
                    notification_data = {
                        "notification_id": notification_result["notification_id"],
                        "status": notification_result["status"],
                        "sent_at": notification_result.get("sent_at"),
                        "delivery_method": notification_result.get("delivery_method"),
                    }
                
        except httpx.RequestError as e:
            # Log error but don't fail the saga for notification communication issues
            logger.warning(
                "Notification service communication error",
                saga_id=instance.saga_id,
                order_id=input_data["order_id"],
                error=str(e)
            )
            notification_data = {
                "notification_id": f"comm_error_{instance.saga_id}",
                "status": "failed",
                "error": f"Communication error: {str(e)}"
            }
        except Exception as e:
            # Log error but don't fail the saga for notification issues
            logger.warning(
                "Notification error", 
                saga_id=instance.saga_id,
                error=str(e)
            )
            notification_data = {
                "notification_id": f"error_{instance.saga_id}",
                "status": "failed", 
                "error": str(e)
            }
        
        logger.info(
            "Notification sent",
            saga_id=instance.saga_id,
            order_id=input_data["order_id"],
            notification_type=input_data["notification_type"],
        )
        
        return notification_data
    
    # Compensation Handlers
    
    async def _void_payment_authorization(
        self,
        instance: SagaInstance,
        step: SagaStep
    ) -> None:
        """Void the payment authorization."""
        auth_data = step.output_data
        
        # Integrate with actual payment service to void authorization
        try:
            import httpx
            import os
            
            # Get payment service configuration
            payments_service_url = os.getenv('PAYMENTS_SERVICE_URL', 'http://localhost:8083')
            
            if auth_data.get("payment_intent_id"):
                # Cancel/void the payment intent
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.delete(
                        f"{payments_service_url}/api/v1/payment-intents/{auth_data['payment_intent_id']}",
                        headers={"Content-Type": "application/json"}
                    )
                    
                    if response.status_code not in [200, 404]:  # 404 is acceptable (already voided)
                        logger.warning(
                            "Failed to void payment authorization",
                            saga_id=instance.saga_id,
                            payment_intent_id=auth_data["payment_intent_id"],
                            error=response.json().get("error", "Unknown error")
                        )
        
        except Exception as e:
            logger.warning(
                "Payment service communication failed during void",
                saga_id=instance.saga_id,
                error=str(e)
            )
        
        logger.info(
            "Payment authorization voided",
            saga_id=instance.saga_id,
            transaction_id=auth_data.get("payment_transaction_id"),
        )
    
    async def _release_inventory_reservation(
        self,
        instance: SagaInstance,
        step: SagaStep
    ) -> None:
        """Release the inventory reservation."""
        reservation_data = step.output_data
        
        # Integrate with actual inventory service to release reservation
        try:
            import httpx
            import os
            
            # Get inventory service configuration
            inventory_service_url = os.getenv('INVENTORY_SERVICE_URL', 'http://localhost:8085')
            
            if reservation_data.get("reservations"):
                # Release each reservation
                async with httpx.AsyncClient(timeout=30.0) as client:
                    for reservation in reservation_data["reservations"]:
                        if reservation.get("reservation_id"):
                            try:
                                response = await client.delete(
                                    f"{inventory_service_url}/api/v1/reservations/{reservation['reservation_id']}",
                                    headers={"Content-Type": "application/json"}
                                )
                                
                                if response.status_code not in [200, 404]:  # 404 is acceptable (already released)
                                    logger.warning(
                                        "Failed to release inventory reservation",
                                        saga_id=instance.saga_id,
                                        reservation_id=reservation["reservation_id"],
                                        error=response.json().get("error", "Unknown error")
                                    )
                            except Exception as e:
                                logger.warning(
                                    "Failed to release individual reservation",
                                    saga_id=instance.saga_id,
                                    reservation_id=reservation.get("reservation_id"),
                                    error=str(e)
                                )
        
        except Exception as e:
            logger.warning(
                "Inventory service communication failed during release",
                saga_id=instance.saga_id,
                error=str(e)
            )
        
        logger.info(
            "Inventory reservation released",
            saga_id=instance.saga_id,
            reservation_id=reservation_data.get("reservation_id"),
        )
    
    async def _cancel_shipment(
        self,
        instance: SagaInstance,
        step: SagaStep
    ) -> None:
        """Cancel the shipment."""
        shipment_data = step.output_data
        
        # Integrate with actual shipping service to cancel shipment
        try:
            import httpx
            import os
            
            # Get shipping service configuration
            shipping_service_url = os.getenv('SHIPPING_SERVICE_URL', 'http://localhost:8086')
            
            if shipment_data.get("shipment_id"):
                # Cancel the shipment
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.delete(
                        f"{shipping_service_url}/api/v1/shipments/{shipment_data['shipment_id']}",
                        headers={"Content-Type": "application/json"}
                    )
                    
                    if response.status_code not in [200, 404]:  # 404 is acceptable (already cancelled)
                        logger.warning(
                            "Failed to cancel shipment",
                            saga_id=instance.saga_id,
                            shipment_id=shipment_data["shipment_id"],
                            error=response.json().get("error", "Unknown error")
                        )
        
        except Exception as e:
            logger.warning(
                "Shipping service communication failed during cancellation",
                saga_id=instance.saga_id,
                error=str(e)
            )
        
        logger.info(
            "Shipment cancelled",
            saga_id=instance.saga_id,
            shipment_id=shipment_data.get("shipment_id"),
        )
    
    async def _refund_payment(
        self,
        instance: SagaInstance,
        step: SagaStep
    ) -> None:
        """Refund the captured payment."""
        capture_data = step.output_data
        
        # Integrate with actual payment service to process refund
        try:
            import httpx
            import os
            
            # Get payment service configuration
            payments_service_url = os.getenv('PAYMENTS_SERVICE_URL', 'http://localhost:8083')
            
            if capture_data.get("capture_transaction_id"):
                # Create refund request
                refund_request = {
                    "transaction_id": capture_data["capture_transaction_id"],
                    "amount": str(capture_data.get("captured_amount", 0)),
                    "reason": "order_cancellation",
                    "metadata": {
                        "saga_id": str(instance.saga_id),
                        "refund_type": "order_cancellation"
                    }
                }
                
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f"{payments_service_url}/api/v1/refunds",
                        json=refund_request,
                        headers={"Content-Type": "application/json"}
                    )
                    
                    if response.status_code not in [200, 201]:
                        logger.warning(
                            "Failed to process refund",
                            saga_id=instance.saga_id,
                            transaction_id=capture_data["capture_transaction_id"],
                            error=response.json().get("error", "Unknown error")
                        )
                    else:
                        refund_result = response.json()
                        logger.info(
                            "Refund processed successfully",
                            saga_id=instance.saga_id,
                            refund_id=refund_result.get("refund_id"),
                            refund_status=refund_result.get("status")
                        )
        
        except Exception as e:
            logger.warning(
                "Payment service communication failed during refund",
                saga_id=instance.saga_id,
                error=str(e)
            )
        
        logger.info(
            "Payment refunded",
            saga_id=instance.saga_id,
            transaction_id=capture_data.get("payment_transaction_id"),
            amount=capture_data.get("captured_amount"),
        )
