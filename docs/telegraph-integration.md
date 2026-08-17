# Telegraph Integrate — Track 1 Miner Specification

## Overview
Telegraph Sentinel participates in **Track 1: Providing Intelligence (Becoming a Miner)** by exposing an autonomous pre-flight DeFi risk intelligence endpoint on Telegraph Protocol.

## 3-Step Integrate Workflow
1. **YAML Specification**: Defines kind: miner, supported intents (`CRYPTO_RISK_ASSESSMENT`, `DEFI_PREFLIGHT_AUDIT`, `SECURITY_INCIDENT_SCAN`), endpoint schemas, and x402 pricing floor.
2. **Import & Hash**: Computes deterministic `keccak256` bytes32 hash of the normalized specification.
3. **On-Chain Registration (Base Sepolia)**: Registers the miner via the Base Sepolia Registry Contract (`eip155:84532`) linking the bytes32 hash and IPFS spec URI.

## Live Endpoints
* `GET /api/v1/miner/spec.yaml` — Machine-readable YAML miner integration schema.
* `POST /api/v1/miner/risk-assessment` — Intelligence evaluation endpoint for autonomous agents.
* `POST /api/v1/miner/yaml/validate` — YAML syntax parser and `keccak256` generator.
* `GET /api/v1/miner/contract-config` — Base Sepolia Registry ABI and contract address.
