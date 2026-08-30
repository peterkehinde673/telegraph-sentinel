# WebAssembly Synchronization & Deployment Status

## 1. Executive Status: NOT READY ON GITHUB (PENDING TERMINAL PUSH)

> **CRITICAL DEPLOYMENT STATE:**  
> The local workspace binary at `wasm/dist/telegraph_sentinel_scorer.wasm` has been updated and verified to match `docs/sentinel_scorer.wasm` byte-for-byte (`66,719 bytes`, SHA-256 `f7d7...`).  
> **However, GitHub is still serving the old 60,865-byte WASM.**  
> Because AI Studio's web export mechanism filters out or fails to push binary `.wasm` assets over Git sync, the final push **MUST** be performed from your authenticated Termux/Ubuntu environment using `git add -f`.  
> **DO NOT submit to Telegraph until the live curl check confirms 66,719 bytes on GitHub.**

---

## 2. Verified Artifact Audit

| Property | Primary Telegraph Path | Mirror Path | Verification Status |
| :--- | :--- | :--- | :--- |
| **Path** | `wasm/dist/telegraph_sentinel_scorer.wasm` | `docs/sentinel_scorer.wasm` | Identical Paths |
| **Exact Byte Size** | `66,719 bytes` | `66,719 bytes` | `wc -c` Verified |
| **SHA-256 Checksum** | `f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6` | `f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6` | Matched |
| **Magic Header** | `\0asm` (`0x00 0x61 0x73 0x6d`) | `\0asm` (`0x00 0x61 0x73 0x6d`) | Valid WASM Binary |
| **Byte Comparison (`cmp`)** | Exit code `0` (0 byte differences) | Exit code `0` (0 byte differences) | Byte-for-byte match |
| **Git Tracking** | Tracked via `git ls-files` & whitelisted in `.gitignore` (`!wasm/dist/*.wasm`) | Tracked via `git ls-files` (`!docs/*.wasm`) | Tracked |

---

## 3. Why GitHub Was Out of Sync

1. **Local vs Remote Divergence**: While `docs/sentinel_scorer.wasm` was previously committed, `wasm/dist/telegraph_sentinel_scorer.wasm` retained the 60,865-byte artifact on the remote GitHub repository.
2. **AI Studio Web Sync Limitation**: Web-based container sync workflows typically ignore or drop binary payloads (.wasm/.bin) during automatic export commits.
3. **Remedy**: The binary must be explicitly force-staged (`git add -f`) and pushed from an authenticated CLI terminal.

---

## 4. Target GitHub Integration Endpoint

- **Primary Integration URL**:  
  `https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/wasm/dist/telegraph_sentinel_scorer.wasm`
- **Expected Size upon Push**: `66719`
- **Expected SHA-256 upon Push**: `f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6`
