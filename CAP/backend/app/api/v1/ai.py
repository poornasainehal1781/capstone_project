from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_manager
from app.schemas.ai import (
    ReplenishmentResponse,
    SalesTrendResponse,
    NearExpiryResponse,
    AIChatRequest,
    AIChatResponse,
    FullAIInsightsResponse
)
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["AI Decision Support & Assistant"])

@router.get(
    "/replenishment",
    response_model=ReplenishmentResponse,
    summary="AI Inventory Replenishment & Reorder Recommendations",
    description="Analyzes sales velocity, safety thresholds, and supplier lead times to recommend purchase quantities."
)
def get_replenishment_recommendations(
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    return AIService.get_replenishment_insights(db)

@router.get(
    "/sales-trends",
    response_model=SalesTrendResponse,
    summary="AI Sales Trend Analysis & Slow-Moving SKUs",
    description="Compares past 7 days against prior 7 days, evaluates product growth trajectories, and highlights capital locked in slow movers."
)
def get_sales_trends(
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    return AIService.get_sales_trends_insights(db)

@router.get(
    "/near-expiry",
    response_model=NearExpiryResponse,
    summary="Near-Expiry Shelf-Life Monitoring & FEFO Actions",
    description="Tracks batches approaching expiry with recommended markdowns. Strictly flags expired products as non-sellable."
)
def get_near_expiry_batches(
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    return AIService.get_near_expiry_insights(db)

@router.post(
    "/chat",
    response_model=AIChatResponse,
    summary="Manager Retail Assistant Chatbot",
    description="Answers natural-language floor operations queries using strictly grounded, predefined backend query functions."
)
def chat_with_copilot(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    return AIService.process_chat_message(
        message=payload.message,
        conversation_history=payload.conversation_history,
        db=db
    )

@router.get(
    "/insights",
    response_model=FullAIInsightsResponse,
    summary="Comprehensive AI Insights Dashboard Payload",
    description="Combines replenishment, trends, slow-moving items, near-expiry radar, and master executive summary."
)
def get_full_ai_insights(
    db: Session = Depends(get_db),
    manager = Depends(get_current_manager)
):
    repl = AIService.get_replenishment_insights(db)
    trends = AIService.get_sales_trends_insights(db)
    expiry = AIService.get_near_expiry_insights(db)

    engine_used = repl["engine"]
    model_used = repl["model_used"]
    is_fallback = repl["is_fallback"]
    fallback_reason = repl["fallback_reason"]

    master_summary = (
        f"{repl['executive_summary']} {trends['executive_summary']} "
        f"Shelf-life audit flagged {expiry['critical_count']} critical batches (<7 days) and {expiry['expired_count']} expired batches."
    )

    return {
        "engine": engine_used,
        "model_used": model_used,
        "is_fallback": is_fallback,
        "fallback_reason": fallback_reason,
        "replenishment": repl,
        "sales_trends": trends,
        "near_expiry": expiry,
        "master_ai_summary": master_summary
    }

