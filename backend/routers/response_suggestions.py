"""
AI-Based Response Suggestions API Router
Endpoints for patient query submission, AI draft generation, and staff review/send.
"""
import sys
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/api/response-suggestions", tags=["AI Response Suggestions"])

from mongo import (
    patient_queries_col, draft_responses_col, knowledge_base_col,
    prescriptions_col, bookings_col, vitals_col
)

# Add ai-response-suggestions (located at project root) to path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
AI_PIPELINE_DIR = PROJECT_ROOT / "ai-response-suggestions"
if AI_PIPELINE_DIR.exists():
    sys.path.insert(0, str(AI_PIPELINE_DIR))

from pipeline import run_pipeline

# ── Gemini client setup (reuse existing pattern) ──
gemini_client = None
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print("[INIT] Response Suggestions: Gemini client initialized")
    except Exception as e:
        print(f"[WARN] Response Suggestions: Gemini init failed: {e}")


# ── Request/Response Models ──

class PatientQueryCreate(BaseModel):
    patient_email: str
    patient_name: str
    subject: str
    category: Literal["billing", "appointment", "medication", "lab_results", "general"] = "general"
    message: str
    priority: Literal["low", "medium", "high", "urgent"] = "medium"


class StaffReviewRequest(BaseModel):
    edited_text: Optional[str] = None
    staff_notes: Optional[str] = None
    staff_email: Optional[str] = None
    action: Literal["approve", "edit_and_approve", "reject", "reassign"]


class DraftSendRequest(BaseModel):
    staff_email: Optional[str] = None


class KnowledgeArticleCreate(BaseModel):
    title: str
    category: Literal["billing", "appointment", "medication", "lab_results", "general"]
    content: str
    tags: list[str] = []


# ── Helper ──

def _serialize_id(doc: dict) -> dict:
    """Convert MongoDB _id to string 'id' field."""
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


def _check_db():
    if patient_queries_col is None:
        raise HTTPException(status_code=503, detail="Database not available")


# ══════════════════════════════════════════════
# PATIENT QUERY ENDPOINTS
# ══════════════════════════════════════════════

@router.post("/queries")
def submit_query(body: PatientQueryCreate):
    """Patient submits a new query."""
    _check_db()

    now = datetime.utcnow().isoformat()
    doc = {
        "patient_email": body.patient_email,
        "patient_name": body.patient_name,
        "subject": body.subject,
        "category": body.category,
        "message": body.message,
        "priority": body.priority,
        "status": "pending",
        "created_at": now,
        "responded_at": None,
        "assigned_staff": None,
        "final_response": None,
    }
    result = patient_queries_col.insert_one(doc)
    return {"message": "Query submitted successfully", "id": str(result.inserted_id)}


@router.get("/queries")
def list_queries(
    status: Optional[str] = None,
    category: Optional[str] = None,
    patient_email: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 50,
):
    """List patient queries with optional filters."""
    _check_db()

    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    if patient_email:
        query["patient_email"] = patient_email
    if priority:
        query["priority"] = priority

    results = list(
        patient_queries_col.find(query).sort("created_at", -1).limit(limit)
    )

    return {
        "queries": [_serialize_id(r) for r in results],
        "total": len(results),
    }


@router.get("/queries/{query_id}")
def get_query(query_id: str):
    """Get a single query with its drafts and final response."""
    _check_db()

    try:
        query_doc = patient_queries_col.find_one({"_id": ObjectId(query_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid query ID")

    if not query_doc:
        raise HTTPException(status_code=404, detail="Query not found")

    # Fetch associated drafts
    drafts = []
    if draft_responses_col is not None:
        draft_docs = list(
            draft_responses_col.find({"query_id": query_id}).sort("created_at", -1)
        )
        drafts = [_serialize_id(d) for d in draft_docs]

    result = _serialize_id(query_doc)
    result["drafts"] = drafts
    return result


@router.post("/queries/{query_id}/generate-draft")
def generate_draft_for_query(query_id: str):
    """Trigger AI pipeline to generate a draft response for a query."""
    _check_db()

    try:
        query_doc = patient_queries_col.find_one({"_id": ObjectId(query_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid query ID")

    if not query_doc:
        raise HTTPException(status_code=404, detail="Query not found")

    # Build collection references for the pipeline
    db_collections = {
        "knowledge_base": knowledge_base_col,
        "prescriptions": prescriptions_col,
        "bookings": bookings_col,
        "vitals": vitals_col,
    }

    # Run the 3-stage AI pipeline
    pipeline_result = run_pipeline(
        gemini_client=gemini_client,
        db_collections=db_collections,
        query_id=query_id,
        patient_email=query_doc.get("patient_email", ""),
        patient_name=query_doc.get("patient_name", ""),
        subject=query_doc.get("subject", ""),
        message=query_doc.get("message", ""),
        category=query_doc.get("category", ""),
        priority=query_doc.get("priority", "medium"),
    )

    # Save the draft to MongoDB
    now = datetime.utcnow().isoformat()
    intent_data = pipeline_result.get("intent", {}) or {}
    draft_data = pipeline_result.get("draft", {}) or {}
    retrieval_data = pipeline_result.get("retrieval", {}) or {}

    draft_doc = {
        "query_id": query_id,
        "draft_text": draft_data.get("draft_text", "Unable to generate draft. Please write a manual response."),
        "intent": intent_data.get("category", query_doc.get("category", "general")),
        "urgency": intent_data.get("urgency", "medium"),
        "confidence_score": draft_data.get("confidence_score", 0.0),
        "knowledge_sources": retrieval_data.get("sources", []),
        "status": "generated",
        "created_at": now,
        "reviewed_by": None,
        "reviewed_at": None,
        "staff_notes": None,
        "pipeline_error": pipeline_result.get("error"),
    }

    if draft_responses_col is not None:
        result = draft_responses_col.insert_one(draft_doc)
        draft_doc["id"] = str(result.inserted_id)

    # Update query status
    patient_queries_col.update_one(
        {"_id": ObjectId(query_id)},
        {"$set": {"status": "ai_drafted", "category": intent_data.get("category", query_doc.get("category", "general"))}}
    )

    return {
        "message": "Draft generated successfully",
        "draft_id": draft_doc.get("id", ""),
        "draft_text": draft_doc["draft_text"],
        "intent": draft_doc["intent"],
        "confidence_score": draft_doc["confidence_score"],
        "sources": draft_doc["knowledge_sources"],
    }


# ══════════════════════════════════════════════
# DRAFT REVIEW ENDPOINTS (Staff)
# ══════════════════════════════════════════════

@router.get("/drafts")
def list_drafts(status: Optional[str] = None, limit: int = 50):
    """Staff: list all drafts for review."""
    if draft_responses_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    query = {}
    if status:
        query["status"] = status

    results = list(
        draft_responses_col.find(query).sort("created_at", -1).limit(limit)
    )

    # Enrich each draft with query info
    enriched = []
    for draft in results:
        draft = _serialize_id(draft)
        # Fetch parent query
        try:
            q = patient_queries_col.find_one({"_id": ObjectId(draft.get("query_id", ""))})
            if q:
                q = _serialize_id(q)
                draft["query_subject"] = q.get("subject", "")
                draft["query_message"] = q.get("message", "")
                draft["patient_name"] = q.get("patient_name", "")
                draft["patient_email"] = q.get("patient_email", "")
                draft["query_priority"] = q.get("priority", "medium")
                draft["query_category"] = q.get("category", "general")
        except Exception:
            pass
        enriched.append(draft)

    return {"drafts": enriched, "total": len(enriched)}


@router.get("/drafts/{draft_id}")
def get_draft(draft_id: str):
    """Get a single draft with its parent query details."""
    if draft_responses_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        draft = draft_responses_col.find_one({"_id": ObjectId(draft_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft ID")

    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft = _serialize_id(draft)

    # Fetch parent query
    try:
        q = patient_queries_col.find_one({"_id": ObjectId(draft.get("query_id", ""))})
        if q:
            draft["query"] = _serialize_id(q)
    except Exception:
        pass

    return draft


@router.put("/drafts/{draft_id}/review")
def review_draft(draft_id: str, body: StaffReviewRequest):
    """Staff: approve, edit, or reject a draft."""
    if draft_responses_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        draft = draft_responses_col.find_one({"_id": ObjectId(draft_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft ID")

    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    now = datetime.utcnow().isoformat()
    updates = {
        "reviewed_by": body.staff_email or "staff",
        "reviewed_at": now,
        "staff_notes": body.staff_notes or "",
    }

    if body.action == "approve":
        updates["status"] = "approved"
    elif body.action == "edit_and_approve":
        updates["status"] = "approved"
        if body.edited_text:
            updates["draft_text"] = body.edited_text
    elif body.action == "reject":
        updates["status"] = "rejected"
    elif body.action == "reassign":
        updates["status"] = "generated"  # Back to queue

    draft_responses_col.update_one({"_id": ObjectId(draft_id)}, {"$set": updates})

    # Update query status
    query_id = draft.get("query_id", "")
    if query_id and body.action in ("approve", "edit_and_approve"):
        patient_queries_col.update_one(
            {"_id": ObjectId(query_id)},
            {"$set": {"status": "staff_reviewing", "assigned_staff": body.staff_email or "staff"}}
        )

    return {"message": f"Draft {body.action}d successfully", "draft_id": draft_id}


@router.post("/drafts/{draft_id}/send")
def send_response(draft_id: str, body: DraftSendRequest = DraftSendRequest()):
    """Staff: send the approved response to the patient."""
    if draft_responses_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        draft = draft_responses_col.find_one({"_id": ObjectId(draft_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft ID")

    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    if draft.get("status") not in ("approved", "generated"):
        raise HTTPException(status_code=400, detail="Draft must be approved before sending")

    now = datetime.utcnow().isoformat()

    # Mark draft as sent
    draft_responses_col.update_one(
        {"_id": ObjectId(draft_id)},
        {"$set": {"status": "sent", "sent_at": now, "sent_by": body.staff_email or "staff"}}
    )

    # Update query with final response
    query_id = draft.get("query_id", "")
    if query_id:
        patient_queries_col.update_one(
            {"_id": ObjectId(query_id)},
            {"$set": {
                "status": "responded",
                "final_response": draft.get("draft_text", ""),
                "responded_at": now,
                "assigned_staff": body.staff_email or draft.get("reviewed_by", "staff"),
            }}
        )

    return {"message": "Response sent to patient", "draft_id": draft_id, "query_id": query_id}


# ══════════════════════════════════════════════
# KNOWLEDGE BASE ENDPOINTS
# ══════════════════════════════════════════════

@router.get("/knowledge")
def list_knowledge(category: Optional[str] = None, limit: int = 50):
    """List knowledge base articles."""
    if knowledge_base_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    query = {}
    if category:
        query["category"] = category

    results = list(knowledge_base_col.find(query).sort("created_at", -1).limit(limit))
    return {"articles": [_serialize_id(r) for r in results], "total": len(results)}


@router.post("/knowledge")
def add_knowledge_article(body: KnowledgeArticleCreate):
    """Add a knowledge base article."""
    if knowledge_base_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    doc = {
        "title": body.title,
        "category": body.category,
        "content": body.content,
        "tags": [t.lower() for t in body.tags],
        "created_at": datetime.utcnow().isoformat(),
    }
    result = knowledge_base_col.insert_one(doc)
    return {"message": "Article added", "id": str(result.inserted_id)}


# ══════════════════════════════════════════════
# STATS ENDPOINT
# ══════════════════════════════════════════════

@router.get("/stats")
def get_stats():
    """Dashboard stats for response suggestions."""
    _check_db()

    total = patient_queries_col.count_documents({})
    pending = patient_queries_col.count_documents({"status": "pending"})
    ai_drafted = patient_queries_col.count_documents({"status": "ai_drafted"})
    responded = patient_queries_col.count_documents({"status": "responded"})
    staff_reviewing = patient_queries_col.count_documents({"status": "staff_reviewing"})

    # Category breakdown
    categories = ["billing", "appointment", "medication", "lab_results", "general"]
    category_counts = {}
    for cat in categories:
        category_counts[cat] = patient_queries_col.count_documents({"category": cat})

    # Priority breakdown
    priorities = ["low", "medium", "high", "urgent"]
    priority_counts = {}
    for p in priorities:
        priority_counts[p] = patient_queries_col.count_documents({"priority": p, "status": {"$ne": "responded"}})

    return {
        "total_queries": total,
        "pending": pending,
        "ai_drafted": ai_drafted,
        "staff_reviewing": staff_reviewing,
        "responded": responded,
        "category_breakdown": category_counts,
        "priority_breakdown": priority_counts,
    }
