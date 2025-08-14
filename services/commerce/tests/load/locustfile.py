"""
Load Testing for Commerce Service using Locust.

This file defines load test scenarios for the Commerce Service,
including order creation, inventory management, and payment processing.
"""

import json
import random
import uuid
from decimal import Decimal
from typing import Dict, Any, List

from locust import HttpUser, task, between, events
from locust.exception import StopUser


class CommerceServiceUser(HttpUser):
    """
    Simulates a user interacting with the Commerce Service.
    
    This user performs various commerce operations including:
    - Creating and managing orders
    - Inventory operations
    - Payment processing
    - Cart management
    """
    
    wait_time = between(1, 5)  # Wait 1-5 seconds between tasks
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.auth_token = "test-load-token"
        self.customer_id = f"load-customer-{uuid.uuid4().hex[:8]}"
        self.orders: List[str] = []
        self.inventory_items: List[str] = []
        self.reservations: List[Dict[str, str]] = []
        
    def on_start(self):
        """Called when a user starts. Set up authentication and initial data."""
        self.client.headers.update({
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json",
            "X-Customer-ID": self.customer_id
        })
        
        # Create some inventory items for testing
        self.setup_inventory_items()
    
    def setup_inventory_items(self):
        """Create inventory items for load testing."""
        for i in range(3):  # Create 3 items per user
            product_data = {
                "product_id": f"LOAD-PROD-{uuid.uuid4().hex[:8]}",
                "sku": f"LOAD-SKU-{uuid.uuid4().hex[:8]}",
                "total_quantity": random.randint(50, 200),
                "unit_price": round(random.uniform(10.0, 100.0), 2),
                "low_stock_threshold": 10,
                "reorder_point": 20,
                "cost_price": round(random.uniform(5.0, 50.0), 2)
            }
            
            response = self.client.post(
                "/api/v1/inventory/items",
                json=product_data,
                name="Create Inventory Item"
            )
            
            if response.status_code == 201:
                inventory_id = response.json().get("inventory_id")
                if inventory_id:
                    self.inventory_items.append({
                        "inventory_id": inventory_id,
                        "product_id": product_data["product_id"],
                        "sku": product_data["sku"],
                        "unit_price": product_data["unit_price"]
                    })
    
    @task(30)
    def create_order(self):
        """Create a new order (30% of requests)."""
        if not self.inventory_items:
            return
            
        # Select random items for the order
        num_items = random.randint(1, min(3, len(self.inventory_items)))
        selected_items = random.sample(self.inventory_items, num_items)
        
        order_items = []
        total_amount = Decimal("0.00")
        
        for item in selected_items:
            quantity = random.randint(1, 5)
            unit_price = Decimal(str(item["unit_price"]))
            item_total = unit_price * quantity
            total_amount += item_total
            
            order_items.append({
                "product_id": item["product_id"],
                "sku": item["sku"],
                "quantity": quantity,
                "unit_price": float(unit_price),
                "name": f"Load Test Product {item['product_id'][-8:]}"
            })
        
        order_data = {
            "customer_id": self.customer_id,
            "items": order_items,
            "shipping_address": {
                "street_line1": "123 Test Street",
                "city": "Test City",
                "state": "TS",
                "postal_code": "12345",
                "country": "US"
            },
            "billing_address": {
                "street_line1": "123 Test Street",
                "city": "Test City",
                "state": "TS",
                "postal_code": "12345",
                "country": "US"
            },
            "payment_method": "test-payment-method"
        }
        
        response = self.client.post(
            "/api/v1/orders",
            json=order_data,
            name="Create Order"
        )
        
        if response.status_code == 201:
            order_id = response.json().get("order_id")
            if order_id:
                self.orders.append(order_id)
    
    @task(20)
    def get_order_details(self):
        """Get order details (20% of requests)."""
        if not self.orders:
            return
            
        order_id = random.choice(self.orders)
        self.client.get(
            f"/api/v1/orders/{order_id}",
            name="Get Order Details"
        )
    
    @task(15)
    def list_orders(self):
        """List customer orders (15% of requests)."""
        params = {
            "customer_id": self.customer_id,
            "limit": 10,
            "offset": 0
        }
        
        self.client.get(
            "/api/v1/orders",
            params=params,
            name="List Orders"
        )
    
    @task(10)
    def reserve_inventory(self):
        """Reserve inventory (10% of requests)."""
        if not self.inventory_items:
            return
            
        item = random.choice(self.inventory_items)
        reservation_data = {
            "product_id": item["product_id"],
            "variant_id": None,
            "order_id": str(uuid.uuid4()),
            "customer_id": self.customer_id,
            "quantity": random.randint(1, 3),
            "reservation_duration_minutes": 30
        }
        
        response = self.client.post(
            "/api/v1/inventory/reservations",
            json=reservation_data,
            name="Reserve Inventory"
        )
        
        if response.status_code in [200, 201]:
            reservation_id = response.json().get("reservation_id")
            if reservation_id:
                self.reservations.append({
                    "inventory_id": item["inventory_id"],
                    "reservation_id": reservation_id,
                    "product_id": item["product_id"]
                })
    
    @task(8)
    def confirm_reservation(self):
        """Confirm inventory reservation (8% of requests)."""
        if not self.reservations:
            return
            
        reservation = random.choice(self.reservations)
        response = self.client.put(
            f"/api/v1/inventory/reservations/{reservation['inventory_id']}/{reservation['reservation_id']}/confirm",
            name="Confirm Reservation"
        )
        
        if response.status_code in [200, 204]:
            # Mark reservation as confirmed (could be fulfilled later)
            reservation["status"] = "confirmed"
    
    @task(5)
    def fulfill_reservation(self):
        """Fulfill inventory reservation (5% of requests)."""
        confirmed_reservations = [
            r for r in self.reservations 
            if r.get("status") == "confirmed"
        ]
        
        if not confirmed_reservations:
            return
            
        reservation = random.choice(confirmed_reservations)
        response = self.client.put(
            f"/api/v1/inventory/reservations/{reservation['inventory_id']}/{reservation['reservation_id']}/fulfill",
            name="Fulfill Reservation"
        )
        
        if response.status_code in [200, 204]:
            # Remove fulfilled reservation
            self.reservations.remove(reservation)
    
    @task(5)
    def cancel_reservation(self):
        """Cancel inventory reservation (5% of requests)."""
        if not self.reservations:
            return
            
        reservation = random.choice(self.reservations)
        response = self.client.put(
            f"/api/v1/inventory/reservations/{reservation['inventory_id']}/{reservation['reservation_id']}/cancel",
            name="Cancel Reservation"
        )
        
        if response.status_code in [200, 204]:
            # Remove cancelled reservation
            self.reservations.remove(reservation)
    
    @task(10)
    def get_inventory_summary(self):
        """Get inventory summary (10% of requests)."""
        if not self.inventory_items:
            return
            
        item = random.choice(self.inventory_items)
        self.client.get(
            f"/api/v1/inventory/items/{item['inventory_id']}/summary",
            name="Get Inventory Summary"
        )
    
    @task(3)
    def adjust_inventory(self):
        """Adjust inventory quantities (3% of requests)."""
        if not self.inventory_items:
            return
            
        item = random.choice(self.inventory_items)
        adjustment_data = {
            "quantity_change": random.randint(-10, 20),
            "reason": "Load test adjustment",
            "reference_id": str(uuid.uuid4())
        }
        
        self.client.post(
            f"/api/v1/inventory/items/{item['inventory_id']}/adjust",
            json=adjustment_data,
            name="Adjust Inventory"
        )
    
    @task(2)
    def get_low_stock_items(self):
        """Get low stock items (2% of requests)."""
        self.client.get(
            "/api/v1/inventory/low-stock",
            name="Get Low Stock Items"
        )
    
    @task(2)
    def get_reorder_items(self):
        """Get items needing reorder (2% of requests)."""
        self.client.get(
            "/api/v1/inventory/reorder",
            name="Get Reorder Items"
        )
    
    @task(1)
    def health_check(self):
        """Health check (1% of requests)."""
        self.client.get("/health", name="Health Check")


class AdminUser(HttpUser):
    """
    Simulates an admin user performing administrative tasks.
    
    Admin users have different access patterns and perform
    operations like bulk inventory updates, order management,
    and system monitoring.
    """
    
    wait_time = between(2, 8)  # Admins work more slowly
    weight = 1  # Only 1 admin for every 10 regular users
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.auth_token = "admin-load-token"
        self.admin_id = f"load-admin-{uuid.uuid4().hex[:8]}"
    
    def on_start(self):
        """Set up admin authentication."""
        self.client.headers.update({
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json",
            "X-Admin-ID": self.admin_id
        })
    
    @task(40)
    def list_all_orders(self):
        """List all orders with filtering (40% of admin requests)."""
        params = {
            "limit": 50,
            "offset": random.randint(0, 500),
            "status": random.choice(["pending", "confirmed", "processing", "completed", "cancelled"])
        }
        
        self.client.get(
            "/api/v1/orders",
            params=params,
            name="Admin: List All Orders"
        )
    
    @task(20)
    def get_inventory_analytics(self):
        """Get inventory analytics (20% of admin requests)."""
        self.client.get(
            "/api/v1/inventory/analytics",
            name="Admin: Inventory Analytics"
        )
    
    @task(15)
    def bulk_inventory_update(self):
        """Perform bulk inventory operations (15% of admin requests)."""
        # Simulate bulk price updates
        bulk_data = {
            "updates": [
                {
                    "product_id": f"BULK-PROD-{i}",
                    "price_change": round(random.uniform(-5.0, 10.0), 2),
                    "reason": "Load test bulk update"
                }
                for i in range(random.randint(5, 20))
            ]
        }
        
        self.client.post(
            "/api/v1/inventory/bulk-update",
            json=bulk_data,
            name="Admin: Bulk Inventory Update"
        )
    
    @task(10)
    def export_orders(self):
        """Export orders data (10% of admin requests)."""
        params = {
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "format": "csv"
        }
        
        self.client.get(
            "/api/v1/orders/export",
            params=params,
            name="Admin: Export Orders"
        )
    
    @task(10)
    def system_metrics(self):
        """Get system metrics (10% of admin requests)."""
        self.client.get(
            "/api/v1/admin/metrics",
            name="Admin: System Metrics"
        )
    
    @task(5)
    def force_order_cancellation(self):
        """Force cancel orders (5% of admin requests)."""
        # This would typically target specific problematic orders
        order_id = f"test-order-{random.randint(1000, 9999)}"
        cancellation_data = {
            "reason": "Admin force cancellation - load test",
            "notify_customer": False
        }
        
        self.client.post(
            f"/api/v1/orders/{order_id}/admin-cancel",
            json=cancellation_data,
            name="Admin: Force Cancel Order"
        )


class HighVolumeUser(HttpUser):
    """
    Simulates high-volume automated systems or integrations.
    
    These users create many orders quickly and perform
    batch operations, simulating partner integrations
    or automated systems.
    """
    
    wait_time = between(0.1, 0.5)  # Very fast operations
    weight = 2  # 2 high-volume users for every 10 regular users
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.auth_token = "integration-load-token"
        self.integration_id = f"load-integration-{uuid.uuid4().hex[:8]}"
        self.batch_size = random.randint(10, 50)
    
    def on_start(self):
        """Set up integration authentication."""
        self.client.headers.update({
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json",
            "X-Integration-ID": self.integration_id
        })
    
    @task(60)
    def batch_order_creation(self):
        """Create multiple orders in batch (60% of requests)."""
        orders = []
        
        for i in range(random.randint(5, self.batch_size)):
            order_data = {
                "customer_id": f"batch-customer-{i}",
                "items": [
                    {
                        "product_id": f"BATCH-PROD-{random.randint(1, 100)}",
                        "sku": f"BATCH-SKU-{random.randint(1, 100)}",
                        "quantity": random.randint(1, 10),
                        "unit_price": round(random.uniform(5.0, 50.0), 2),
                        "name": f"Batch Product {i}"
                    }
                ],
                "shipping_address": {
                    "street_line1": f"{random.randint(100, 999)} Batch St",
                    "city": "Batch City",
                    "state": "BC",
                    "postal_code": f"{random.randint(10000, 99999)}",
                    "country": "US"
                },
                "billing_address": {
                    "street_line1": f"{random.randint(100, 999)} Batch St",
                    "city": "Batch City",
                    "state": "BC",
                    "postal_code": f"{random.randint(10000, 99999)}",
                    "country": "US"
                },
                "payment_method": "batch-payment-method"
            }
            orders.append(order_data)
        
        batch_data = {"orders": orders}
        
        self.client.post(
            "/api/v1/orders/batch",
            json=batch_data,
            name="Batch: Create Orders"
        )
    
    @task(30)
    def batch_inventory_check(self):
        """Check inventory for multiple products (30% of requests)."""
        product_ids = [f"BATCH-PROD-{random.randint(1, 100)}" for _ in range(20)]
        
        batch_data = {"product_ids": product_ids}
        
        self.client.post(
            "/api/v1/inventory/batch-check",
            json=batch_data,
            name="Batch: Inventory Check"
        )
    
    @task(10)
    def webhook_simulation(self):
        """Simulate webhook calls from external services (10% of requests)."""
        webhook_data = {
            "event_type": random.choice(["payment.completed", "shipment.delivered", "return.requested"]),
            "order_id": f"webhook-order-{random.randint(1000, 9999)}",
            "timestamp": "2024-01-01T12:00:00Z",
            "data": {
                "status": "completed",
                "external_id": str(uuid.uuid4())
            }
        }
        
        self.client.post(
            "/api/v1/webhooks/external",
            json=webhook_data,
            name="Webhook: External Event"
        )


# Event handlers for custom metrics
@events.request.add_listener
def on_request(request_type, name, response_time, response_length, response, context, exception, **kwargs):
    """Track custom metrics for different request types."""
    if exception:
        print(f"Request failed: {name} - {exception}")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when the test starts."""
    print("Commerce Service Load Test Starting...")
    print(f"Target host: {environment.host}")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when the test stops."""
    print("Commerce Service Load Test Completed!")
    
    # Print summary statistics
    stats = environment.stats
    print(f"Total requests: {stats.total.num_requests}")
    print(f"Total failures: {stats.total.num_failures}")
    print(f"Average response time: {stats.total.avg_response_time:.2f}ms")
    print(f"95th percentile: {stats.total.get_response_time_percentile(0.95):.2f}ms")
    print(f"99th percentile: {stats.total.get_response_time_percentile(0.99):.2f}ms")
