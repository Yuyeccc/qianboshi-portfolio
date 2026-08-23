from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.repositories.architecture_repo import get_architecture_data
from app.repositories.assets_repo import get_assets_data
from app.repositories.brief_repo import get_brief, list_briefs
from app.repositories.decisions_repo import get_decisions_data
from app.repositories.discipline_repo import get_discipline_data
from app.repositories.market_repo import get_market_data
from app.repositories.overview_repo import (
    get_latest_brief,
    get_overview_metrics,
    get_system_status,
)


class MetaResponse(BaseModel):
    data_mode: str
    phase: str
    status: str


app = FastAPI(
    title="Qianboshi Portfolio API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api/v1")


@app.get("/health")
def get_health() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


@api_router.get("/meta", response_model=MetaResponse)
def get_meta() -> MetaResponse:
    return MetaResponse(
        data_mode="live",
        phase="phase-1",
        status="overview-live",
    )


@api_router.get("/overview")
def get_overview() -> dict:
    return {
        "metrics": get_overview_metrics(),
        "status": get_system_status(),
        "latest_brief": get_latest_brief(),
    }


@api_router.get("/overview/metrics")
def get_overview_only_metrics() -> dict:
    return {"metrics": get_overview_metrics()}


@api_router.get("/assets")
def get_assets() -> dict:
    return {"assets": get_assets_data()}


@api_router.get("/decisions")
def get_decisions() -> dict:
    return {"decisions_data": get_decisions_data()}


@api_router.get("/briefs")
def get_briefs() -> dict:
    return {"briefs": list_briefs()}


@api_router.get("/briefs/{filename}")
def get_brief_by_filename(filename: str) -> dict:
    brief = get_brief(filename)
    if brief is None:
        raise HTTPException(status_code=404, detail={"error": "not found"})
    return {"brief": brief}


@api_router.get("/architecture")
def get_architecture() -> dict:
    return {"architecture_data": get_architecture_data()}


@api_router.get("/discipline")
def get_discipline() -> dict:
    return {"discipline_data": get_discipline_data()}


@api_router.get("/market")
def get_market() -> dict:
    return {"market_data": get_market_data()}


app.include_router(api_router)