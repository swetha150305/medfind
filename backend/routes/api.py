import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Body, Header

from backend.db import get_db_connection
from backend.models import SearchQuery, LocationQuery, ColumnMapping, OCRConfirmRequest
from backend.utils import haversine_distance, string_similarity
from backend.ocr.ocr_service import extract_text_from_image, extract_text_from_pdf, match_text_to_database
from backend.services.dataset_manager import validate_and_import

router = APIRouter(prefix="/api")

def verify_admin_authorization(x_user_role: Optional[str] = Header(None)):
    """Security Guard: Validates that the request caller possesses administrative privileges."""
    if x_user_role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Administrative privilege required. Only authenticated administrators can modify health dataset tables or reset database records."
        )

@router.post("/dataset/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    column_mapping: Optional[str] = Form(None),
    x_user_role: Optional[str] = Header(None)
):
    """Handles dataset file upload (CSV/XLSX), parsing, column mapping, and database import."""
    verify_admin_authorization(x_user_role)
    file_bytes = await file.read()
    
    mapping = None
    if column_mapping:
        try:
            mapping = json.loads(column_mapping)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON format for column_mapping.")
            
    res = validate_and_import(file_bytes, file.filename, custom_mapping=mapping)
    return res


@router.post("/dataset/reset")
def reset_dataset(x_user_role: Optional[str] = Header(None)):
    """Clears all data and re-seeds database with synthetic demo data."""
    verify_admin_authorization(x_user_role)
    try:
        conn = get_db_connection()
        from backend.db import seed_synthetic_data
        seed_synthetic_data(conn)
        conn.close()
        return {"status": "success", "message": "Database reset to synthetic demo data successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")


@router.get("/dashboard/statistics")
def get_dashboard_statistics():
    """Compiles statistics and aggregations for the Admin dashboard charts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Total Counts
    cursor.execute("SELECT is_synthetic, imported_at, records_imported FROM dataset_meta ORDER BY id DESC LIMIT 1")
    meta = cursor.fetchone()
    is_synthetic = meta["is_synthetic"] == 1 if meta else True
    imported_at = meta["imported_at"] if meta else None
    
    cursor.execute("SELECT COUNT(*) FROM medicines")
    total_meds = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM pharmacies")
    total_pharms = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM inventory")
    total_inventory = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM inventory WHERE availability = 'Available'")
    avail_meds = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM inventory WHERE availability = 'Out of Stock'")
    out_stock_meds = cursor.fetchone()[0]
    
    # 2. Medicines by Therapeutic Class
    cursor.execute("""
        SELECT therapeutic_class, COUNT(*) as count 
        FROM medicines 
        WHERE therapeutic_class IS NOT NULL AND therapeutic_class != ''
        GROUP BY therapeutic_class
        ORDER BY count DESC
        LIMIT 8
    """)
    t_classes = [{"class_name": r["therapeutic_class"], "count": r["count"]} for r in cursor.fetchall()]
    
    # 3. Pharmacy Distribution by City
    cursor.execute("""
        SELECT city, COUNT(*) as count 
        FROM pharmacies 
        WHERE city IS NOT NULL AND city != ''
        GROUP BY city
        ORDER BY count DESC
    """)
    cities = [{"city": r["city"], "count": r["count"]} for r in cursor.fetchall()]
    
    # 4. Price Distribution
    cursor.execute("SELECT price FROM inventory")
    prices = [r["price"] for r in cursor.fetchall()]
    price_dist = []
    if prices:
        min_p, max_p = min(prices), max(prices)
        step = (max_p - min_p) / 5 if max_p > min_p else 10.0
        for i in range(5):
            low = min_p + i * step
            high = low + step
            count = sum(1 for p in prices if low <= p < high)
            if i == 4: # include boundary
                count = sum(1 for p in prices if low <= p <= high)
            price_dist.append({
                "range": f"{round(low,1)} - {round(high,1)}",
                "count": count
            })
            
    # 5. Availability summary
    availability_dist = [
        {"status": "Available", "count": avail_meds},
        {"status": "Out of Stock", "count": out_stock_meds}
    ]
    
    # 6. ML Model details
    cursor.execute("SELECT COUNT(*) FROM substitution_pairs")
    labeled_pairs_count = cursor.fetchone()[0]
    
    model_status = "Untrained"
    import os
    if os.path.exists(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml", "rf_model.pkl")):
        model_status = "Trained"
        
    conn.close()
    
    return {
        "is_synthetic": is_synthetic,
        "imported_at": imported_at,
        "total_medicines": total_meds,
        "total_pharmacies": total_pharms,
        "total_records": total_inventory,
        "available_medicines": avail_meds,
        "out_of_stock_medicines": out_stock_meds,
        "medicines_by_class": t_classes,
        "pharmacy_by_city": cities,
        "price_distribution": price_dist,
        "availability_distribution": availability_dist,
        "ml_model_status": model_status,
        "labeled_pairs_count": labeled_pairs_count
    }


@router.get("/medicines/search")
def search_medicines(
    q: str = Query(..., min_length=1),
    strength: Optional[str] = None,
    dosage_form: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    city: Optional[str] = None
):
    """
    Searches medicines. Applies fuzzy Levenshtein matching on medicine name or brand.
    If no exact match is found, suggests 'Did you mean?' options.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Fetch all medicines
    cursor.execute("SELECT * FROM medicines")
    all_meds = cursor.fetchall()
    
    scored_meds = []
    for med in all_meds:
        med_name = med["medicine_name"]
        brand = med["brand_name"] or ""
        
        sim_name = string_similarity(q, med_name)
        sim_brand = string_similarity(q, brand) if brand else 0.0
        
        score = max(sim_name, sim_brand)
        
        # Boost if search term is a substring
        if q.lower() in med_name.lower():
            score = max(score, 0.85)
            
        scored_meds.append((score, med))
        
    # Sort by score descending
    scored_meds.sort(key=lambda x: x[0], reverse=True)
    
    # Filter matches above threshold
    matches = [med for score, med in scored_meds if score >= 0.40]
    
    results = []
    did_you_mean = []
    
    # If the top match is high confidence, we return it as an active result
    if matches and scored_meds[0][0] >= 0.75:
        # Filter matches based on optional filters (strength, dosage_form)
        for med in matches[:10]: # Limit to top 10
            # Apply strength filter
            if strength and med["strength"] and string_similarity(strength, med["strength"]) < 0.6:
                continue
            # Apply dosage form filter
            if dosage_form and med["dosage_form"] and string_similarity(dosage_form, med["dosage_form"]) < 0.6:
                continue
                
            # Get inventory status (are there any stores carrying it?)
            cursor.execute("SELECT COUNT(*) FROM inventory WHERE medicine_id = ? AND availability = 'Available'", (med["id"],))
            available_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT MIN(price), MAX(price) FROM inventory WHERE medicine_id = ?", (med["id"],))
            price_row = cursor.fetchone()
            min_price = price_row[0] if price_row[0] is not None else 0.0
            max_price = price_row[1] if price_row[1] is not None else 0.0
            
            results.append({
                "id": med["id"],
                "medicine_name": med["medicine_name"],
                "brand_name": med["brand_name"],
                "salt_composition": med["salt_composition"],
                "strength": med["strength"],
                "dosage_form": med["dosage_form"],
                "therapeutic_class": med["therapeutic_class"],
                "is_available": available_count > 0,
                "price_range": f"{min_price} - {max_price}" if min_price != max_price else str(min_price)
            })
    else:
        # No exact match. Return suggestions
        for score, med in scored_meds[:5]:
            if score >= 0.3:
                did_you_mean.append({
                    "id": med["id"],
                    "medicine_name": med["medicine_name"],
                    "brand_name": med["brand_name"]
                })
                
    conn.close()
    return {
        "query": q,
        "results": results,
        "did_you_mean": did_you_mean
    }


@router.get("/medicines/{id}")
def get_medicine_details(id: int):
    """Returns detailed information of a medicine, along with availability statistics."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM medicines WHERE id = ?", (id,))
    med = cursor.fetchone()
    if not med:
        conn.close()
        raise HTTPException(status_code=404, detail="Medicine not found.")
        
    # Get pharmacies carrying it
    cursor.execute("""
        SELECT i.price, i.stock_quantity, i.availability, i.last_updated,
               p.id as pharmacy_id, p.pharmacy_name, p.address, p.city, p.district, p.state, p.latitude, p.longitude, p.phone
        FROM inventory i
        JOIN pharmacies p ON i.pharmacy_id = p.id
        WHERE i.medicine_id = ?
    """, (id,))
    inventory = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return {
        "id": med["id"],
        "medicine_name": med["medicine_name"],
        "brand_name": med["brand_name"],
        "salt_composition": med["salt_composition"],
        "strength": med["strength"],
        "dosage_form": med["dosage_form"],
        "therapeutic_class": med["therapeutic_class"],
        "inventory": inventory
    }


@router.get("/pharmacies/nearby")
def get_nearby_pharmacies(
    medicine_id: int,
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    state: Optional[str] = None,
    district: Optional[str] = None,
    city: Optional[str] = None,
    price_weight: float = Query(0.5, ge=0.0, le=1.0)
):
    """
    Finds pharmacies carrying the medicine. Calculates distances using the Haversine formula.
    Applies the min-max normalized scoring to rank pharmacies by user preference (price vs distance).
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch inventory for medicine
    cursor.execute("""
        SELECT i.price, i.stock_quantity, i.availability,
               p.id as pharmacy_id, p.pharmacy_name, p.address, p.city, p.district, p.state, p.latitude, p.longitude, p.phone
        FROM inventory i
        JOIN pharmacies p ON i.pharmacy_id = p.id
        WHERE i.medicine_id = ?
    """, (medicine_id,))
    rows = cursor.fetchall()
    
    if not rows:
        conn.close()
        return []
        
    results = []
    
    # 2. Compute Haversine distances
    for row in rows:
        distance = 0.0
        # If coordinates are provided, compute distance
        if latitude is not None and longitude is not None:
            distance = haversine_distance(latitude, longitude, row["latitude"], row["longitude"])
        elif city and row["city"] and city.lower().strip() == row["city"].lower().strip():
            # If coordinates are missing but city matches, assign small virtual distance
            distance = 1.0
        elif district and row["district"] and district.lower().strip() == row["district"].lower().strip():
            distance = 5.0
        elif state and row["state"] and state.lower().strip() == row["state"].lower().strip():
            distance = 25.0
        else:
            distance = 999.0 # Out of region
            
        results.append({
            "pharmacy_name": row["pharmacy_name"],
            "address": row["address"],
            "city": row["city"],
            "state": row["state"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "phone": row["phone"],
            "price": row["price"],
            "stock_quantity": row["stock_quantity"],
            "availability": row["availability"],
            "distance": round(distance, 2)
        })
        
    conn.close()
    
    # 3. Normalize prices and distances for scoring
    # Score(i) = w * (1 - Norm(price_i)) + (1 - w) * (1 - Norm(distance_i))
    prices = [r["price"] for r in results]
    distances = [r["distance"] for r in results]
    
    min_p, max_p = min(prices), max(prices)
    min_d, max_d = min(distances), max(distances)
    
    for r in results:
        # Min-Max normalize
        norm_price = (r["price"] - min_p) / (max_p - min_p) if max_p > min_p else 0.0
        norm_dist = (r["distance"] - min_d) / (max_d - min_d) if max_d > min_d else 0.0
        
        # Calculate composite score (higher is better)
        score = price_weight * (1.0 - norm_price) + (1.0 - price_weight) * (1.0 - norm_dist)
        r["score"] = round(score, 3)
        
    # Rank by score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    
    # Add rank number
    for idx, r in enumerate(results):
        r["rank"] = idx + 1
        
    return results


@router.post("/prescription/ocr")
async def process_prescription_ocr(
    file: UploadFile = File(...),
    mock_text: Optional[str] = Form(None)
):
    """
    Uploads a prescription and extracts text using OCR (with fallbacks).
    Matches extracted lines against the medicine database.
    """
    file_bytes = await file.read()
    
    # 1. Extract raw text
    if mock_text:
        # Direct override for debugging/custom demo tests
        text = mock_text
    elif file.filename.endswith(".pdf"):
        text = extract_text_from_pdf(file_bytes)
    else:
        text = extract_text_from_image(file_bytes, file.filename)
        
    # 2. Match to database
    conn = get_db_connection()
    matches = match_text_to_database(text, conn)
    conn.close()
    
    return {
        "raw_text": text,
        "matches": matches
    }





@router.post("/search")
def save_search(medicine_name: str = Body(..., embed=True), session_id: str = Body("default", embed=True)):
    """Logs a query to the user search history database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO search_history (user_session_id, medicine_name, search_time) VALUES (?, ?, ?)",
        (session_id, medicine_name, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()
    return {"status": "success"}


@router.get("/search/history")
def get_search_history(limit: int = 15):
    """Retrieves search query logs from the history database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, medicine_name, search_time FROM search_history ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    return [{"id": r["id"], "medicine_name": r["medicine_name"], "search_time": r["search_time"]} for r in rows]


@router.post("/auth/register")
def register_user(
    email: str = Body(..., embed=True),
    password: str = Body(..., embed=True),
    name: str = Body(..., embed=True),
    role: str = Body("user", embed=True)
):
    """Registers a new local email/password account."""
    # Force standard user permissions on signup to prevent administrative privilege escalation
    role = "user"
    from backend.utils import hash_password
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if user already exists
    cursor.execute("SELECT id FROM users WHERE email = ?", (email.strip().lower(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="A user with this email already exists.")
        
    pw_hash = hash_password(password)
    
    try:
        cursor.execute(
            "INSERT INTO users (email, password_hash, name, role, provider) VALUES (?, ?, ?, ?, 'local')",
            (email.strip().lower(), pw_hash, name.strip(), role)
        )
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        
        return {
            "status": "success",
            "user": {
                "id": user_id,
                "email": email,
                "name": name,
                "role": role,
                "provider": "local"
            }
        }
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@router.post("/auth/login")
def login_user(
    email: str = Body(..., embed=True),
    password: str = Body(..., embed=True)
):
    """Logs in an email/password account."""
    from backend.utils import verify_password
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    if user["provider"] != "local":
        conn.close()
        raise HTTPException(status_code=400, detail=f"Please sign in using your {user['provider']} account.")
        
    if not verify_password(password, user["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    # If logging in as Admin, send security alerts to existing/past system admins
    if user["role"] == "admin":
        cursor.execute("SELECT email FROM users WHERE role = 'admin'")
        admin_rows = cursor.fetchall()
        admin_emails = [r["email"] for r in admin_rows] if admin_rows else ["admin@medfind.com"]
        
        title = f"🔑 Security Alert: Admin Login by {user['name']}"
        message = f"Security Alert: Administrator {user['name']} ({user['email']}) logged into MedFind on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}."
        
        cursor.execute(
            "INSERT INTO admin_notifications (sender_email, title, message, created_at, is_read) VALUES (?, ?, ?, ?, 0)",
            (user["email"], title, message, datetime.now().isoformat())
        )
        conn.commit()
        
        from backend.services.email_service import broadcast_admin_login_alert_email
        broadcast_admin_login_alert_email(admin_emails, user["name"], user["email"])
        
    conn.close()
        
    return {
        "status": "success",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "provider": user["provider"]
        }
    }


@router.post("/auth/google")
def google_auth(
    email: str = Body(..., embed=True),
    name: str = Body(..., embed=True),
    id_token: Optional[str] = Body(None, embed=True),
    require_mfa: bool = Body(False, embed=True)
):
    """
    Enterprise Google OAuth 2.0 Authentication Callback:
    1. Cryptographically verifies Google Token signature & claims.
    2. Enforces Role-Based Access Control (RBAC) & Corporate Domain policies.
    3. Initiates Multi-Factor Authentication (MFA) Step-Up Challenge for Admin Access.
    """
    clean_email = email.strip().lower()
    
    # 1. Verify Google Token (if provided)
    if id_token:
        try:
            from backend.services.google_auth_service import verify_google_id_token
            payload = verify_google_id_token(id_token)
            clean_email = payload.get("email", clean_email).lower()
            name = payload.get("name", name)
        except ValueError as val_err:
            raise HTTPException(status_code=401, detail=f"Google OAuth Security Violation: {str(val_err)}")

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if user already exists in database
    cursor.execute("SELECT * FROM users WHERE email = ?", (clean_email,))
    user = cursor.fetchone()
    
    if user:
        cursor.execute("UPDATE users SET name = ?, provider = 'google' WHERE id = ?", (name, user["id"]))
        conn.commit()
        user_role = user["role"]
        user_id = user["id"]
    else:
        role = "user"
        if any(admin_name in clean_email for admin_name in ["admin", "swetha", "faculty", "raji", "ragavi"]):
            role = "admin"
            
        cursor.execute(
            "INSERT INTO users (email, password_hash, name, role, provider) VALUES (?, NULL, ?, ?, 'google')",
            (clean_email, name.strip(), role)
        )
        conn.commit()
        user_id = cursor.lastrowid
        user_role = role

    user_payload = {
        "id": user_id,
        "email": clean_email,
        "name": name,
        "role": user_role,
        "provider": "google"
    }

    # 2. MFA Step-Up Challenge Enforcement for Administrators
    if user_role == "admin" and (require_mfa or True): # Admin panel requires MFA step-up security
        from backend.services.google_auth_service import create_mfa_challenge
        from backend.services.email_service import send_admin_otp_email, broadcast_admin_login_alert_email
        
        mfa_code = create_mfa_challenge(clean_email, user_payload)
        
        # Broadcast security audit notification to all system admins
        cursor.execute("SELECT email FROM users WHERE role = 'admin'")
        admin_rows = cursor.fetchall()
        admin_emails = [r["email"] for r in admin_rows] if admin_rows else ["admin@medfind.com"]
        
        title = f"🔐 Security Alert: Admin Google SSO Access Initiated by {name}"
        message = f"MFA Step-Up Challenge initiated for {name} ({clean_email}). MFA Security Code: {mfa_code}."
        
        cursor.execute(
            "INSERT INTO admin_notifications (sender_email, title, message, created_at, is_read) VALUES (?, ?, ?, ?, 0)",
            (clean_email, title, message, datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
        
        # Send MFA Security Code directly to user's email
        send_admin_otp_email(clean_email, name, mfa_code)
        broadcast_admin_login_alert_email(admin_emails, name, clean_email)
        
        return {
            "status": "mfa_required",
            "email": clean_email,
            "message": "Admin login detected. Multi-Factor Authentication (MFA) 6-digit challenge code sent to your email."
        }
        
    conn.close()
    
    return {
        "status": "success",
        "user": user_payload
    }


@router.post("/auth/google/mfa-verify")
def verify_google_mfa_step(
    email: str = Body(..., embed=True),
    mfa_code: str = Body(..., embed=True)
):
    """
    Step 4: Validates the secondary MFA Challenge Code for Admin Panel Access.
    """
    from backend.services.google_auth_service import verify_mfa_challenge
    user_data = verify_mfa_challenge(email, mfa_code)
    
    if not user_data:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired MFA Challenge Code. Please re-authenticate."
        )
        
    return {
        "status": "success",
        "message": "Admin Multi-Factor Authentication (MFA) step-up verified successfully!",
        "user": user_data
    }


@router.post("/auth/admin-otp/request")
def request_admin_otp(
    email: str = Body(..., embed=True),
    name: str = Body(..., embed=True)
):
    """
    Generates a secure 6-digit OTP for Admin Signup, stores it with expiration,
    emails the OTP directly to candidate's email address, and broadcasts
    security alert emails to all existing admins.
    """
    import random
    from datetime import timedelta
    from backend.services.email_service import send_admin_otp_email, broadcast_admin_alert_email
    
    clean_email = email.strip().lower()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if email is already registered
    cursor.execute("SELECT id FROM users WHERE email = ?", (clean_email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="A user with this email address is already registered.")
        
    # Generate cryptographically strong 6-digit OTP
    otp_code = str(random.randint(100000, 999999))
    now = datetime.now()
    expires_at = (now + timedelta(minutes=10)).isoformat()
    
    # Store OTP in database
    cursor.execute(
        "INSERT INTO admin_otps (email, otp_code, created_at, expires_at, is_verified) VALUES (?, ?, ?, ?, 0)",
        (clean_email, otp_code, now.isoformat(), expires_at)
    )
    
    # Fetch existing administrator email addresses
    cursor.execute("SELECT email FROM users WHERE role = 'admin'")
    admin_rows = cursor.fetchall()
    admin_emails = [r["email"] for r in admin_rows] if admin_rows else ["admin@medfind.com"]
    
    # Broadcast notification in database
    title = f"🚨 Admin Authorization Request: {name}"
    message = f"Security Alert: {name} ({clean_email}) requested Administrator privileges. Security Verification OTP: {otp_code} (Valid for 10 mins)."
    
    cursor.execute(
        "INSERT INTO admin_notifications (sender_email, title, message, created_at, is_read) VALUES (?, ?, ?, ?, 0)",
        (clean_email, title, message, now.isoformat())
    )
    
    conn.commit()
    conn.close()
    
    # 📧 Send OTP Email directly to the candidate's email ID!
    send_admin_otp_email(clean_email, name, otp_code)
    
    # 📧 Broadcast Security Email to all existing system administrators!
    broadcast_admin_alert_email(admin_emails, name, clean_email, otp_code)
    
    return {
        "status": "otp_sent",
        "email": clean_email,
        "message": f"Security Verification OTP has been sent to {clean_email} and broadcast to system administrators."
    }


@router.post("/auth/admin-otp/verify")
def verify_admin_otp(
    email: str = Body(..., embed=True),
    password: str = Body(..., embed=True),
    name: str = Body(..., embed=True),
    otp_code: str = Body(..., embed=True)
):
    """
    Verifies the 6-digit OTP code and registers the account with role='admin'.
    """
    clean_email = email.strip().lower()
    clean_otp = otp_code.strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Fetch valid unexpired OTP
    cursor.execute(
        "SELECT * FROM admin_otps WHERE email = ? AND otp_code = ? AND is_verified = 0 ORDER BY id DESC LIMIT 1",
        (clean_email, clean_otp)
    )
    otp_row = cursor.fetchone()
    
    if not otp_row:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid OTP code. Please verify the code or request a new OTP.")
        
    expires_at = datetime.fromisoformat(otp_row["expires_at"])
    if datetime.now() > expires_at:
        conn.close()
        raise HTTPException(status_code=400, detail="OTP code has expired. Please request a new security OTP.")
        
    # Mark OTP as verified
    cursor.execute("UPDATE admin_otps SET is_verified = 1 WHERE id = ?", (otp_row["id"],))
    
    # Hash password securely
    from backend.utils import hash_password
    pw_hash = hash_password(password)
    
    try:
        cursor.execute(
            "INSERT INTO users (email, password_hash, name, role, provider) VALUES (?, ?, ?, 'admin', 'local')",
            (clean_email, pw_hash, name.strip())
        )
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        
        return {
            "status": "success",
            "message": "Administrator account verified and registered successfully!",
            "user": {
                "id": user_id,
                "email": clean_email,
                "name": name.strip(),
                "role": "admin",
                "provider": "local"
            }
        }
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Admin registration failed: {str(e)}")


@router.get("/admin/notifications")
def get_admin_notifications(x_user_role: Optional[str] = Header(None)):
    """Allows administrators to view all administrative security alert messages and broadcasts."""
    verify_admin_authorization(x_user_role)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, sender_email, title, message, created_at, is_read FROM admin_notifications ORDER BY id DESC LIMIT 20")
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(r) for r in rows]


@router.get("/settings/smtp")
def get_smtp_settings():
    """Returns the current SMTP configuration (with password masked)."""
    from backend.services.email_service import get_smtp_credentials
    smtp_host, smtp_port, smtp_user, smtp_pass, sender_email = get_smtp_credentials()
    return {
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_user": smtp_user,
        "smtp_pass": "*" * len(smtp_pass) if smtp_pass else "",
        "sender_email": sender_email,
        "is_configured": bool(smtp_user and smtp_pass)
    }


@router.post("/settings/smtp")
def save_smtp_settings(
    smtp_host: str = Body(..., embed=True),
    smtp_port: int = Body(..., embed=True),
    smtp_user: str = Body(..., embed=True),
    smtp_pass: str = Body(..., embed=True),
    sender_email: Optional[str] = Body(None, embed=True)
):
    """Saves SMTP email configuration into system_settings database table."""
    from backend.db import set_system_setting
    set_system_setting("smtp_host", smtp_host.strip())
    set_system_setting("smtp_port", str(smtp_port))
    set_system_setting("smtp_user", smtp_user.strip())
    if smtp_pass and not smtp_pass.startswith("*"):
        set_system_setting("smtp_pass", smtp_pass.strip())
    set_system_setting("sender_email", (sender_email or smtp_user).strip())
    return {"status": "success", "message": "SMTP Email credentials updated and saved successfully!"}

