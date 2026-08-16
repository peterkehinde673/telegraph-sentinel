# Sentinel Risk Model

## Deterministic Formula
Risk Score = (Market Risk * 0.30) + (TVL Risk * 0.35) + (News Risk * 0.35)

## Decision Thresholds
* **0 - 30**: APPROVE (Low Risk)
* **31 - 60**: REVIEW (Moderate Risk)
* **61 - 80**: HIGH_RISK_REVIEW (Elevated Risk)
* **81 - 100**: BLOCK (Critical Risk)
* **Insufficient Data**: Triggered when active miners are unavailable or unresponsive.
