"""
Seed script for Workflow Automation System.
Seeds departments with doctors and sample workflow requests.
Usage: python seed_workflow_templates.py
"""
from mongo import departments_col, workflow_requests_col, workflow_logs_col
from datetime import datetime

if departments_col is None:
    print("[ERROR] MongoDB not available. Cannot seed.")
    exit(1)

# ── Seed Departments ──
DEPARTMENTS = [
    {
        "name": "Cardiology",
        "description": "Heart and cardiovascular system disorders",
        "doctors": [
            {"name": "Dr. Arun Mehta", "email": "arun.mehta@hospital.com", "specialization": "Interventional Cardiology"},
            {"name": "Dr. Priya Sharma", "email": "priya.sharma@hospital.com", "specialization": "Electrophysiology"},
        ],
    },
    {
        "name": "Orthopedics",
        "description": "Bone, joint, and musculoskeletal conditions",
        "doctors": [
            {"name": "Dr. Rajesh Kumar", "email": "rajesh.kumar@hospital.com", "specialization": "Joint Replacement"},
            {"name": "Dr. Sneha Patel", "email": "sneha.patel@hospital.com", "specialization": "Sports Medicine"},
        ],
    },
    {
        "name": "Dermatology",
        "description": "Skin, hair, and nail conditions",
        "doctors": [
            {"name": "Dr. Kavitha Nair", "email": "kavitha.nair@hospital.com", "specialization": "Clinical Dermatology"},
        ],
    },
    {
        "name": "Neurology",
        "description": "Brain, spinal cord, and nervous system disorders",
        "doctors": [
            {"name": "Dr. Vikram Singh", "email": "vikram.singh@hospital.com", "specialization": "Neuro-oncology"},
            {"name": "Dr. Deepa Iyer", "email": "deepa.iyer@hospital.com", "specialization": "Epilepsy"},
        ],
    },
    {
        "name": "General Medicine",
        "description": "Primary care, general health, and unclassified queries",
        "doctors": [
            {"name": "Dr. Suresh Reddy", "email": "suresh.reddy@hospital.com", "specialization": "Internal Medicine"},
            {"name": "Dr. Anita Desai", "email": "anita.desai@hospital.com", "specialization": "Family Medicine"},
        ],
    },
    {
        "name": "Billing",
        "description": "Insurance, payments, invoices, and financial queries",
        "doctors": [
            {"name": "Ramesh Gupta (Billing Mgr)", "email": "ramesh.gupta@hospital.com", "specialization": "Billing"},
        ],
    },
]

departments_col.delete_many({})
result = departments_col.insert_many(DEPARTMENTS)
print(f"[SEED] Inserted {len(result.inserted_ids)} departments:")
for d in DEPARTMENTS:
    print(f"  + {d['name']} - {len(d['doctors'])} doctor(s)")

# ── Seed Sample Requests ──
SAMPLE_QUERIES = [
    {
        "patient": {"patient_id": "P001", "name": "John Smith", "email": "john@example.com", "phone": "+1-555-0101"},
        "query": "I have been experiencing chest pain after exercise for the past week",
        "department": "Cardiology",
        "status": "NEW",
        "urgency": "high",
        "ai_classification": {"department": "Cardiology", "confidence": 0.95, "reasoning": "Chest pain is a cardiac symptom", "urgency": "high"},
    },
    {
        "patient": {"patient_id": "P002", "name": "Sarah Johnson", "email": "sarah@example.com", "phone": "+1-555-0102"},
        "query": "I fell down the stairs and my knee is swollen and painful",
        "department": "Orthopedics",
        "status": "ASSIGNED",
        "assigned_doctor": {"name": "Dr. Rajesh Kumar", "email": "rajesh.kumar@hospital.com"},
        "urgency": "high",
        "ai_classification": {"department": "Orthopedics", "confidence": 0.92, "reasoning": "Fall injury with joint swelling", "urgency": "high"},
    },
    {
        "patient": {"patient_id": "P003", "name": "Mike Davis", "email": "mike@example.com", "phone": "+1-555-0103"},
        "query": "I have a persistent skin rash on my arms that won't go away",
        "department": "Dermatology",
        "status": "IN_PROGRESS",
        "assigned_doctor": {"name": "Dr. Kavitha Nair", "email": "kavitha.nair@hospital.com"},
        "urgency": "medium",
        "ai_classification": {"department": "Dermatology", "confidence": 0.97, "reasoning": "Skin rash is a dermatological condition", "urgency": "medium"},
    },
    {
        "patient": {"patient_id": "P004", "name": "Emily Brown", "email": "emily@example.com", "phone": "+1-555-0104"},
        "query": "I keep getting severe migraines with vision problems",
        "department": "Neurology",
        "status": "NEW",
        "urgency": "high",
        "ai_classification": {"department": "Neurology", "confidence": 0.93, "reasoning": "Migraines with visual disturbance are neurological", "urgency": "high"},
    },
    {
        "patient": {"patient_id": "P005", "name": "David Wilson", "email": "david@example.com", "phone": "+1-555-0105"},
        "query": "I need help understanding my insurance coverage for the surgery",
        "department": "Billing",
        "status": "NEW",
        "urgency": "low",
        "ai_classification": {"department": "Billing", "confidence": 0.98, "reasoning": "Insurance inquiry is a billing matter", "urgency": "low"},
    },
    {
        "patient": {"patient_id": "P006", "name": "Lisa Anderson", "email": "lisa@example.com", "phone": "+1-555-0106"},
        "query": "I have been feeling generally unwell with fatigue and mild fever",
        "department": "General Medicine",
        "status": "RESOLVED",
        "assigned_doctor": {"name": "Dr. Suresh Reddy", "email": "suresh.reddy@hospital.com"},
        "doctor_response": {"text": "Recommend blood work and rest. Prescribed paracetamol.", "responded_by": "suresh.reddy@hospital.com", "responded_at": datetime.utcnow().isoformat()},
        "urgency": "medium",
        "ai_classification": {"department": "General Medicine", "confidence": 0.78, "reasoning": "General symptoms without specific organ focus", "urgency": "medium"},
    },
]

now = datetime.utcnow().isoformat()
for req in SAMPLE_QUERIES:
    req.setdefault("assigned_doctor", None)
    req.setdefault("doctor_response", None)
    req["created_at"] = now
    req["updated_at"] = now
    req["resolved_at"] = now if req["status"] == "RESOLVED" else None

workflow_requests_col.delete_many({})
result = workflow_requests_col.insert_many(SAMPLE_QUERIES)
print(f"\n[SEED] Inserted {len(result.inserted_ids)} sample requests:")
for i, req in enumerate(SAMPLE_QUERIES):
    print(f"  + {req['patient']['name']}: \"{req['query'][:50]}...\" -> {req['department']} [{req['status']}]")

# Seed logs for the sample requests
if workflow_logs_col is not None:
    workflow_logs_col.delete_many({})
    logs = []
    for i, rid in enumerate(result.inserted_ids):
        logs.append({
            "request_id": str(rid),
            "action": "CREATED",
            "previous_status": "-",
            "new_status": "NEW",
            "previous_department": None,
            "new_department": SAMPLE_QUERIES[i]["department"],
            "performed_by": "system",
            "notes": f"AI routed to {SAMPLE_QUERIES[i]['department']}",
            "timestamp": now,
        })
    workflow_logs_col.insert_many(logs)
    print(f"\n[SEED] Inserted {len(logs)} workflow log entries.")

print("\n[DONE] Seed complete!")
