from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import get_analysis_by_id, init_db, list_recent_analyses, save_analysis
from app.engine import evaluate_risk
from app.models import AnalyzeRequest, AnalyzeResponse, HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Telegraph Sentinel Risk Engine",
    version="0.1.0",
    description="Deterministic crypto intelligence and risk engine consuming Telegraph Miner signals",
    lifespan=lifespan,
)

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
        version="0.1.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        weights={
            "market": settings.weight_market,
            "tvl": settings.weight_tvl,
            "news": settings.weight_news,
        },
        thresholds={
            "approve": settings.threshold_approve,
            "review": settings.threshold_review,
            "block": settings.threshold_block,
        },
    )


@app.post("/analyze", response_model=AnalyzeResponse, status_code=status.HTTP_200_OK)
async def analyze_endpoint(request: AnalyzeRequest):
    if not request.asset.strip():
        raise HTTPException(status_code=400, detail="Asset identifier cannot be empty")

    result = evaluate_risk(request)
    save_analysis(result)
    return result


@app.get("/analysis/{analysis_id}", response_model=AnalyzeResponse)
async def get_analysis_endpoint(analysis_id: str):
    record = get_analysis_by_id(analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis record not found")
    return record


@app.get("/analyses")
async def list_analyses_endpoint():
    return {"analyses": list_recent_analyses(limit=25)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
