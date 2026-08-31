# WebAssembly Build & Mirror Synchronization Status

| Artifact Path | Size (Bytes) | SHA-256 Checksum | Sync Status |
| :--- | :--- | :--- | :--- |
| `wasm/dist/telegraph_sentinel_scorer.wasm` | `96092` | `79121087104f537fbadee4ea3cd060f427eec4f75494d40a0341d0aa3f0cd999` | PRIMARY ✓ |
| `docs/sentinel_scorer.wasm` | `96092` | `79121087104f537fbadee4ea3cd060f427eec4f75494d40a0341d0aa3f0cd999` | SYNCHRONIZED ✓ |

## Verification Command
```bash
cmp wasm/dist/telegraph_sentinel_scorer.wasm docs/sentinel_scorer.wasm && echo "BYTE-IDENTICAL"
