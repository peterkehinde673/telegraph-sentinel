# WebAssembly Build & Mirror Synchronization Status

| Artifact Path | Size (Bytes) | SHA-256 Checksum | Sync Status |
| :--- | :--- | :--- | :--- |
| `wasm/dist/telegraph_sentinel_scorer.wasm` | `102565` | `109b113818642c32ce3ef6aa8737a8b0a84cbb035fd14c4099879818af7777da` | PRIMARY ✓ |
| `docs/sentinel_scorer.wasm` | `102565` | `109b113818642c32ce3ef6aa8737a8b0a84cbb035fd14c4099879818af7777da` | SYNCHRONIZED ✓ |

## Verification Command
```bash
cmp wasm/dist/telegraph_sentinel_scorer.wasm docs/sentinel_scorer.wasm && echo "BYTE-IDENTICAL"
