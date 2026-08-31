# WebAssembly Build & Mirror Synchronization Status

| Artifact Path | Size (Bytes) | SHA-256 Checksum | Sync Status |
| :--- | :--- | :--- | :--- |
| `wasm/dist/telegraph_sentinel_scorer.wasm` | `100878` | `f679b6a813dfb11318fd7310df5b1f66a4f2e97a57c83b6e0ec597f5105f32d1` | PRIMARY ✓ |
| `docs/sentinel_scorer.wasm` | `100878` | `f679b6a813dfb11318fd7310df5b1f66a4f2e97a57c83b6e0ec597f5105f32d1` | SYNCHRONIZED ✓ |

## Verification Command
```bash
cmp wasm/dist/telegraph_sentinel_scorer.wasm docs/sentinel_scorer.wasm && echo "BYTE-IDENTICAL"
