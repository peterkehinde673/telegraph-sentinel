# Telegraph Sentinel — Demonstration Guide

Use the production dashboard for the simplest project demonstration:

`https://telegraph-sentinel-d68u.onrender.com`

## Suggested walkthrough

1. Open the live dashboard.
2. Enter a supported crypto asset such as `ETH` or another asset accepted by the application.
3. Run the Sentinel analysis.
4. Review the returned decision, risk score, confidence, signal cards, and evidence.
5. Review the available Telegraph/miner information shown by the dashboard.
6. If demonstrating monitoring, configure a watch rule and observe the application's real-time update behavior.

## API demonstration

The production miner endpoint is:

`POST https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/risk-assessment`

Example:

```bash
curl -s -X POST \
  https://telegraph-sentinel-d68u.onrender.com/api/v1/miner/risk-assessment \
  -H "Content-Type: application/json" \
  -d '{"asset":"BTC"}'
```

## Repository evidence

For reviewers who want to inspect the implementation rather than only the UI, see:

- [`../README.md`](../README.md) — project overview and architecture
- [`architecture.md`](architecture.md) — component/data-flow diagram
- [`sentinel-miner.yaml`](sentinel-miner.yaml) — miner specification
- [`telegraph-integration.md`](telegraph-integration.md) — Telegraph routes and artifacts
