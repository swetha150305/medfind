import os
import json
import smtplib
import urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional

# Automatically load environment variables from .env file if present
def _load_env_file():
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_file = os.path.join(root_dir, ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

_load_env_file()

# Dynamically retrieve SMTP configuration from database or environment variables
def get_smtp_credentials():
    from backend.db import get_system_setting
    smtp_host = get_system_setting("smtp_host", os.environ.get("SMTP_HOST", "smtp.gmail.com"))
    smtp_port_raw = get_system_setting("smtp_port", str(os.environ.get("SMTP_PORT", "587")))
    try:
        smtp_port = int(smtp_port_raw)
    except ValueError:
        smtp_port = 587
        
    smtp_user = get_system_setting("smtp_user", os.environ.get("SMTP_USER", ""))
    smtp_pass = get_system_setting("smtp_pass", os.environ.get("SMTP_PASS", ""))
    sender_email = get_system_setting("sender_email", os.environ.get("SENDER_EMAIL", smtp_user or "no-reply@medfind.com"))
    return smtp_host, smtp_port, smtp_user, smtp_pass, sender_email


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """
    Sends an HTML email using SMTP if credentials (SMTP_USER & SMTP_PASS) are set in UI/DB or .env.
    Falls back to terminal console logging if SMTP credentials are missing.
    """
    smtp_host, smtp_port, smtp_user, smtp_pass, sender_email = get_smtp_credentials()

    # Preferred on free hosts that block SMTP ports (e.g. Render free): Brevo's HTTPS API (port 443).
    brevo_key = os.environ.get("BREVO_API_KEY", "").strip()
    if brevo_key:
        try:
            payload = json.dumps({
                "sender": {"name": "MedFind", "email": os.environ.get("SENDER_EMAIL", sender_email)},
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": html_body,
            }).encode("utf-8")
            req = urllib.request.Request(
                "https://api.brevo.com/v3/smtp/email",
                data=payload,
                headers={"api-key": brevo_key, "content-type": "application/json", "accept": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                return 200 <= resp.status < 300
        except Exception as e:
            print(f"[EMAIL ERROR] Brevo API send failed for {to_email}: {e}")
            return False

    if not smtp_user or not smtp_pass:
        print(f"\n==================================================")
        print(f"[EMAIL SERVICE LOG] Sending simulated email to: {to_email}")
        print(f"Subject: {subject}")
        print(f"Body:\n{html_body}")
        print(f"==================================================\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender_email
        msg["To"] = to_email
        
        part = MIMEText(html_body, "html")
        msg.attach(part)

        server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(sender_email, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email via SMTP to {to_email}: {str(e)}")
        return False


def send_admin_otp_email(recipient_email: str, recipient_name: str, otp_code: str):
    """Emails the 6-digit Security OTP directly to the candidate administrator's email ID."""
    subject = "[SECURITY OTP] MedFind Admin Authorization Code"
    html_body = f"""
    <html>
        <body style="font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 30px; margin: 0;">
            <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 20px; padding: 30px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="display: inline-block; background: #4f46e5; color: white; padding: 12px 18px; border-radius: 14px; font-weight: 800; font-size: 18px;">
                        MedFind Security
                    </div>
                </div>
                <h2 style="color: #1e293b; font-size: 20px; font-weight: 800; margin-bottom: 8px;">Admin Registration Verification</h2>
                <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                    Hello <b>{recipient_name}</b>,<br>
                    You have requested Administrator registration for the <b>MedFind Healthcare System</b>. Please use the following Security OTP code to complete your registration:
                </p>
                <div style="background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #4f46e5;">{otp_code}</span>
                </div>
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-bottom: 0;">
                    This code is valid for 10 minutes. If you did not request this OTP, please ignore this message.
                </p>
            </div>
        </body>
    </html>
    """
    return send_email(recipient_email, subject, html_body)


def broadcast_admin_alert_email(admin_emails: List[str], new_admin_name: str, new_admin_email: str, otp_code: str):
    """Sends security notification emails to all existing system administrators."""
    subject = f"[SECURITY ALERT] New Admin Registration Requested by {new_admin_name}"
    html_body = f"""
    <html>
        <body style="font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 30px; margin: 0;">
            <div style="max-width: 550px; margin: 0 auto; background: white; border-radius: 20px; padding: 30px; border: 1px solid #e2e8f0;">
                <h2 style="color: #991b1b; font-size: 18px; font-weight: 800; margin-bottom: 12px;">[ALERT] Administrator Security Alert</h2>
                <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                    A new administrator registration has been initiated:
                </p>
                <ul style="color: #475569; font-size: 13px; line-height: 1.8; background: #f8fafc; padding: 15px 25px; border-radius: 12px;">
                    <li><b>Applicant Name:</b> {new_admin_name}</li>
                    <li><b>Applicant Email:</b> {new_admin_email}</li>
                    <li><b>Broadcasted Security OTP:</b> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold;">{otp_code}</code></li>
                </ul>
                <p style="color: #64748b; font-size: 12px;">
                    This email is logged for administrative audit compliance.
                </p>
            </div>
        </body>
    </html>
    """
    for admin_email in admin_emails:
        send_email(admin_email, subject, html_body)


def broadcast_admin_login_alert_email(admin_emails: List[str], logging_admin_name: str, logging_admin_email: str):
    """Sends security login notification emails to all existing/past system administrators when an admin logs in."""
    subject = f"[SECURITY ALERT] Admin Login Event: {logging_admin_name}"
    html_body = f"""
    <html>
        <body style="font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 30px; margin: 0;">
            <div style="max-width: 550px; margin: 0 auto; background: white; border-radius: 20px; padding: 30px; border: 1px solid #e2e8f0;">
                <h2 style="color: #4f46e5; font-size: 18px; font-weight: 800; margin-bottom: 12px;">[SECURITY NOTIFICATION] Administrator Session Login</h2>
                <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                    An administrator has logged into the MedFind portal:
                </p>
                <ul style="color: #475569; font-size: 13px; line-height: 1.8; background: #f8fafc; padding: 15px 25px; border-radius: 12px;">
                    <li><b>Administrator Name:</b> {logging_admin_name}</li>
                    <li><b>Email Address:</b> {logging_admin_email}</li>
                    <li><b>Event Type:</b> Authenticated Admin Login</li>
                </ul>
                <p style="color: #64748b; font-size: 12px;">
                    This notification has been sent to all registered system administrators for security compliance.
                </p>
            </div>
        </body>
    </html>
    """
    for admin_email in admin_emails:
        send_email(admin_email, subject, html_body)



def send_password_reset_email(recipient_email: str, recipient_name: str, reset_link: str) -> bool:
    """Emails a one-time password reset link (valid 30 minutes)."""
    subject = "Reset your MedFind password"
    safe_name = (recipient_name or "there").replace("<", "").replace(">", "")
    html_body = f"""
    <html>
      <body style="font-family: system-ui, -apple-system, sans-serif; background:#f8fafc; padding:30px; margin:0;">
        <div style="max-width:500px; margin:0 auto; background:white; border-radius:20px; padding:30px; border:1px solid #e2e8f0;">
          <h2 style="color:#0f172a; margin-top:0;">Reset your password</h2>
          <p style="color:#475569; font-size:14px;">Hi {safe_name}, we received a request to reset your MedFind password.
          Click the button below to choose a new one. This link works for <b>30 minutes</b> and only once.</p>
          <p style="text-align:center; margin:28px 0;">
            <a href="{reset_link}" style="background:#0d9488; color:white; padding:12px 24px; border-radius:12px; text-decoration:none; font-weight:700;">Reset password</a>
          </p>
          <p style="color:#94a3b8; font-size:12px;">If the button does not work, copy this link into your browser:<br>{reset_link}</p>
          <p style="color:#94a3b8; font-size:12px;">If you did not ask for this, you can ignore this email; your password will stay the same.</p>
        </div>
      </body>
    </html>
    """
    return send_email(recipient_email, subject, html_body)
