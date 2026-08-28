# Telegraph Integration

Telegraph Sentinel includes the artifacts and HTTP routes needed to document its Telegraph miner integration.

## Network

The project targets **Base Sepolia** (`eip155:84532`).

## Miner specification

The checked-in machine-readable specification is [`sentinel-miner.yaml`](sentinel-miner.yaml). It identifies the Sentinel miner and its production base URL and exposes the risk-assessment route.

The production specification can also be retrieved from:

`GET https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/spec.yaml`

## Public application routes

The current Node gateway exposes the following integration-related routes:

| Method | Route | Purpose |
|---|---|---|
| `ALL` | `/api/v1/miner/risk-assessment` | Miner risk-assessment interface |
| `GET` | `/api/v1/miner/spec.yaml` | Generate the machine-readable miner specification |
| `POST` | `/api/v1/miner/yaml/validate` | Validate YAML submitted to the gateway |
| `GET` | `/api/v1/miner/contract-config` | Return registry configuration |
| `POST` | `/api/v1/miner/onchain/encode-register` | Validate registration parameters and encode a registration transaction |

## Integration artifacts

- [`sentinel-miner.yaml`](sentinel-miner.yaml) — miner specification
- [`sentinel_scorer.wasm`](sentinel_scorer.wasm) — WASM scorer artifact
- [`../README.md`](../README.md) — project overview and live deployment

## Important distinction

Local validation of the WASM scorer is useful for regression testing, determinism, and interface checks, but it does not reproduce Telegraph's hidden evaluation benchmark. Likewise, documentation changes should not be treated as changes to the registered on-chain artifact.
