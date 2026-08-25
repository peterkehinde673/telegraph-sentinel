# Telegraph Sentinel

> **Verified machine intelligence before every critical crypto decision.**

Telegraph Sentinel is an autonomous pre-flight risk intelligence engine and live Telegraph miner oracle built for the Telegraph Protocol ecosystem on Base Sepolia (`eip155:84532`).

---

## Live Demo & Production Deployment

* **24/7 Cloud Dashboard & Gateway**: [https://telegraph-sentinel-d68u.onrender.com]https://telegraph-sentinel-d68u.onrender.comi
* **Local Development Server**: `http://localhost:4000`
* **Live Miner Oracle (CRYPTO_PRICE)**: `POST https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/risk-assessment`
* **Integrate YAML Spec**: [https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/docs/sentinel-miner.yaml](https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/docs/sentinel-miner.yaml)
* **WASM Candidate Scorer**: [https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/docs/sentinel_scorer.wasm](https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/docs/sentinel_scorer.wasm)

![Telegraph Sentinel Dashboard](docs/assets/dashboard.png)

---

## Quick Testing Guide

### 1. Query the 24/7 Live Miner Oracle
```bash
# Query BTC Spot Price
curl -s -X POST https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/risk-assessment   -H "Content-Type: application/json"   -d '{"asset": "BTC"}'

# Query ETH Spot Price (GET query format)
curl -s "https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/risk-assessment?asset=ETH"
```

### 2. Run Local Development Stack
```bash
cd backend/node
npm install
npm run build
node dist/server.js
```

### 3. Validate WASM Candidate Scorer
```bash
node wasm/validate_scorer.jsc
```
