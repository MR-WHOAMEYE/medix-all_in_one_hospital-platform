"""
Clinical Decision Support System (CDSS) — Rule Engine & Risk Scoring
=====================================================================
Provides rule-based clinical alerts, drug interaction checks, allergy
warnings, lab result interpretation, workflow context alerts, and
patient risk scoring.

This module is purely advisory — it supports clinical decisions but
does NOT make diagnoses or automated medical decisions.
"""
from datetime import datetime, timedelta
from typing import Optional


# ══════════════════════════════════════════════
# ALERT SEVERITY
# ══════════════════════════════════════════════
SEVERITY_CRITICAL = "critical"
SEVERITY_HIGH = "high"
SEVERITY_MEDIUM = "medium"
SEVERITY_LOW = "low"
SEVERITY_INFO = "info"


def _alert(alert_type, message, severity, recommendation, source="rule_engine"):
    """Helper to create a structured alert dict."""
    return {
        "alert_type": alert_type,
        "message": message,
        "severity": severity,
        "recommendation": recommendation,
        "source": source,
        "generated_at": datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════
# 1. VITAL SIGN ALERTS
# ══════════════════════════════════════════════
def evaluate_vitals(vitals: dict) -> list[dict]:
    """
    Evaluate patient vital signs and return clinical alerts.
    Expects keys: heart_rate, systolic_bp, diastolic_bp, oxygen_level, temperature
    """
    alerts = []
    if not vitals:
        return alerts

    # Blood pressure check
    sys_bp = vitals.get("systolic_bp")
    dia_bp = vitals.get("diastolic_bp")
    if sys_bp is not None and dia_bp is not None:
        if sys_bp > 180 or dia_bp > 120:
            alerts.append(_alert(
                "vital_sign", f"Hypertensive crisis: BP {sys_bp}/{dia_bp} mmHg",
                SEVERITY_CRITICAL,
                "Immediate medical attention required. Consider IV antihypertensives. Monitor every 5 minutes."
            ))
        elif sys_bp > 140 or dia_bp > 90:
            alerts.append(_alert(
                "vital_sign", f"Possible hypertension: BP {sys_bp}/{dia_bp} mmHg",
                SEVERITY_HIGH,
                "Monitor blood pressure regularly. Evaluate for antihypertensive therapy. Recommend low-sodium diet."
            ))
        elif sys_bp < 90 or dia_bp < 60:
            alerts.append(_alert(
                "vital_sign", f"Hypotension detected: BP {sys_bp}/{dia_bp} mmHg",
                SEVERITY_HIGH,
                "Assess for dehydration, bleeding, or sepsis. Consider IV fluids."
            ))

    # Heart rate
    hr = vitals.get("heart_rate")
    if hr is not None:
        if hr > 120:
            alerts.append(_alert(
                "vital_sign", f"Tachycardia: Heart rate {hr} bpm",
                SEVERITY_HIGH,
                "Evaluate for arrhythmia, infection, pain, or anxiety. Order ECG if persistent."
            ))
        elif hr > 100:
            alerts.append(_alert(
                "vital_sign", f"Elevated heart rate: {hr} bpm",
                SEVERITY_MEDIUM,
                "Monitor patient. Assess hydration status and potential causes."
            ))
        elif hr < 50:
            alerts.append(_alert(
                "vital_sign", f"Bradycardia: Heart rate {hr} bpm",
                SEVERITY_HIGH,
                "Evaluate for cardiac conduction abnormalities. Check medication side effects."
            ))

    # Oxygen level
    spo2 = vitals.get("oxygen_level")
    if spo2 is not None:
        if spo2 < 85:
            alerts.append(_alert(
                "vital_sign", f"Severe hypoxemia: SpO2 {spo2}%",
                SEVERITY_CRITICAL,
                "Immediate supplemental oxygen. Consider intubation if unresponsive. ABG recommended."
            ))
        elif spo2 < 90:
            alerts.append(_alert(
                "vital_sign", f"Low oxygen saturation: SpO2 {spo2}%",
                SEVERITY_HIGH,
                "Administer supplemental oxygen. Monitor continuously. Evaluate respiratory function."
            ))
        elif spo2 < 94:
            alerts.append(_alert(
                "vital_sign", f"Borderline oxygen: SpO2 {spo2}%",
                SEVERITY_MEDIUM,
                "Monitor oxygen levels. Encourage deep breathing exercises."
            ))

    # Temperature
    temp = vitals.get("temperature")
    if temp is not None:
        if temp > 39.5:
            alerts.append(_alert(
                "vital_sign", f"High fever: {temp}\u00b0C",
                SEVERITY_HIGH,
                "Investigate infection source. Consider blood cultures. Administer antipyretics."
            ))
        elif temp > 38.0:
            alerts.append(_alert(
                "vital_sign", f"Fever detected: {temp}\u00b0C",
                SEVERITY_MEDIUM,
                "Monitor temperature. Consider antipyretics. Evaluate for infection."
            ))
        elif temp < 35.0:
            alerts.append(_alert(
                "vital_sign", f"Hypothermia: {temp}\u00b0C",
                SEVERITY_HIGH,
                "Active warming required. Assess for environmental exposure or sepsis."
            ))

    return alerts


# ══════════════════════════════════════════════
# 2. DRUG INTERACTION ALERTS
# ══════════════════════════════════════════════

# Known drug interactions: (drug_a, drug_b) -> (message, severity, recommendation)
DRUG_INTERACTIONS = [
    ({"warfarin"}, {"aspirin", "ibuprofen", "naproxen"},
     "Bleeding risk: Warfarin combined with NSAIDs/Aspirin",
     SEVERITY_CRITICAL,
     "High risk of gastrointestinal and intracranial bleeding. Consider alternative pain management. Monitor INR closely."),

    ({"ibuprofen", "naproxen", "diclofenac"}, {"prednisone", "dexamethasone", "methylprednisolone", "hydrocortisone"},
     "GI risk: NSAID combined with corticosteroids",
     SEVERITY_HIGH,
     "Increased risk of gastrointestinal ulceration and bleeding. Add gastroprotective agent (PPI). Consider alternative."),

    ({"metformin"}, {"contrast dye", "iodinated contrast"},
     "Lactic acidosis risk: Metformin with contrast media",
     SEVERITY_HIGH,
     "Hold metformin 48h before and after contrast procedures. Monitor renal function."),

    ({"ssri", "fluoxetine", "sertraline", "paroxetine"}, {"tramadol", "fentanyl", "meperidine"},
     "Serotonin syndrome risk: SSRI combined with opioid",
     SEVERITY_HIGH,
     "Monitor for serotonin syndrome symptoms (agitation, confusion, tachycardia). Consider alternative analgesic."),

    ({"ace inhibitor", "lisinopril", "enalapril", "ramipril"}, {"potassium", "spironolactone"},
     "Hyperkalemia risk: ACE inhibitor with potassium-sparing agent",
     SEVERITY_MEDIUM,
     "Monitor serum potassium levels closely. Limit dietary potassium intake."),

    ({"simvastatin", "atorvastatin", "lovastatin"}, {"erythromycin", "clarithromycin"},
     "Rhabdomyolysis risk: Statin combined with macrolide antibiotic",
     SEVERITY_HIGH,
     "Hold statin during antibiotic course if possible. Monitor CK levels. Use azithromycin as alternative."),

    ({"warfarin"}, {"amiodarone"},
     "Increased bleeding risk: Warfarin with Amiodarone",
     SEVERITY_HIGH,
     "Reduce warfarin dose by 30-50%. Monitor INR weekly until stable."),

    ({"methotrexate"}, {"trimethoprim", "nsaid", "ibuprofen"},
     "Methotrexate toxicity risk",
     SEVERITY_CRITICAL,
     "Avoid combination. May cause bone marrow suppression, renal failure. Monitor CBC and renal function."),
]


def evaluate_drug_interactions(medications: list[dict]) -> list[dict]:
    """
    Check for known drug-drug interactions.
    Each medication dict should have 'drug_name' (str).
    """
    alerts = []
    if not medications or len(medications) < 2:
        return alerts

    drug_names = {m.get("drug_name", "").lower().strip() for m in medications if m.get("drug_name")}

    for group_a, group_b, message, severity, recommendation in DRUG_INTERACTIONS:
        matched_a = drug_names & group_a
        matched_b = drug_names & group_b
        if matched_a and matched_b:
            alerts.append(_alert(
                "drug_interaction",
                f"{message} (found: {', '.join(matched_a)} + {', '.join(matched_b)})",
                severity, recommendation
            ))

    return alerts


# ══════════════════════════════════════════════
# 3. ALLERGY ALERTS
# ══════════════════════════════════════════════

# Common drug-allergy cross-reactivity groups
ALLERGY_DRUG_MAP = {
    "penicillin": ["penicillin", "amoxicillin", "ampicillin", "piperacillin", "augmentin"],
    "sulfa": ["sulfamethoxazole", "trimethoprim-sulfamethoxazole", "bactrim", "sulfasalazine"],
    "aspirin": ["aspirin", "ibuprofen", "naproxen", "diclofenac"],
    "cephalosporin": ["cephalexin", "cefazolin", "ceftriaxone", "cefuroxime"],
    "latex": ["latex"],
    "codeine": ["codeine", "morphine", "hydrocodone", "oxycodone"],
    "nsaid": ["ibuprofen", "naproxen", "diclofenac", "aspirin", "celecoxib"],
    "ace inhibitor": ["lisinopril", "enalapril", "ramipril", "captopril"],
    "contrast dye": ["contrast dye", "iodinated contrast"],
}


def evaluate_allergies(allergies: list[dict], medications: list[dict]) -> list[dict]:
    """
    Cross-check patient allergies against prescribed medications.
    Each allergy dict should have 'allergy_type' (str).
    Each medication dict should have 'drug_name' (str).
    """
    alerts = []
    if not allergies or not medications:
        return alerts

    allergy_types = {a.get("allergy_type", "").lower().strip() for a in allergies if a.get("allergy_type")}
    drug_names = {m.get("drug_name", "").lower().strip() for m in medications if m.get("drug_name")}

    for allergy in allergy_types:
        # Direct allergy-drug match
        if allergy in drug_names:
            alerts.append(_alert(
                "allergy", f"SEVERE: Patient allergic to '{allergy}' — currently prescribed!",
                SEVERITY_CRITICAL,
                f"Immediately discontinue {allergy}. Document reaction. Prescribe safe alternative."
            ))

        # Cross-reactivity check
        related_drugs = ALLERGY_DRUG_MAP.get(allergy, [])
        for drug in related_drugs:
            if drug in drug_names and drug != allergy:
                alerts.append(_alert(
                    "allergy",
                    f"Cross-reactivity risk: Patient allergic to '{allergy}', prescribed '{drug}'",
                    SEVERITY_HIGH,
                    f"'{drug}' may cross-react with '{allergy}' allergy. Consider alternative medication."
                ))

    return alerts


# ══════════════════════════════════════════════
# 4. LAB RESULT INTERPRETATION
# ══════════════════════════════════════════════
def evaluate_labs(labs: dict) -> list[dict]:
    """
    Interpret laboratory results and generate clinical alerts.
    Expects keys: glucose, hemoglobin, cholesterol, wbc, creatinine, potassium, sodium, alt, ast
    """
    alerts = []
    if not labs:
        return alerts

    # Glucose (mg/dL)
    glucose = labs.get("glucose")
    if glucose is not None:
        if glucose > 300:
            alerts.append(_alert("lab_result", f"Dangerously high blood glucose: {glucose} mg/dL",
                                 SEVERITY_CRITICAL, "Check for diabetic ketoacidosis. IV insulin protocol. Monitor hourly."))
        elif glucose > 200:
            alerts.append(_alert("lab_result", f"High blood sugar: {glucose} mg/dL",
                                 SEVERITY_HIGH, "Assess diabetes management. Review insulin dosing. HbA1c test recommended."))
        elif glucose > 140:
            alerts.append(_alert("lab_result", f"Elevated glucose: {glucose} mg/dL",
                                 SEVERITY_MEDIUM, "Monitor fasting glucose. Consider oral glucose tolerance test."))
        elif glucose < 70:
            alerts.append(_alert("lab_result", f"Hypoglycemia: {glucose} mg/dL",
                                 SEVERITY_HIGH, "Administer glucose. Check medication dosing. Monitor closely."))

    # Hemoglobin (g/dL)
    hgb = labs.get("hemoglobin")
    if hgb is not None:
        if hgb < 7:
            alerts.append(_alert("lab_result", f"Severe anemia: Hemoglobin {hgb} g/dL",
                                 SEVERITY_CRITICAL, "Consider blood transfusion. Iron studies and reticulocyte count."))
        elif hgb < 10:
            alerts.append(_alert("lab_result", f"Possible anemia: Hemoglobin {hgb} g/dL",
                                 SEVERITY_MEDIUM, "Investigate cause: iron deficiency, chronic disease, bleeding. Iron panel recommended."))
        elif hgb > 17.5:
            alerts.append(_alert("lab_result", f"Polycythemia: Hemoglobin {hgb} g/dL",
                                 SEVERITY_MEDIUM, "Evaluate for polycythemia vera or secondary causes. Check EPO levels."))

    # Cholesterol (mg/dL)
    chol = labs.get("cholesterol")
    if chol is not None:
        if chol > 300:
            alerts.append(_alert("lab_result", f"Very high cholesterol: {chol} mg/dL",
                                 SEVERITY_HIGH, "High cardiovascular risk. Statin therapy indicated. Lipid panel follow-up in 6 weeks."))
        elif chol > 240:
            alerts.append(_alert("lab_result", f"Elevated cholesterol: {chol} mg/dL",
                                 SEVERITY_MEDIUM, "Cardiovascular risk factor. Recommend dietary changes, exercise. Consider statin."))

    # WBC (cells/uL)
    wbc = labs.get("wbc")
    if wbc is not None:
        if wbc > 11000:
            alerts.append(_alert("lab_result", f"Leukocytosis: WBC {wbc} cells/uL",
                                 SEVERITY_MEDIUM, "Evaluate for infection, inflammation, or stress response. Blood cultures if febrile."))
        elif wbc < 4000:
            alerts.append(_alert("lab_result", f"Leukopenia: WBC {wbc} cells/uL",
                                 SEVERITY_MEDIUM, "Evaluate for immunosuppression, viral infection, or medication side effect."))

    # Creatinine (mg/dL)
    creat = labs.get("creatinine")
    if creat is not None:
        if creat > 2.0:
            alerts.append(_alert("lab_result", f"Elevated creatinine: {creat} mg/dL — possible renal impairment",
                                 SEVERITY_HIGH, "Evaluate kidney function. Consider nephrology referral. Adjust renally-cleared medications."))
        elif creat > 1.3:
            alerts.append(_alert("lab_result", f"Mildly elevated creatinine: {creat} mg/dL",
                                 SEVERITY_MEDIUM, "Monitor renal function. Review nephrotoxic medications."))

    # Potassium (mEq/L)
    k = labs.get("potassium")
    if k is not None:
        if k > 6.0:
            alerts.append(_alert("lab_result", f"Severe hyperkalemia: K+ {k} mEq/L",
                                 SEVERITY_CRITICAL, "Stat ECG. IV calcium gluconate. Insulin + dextrose. Kayexalate. Cardiac monitoring."))
        elif k > 5.5:
            alerts.append(_alert("lab_result", f"Hyperkalemia: K+ {k} mEq/L",
                                 SEVERITY_HIGH, "ECG recommended. Review potassium-sparing medications. Low-potassium diet."))
        elif k < 3.0:
            alerts.append(_alert("lab_result", f"Severe hypokalemia: K+ {k} mEq/L",
                                 SEVERITY_CRITICAL, "IV potassium replacement. Cardiac monitoring. Check magnesium level."))
        elif k < 3.5:
            alerts.append(_alert("lab_result", f"Hypokalemia: K+ {k} mEq/L",
                                 SEVERITY_MEDIUM, "Oral potassium supplementation. Monitor levels."))

    return alerts


# ══════════════════════════════════════════════
# 5. PATIENT RISK SCORE
# ══════════════════════════════════════════════
def calculate_risk_score(patient: dict, vitals: dict, labs: dict) -> dict:
    """
    Calculate a composite risk score (0-100) based on patient factors.
    Returns: { score, level, factors }
    """
    score = 0
    factors = []

    # Age factor
    age = patient.get("age")
    if age is not None:
        if age > 75:
            score += 25
            factors.append("Age > 75 (very high age risk)")
        elif age > 60:
            score += 15
            factors.append("Age > 60 (elevated age risk)")
        elif age > 45:
            score += 5
            factors.append("Age > 45 (moderate age consideration)")

    # Medical history factors
    history = [h.lower() for h in (patient.get("history") or [])]
    if any(h in history for h in ["diabetes", "type 2 diabetes", "type 1 diabetes"]):
        score += 15
        factors.append("Diabetes history")
    if any(h in history for h in ["hypertension", "high blood pressure"]):
        score += 10
        factors.append("Hypertension history")
    if any(h in history for h in ["smoking", "smoker", "tobacco"]):
        score += 12
        factors.append("Smoking / tobacco use")
    if any(h in history for h in ["heart disease", "coronary artery disease", "cad", "heart attack", "mi"]):
        score += 20
        factors.append("Cardiovascular disease history")
    if any(h in history for h in ["stroke", "tia"]):
        score += 15
        factors.append("Stroke / TIA history")
    if any(h in history for h in ["obesity", "obese", "bmi > 30"]):
        score += 8
        factors.append("Obesity")
    if any(h in history for h in ["copd", "asthma", "chronic lung disease"]):
        score += 8
        factors.append("Chronic respiratory disease")

    # Vital signs factors
    if vitals:
        sys_bp = vitals.get("systolic_bp")
        if sys_bp and sys_bp > 140:
            score += 10
            factors.append(f"Current high BP: {sys_bp} mmHg")

        hr = vitals.get("heart_rate")
        if hr and hr > 100:
            score += 5
            factors.append(f"Elevated heart rate: {hr} bpm")

        spo2 = vitals.get("oxygen_level")
        if spo2 and spo2 < 92:
            score += 10
            factors.append(f"Low oxygen: {spo2}%")

    # Lab factors
    if labs:
        glucose = labs.get("glucose")
        if glucose and glucose > 200:
            score += 10
            factors.append(f"High glucose: {glucose} mg/dL")

        chol = labs.get("cholesterol")
        if chol and chol > 240:
            score += 8
            factors.append(f"High cholesterol: {chol} mg/dL")

        creat = labs.get("creatinine")
        if creat and creat > 1.5:
            score += 8
            factors.append(f"Elevated creatinine: {creat} mg/dL")

    score = min(100, score)

    if score >= 60:
        level = "HIGH"
    elif score >= 30:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {"score": score, "level": level, "factors": factors}


# ══════════════════════════════════════════════
# 6. WORKFLOW CONTEXT ALERTS
# ══════════════════════════════════════════════
def evaluate_workflow_context(patient: dict) -> list[dict]:
    """
    Generate warnings for operational/workflow conditions.
    Expects patient dict with optional keys:
      assigned_doctor, admission_time, last_treatment_time, recent_lab_tests
    """
    alerts = []

    # Critical patient not assigned to a doctor
    risk_level = patient.get("risk_level", "LOW")
    assigned_doctor = patient.get("assigned_doctor")
    if risk_level == "HIGH" and not assigned_doctor:
        alerts.append(_alert(
            "workflow", "HIGH-risk patient has no assigned doctor",
            SEVERITY_CRITICAL,
            "Assign an attending physician immediately. Escalate to department head."
        ))

    # Patient waiting too long for treatment
    admission_time = patient.get("admission_time")
    last_treatment = patient.get("last_treatment_time")
    if admission_time:
        try:
            adm = datetime.fromisoformat(admission_time) if isinstance(admission_time, str) else admission_time
            wait_hours = (datetime.utcnow() - adm).total_seconds() / 3600
            if wait_hours > 4 and not last_treatment:
                alerts.append(_alert(
                    "workflow", f"Patient waiting {wait_hours:.1f} hours without treatment",
                    SEVERITY_HIGH,
                    "Review patient queue. Prioritize if condition is deteriorating."
                ))
        except (ValueError, TypeError):
            pass

    # Duplicate lab tests within 24 hours
    recent_labs = patient.get("recent_lab_tests") or []
    if len(recent_labs) >= 2:
        from collections import Counter
        ts_24h_ago = (datetime.utcnow() - timedelta(hours=24)).isoformat()
        recent_names = []
        for lab in recent_labs:
            lab_time = lab.get("timestamp", "")
            if lab_time >= ts_24h_ago:
                recent_names.append(lab.get("test_name", "").lower())
        dupes = [name for name, count in Counter(recent_names).items() if count > 1 and name]
        for dupe in dupes:
            alerts.append(_alert(
                "workflow", f"Duplicate lab test '{dupe}' ordered within 24 hours",
                SEVERITY_MEDIUM,
                "Verify if the repeat test is clinically necessary to avoid unnecessary costs."
            ))

    return alerts


# ══════════════════════════════════════════════
# 7. MASTER EVALUATION — aggregate all alerts
# ══════════════════════════════════════════════
def evaluate_patient_full(patient: dict, vitals: dict, labs: dict,
                          medications: list[dict], allergies: list[dict]) -> dict:
    """
    Run all rule-based evaluations and return aggregated result.
    Returns: { alerts, risk_score, alert_summary }
    """
    all_alerts = []
    all_alerts.extend(evaluate_vitals(vitals or {}))
    all_alerts.extend(evaluate_drug_interactions(medications or []))
    all_alerts.extend(evaluate_allergies(allergies or [], medications or []))
    all_alerts.extend(evaluate_labs(labs or {}))
    all_alerts.extend(evaluate_workflow_context(patient or {}))

    risk = calculate_risk_score(patient or {}, vitals or {}, labs or {})

    # Sort by severity
    severity_order = {SEVERITY_CRITICAL: 0, SEVERITY_HIGH: 1, SEVERITY_MEDIUM: 2, SEVERITY_LOW: 3, SEVERITY_INFO: 4}
    all_alerts.sort(key=lambda a: severity_order.get(a["severity"], 5))

    summary = {
        "total": len(all_alerts),
        "critical": sum(1 for a in all_alerts if a["severity"] == SEVERITY_CRITICAL),
        "high": sum(1 for a in all_alerts if a["severity"] == SEVERITY_HIGH),
        "medium": sum(1 for a in all_alerts if a["severity"] == SEVERITY_MEDIUM),
        "low": sum(1 for a in all_alerts if a["severity"] == SEVERITY_LOW),
    }

    return {
        "alerts": all_alerts,
        "risk_score": risk,
        "alert_summary": summary,
    }
