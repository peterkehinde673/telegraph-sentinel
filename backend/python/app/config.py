import os
from pydantic import BaseModel


class Settings(BaseModel):
    weight_market: float = float(os.getenv("WEIGHT_MARKET", "0.30"))
    weight_tvl: float = float(os.getenv("WEIGHT_TVL", "0.35"))
    weight_news: float = float(os.getenv("WEIGHT_NEWS", "0.35"))

    threshold_approve: float = float(os.getenv("THRESHOLD_APPROVE", "30.0"))
    threshold_review: float = float(os.getenv("THRESHOLD_REVIEW", "60.0"))
    threshold_block: float = float(os.getenv("THRESHOLD_BLOCK", "80.0"))

    db_path: str = os.getenv("SQLITE_DB_PATH", "sentinel.db")


settings = Settings()
