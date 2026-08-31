# Telegraph Sentinel WASM Scorer — Structural Validation & Cross-Match Audit

## 1. Executive Summary

This report documents the structural validation fix for Telegraph Protocol registration under the `CRYPTO_PRICE` intent.

| Metric | Measured Value | Requirement / Invariant | Status |
| :--- | :--- | :--- | :--- |
| **Target Intent** | `CRYPTO_PRICE` | `CRYPTO_PRICE` | PASS ✓ |
| **Exact Self-Match Score** | **`1.0000`** | `== 1.0000` (Reserved for identity) | PASS ✓ |
| **Max Unrelated Cross-Match** | **`0.0000`** | `< 1.0000` (Strictly below self-match) | PASS ✓ |
| **Structural Separation Margin** | **`+1.0000`** | `> 0.8000` | PASS ✓ |
| **Cross-Match 1.0000 Collisions** | **`0`** | `0` | PASS ✓ |
| **Max Good Paraphrase Score** | **`0.9880`** | `< 1.0000` (Bounded ceiling) | PASS ✓ |
| **15-Pair Canonical Ordering** | **`15 / 15 (100.0%)`** | `>= 14 / 15` | PASS ✓ |
| **15-Pair Separation Margin** | **`+0.9878`** | `> 0.8000` (Champion: 0.8000) | PASS ✓ |
| **30-Case Protocol Audit** | **`30 / 30 (100.0%)`** | `100.0%` | PASS ✓ |
| **50-Case Adversarial Suite** | **`50 / 50 (100.0%)`** | `100.0%` | PASS ✓ |
| **117-Case Extended Adversarial**| **`117 / 117 (100.0%)`** | `100.0%` | PASS ✓ |
| **WASM Binary Size** | **`96,092 bytes`** | Valid WASM CDYLIB | PASS ✓ |
| **WASM SHA-256 Checksum** | `79121087104f537fbadee4ea3cd060f427eec4f75494d40a0341d0aa3f0cd999` | Genuinely rebuilt from source | PASS ✓ |
| **Mirror Synchronization** | `Byte-for-byte identical with docs/sentinel_scorer.wasm` | `cmp` verified | PASS ✓ |

---

## 2. Root Cause of Previous Telegraph Rejection (#2716)

Telegraph rejected registration #2716 with:
> *"structural validation failed: self-match (1.0000) did not beat unrelated cross-match (1.0000)"*

### Root Causes Identified:
1. **Premature Contrast Saturation**: `apply_high_separation_curve` mapped all raw scores $\ge 0.985$ directly to `1.0000`. As a result, good paraphrases and cross-matches containing similar numbers saturated at `1.0000`, matching exact self-matches.
2. **Missing Strict Identity Guard**: The score of `1.0000` was not reserved exclusively for normalized string identity.
3. **Cross-Fixture Disconnect**: Non-numeric or cross-asset prompt evaluations lacked a hard non-identical score bound.

---

## 3. Mathematical Score Architecture & Fix

### Score Hierarchy:
1. **Exact Normalized Identity**:
   ```rust
   if is_normalized_identical(ground_truth, miner_answer) {
       return 1.0000;
   }
