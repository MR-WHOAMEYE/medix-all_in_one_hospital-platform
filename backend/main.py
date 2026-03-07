from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from routers import (
    dashboard, workload, sla, predictive, root_cause,
    digital_twin, simulation, optimization, sentiment,
    alerts, strategic, financial, assistant, reports, settings,
    auth, patient_api, doctor_api, nurse_api, admin_api, ward_api,
    response_suggestions, workflow, cdss
)

app = FastAPI(
    title="Hospital Operational Intelligence Platform",
    description="AI-Driven Hospital Operational Intelligence & Strategic Decision Platform",
    version="1.0.0",
)

# CORS — allow Vercel frontend + localhost dev
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")
origins = ALLOWED_ORIGINS.split(",") if ALLOWED_ORIGINS != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(dashboard.router)
app.include_router(workload.router)
app.include_router(sla.router)
app.include_router(predictive.router)
app.include_router(root_cause.router)
app.include_router(digital_twin.router)
app.include_router(simulation.router)
app.include_router(optimization.router)
app.include_router(sentiment.router)
app.include_router(alerts.router)
app.include_router(strategic.router)
app.include_router(financial.router)
app.include_router(assistant.router)
app.include_router(reports.router)
app.include_router(settings.router)
app.include_router(auth.router)
app.include_router(patient_api.router)
app.include_router(doctor_api.router)
app.include_router(nurse_api.router)
app.include_router(admin_api.router)
app.include_router(ward_api.router)
app.include_router(response_suggestions.router)
app.include_router(workflow.router)
app.include_router(cdss.router)


@app.get("/")
def root():
    return {"message": "Hospital Intelligence Platform API", "version": "1.0.0"}


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.on_event("startup")
async def preload_caches():
    """Preload caches for faster initial page loads."""
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    
    print("[STARTUP] Preloading caches...")
    
    # Preload nurse dashboard for common departments
    departments = ["Emergency", "Cardiology", "Orthopedics", "Pediatrics", "Neurology", "ICU"]
    
    def preload_nurse_dashboard():
        try:
            for dept in departments:
                nurse_api.nurse_dashboard(department=dept)
            print(f"[STARTUP] Nurse dashboard cache warmed for {len(departments)} departments")
        except Exception as e:
            print(f"[STARTUP] Nurse cache preload error: {e}")
    
    def preload_ward_data():
        try:
            ward_api.list_wards()
            print("[STARTUP] Ward data cache warmed")
        except Exception as e:
            print(f"[STARTUP] Ward cache preload error: {e}")
    
    def preload_admin_data():
        try:
            admin_api.admin_dashboard()
            admin_api.recent_prescriptions()
            admin_api.recent_diagnoses()
            admin_api.recent_vitals()
            admin_api.recent_bookings()
            admin_api.department_stats()
            print("[STARTUP] Admin dashboard cache warmed")
        except Exception as e:
            print(f"[STARTUP] Admin cache preload error: {e}")
    
    # Run preloads in thread pool to not block startup
    with ThreadPoolExecutor(max_workers=3) as executor:
        executor.submit(preload_nurse_dashboard)
        executor.submit(preload_ward_data)
        executor.submit(preload_admin_data)
    
    print("[STARTUP] Cache preloading initiated")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
