"""
Email Service — Transactional emails for Flowstral platform.

Sends verification, welcome, trial warning, and trial expired emails.
Reuses SMTP configuration pattern from leads_api.py.

Usage:
    from app.services.core.email_service import email_service

    await email_service.send_verification_email("user@example.com", "John", "token123")
    await email_service.send_welcome_email("user@example.com", "John", trial_end_date)
"""

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# Brand colors
_BRAND_GRADIENT = "linear-gradient(135deg, #06B6D4, #6366F1, #8B5CF6)"
_BRAND_PRIMARY = "#6366F1"
_BRAND_DARK = "#0B0E14"


class EmailService:
    """
    Transactional email service using SMTP.
    Uses the same env vars as leads_api.py for configuration.
    """

    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_name = os.getenv("EMAIL_FROM_NAME", "Flowstral")
        self.from_email = os.getenv("EMAIL_FROM_ADDRESS", "") or self.smtp_user
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")

    @property
    def is_configured(self) -> bool:
        """Check if SMTP credentials are set."""
        return bool(self.smtp_user and self.smtp_password)

    def _send_email(self, to: str, subject: str, html: str, text: str) -> bool:
        """Low-level SMTP send. Returns True on success."""
        if not self.is_configured:
            logger.warning(f"[Email] SMTP not configured — skipping email to {to}")
            return False

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to

            msg.attach(MIMEText(text, "plain"))
            msg.attach(MIMEText(html, "html"))

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            logger.info(f"[Email] Sent '{subject}' to {to}")
            return True

        except Exception as e:
            logger.error(f"[Email] Failed to send to {to}: {str(e)[:200]}")
            return False

    def _base_template(self, title: str, body_html: str) -> str:
        """Wrap body HTML in a consistent email template."""
        return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background: {_BRAND_DARK}; padding: 12px 24px; border-radius: 12px;">
        <span style="font-size: 20px; font-weight: 700; background: {_BRAND_GRADIENT}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Flowstral</span>
      </div>
    </div>

    <!-- Card -->
    <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h1 style="font-size: 22px; font-weight: 600; color: #18181b; margin: 0 0 16px 0;">{title}</h1>
      {body_html}
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #a1a1aa;">
      <p style="margin: 0;">Flowstral &mdash; Orchestrate End-to-End QA</p>
      <p style="margin: 4px 0 0 0;">
        <a href="{self.frontend_url}" style="color: #6366F1; text-decoration: none;">flowstral.com</a>
      </p>
    </div>
  </div>
</body>
</html>
"""

    # ==================== Verification Email ====================

    async def send_verification_email(self, email: str, name: str, token: str) -> bool:
        """Send email verification link after signup."""
        verify_url = f"{self.frontend_url}/verify-email?token={token}"
        first_name = name.split()[0] if name else "there"

        html = self._base_template(
            "Verify your email",
            f"""
            <p style="color: #52525b; line-height: 1.6; margin: 0 0 24px 0;">
              Hi {first_name},<br><br>
              Thanks for signing up for Flowstral! Please verify your email address
              to activate your account and start your <strong>14-day free trial</strong>.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="{verify_url}"
                 style="display: inline-block; background: {_BRAND_PRIMARY}; color: white;
                        padding: 14px 32px; border-radius: 8px; text-decoration: none;
                        font-weight: 600; font-size: 15px;">
                Verify Email Address
              </a>
            </div>
            <p style="color: #a1a1aa; font-size: 13px; margin: 24px 0 0 0;">
              This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
            </p>
            """,
        )

        text = (
            f"Hi {first_name},\n\n"
            f"Thanks for signing up for Flowstral! Verify your email here:\n{verify_url}\n\n"
            f"This link expires in 24 hours.\n\n— Flowstral"
        )

        return self._send_email(email, "Verify your Flowstral account", html, text)

    # ==================== Welcome Email ====================

    async def send_welcome_email(self, email: str, name: str, trial_end: datetime) -> bool:
        """Send welcome email after verification with trial info."""
        first_name = name.split()[0] if name else "there"
        trial_end_str = trial_end.strftime("%B %d, %Y")
        dashboard_url = f"{self.frontend_url}/dashboard"

        html = self._base_template(
            "Welcome to Flowstral!",
            f"""
            <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
              Hi {first_name},<br><br>
              Your email is verified and your <strong>14-day free trial</strong> is now active!
              You have full access to all features until <strong>{trial_end_str}</strong>.
            </p>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0; font-size: 14px; color: #166534;">
                <strong>Your trial includes:</strong><br>
                &bull; Up to 10 team members<br>
                &bull; 5,000 test runs per month<br>
                &bull; 5 projects<br>
                &bull; All features unlocked
              </p>
            </div>

            <h2 style="font-size: 16px; color: #18181b; margin: 24px 0 12px 0;">Quick start</h2>
            <ol style="color: #52525b; line-height: 1.8; padding-left: 20px; margin: 0 0 24px 0;">
              <li>Record your first test in the <strong>Recorder</strong></li>
              <li>Build test cases in the <strong>Test Builder</strong></li>
              <li>Run tests and view results in the <strong>Dashboard</strong></li>
            </ol>

            <div style="text-align: center; margin: 24px 0;">
              <a href="{dashboard_url}"
                 style="display: inline-block; background: {_BRAND_PRIMARY}; color: white;
                        padding: 14px 32px; border-radius: 8px; text-decoration: none;
                        font-weight: 600; font-size: 15px;">
                Go to Dashboard
              </a>
            </div>
            """,
        )

        text = (
            f"Hi {first_name},\n\n"
            f"Your email is verified and your 14-day free trial is active until {trial_end_str}.\n\n"
            f"Your trial includes:\n"
            f"- Up to 10 team members\n"
            f"- 5,000 test runs per month\n"
            f"- 5 projects\n"
            f"- All features unlocked\n\n"
            f"Get started: {dashboard_url}\n\n— Flowstral"
        )

        return self._send_email(email, "Welcome to Flowstral — Your trial is active!", html, text)

    # ==================== Trial Warning Email ====================

    async def send_trial_warning_email(self, email: str, name: str, days_remaining: int) -> bool:
        """Send trial expiring warning at 7d/3d/1d."""
        first_name = name.split()[0] if name else "there"
        pricing_url = f"{self.frontend_url}/pricing"

        day_text = "1 day" if days_remaining == 1 else f"{days_remaining} days"
        urgency_color = "#dc2626" if days_remaining <= 1 else "#f59e0b" if days_remaining <= 3 else "#3b82f6"

        html = self._base_template(
            f"Your trial ends in {day_text}",
            f"""
            <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
              Hi {first_name},<br><br>
              Your Flowstral trial ends in <strong style="color: {urgency_color};">{day_text}</strong>.
              After that, your account will switch to the Free plan with limited features.
            </p>

            <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Free plan limits:</strong> 3 users, 1,000 test runs/month, 1 project
              </p>
            </div>

            <p style="color: #52525b; line-height: 1.6; margin: 0 0 24px 0;">
              Upgrade to keep all your team members, test history, and advanced features.
            </p>

            <div style="text-align: center; margin: 24px 0;">
              <a href="{pricing_url}"
                 style="display: inline-block; background: {_BRAND_PRIMARY}; color: white;
                        padding: 14px 32px; border-radius: 8px; text-decoration: none;
                        font-weight: 600; font-size: 15px;">
                View Plans & Pricing
              </a>
            </div>
            """,
        )

        text = (
            f"Hi {first_name},\n\n"
            f"Your Flowstral trial ends in {day_text}. "
            f"After that, your account switches to the Free plan (3 users, 1,000 runs/month, 1 project).\n\n"
            f"Upgrade to keep all features: {pricing_url}\n\n— Flowstral"
        )

        subject = f"Your Flowstral trial ends in {day_text}" if days_remaining > 1 else "Your Flowstral trial ends tomorrow"
        return self._send_email(email, subject, html, text)

    # ==================== Trial Expired Email ====================

    async def send_trial_expired_email(self, email: str, name: str) -> bool:
        """Send trial expired notification."""
        first_name = name.split()[0] if name else "there"
        pricing_url = f"{self.frontend_url}/pricing"

        html = self._base_template(
            "Your trial has ended",
            f"""
            <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px 0;">
              Hi {first_name},<br><br>
              Your 14-day Flowstral trial has ended. Your account has been switched to
              the <strong>Free plan</strong>.
            </p>

            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0; font-size: 14px; color: #991b1b;">
                <strong>Free plan limits:</strong> 3 users, 1,000 test runs/month, 1 project.
                Additional team members will lose access.
              </p>
            </div>

            <p style="color: #52525b; line-height: 1.6; margin: 0 0 24px 0;">
              Your test cases, recordings, and data are preserved. Upgrade anytime
              to restore full access.
            </p>

            <div style="text-align: center; margin: 24px 0;">
              <a href="{pricing_url}"
                 style="display: inline-block; background: {_BRAND_PRIMARY}; color: white;
                        padding: 14px 32px; border-radius: 8px; text-decoration: none;
                        font-weight: 600; font-size: 15px;">
                Upgrade Now
              </a>
            </div>
            """,
        )

        text = (
            f"Hi {first_name},\n\n"
            f"Your 14-day Flowstral trial has ended. Your account has been switched to the Free plan "
            f"(3 users, 1,000 runs/month, 1 project).\n\n"
            f"Your data is preserved. Upgrade anytime: {pricing_url}\n\n— Flowstral"
        )

        return self._send_email(email, "Your Flowstral trial has ended", html, text)


# Singleton
email_service = EmailService()
