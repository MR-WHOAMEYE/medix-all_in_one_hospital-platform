"""
LangChain-based AI Intent Classification & Department Routing
Uses Gemini LLM via LangChain to classify patient queries and route
them to the correct hospital department.
"""
import os
import json
import logging
from typing import Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── Pydantic model for structured LLM output ──

class DepartmentClassification(BaseModel):
    """Structured output from the AI classification chain."""
    department: str = Field(description="The hospital department to route to")
    confidence: float = Field(description="Confidence score between 0.0 and 1.0")
    reasoning: str = Field(description="Brief explanation for the classification")
    urgency: str = Field(description="Urgency level: low, medium, high, or urgent")


# ── Valid departments ──
VALID_DEPARTMENTS = [
    "Cardiology",
    "Orthopedics",
    "Dermatology",
    "Neurology",
    "General Medicine",
    "Billing",
]

# ── Rule-based fallback mapping (keyword → department) ──
KEYWORD_RULES = {
    "Cardiology": [
        "chest pain", "heart", "cardiac", "palpitation", "blood pressure",
        "hypertension", "heartbeat", "angina", "arrhythmia", "ecg", "ekg",
        "cholesterol", "coronary", "cardiovascular",
    ],
    "Orthopedics": [
        "bone", "fracture", "joint", "knee", "hip", "spine", "back pain",
        "shoulder", "arthritis", "ligament", "tendon", "sprain", "orthopedic",
        "posture", "scoliosis", "cast", "dislocation",
    ],
    "Dermatology": [
        "skin", "rash", "acne", "eczema", "dermatitis", "itch", "mole",
        "psoriasis", "fungal", "allergy", "hives", "sunburn", "blister",
        "wart", "pigmentation",
    ],
    "Neurology": [
        "headache", "migraine", "seizure", "numbness", "dizziness", "brain",
        "nerve", "tremor", "stroke", "memory loss", "epilepsy", "neurology",
        "tingling", "paralysis", "concussion",
    ],
    "Billing": [
        "bill", "billing", "insurance", "payment", "cost", "charge", "refund",
        "claim", "copay", "deductible", "invoice", "receipt", "coverage",
        "premium", "reimbursement",
    ],
}


def _rule_based_classify(query: str) -> Optional[DepartmentClassification]:
    """
    Fallback rule-based classification using keyword matching.
    Returns None if no strong match is found.
    """
    query_lower = query.lower()
    scores = {}
    for dept, keywords in KEYWORD_RULES.items():
        score = sum(1 for kw in keywords if kw in query_lower)
        if score > 0:
            scores[dept] = score

    if not scores:
        return None

    best_dept = max(scores, key=scores.get)
    max_possible = len(KEYWORD_RULES[best_dept])
    confidence = min(0.95, 0.5 + (scores[best_dept] / max_possible) * 0.5)

    # Urgency heuristic
    urgency = "medium"
    urgent_words = ["severe", "emergency", "urgent", "unbearable", "sudden", "acute", "critical"]
    high_words = ["pain", "bleeding", "swelling", "difficulty", "persistent"]
    if any(w in query_lower for w in urgent_words):
        urgency = "urgent"
    elif any(w in query_lower for w in high_words):
        urgency = "high"

    return DepartmentClassification(
        department=best_dept,
        confidence=round(confidence, 2),
        reasoning=f"Rule-based match: {scores[best_dept]} keyword(s) matched for {best_dept}",
        urgency=urgency,
    )


def classify_with_langchain(query: str, gemini_client=None) -> DepartmentClassification:
    """
    Primary classification using LangChain + Gemini LLM.
    Falls back to rule-based classification if LLM is unavailable.
    """

    # ── Try LangChain + Gemini first ──
    if gemini_client:
        try:
            prompt_text = f"""You are a hospital triage AI. Classify the following patient query
into exactly one hospital department and assess its urgency.

Valid departments: {', '.join(VALID_DEPARTMENTS)}

Patient query: "{query}"

Respond with ONLY a JSON object (no markdown, no extra text):
{{
    "department": "<one of the valid departments>",
    "confidence": <float between 0.0 and 1.0>,
    "reasoning": "<brief 1-sentence explanation>",
    "urgency": "<low|medium|high|urgent>"
}}"""

            response = gemini_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt_text,
            )

            raw = response.text.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()

            parsed = json.loads(raw)

            # Validate department is in allowed list
            dept = parsed.get("department", "General Medicine")
            if dept not in VALID_DEPARTMENTS:
                dept = "General Medicine"

            return DepartmentClassification(
                department=dept,
                confidence=min(1.0, max(0.0, float(parsed.get("confidence", 0.8)))),
                reasoning=parsed.get("reasoning", "AI classification"),
                urgency=parsed.get("urgency", "medium"),
            )

        except Exception as e:
            logger.warning(f"LangChain/Gemini classification failed: {e}, falling back to rules")

    # ── Fallback: rule-based ──
    result = _rule_based_classify(query)
    if result:
        return result

    # ── Ultimate fallback: General Medicine ──
    return DepartmentClassification(
        department="General Medicine",
        confidence=0.3,
        reasoning="No strong keyword match found; routed to General Medicine as default",
        urgency="medium",
    )
