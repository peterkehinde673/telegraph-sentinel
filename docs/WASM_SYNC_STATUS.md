# WebAssembly Synchronization & Deployment Status

## 1. Executive Overview

This document records the exact specifications for the updated Telegraph Sentinel Scorer WebAssembly binary (`CRYPTO_PRICE` intent) and provides instructions for pushing the binary from an external terminal environment (such as Ubuntu or Termux).

---

## 2. Verified Artifact Specifications

| Property | Primary Path | Mirror Path |
| :--- | :--- | :--- |
| **Workspace Path** | `wasm/dist/telegraph_sentinel_scorer.wasm` | `docs/sentinel_scorer.wasm` |
| **Exact Byte Size** | `66,719 bytes` (~`65.2 KB`) | `66,719 bytes` (~`65.2 KB`) |
| **SHA-256 Checksum** | `f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6` | `f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6` |
| **Magic Number** | `0x00 0x61 0x73 0x6d` (`\0asm`) | `0x00 0x61 0x73 0x6d` (`\0asm`) |
| **Byte Match (`cmp`)** | Byte-for-byte identical (0 differences) | Byte-for-byte identical (0 differences) |
| **Git Tracking** | Explicitly tracked (`!wasm/dist/*.wasm`) | Explicitly tracked (`!docs/*.wasm`) |

---

## 3. Remote Synchronization Notice

Due to web-based container export limitations handling large binary assets, the compiled `.wasm` binary must be pushed to GitHub from an authenticated local/terminal Git environment (Ubuntu/Termux).

### Required Remote State Before Telegraph Registration
- **Raw GitHub Endpoint:**  
  `https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/wasm/dist/telegraph_sentinel_scorer.wasm`
- **Expected Remote Size:** `66,719 bytes`
- **Expected Remote SHA-256:** `f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6`

---

## 4. Manual Ubuntu / Termux Push Instructions

Run the following commands in your authenticated Ubuntu/Termux clone:

```bash
# 1. Pull the latest workspace changes
git pull origin main

# 2. Verify local files match the target 66,719-byte checksum
sha256sum wasm/dist/telegraph_sentinel_scorer.wasm docs/sentinel_scorer.wasm
# Expected output:
# f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6  wasm/dist/telegraph_sentinel_scorer.wasm
# f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6  docs/sentinel_scorer.wasm

# 3. Stage and commit the binary artifacts and updated documentation
git add -f wasm/dist/telegraph_sentinel_scorer.wasm docs/sentinel_scorer.wasm docs/WASM_SYNC_STATUS.md docs/CRYPTO_PRICE_15_PAIR_DIAGNOSTIC.md docs/CRYPTO_PRICE_VERIFICATION.json
git commit -m "fix(wasm): update wasm/dist binary to verified 66,719-byte artifact"

# 4. Push directly to GitHub
git push origin main

# 5. Verify the live remote binary
curl -s -H "Cache-Control: no-cache" https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/wasm/dist/telegraph_sentinel_scorer.wasm | wc -c
# Must output: 66719

curl -s -H "Cache-Control: no-cache" https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/wasm/dist/telegraph_sentinel_scorer.wasm | sha256sum
# Must output: f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6  -
```
