# Telegraph WASM Scorer Submission Specification

## 1. Purpose of the Scorer
The **Telegraph Sentinel WASM Scorer** (`telegraph_sentinel_scorer.wasm`) is a high-performance, deterministic WebAssembly scoring module designed to evaluate and rank answers submitted by decentralized oracle miners within the Telegraph Protocol.

Its primary role is to compute a normalized quality score ($[0.0, 1.0]$) comparing a candidate miner's answer against canonical ground truth given a specific crypto inquiry. The module combines semantic embeddings, continuous numeric consistency modeling, entity-class resolution, lexical BM25 matching, and non-linear separation transforms without external network or host-call dependencies.

---

## 2. Intent Specialization: `CRYPTO_PRICE`
While the scorer is general-purpose across DeFi and market inquiries, it includes optimized zero-dependency heuristic multipliers specifically tuned for the `CRYPTO_PRICE` intent:

- **Continuous Gaussian Numeric Error**: Calculates relative deviation between ground-truth figures (prices, market caps, TVL) and candidate numbers ($\exp(-35 \cdot \Delta^2)$), penalizing hallucinated extra numbers while granting appropriate partial credit for precise qualitative descriptions.
- **Canonical Asset-Class Collision Guard**: Distinguishes between cryptocurrency ticker symbols and asset names (e.g., verifying `ETH` / `Ethereum` vs. confusing `ETC`, `SOL`, `ADA`, `ARB`, `OP`), severely penalizing substituted competing asset tickers while preserving equivalence for canonical pairs (e.g. `BTC` $\leftrightarrow$ `Bitcoin`).
- **Currency & Polarity Consistency**: Flags currency unit mismatches (e.g., USD vs. EUR) and enforces strict negation guards (e.g., distinguishing "trading around" from "not trading around").
- **Strictly Monotonic Contrast Separation Curve**: Employs a continuous power curve ($f(x) = \frac{x^{2.5}}{x^{2.5} + (1-x)^{2.5}}$) that maximizes score separation margin between accurate miner answers and adversarial or inaccurate answers without violating monotonicity.

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

Run the comprehensive test fixture suite validating both `rank_answer` and `rank_answer_cached` equivalence:

```bash
# From repository root
node wasm/validate_scorer.js
```

### Binary Header & Integrity Checks
```bash
# Verify WebAssembly magic header (\0asm -> 0x00 0x61 0x73 0x6d)
od -N 4 -tx1 wasm/dist/telegraph_sentinel_scorer.wasm

# Verify SHA-256 Checksum
sha256sum wasm/dist/telegraph_sentinel_scorer.wasm
```

---

## 5. Artifact Verification

| Property | Value |
| :--- | :--- |
| **Artifact Path** | `wasm/dist/telegraph_sentinel_scorer.wasm` |
| **Mirror Path** | `docs/sentinel_scorer.wasm` |
| **Binary Size** | `44,613 bytes` (~`43.6 KB` / `107.0 KB` unstripped profile) |
| **SHA-256 Checksum** | `fdf3af77318ff77ce4fe448ed9bd026c1157b3c4ba5ddfabf0ed114dc2f0fa70` |
| **Release Commit** | Verified binary artifact tracked in repository |

---

## 6. Required WebAssembly Function Exports

The compiled WASM binary exports the required C-ABI functions for Telegraph protocol integration:

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

## 7. Benchmark Separation & Performance

| Benchmark Metric | Score Margin |
| :--- | :--- |
| **Baseline Scorer Separation** | `+0.6145` |
| **Telegraph Champion Separation (Target to beat)** | `+0.6686` |
| **Sentinel Enhanced Local Separation** | `+0.9784` |

> **Important Disclosure Regarding Benchmarks:**  
> The score separation margin of **`+0.9784`** is a **LOCAL benchmark result** evaluated against our deterministic 48-fixture synthetic test suite (covering asset ticker confusions, price variations, qualitative formatting, and negated queries).  
> It is **NOT** a claim or guarantee regarding Telegraph's private, hidden on-chain evaluation set. It demonstrates that the architecture correctly separates valid crypto answers from adversarial and inaccurate candidates under representative conditions.

---

## 8. GitHub URLs for Telegraph Integration

- **Repository File URL:**  
  `https://github.com/<owner>/<repo>/blob/main/wasm/dist/telegraph_sentinel_scorer.wasm`
- **Raw Binary URL (For Telegraph Integrate Dashboard):**  
  `https://raw.githubusercontent.com/<owner>/<repo>/main/wasm/dist/telegraph_sentinel_scorer.wasm`
