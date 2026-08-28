# Sentinel Risk Model

The Sentinel analysis combines three signal categories into a deterministic risk score.

## Formula

```text
Risk Score = (Market Risk × 0.30)
           + (TVL Risk × 0.35)
           + (News Risk × 0.35)
```

The weights give market conditions 30% of the total score and TVL/liquidity and news/security signals 35% each.

## Decision thresholds

| Risk score | Decision |
|---:|---|
| `0–30` | `APPROVE` |
| `31–60` | `REVIEW` |
| `61–80` | `HIGH_RISK_REVIEW` |
| `81–100` | `BLOCK` |

When required active signals are unavailable, the application can represent the affected signal as unavailable and reduce confidence accordingly.

## Confidence

Confidence is calculated independently from the risk score and reflects the confidence values supplied by the signal sources. This keeps the system's risk decision and confidence indication conceptually separate.

## Implementation note

The scoring logic described here reflects the current Node gateway implementation. Changes to the runtime scoring code should be documented separately from repository presentation/documentation changes.
