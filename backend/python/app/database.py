import json
import sqlite3
from typing import Any, Dict, List, Optional
from app.config import settings
from app.models import AnalyzeResponse, DecisionEnum, EvidenceItem, OperatingModeEnum, RawSignalInput


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
                mode TEXT NOT NULL DEFAULT 'ANALYZE',
                action_type TEXT NOT NULL,
                risk_score REAL NOT NULL,
                confidence_score REAL NOT NULL,
                decision TEXT NOT NULL,
                reason_codes_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                signals_json TEXT NOT NULL,
                evidence_json TEXT NOT NULL,
                verification_json TEXT NOT NULL,
                formula_json TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS watch_rules (
                rule_id TEXT PRIMARY KEY,
                asset TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'AUTOPILOT',
                risk_threshold REAL NOT NULL,
                confidence_threshold REAL NOT NULL,
                interval_minutes INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_checked TEXT
            )
        """)
        # Safe migration check
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(analyses)")
        columns = [row[1] for row in cursor.fetchall()]
        if "mode" not in columns:
            conn.execute("ALTER TABLE analyses ADD COLUMN mode TEXT NOT NULL DEFAULT 'ANALYZE'")
        if "reason_codes_json" not in columns:
            conn.execute("ALTER TABLE analyses ADD COLUMN reason_codes_json TEXT NOT NULL DEFAULT '[]'")

        conn.execute("CREATE INDEX IF NOT EXISTS idx_analyses_asset ON analyses(asset);")
    conn.close()


init_db()


def save_analysis(result: AnalyzeResponse):
    init_db()
    conn = get_connection()
    with conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO analyses (
                analysis_id, asset, mode, action_type, risk_score, confidence_score,
                decision, reason_codes_json, created_at, signals_json, evidence_json, verification_json, formula_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                result.analysis_id,
                result.asset,
                result.mode.value,
                result.action_type,
                result.risk_score,
                result.confidence_score,
                result.decision.value,
                json.dumps(result.reason_codes),
                result.created_at,
                json.dumps([s.model_dump() for s in result.signals]),
                json.dumps([e.model_dump() for e in result.evidence]),
                json.dumps(result.verification_metadata),
                json.dumps(result.formula_breakdown),
            ),
        )
    conn.close()


def save_watch_rule(rule: Dict[str, Any]):
    init_db()
    conn = get_connection()
    with conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO watch_rules (
                rule_id, asset, mode, risk_threshold, confidence_threshold, interval_minutes, status, created_at, last_checked
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rule["rule_id"],
                rule["asset"],
                rule.get("mode", "AUTOPILOT"),
                rule["risk_threshold"],
                rule["confidence_threshold"],
                rule["interval_minutes"],
                rule["status"],
                rule["created_at"],
                rule.get("last_checked"),
            ),
        )
    conn.close()


def get_all_watch_rules() -> List[Dict[str, Any]]:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM watch_rules ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_watch_rule_db(rule_id: str) -> bool:
    init_db()
    conn = get_connection()
    with conn:
        cursor = conn.execute("DELETE FROM watch_rules WHERE rule_id = ?", (rule_id,))
        count = cursor.rowcount
    conn.close()
    return count > 0


def list_recent_analyses(limit: int = 20) -> List[Dict[str, Any]]:
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT analysis_id, asset, mode, action_type, risk_score, confidence_score, decision, created_at FROM analyses ORDER BY created_at DESC LIMIT ?",
        (limit,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
