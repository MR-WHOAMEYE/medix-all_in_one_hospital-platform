"""
Stage 2: Knowledge Retrieval
Searches the knowledge base for relevant FAQ articles and fetches patient context.
"""
import re
from itertools import islice


def retrieve_knowledge(db_collections: dict, category: str, key_topics: list[str],
                       patient_email: str = "") -> dict:
    """
    Retrieve relevant knowledge and patient context.
    
    Args:
        db_collections: dict with MongoDB collection references
        category: classified query category
        key_topics: extracted topics from intent classification
        patient_email: patient's email for context lookup
    
    Returns:
        dict with 'articles', 'patient_context', 'sources'
    """
    knowledge_col = db_collections.get("knowledge_base")
    prescriptions_col = db_collections.get("prescriptions")
    bookings_col = db_collections.get("bookings")
    vitals_col = db_collections.get("vitals")

    articles: list[dict[str, object]] = []
    patient_context: dict[str, object] = {}
    sources: list[str] = []

    # ── Search knowledge base ──
    if knowledge_col is not None:
        # First: match by category
        category_matches = list(
            knowledge_col.find({"category": category}).limit(5)
        )
        for doc in category_matches:
            articles.append({
                "title": doc.get("title", ""),
                "content": doc.get("content", ""),
                "category": doc.get("category", ""),
                "tags": doc.get("tags", []),
            })
            sources.append(f"KB: {doc.get('title', 'Unknown')}")

        # Second: tag-based matching from key_topics
        if key_topics:
            tag_query = {"tags": {"$in": [t.lower() for t in key_topics]}}
            tag_matches = list(knowledge_col.find(tag_query).limit(3))
            seen_titles = {a["title"] for a in articles}
            for doc in tag_matches:
                title = doc.get("title", "")
                if title not in seen_titles:
                    articles.append({
                        "title": title,
                        "content": doc.get("content", ""),
                        "category": doc.get("category", ""),
                        "tags": doc.get("tags", []),
                    })
                    sources.append(f"KB: {title}")

    # ── Fetch patient context ──
    if patient_email:
        # Recent prescriptions
        if prescriptions_col is not None:
            recent_rx = list(
                prescriptions_col.find({"patient_email": patient_email})
                .sort("created_at", -1).limit(3)
            )
            if recent_rx:
                patient_context["recent_prescriptions"] = [
                    {
                        "medication": rx.get("medication", ""),
                        "dosage": rx.get("dosage", ""),
                        "status": rx.get("status", ""),
                        "doctor_name": rx.get("doctor_name", ""),
                    }
                    for rx in recent_rx
                ]
                sources.append("Patient prescriptions")

        # Recent bookings
        if bookings_col is not None:
            recent_bk = list(
                bookings_col.find({"patient_email": patient_email})
                .sort("created_at", -1).limit(3)
            )
            if recent_bk:
                patient_context["recent_bookings"] = [
                    {
                        "department": bk.get("department", ""),
                        "preferred_date": bk.get("preferred_date", ""),
                        "status": bk.get("status", ""),
                        "doctor_name": bk.get("doctor_name", ""),
                    }
                    for bk in recent_bk
                ]
                sources.append("Patient bookings")

        # Recent vitals
        if vitals_col is not None:
            recent_vitals = list(
                vitals_col.find({"patient_email": patient_email})
                .sort("recorded_at", -1).limit(1)
            )
            if recent_vitals:
                v = recent_vitals[0]
                patient_context["latest_vitals"] = {
                    "blood_pressure": v.get("blood_pressure", ""),
                    "heart_rate": v.get("heart_rate", ""),
                    "temperature": v.get("temperature", ""),
                    "recorded_at": v.get("recorded_at", ""),
                }
                sources.append("Patient vitals")

    return {
        "articles": list(islice(articles, 8)),  # Cap at 8 articles
        "patient_context": patient_context,
        "sources": sources,
    }
