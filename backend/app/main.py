from typing import Any

from fastapi import APIRouter, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.repositories.architecture_repo import get_architecture_data
from app.repositories.asset_vault_repo import (
    get_asset_evidence_pack,
    get_asset_views,
    get_assets_index,
)
from app.repositories.assets_repo import get_assets_data
from app.repositories.brief_repo import get_brief, list_briefs
from app.repositories.cognitive_repo import get_cognitive_data, get_dimensions_page
from app.repositories.decisions_repo import get_decisions_data
from app.repositories.discipline_repo import get_discipline_data
from app.repositories.market_repo import get_market_data
from app.repositories.overview_repo import (
    get_latest_brief,
    get_overview_metrics,
    get_system_status,
)
from app.repositories.rag_vault_repo import rag_query, rag_suggestions
from app.repositories.vault_repo import (
    get_note_detail,
    get_vault_summary,
    list_notes,
    open_note_local,
)
from app.research_service import (
    AGENT_SCRIPTS,
    gate_question,
    get_job,
    list_jobs,
    submit_job,
)


class MetaResponse(BaseModel):
    data_mode: str
    phase: str
    status: str


class ResearchJobRequest(BaseModel):
    goal: str = Field(min_length=1, max_length=500)
    category: str | None = Field(default=None, max_length=50)
    agent_type: str | None = Field(default=None, max_length=32)


class RagQueryRequest(BaseModel):
    text: str = ""
    top_k: int = Field(default=10, ge=1, le=100)
    score_threshold: float = Field(default=0.0, ge=0.0, le=1.0)
    max_days: int | None = Field(default=None, ge=1)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, ge=1, le=100)


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


@api_router.get("/cognitive")
def get_cognitive() -> dict:
    return {"cognitive_data": get_cognitive_data()}


@api_router.get("/cognitive/dimensions")
def get_cognitive_dimensions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    topic: str | None = Query(default=None),
    pointer: str | None = Query(default=None),
    claim_level: str | None = Query(default=None),
    source_layer: str | None = Query(default=None),
) -> dict:
    """认知维度明细分页（原文两次点击下钻数据源）"""
    return {
        "dimensions_page": get_dimensions_page(
            page=page,
            page_size=page_size,
            topic=topic,
            pointer=pointer,
            claim_level=claim_level,
            source_layer=source_layer,
        )
    }


@api_router.get("/discipline")
def get_discipline() -> dict:
    return {"discipline_data": get_discipline_data()}


@api_router.get("/market")
def get_market() -> dict:
    return {"market_data": get_market_data()}


@api_router.get("/vault/summary")
def get_vault_summary_endpoint() -> dict:
    return {"vault_summary": get_vault_summary()}


@api_router.get("/notes")
def get_notes(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    query: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    tags: list[str] | None = Query(default=None),
    source: str | None = Query(default=None),
    sort: str = Query(default="date_desc"),
) -> dict:
    return {
        "notes_data": list_notes(
            page=page,
            page_size=page_size,
            query=query,
            date_from=date_from,
            date_to=date_to,
            tags=tags,
            source=source,
            sort=sort,
        )
    }


@api_router.get("/notes/{note_id}")
def get_note(note_id: str) -> dict:
    note = get_note_detail(note_id)
    if note is None:
        raise HTTPException(status_code=404, detail={"error": "note not found"})
    return {"note": note}


@api_router.post("/notes/{note_id}/open-local")
def open_local_note(note_id: str) -> dict:
    try:
        return open_note_local(note_id)
    except PermissionError:
        raise HTTPException(
            status_code=403,
            detail={"error": "local note opening is disabled"},
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail={"error": "note not found"})
    except OSError as error:
        raise HTTPException(
            status_code=500,
            detail={"error": str(error) or "unable to open note"},
        )


@api_router.get("/vault/assets")
def get_vault_assets() -> dict:
    return {"assets_index": get_assets_index()}


@api_router.get("/vault/assets/{asset_id}/evidence-pack")
def get_vault_asset_evidence_pack(
    asset_id: str,
    horizon: str = Query(default="medium"),
) -> dict:
    return {
        "evidence_pack": get_asset_evidence_pack(
            asset_id=asset_id,
            horizon=horizon,
        )
    }


@api_router.get("/vault/assets/{asset_id}/views")
def get_vault_asset_views(
    asset_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> dict:
    return {
        "views_data": get_asset_views(
            asset_id=asset_id,
            page=page,
            page_size=page_size,
        )
    }


@api_router.post("/rag/query")
def query_rag(request: RagQueryRequest) -> dict[str, Any]:
    return {
        "rag_data": rag_query(
            text=request.text,
            top_k=request.top_k,
            score_threshold=request.score_threshold,
            max_days=request.max_days,
            page=request.page,
            page_size=request.page_size,
        )
    }


@api_router.get("/rag/suggestions")
def get_rag_suggestions() -> dict:
    return {"suggestions": rag_suggestions()}


# ---------- 研究任务 API（P1-C，2026-09-03） ----------


@api_router.post("/research/jobs", status_code=202)
def create_research_job(request: ResearchJobRequest) -> dict:
    """提交研究任务：intent_gate fail-closed 拒收 block/clarify，放行则排队执行。

    - verdict=pass   -> 202 {job}（queued，后台线程跑 research_agent）
    - block/clarify  -> 422 {error: intent_blocked, gate: {...}}（与前端第二道闸同规则）
    """
    gate = gate_question(request.goal)
    if gate.get("verdict") != "pass":
        raise HTTPException(
            status_code=422,
            detail={"error": "intent_blocked", "gate": gate},
        )
    agent_type = request.agent_type
    if agent_type is not None and agent_type not in AGENT_SCRIPTS:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "unknown_agent_type",
                "agent_type": agent_type,
                "allowed": sorted(AGENT_SCRIPTS),
            },
        )
    job = submit_job(
        request.goal,
        category=gate.get("suggested_category") or request.category,
        gate=gate,
        agent_type=agent_type,
    )
    return {"job": job}


@api_router.get("/research/jobs/{job_id}")
def get_research_job(job_id: str) -> dict:
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail={"error": "research job not found"})
    return {"job": job}


@api_router.get("/research/jobs")
def list_research_jobs(
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    return {"jobs": list_jobs(limit=limit)}


app.include_router(api_router)