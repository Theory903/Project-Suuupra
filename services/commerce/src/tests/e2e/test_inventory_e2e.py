import uuid
import time
import httpx

BASE_URL = "http://commerce-service:8084"
AUTH = {"Authorization": "Bearer test-token"}


def test_inventory_create_get_summary():
    # Create inventory item (admin-protected)
    payload = {
        "product_id": f"E2E-PROD-{uuid.uuid4().hex[:8]}",
        "sku": f"E2E-SKU-{uuid.uuid4().hex[:8]}",
        "total_quantity": 20,
        "unit_price": 9.99,
    }

    r = httpx.post(f"{BASE_URL}/api/v1/inventory/items", json=payload, headers=AUTH, timeout=20)
    assert r.status_code == 201, r.text
    inventory_id = r.json()["inventory_id"]
    assert len(inventory_id) > 0

    # Get item
    r = httpx.get(f"{BASE_URL}/api/v1/inventory/items/{inventory_id}", headers=AUTH, timeout=20)
    assert r.status_code == 200, r.text
    item = r.json()
    assert item["product_id"] == payload["product_id"]
    assert item["sku"] == payload["sku"]
    assert item["total_quantity"] == payload["total_quantity"]

    # Summary
    r = httpx.get(f"{BASE_URL}/api/v1/inventory/summary", headers=AUTH, timeout=20)
    assert r.status_code == 200, r.text
    summary = r.json()
    assert "total_items" in summary


def test_inventory_reserve_confirm_flow():
    # Create item for reservation
    product_id = f"E2E-PROD-{uuid.uuid4().hex[:8]}"
    create_payload = {
        "product_id": product_id,
        "sku": f"E2E-SKU-{uuid.uuid4().hex[:8]}",
        "total_quantity": 15,
        "unit_price": 5.55,
    }
    r = httpx.post(f"{BASE_URL}/api/v1/inventory/items", json=create_payload, headers=AUTH, timeout=20)
    assert r.status_code == 201, r.text
    inventory_id = r.json()["inventory_id"]

    # Reserve
    order_id = str(uuid.uuid4())
    reserve_payload = {
        "product_id": product_id,
        "variant_id": None,
        "order_id": order_id,
        "customer_id": "cust-e2e",
        "quantity": 3,
        "reservation_duration_minutes": 30,
    }
    r = httpx.post(f"{BASE_URL}/api/v1/inventory/reservations", json=reserve_payload, headers=AUTH, timeout=20)
    assert r.status_code in (201, 200), r.text
    res_body = r.json()
    assert "reservation_id" in res_body
    reservation_id = res_body["reservation_id"]

    # Confirm
    r = httpx.put(
        f"{BASE_URL}/api/v1/inventory/reservations/{inventory_id}/{reservation_id}/confirm",
        headers=AUTH,
        timeout=20,
    )
    assert r.status_code in (200, 204), r.text

    # Fulfill
    r = httpx.put(
        f"{BASE_URL}/api/v1/inventory/reservations/{inventory_id}/{reservation_id}/fulfill",
        headers=AUTH,
        timeout=20,
    )
    assert r.status_code in (200, 204), r.text

    # Check item reflects reduced totals
    r = httpx.get(f"{BASE_URL}/api/v1/inventory/items/{inventory_id}", headers=AUTH, timeout=20)
    assert r.status_code == 200, r.text
    item = r.json()
    assert item["total_quantity"] == 12  # 15 - 3 fulfilled


def test_low_stock_and_reorder_lists():
    product_id = f"E2E-PROD-{uuid.uuid4().hex[:8]}"
    create_payload = {
        "product_id": product_id,
        "sku": f"E2E-SKU-{uuid.uuid4().hex[:8]}",
        "total_quantity": 3,
        "unit_price": 1.23,
    }
    r = httpx.post(f"{BASE_URL}/api/v1/inventory/items", json=create_payload, headers=AUTH, timeout=20)
    assert r.status_code == 201, r.text

    r = httpx.get(f"{BASE_URL}/api/v1/inventory/low-stock", headers=AUTH, params={"limit": 100}, timeout=20)
    assert r.status_code == 200
    low = r.json()
    assert isinstance(low, list)

    r = httpx.get(f"{BASE_URL}/api/v1/inventory/reorder-needed", headers=AUTH, params={"limit": 100}, timeout=20)
    assert r.status_code == 200
    reo = r.json()
    assert isinstance(reo, list)
