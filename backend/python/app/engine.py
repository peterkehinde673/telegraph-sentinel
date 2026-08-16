import uuid
from datetime import datetime, timezone
from typing import List, Optional
from app.config import settings
from app.models import (
    AnalyzeRequest,
    AnalyzeResponse,
    DecisionEnum,
    EvidenceItem,
    RawSignalInput,
    SignalStatusEnum,
    SignalTypeEnum,
)


def calculate_decision(risk_score: float) -> DecisionEnum:
    if risk_score <= settings.threshold_approve:
        return DecisionEnum.APPROVE
    elif risk_score <= settings.threshold_review:
        return DecisionEnum.REVIEW
    elif risk_score <= settings.threshold_block:
        return DecisionEnum.HIGH_RISK_REVIEW
    else:
        return DecisionEnum.BLOCK


def evaluate_risk(request: AnalyzeRequest) -> AnalyzeResponse:
    analysis_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    signals_by_type = {
        SignalTypeEnum.CRYPTO_PRICE: None,
        SignalTypeEnum.TVL_LOOKUP: None,
        SignalTypeEnum.WEB_SEARCH: None,
    }

    successful_signals: List[RawSignalInput] = []
    evidence_items: List[EvidenceItem] = []
    verification_meta = {}

    for s in request.signals:
        signals_by_type[s.intent] = s
        if s.status == SignalStatusEnum.SUCCESS:
            successful_signals.append(s)
            if s.verification:
                verification_meta[f"miner_{s.miner_id}"] = s.verification

    # Handle insufficient Miner signals (Never fabricate data)
    if not successful_signals:
        return AnalyzeResponse(
            analysis_id=analysis_id,
            asset=request.asset,
            action_type=request.action_type,
            risk_score=0.0,
            confidence_score=0.0,
            decision=DecisionEnum.INSUFFICIENT_DATA,
            created_at=now_iso,
            signals=request.signals,
            evidence=[
                EvidenceItem(
                    category="System",
                    miner_id=0,
                    summary="No active Telegraph miner responses received. Credentials unconfigured or miner offline.",
                    risk_contribution=0.0,
                    status="FAILED",
                )
            ],
            verification_metadata={},
            formula_breakdown={"weights": {}, "effective_weights": {}, "reason": "No valid signals"},
        )

    market_sig = signals_by_type[SignalTypeEnum.CRYPTO_PRICE]
    tvl_sig = signals_by_type[SignalTypeEnum.TVL_LOOKUP]
    news_sig = signals_by_type[SignalTypeEnum.WEB_SEARCH]

    # Calculate active dynamic weights
    active_weights = {}
    if market_sig and market_sig.status == SignalStatusEnum.SUCCESS:
        active_weights[SignalTypeEnum.CRYPTO_PRICE] = settings.weight_market
    if tvl_sig and tvl_sig.status == SignalStatusEnum.SUCCESS:
        active_weights[SignalTypeEnum.TVL_LOOKUP] = settings.weight_tvl
    if news_sig and news_sig.status == SignalStatusEnum.SUCCESS:
        active_weights[SignalTypeEnum.WEB_SEARCH] = settings.weight_news

    weight_sum = sum(active_weights.values())
    norm_weights = {k: v / weight_sum for k, v in active_weights.items()} if weight_sum > 0 else {}

    risk_score = 0.0
    for stype, norm_w in norm_weights.items():
        sig = signals_by_type[stype]
        if sig:
            contribution = round(sig.risk_signal * norm_w, 2)
            risk_score += contribution
            evidence_items.append(
                EvidenceItem(
                    category=stype.value,
                    miner_id=sig.miner_id,
                    summary=f"{sig.miner_name} signal score {sig.risk_signal:.1f}/100 with weight {norm_w:.2f}",
                    risk_contribution=contribution,
                    status="ACTIVE",
                )
            )

    # Signal Agreement / Conflict Analysis:
    # If market risk is low (<30) but news risk is high (>70) or vice versa, flag conflict
    signal_conflict_detected = False
    if market_sig and news_sig and market_sig.status == SignalStatusEnum.SUCCESS and news_sig.status == SignalStatusEnum.SUCCESS:
        diff = abs(market_sig.risk_signal - news_sig.risk_signal)
        if diff >= 40.0:
            signal_conflict_detected = True
            evidence_items.append(
                EvidenceItem(
                    category="Conflict Analysis",
                    miner_id=0,
                    summary=f"High signal divergence detected between Market ({market_sig.risk_signal}) and News/Security ({news_sig.risk_signal}). Discrepancy delta: {diff:.1f} pts.",
                    risk_contribution=5.0,
                    status="WARNING",
                )
            )
            risk_score += 5.0  # Apply penalty for contradictory signals

    risk_score = min(100.0, max(0.0, round(risk_score, 2)))

    # Multi-factor Confidence calculation:
    # 1. Source completeness (out of 3 miners) = max 40 pts
    # 2. Average individual Miner confidence = max 35 pts
    # 3. Verification presence = max 25 pts
    # 4. Conflict penalty = -15 pts if divergence detected
    completeness_pts = (len(successful_signals) / 3.0) * 40.0
    avg_miner_conf = sum(s.confidence for s in successful_signals) / len(successful_signals)
    confidence_from_miners = (avg_miner_conf / 100.0) * 35.0
    verification_pts = 25.0 if bool(verification_meta) else 10.0
    conflict_penalty = 15.0 if signal_conflict_detected else 0.0

    total_confidence = min(100.0, max(0.0, round(completeness_pts + confidence_from_miners + verification_pts - conflict_penalty, 2)))
    decision = calculate_decision(risk_score)

    return AnalyzeResponse(
        analysis_id=analysis_id,
        asset=request.asset,
        action_type=request.action_type,
        risk_score=risk_score,
        confidence_score=total_confidence,
        decision=decision,
        created_at=now_iso,
        signals=request.signals,
        evidence=evidence_items,
        verification_metadata=verification_meta,
        formula_breakdown={
            "configured_weights": {
                "market": settings.weight_market,
                "tvl": settings.weight_tvl,
                "news": settings.weight_news,
            },
            "normalized_weights": {k.value: round(v, 4) for k, v in norm_weights.items()},
            "sources_evaluated": len(successful_signals),
            "conflict_penalty_applied": signal_conflict_detected,
        },
    )
