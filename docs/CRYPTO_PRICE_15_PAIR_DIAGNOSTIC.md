# Telegraph Sentinel WASM Scorer - Canonical 15-Pair CRYPTO_PRICE Diagnostic

This diagnostic report is generated automatically by `wasm/crypto_price_15_diagnostic.js` evaluating the current release WebAssembly binary `wasm/dist/telegraph_sentinel_scorer.wasm`.

## 1. Executive Summary & Diagnostic Metrics

| Metric | Measured Value |
| :--- | :--- |
| **Intent Target** | `CRYPTO_PRICE` |
| **Evaluation Timestamp** | `2026-08-31T08:28:27.245Z` |
| **Git Commit SHA** | `unknown` |
| **WASM Binary Size** | `77,663 bytes` (~75.8 KB) |
| **WASM SHA-256 Checksum** | `46b6682c62ecebd3cb1aa5c36571a75c2590956b70752a7b8de24c8134276645` |
| **Mirror Synchronization** | `Byte-for-byte identical with docs/sentinel_scorer.wasm` |
| **Total Comparison Pairs** | `15` |
| **Ordering Accuracy** | **`15 / 15` (100.0%)** |
| **Average GOOD Score** | **`0.9991`** |
| **Average BAD Score** | **`0.0000`** |
| **Average Separation Margin** | **`+0.9991`** (Threshold: > `0.800`) |
| **Minimum Separation Margin** | **`+0.9975`** |
| **Worst Self-Match Score** | **`1.0000`** |
| **Score Standard Deviation** | **`0.4995`** |
| **Failed Pairs** | `None (0 failed pairs)` |

---

## 2. Canonical 15-Pair Detailed Evaluation Table

| # | Query | Ground Truth | GOOD Answer | BAD Answer | GOOD Score | BAD Score | Margin | Result | Failure Mode / Verification |
| :- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **1** | `What is the price of Bitcoin?` | `$65,400` | "Bitcoin (BTC) is currently trading at $65,400 USD." | "Bitcoin (BTC) is currently trading at $12,000 USD." | `0.9980` | `0.0000` | `+0.9980` | **PASS ✓** | Exact spot price match in USD vs severe ($12,000) factual discrepancy. |
| **2** | `What is Ethereum price?` | `$3,480` | "Ethereum is trading at $3,480.00 USD (+1.40% 24h)." | "Ethereum is trading at $850.00 USD (+1.40% 24h)." | `0.9986` | `0.0000` | `+0.9986` | **PASS ✓** | Valid spot price with +24h interval delta vs completely false price with same delta format. |
| **3** | `What is Solana spot price?` | `$145.50` | "1 SOL = $145.50 USD." | "1 SOL = $22.00 USD." | `0.9989` | `0.0000` | `+0.9989` | **PASS ✓** | Accurate oracle price with unit prefix (1 SOL) vs incorrect rate with unit prefix. |
| **4** | `What is Avalanche price?` | `$28.40` | "As of August 30, 2026, AVAX is $28.40 USD." | "As of August 30, 2026, AVAX is $4.10 USD." | `0.9988` | `0.0000` | `+0.9988` | **PASS ✓** | Correct spot price contextualized with date timestamp vs false price with same date. |
| **5** | `What is Chainlink price?` | `$11.80` | "LINK is $11.80 with $2.5B 24h volume, ranked #15." | "LINK is $1.50 with $2.5B 24h volume, ranked #15." | `0.9995` | `0.0000` | `+0.9995` | **PASS ✓** | Accurate price alongside supplemental volume/rank metadata vs incorrect price. |
| **6** | `What is Arbitrum spot price?` | `$0.55` | "ARB is trading at 55 cents." | "ARB is trading at 5 cents." | `0.9997` | `0.0000` | `+0.9997` | **PASS ✓** | Properly converted cents notation (55 cents = $0.55) vs incorrect value (5 cents = $0.05). |
| **7** | `What is Bitcoin price in USD?` | `$65,400` | "BTC is currently trading at $65.4k." | "BTC is currently trading at $25.4k." | `0.9997` | `0.0000` | `+0.9997` | **PASS ✓** | Correct thousands multiplier ($65.4k = $65,400) vs wrong multiplier value ($25.4k). |
| **8** | `What is the current price of Celestia?` | `$5.20` | "Celestia (TIA) is currently $5.20 USD." | "Celestia (TIA) is currently $0.45 USD." | `0.9975` | `0.0000` | `+0.9975` | **PASS ✓** | Dynamic unlisted cryptocurrency generalization with correct price vs wrong value. |
| **9** | `What is the price of Solana?` | `$145.50` | "Solana is $145.50." | "Cardano is $145.50." | `0.9999` | `0.0000` | `+0.9999` | **PASS ✓** | Valid asset attribution vs competitor/wrong-asset substitution with identical number. |
| **10** | `What is the price of Ethereum?` | `$3,480` | "Ethereum is currently trading at $3,480." | "Ethereum is not trading at $3,480." | `0.9990` | `0.0000` | `+0.9990` | **PASS ✓** | Affirmative factual statement vs direct syntactic negation containing identical numbers. |
| **11** | `What is the price of Bitcoin?` | `$65,400` | "Bitcoin spot price is $65,400." | "Bitcoin all-time high was $65,400 in 2021." | `0.9985` | `0.0000` | `+0.9985` | **PASS ✓** | Current live spot price vs historical / stale ATH claim misrepresenting market state. |
| **12** | `What is Solana price in USD?` | `$145.50` | "Solana is $145.50 USD." | "Solana is 145.50 EUR." | `0.9997` | `0.0000` | `+0.9997` | **PASS ✓** | Correct fiat currency denominated in USD vs currency mismatch (EUR). |
| **13** | `What is Bitcoin price?` | `$65,400` | "Bitcoin is trading between $65,300 and $65,500." | "Bitcoin is trading between $10,000 and $20,000." | `0.9995` | `0.0000` | `+0.9995` | **PASS ✓** | Accurate tight price band spanning ground truth vs completely disjoint price band. |
| **14** | `What is Ethereum price?` | `$3,480` | "Ethereum is $3,480." | "Ethereum is $2,700." | `0.9997` | `0.0000` | `+0.9997` | **PASS ✓** | Exact spot price vs near-miss price (>22% deviation) penalized via continuous error curve. |
| **15** | `What is Dogecoin spot price?` | `$0.10` | "DOGE is trading at $0.10." | "DOGE is unconfirmed and rumored around $0.10 maybe." | `0.9988` | `0.0000` | `+0.9988` | **PASS ✓** | Definitive authoritative spot price vs speculative/hedged uncertain rumor. |

---

## 3. Analysis of CRYPTO_PRICE Generalization Mechanisms

1. **Non-Price Token Context Isolation**:
   - Timeframe intervals (`24h`, `7d`, `30d`, `1y`, `15m`), timestamps (`14:00:00 UTC`), calendar dates (`August 30, 2026`), ordinal rankings (`#15`, `ranked top 10`), and unit counters (`1 SOL =`, `1 BTC =`) are isolated from spot price matching.

2. **Continuous Multiplier & Unit Normalization**:
   - Suffix multipliers (`k`, `m`, `b`, `thousand`, `million`, `billion`) and fractional units (`cents`, `¢`, `bps`) are normalized to base decimal units.

3. **Strict Zero-Credit Factual Penalties**:
   - Wrong currency tokens (`EUR` for a `USD` ground truth), syntactic negations (`"is not trading at"`), historical claims (`"all-time high in 2021 was"`), wrong asset substitution (`"Cardano is $145.50"`), and speculative hedging markers (`"unconfirmed and rumored around"`) trigger definitive zero-credit multiplier penalties.

4. **Steep Power-Law Separation Curve**:
   - The calibrated monotonic transform $f(x) = \frac{x^{2.5}}{x^{2.5} + (1-x)^{2.5}}$ amplifies valid signals ($x > 0.90 \rightarrow 0.998$) and collapses conflicting signals ($x < 0.05 \rightarrow 0.000$).

---

## 4. Reproduction Instructions

To reproduce these exact results directly from the repository's WASM binary:

```bash
node wasm/crypto_price_15_diagnostic.js
```
