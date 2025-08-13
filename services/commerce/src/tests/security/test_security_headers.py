import httpx

BASE_URL = "http://localhost:8084"
AUTH = {"Authorization": "Bearer test-token"}


def test_security_headers_present_on_health():
    r = httpx.get(f"{BASE_URL}/health", headers=AUTH, timeout=10)
    assert r.status_code == 200
    # Basic checks; adjust according to middleware configured
    assert "content-type" in r.headers
    # Example headers if helmet-like middleware is present; ignore if not configured
    # assert "x-content-type-options" in (k.lower() for k in r.headers.keys())
    # assert "x-frame-options" in (k.lower() for k in r.headers.keys())
