"""
Clinical Decision Support System (CDSS) — FastAPI Router
=========================================================
REST API endpoints for managing patient clinical data and generating
rule-based alerts, risk scores, and AI-powered recommendations.

Endpoints:
  POST /api/cdss/patient           — add or update patient information
  POST /api/cdss/vitals            — submit patient vital signs
  POST /api/cdss/labs              — submit laboratory results
  POST /api/cdss/medications       — submit prescribed medications
  POST /api/cdss/allergies         — submit patient allergies
  GET  /api/cdss/alerts/{pid}      — get all clinical alerts & recommendations
  GET  /api/cdss/risk/{pid}        — get patient risk score only
  GET  /api/cdss/patients          — list all CDSS patients
  GET  /api/cdss/patient/{pid}     — get full patient record
  GET  /api/cdss/history/{pid}     — get patient alert history
  GET  /api/cdss/stats             — dashboard summary statistics

This system is advisory only — it supports clinical decisions
but does NOT make diagnoses or automated medical decisions.
"""
import os
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/api/cdss", tags=["Clinical Decision Support"])

# MongoDB collections
from mongo import (
    cdss_patients_col, cdss_vitals_col, cdss_labs_col,
    cdss_medications_col, cdss_allergies_col, cdss_alerts_col,
)

# Clinical engine & AI analyzer
from cdss_engine import evaluate_patient_full, calculate_risk_score
from cdss_ai_analyzer import analyze_patient_with_ai


# ── Helper: convert ObjectId to string ──
def _sid(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# ══════════════════════════════════════════════
# PYDANTIC REQUEST MODELS
# ══════════════════════════════════════════════

class PatientRequest(BaseModel):
    """Add or update patient information."""
    patient_id: str = Field(..., description="Unique patient identifier")
    name: str = Field(..., description="Patient full name")
    age: int = Field(..., ge=0, le=150, description="Patient age in years")
    gender: str = Field(..., description="Patient gender")
    history: list[str] = Field(default_factory=list, description="Medical history list (e.g. ['diabetes', 'hypertension'])")
    assigned_doctor: Optional[str] = Field(None, description="Assigned doctor name or email")
    admission_time: Optional[str] = Field(None, description="ISO timestamp of admission")
    notes: Optional[str] = Field(None, description="Additional clinical notes")


class VitalsRequest(BaseModel):
    """Submit patient vital signs."""
    patient_id: str
    heart_rate: Optional[float] = Field(None, ge=0, le=300, description="Heart rate in bpm")
    systolic_bp: Optional[float] = Field(None, ge=0, le=350, description="Systolic blood pressure mmHg")
    diastolic_bp: Optional[float] = Field(None, ge=0, le=250, description="Diastolic blood pressure mmHg")
    oxygen_level: Optional[float] = Field(None, ge=0, le=100, description="SpO2 percentage")
    temperature: Optional[float] = Field(None, ge=25, le=45, description="Body temperature in Celsius")
    recorded_by: Optional[str] = Field(None, description="Who recorded the vitals")


class LabsRequest(BaseModel):
    """Submit laboratory results."""
    patient_id: str
    glucose: Optional[float] = Field(None, ge=0, description="Blood glucose mg/dL")
    hemoglobin: Optional[float] = Field(None, ge=0, description="Hemoglobin g/dL")
    cholesterol: Optional[float] = Field(None, ge=0, description="Total cholesterol mg/dL")
    wbc: Optional[float] = Field(None, ge=0, description="White blood cell count cells/uL")
    creatinine: Optional[float] = Field(None, ge=0, description="Creatinine mg/dL")
    potassium: Optional[float] = Field(None, ge=0, description="Potassium mEq/L")
    sodium: Optional[float] = Field(None, ge=0, description="Sodium mEq/L")
    alt: Optional[float] = Field(None, ge=0, description="ALT U/L (liver)")
    ast: Optional[float] = Field(None, ge=0, description="AST U/L (liver)")
    test_name: Optional[str] = Field(None, description="Name of lab test panel")
    ordered_by: Optional[str] = Field(None, description="Ordering physician")


class MedicationRequest(BaseModel):
    """Submit a prescribed medication."""
    patient_id: str
    drug_name: str = Field(..., description="Drug name")
    dosage: Optional[str] = Field(None, description="Dosage (e.g. '500mg twice daily')")
    prescribed_by: Optional[str] = Field(None, description="Prescribing physician")


class AllergyRequest(BaseModel):
    """Submit a patient allergy."""
    patient_id: str
    allergy_type: str = Field(..., description="Allergy type (e.g. 'penicillin', 'sulfa', 'latex')")
    severity: Optional[str] = Field("moderate", description="Allergy severity: mild, moderate, severe")
    notes: Optional[str] = None


# ══════════════════════════════════════════════
# HELPER: get aggregated patient data
# ══════════════════════════════════════════════
def _get_patient_data(patient_id: str):
    """Fetch all clinical data for a patient from MongoDB."""
    if cdss_patients_col is None:
        raise HTTPException(503, "Database unavailable")

    patient = cdss_patients_col.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(404, f"Patient '{patient_id}' not found in CDSS")

    # Latest vitals
    vitals_doc = cdss_vitals_col.find_one(
        {"patient_id": patient_id}, sort=[("recorded_at", -1)]
    ) if cdss_vitals_col is not None else None

    # Latest labs
    labs_doc = cdss_labs_col.find_one(
        {"patient_id": patient_id}, sort=[("recorded_at", -1)]
    ) if cdss_labs_col is not None else None

    # All medications
    meds = list(cdss_medications_col.find(
        {"patient_id": patient_id, "active": True}
    )) if cdss_medications_col is not None else []

    # All allergies
    allergies = list(cdss_allergies_col.find(
        {"patient_id": patient_id}
    )) if cdss_allergies_col is not None else []

    # Recent lab tests (for duplicate detection)
    recent_labs = list(cdss_labs_col.find(
        {"patient_id": patient_id}
    ).sort("recorded_at", -1).limit(10)) if cdss_labs_col is not None else []

    # Enrich patient dict with workflow context fields
    patient_ctx = dict(patient)
    patient_ctx["recent_lab_tests"] = [
        {"test_name": l.get("test_name", "general"), "timestamp": l.get("recorded_at", "")}
        for l in recent_labs
    ]

    vitals = dict(vitals_doc) if vitals_doc else {}
    labs = dict(labs_doc) if labs_doc else {}
    med_list = [{"drug_name": m.get("drug_name", ""), "dosage": m.get("dosage", "")} for m in meds]
    allergy_list = [{"allergy_type": a.get("allergy_type", "")} for a in allergies]

    return patient_ctx, vitals, labs, med_list, allergy_list


# ══════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════

# ── 1. Add/Update Patient ──
@router.post("/patient")
def upsert_patient(req: PatientRequest):
    """Add or update patient information in the CDSS."""
    if cdss_patients_col is None:
        raise HTTPException(503, "Database unavailable")

    now = datetime.utcnow().isoformat()
    doc = req.model_dump()
    doc["updated_at"] = now

    existing = cdss_patients_col.find_one({"patient_id": req.patient_id})
    if existing:
        cdss_patients_col.update_one({"patient_id": req.patient_id}, {"$set": doc})
        return {"message": "Patient updated", "patient_id": req.patient_id}
    else:
        doc["created_at"] = now
        cdss_patients_col.insert_one(doc)
        return {"message": "Patient added", "patient_id": req.patient_id}


# ── 2. Submit Vitals ──
@router.post("/vitals")
def submit_vitals(req: VitalsRequest):
    """Submit patient vital signs. Stores record and returns immediate vital alerts."""
    if cdss_vitals_col is None:
        raise HTTPException(503, "Database unavailable")

    # Verify patient exists
    if cdss_patients_col is not None:
        if not cdss_patients_col.find_one({"patient_id": req.patient_id}):
            raise HTTPException(404, f"Patient '{req.patient_id}' not found")

    now = datetime.utcnow().isoformat()
    doc = req.model_dump()
    doc["recorded_at"] = now
    cdss_vitals_col.insert_one(doc)

    # Return immediate alert preview
    from cdss_engine import evaluate_vitals
    vitals_dict = {k: v for k, v in doc.items() if k in (
        "heart_rate", "systolic_bp", "diastolic_bp", "oxygen_level", "temperature"
    ) and v is not None}
    instant_alerts = evaluate_vitals(vitals_dict)

    return {
        "message": "Vitals recorded",
        "patient_id": req.patient_id,
        "recorded_at": now,
        "instant_alerts": instant_alerts,
    }


# ── 3. Submit Labs ──
@router.post("/labs")
def submit_labs(req: LabsRequest):
    """Submit laboratory results. Stores record and returns immediate lab alerts."""
    if cdss_labs_col is None:
        raise HTTPException(503, "Database unavailable")

    if cdss_patients_col is not None:
        if not cdss_patients_col.find_one({"patient_id": req.patient_id}):
            raise HTTPException(404, f"Patient '{req.patient_id}' not found")

    now = datetime.utcnow().isoformat()
    doc = req.model_dump()
    doc["recorded_at"] = now
    cdss_labs_col.insert_one(doc)

    from cdss_engine import evaluate_labs
    labs_dict = {k: v for k, v in doc.items() if k in (
        "glucose", "hemoglobin", "cholesterol", "wbc", "creatinine", "potassium", "sodium", "alt", "ast"
    ) and v is not None}
    instant_alerts = evaluate_labs(labs_dict)

    return {
        "message": "Lab results recorded",
        "patient_id": req.patient_id,
        "recorded_at": now,
        "instant_alerts": instant_alerts,
    }


# ── 4. Submit Medication ──
@router.post("/medications")
def submit_medication(req: MedicationRequest):
    """Add a prescribed medication for a patient."""
    if cdss_medications_col is None:
        raise HTTPException(503, "Database unavailable")

    if cdss_patients_col is not None:
        if not cdss_patients_col.find_one({"patient_id": req.patient_id}):
            raise HTTPException(404, f"Patient '{req.patient_id}' not found")

    now = datetime.utcnow().isoformat()
    doc = req.model_dump()
    doc["active"] = True
    doc["prescribed_at"] = now
    cdss_medications_col.insert_one(doc)

    return {"message": "Medication added", "patient_id": req.patient_id, "drug_name": req.drug_name}


# ── 5. Submit Allergy ──
@router.post("/allergies")
def submit_allergy(req: AllergyRequest):
    """Add a patient allergy record."""
    if cdss_allergies_col is None:
        raise HTTPException(503, "Database unavailable")

    if cdss_patients_col is not None:
        if not cdss_patients_col.find_one({"patient_id": req.patient_id}):
            raise HTTPException(404, f"Patient '{req.patient_id}' not found")

    # Prevent duplicate allergy entries
    existing = cdss_allergies_col.find_one({
        "patient_id": req.patient_id,
        "allergy_type": req.allergy_type.lower().strip(),
    })
    if existing:
        return {"message": "Allergy already recorded", "patient_id": req.patient_id}

    now = datetime.utcnow().isoformat()
    doc = req.model_dump()
    doc["allergy_type"] = doc["allergy_type"].lower().strip()
    doc["recorded_at"] = now
    cdss_allergies_col.insert_one(doc)

    return {"message": "Allergy recorded", "patient_id": req.patient_id, "allergy_type": req.allergy_type}


# ── 6. Get Clinical Alerts & Recommendations ──
@router.get("/alerts/{patient_id}")
def get_clinical_alerts(patient_id: str, include_ai: bool = Query(True, description="Include AI recommendations")):
    """
    Get comprehensive clinical alerts and recommendations for a patient.
    Combines rule-based alerts, risk scoring, and optional AI analysis.
    """
    patient, vitals, labs, medications, allergies = _get_patient_data(patient_id)

    # Run all rule-based evaluations
    result = evaluate_patient_full(patient, vitals, labs, medications, allergies)

    # AI-powered recommendations (optional)
    ai_recommendations = None
    if include_ai:
        try:
            ai_rec = analyze_patient_with_ai(
                patient, vitals, labs, medications, allergies, result["alerts"]
            )
            ai_recommendations = ai_rec.model_dump()
        except Exception as e:
            ai_recommendations = {"error": str(e)}

    # Store alert snapshot for history
    if cdss_alerts_col is not None:
        cdss_alerts_col.insert_one({
            "patient_id": patient_id,
            "alerts": result["alerts"],
            "risk_score": result["risk_score"],
            "ai_recommendations": ai_recommendations,
            "generated_at": datetime.utcnow().isoformat(),
        })

    return {
        "patient_id": patient_id,
        "patient_name": patient.get("name", "Unknown"),
        "alerts": result["alerts"],
        "risk_score": result["risk_score"],
        "alert_summary": result["alert_summary"],
        "ai_recommendations": ai_recommendations,
        "generated_at": datetime.utcnow().isoformat(),
    }


# ── 7. Get Risk Score Only ──
@router.get("/risk/{patient_id}")
def get_risk_score(patient_id: str):
    """Get patient risk score without full alert evaluation."""
    patient, vitals, labs, _, _ = _get_patient_data(patient_id)
    risk = calculate_risk_score(patient, vitals, labs)
    return {
        "patient_id": patient_id,
        "patient_name": patient.get("name", "Unknown"),
        "risk_score": risk,
    }


# ── 8. List All CDSS Patients ──
@router.get("/patients")
def list_patients(limit: int = Query(50, ge=1, le=200)):
    """List all patients registered in the CDSS."""
    if cdss_patients_col is None:
        raise HTTPException(503, "Database unavailable")

    patients = list(cdss_patients_col.find().sort("updated_at", -1).limit(limit))
    for p in patients:
        _sid(p)
    return {"patients": patients, "total": len(patients)}


# ── 9. Get Full Patient Record ──
@router.get("/patient/{patient_id}")
def get_patient_record(patient_id: str):
    """Get complete patient clinical record (patient info, latest vitals, labs, meds, allergies)."""
    patient, vitals, labs, medications, allergies = _get_patient_data(patient_id)
    _sid(patient)

    # Get all vitals history (last 20)
    vitals_history = []
    if cdss_vitals_col is not None:
        vitals_history = [_sid(v) for v in cdss_vitals_col.find(
            {"patient_id": patient_id}
        ).sort("recorded_at", -1).limit(20)]

    # Get all labs history (last 20)
    labs_history = []
    if cdss_labs_col is not None:
        labs_history = [_sid(l) for l in cdss_labs_col.find(
            {"patient_id": patient_id}
        ).sort("recorded_at", -1).limit(20)]

    return {
        "patient": patient,
        "latest_vitals": {k: v for k, v in vitals.items() if k not in ("_id", "patient_id", "recorded_at", "recorded_by")},
        "latest_labs": {k: v for k, v in labs.items() if k not in ("_id", "patient_id", "recorded_at", "ordered_by", "test_name")},
        "medications": medications,
        "allergies": allergies,
        "vitals_history": vitals_history,
        "labs_history": labs_history,
    }


# ── 10. Get Alert History ──
@router.get("/history/{patient_id}")
def get_alert_history(patient_id: str, limit: int = Query(20, ge=1, le=100)):
    """Get historical alert snapshots for a patient."""
    if cdss_alerts_col is None:
        raise HTTPException(503, "Database unavailable")

    history = list(cdss_alerts_col.find(
        {"patient_id": patient_id}
    ).sort("generated_at", -1).limit(limit))
    for h in history:
        _sid(h)

    return {"patient_id": patient_id, "history": history, "total": len(history)}


# ── 11. Dashboard Stats ──
@router.get("/stats")
def get_cdss_stats():
    """Get CDSS dashboard summary statistics."""
    if cdss_patients_col is None:
        raise HTTPException(503, "Database unavailable")

    total_patients = cdss_patients_col.count_documents({})

    # Get risk distribution by evaluating all patients
    risk_dist = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
    severity_dist = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    recent_alerts_count = 0

    patients = list(cdss_patients_col.find().limit(100))
    for pt in patients:
        pid = pt.get("patient_id")
        try:
            _, vitals, labs, meds, allergies = _get_patient_data(pid)
            risk = calculate_risk_score(pt, vitals, labs)
            risk_dist[risk["level"]] = risk_dist.get(risk["level"], 0) + 1

            result = evaluate_patient_full(pt, vitals, labs, meds, allergies)
            for a in result["alerts"]:
                sev = a.get("severity", "low")
                severity_dist[sev] = severity_dist.get(sev, 0) + 1
            recent_alerts_count += len(result["alerts"])
        except Exception:
            pass

    # Active medications count
    active_meds = 0
    if cdss_medications_col is not None:
        active_meds = cdss_medications_col.count_documents({"active": True})

    # Total allergies tracked
    total_allergies = 0
    if cdss_allergies_col is not None:
        total_allergies = cdss_allergies_col.count_documents({})

    return {
        "total_patients": total_patients,
        "risk_distribution": risk_dist,
        "alert_severity_distribution": severity_dist,
        "total_active_alerts": recent_alerts_count,
        "active_medications": active_meds,
        "total_allergies": total_allergies,
    }
