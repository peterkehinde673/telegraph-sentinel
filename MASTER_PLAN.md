# TELEGRAPH SENTINEL — FROZEN MASTER PLAN

## Executive Summary & Source of Truth

This document serves as the canonical, frozen master plan for Telegraph Sentinel risk intelligence engineering, protocol compliance, intent expansion, and performance optimization on the Telegraph Protocol (Base Sepolia `eip155:84532`).

**Repository:** `https://github.com/peterkehinde673/telegraph-sentinel`  
**Production Gateway:** `https://telegraph-sentinel-d68u.onrender.com`  
**Telegraph Miner Registration:** ID `501` | Slug `sentinel-risk-oracle` | Wallet `0x6811a9e33ce68fbdf6e07dfacab317072c287596`  
**Allowed Phase Statuses:** `NOT STARTED` | `IN PROGRESS` | `BLOCKED` | `COMPLETE`

---

## Phase Status Summary

| Phase | Description | Status | Evidence / Summary |
|---|---|---|---|
| **Phase 1** | Baseline audit | **COMPLETE** | Full repo, CI, production endpoint audit, and protocol devnode catalog queries completed; baseline facts documented. |
| **Phase 2** | Canonical intent research | **NOT STARTED** | Research official Telegraph catalog across 1,922 miners and live intent evaluators for high-value/low-competition opportunities. |
| **Phase 3** | Adapt the reference miner YAML | **NOT STARTED** | Adapt schema and semantic structure from reference Groq miner YAML while preserving Sentinel identity and endpoints. |
| **Phase 4** | Improve the original three intents | **NOT STARTED** | Enhance `CRYPTO_PRICE`, `TVL_LOOKUP`, and `WEB_SEARCH` handlers, schemas, error fallbacks, and test coverage. |
| **Phase 5** | Implement additional verified intents | **NOT STARTED** | Implement and test verified low-competition canonical intents supported by Phase 2 research. |
| **Phase 6** | Build and regression testing | **NOT STARTED** | Run test suites across node gateway, python engine, WASM scorer, and configuration validators. |
| **Phase 7** | Register or update the miner | **NOT STARTED** | Submit updated manifest to the protocol registry and verify registration status independently. |
| **Phase 8** | Investigate and restore request flow | **NOT STARTED** | Analyze the 304 requests-served bottleneck, schema compliance, routing delays, and rate limiting. |
| **Phase 9** | Epoch-by-epoch verification | **NOT STARTED** | Track scores, ranks, and request counts epoch-over-epoch to verify sustained improvements. |

---

## Phase Details

### Phase 1 — Baseline audit
- **Status:** `COMPLETE`
- **Objectives:**
  - Inspect complete repository structure, Git status, branch, recent commits, README, package scripts, dependencies, backend, frontend, tests, deployment configuration, environment-variable requirements, and miner YAML/manifest.
  - Inspect the currently deployed service using safe, read-only checks where possible.
  - Review existing Telegraph Explorer metrics, including requests served, average score, best rank, epochs participated, and available signal history.
  - Identify the actual meaning of the current metrics wherever documentation or accessible data allows.
  - Document confirmed facts separately from hypotheses and unresolved questions.
  - Identify existing build failures before introducing changes.
  - Do not make speculative production changes during this phase.

#### Confirmed Facts
1. **Git State & Push Authorization:**
   - Active branch: `main` (tracked to `origin/main`).
   - Remote repository: `https://github.com/peterkehinde673/telegraph-sentinel.git`.
   - Push authentication: Verified via `git push --dry-run origin main` (Exit code 0, write access confirmed).
   - Recent history: Pull request #23 merged (`b1d091b`), aggregate Sentinel CI check added (`4137688`), Gemini provider error sanitization (`768229a`, `941fbaa`, `1999d5a`), and TVL alignment (`af2f9acc`, `8c9ffcb9`).
2. **Production Deployment & Correct URL:**
   - Production URL confirmed: `https://telegraph-sentinel-d68u.onrender.com` (HTTP 200 OK), matching the checked-in `docs/sentinel-miner.yaml`, `README.md`, and `public/engine-subnets/sentinel-risk-oracle.yaml`.
   - Live endpoint verification:
     - `GET /health` -> `{"status":"healthy","service":"sentinel-node-gateway"}`
     - `GET /api/status` -> Active gateway with 3 configured miners (`CoinGecko`, `TVL Oracle`, `Tavily`).
     - `GET /api/v1/miner/spec.yaml` -> Valid miner YAML generated and served.
     - `POST /api/v1/miner/risk-assessment` -> Returns live BTC price from Coinbase ($79,799.69, confidence 0.98).
     - `POST /api/v1/miner/tvl` -> Returns live Aave TVL from DefiLlama ($17.66B, confidence 0.95).
     - `POST /api/v1/miner/web-search` -> Returns live web intelligence from Tavily (confidence 0.948).
3. **Telegraph Protocol Metrics (Live Node Query):**
   - Live protocol data retrieved from `https://devnode.telegraphprotocol.com/api/miners`:
     - Miner ID: `501`
     - Slug: `sentinel-risk-oracle`
     - Name: `Telegraph Sentinel Risk Intelligence`
     - Registered at: `2026-09-14T21:55:33Z`
     - Activation status: `active`
     - Min price: `10000` micro-USDC (0.01 USDC)
     - YAML URL: `https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/docs/sentinel-miner.yaml`
     - Wallet / Fee Address: `0x6811a9e33ce68fbdf6e07dfacab317072c287596`
     - Total Requests Served: `304`
     - Scored: `true` (last scored epoch: 442 at `2026-10-26T15:00:44Z`)
     - Intent Scores in Epoch 442:
       - `TVL_LOOKUP`: Rank 6 of 20 miners, Score: 0.004087977.
       - `CRYPTO_PRICE`: Rank 8 of 56 miners, Score: 4.04896E-38.
       - `WEB_SEARCH`: No score recorded for Sentinel in Epoch 441/442.
4. **Architectural Verification & Test Baseline:**
   - `backend/node` TypeScript compilation (`npm run build` -> `tsc`): PASS (0 errors).
   - `backend/node` TVL suite (`npm run test:tvl`): Steps 1-3 PASS (Natural language parsing, risk thresholds, live DefiLlama data). Step 4 directly queries the full DefiLlama protocol history (`https://api.llama.fi/protocol/aave`, which returns a ~10.8 MB payload); when network latency causes the transfer to exceed the test's hardcoded 8000ms timeout, axios aborts. In production, `tvl_oracle.ts` queries the lightweight `/tvl/aave` endpoint directly.
   - `backend/node` Web search suite (`npm run test:web-search`): PASS (Risk classification, Gemini fallback to Tavily).
   - `backend/python` risk engine (`python tests/run_tests.py`): PASS (Health check, deterministic analysis, SQLite watch-rules persistence).
   - `wasm` Scorer validation (`node wasm/validate_scorer.js`): PASS (30/30 adversarial cases, 100% ordering accuracy).
5. **Baseline Environmental Finding (Isolated):**
   - When running root `vite build` directly in the Termux Ubuntu environment, `@rollup/rollup-android-arm64` encounters `ERR_DLOPEN_FAILED` due to Android Bionic dynamic linker namespace constraints for `.node` binaries outside the Termux files hierarchy.
   - This environmental constraint does NOT affect:
     - GitHub Actions CI (which runs on GitHub `ubuntu-latest` x86_64).
     - Render production (which builds from `backend/node` using `tsc`).
     - Local gateway execution via `tsc` / `tsx`.

#### Hypotheses and Unresolved Questions
- **Hypothesis 1 (Requests Served Stalling at 304):** The protocol catalog reveals that Sentinel's registered manifest currently has `input_schema: null` and `output_schema: null` at the top level, unlike reference and top-ranking miners (e.g. `TxLens`, `URL Sentinel`, `finwire-tvl`) which declare explicit JSON Schemas. This may cause automated evaluators or routing agents to bypass Sentinel for requests requiring strict schema conformance.
- **Hypothesis 2 (WEB_SEARCH Score Absence):** Only 16 of 26 `WEB_SEARCH` miners received an evaluation score in recent epochs. Sentinel's endpoint might either be timing out during batch evaluator runs, missing expected root schema keys (`hits` vs `results`), or failing authentication when evaluators test without API keys.
- **Unresolved Question 1:** Does the protocol require an updated on-chain transaction to re-fetch `sentinel-miner.yaml`, or does the devnode periodically re-crawl `yaml_url` on GitHub?

---

### Phase 2 — Canonical intent research
- **Status:** `NOT STARTED`
- **Objectives:**
  - Verify valid Telegraph Protocol intents using current official documentation or the protocol's actual canonical-intent API.
  - Investigate miner counts for each candidate intent across the 1,922 registered miners.
  - Determine whether each intent is scored, what evaluator it uses, and which input/output formats it expects.
  - Investigate compatibility with this repository's existing architecture.
  - Identify plausible low-competition opportunities based on evidence.
  - Selection rationale must avoid assuming guaranteed #1 rank without proof.

---

### Phase 3 — Adapt the reference miner YAML
- **Status:** `NOT STARTED`
- **Objectives:**
  - Inspect reference YAML (`groq-llama31-instant-miner.yaml`) and existing `docs/sentinel-miner.yaml`.
  - Verify official registration schema, including top-level `input_schema`, `output_schema`, and `semantics.signal_mapping`.
  - Preserve Sentinel's identity (`sentinel-risk-oracle`, ID 501, production URL).
  - Ensure every declared intent maps to a verified endpoint and schema.

---

### Phase 4 — Improve the original three intents
- **Status:** `NOT STARTED`
- **Objectives:**
  - Preserve and improve `CRYPTO_PRICE`, `TVL_LOOKUP`, and `WEB_SEARCH`.
  - Address correctness, upstream source reliability, freshness, caching, natural-language parsing, timeouts, and error handling.
  - Calibrate confidence scoring based on verifiable source characteristics.
  - Maintain comprehensive test coverage without regressions.

---

### Phase 5 — Implement additional verified intents
- **Status:** `NOT STARTED`
- **Objectives:**
  - Select candidate intents supported by Phase 2 research.
  - Implement real handlers, validation, output mapping, and tests.
  - Avoid superficial additions; ensure all declared capabilities work end-to-end.

---

### Phase 6 — Build and regression testing
- **Status:** `NOT STARTED`
- **Objectives:**
  - Run applicable test suites: Unit/integration tests, type checks, YAML validation, API request tests, upstream failure handling, and regression checks.
  - Verify all Sentinel CI components pass cleanly.

---

### Phase 7 — Register or update the miner
- **Status:** `NOT STARTED`
- **Objectives:**
  - Verify the official Telegraph registration/update procedure.
  - Prepare and validate updated manifest.
  - Verify registration result and status independently.

---

### Phase 8 — Investigate and restore request flow
- **Status:** `NOT STARTED`
- **Objectives:**
  - Trace request path from Telegraph router to deployed service.
  - Determine causes for requests-served remaining around 304.
  - Implement and verify fixes to restore active routing.

---

### Phase 9 — Epoch-by-epoch verification
- **Status:** `NOT STARTED`
- **Objectives:**
  - Monitor score, rank, and request count progression epoch-over-epoch.
  - Record genuine evaluator evidence for sustained improvement.
