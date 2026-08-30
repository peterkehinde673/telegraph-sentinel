# Telegraph WASM Scorer Submission Specification

## 1. Purpose of the Scorer
The **Telegraph Sentinel WASM Scorer** (`telegraph_sentinel_scorer.wasm`) is a high-performance, deterministic WebAssembly scoring module designed to evaluate and rank answers submitted by decentralized oracle miners within the Telegraph Protocol.

Its primary role is to compute a normalized quality score ($[0.0, 1.0]$) comparing a candidate miner's answer against canonical ground truth given a specific crypto inquiry. The module combines semantic embeddings, continuous numeric consistency modeling, dynamic entity-class resolution, currency verification, stale/historical gating, lexical BM25 matching, and non-linear separation transforms without external network or host-call dependencies.

---

## 2. Intent Specialization: `CRYPTO_PRICE` (Factual Dominance Architecture)
Following evaluation feedback from Registration #2046, the scoring pipeline was upgraded with **factual dominance gating & separation enhancement**:

- **Continuous Relative Error Curve**: Evaluates candidate numeric prices against ground truth via a continuous Gaussian error curve ($\le 0.8\%$ error gives $1.00$; small spreads decay smoothly; $>3.5\%$ error drops to $0.00$), preventing false prices from being rescued by semantic similarity.
- **Unit & Suffix Normalization**: Fully parses and normalizes currency values, commas, decimal values, scientific exponents (`2.5e-5`), suffixes (`$65.4k` $\rightarrow 65,400$, `1.85m` $\rightarrow 1,850,000$, `55 cents` / `55c` $\rightarrow 0.55$), and handles conflicting candidate numbers.
- **Dynamic Entity & Ticker Recognition**: Dynamically extracts cryptocurrency asset names and ticker symbols from queries and ground truths (e.g. BTC, ETH, SOL, SUI, NEAR, INJ, TIA, KAS, etc.), penalizing answers that substitute competing assets while preserving concise answers without explicit names.
- **Currency & Polarity Consistency**: Rejects cross-currency mismatches (e.g. quoting EUR when USD is expected) and flags negation terms ("not trading at $65,400", "dropped below").
- **Stale & Historical Price Gating**: Distinguishes current spot inquiries from historical claims ("all-time high in 2021 was...", "peaked at", "opened at").
- **Non-Price Token Isolation**: Safely ignores timeframe intervals (`24h`, `7d`), timestamps (`14:00:00 UTC`), calendar dates (`August 30, 2026`), rankings (`#15`), and unit prefixes (`1 SOL =`) during price evaluation.
- **Strictly Monotonic Contrast Separation**: Applies a steep continuous power transform ($f(x) = \frac{x^{2.5}}{x^{2.5} + (1-x)^{2.5}}$) ensuring GOOD answers receive high scores ($>0.99$) and BAD answers are suppressed ($<0.01$).

---

## 3. Build & Compilation Instructions

### Prerequisites
- **Rust Toolchain**: `stable` (1.80+ or 1.98+)
- **Target**: `wasm32-unknown-unknown`
- **Compiler Options**: `opt-level = 3`, `lto = true`, `panic = "abort"`

### Build Command
From the repository root:
```bash
# Add WebAssembly compilation target
rustup target add wasm32-unknown-unknown

# Compile release WebAssembly binary
cd wasm/scorer_rust
cargo build --release --target wasm32-unknown-unknown --no-default-features

# Copy compiled binary to distribution artifacts
mkdir -p ../dist ../../docs
cp target/wasm32-unknown-unknown/release/telegraph_scoring.wasm ../dist/telegraph_sentinel_scorer.wasm
cp target/wasm32-unknown-unknown/release/telegraph_scoring.wasm ../../docs/sentinel_scorer.wasm
```

---

## 4. Verification & Validation Commands

Run the canonical 15-pair diagnostic and the 30-case adversarial validation suite:

```bash
# Run 15-pair canonical CRYPTO_PRICE diagnostic
node wasm/crypto_price_15_diagnostic.js

# Run full 30-case adversarial test suite
node wasm/validate_scorer.js
```

### Binary Header & Integrity Checks
```bash
# Verify WebAssembly magic header (\0asm -> 0x00 0x61 0x73 0x6d)
od -N 4 -tx1 wasm/dist/telegraph_sentinel_scorer.wasm

# Verify SHA-256 Checksum
sha256sum wasm/dist/telegraph_sentinel_scorer.wasm docs/sentinel_scorer.wasm

# Verify exact byte match
cmp wasm/dist/telegraph_sentinel_scorer.wasm docs/sentinel_scorer.wasm
```

---

## 5. Artifact Verification

| Property | Value |
| :--- | :--- |
| **Artifact Path** | `wasm/dist/telegraph_sentinel_scorer.wasm` |
| **Mirror Path** | `docs/sentinel_scorer.wasm` |
| **Binary Size** | `66,719 bytes` (~`65.2 KB`) |
| **SHA-256 Checksum** | `f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6` |
| **Integrity Match** | Byte-for-byte identical between `wasm/dist/` and `docs/` |

---

## 6. Required WebAssembly Function Exports

The compiled WASM binary exports all 8 required C-ABI functions for Telegraph protocol integration:

1. `alloc(size: i32) -> i32`  
   Allocates byte buffer in WASM memory for string/vector inputs.
2. `dealloc(ptr: i32, size: i32)`  
   Frees previously allocated memory buffer.
3. `rank_answer(q_ptr: i32, q_len: i32, gt_ptr: i32, gt_len: i32, ma_ptr: i32, ma_len: i32) -> f32`  
   Primary scoring function; returns overall composite score $[0.0, 1.0]$.
4. `rank_answer_cached(q_vec_ptr: i32, gt_vec_ptr: i32, gt_ptr: i32, gt_len: i32, ma_ptr: i32, ma_len: i32) -> f32`  
   Fast-path evaluator using pre-computed question and ground-truth embedding vectors.
5. `breakdown_answer(q_ptr: i32, q_len: i32, gt_ptr: i32, gt_len: i32, ma_ptr: i32, ma_len: i32) -> i32`  
   Returns pointer to 5-element float array: `[relevance, correctness, lexical, length, composite]`.
6. `embed(text_ptr: i32, text_len: i32) -> i32`  
   Generates 384-dimensional L2-normalized float embedding.
7. `cosine_sim(ptr_a: i32, ptr_b: i32, dim: i32) -> f32`  
   Computes cosine similarity between two float vectors.
8. `bm25_score(q_ptr: i32, q_len: i32, doc_ptr: i32, doc_len: i32) -> f32`  
   Single-document BM25 lexical overlap score.

---

## 7. Measured Benchmark Results

Detailed diagnostics are documented in [`docs/CRYPTO_PRICE_15_PAIR_DIAGNOSTIC.md`](CRYPTO_PRICE_15_PAIR_DIAGNOSTIC.md) and machine-readable in [`docs/CRYPTO_PRICE_VERIFICATION.json`](CRYPTO_PRICE_VERIFICATION.json).

### 15-Pair Canonical Diagnostic:
| Benchmark Metric | Measured Result | Threshold Target | Status |
| :--- | :--- | :--- | :--- |
| **Diagnostic Pairs** | `15` | `15` | **Complete** |
| **Ordering Accuracy** | `15 / 15` (**100.0%**) | $\ge 14 / 15$ | **PASS ✓** |
| **Average GOOD Score** | `0.9991` | $> 0.900` | **PASS ✓** |
| **Average BAD Score** | `0.0000` | $< 0.100` | **PASS ✓** |
| **Average Separation Margin** | **`+0.9991`** | $\ge 0.800$ | **PASS ✓** |
| **Minimum Separation Margin** | `+0.9975` | $> 0.000$ | **PASS ✓** |
| **Worst Self-Match Score** | `1.0000` | $\ge 0.950$ | **PASS ✓** |
| **Score Standard Deviation** | `0.4995` | Validated | **PASS ✓** |

### 30-Case Adversarial Validation:
| Benchmark Metric | Measured Result |
| :--- | :--- |
| **Adversarial Test Cases** | `30` |
| **Ordering Accuracy** | `30 / 30` (**100.0%**) |
| **Average Separation Margin** | **`+0.9991`** |
| **Minimum Separation Margin** | `+0.9962` |

> **Evaluation Set Disclosure:**  
> The score separation margin of **`+0.9991`** was measured on our local adversarial benchmark suite. Telegraph Protocol's evaluation set is private and evaluated on-chain by validators; while our local test suite comprehensively covers known failure modes, local benchmark results do not guarantee identical on-chain scores.

---

## 8. GitHub URLs for Telegraph Integration

- **Repository File URL:**  
  `https://github.com/peterkehinde673/telegraph-sentinel/blob/main/wasm/dist/telegraph_sentinel_scorer.wasm`
- **Raw Binary URL (For Telegraph Integrate Dashboard):**  
  `https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/wasm/dist/telegraph_sentinel_scorer.wasm`
