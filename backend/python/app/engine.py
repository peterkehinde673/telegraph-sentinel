import uuid
from datetime import datetime, timezone
from typing import List, Tuple
from app.config import settings
from app.models import (
    AnalyzeRequest,
    AnalyzeResponse,
    DecisionEnum,
    EvidenceItem,
    OperatingModeEnum,
    RawSignalInput,
    SignalStatusEnum,
    SignalTypeEnum,
)


def evaluate_risk(request: AnalyzeRequest) -> AnalyzeResponse:
    analysis_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    reason_codes: List[str] = []

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

    if not successful_signals:
        return AnalyzeResponse(
            analysis_id=analysis_id,
            asset=request.asset,
            mode=request.mode,
            action_type=request.action_type,
            risk_score=0.0,
            confidence_score=0.0,
            decision=DecisionEnum.INSUFFICIENT_DATA,
            reason_codes=["INSUFFICIENT_TELEGRAPH_DATA"],
            created_at=now_iso,
            signals=request.signals,
            evidence=[
                EvidenceItem(
                    category="System",
                    miner_id=0,
                    summary="No active Telegraph miner signals available.",
                    risk_contribution=0.0,
                    status="FAILED",
                )
            ],
            verification_metadata={},
            formula_breakdown={"reason": "No valid signals"},
        )

    market_sig = signals_by_type[SignalTypeEnum.CRYPTO_PRICE]
    tvl_sig = signals_by_type[SignalTypeEnum.TVL_LOOKUP]
    news_sig = signals_by_type[SignalTypeEnum.WEB_SEARCH]

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
                    summary=f"{sig.miner_name} signal score {sig.risk_signal:.1f}/100 (weight {norm_w:.2f})",
                    risk_contribution=contribution,
                    status="ACTIVE",
                )
            )

    risk_score = min(100.0, max(0.0, round(risk_score, 2)))

    # Base Decision
    if risk_score <= settings.threshold_approve:
        base_decision = DecisionEnum.APPROVE
    elif risk_score <= settings.threshold_review:
        base_decision = DecisionEnum.REVIEW
    elif risk_score <= settings.threshold_block:
        base_decision = DecisionEnum.HIGH_RISK_REVIEW
    else:
        base_decision = DecisionEnum.BLOCK

    # Apply Mode Policies
    final_decision = base_decision
    max_single_risk = max((s.risk_signal for s in successful_signals), default=0.0)

    if request.mode == OperatingModeEnum.PROTECT:
        reason_codes.append("MODE_PROTECT_ENFORCED")
        if max_single_risk >= 75.0 and base_decision == DecisionEnum.REVIEW:
            final_decision = DecisionEnum.HIGH_RISK_REVIEW
            reason_codes.append("PROTECT_ESCALATION_SINGLE_SOURCE_CRITICAL")
        elif risk_score > settings.threshold_block:
            final_decision = DecisionEnum.BLOCK
            reason_codes.append("PROTECT_THRESHOLD_BLOCKED")
    elif request.mode == OperatingModeEnum.AUTOPILOT:
        reason_codes.append("MODE_AUTOPILOT_EVALUATED")
        if risk_score > settings.threshold_block:
            final_decision = DecisionEnum.BLOCK
            reason_codes.append("AUTOPILOT_CIRCUIT_BREAKER_TRIGGERED")
    else:
        reason_codes.append("MODE_ANALYZE_OBSERVATION")

    completeness_pts = (len(successful_signals) / 3.0) * 40.0
    avg_miner_conf = sum(s.confidence for s in successful_signals) / len(successful_signals)
    confidence_from_miners = (avg_miner_conf / 100.0) * 35.0
    verification_pts = 25.0 if bool(verification_meta) else 10.0

    total_confidence = min(100.0, max(0.0, round(completeness_pts + confidence_from_miners + verification_pts, 2)))

    return AnalyzeResponse(
        analysis_id=analysis_id,
        asset=request.asset,
        mode=request.mode,
        action_type=request.action_type,
        risk_score=risk_score,
        confidence_score=total_confidence,
        decision=final_decision,
        reason_codes=reason_codes,
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
            "sources_evaluated": len(successful_signals),
        },
    )
