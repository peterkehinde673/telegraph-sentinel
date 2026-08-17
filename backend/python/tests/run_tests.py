import sys
import os
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models import DecisionEnum


async def run_all_tests():
    print("\n--- Running Sentinel Python Risk Engine Tests ---")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test 1: Health
        print("1. Testing GET /health...")
        res = await client.get("/health")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        assert data["status"] == "healthy"
        print(f"   ✓ Health check OK: {data['service']}")

        # Test 2: Analyze Endpoint (ANALYZE mode)
        print("2. Testing POST /analyze (ANALYZE mode)...")
        payload = {
            "asset": "ETH",
            "mode": "ANALYZE",
            "action_type": "BUY",
            "signals": [
                {
                    "miner_id": 207,
                    "miner_name": "CoinGecko",
                    "intent": "CRYPTO_PRICE",
                    "status": "success",
                    "risk_signal": 15.0,
                    "confidence": 95.0,
                    "data": {"price": 3200},
                    "verification": {"proof": "0xabc123"},
                }
            ],
        }
        res = await client.post("/analyze", json=payload)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = res.json()
        assert data["decision"] == DecisionEnum.APPROVE.value
        assert "mode" in data and data["mode"] == "ANALYZE"
        assert "reason_codes" in data
        print(f"   ✓ Deterministic calculation OK: Decision={data['decision']}, Risk={data['risk_score']}")

        # Test 3: Watch Rules SQLite Persistence
        print("3. Testing POST & GET /watch-rules...")
        rule_payload = {
            "rule_id": "test_rule_1",
            "asset": "ETH",
            "mode": "AUTOPILOT",
            "risk_threshold": 60.0,
            "confidence_threshold": 85.0,
            "interval_minutes": 15,
            "status": "ACTIVE",
            "created_at": "2026-08-17T00:00:00Z"
        }
        save_res = await client.post("/watch-rules", json=rule_payload)
        assert save_res.status_code == 200
        
        get_res = await client.get("/watch-rules")
        assert get_res.status_code == 200
        rules = get_res.json().get("rules", [])
        assert len(rules) >= 1
        print("   ✓ SQLite Watch rules persisted and retrieved cleanly.")

    print("--- All Python Engine Tests Passed! ---\n")


if __name__ == "__main__":
    asyncio.run(run_all_tests())
