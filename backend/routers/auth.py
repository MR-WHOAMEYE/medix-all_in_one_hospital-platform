"""
Auth router — MongoDB-backed user management with JWT tokens.
Auto-seeds users from the SQLite Staff table on first run.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
import bcrypt
import jwt
import os
import csv
import random
import string
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "zero-intercept-secret-key-2026")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

from mongo import *

# Alias for backward compatibility
users_collection = users_col
notifications_collection = notifications_col

# ---------- MongoDB connection ----------
# MongoDB
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: Optional[str] = None
    role: str  # admin, doctor, nurse, patient
    phone: Optional[str] = None                # patient phone number (used as password)
    department: Optional[str] = None
    assigned_doctor: Optional[str] = None      # doctor email
    assigned_doctor_name: Optional[str] = None # doctor display name
    issue: Optional[str] = None                # patient issue / reason


class OTPVerifyRequest(BaseModel):
    email: str
    otp: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    department: Optional[str] = None
    created_at: Optional[str] = None

# ---------- Helper functions ----------
def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

def _create_token(user: dict) -> str:
    payload = {
        "user_id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "department": user.get("department", ""),
        "exp": datetime.utcnow() + timedelta(hours=12),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def _get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    token = authorization.split(" ")[1]
    return _decode_token(token)

# ---------- Auto-seed users from Staff CSV ----------
def seed_users_from_staff():
    """
    Reads the staff CSV and creates user accounts in MongoDB.
    Derives role from name prefix (Dr. → doctor, Nurse → nurse).
    Also creates 1 admin and some patient accounts.
    """
    if users_collection is None:
        return

    # Check if already seeded
    if users_collection.count_documents({}) > 0:
        print(f"  MongoDB users already seeded ({users_collection.count_documents({})} users)")
        return

    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    staff_csv = os.path.join(data_dir, "staff.csv")

    if not os.path.exists(staff_csv):
        # Fallback: just try the local data dir
        data_dir = os.path.join(os.path.dirname(__file__), "data")
        staff_csv = os.path.join(data_dir, "staff.csv")

    users_to_insert = []
    now = datetime.utcnow().isoformat()

    # 1) Create default admin
    users_to_insert.append({
        "name": "Dr. Admin",
        "email": "admin@hospital.ai",
        "password": _hash_password("admin123"),
        "role": "admin",
        "department": "Administration",
        "created_at": now,
        "created_by": "system",
    })

    # 2) Parse staff CSV and create doctor/nurse accounts
    if os.path.exists(staff_csv):
        seen_emails = {"admin@hospital.ai"}
        with open(staff_csv, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row["name"]
                department = row["department"]
                staff_id = row["staff_id"]

                # Derive role from name prefix
                if name.startswith("Dr."):
                    role = "doctor"
                elif name.startswith("Nurse"):
                    role = "nurse"
                else:
                    role = "doctor"

                # Generate email from name
                clean_name = name.replace("Dr. ", "").replace("Nurse ", "").replace(" ", "").lower()
                email = f"{clean_name}@hospital.ai"

                # Skip duplicates
                if email in seen_emails:
                    continue
                seen_emails.add(email)

                users_to_insert.append({
                    "name": name,
                    "email": email,
                    "password": _hash_password("password123"),
                    "role": role,
                    "department": department,
                    "staff_id": int(staff_id),
                    "shift_hours": float(row.get("shift_hours", 0)),
                    "cases_handled": int(row.get("cases_handled", 0)),
                    "overtime_hours": float(row.get("overtime_hours", 0)),
                    "created_at": now,
                    "created_by": "system",
                })

    # 3) Create some patient accounts
    patient_names = [
        ("Ravi Kumar", "ravi.kumar@patient.ai", "Emergency"),
        ("Priya Sharma", "priya.sharma@patient.ai", "Cardiology"),
        ("Amit Patel", "amit.patel@patient.ai", "Emergency"),
        ("Sunita Reddy", "sunita.reddy@patient.ai", "Pediatrics"),
        ("Vikram Singh", "vikram.singh@patient.ai", "Neurology"),
    ]
    for pname, pemail, pdept in patient_names:
        users_to_insert.append({
            "name": pname,
            "email": pemail,
            "password": _hash_password("patient123"),
            "role": "patient",
            "department": pdept,
            "created_at": now,
            "created_by": "system",
        })

    if users_to_insert:
        users_collection.insert_many(users_to_insert)
        print(f"  [OK] Seeded {len(users_to_insert)} users into MongoDB")

# ---------- Endpoints ----------
@router.post("/login")
def login(request: LoginRequest):
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not available")

    user = users_collection.find_one({"email": request.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not _verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _create_token(user)
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "department": user.get("department", ""),
        }
    }

@router.post("/register")
def register(request: RegisterRequest, current_user: dict = Depends(_get_current_user)):
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not available")

    caller_role = current_user["role"]

    # Permission checks
    if request.role == "admin" and caller_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create admin accounts")
    if request.role in ["doctor", "nurse"] and caller_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create doctor/nurse accounts")
    if request.role == "patient" and caller_role not in ["admin", "doctor", "nurse"]:
        raise HTTPException(status_code=403, detail="You don't have permission to create accounts")

    # Check if email already exists
    if users_collection.find_one({"email": request.email}):
        raise HTTPException(status_code=409, detail="Email already registered")

    # For patients: use phone number as password, else fallback
    if request.role == "patient" and request.phone:
        raw_password = request.phone
    else:
        raw_password = request.password or "patient123"

    user_doc = {
        "name": request.name,
        "email": request.email,
        "password": _hash_password(raw_password),
        "role": request.role,
        "department": request.department or "",
        "created_at": datetime.utcnow().isoformat(),
        "created_by": current_user["email"],
    }
    # Store patient-specific fields
    if request.phone:
        user_doc["phone"] = request.phone
    if request.assigned_doctor:
        user_doc["assigned_doctor"] = request.assigned_doctor
    if request.assigned_doctor_name:
        user_doc["assigned_doctor_name"] = request.assigned_doctor_name
    if request.issue:
        user_doc["issue"] = request.issue

    result = users_collection.insert_one(user_doc)

    # Create notification for assigned doctor
    if request.assigned_doctor and notifications_collection is not None:
        issue_text = f" — Issue: {request.issue}" if request.issue else ""
        notifications_collection.insert_one({
            "doctor_email": request.assigned_doctor,
            "doctor_name": request.assigned_doctor_name or "",
            "type": "new_patient",
            "title": "New Patient Assigned",
            "message": f"{request.name} has been assigned to you by {current_user.get('name', current_user['email'])} ({request.department or 'General'}){issue_text}",
            "patient_name": request.name,
            "patient_email": request.email,
            "department": request.department or "",
            "issue": request.issue or "",
            "assigned_by": current_user["email"],
            "assigned_by_name": current_user.get("name", ""),
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
        })

    return {
        "message": f"{request.role.capitalize()} account created",
        "user": {
            "id": str(result.inserted_id),
            "name": request.name,
            "email": request.email,
            "role": request.role,
            "department": request.department,
            "assigned_doctor": request.assigned_doctor,
            "assigned_doctor_name": request.assigned_doctor_name,
            "issue": request.issue,
        }
    }


# ---------- OTP Generation & Verification ----------
def _generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP."""
    return "".join(random.choices(string.digits, k=length))


@router.post("/otp/generate")
def generate_otp(email: str, name: str, current_user: dict = Depends(_get_current_user)):
    """Generate an OTP for patient email verification. Called by nurse/doctor/admin."""
    from mongo import otp_col

    if otp_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    if current_user["role"] not in ["admin", "doctor", "nurse"]:
        raise HTTPException(status_code=403, detail="Only staff can generate OTPs")

    otp_code = _generate_otp()

    # Upsert: one active OTP per email
    otp_col.update_one(
        {"email": email},
        {"$set": {
            "email": email,
            "name": name,
            "otp": otp_code,
            "verified": False,
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": (datetime.utcnow() + timedelta(minutes=10)).isoformat(),
            "generated_by": current_user["email"],
        }},
        upsert=True,
    )

    return {
        "message": "OTP generated",
        "otp_code": otp_code,
        "email": email,
        "expires_in_minutes": 10,
    }


@router.post("/otp/verify")
def verify_otp(request: OTPVerifyRequest, current_user: dict = Depends(_get_current_user)):
    """Verify an OTP entered by the nurse for a patient's email."""
    from mongo import otp_col

    if otp_col is None:
        raise HTTPException(status_code=503, detail="Database not available")

    if current_user["role"] not in ["admin", "doctor", "nurse"]:
        raise HTTPException(status_code=403, detail="Only staff can verify OTPs")

    record = otp_col.find_one({"email": request.email, "verified": False})
    if not record:
        raise HTTPException(status_code=404, detail="No pending OTP found for this email")

    # Check expiry
    expires_at = datetime.fromisoformat(record["expires_at"])
    if datetime.utcnow() > expires_at:
        raise HTTPException(status_code=410, detail="OTP has expired. Please generate a new one.")

    # Verify OTP
    if record["otp"] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    # Mark as verified
    otp_col.update_one(
        {"email": request.email},
        {"$set": {"verified": True, "verified_at": datetime.utcnow().isoformat()}}
    )

    return {"message": "Email verified successfully", "email": request.email}


@router.get("/users")
def list_users(current_user: dict = Depends(_get_current_user)):
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not available")

    # Only admin can list all users; doctors/nurses see limited view
    if current_user["role"] not in ["admin", "doctor", "nurse"]:
        raise HTTPException(status_code=403, detail="Access denied")

    query = {}
    if current_user["role"] == "doctor":
        query = {"role": {"$in": ["patient"]}, "department": current_user.get("department", "")}
    elif current_user["role"] == "nurse":
        query = {"role": "patient", "department": current_user.get("department", "")}

    users = users_collection.find(query, {"password": 0})  # Exclude passwords
    result = []
    for u in users:
        result.append({
            "id": str(u["_id"]),
            "name": u["name"],
            "email": u["email"],
            "role": u["role"],
            "department": u.get("department", ""),
            "created_at": u.get("created_at", ""),
            "created_by": u.get("created_by", ""),
            "staff_id": u.get("staff_id"),
            "shift_hours": u.get("shift_hours"),
            "cases_handled": u.get("cases_handled"),
            "overtime_hours": u.get("overtime_hours"),
        })

    return {"users": result, "total": len(result)}

@router.get("/doctor-list")
def list_doctors(department: Optional[str] = None):
    """List doctors, optionally filtered by department."""
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not available")

    query = {"role": "doctor"}
    if department:
        query["department"] = department

    docs = users_collection.find(query, {"password": 0}).sort("name", 1)
    return {
        "doctors": [
            {
                "id": str(d["_id"]),
                "name": d["name"],
                "email": d["email"],
                "department": d.get("department", ""),
            }
            for d in docs
        ]
    }

@router.get("/notifications")
def get_notifications(doctor_email: str, unread_only: bool = False):
    """Get notifications for a doctor."""
    if notifications_collection is None:
        return {"notifications": []}

    query = {"doctor_email": doctor_email}
    if unread_only:
        query["read"] = False

    results = notifications_collection.find(query).sort("created_at", -1).limit(50)
    return {
        "notifications": [
            {
                "id": str(n["_id"]),
                "type": n.get("type", ""),
                "title": n.get("title", ""),
                "message": n.get("message", ""),
                "patient_name": n.get("patient_name", ""),
                "patient_email": n.get("patient_email", ""),
                "department": n.get("department", ""),
                "assigned_by_name": n.get("assigned_by_name", ""),
                "read": n.get("read", False),
                "created_at": n.get("created_at", ""),
            }
            for n in results
        ]
    }

@router.put("/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str):
    """Mark a notification as read."""
    if notifications_collection is None:
        raise HTTPException(status_code=503, detail="Database not available")
    if not ObjectId.is_valid(notif_id):
        raise HTTPException(status_code=400, detail="Invalid notification id")
    notifications_collection.update_one(
        {"_id": ObjectId(notif_id)},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

@router.delete("/users/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(_get_current_user)):
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not available")

    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete users")

    result = users_collection.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User deleted"}

@router.get("/me")
def get_me(current_user: dict = Depends(_get_current_user)):
    return current_user

# Manual seed (comment out if not needed)
# seed_users_from_staff()
