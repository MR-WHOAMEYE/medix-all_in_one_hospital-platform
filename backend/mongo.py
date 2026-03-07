import os
import logging
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# Suppress noisy MongoDB background task errors
logging.getLogger("pymongo").setLevel(logging.WARNING)

# Fetch MongoDB URI from environment variables
MONGO_URI = os.getenv("MONGO_URI") or os.getenv("mongo_db") or ""

# Initialize a SINGLE MongoClient instance for the entire application
# Use connection pooling parameters suitable for serverless and unstable networks
client = None
if MONGO_URI:
    try:
        client = MongoClient(
            MONGO_URI, 
            serverSelectionTimeoutMS=15000,
            connectTimeoutMS=30000,
            socketTimeoutMS=60000,
            maxPoolSize=10,
            minPoolSize=0,
            maxIdleTimeMS=30000,
            retryWrites=True,
            retryReads=True,
            w='majority',
            appname='ZeroIntercept',
        )
        # Test connection on startup
        client.admin.command('ping')
        print("[INIT] MongoDB connected and verified via centralized mongo.py")
    except Exception as e:
        print(f"[WARNING] MongoDB connection failed: {e}")
        client = None

# Database instance
mdb = client["zero_intercept"] if client is not None else None

# Collections
users_col = mdb["users"] if mdb is not None else None
prescriptions_col = mdb["prescriptions"] if mdb is not None else None
diagnoses_col = mdb["diagnoses"] if mdb is not None else None
vitals_col = mdb["patient_vitals"] if mdb is not None else None
bookings_col = mdb["appointment_bookings"] if mdb is not None else None
admissions_col = mdb["ward_admissions"] if mdb is not None else None
wards_col = mdb["wards"] if mdb is not None else None
notifications_col = mdb["notifications"] if mdb is not None else None
patient_feedback_col = mdb["patient_feedback"] if mdb is not None else None
messages_col = mdb["messages"] if mdb is not None else None
digital_twin_col = mdb["digital_twin_nodes"] if mdb is not None else None
nurse_profiles_col = mdb["nurse_profiles"] if mdb is not None else None
shift_schedules_col = mdb["shift_schedules"] if mdb is not None else None
patient_profiles_col = mdb["patient_profiles"] if mdb is not None else None
appointments_col = mdb["appointments"] if mdb is not None else None
cases_col = mdb["cases"] if mdb is not None else None

# AI Response Suggestions collections
patient_queries_col = mdb["patient_queries"] if mdb is not None else None
draft_responses_col = mdb["draft_responses"] if mdb is not None else None
knowledge_base_col = mdb["knowledge_base"] if mdb is not None else None

# Inter-Department Workflow Automation collections
workflow_templates_col = mdb["workflow_templates"] if mdb is not None else None
workflow_instances_col = mdb["workflow_instances"] if mdb is not None else None
workflow_requests_col = mdb["workflow_requests"] if mdb is not None else None
workflow_logs_col = mdb["workflow_logs"] if mdb is not None else None
departments_col = mdb["departments"] if mdb is not None else None

# Clinical Decision Support System (CDSS) collections
cdss_patients_col = mdb["cdss_patients"] if mdb is not None else None
cdss_vitals_col = mdb["cdss_vitals"] if mdb is not None else None
cdss_labs_col = mdb["cdss_labs"] if mdb is not None else None
cdss_medications_col = mdb["cdss_medications"] if mdb is not None else None
cdss_allergies_col = mdb["cdss_allergies"] if mdb is not None else None
cdss_alerts_col = mdb["cdss_alerts"] if mdb is not None else None

# Aliases for backward compatibility
feedback_col = patient_feedback_col  # Alias for admin_api
profiles_col = patient_profiles_col   # Alias for admin_api

# Print status (useful for local debugging, will appear in Vercel logs)
if client is None:
    print("[WARNING] MONGO_URI not found or connection failed. Database will be unavailable.")
