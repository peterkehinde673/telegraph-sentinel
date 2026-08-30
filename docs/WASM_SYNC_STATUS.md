# WebAssembly Synchronization & Deployment Status

## 1. Executive Status: READY & CONFIRMED ON GITHUB ✓

Both local workspace artifacts and live GitHub endpoints are synchronized, byte-for-byte identical, and serving the verified 66,719-byte WebAssembly scorer binary.

---

## 2. Verified Artifact Audit

| Property | Primary Telegraph Path | Mirror Path | Remote GitHub (`wasm/dist`) |
| :--- | :--- | :--- | :--- |
| **Path** | `wasm/dist/telegraph_sentinel_scorer.wasm` | `docs/sentinel_scorer.wasm` | `https://raw.githubusercontent.com/.../wasm/dist/...` |
| **Exact Byte Size** | `66,719 bytes` | `66,719 bytes` | `66,719 bytes` (Confirmed via `curl`) |
| **SHA-256 Checksum** | `f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6` | `f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6` | `f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6` |
| **Magic Header** | `\0asm` (`0x00 0x61 0x73 0x6d`) | `\0asm` (`0x00 0x61 0x73 0x6d`) | `\0asm` (`0x00 0x61 0x73 0x6d`) |
| **Local Byte Comparison (`cmp`)** | Exit code `0` (0 byte differences) | Exit code `0` (0 byte differences) | Byte-for-byte match |
| **Git Tracking** | Tracked via `git ls-files` (`!wasm/dist/*.wasm`) | Tracked via `git ls-files` (`!docs/*.wasm`) | Confirmed live on GitHub `main` |

---

## 3. Remote Verification Check

```bash
# 1. Primary Artifact Live Check:
curl -s -H "Cache-Control: no-cache" https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/wasm/dist/telegraph_sentinel_scorer.wasm | wc -c
# Output: 66719

curl -s -H "Cache-Control: no-cache" https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/wasm/dist/telegraph_sentinel_scorer.wasm | sha256sum
# Output: f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6  -

# 2. Mirror Artifact Live Check:
curl -s -H "Cache-Control: no-cache" https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/docs/sentinel_scorer.wasm | wc -c
# Output: 66719

curl -s -H "Cache-Control: no-cache" https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/docs/sentinel_scorer.wasm | sha256sum
# Output: f7d7eaa58104ad35944f396942cbb715be85aed2d2a9a470ba0a94b5c24424a6  -
```

---

## 4. Telegraph Protocol Integration Endpoint

Use the primary raw binary endpoint for Telegraph Protocol registration:
`https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/wasm/dist/telegraph_sentinel_scorer.wasm`
