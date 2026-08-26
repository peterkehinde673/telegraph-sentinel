# Telegraph Sentinel

> **Verified machine intelligence before every critical crypto decision.**

Telegraph Sentinel is an autonomous pre-flight risk intelligence engine and live Telegraph miner oracle built for the Telegraph Protocol ecosystem on Base Sepolia (`eip155:84532`).

---

## Architecture

Telegraph Sentinel consists of:

1. Frontend dashboard (React + TypeScript)
2. Node.js/TypeScript gateway/API
3. Python/FastAPI risk-analysis engine
4. Telegraph miner integration (Miner 207, 301, 202)
5. WASM semantic scoring module (MiniLM-L6-v2)
6. SQLite persistence
7. WebSocket real-time updates

[Detailed Architecture](docs/architecture.md)

---

## Live Demo & Production Deployment

* [Live Production Dashboard](https://telegraph-sentinel-d68u.onrender.com)
* **Local Development**: `http://localhost:4000`
* **Production Miner Oracle (CQYPTO_PRICE)**: `POST https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/risk-assessment`
* **Integrate YAML Spec**: [https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/docs/sentinel-miner.yaml](https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/docs/sentinel-miner.yaml)
* **WASM Candidate Scorer**: [https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/docs/sentinel_scorer.wasm](https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/docs/sentinel_scorer.wasm)

![Telegraph Sentinel Dashboard](assets/dashboard.png)

---

## Quick Testing Guide

### 1. Query the 24/7 Live Miner Oracle
```bash
# Query BTC Spot Price
curl -s -X POST https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/risk-assessment   -H "Content-Type: application/json"   -d '{"asset": "BTC"}'

# Query ETH Spot Price (GET query format)
curl -s "https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/risk-assessment?asset=ETH;
```(
### 2. Run Local Development Stack
```bash
cd backend/node
npm install
npm run build
node dist/server.js
```

### 3. Validate WASM Candidate Scorer
```bash
node wasm/validate_scorer.js
```
