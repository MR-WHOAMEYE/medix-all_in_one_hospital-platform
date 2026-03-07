"""
Doctor API — prescriptions, diagnoses, appointment management.
Uses MongoDB only — no SQLite mock data.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
router = APIRouter(prefix="/api/doctor", tags=["Doctor API"])

from mongo import *

# MongoDB
class PrescriptionCreate(BaseModel):
    patient_email: str
    patient_name: str
    medication: str
    dosage: str
    frequency: str
    duration: str
    notes: Optional[str] = ""

class DiagnosisCreate(BaseModel):
    patient_email: str
    patient_name: str
    condition: str
    severity: str  # Mild, Moderate, Severe
    notes: Optional[str] = ""

class CaseStatusUpdate(BaseModel):
    status: str  # Open, Under Treatment, Resolved

class ReportCreate(BaseModel):
    patient_email: Optional[str] = ""
    patient_name: Optional[str] = ""
    patient_id: Optional[str] = ""
    report_type: str  # consultation, lab, imaging, prescription, discharge, referral
    clinical_summary: Optional[str] = ""
    doctor_name: str
    doctor_email: str
    department: Optional[str] = ""
    status: str = "draft"  # draft or finalized

class AppointmentAction(BaseModel):
    action: str  # approve, reschedule, cancel
    new_time: Optional[str] = None
    reason: Optional[str] = ""

# ---- Doctor Dashboard data ----
@router.get("/dashboard")
def doctor_dashboard(department: Optional[str] = None, staff_id: Optional[int] = None):
    # Total admissions as cases
    adm_query = {}
    if department:
        adm_query["department"] = department
    
    total_cases = admissions_col.count_documents(adm_query) if admissions_col is not None else 0
    
    open_query = {**adm_query, "status": {"$in": ["admitted", "pending"]}}
    open_cases = admissions_col.count_documents(open_query) if admissions_col is not None else 0
    
    critical_query = {**adm_query, "ward_type": "ICU"}
    critical_alerts = admissions_col.count_documents(critical_query) if admissions_col is not None else 0

    # Today's appointments from bookings
    today_str = datetime.now().strftime("%Y-%m-%d")
    appt_query = {"preferred_date": today_str}
    if department:
        appt_query["department"] = department
    today_appointments = bookings_col.count_documents(appt_query) if bookings_col is not None else 0

    # Pending bookings from MongoDB
    pending_bookings = 0
    if bookings_col is not None:
        query = {"status": "pending"}
        if department:
            query["department"] = department
        pending_bookings = bookings_col.count_documents(query)

    # Recent prescriptions
    recent_rx = 0
    if prescriptions_col is not None:
        query = {}
        if department:
            query["doctor_department"] = department
        recent_rx = prescriptions_col.count_documents(query)

    # Recent active cases from admissions
    cases_list = []
    if admissions_col is not None:
        active_docs = admissions_col.find(open_query).sort("created_at", -1).limit(10)
        cases_list = [
            {
                "id": str(a["_id"]),
                "department": a.get("department", ""),
                "severity": a.get("ward_type", "General"),
                "status": a.get("status", ""),
                "patient_name": a.get("patient_name", ""),
                "created_time": a.get("created_at", ""),
            }
            for a in active_docs
        ]

    # Emergency alerts (ICU patients)
    emergency_alerts = []
    if admissions_col is not None:
        icu_docs = admissions_col.find(critical_query).sort("created_at", -1).limit(5)
        emergency_alerts = [
            {
                "id": str(a["_id"]),
                "department": a.get("department", ""),
                "severity": "Critical",
                "status": a.get("status", ""),
                "patient_name": a.get("patient_name", ""),
            }
            for a in icu_docs
        ]

    return {
        "total_cases": total_cases,
        "open_cases": open_cases,
        "critical_alerts": critical_alerts,
        "today_appointments": today_appointments,
        "pending_bookings": pending_bookings,
        "total_prescriptions": recent_rx,
        "cases": cases_list,
        "emergency_alerts": emergency_alerts,
    }

# ---- My Patients (assigned to this doctor) with vitals ----
@router.get("/my-patients")
def get_my_patients(doctor_email: str):
    """Get patients assigned to this doctor with their latest vitals."""
    if users_col is None:
        return {"patients": []}

    # Find patients assigned to this doctor
    patients = users_col.find(
        {"role": "patient", "assigned_doctor": doctor_email},
        {"password": 0}
    ).sort("created_at", -1)

    result = []
    for p in patients:
        patient_data = {
            "id": str(p["_id"]),
            "name": p.get("name", ""),
            "email": p.get("email", ""),
            "department": p.get("department", ""),
            "issue": p.get("issue", ""),
            "created_at": p.get("created_at", ""),
            "assigned_by": p.get("created_by", ""),
            "latest_vitals": None,
        }

        # Get latest vitals for this patient
        if vitals_col is not None:
            latest = vitals_col.find_one(
                {"patient_email": p["email"]},
                sort=[("recorded_at", -1)]
            )
            if latest:
                patient_data["latest_vitals"] = {
                    "bp_systolic": latest.get("bp_systolic"),
                    "bp_diastolic": latest.get("bp_diastolic"),
                    "sugar_level": latest.get("sugar_level"),
                    "temperature": latest.get("temperature"),
                    "heart_rate": latest.get("heart_rate"),
                    "notes": latest.get("notes", ""),
                    "recorded_at": latest.get("recorded_at", ""),
                }

        result.append(patient_data)

    return {"patients": result}

# ---- Prescriptions ----
@router.post("/prescriptions")
def add_prescription(body: PrescriptionCreate):
    if prescriptions_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    doc = {
        "patient_email": body.patient_email,
        "patient_name": body.patient_name,
        "medication": body.medication,
        "dosage": body.dosage,
        "frequency": body.frequency,
        "duration": body.duration,
        "notes": body.notes,
        "doctor_name": "",  # filled from frontend
        "doctor_department": "",
        "created_at": datetime.utcnow().isoformat(),
        "status": "active",
    }
    result = prescriptions_col.insert_one(doc)
    return {"message": "Prescription added", "id": str(result.inserted_id)}

@router.get("/prescriptions")
def get_prescriptions(patient_email: Optional[str] = None, department: Optional[str] = None):
    if prescriptions_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    query = {}
    if patient_email:
        query["patient_email"] = patient_email
    if department:
        query["doctor_department"] = department

    results = prescriptions_col.find(query).sort("created_at", -1)
    return {
        "prescriptions": [
            {
                "id": str(r["_id"]),
                "patient_name": r.get("patient_name", ""),
                "patient_email": r.get("patient_email", ""),
                "medication": r.get("medication", ""),
                "dosage": r.get("dosage", ""),
                "frequency": r.get("frequency", ""),
                "duration": r.get("duration", ""),
                "notes": r.get("notes", ""),
                "doctor_name": r.get("doctor_name", ""),
                "created_at": r.get("created_at", ""),
                "status": r.get("status", "active"),
            }
            for r in results
        ]
    }

# ---- Diagnoses ----
@router.post("/diagnoses")
def add_diagnosis(body: DiagnosisCreate):
    if diagnoses_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    doc = {
        "patient_email": body.patient_email,
        "patient_name": body.patient_name,
        "condition": body.condition,
        "severity": body.severity,
        "notes": body.notes,
        "doctor_name": "",
        "doctor_department": "",
        "created_at": datetime.utcnow().isoformat(),
    }
    result = diagnoses_col.insert_one(doc)
    return {"message": "Diagnosis added", "id": str(result.inserted_id)}

@router.get("/diagnoses")
def get_diagnoses(patient_email: Optional[str] = None, department: Optional[str] = None):
    if diagnoses_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    query = {}
    if patient_email:
        query["patient_email"] = patient_email
    if department:
        query["doctor_department"] = department

    results = diagnoses_col.find(query).sort("created_at", -1)
    return {
        "diagnoses": [
            {
                "id": str(r["_id"]),
                "patient_name": r.get("patient_name", ""),
                "patient_email": r.get("patient_email", ""),
                "condition": r.get("condition", ""),
                "severity": r.get("severity", ""),
                "notes": r.get("notes", ""),
                "doctor_name": r.get("doctor_name", ""),
                "created_at": r.get("created_at", ""),
            }
            for r in results
        ]
    }

# ---- Case Status Update (via admissions) ----
@router.put("/cases/{case_id}/status")
def update_case_status(case_id: str, body: CaseStatusUpdate):
    if admissions_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    update_data = {"status": body.status}
    if body.status == "discharged":
        update_data["discharged_at"] = datetime.utcnow().isoformat()

    # Try matching by ObjectId first, then by string/int case_id field
    result = None
    if len(case_id) == 24:
        try:
            result = admissions_col.update_one({"_id": ObjectId(case_id)}, {"$set": update_data})
        except Exception:
            pass

    if result is None or result.matched_count == 0:
        # Try by case_id field (string or int)
        result = admissions_col.update_one({"case_id": case_id}, {"$set": update_data})
        if result.matched_count == 0:
            try:
                result = admissions_col.update_one({"case_id": int(case_id)}, {"$set": update_data})
            except (ValueError, TypeError):
                pass

    if result is None or result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"message": f"Case {case_id} updated to {body.status}"}

# ---- Appointment Bookings ----
@router.get("/bookings")
def get_bookings(department: Optional[str] = None, status: Optional[str] = None):
    if bookings_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    query = {}
    if department:
        query["department"] = department
    if status:
        query["status"] = status

    results = bookings_col.find(query).sort("created_at", -1)
    return {
        "bookings": [
            {
                "id": str(r["_id"]),
                "patient_name": r.get("patient_name", ""),
                "patient_email": r.get("patient_email", ""),
                "department": r.get("department", ""),
                "doctor_name": r.get("doctor_name", ""),
                "preferred_date": r.get("preferred_date", ""),
                "preferred_time": r.get("preferred_time", ""),
                "reason": r.get("reason", ""),
                "status": r.get("status", "pending"),
                "created_at": r.get("created_at", ""),
                "action_note": r.get("action_note", ""),
            }
            for r in results
        ]
    }

# ---- Medical Reports ----
@router.post("/reports")
def create_report(body: ReportCreate):
    if medical_reports_col is None:
        raise HTTPException(status_code=503, detail="Database not available")
    now = datetime.utcnow().isoformat()
    doc = {
        "patient_email": body.patient_email,
        "patient_name": body.patient_name,
        "patient_id": body.patient_id,
        "report_type": body.report_type,
        "clinical_summary": body.clinical_summary,
        "doctor_name": body.doctor_name,
        "doctor_email": body.doctor_email,
        "department": body.department,
        "status": body.status,
        "version": "v1.0",
        "created_at": now,
        "updated_at": now,
    }
    result = medical_reports_col.insert_one(doc)
    return {"message": "Report saved", "report_id": str(result.inserted_id), "status": body.status}

@router.put("/reports/{report_id}/finalize")
def finalize_report(report_id: str):
    if medical_reports_col is None:
        raise HTTPException(status_code=503, detail="Database not available")
    result = medical_reports_col.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": {"status": "finalized", "updated_at": datetime.utcnow().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"message": "Report finalized"}

@router.get("/reports")
def get_reports(doctor_email: Optional[str] = None, patient_email: Optional[str] = None):
    if medical_reports_col is None:
        raise HTTPException(status_code=503, detail="Database not available")
    query = {}
    if doctor_email:
        query["doctor_email"] = doctor_email
    if patient_email:
        query["patient_email"] = patient_email
    results = list(medical_reports_col.find(query).sort("created_at", -1).limit(50))
    return {
        "reports": [
            {**r, "_id": str(r["_id"])} for r in results
        ]
    }

@router.put("/bookings/{booking_id}")
def update_booking(booking_id: str, body: AppointmentAction):
    if bookings_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    update = {"status": body.action, "action_note": body.reason, "updated_at": datetime.utcnow().isoformat(), "responded_at": datetime.utcnow().isoformat()}
    if body.action == "reschedule" and body.new_time:
        update["preferred_date"] = body.new_time

    result = bookings_col.update_one({"_id": ObjectId(booking_id)}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")

    return {"message": f"Booking {body.action}d successfully"}
