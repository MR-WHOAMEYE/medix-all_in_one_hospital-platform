"""
Hospital Inter-Department Workflow Automation System
====================================================
FastAPI router that manages patient queries with:
- AI-powered intent classification (LangChain + Gemini)
- Rule-based department routing fallback
- Full status lifecycle: NEW → ASSIGNED → IN_PROGRESS → WAITING_FOR_PATIENT → RESOLVED → CLOSED
- Workflow logging for every state change
- Doctor dashboard endpoints (view, update, respond)

Collections used:
  - workflow_requests  : main request documents
  - workflow_logs      : audit trail of every status/dept change
  - departments        : department metadata & doctor lists
  - workflow_templates : (legacy) template definitions
"""
import os
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Literal
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/api/workflow", tags=["Workflow Automation"])

from mongo import (
    workflow_requests_col, workflow_logs_col, departments_col,
    workflow_templates_col, workflow_instances_col,
)

# ── Gemini client (reuse project pattern) ──
gemini_client = None
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print("[INIT] Workflow AI Router: Gemini client initialized")
    except Exception as e:
        print(f"[WARN] Workflow AI Router: Gemini init failed: {e}")

# Import LangChain-based classifier
from workflow_ai_router import classify_with_langchain, VALID_DEPARTMENTS


# ══════════════════════════════════════════════
# PYDANTIC MODELS
# ══════════════════════════════════════════════

# Status lifecycle
STATUS_FLOW = ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_PATIENT", "RESOLVED", "CLOSED"]

StatusType = Literal["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_PATIENT", "RESOLVED", "CLOSED"]


class SubmitQueryRequest(BaseModel):
    """Payload for /submit_query – patient submits a new query."""
    patient_id: str
    patient_name: str
    patient_email: str
    patient_phone: Optional[str] = None
    query: str


class UpdateStatusRequest(BaseModel):
    """Payload for updating request status."""
    status: StatusType
    updated_by: Optional[str] = None
    notes: Optional[str] = None


class AssignDoctorRequest(BaseModel):
    """Payload for assigning a doctor to a request."""
    request_id: str
    doctor_name: str
    doctor_email: Optional[str] = None
    notes: Optional[str] = None


class DoctorResponseRequest(BaseModel):
    """Payload for doctor submitting a response."""
    response_text: str
    doctor_email: Optional[str] = None


# ── Helpers ──

def _sid(doc: dict) -> dict:
    """Convert MongoDB _id to string 'id' field."""
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


def _check():
    if workflow_requests_col is None:
        raise HTTPException(status_code=503, detail="Database not available")


def _log(request_id: str, action: str, prev_status: str, new_status: str,
         prev_department: str = None, new_department: str = None,
         performed_by: str = None, notes: str = None):
    """Write an entry to workflow_logs collection."""
    if workflow_logs_col is None:
        return
    workflow_logs_col.insert_one({
        "request_id": request_id,
        "action": action,
        "previous_status": prev_status,
        "new_status": new_status,
        "previous_department": prev_department,
        "new_department": new_department,
        "performed_by": performed_by,
        "notes": notes,
        "timestamp": datetime.utcnow().isoformat(),
    })


# ══════════════════════════════════════════════
# 1. SUBMIT QUERY — AI classification + auto-route
# ══════════════════════════════════════════════

@router.post("/submit_query")
def submit_query(body: SubmitQueryRequest):
    """
    Patient submits a query.  The system:
      1. Classifies intent via LangChain / Gemini
      2. Routes to the predicted department
      3. Creates a request with status NEW
      4. Logs the creation event
    """
    _check()
    now = datetime.utcnow().isoformat()

    # ── AI Classification ──
    classification = classify_with_langchain(body.query, gemini_client=gemini_client)

    # ── Build request document ──
    doc = {
        "patient": {
            "patient_id": body.patient_id,
            "name": body.patient_name,
            "email": body.patient_email,
            "phone": body.patient_phone,
        },
        "query": body.query,
        "department": classification.department,
        "status": "NEW",
        "assigned_doctor": None,
        "doctor_response": None,
        "ai_classification": {
            "department": classification.department,
            "confidence": classification.confidence,
            "reasoning": classification.reasoning,
            "urgency": classification.urgency,
        },
        "urgency": classification.urgency,
        "created_at": now,
        "updated_at": now,
        "resolved_at": None,
    }

    result = workflow_requests_col.insert_one(doc)
    request_id = str(result.inserted_id)

    # ── Log creation ──
    _log(request_id, "CREATED", "-", "NEW",
         prev_department=None, new_department=classification.department,
         performed_by="system",
         notes=f"AI routed to {classification.department} (confidence: {classification.confidence})")

    return {
        "message": "Query submitted and routed successfully",
        "request_id": request_id,
        "routed_to": classification.department,
        "classification": classification.model_dump(),
    }


# ══════════════════════════════════════════════
# 2. LIST / GET REQUESTS
# ══════════════════════════════════════════════

@router.get("/requests")
def list_requests(
    status: Optional[str] = None,
    department: Optional[str] = None,
    patient_email: Optional[str] = None,
    assigned_doctor: Optional[str] = None,
    urgency: Optional[str] = None,
    limit: int = Query(default=100, le=500),
):
    """List all workflow requests with optional filters."""
    _check()
    q = {}
    if status:
        q["status"] = status.upper()
    if department:
        q["department"] = department
    if patient_email:
        q["patient.email"] = patient_email
    if assigned_doctor:
        q["assigned_doctor.name"] = assigned_doctor
    if urgency:
        q["urgency"] = urgency

    results = list(workflow_requests_col.find(q).sort("created_at", -1).limit(limit))
    return {"requests": [_sid(r) for r in results], "total": len(results)}


@router.get("/requests/{request_id}")
def get_request(request_id: str):
    """Get a single request with its full details and workflow logs."""
    _check()
    try:
        doc = workflow_requests_col.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")

    # Attach workflow logs
    logs = []
    if workflow_logs_col is not None:
        logs = [_sid(l) for l in workflow_logs_col.find({"request_id": request_id}).sort("timestamp", 1)]

    result = _sid(doc)
    result["workflow_logs"] = logs
    return result


# ══════════════════════════════════════════════
# 3. UPDATE REQUEST STATUS
# ══════════════════════════════════════════════

@router.put("/requests/{request_id}")
def update_request_status(request_id: str, body: UpdateStatusRequest):
    """
    Update request status following the lifecycle:
    NEW → ASSIGNED → IN_PROGRESS → WAITING_FOR_PATIENT → RESOLVED → CLOSED
    """
    _check()
    try:
        doc = workflow_requests_col.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")

    prev_status = doc["status"]
    new_status = body.status
    now = datetime.utcnow().isoformat()

    update_fields = {"status": new_status, "updated_at": now}
    if new_status == "RESOLVED":
        update_fields["resolved_at"] = now

    workflow_requests_col.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": update_fields}
    )

    _log(request_id, "STATUS_CHANGE", prev_status, new_status,
         performed_by=body.updated_by, notes=body.notes)

    return {"message": f"Status updated: {prev_status} → {new_status}", "status": new_status}


# ══════════════════════════════════════════════
# 4. ASSIGN DOCTOR
# ══════════════════════════════════════════════

@router.post("/assign_doctor")
def assign_doctor(body: AssignDoctorRequest):
    """Assign a doctor to a request and move status to ASSIGNED."""
    _check()
    try:
        doc = workflow_requests_col.find_one({"_id": ObjectId(body.request_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")

    prev_status = doc["status"]
    now = datetime.utcnow().isoformat()

    workflow_requests_col.update_one(
        {"_id": ObjectId(body.request_id)},
        {"$set": {
            "assigned_doctor": {
                "name": body.doctor_name,
                "email": body.doctor_email,
            },
            "status": "ASSIGNED",
            "updated_at": now,
        }}
    )

    _log(body.request_id, "DOCTOR_ASSIGNED", prev_status, "ASSIGNED",
         performed_by=body.doctor_name,
         notes=body.notes or f"Doctor {body.doctor_name} assigned")

    return {"message": f"Doctor {body.doctor_name} assigned", "status": "ASSIGNED"}


# ══════════════════════════════════════════════
# 5. DOCTOR DASHBOARD ENDPOINTS
# ══════════════════════════════════════════════

@router.get("/doctor/requests")
def doctor_requests(
    doctor_email: Optional[str] = None,
    doctor_name: Optional[str] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
):
    """Doctor views their assigned requests or unassigned department requests."""
    _check()
    q = {}
    if doctor_email:
        q["assigned_doctor.email"] = doctor_email
    if doctor_name:
        q["assigned_doctor.name"] = doctor_name
    if department:
        q["department"] = department
    if status:
        q["status"] = status.upper()

    if not doctor_email and not doctor_name:
        q.setdefault("status", {"$in": ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_PATIENT"]})

    results = list(workflow_requests_col.find(q).sort("updated_at", -1))
    return {"requests": [_sid(r) for r in results], "total": len(results)}


@router.post("/doctor/respond/{request_id}")
def doctor_respond(request_id: str, body: DoctorResponseRequest):
    """Doctor submits a response to a patient request, marking it RESOLVED."""
    _check()
    try:
        doc = workflow_requests_col.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Request not found")

    prev_status = doc["status"]
    now = datetime.utcnow().isoformat()

    workflow_requests_col.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "doctor_response": {
                "text": body.response_text,
                "responded_by": body.doctor_email,
                "responded_at": now,
            },
            "status": "RESOLVED",
            "resolved_at": now,
            "updated_at": now,
        }}
    )

    _log(request_id, "DOCTOR_RESPONDED", prev_status, "RESOLVED",
         performed_by=body.doctor_email,
         notes=f"Response submitted")

    return {"message": "Response submitted, request resolved", "status": "RESOLVED"}


# ══════════════════════════════════════════════
# 6. WORKFLOW LOGS
# ══════════════════════════════════════════════

@router.get("/logs/{request_id}")
def get_workflow_logs(request_id: str):
    """Get full workflow audit trail for a request."""
    if workflow_logs_col is None:
        raise HTTPException(status_code=503, detail="Database not available")
    logs = list(workflow_logs_col.find({"request_id": request_id}).sort("timestamp", 1))
    return {"logs": [_sid(l) for l in logs], "total": len(logs)}


@router.get("/logs")
def list_all_logs(limit: int = Query(default=200, le=1000)):
    """List recent workflow logs across all requests."""
    if workflow_logs_col is None:
        raise HTTPException(status_code=503, detail="Database not available")
    logs = list(workflow_logs_col.find().sort("timestamp", -1).limit(limit))
    return {"logs": [_sid(l) for l in logs], "total": len(logs)}


# ══════════════════════════════════════════════
# 7. DEPARTMENTS
# ══════════════════════════════════════════════

@router.get("/departments")
def list_departments():
    """List all departments with their metadata."""
    if departments_col is None:
        return {"departments": [{"name": d, "doctors": []} for d in VALID_DEPARTMENTS]}
    results = list(departments_col.find().sort("name", 1))
    return {"departments": [_sid(r) for r in results]}


# ══════════════════════════════════════════════
# 8. STATISTICS / DASHBOARD
# ══════════════════════════════════════════════

@router.get("/stats")
def workflow_stats():
    """Aggregate workflow statistics for the dashboard."""
    _check()

    total = workflow_requests_col.count_documents({})
    by_status = {}
    for s in STATUS_FLOW:
        by_status[s] = workflow_requests_col.count_documents({"status": s})

    # Per-department breakdown
    dept_pipeline = [
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    by_department = {r["_id"]: r["count"] for r in workflow_requests_col.aggregate(dept_pipeline)}

    # Per-urgency breakdown
    urgency_pipeline = [
        {"$group": {"_id": "$urgency", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    by_urgency = {r["_id"]: r["count"] for r in workflow_requests_col.aggregate(urgency_pipeline)}

    # Average AI confidence
    recent = list(workflow_requests_col.find(
        {"ai_classification": {"$exists": True}},
        {"ai_classification.confidence": 1}
    ).sort("created_at", -1).limit(50))
    confidences = [r["ai_classification"]["confidence"] for r in recent if r.get("ai_classification")]
    avg_confidence = round(sum(confidences) / len(confidences), 2) if confidences else 0

    return {
        "total": total,
        "by_status": by_status,
        "by_department": by_department,
        "by_urgency": by_urgency,
        "avg_ai_confidence": avg_confidence,
        "active": by_status.get("NEW", 0) + by_status.get("ASSIGNED", 0) + by_status.get("IN_PROGRESS", 0),
        "resolved": by_status.get("RESOLVED", 0) + by_status.get("CLOSED", 0),
    }


# ══════════════════════════════════════════════
# LEGACY TEMPLATE ENDPOINT (backward compat)
# ══════════════════════════════════════════════

@router.get("/templates")
def list_templates(category: Optional[str] = None):
    """List available workflow templates."""
    if workflow_templates_col is None:
        return {"templates": [], "total": 0}
    q = {}
    if category:
        q["category"] = category
    results = list(workflow_templates_col.find(q).sort("name", 1))
    return {"templates": [_sid(r) for r in results], "total": len(results)}
