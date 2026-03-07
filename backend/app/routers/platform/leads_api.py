"""
Leads API - Lead Generation & Tracking

Captures and tracks signups, demo requests, and contact form submissions.
Sends email notifications to sales team.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
import json
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

router = APIRouter(prefix="/api/leads", tags=["Leads"])

# ============================================================================
# MODELS
# ============================================================================

class LeadCreate(BaseModel):
    """Lead capture model"""
    email: EmailStr
    name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    source: str = "signup"  # signup, contact, demo, pricing
    message: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    page_url: Optional[str] = None

class Lead(LeadCreate):
    """Lead with metadata"""
    id: str
    created_at: str
    status: str = "new"  # new, contacted, qualified, converted, closed

class LeadStats(BaseModel):
    """Lead statistics"""
    total: int
    new: int
    contacted: int
    qualified: int
    converted: int
    by_source: dict
    by_date: dict

# ============================================================================
# STORAGE (Simple JSON file - upgrade to database for production)
# ============================================================================

LEADS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "leads.json")

def ensure_leads_file():
    """Ensure leads file and directory exist"""
    os.makedirs(os.path.dirname(LEADS_FILE), exist_ok=True)
    if not os.path.exists(LEADS_FILE):
        with open(LEADS_FILE, 'w') as f:
            json.dump([], f)

def load_leads() -> List[dict]:
    """Load leads from file"""
    ensure_leads_file()
    try:
        with open(LEADS_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_leads(leads: List[dict]):
    """Save leads to file"""
    ensure_leads_file()
    with open(LEADS_FILE, 'w') as f:
        json.dump(leads, f, indent=2, default=str)

# ============================================================================
# EMAIL NOTIFICATION
# ============================================================================

# Configuration - Set these environment variables
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
NOTIFICATION_EMAIL = os.getenv("LEAD_NOTIFICATION_EMAIL", "sales@flowstral.com")

def send_lead_notification(lead: dict):
    """Send email notification for new lead"""
    
    # Skip if SMTP not configured
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[Leads] SMTP not configured - skipping email for lead: {lead['email']}")
        return False
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"🎯 New Lead: {lead.get('name', 'Unknown')} from {lead.get('company', 'Unknown Company')}"
        msg['From'] = SMTP_USER
        msg['To'] = NOTIFICATION_EMAIL
        
        # Plain text version
        text = f"""
New Lead Captured!
==================

Name: {lead.get('name', 'Not provided')}
Email: {lead['email']}
Company: {lead.get('company', 'Not provided')}
Phone: {lead.get('phone', 'Not provided')}
Source: {lead.get('source', 'Unknown')}
Page: {lead.get('page_url', 'Unknown')}

Message:
{lead.get('message', 'No message')}

UTM Source: {lead.get('utm_source', '-')}
UTM Medium: {lead.get('utm_medium', '-')}
UTM Campaign: {lead.get('utm_campaign', '-')}

Time: {lead.get('created_at', 'Unknown')}

---
Reply directly to this email or contact: {lead['email']}
"""

        # HTML version
        html = f"""
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 20px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0;">🎯 New Lead!</h1>
    </div>
    <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 120px;">Name</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{lead.get('name', 'Not provided')}</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Email</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <a href="mailto:{lead['email']}" style="color: #3b82f6;">{lead['email']}</a>
                </td>
            </tr>
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Company</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{lead.get('company', 'Not provided')}</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Phone</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">{lead.get('phone', 'Not provided')}</td>
            </tr>
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Source</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="background: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                        {lead.get('source', 'Unknown').upper()}
                    </span>
                </td>
            </tr>
        </table>
        
        {f'<div style="margin-top: 20px; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid #3b82f6;"><strong>Message:</strong><br/>{lead.get("message", "")}</div>' if lead.get('message') else ''}
        
        <div style="margin-top: 20px; text-align: center;">
            <a href="mailto:{lead['email']}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                Reply to Lead
            </a>
        </div>
        
        <div style="margin-top: 20px; padding: 10px; background: #f1f5f9; border-radius: 8px; font-size: 12px; color: #64748b;">
            <strong>Tracking:</strong> UTM Source: {lead.get('utm_source', '-')} | Medium: {lead.get('utm_medium', '-')} | Campaign: {lead.get('utm_campaign', '-')}
        </div>
    </div>
</body>
</html>
"""
        
        msg.attach(MIMEText(text, 'plain'))
        msg.attach(MIMEText(html, 'html'))
        
        # Send email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        print(f"[Leads] ✅ Email notification sent for lead: {lead['email']}")
        return True
        
    except Exception as e:
        print(f"[Leads] ❌ Failed to send notification: {str(e)}")
        return False

# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.post("/capture", response_model=dict)
async def capture_lead(lead: LeadCreate):
    """
    Capture a new lead from signup, contact form, or demo request.
    Sends email notification to sales team.
    """
    try:
        # Load existing leads
        leads = load_leads()
        
        # Check for duplicate (same email within 24 hours)
        recent_emails = [l['email'] for l in leads if l.get('email') == lead.email]
        
        # Create lead record
        lead_dict = lead.dict()
        lead_dict['id'] = f"lead_{len(leads) + 1}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        lead_dict['created_at'] = datetime.now().isoformat()
        lead_dict['status'] = 'new'
        
        # Save lead
        leads.append(lead_dict)
        save_leads(leads)
        
        # Send email notification (async in background ideally)
        email_sent = send_lead_notification(lead_dict)
        
        print(f"[Leads] ✅ New lead captured: {lead.email} (source: {lead.source})")
        
        return {
            "success": True,
            "message": "Lead captured successfully",
            "lead_id": lead_dict['id'],
            "notification_sent": email_sent
        }
        
    except Exception as e:
        import logging as _logging
        _logging.getLogger(__name__).error(f"Failed to capture lead: {e}")
        raise HTTPException(status_code=500, detail="Failed to capture lead")

@router.get("/list", response_model=List[dict])
async def list_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 100
):
    """List all leads with optional filtering"""
    leads = load_leads()
    
    # Filter by status
    if status:
        leads = [l for l in leads if l.get('status') == status]
    
    # Filter by source
    if source:
        leads = [l for l in leads if l.get('source') == source]
    
    # Sort by date (newest first)
    leads = sorted(leads, key=lambda x: x.get('created_at', ''), reverse=True)
    
    # Limit results
    return leads[:limit]

@router.get("/stats", response_model=LeadStats)
async def get_lead_stats():
    """Get lead statistics"""
    leads = load_leads()
    
    # Count by status
    status_counts = {
        'new': len([l for l in leads if l.get('status') == 'new']),
        'contacted': len([l for l in leads if l.get('status') == 'contacted']),
        'qualified': len([l for l in leads if l.get('status') == 'qualified']),
        'converted': len([l for l in leads if l.get('status') == 'converted'])
    }
    
    # Count by source
    by_source = {}
    for lead in leads:
        source = lead.get('source', 'unknown')
        by_source[source] = by_source.get(source, 0) + 1
    
    # Count by date (last 30 days)
    by_date = {}
    for lead in leads:
        date = lead.get('created_at', '')[:10]  # Get YYYY-MM-DD
        if date:
            by_date[date] = by_date.get(date, 0) + 1
    
    return LeadStats(
        total=len(leads),
        new=status_counts['new'],
        contacted=status_counts['contacted'],
        qualified=status_counts['qualified'],
        converted=status_counts['converted'],
        by_source=by_source,
        by_date=by_date
    )

@router.patch("/{lead_id}/status")
async def update_lead_status(lead_id: str, status: str):
    """Update lead status"""
    valid_statuses = ['new', 'contacted', 'qualified', 'converted', 'closed']
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    leads = load_leads()
    
    for lead in leads:
        if lead.get('id') == lead_id:
            lead['status'] = status
            lead['updated_at'] = datetime.now().isoformat()
            save_leads(leads)
            return {"success": True, "message": f"Lead status updated to {status}"}
    
    raise HTTPException(status_code=404, detail="Lead not found")

@router.get("/{lead_id}")
async def get_lead(lead_id: str):
    """Get a specific lead by ID"""
    leads = load_leads()
    
    for lead in leads:
        if lead.get('id') == lead_id:
            return lead
    
    raise HTTPException(status_code=404, detail="Lead not found")

@router.delete("/{lead_id}")
async def delete_lead(lead_id: str):
    """Delete a lead"""
    leads = load_leads()
    
    initial_count = len(leads)
    leads = [l for l in leads if l.get('id') != lead_id]
    
    if len(leads) == initial_count:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    save_leads(leads)
    return {"success": True, "message": "Lead deleted"}
