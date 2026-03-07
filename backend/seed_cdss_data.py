"""
Seed script for Clinical Decision Support System (CDSS).
Populates test patients, vitals, labs, medications, and allergies.
Usage: cd backend && python seed_cdss_data.py
"""
from mongo import (
    cdss_patients_col, cdss_vitals_col, cdss_labs_col,
    cdss_medications_col, cdss_allergies_col, cdss_alerts_col,
)
from datetime import datetime, timedelta

if cdss_patients_col is None:
    print("[ERROR] MongoDB not available. Cannot seed CDSS data.")
    exit(1)

now = datetime.utcnow()
ts = now.isoformat()

# ══════════════════════════════════════════════
# 1. PATIENTS
# ══════════════════════════════════════════════
PATIENTS = [
    {
        "patient_id": "CDSS-001",
        "name": "Robert Anderson",
        "age": 65,
        "gender": "Male",
        "history": ["hypertension", "diabetes", "smoking"],
        "assigned_doctor": None,
        "admission_time": (now - timedelta(hours=5)).isoformat(),
        "notes": "Example scenario patient - high risk cardiovascular case",
        "created_at": ts, "updated_at": ts,
    },
    {
        "patient_id": "CDSS-002",
        "name": "Maria Garcia",
        "age": 42,
        "gender": "Female",
        "history": ["asthma"],
        "assigned_doctor": "Dr. Priya Sharma",
        "admission_time": (now - timedelta(hours=2)).isoformat(),
        "notes": "Moderate risk - respiratory monitoring",
        "created_at": ts, "updated_at": ts,
    },
    {
        "patient_id": "CDSS-003",
        "name": "James Wilson",
        "age": 78,
        "gender": "Male",
        "history": ["heart disease", "hypertension", "diabetes", "copd"],
        "assigned_doctor": "Dr. Arun Mehta",
        "admission_time": (now - timedelta(hours=12)).isoformat(),
        "notes": "Critical - multi-morbidity patient on anticoagulation",
        "created_at": ts, "updated_at": ts,
    },
    {
        "patient_id": "CDSS-004",
        "name": "Emily Chen",
        "age": 28,
        "gender": "Female",
        "history": [],
        "assigned_doctor": "Dr. Kavitha Nair",
        "admission_time": (now - timedelta(hours=1)).isoformat(),
        "notes": "Low risk - routine check",
        "created_at": ts, "updated_at": ts,
    },
    {
        "patient_id": "CDSS-005",
        "name": "David Thompson",
        "age": 55,
        "gender": "Male",
        "history": ["obesity", "hypertension", "smoking"],
        "assigned_doctor": "Dr. Suresh Reddy",
        "admission_time": None,
        "notes": "Outpatient follow-up",
        "created_at": ts, "updated_at": ts,
    },
]

# ══════════════════════════════════════════════
# 2. VITALS
# ══════════════════════════════════════════════
VITALS = [
    # CDSS-001: Hypertensive, tachycardic, mildly febrile
    {"patient_id": "CDSS-001", "heart_rate": 105, "systolic_bp": 150, "diastolic_bp": 95,
     "oxygen_level": 96, "temperature": 38.2, "recorded_by": "Nurse Jane", "recorded_at": ts},
    # CDSS-002: Slightly low oxygen (asthma exacerbation)
    {"patient_id": "CDSS-002", "heart_rate": 88, "systolic_bp": 118, "diastolic_bp": 76,
     "oxygen_level": 91, "temperature": 37.1, "recorded_by": "Nurse Mark", "recorded_at": ts},
    # CDSS-003: Critical - low O2, high HR, hypertensive crisis
    {"patient_id": "CDSS-003", "heart_rate": 125, "systolic_bp": 185, "diastolic_bp": 125,
     "oxygen_level": 87, "temperature": 38.8, "recorded_by": "Nurse Sarah", "recorded_at": ts},
    # CDSS-004: Normal vitals
    {"patient_id": "CDSS-004", "heart_rate": 72, "systolic_bp": 115, "diastolic_bp": 72,
     "oxygen_level": 98, "temperature": 36.8, "recorded_by": "Nurse Jane", "recorded_at": ts},
    # CDSS-005: Elevated BP, slightly overweight metrics
    {"patient_id": "CDSS-005", "heart_rate": 92, "systolic_bp": 145, "diastolic_bp": 92,
     "oxygen_level": 95, "temperature": 37.0, "recorded_by": "Nurse Mark", "recorded_at": ts},
]

# ══════════════════════════════════════════════
# 3. LAB RESULTS
# ══════════════════════════════════════════════
LABS = [
    # CDSS-001: High glucose, high cholesterol
    {"patient_id": "CDSS-001", "glucose": 210, "hemoglobin": 13.5, "cholesterol": 260,
     "wbc": 8500, "creatinine": 1.1, "potassium": 4.2, "test_name": "comprehensive_panel",
     "ordered_by": "Dr. Smith", "recorded_at": ts},
    # CDSS-002: Normal labs
    {"patient_id": "CDSS-002", "glucose": 95, "hemoglobin": 12.8, "cholesterol": 190,
     "wbc": 7200, "creatinine": 0.9, "potassium": 4.0, "test_name": "basic_panel",
     "ordered_by": "Dr. Priya", "recorded_at": ts},
    # CDSS-003: Anemic, elevated creatinine, hyperkalemia
    {"patient_id": "CDSS-003", "glucose": 310, "hemoglobin": 8.5, "cholesterol": 285,
     "wbc": 14000, "creatinine": 2.8, "potassium": 5.8, "test_name": "comprehensive_panel",
     "ordered_by": "Dr. Arun", "recorded_at": ts},
    # CDSS-004: All normal
    {"patient_id": "CDSS-004", "glucose": 88, "hemoglobin": 13.2, "cholesterol": 175,
     "wbc": 6500, "creatinine": 0.8, "potassium": 4.1, "test_name": "routine",
     "ordered_by": "Dr. Kavitha", "recorded_at": ts},
    # CDSS-005: Pre-diabetic, borderline cholesterol
    {"patient_id": "CDSS-005", "glucose": 165, "hemoglobin": 14.0, "cholesterol": 245,
     "wbc": 9000, "creatinine": 1.4, "potassium": 4.5, "test_name": "metabolic_panel",
     "ordered_by": "Dr. Suresh", "recorded_at": ts},
]

# ══════════════════════════════════════════════
# 4. MEDICATIONS
# ══════════════════════════════════════════════
MEDICATIONS = [
    # CDSS-001: Aspirin (note: interacts with allergies/drugs)
    {"patient_id": "CDSS-001", "drug_name": "aspirin", "dosage": "81mg daily",
     "prescribed_by": "Dr. Smith", "active": True, "prescribed_at": ts},
    {"patient_id": "CDSS-001", "drug_name": "metformin", "dosage": "500mg twice daily",
     "prescribed_by": "Dr. Smith", "active": True, "prescribed_at": ts},
    # CDSS-002: Albuterol for asthma
    {"patient_id": "CDSS-002", "drug_name": "albuterol", "dosage": "2 puffs PRN",
     "prescribed_by": "Dr. Priya", "active": True, "prescribed_at": ts},
    # CDSS-003: Warfarin + Aspirin (DRUG INTERACTION!)
    {"patient_id": "CDSS-003", "drug_name": "warfarin", "dosage": "5mg daily",
     "prescribed_by": "Dr. Arun", "active": True, "prescribed_at": ts},
    {"patient_id": "CDSS-003", "drug_name": "aspirin", "dosage": "325mg daily",
     "prescribed_by": "Dr. Arun", "active": True, "prescribed_at": ts},
    {"patient_id": "CDSS-003", "drug_name": "lisinopril", "dosage": "20mg daily",
     "prescribed_by": "Dr. Arun", "active": True, "prescribed_at": ts},
    {"patient_id": "CDSS-003", "drug_name": "spironolactone", "dosage": "25mg daily",
     "prescribed_by": "Dr. Arun", "active": True, "prescribed_at": ts},
    # CDSS-004: None
    # CDSS-005: Ibuprofen + prednisone (GI interaction!)
    {"patient_id": "CDSS-005", "drug_name": "ibuprofen", "dosage": "400mg TID",
     "prescribed_by": "Dr. Suresh", "active": True, "prescribed_at": ts},
    {"patient_id": "CDSS-005", "drug_name": "prednisone", "dosage": "10mg daily",
     "prescribed_by": "Dr. Suresh", "active": True, "prescribed_at": ts},
    {"patient_id": "CDSS-005", "drug_name": "atorvastatin", "dosage": "40mg daily",
     "prescribed_by": "Dr. Suresh", "active": True, "prescribed_at": ts},
]

# ══════════════════════════════════════════════
# 5. ALLERGIES
# ══════════════════════════════════════════════
ALLERGIES = [
    {"patient_id": "CDSS-001", "allergy_type": "penicillin", "severity": "severe", "recorded_at": ts},
    {"patient_id": "CDSS-001", "allergy_type": "sulfa", "severity": "moderate", "recorded_at": ts},
    {"patient_id": "CDSS-002", "allergy_type": "latex", "severity": "moderate", "recorded_at": ts},
    {"patient_id": "CDSS-003", "allergy_type": "aspirin", "severity": "severe", "recorded_at": ts},
    {"patient_id": "CDSS-003", "allergy_type": "codeine", "severity": "moderate", "recorded_at": ts},
    {"patient_id": "CDSS-005", "allergy_type": "ace inhibitor", "severity": "moderate", "recorded_at": ts},
]


# ══════════════════════════════════════════════
# SEED
# ══════════════════════════════════════════════
def seed():
    print("[CDSS SEED] Clearing existing data...")
    cdss_patients_col.delete_many({})
    cdss_vitals_col.delete_many({})
    cdss_labs_col.delete_many({})
    cdss_medications_col.delete_many({})
    cdss_allergies_col.delete_many({})
    if cdss_alerts_col is not None:
        cdss_alerts_col.delete_many({})

    print(f"[CDSS SEED] Inserting {len(PATIENTS)} patients...")
    cdss_patients_col.insert_many(PATIENTS)

    print(f"[CDSS SEED] Inserting {len(VITALS)} vitals records...")
    cdss_vitals_col.insert_many(VITALS)

    print(f"[CDSS SEED] Inserting {len(LABS)} lab results...")
    cdss_labs_col.insert_many(LABS)

    print(f"[CDSS SEED] Inserting {len(MEDICATIONS)} medications...")
    cdss_medications_col.insert_many(MEDICATIONS)

    print(f"[CDSS SEED] Inserting {len(ALLERGIES)} allergies...")
    cdss_allergies_col.insert_many(ALLERGIES)

    print("\n[CDSS SEED] Summary:")
    for p in PATIENTS:
        pid = p["patient_id"]
        meds = [m["drug_name"] for m in MEDICATIONS if m["patient_id"] == pid]
        allg = [a["allergy_type"] for a in ALLERGIES if a["patient_id"] == pid]
        print(f"  {pid} {p['name']} (age {p['age']}) - Meds: {meds or 'none'} | Allergies: {allg or 'none'}")

    print("\n[CDSS SEED] Example expected alerts for CDSS-001 (Robert Anderson):")
    print("  - Hypertension warning (BP 150/95)")
    print("  - High blood sugar (glucose 210)")
    print("  - Fever (temp 38.2)")
    print("  - Elevated heart rate (HR 105)")
    print("  - High cholesterol (260)")
    print("  - Risk score: HIGH (age 65, diabetes, hypertension, smoking)")
    print("\n[CDSS SEED] Example expected alerts for CDSS-003 (James Wilson):")
    print("  - CRITICAL: Warfarin + Aspirin bleeding risk")
    print("  - CRITICAL: Aspirin allergy + prescribed aspirin")
    print("  - Hypertensive crisis (BP 185/125)")
    print("  - Severe hypoxemia (SpO2 87%)")
    print("  - Tachycardia (HR 125)")
    print("  - Severe anemia (Hgb 8.5)")
    print("  - Hyperkalemia (K+ 5.8)")
    print("  - Dangerously high glucose (310)")
    print("  - ACE + spironolactone hyperkalemia risk")

    print("\n[CDSS SEED] Done!")


if __name__ == "__main__":
    seed()
