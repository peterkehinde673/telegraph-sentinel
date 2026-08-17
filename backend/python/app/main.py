from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import delete_watch_rule_db, get_all_watch_rules, init_db, list_recent_analyses, save_analysis, save_watch_rule
from app.engine import evaluate_risk
from app.models import AnalyzeRequest, AnalyzeResponse, HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Telegraph Sentinel Risk Engine", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="sentinel-python-risk-engine",
        version="0.2.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        weights={"market": settings.weight_market, "tvl": settings.weight_tvl, "news": settings.weight_news},
        thresholds={"approve": settings.threshold_approve, "review": settings.threshold_review, "block": settings.threshold_block},
    )


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(request: AnalyzeRequest):
    if not request.asset.strip():
        raise HTTPException(status_code=400, detail="Asset cannot be empty")
    result = evaluate_risk(request)
    save_analysis(result)
    return result


@app.get("/analyses")
async def list_analyses_endpoint():
    return {"analyses": list_recent_analyses(limit=25)}


@app.get("/watch-rules")
async def get_watch_rules_endpoint():
    return {"rules": get_all_watch_rules()}


@app.post("/watch-rules")
async def save_watch_rule_endpoint(rule: dict):
    save_watch_rule(rule)
    return {"status": "saved", "rule": rule}


@app.delete("/watch-rules/{rule_id}")
async def delete_watch_rule_endpoint(rule_id: str):
    success = delete_watch_rule_db(rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"status": "deleted", "rule_id": rule_id}
