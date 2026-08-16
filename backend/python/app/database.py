import json
import sqlite3
from typing import Any, Dict, List, Optional
from app.config import settings
from app.models import AnalyzeResponse, DecisionEnum, EvidenceItem, RawSignalInput


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                analysis_id TEXT PRIMARY KEY,
                asset TEXT NOT NULL,
                action_type TEXT NOT NULL,
                risk_score REAL NOT NULL,
                confidence_score REAL NOT NULL,
                decision TEXT NOT NULL,
                created_at TEXT NOT NULL,
                signals_json TEXT NOT NULL,
                evidence_json TEXT NOT NULL,
                verification_json TEXT NOT NULL,
                formula_json TEXT NOT NULL
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_analyses_asset ON analyses(asset);")
    conn.close()


# Ensure tables exist upon import
init_db()


def save_analysis(result: AnalyzeResponse):
    init_db()
    conn = get_connection()
    with conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO analyses (
                analysis_id, asset, action_type, risk_score, confidence_score,
                decision, created_at, signals_json, evidence_json, verification_json, formula_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                result.analysis_id,
                result.asset,
                result.action_type,
                result.risk_score,
                result.confidence_score,
                result.decision.value,
                result.created_at,
                json.dumps([s.model_dump() for s in result.signals]),
                json.dumps([e.model_dump() for e in result.evidence]),
                json.dumps(result.verification_metadata),
                json.dumps(result.formula_breakdown),
            ),
        )
    conn.close()


def get_analysis_by_id(analysis_id: str) -> Optional[AnalyzeResponse]:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM analyses WHERE analysis_id = ?", (analysis_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return AnalyzeResponse(
        analysis_id=row["analysis_id"],
        asset=row["asset"],
        action_type=row["action_type"],
        risk_score=row["risk_score"],
        confidence_score=row["confidence_score"],
        decision=DecisionEnum(row["decision"]),
        created_at=row["created_at"],
        signals=[RawSignalInput(**s) for s in json.loads(row["signals_json"])],
        evidence=[EvidenceItem(**e) for e in json.loads(row["evidence_json"])],
        verification_metadata=json.loads(row["verification_json"]),
        formula_breakdown=json.loads(row["formula_json"]),
    )


def list_recent_analyses(limit: int = 20) -> List[Dict[str, Any]]:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT analysis_id, asset, action_type, risk_score, confidence_score, decision, created_at FROM analyses ORDER BY created_at DESC LIMIT ?",
        (limit,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
