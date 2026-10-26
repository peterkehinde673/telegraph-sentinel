# Telegraph Protocol — Canonical Intent Research & Competitive Landscape

## Executive Summary

This research document records the empirical findings from a complete query of the live Telegraph Protocol miner catalog (`https://devnode.telegraphprotocol.com/api/miners`, 1,922 miners total) evaluated in Epoch 442 (October 2026).

It establishes the empirical evidence for selecting new candidate intents, evaluates competition levels, examines evaluation schemas, and provides a clear selection rationale for expanding Telegraph Sentinel.

---

## 1. Network-Wide Intent Distribution

Across 1,922 registered miners, **134 distinct canonical intents** were identified.

### Competition Tiers
- **High Competition (>30 miners):** `CRYPTO_PRICE` (56), `ONCHAIN_METRIC_VERIFY` (37), `VULNERABILITY_TRIAGE` (35), `LIQUIDITY_DEPTH_VERIFY` (33), `EVENT_OUTCOME_RESOLUTION` (31).
- **Moderate Competition (20–30 miners):** `FRAUD_DETECTION` (29), `WEATHER_FORECAST` (27), `CROSS_CHAIN_STATE_VERIFY` (26), `WEB_SEARCH` (26), `GAS_PRICE` (25), `STOCK_PRICE` (25), `ONCHAIN_TX_LOOKUP` (24), `URL_SCAN` (23), `DNS_RECORD_LOOKUP` (23), `CRYPTO_YIELD_RATE` (22), `WALLET_BALANCE_CHECK` (21), `ASSET_RESERVE_ATTESTATION` (21), `TVL_LOOKUP` (20).
- **Low Competition (10–19 miners):** `CVE_LOOKUP` (19), `MALWARE_DETECTION` (13), `FRAUD_RISK` (12), `QUESTION_ANSWERING` (11), `CODE_REVIEW` (13), `KEYWORD_EXTRACTION` (11).

---

## 2. Status of Sentinel's Current 3 Intents

| Intent | Total Miners | Scored in Ep 442 | Top Score | Sentinel Rank | Sentinel Score | Analysis |
|---|---|---|---|---|---|---|
| **`TVL_LOOKUP`** | 20 | 20 | `0.1278` (finwire-tvl) | **6 / 20** | `0.004088` | Strong baseline performance. Competitors provide explicit root JSON Schemas and accept chain totals in addition to protocol slugs. |
| **`CRYPTO_PRICE`** | 56 | 56 | `1.3873e-25` (cp-coinpaprika) | **8 / 56** | `4.04896e-38` | Top 15% rank, but scores across the board are compressed. Evaluators penalize missing root schemas and expect `label_field: "answer"`. |
| **`WEB_SEARCH`** | 26 | 15 (Ep 441) | `0.9999` (web-hn-algolia) | **Unscored** | `None` | Sentinel currently receives no score because the registered manifest lacks root `input_schema`/`output_schema` and only declared `POST` without `GET /query` query parameters. |

---

## 3. Shortlist of Candidate Intents for Expansion

### Candidate 1: `FRAUD_RISK` (Recommended Primary)
- **Miners Active:** 12 (Very Low Competition)
- **Scored in Epoch 442:** 12 / 12 (100% active evaluation)
- **Top Competitor:** `chainsight-oracle` (Score: `0.54115`, Rank 1), `riskwire-fraud-risk` (Score: `0.3820`)
- **Evaluator Contract / Expected Schema:**
  - **Inputs:** `question`, `query`, `address`, `transaction`, `description`
  - **Outputs:** `verdict` (`"High fraud risk"`, `"Elevated fraud risk"`, `"Low fraud risk"`, `"Insufficient information"`), `summary` (string), `confidence` (number 0.0-1.0), `as_of` (ISO timestamp)
  - **Signal Mapping:** `confidence_field: "confidence"`, `label_field: "summary"`, `reason_field: "summary"`
- **Architecture Alignment:** Native. Sentinel’s Python risk engine and SQLite watch-rules system were purpose-built for multi-signal risk assessments (`APPROVE`, `REVIEW`, `BLOCK`), perfectly mapping to these discrete fraud risk tiers.

### Candidate 2: `CRYPTO_YIELD_RATE` (Recommended Secondary)
- **Miners Active:** 22 (Low-to-Moderate Competition)
- **Scored in Epoch 442:** 22 / 22 (100% active evaluation)
- **Top Competitor:** `yld-lido` (Score: `0.54415`, Rank 1), `chainsight-oracle` (Rank 2)
- **Evaluator Contract / Expected Schema:**
  - **Inputs:** `pool` (e.g., `steth`, `reth`, `aave-v3-usdc`), `venue` (e.g., `lido`, `aave`), `query`
  - **Outputs:** `apy_bps` (integer), `apr` (number), `summary` (string), `confidence` (number), `source` (`"defillama"`)
  - **Signal Mapping:** `label_field: "apy_bps"` or `"summary"`, `confidence_field: "confidence"`
- **Architecture Alignment:** Seamless. Sentinel already integrates with DefiLlama for TVL. The DefiLlama public Pools API (`https://yields.llama.fi/pools`) provides free, keyless, real-time APY metrics across thousands of pools.

### Candidate 3: `WALLET_BALANCE_CHECK` (Recommended Tertiary)
- **Miners Active:** 21 (Low-to-Moderate Competition)
- **Scored in Epoch 442:** 21 / 21
- **Top Competitor:** `chainsight-oracle` (Score: `1.0000`, Rank 1)
- **Evaluator Contract / Expected Schema:**
  - **Inputs:** `address` (0x EVM address), `chain` (`base`, `ethereum`), `query`
  - **Outputs:** `balance_eth` (number), `balance_wei` (string), `answer` (string), `confidence` (1.0)
  - **Signal Mapping:** `label_field: "answer"`, `confidence_field: "confidence"`
- **Architecture Alignment:** Zero additional external dependency. The gateway already imports `ethers` and targets Base Sepolia and Base Mainnet RPCs. `provider.getBalance(address)` gives an immediate, 100% deterministic result.

### Candidate 4: `GAS_PRICE` (Viable Alternative)
- **Miners Active:** 25
- **Scored in Epoch 442:** 25 / 25
- **Top Competitor:** `txlens` (Rank 1), `truvian-onchain-truth` (Rank 2)
- **Evaluator Contract / Expected Schema:**
  - **Inputs:** `chain` (`base`, `ethereum`), `query`
  - **Outputs:** `gasPriceWei` (string), `gasPriceGwei` (number), `signal` (string), `confidence` (number)
  - **Signal Mapping:** `label_field: "signal"`, `confidence_field: "confidence"`
- **Architecture Alignment:** Fully supported via `provider.getFeeData()`.

---

## 4. Final Selection Rationale

1. **Preserve and Optimize Current 3 Intents:** `TVL_LOOKUP` (Rank 6) and `CRYPTO_PRICE` (Rank 8) already place in the top percentiles. Upgrading their schemas to include top-level JSON Schema definitions, standardizing `signal_mapping` fields (`confidence`, `summary`, `answer`), and supporting both `GET` and `POST` handlers will recover missing scores in `WEB_SEARCH` and boost `TVL_LOOKUP` toward the top 3.
2. **Select `FRAUD_RISK` as the First New Intent:**
   - Has only 12 competing miners network-wide.
   - Evaluated 100% of epochs.
   - Directly matches Sentinel's core brand identity and existing Python risk analysis engine.
3. **Select `CRYPTO_YIELD_RATE` as the Second New Intent:**
   - 22 competing miners.
   - Reuses the existing DefiLlama oracle integration without needing new external API keys or infrastructure.
