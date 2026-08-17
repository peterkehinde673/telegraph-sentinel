# Telegraph Sentinel

> **An auditable decision-security layer that turns verified Telegraph machine intelligence into deterministic risk decisions for autonomous financial systems.**

---

## 1. Problem
Autonomous DeFi agents, automated vaults, and on-chain treasuries execute high-value transactions continuously. When these autonomous systems rely on single oracles, unverified Web2 APIs, or unauthenticated feeds, they are vulnerable to:
* **Oracle manipulation & stale pricing**
* **Sudden liquidity drains & TVL collapse**
* **Zero-day smart contract exploits disclosed via news before on-chain triggers activate**

## 2. Solution
**Telegraph Sentinel** functions as an autonomous risk pre-flight firewall. Before any high-value crypto or DeFi operation executes, Sentinel queries multiple decentralized Telegraph Miners, normalizes the machine signals, applies a configurable deterministic risk formula, and issues a strict, explainable decision:
* **** (Risk <= 30) — Verified low risk; operation proceeds.
* **** (Risk 31 - 60) — Moderate risk; requires manual confirmation or secondary checks.
* **** / **** (Risk > 60) — Elevated risk or single-source critical vulnerability; operation halted.

Sentinel is purely an **autonomous risk/decision engine** and **does NOT execute real trades**.

---

## 3. Why Telegraph Protocol
Telegraph provides the decentralized machine intelligence layer:
1. **Specialized Machine Miners**: Modular data extraction from dedicated miners without single-point API failures.
2. **x402 Micropayments**: Native HTTP 402 machine-to-machine payment protocol over Base Sepolia (eip155:84532).
3. **Cryptographic Proofs**: Miner output headers verified for authenticity and traceability.

---

## 4. Architecture
```
                         +-----------------------------------+
                         |       React + TypeScript UI       |
                         |  (Dashboard, Presets, Live WS)    |
                         +-----------------+-----------------+
                                           |
                                HTTP / WebSocket (:4000)
                                           v
                         +-----------------------------------+
                         |     Node.js / Express Gateway     |
                         |  - Zod Request Validation         |
                         |  - x402 Base Sepolia Signer       |
                         |  - Telegraph Miner Orchestration  |
                         +--------+-----------------+--------+
                                  |                 |
                   Telegraph HTTP |                 | Internal HTTP
                 (Miners 207,301) |                 v
                                  |     +-------------------------+
                                  |     | Python FastAPI Engine   |
                                  |     | - Deterministic Formula |
                                  |     | - Conflict Detection    |
                                  |     | - Mode Policies         |
                                  |     +------------+------------+
                                  v                  |
               +-----------------------------------+ |
               | Telegraph Protocol Network        | |
               |  - CoinGecko (Miner 207)          | |
               |  - TVL Oracle (Miner 301)         | |
               |  - Tavily (Miner 202)             | |
               +-----------------+-----------------+ |
                                 |                   |
                                 +---------> <-------+
                                            |
                                 +----------v----------+
                                 |  SQLite Persistence |
                                 |  - Audits & Watches |
                                 +---------------------+
```

---

## 5. Authoritative Telegraph Miners

| Miner ID | Name | Intent | Input / Scope | Risk Contribution |
|---|---|---|---|:---:|
| **207** | CoinGecko | `CRYPTO_PRICE` | Asset spot price & 24h delta | **30%** |
| **301** | TVL Oracle | `TVL_LOOKUP` | Protocol Total Value Locked & 7d delta | **35%** |
| **202** | Tavily | `WEB_SEARCH` | Real-time exploit & vulnerability scan | **35%** |

---

## 6. Deterministic Risk & Confidence Model

### Risk Formula
`Composite Risk = (Market Risk * 0.30) + (TVL Risk * 0.35) + (Security Risk * 0.35) + Conflict Penalty`

* **Dynamic Normalization**: If a miner is unavailable, weights dynamically re-normalize among available sources rather than assuming zero risk.
* **Signal Divergence Penalty**: If Market risk and News risk diverge by >= 40 points, an explicit warning and +5 risk penalty is applied.

### Confidence Formula
`Confidence = Completeness (max 40) + Miner Avg Confidence (max 35) + Verification Quality (max 25) - Conflict Penalty (15)`

---

## 7. Operating Modes

1. **`ANALYZE`**: Baseline audit mode. Calculates composite risk without enforcing restrictive threshold escalations.
2. **`PROTECT`**: Active threshold enforcement. If any single source detects extreme risk (>= 75), Sentinel escalates the decision directly to `HIGH_RISK_REVIEW` or `BLOCK`.
3. **`AUTOPILOT`**: Continuous autonomous monitoring loop with automated circuit-breaker flagging (non-executing).

---

## 8. x402 Protocol Implementation
Sentinel implements standard x402 EVM challenge handling targeting **Base Sepolia** (`eip155:84532`):
1. Client issues request to miner endpoint.
2. If `402 Payment Required` is returned, the Gateway inspects `WALLET_PRIVATE_KEY`.
3. Generates signed payment authorization and re-submits.
4. Facilitator returns settlement receipt header (`x-payment-receipt`).
5. If credentials are not configured, Sentinel cleanly reports `PAYMENT_NOT_CONFIGURED` without fabricating mock receipts.

---

## 9. Installation & Native Execution (Ubuntu/Termux)

```bash
# 1. Clone repository
cd ~
git clone https://github.com/peterkehinde673/telegraph-sentinel.git
cd telegraph-sentinel

# 2. Configure environment
cp .env.example .env

# 3. Start complete system
./sentinel.sh start

# 4. Run automated test suites
./sentinel.sh test
```

Access the dashboard at `http://localhost:4000`.

---

## 10. Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Node.js Gateway Port | `4000` |
| `PYTHON_ENGINE_URL` | Python FastAPI Risk Engine Address | `http://127.0.0.1:8000` |
| `TELEGRAPH_API_URL` | Telegraph Protocol API Endpoint | `https://api.telegraph.im` |
| `TELEGRAPH_API_KEY` | Live Telegraph Miner Access Key | *(Optional in dev)* |
| `TELEGRAPH_NETWORK` | CAIP-2 Network Identifier | `eip155:84532` |
| `WALLET_PRIVATE_KEY` | EVM Signer for x402 Payments | *(Optional in dev)* |
| `X402_FACILITATOR_URL` | x402 Payment Facilitator | `https://facilitator.x402.org` |

---

## 11. Security Model
* **Zero Secret Leakage**: No private keys or tokens are stored in SQLite, logged to consoles, or exposed over WebSockets.
* **Safe Parameterized SQL**: All database operations use parameter-bound queries against SQL injection.
* **Explicit Failure States**: Unreachable miners or missing credentials report structured error states (`INSUFFICIENT_DATA`) rather than fabricated values.
