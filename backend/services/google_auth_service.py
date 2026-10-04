import os
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
ALLOWED_ADMIN_DOMAINS = os.environ.get("ALLOWED_ADMIN_DOMAINS", "velammal.edu.in,medfind.com,yourcompany.com").split(",")

# Store active MFA Step-Up Challenge tokens temporarily in memory
mfa_challenges: Dict[str, Dict[str, Any]] = {}

def is_admin_email(email: str) -> bool:
    """Only emails listed in the ADMIN_EMAILS environment variable may become admins via Google."""
    allowed = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]
    return email.strip().lower() in allowed


def verify_google_id_token(id_token: str) -> Dict[str, Any]:
    """
    Verifies a Google ID token with Google's tokeninfo endpoint.
    Checks audience (must equal our GOOGLE_CLIENT_ID), issuer and email verification.
    Any failure raises ValueError. There is NO offline fallback: an unverified token never logs anyone in.
    """
    if not id_token:
        raise ValueError("Google ID Token is missing.")
    if not GOOGLE_CLIENT_ID:
        raise ValueError("Google sign-in is not configured on this server.")

    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(id_token)}"
        req = urllib.request.Request(url, headers={"User-Agent": "MedFind-Server/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        raise ValueError("Google could not verify this sign-in. Please try again.")

    if payload.get("aud") != GOOGLE_CLIENT_ID:
        raise ValueError("This Google sign-in was issued for a different application.")
    if payload.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Invalid token issuer.")
    if payload.get("email_verified") not in [True, "true", "True", 1]:
        raise ValueError("Your Google email is not verified.")
    if not payload.get("email"):
        raise ValueError("Google did not return an email address.")

    payload["email"] = payload["email"].lower().strip()
    return payload


def create_mfa_challenge(email: str, user_data: Dict[str, Any]) -> str:
    """Generates a 6-digit MFA Step-Up Challenge code for Administrator Login Verification."""
    import random
    mfa_code = str(random.randint(100000, 999999))
    challenge_token = f"mfa_{os.urllib.parse.quote(email) if hasattr(os, 'urllib') else email}_{mfa_code}"
    
    expires_at = datetime.now() + timedelta(minutes=5)
    
    mfa_challenges[email] = {
        "mfa_code": mfa_code,
        "challenge_token": challenge_token,
        "user_data": user_data,
        "expires_at": expires_at
    }
    
    return mfa_code


def verify_mfa_challenge(email: str, mfa_code: str) -> Optional[Dict[str, Any]]:
    """Validates the 6-digit MFA Step-Up Challenge code for Admin session issue."""
    email_clean = email.strip().lower()
    challenge = mfa_challenges.get(email_clean)
    
    if not challenge:
        return None
        
    if datetime.now() > challenge["expires_at"]:
        del mfa_challenges[email_clean]
        return None
        
    if challenge["mfa_code"] == mfa_code.strip():
        user_data = challenge["user_data"]
        del mfa_challenges[email_clean]
        return user_data
        
    return None
