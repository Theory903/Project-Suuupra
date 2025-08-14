"""
Shipping Service Integration for the Commerce Service.

This module provides integration with external shipping carriers and services,
including shipment creation, tracking updates, and delivery notifications.
"""

import asyncio
import aiohttp
from decimal import Decimal
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from uuid import UUID
import structlog

from ...domain.events.order_events import OrderShippedEvent, OrderDeliveredEvent
from ..messaging.event_bus import EventBus


logger = structlog.get_logger(__name__)


class ShippingCarrier:
    """Base class for shipping carrier integrations."""
    
    def __init__(self, name: str, api_key: str, base_url: str):
        self.name = name
        self.api_key = api_key
        self.base_url = base_url
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def create_shipment(self, shipment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new shipment with the carrier."""
        raise NotImplementedError
    
    async def get_tracking_info(self, tracking_number: str) -> Dict[str, Any]:
        """Get tracking information for a shipment."""
        raise NotImplementedError
    
    async def cancel_shipment(self, tracking_number: str) -> Dict[str, Any]:
        """Cancel a shipment."""
        raise NotImplementedError
    
    async def get_shipping_rates(self, shipment_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get shipping rates for a shipment."""
        raise NotImplementedError


class FedExCarrier(ShippingCarrier):
    """FedEx shipping carrier integration."""
    
    def __init__(self, api_key: str, account_number: str, meter_number: str):
        super().__init__("FedEx", api_key, "https://apis.fedex.com/")
        self.account_number = account_number
        self.meter_number = meter_number
    
    async def create_shipment(self, shipment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create FedEx shipment."""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "labelResponseOptions": "URL_ONLY",
                "requestedShipment": {
                    "shipper": shipment_data["shipper"],
                    "recipients": [shipment_data["recipient"]],
                    "shipDatestamp": shipment_data["ship_date"],
                    "serviceType": shipment_data.get("service_type", "FEDEX_GROUND"),
                    "packagingType": shipment_data.get("packaging_type", "YOUR_PACKAGING"),
                    "requestedPackageLineItems": shipment_data["packages"]
                },
                "accountNumber": {
                    "value": self.account_number
                }
            }
            
            async with self.session.post(
                f"{self.base_url}ship/v1/shipments",
                headers=headers,
                json=payload
            ) as response:
                result = await response.json()
                
                if response.status == 200:
                    tracking_number = result["output"]["transactionShipments"][0]["masterTrackingNumber"]
                    label_url = result["output"]["transactionShipments"][0]["pieceResponses"][0]["packageDocuments"][0]["url"]
                    
                    return {
                        "success": True,
                        "tracking_number": tracking_number,
                        "label_url": label_url,
                        "carrier": "FedEx"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("errors", [{"message": "Unknown error"}])[0]["message"]
                    }
                    
        except Exception as e:
            logger.error("FedEx shipment creation failed", error=str(e))
            return {"success": False, "error": str(e)}
    
    async def get_tracking_info(self, tracking_number: str) -> Dict[str, Any]:
        """Get FedEx tracking information."""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "includeDetailedScans": True,
                "trackingInfo": [
                    {
                        "trackingNumberInfo": {
                            "trackingNumber": tracking_number
                        }
                    }
                ]
            }
            
            async with self.session.post(
                f"{self.base_url}track/v1/trackingnumbers",
                headers=headers,
                json=payload
            ) as response:
                result = await response.json()
                
                if response.status == 200:
                    track_result = result["output"]["completeTrackResults"][0]["trackResults"][0]
                    
                    return {
                        "success": True,
                        "tracking_number": tracking_number,
                        "status": track_result["latestStatusDetail"]["description"],
                        "status_code": track_result["latestStatusDetail"]["code"],
                        "location": track_result["latestStatusDetail"]["scanLocation"],
                        "timestamp": track_result["latestStatusDetail"]["eventTimestamp"],
                        "estimated_delivery": track_result.get("estimatedDeliveryTimeWindow", {}).get("window", {}).get("begins"),
                        "carrier": "FedEx"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("errors", [{"message": "Unknown error"}])[0]["message"]
                    }
                    
        except Exception as e:
            logger.error("FedEx tracking lookup failed", error=str(e))
            return {"success": False, "error": str(e)}


class UPSCarrier(ShippingCarrier):
    """UPS shipping carrier integration."""
    
    def __init__(self, api_key: str, username: str, password: str, account_number: str):
        super().__init__("UPS", api_key, "https://onlinetools.ups.com/")
        self.username = username
        self.password = password
        self.account_number = account_number
    
    async def create_shipment(self, shipment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create UPS shipment."""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "ShipmentRequest": {
                    "Request": {
                        "RequestOption": "nonvalidate",
                        "TransactionReference": {
                            "CustomerContext": shipment_data.get("reference", "")
                        }
                    },
                    "Shipment": {
                        "Shipper": shipment_data["shipper"],
                        "ShipTo": shipment_data["recipient"],
                        "Service": {
                            "Code": shipment_data.get("service_code", "03")  # Ground
                        },
                        "Package": shipment_data["packages"][0]  # UPS typically handles one package per request
                    },
                    "LabelSpecification": {
                        "LabelImageFormat": {
                            "Code": "PDF"
                        }
                    }
                }
            }
            
            async with self.session.post(
                f"{self.base_url}ship/v1/shipments",
                headers=headers,
                json=payload
            ) as response:
                result = await response.json()
                
                if response.status == 200:
                    shipment_result = result["ShipmentResponse"]["ShipmentResults"]
                    tracking_number = shipment_result["PackageResults"]["TrackingNumber"]
                    label_data = shipment_result["PackageResults"]["ShippingLabel"]["GraphicImage"]
                    
                    return {
                        "success": True,
                        "tracking_number": tracking_number,
                        "label_data": label_data,
                        "carrier": "UPS"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("Fault", {}).get("detail", {}).get("Errors", {}).get("ErrorDetail", {}).get("PrimaryErrorCode", {}).get("Description", "Unknown error")
                    }
                    
        except Exception as e:
            logger.error("UPS shipment creation failed", error=str(e))
            return {"success": False, "error": str(e)}


class DHLCarrier(ShippingCarrier):
    """DHL shipping carrier integration."""
    
    def __init__(self, api_key: str, account_number: str):
        super().__init__("DHL", api_key, "https://express.api.dhl.com/")
        self.account_number = account_number
    
    async def create_shipment(self, shipment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create DHL shipment."""
        try:
            headers = {
                "Authorization": f"Basic {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "plannedShippingDateAndTime": shipment_data["ship_date"],
                "pickup": shipment_data["shipper"],
                "productCode": shipment_data.get("service_code", "N"),
                "accounts": [
                    {
                        "typeCode": "shipper",
                        "number": self.account_number
                    }
                ],
                "customerDetails": {
                    "shipperDetails": shipment_data["shipper"],
                    "receiverDetails": shipment_data["recipient"]
                },
                "content": {
                    "packages": shipment_data["packages"],
                    "isCustomsDeclarable": shipment_data.get("customs_declarable", False),
                    "declaredValue": shipment_data.get("declared_value", 0),
                    "declaredValueCurrency": shipment_data.get("currency", "USD"),
                    "description": shipment_data.get("description", "Merchandise")
                }
            }
            
            async with self.session.post(
                f"{self.base_url}mydhlapi/shipments",
                headers=headers,
                json=payload
            ) as response:
                result = await response.json()
                
                if response.status == 201:
                    tracking_number = result["shipmentTrackingNumber"]
                    
                    return {
                        "success": True,
                        "tracking_number": tracking_number,
                        "carrier": "DHL"
                    }
                else:
                    return {
                        "success": False,
                        "error": result.get("detail", "Unknown error")
                    }
                    
        except Exception as e:
            logger.error("DHL shipment creation failed", error=str(e))
            return {"success": False, "error": str(e)}


class ShippingServiceAdapter:
    """
    Shipping Service Adapter.
    
    Provides a unified interface for multiple shipping carriers and handles
    shipment creation, tracking, and delivery notifications.
    """
    
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
        self.carriers: Dict[str, ShippingCarrier] = {}
        self.default_carrier = None
        
        # Initialize carriers from configuration
        self._initialize_carriers()
    
    def _initialize_carriers(self):
        """Initialize shipping carriers from configuration."""
        # This would typically read from environment variables or config files
        
        # Example FedEx configuration
        fedex_config = {
            "api_key": "your_fedex_api_key",
            "account_number": "your_account_number",
            "meter_number": "your_meter_number"
        }
        
        # Example UPS configuration
        ups_config = {
            "api_key": "your_ups_api_key",
            "username": "your_username",
            "password": "your_password",
            "account_number": "your_account_number"
        }
        
        # Example DHL configuration
        dhl_config = {
            "api_key": "your_dhl_api_key",
            "account_number": "your_account_number"
        }
        
        # Initialize carriers (in production, check if credentials are available)
        try:
            self.carriers["fedex"] = FedExCarrier(**fedex_config)
            self.carriers["ups"] = UPSCarrier(**ups_config)
            self.carriers["dhl"] = DHLCarrier(**dhl_config)
            self.default_carrier = "fedex"
        except Exception as e:
            logger.warning("Failed to initialize some carriers", error=str(e))
    
    async def create_shipment(
        self,
        order_id: UUID,
        customer_id: str,
        shipment_data: Dict[str, Any],
        carrier: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a shipment with the specified carrier.
        
        Args:
            order_id: Order ID
            customer_id: Customer ID
            shipment_data: Shipment details
            carrier: Preferred carrier (optional)
            
        Returns:
            Shipment creation result
        """
        try:
            # Select carrier
            selected_carrier = carrier or self.default_carrier
            if selected_carrier not in self.carriers:
                return {"success": False, "error": f"Carrier {selected_carrier} not available"}
            
            carrier_instance = self.carriers[selected_carrier]
            
            # Create shipment
            async with carrier_instance:
                result = await carrier_instance.create_shipment(shipment_data)
            
            if result.get("success"):
                # Publish order shipped event
                event = OrderShippedEvent(
                    aggregate_id=str(order_id),
                    aggregate_type="order",
                    aggregate_version=1,  # Will be updated by aggregate
                    order_id=order_id,
                    customer_id=customer_id,
                    shipment_id=str(order_id),  # Using order_id as shipment_id for simplicity
                    carrier=selected_carrier,
                    tracking_number=result["tracking_number"],
                    shipped_at=datetime.now(timezone.utc),
                    estimated_delivery=None  # Could be parsed from carrier response
                )
                await self.event_bus.publish(event)
                
                logger.info(
                    "Shipment created successfully",
                    order_id=str(order_id),
                    carrier=selected_carrier,
                    tracking_number=result["tracking_number"]
                )
            
            return result
            
        except Exception as e:
            logger.error("Shipment creation failed", order_id=str(order_id), error=str(e))
            return {"success": False, "error": str(e)}
    
    async def get_tracking_info(self, tracking_number: str, carrier: Optional[str] = None) -> Dict[str, Any]:
        """
        Get tracking information for a shipment.
        
        Args:
            tracking_number: Tracking number
            carrier: Carrier name (optional, will try all if not specified)
            
        Returns:
            Tracking information
        """
        try:
            if carrier and carrier in self.carriers:
                # Try specific carrier
                carrier_instance = self.carriers[carrier]
                async with carrier_instance:
                    return await carrier_instance.get_tracking_info(tracking_number)
            else:
                # Try all carriers
                for carrier_name, carrier_instance in self.carriers.items():
                    try:
                        async with carrier_instance:
                            result = await carrier_instance.get_tracking_info(tracking_number)
                        
                        if result.get("success"):
                            return result
                    except Exception as e:
                        logger.debug(f"Carrier {carrier_name} lookup failed", error=str(e))
                        continue
                
                return {"success": False, "error": "Tracking number not found with any carrier"}
                
        except Exception as e:
            logger.error("Tracking lookup failed", tracking_number=tracking_number, error=str(e))
            return {"success": False, "error": str(e)}
    
    async def update_delivery_status(
        self,
        order_id: UUID,
        customer_id: str,
        tracking_number: str,
        status: str,
        delivered_to: Optional[str] = None,
        signature: Optional[str] = None
    ) -> bool:
        """
        Update delivery status and publish events.
        
        Args:
            order_id: Order ID
            customer_id: Customer ID
            tracking_number: Tracking number
            status: Delivery status
            delivered_to: Delivery recipient
            signature: Delivery signature
            
        Returns:
            True if successful
        """
        try:
            if status.lower() in ["delivered", "completed"]:
                # Publish order delivered event
                event = OrderDeliveredEvent(
                    aggregate_id=str(order_id),
                    aggregate_type="order",
                    aggregate_version=1,  # Will be updated by aggregate
                    order_id=order_id,
                    customer_id=customer_id,
                    shipment_id=str(order_id),
                    delivered_at=datetime.now(timezone.utc),
                    delivered_to=delivered_to or "Customer",
                    signature=signature
                )
                await self.event_bus.publish(event)
                
                logger.info(
                    "Order delivered",
                    order_id=str(order_id),
                    tracking_number=tracking_number
                )
            
            return True
            
        except Exception as e:
            logger.error("Failed to update delivery status", order_id=str(order_id), error=str(e))
            return False
    
    async def get_shipping_rates(
        self,
        origin: Dict[str, str],
        destination: Dict[str, str],
        packages: List[Dict[str, Any]],
        carriers: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Get shipping rates from multiple carriers.
        
        Args:
            origin: Origin address
            destination: Destination address
            packages: Package details
            carriers: List of carriers to check (optional)
            
        Returns:
            List of shipping rates
        """
        try:
            rates = []
            carriers_to_check = carriers or list(self.carriers.keys())
            
            shipment_data = {
                "shipper": origin,
                "recipient": destination,
                "packages": packages
            }
            
            for carrier_name in carriers_to_check:
                if carrier_name in self.carriers:
                    try:
                        carrier_instance = self.carriers[carrier_name]
                        async with carrier_instance:
                            carrier_rates = await carrier_instance.get_shipping_rates(shipment_data)
                        
                        for rate in carrier_rates:
                            rate["carrier"] = carrier_name
                            rates.append(rate)
                            
                    except Exception as e:
                        logger.warning(f"Failed to get rates from {carrier_name}", error=str(e))
                        continue
            
            # Sort rates by cost
            rates.sort(key=lambda x: x.get("cost", float('inf')))
            
            return rates
            
        except Exception as e:
            logger.error("Failed to get shipping rates", error=str(e))
            return []
    
    async def cancel_shipment(self, tracking_number: str, carrier: str) -> Dict[str, Any]:
        """
        Cancel a shipment.
        
        Args:
            tracking_number: Tracking number
            carrier: Carrier name
            
        Returns:
            Cancellation result
        """
        try:
            if carrier not in self.carriers:
                return {"success": False, "error": f"Carrier {carrier} not available"}
            
            carrier_instance = self.carriers[carrier]
            async with carrier_instance:
                return await carrier_instance.cancel_shipment(tracking_number)
                
        except Exception as e:
            logger.error("Shipment cancellation failed", tracking_number=tracking_number, error=str(e))
            return {"success": False, "error": str(e)}
    
    def get_available_carriers(self) -> List[str]:
        """Get list of available carriers."""
        return list(self.carriers.keys())
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of all carrier integrations."""
        health_status = {
            "healthy": True,
            "carriers": {}
        }
        
        for carrier_name, carrier_instance in self.carriers.items():
            try:
                # Simple health check - try to get rates for a test shipment
                test_data = {
                    "shipper": {"postalCode": "10001", "countryCode": "US"},
                    "recipient": {"postalCode": "90210", "countryCode": "US"},
                    "packages": [{"weight": {"value": 1, "units": "LB"}}]
                }
                
                async with carrier_instance:
                    await asyncio.wait_for(
                        carrier_instance.get_shipping_rates(test_data),
                        timeout=5.0
                    )
                
                health_status["carriers"][carrier_name] = {"status": "healthy"}
                
            except Exception as e:
                health_status["carriers"][carrier_name] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
                health_status["healthy"] = False
        
        return health_status
