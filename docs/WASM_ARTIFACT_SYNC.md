# WebAssembly Artifact Synchronization & Verification Report

## 1. Executive Summary

This report documents the verification, tracking, and synchronization status of the release WebAssembly binary for the Telegraph Protocol Sentinel Scorer (`CRYPTO_PRICE` intent).

---

## 2. File Identification & Cryptographic Hashes

| Property | Workspace Primary Artifact | Workspace Mirror Artifact |
| :--- | :--- | :--- |
| **Exact File Path** | `wasm/dist/telegraph_sentinel_scorer.wasm` | `docs/sentinel_scorer.wasm` |
| **Exact Byte Size** | `77,663 bytes` | `77,663 bytes` |
| **SHA-256 Hash** | `46b6682c62ecebd3cb1aa5c36571a75c2590956b70752a7b8de24c8134276645` | `46b6682c62ecebd3cb1aa5c36571a75c2590956b70752a7b8de24c8134276645` |
| **Magic Header** | `0x00 0x61 0x73 0x6d` (`\0asm`) | `0x00 0x61 0x73 0x6d` (`\0asm`) |
| **cmp Verification** | Byte-for-byte identical (Exit Code: 0, 0 byte differences) | Byte-for-byte identical (Exit Code: 0, 0 byte differences) |
| **Git Tracking Status** | **Tracked** (`git ls-files` confirmed) | **Tracked** (`git ls-files` confirmed) |
| **.gitignore Exemption** | Explicitly whitelisted (`!wasm/dist/*.wasm`) | Explicitly whitelisted (`!docs/*.wasm`) |

---

## 3. Verification Commands & Output Log

```bash
$ wc -c wasm/dist/telegraph_sentinel_scorer.wasm docs/sentinel_scorer.wasm
77663 wasm/dist/telegraph_sentinel_scorer.wasm
77663 docs/sentinel_scorer.wasm

$ sha256sum wasm/dist/telegraph_sentinel_scorer.wasm docs/sentinel_scorer.wasm
46b6682c62ecebd3cb1aa5c36571a75c2590956b70752a7b8de24c8134276645  wasm/dist/telegraph_sentinel_scorer.wasm
46b6682c62ecebd3cb1aa5c36571a75c2590956b70752a7b8de24c8134276645  docs/sentinel_scorer.wasm

$ cmp wasm/dist/telegraph_sentinel_scorer.wasm docs/sentinel_scorer.wasm
# Output: (silent, exit code 0 - identical bytes)
```

---

## 4. GitHub Repository Paths & URLs

- **Primary WASM Repository URL:**  
  `https://github.com/peterkehinde673/telegraph-sentinel/blob/main/wasm/dist/telegraph_sentinel_scorer.wasm`
- **Mirror WASM Repository URL:**  
  `https://github.com/peterkehinde673/telegraph-sentinel/blob/main/docs/sentinel_scorer.wasm`
- **Exact Raw GitHub URL for Telegraph Integration:**  
  `https://raw.githubusercontent.com/peterkehinde673/telegraph-sentinel/main/wasm/dist/telegraph_sentinel_scorer.wasm`

---

## 5. Critical Warning on Remote GitHub Synchronization

> ⚠️ **IMPORTANT SYNCHRONIZATION WARNING**  
> 
> The local workspace and Git commits contain the verified **60,865-byte** artifact (`0116db4aea537375411af7b07a31249c216424cac35651868627c2546a5deccd`).  
> 
> If the remote GitHub repository at `https://github.com/peterkehinde673/telegraph-sentinel` has not yet had this Git commit pushed, it will still serve the previous **54,914-byte** binary from commit `8003e54`.
> 
> **Action Required Before Submitting to Telegraph:**  
> Ensure the latest commits are pushed to the GitHub remote repository `main` branch so that the raw GitHub URL serves the **60,865-byte** binary.
