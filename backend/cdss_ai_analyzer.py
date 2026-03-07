"""
CDSS LangChain Clinical Analysis
=================================
Uses Gemini LLM to provide AI-powered clinical recommendations based on
patient context. Outputs structured Pydantic models. This is advisory
only and does NOT replace physician judgment.
"""
import os
import json
import logging
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── Gemini client (shared init) ──
gemini_client = None
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print("[INIT] CDSS AI Analyzer: Gemini client initialized")
    except Exception as e:
        print(f"[WARN] CDSS AI Analyzer: Gemini init failed: {e}")


class ClinicalRecommendation(BaseModel):
    """Structured output from the AI clinical analysis."""
    monitoring_suggestions: list[str] = Field(default_factory=list, description="Vital signs or parameters to monitor")
    lifestyle_recommendations: list[str] = Field(default_factory=list, description="Diet, exercise, habit changes")
    follow_up_reminders: list[str] = Field(default_factory=list, description="Scheduled tests, appointments, or reviews")
    additional_tests: list[str] = Field(default_factory=list, description="Recommended laboratory or diagnostic tests")
    summary: str = Field(default="", description="Brief clinical summary paragraph")


def analyze_patient_with_ai(patient: dict, vitals: dict, labs: dict,
                            medications: list, allergies: list,
                            rule_alerts: list) -> ClinicalRecommendation:
    """
    Use Gemini to generate additional clinical recommendations.
    Falls back to rule-based suggestions if LLM is unavailable.
    """
    if gemini_client:
        try:
            return _gemini_analysis(patient, vitals, labs, medications, allergies, rule_alerts)
        except Exception as e:
            logger.warning(f"Gemini clinical analysis failed: {e}, using fallback")

    return _fallback_analysis(patient, vitals, labs, medications, allergies, rule_alerts)


def _gemini_analysis(patient, vitals, labs, medications, allergies, rule_alerts) -> ClinicalRecommendation:
    """Call Gemini for AI-powered clinical recommendations."""
    alert_summaries = [f"[{a.get('severity','?').upper()}] {a.get('message','')}" for a in (rule_alerts or [])[:10]]

    prompt = f"""You are a clinical decision support assistant in a hospital. Based on the patient data below, provide structured advisory recommendations. You are NOT making a diagnosis — only supporting the physician's decision-making.

PATIENT:
- Name: {patient.get('name', 'Unknown')}
- Age: {patient.get('age', 'Unknown')}
- Gender: {patient.get('gender', 'Unknown')}
- Medical History: {', '.join(patient.get('history', [])) or 'None reported'}

VITAL SIGNS:
- Heart Rate: {vitals.get('heart_rate', 'N/A')} bpm
- Blood Pressure: {vitals.get('systolic_bp', 'N/A')}/{vitals.get('diastolic_bp', 'N/A')} mmHg
- Oxygen Level: {vitals.get('oxygen_level', 'N/A')}%
- Temperature: {vitals.get('temperature', 'N/A')} C

LAB RESULTS:
- Glucose: {labs.get('glucose', 'N/A')} mg/dL
- Hemoglobin: {labs.get('hemoglobin', 'N/A')} g/dL
- Cholesterol: {labs.get('cholesterol', 'N/A')} mg/dL
- WBC: {labs.get('wbc', 'N/A')} cells/uL
- Creatinine: {labs.get('creatinine', 'N/A')} mg/dL
- Potassium: {labs.get('potassium', 'N/A')} mEq/L

MEDICATIONS: {', '.join(m.get('drug_name','') + ' ' + str(m.get('dosage','')) for m in (medications or [])) or 'None'}

ALLERGIES: {', '.join(a.get('allergy_type','') for a in (allergies or [])) or 'None'}

EXISTING ALERTS: {chr(10).join(alert_summaries) or 'None'}

Respond with ONLY a JSON object (no markdown, no explanation):
{{
    "monitoring_suggestions": ["<list of parameters to monitor>"],
    "lifestyle_recommendations": ["<list of lifestyle advice>"],
    "follow_up_reminders": ["<list of follow-up actions and timelines>"],
    "additional_tests": ["<list of recommended diagnostic tests>"],
    "summary": "<1-2 sentence clinical summary>"
}}"""

    response = gemini_client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    parsed = json.loads(raw)
    return ClinicalRecommendation(**parsed)


def _fallback_analysis(patient, vitals, labs, medications, allergies, rule_alerts) -> ClinicalRecommendation:
    """Rule-based fallback when LLM is unavailable."""
    monitoring = []
    lifestyle = []
    follow_ups = []
    tests = []

    age = patient.get("age", 0) if patient else 0
    history = [h.lower() for h in (patient.get("history") or [])] if patient else []

    # Based on vitals
    if vitals:
        if vitals.get("systolic_bp", 0) > 140:
            monitoring.append("Monitor blood pressure every 4 hours")
            lifestyle.append("Reduce sodium intake to < 2g/day")
        if vitals.get("heart_rate", 0) > 100:
            monitoring.append("Continuous cardiac monitoring recommended")
        if vitals.get("oxygen_level", 100) < 94:
            monitoring.append("Continuous pulse oximetry")
        if vitals.get("temperature", 37) > 38:
            monitoring.append("Monitor temperature every 2 hours")
            tests.append("Blood cultures if fever persists > 48 hours")

    # Based on labs
    if labs:
        if labs.get("glucose", 0) > 200:
            monitoring.append("Blood glucose monitoring every 4-6 hours")
            lifestyle.append("Low glycemic index diet recommended")
            follow_ups.append("HbA1c test in 3 months")
        if labs.get("hemoglobin", 15) < 10:
            tests.append("Iron studies panel")
            tests.append("Reticulocyte count")
        if labs.get("cholesterol", 0) > 240:
            lifestyle.append("Heart-healthy diet (reduce saturated fats)")
            lifestyle.append("Regular aerobic exercise 150 min/week")
            follow_ups.append("Repeat lipid panel in 6-8 weeks")
        if labs.get("creatinine", 0) > 1.5:
            monitoring.append("Monitor urine output")
            follow_ups.append("Nephrology referral if creatinine continues to rise")

    # Based on history
    if "diabetes" in " ".join(history):
        follow_ups.append("Annual diabetic eye exam")
        follow_ups.append("Foot exam at each visit")
    if "smoking" in " ".join(history) or "smoker" in " ".join(history):
        lifestyle.append("Smoking cessation program strongly recommended")
    if age > 60:
        follow_ups.append("Annual comprehensive metabolic panel")
        lifestyle.append("Regular physical activity appropriate for age")

    # General
    if not lifestyle:
        lifestyle.append("Maintain balanced diet and regular exercise")
    if not follow_ups:
        follow_ups.append("Schedule follow-up appointment in 2-4 weeks")

    severity_count = {}
    for a in (rule_alerts or []):
        sev = a.get("severity", "info")
        severity_count[sev] = severity_count.get(sev, 0) + 1

    summary_parts = []
    if severity_count.get("critical"):
        summary_parts.append(f"{severity_count['critical']} critical alert(s) require immediate attention")
    if severity_count.get("high"):
        summary_parts.append(f"{severity_count['high']} high-priority concern(s)")
    summary = ". ".join(summary_parts) + "." if summary_parts else "No urgent clinical concerns identified. Continue routine monitoring."

    return ClinicalRecommendation(
        monitoring_suggestions=monitoring,
        lifestyle_recommendations=lifestyle,
        follow_up_reminders=follow_ups,
        additional_tests=tests,
        summary=summary,
    )
