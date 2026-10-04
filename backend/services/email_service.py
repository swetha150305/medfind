import os
import smtplib
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

        server = smtplib.SMTP(smtp_host, smtp_port)
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

