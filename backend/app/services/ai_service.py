import os
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.services.retail_analytics_grounding import (
    get_today_sales_grounding,
    get_low_stock_grounding,
    get_month_top_products_grounding,
    get_replenishment_grounding,
    get_sales_trends_grounding,
    get_near_expiry_grounding,
    get_store_grounding_context_for_ai
)
from app.services.rule_based_engine import RuleBasedDecisionEngine

logger = logging.getLogger("smartretail.ai_service")

# Try to import openai client
try:
    from openai import OpenAI
    HAS_OPENAI_LIB = True
except ImportError:
    HAS_OPENAI_LIB = False
    logger.warning("openai python library not available. AI service will operate in deterministic rule-based fallback mode.")

class AIService:
    """
    Unified AI & Retail Decision Service.
    Integrates OpenAI GPT-4o-mini for strategic reasoning and summaries,
    with automatic, seamless failover to RuleBasedDecisionEngine.
    """

    @classmethod
    def is_openai_configured(cls) -> bool:
        """
        Validates whether OpenAI client can be initialized.
        """
        api_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY", "")
        return bool(HAS_OPENAI_LIB and api_key and len(api_key.strip()) > 10)

    @classmethod
    def get_openai_client(cls):
        if not cls.is_openai_configured():
            return None
        api_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY", "")
        return OpenAI(api_key=api_key.strip())

    @classmethod
    def get_replenishment_insights(cls, db: Session) -> Dict[str, Any]:
        """
        Generates stock replenishment recommendations with explainable rationale.
        Uses OpenAI when available to produce an executive synthesis; falls back cleanly.
        """
        grounding = get_replenishment_grounding(db)
        rule_summary = RuleBasedDecisionEngine.generate_replenishment_summary(grounding)

        if not cls.is_openai_configured():
            return {
                "engine": "RULE_BASED_FALLBACK",
                "model_used": "Deterministic Decision Engine v1.0",
                "is_fallback": True,
                "fallback_reason": "No OPENAI_API_KEY configured in environment. Operating in deterministic rule-based mode.",
                "total_items_analyzed": grounding["total_items_analyzed"],
                "items_needing_reorder": grounding["items_needing_reorder"],
                "total_estimated_restock_cost": grounding["total_estimated_restock_cost"],
                "recommendations": grounding["recommendations"],
                "executive_summary": rule_summary
            }

        try:
            client = cls.get_openai_client()
            recs_summary_text = "\n".join([
                f"- {r['product_name']}: stock={r['current_stock']} {r['min_stock_level']}, velocity={r['average_daily_sales']}/day, reorder={r['suggested_order_qty']} (Urgency: {r['urgency']})"
                for r in grounding["recommendations"][:5]
            ])
            prompt = (
                f"You are the SmartRetail AI Chief Merchandising Advisor. "
                f"Summarize our inventory replenishment needs in 2-3 concise, professional sentences based on these exact figures:\n"
                f"Total SKUs analyzed: {grounding['total_items_analyzed']}, Items needing reorder: {grounding['items_needing_reorder']}, "
                f"Total estimated cost: Rs. {grounding['total_estimated_restock_cost']:,.2f}.\n"
                f"Key items:\n{recs_summary_text}\n"
                f"State the primary operational priorities and procurement impact clearly."
            )
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=180,
                temperature=0.3
            )
            ai_text = response.choices[0].message.content.strip()

            return {
                "engine": "OPENAI_GPT",
                "model_used": "gpt-4o-mini",
                "is_fallback": False,
                "fallback_reason": None,
                "total_items_analyzed": grounding["total_items_analyzed"],
                "items_needing_reorder": grounding["items_needing_reorder"],
                "total_estimated_restock_cost": grounding["total_estimated_restock_cost"],
                "recommendations": grounding["recommendations"],
                "executive_summary": ai_text
            }
        except Exception as exc:
            logger.warning(f"OpenAI replenishment call failed: {exc}. Falling back to rule engine.")
            return {
                "engine": "RULE_BASED_FALLBACK",
                "model_used": "Deterministic Decision Engine v1.0",
                "is_fallback": True,
                "fallback_reason": f"OpenAI API call failed ({type(exc).__name__}). Seamlessly using deterministic decision engine.",
                "total_items_analyzed": grounding["total_items_analyzed"],
                "items_needing_reorder": grounding["items_needing_reorder"],
                "total_estimated_restock_cost": grounding["total_estimated_restock_cost"],
                "recommendations": grounding["recommendations"],
                "executive_summary": rule_summary
            }

    @classmethod
    def get_sales_trends_insights(cls, db: Session) -> Dict[str, Any]:
        """
        Analyzes sales trends and slow-moving products.
        """
        grounding = get_sales_trends_grounding(db)
        rule_summary = RuleBasedDecisionEngine.generate_sales_trends_summary(grounding)

        if not cls.is_openai_configured():
            return {
                "engine": "RULE_BASED_FALLBACK",
                "model_used": "Deterministic Decision Engine v1.0",
                "is_fallback": True,
                "fallback_reason": "No OPENAI_API_KEY configured in environment. Operating in deterministic rule-based mode.",
                **grounding,
                "executive_summary": rule_summary
            }

        try:
            client = cls.get_openai_client()
            prompt = (
                f"You are the SmartRetail AI Sales Director. Provide a 2-sentence executive summary of our sales trajectory:\n"
                f"Recent 7 Days: Rs. {grounding['recent_period_revenue']:,.2f} ({grounding['recent_orders']} orders) vs "
                f"Prior 7 Days: Rs. {grounding['prior_period_revenue']:,.2f} ({grounding['prior_orders']} orders).\n"
                f"Growth: {grounding['revenue_growth_pct']:+.1f}% ({grounding['overall_trend']}). "
                f"Slow-moving SKUs: {len(grounding['slow_moving_products'])} products."
            )
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150,
                temperature=0.3
            )
            ai_text = response.choices[0].message.content.strip()

            return {
                "engine": "OPENAI_GPT",
                "model_used": "gpt-4o-mini",
                "is_fallback": False,
                "fallback_reason": None,
                **grounding,
                "executive_summary": ai_text
            }
        except Exception as exc:
            logger.warning(f"OpenAI sales trend call failed: {exc}. Falling back to rule engine.")
            return {
                "engine": "RULE_BASED_FALLBACK",
                "model_used": "Deterministic Decision Engine v1.0",
                "is_fallback": True,
                "fallback_reason": f"OpenAI API call failed ({type(exc).__name__}). Using deterministic sales analytics.",
                **grounding,
                "executive_summary": rule_summary
            }

    @classmethod
    def get_near_expiry_insights(cls, db: Session) -> Dict[str, Any]:
        """
        Evaluates near-expiry batches and clearance actions.
        Strictly enforces food safety rules (never sell expired items; do not invent dates).
        """
        grounding = get_near_expiry_grounding(db)

        # Expiry is fundamentally governed by deterministic compliance rules
        return {
            "engine": "RULE_BASED_FALLBACK",
            "model_used": "Deterministic FEFO Shelf-Life Compliance Engine v1.0",
            "is_fallback": False,  # Primary deterministic compliance module
            "fallback_reason": None,
            **grounding
        }

    @classmethod
    def process_chat_message(
        cls,
        message: str,
        conversation_history: Optional[List[Dict[str, str]]],
        db: Session
    ) -> Dict[str, Any]:
        """
        Processes retail assistant chatbot messages.
        Answers manager questions using strictly grounded, predefined backend facts.
        """
        # Always resolve ground-truth facts first
        rule_result = RuleBasedDecisionEngine.answer_chat_query(message, db)

        if not cls.is_openai_configured():
            return {
                "reply": rule_result["reply"],
                "engine": "RULE_BASED_FALLBACK",
                "model_used": "Deterministic Decision Engine v1.0",
                "is_fallback": True,
                "intent_detected": rule_result["intent"],
                "grounding_data_used": rule_result.get("grounding_data"),
                "suggested_actions": rule_result.get("suggested_actions")
            }

        try:
            client = cls.get_openai_client()
            context = get_store_grounding_context_for_ai(db)

            system_prompt = (
                "You are the SmartRetail AI Floor Operations & Decision Copilot, assisting supermarket store managers.\n"
                "CRITICAL SECURITY & ACCURACY RULES:\n"
                "1. Answer strictly using the real store context provided below. NEVER invent fake numbers, dates, or products.\n"
                "2. If data is unavailable or zero, clearly state that it is unavailable.\n"
                "3. NEVER recommend selling expired food products. Expired items MUST be quarantined immediately.\n"
                "4. NEVER disclose passwords, API keys, database credentials, or customer PII.\n"
                "5. Keep responses concise, structured, professional, and actionable (use markdown bullet points).\n\n"
                f"CURRENT REAL STORE CONTEXT:\n{context}\n"
            )

            messages = [{"role": "system", "content": system_prompt}]
            if conversation_history:
                for h in conversation_history[-4:]:
                    messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
            messages.append({"role": "user", "content": message})

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=400,
                temperature=0.3
            )
            ai_reply = response.choices[0].message.content.strip()

            return {
                "reply": ai_reply,
                "engine": "OPENAI_GPT",
                "model_used": "gpt-4o-mini",
                "is_fallback": False,
                "intent_detected": rule_result["intent"],
                "grounding_data_used": rule_result.get("grounding_data"),
                "suggested_actions": rule_result.get("suggested_actions")
            }
        except Exception as exc:
            logger.warning(f"OpenAI chat call failed: {exc}. Falling back to rule-based engine.")
            return {
                "reply": rule_result["reply"],
                "engine": "RULE_BASED_FALLBACK",
                "model_used": "Deterministic Decision Engine v1.0",
                "is_fallback": True,
                "intent_detected": rule_result["intent"],
                "grounding_data_used": rule_result.get("grounding_data"),
                "suggested_actions": rule_result.get("suggested_actions")
            }

