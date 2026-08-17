from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DecisionEnum(str, Enum):
    APPROVE = "APPROVE"
    REVIEW = "REVIEW"
    HIGH_RISK_REVIEW = "HIGH_RISK_REVIEW"
    BLOCK = "BLOCK"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class OperatingModeEnum(str, Enum):
    ANALYZE = "ANALYZE"
    PROTECT = "PROTECT"
    AUTOPILOT = "AUTOPILOT"


class SignalTypeEnum(str, Enum):
    CRYPTO_PRICE = "CRYPTO_PRICE"
    TVL_LOOKUP = "TVL_LOOKUP"
    WEB_SEARCH = "WEB_SEARCH"


class SignalStatusEnum(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    UNAVAILABLE = "unavailable"


class RawSignalInput(BaseModel):
    miner_id: int
    miner_name: str
    intent: SignalTypeEnum
    status: SignalStatusEnum = SignalStatusEnum.SUCCESS
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    risk_signal: float = Field(default=0.0, ge=0.0, le=100.0)
    confidence: float = Field(default=0.0, ge=0.0, le=100.0)
    data: Dict[str, Any] = Field(default_factory=dict)
    verification: Dict[str, Any] = Field(default_factory=dict)
    payment: Dict[str, Any] = Field(default_factory=dict)
    raw_response: Optional[Dict[str, Any]] = None


class AnalyzeRequest(BaseModel):
    asset: str
    mode: OperatingModeEnum = OperatingModeEnum.ANALYZE
    action_type: str = "GENERAL_ANALYSIS"
    signals: List[RawSignalInput] = Field(default_factory=list)


class EvidenceItem(BaseModel):
    category: str
    miner_id: int
    summary: str
    risk_contribution: float
    status: str


class AnalyzeResponse(BaseModel):
    analysis_id: str
    asset: str
    mode: OperatingModeEnum
    action_type: str
    risk_score: float
    confidence_score: float
    decision: DecisionEnum
    reason_codes: List[str]
    created_at: str
    signals: List[RawSignalInput]
    evidence: List[EvidenceItem]
    verification_metadata: Dict[str, Any]
    formula_breakdown: Dict[str, Any]


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
    weights: Dict[str, float]
    thresholds: Dict[str, float]
