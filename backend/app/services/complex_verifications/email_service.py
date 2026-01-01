"""
Email Verification Service for ArisTrace QA Platform

Supports:
- Microsoft 365 / Outlook (via Microsoft Graph API)
- Gmail (via Gmail API)

Features:
- Wait for email arrival with configurable timeout
- Assert email subject, body, sender, recipients
- Extract verification links, OTP codes
- Check attachments
"""

import os
import re
import base64
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Literal
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class EmailProvider(str, Enum):
    MICROSOFT_365 = "microsoft_365"
    GMAIL = "gmail"


@dataclass
class EmailMessage:
    """Represents an email message"""
    id: str
    subject: str
    body_text: str
    body_html: str
    sender: str
    recipients: List[str]
    cc: List[str]
    received_at: datetime
    attachments: List[Dict[str, Any]]
    headers: Dict[str, str]
    
    def contains_text(self, text: str, case_sensitive: bool = False) -> bool:
        """Check if email body contains text"""
        body = self.body_text or self.body_html or ""
        if case_sensitive:
            return text in body
        return text.lower() in body.lower()
    
    def extract_links(self, pattern: Optional[str] = None) -> List[str]:
        """Extract links from email body"""
        # Default pattern matches common verification/reset links
        if pattern is None:
            pattern = r'https?://[^\s<>"\']+(?:verify|confirm|reset|activate|token|code)[^\s<>"\']*'
        
        body = self.body_html or self.body_text or ""
        # First try pattern
        links = re.findall(pattern, body, re.IGNORECASE)
        
        # If no matches, extract all links
        if not links:
            links = re.findall(r'https?://[^\s<>"\']+', body)
        
        return links
    
    def extract_otp(self, pattern: Optional[str] = None) -> Optional[str]:
        """Extract OTP/verification code from email"""
        if pattern is None:
            # Common OTP patterns: 4-8 digit codes
            pattern = r'\b(\d{4,8})\b'
        
        body = self.body_text or self.body_html or ""
        # Look for code near keywords
        code_contexts = [
            r'(?:code|otp|pin|verification|confirm)[:\s]*(\d{4,8})',
            r'(\d{4,8})[:\s]*(?:is your|code|otp|pin)',
            pattern
        ]
        
        for ctx_pattern in code_contexts:
            matches = re.findall(ctx_pattern, body, re.IGNORECASE)
            if matches:
                # Return the first match that looks like a code (not a year, etc.)
                for match in matches:
                    if len(match) >= 4 and not match.startswith('20'):  # Filter out years
                        return match
        
        return None


@dataclass 
class EmailVerificationResult:
    """Result of email verification"""
    success: bool
    message: str
    email: Optional[EmailMessage] = None
    extracted_values: Dict[str, Any] = field(default_factory=dict)
    assertion_results: List[Dict[str, Any]] = field(default_factory=list)
    duration_ms: int = 0


@dataclass
class EmailAssertion:
    """Email assertion configuration"""
    type: str  # subject_contains, body_contains, from_equals, has_attachment, etc.
    expected: str
    case_sensitive: bool = False


class EmailVerificationService:
    """
    Service for email verification in automated tests.
    
    Supports Microsoft 365 and Gmail via their respective APIs.
    """
    
    def __init__(self):
        self.microsoft_client = None
        self.gmail_client = None
        self._initialized = False
    
    async def initialize(self, provider: EmailProvider, credentials: Dict[str, str]) -> bool:
        """
        Initialize the email service with credentials.
        
        For Microsoft 365:
            - client_id: Azure AD App Client ID
            - client_secret: Azure AD App Client Secret  
            - tenant_id: Azure AD Tenant ID
            - user_email: Email address to monitor (or 'me' for delegated)
            
        For Gmail:
            - credentials_json: Path to OAuth credentials JSON
            - token_json: Path to token JSON (will be created)
            - user_email: Email address to monitor (or 'me')
        """
        try:
            if provider == EmailProvider.MICROSOFT_365:
                return await self._init_microsoft(credentials)
            elif provider == EmailProvider.GMAIL:
                return await self._init_gmail(credentials)
            else:
                logger.error(f"Unknown email provider: {provider}")
                return False
        except Exception as e:
            logger.error(f"Failed to initialize email service: {e}")
            return False
    
    async def _init_microsoft(self, credentials: Dict[str, str]) -> bool:
        """Initialize Microsoft Graph API client"""
        try:
            # Try importing msal for Microsoft auth
            from msal import ConfidentialClientApplication
            import httpx
            
            client_id = credentials.get('client_id') or os.getenv('MS_CLIENT_ID')
            client_secret = credentials.get('client_secret') or os.getenv('MS_CLIENT_SECRET')
            tenant_id = credentials.get('tenant_id') or os.getenv('MS_TENANT_ID')
            
            if not all([client_id, client_secret, tenant_id]):
                logger.error("Microsoft 365 credentials incomplete. Need client_id, client_secret, tenant_id")
                return False
            
            authority = f"https://login.microsoftonline.com/{tenant_id}"
            
            self.microsoft_client = ConfidentialClientApplication(
                client_id,
                authority=authority,
                client_credential=client_secret
            )
            
            # Get token to verify credentials
            scopes = ["https://graph.microsoft.com/.default"]
            result = self.microsoft_client.acquire_token_silent(scopes, account=None)
            if not result:
                result = self.microsoft_client.acquire_token_for_client(scopes=scopes)
            
            if "access_token" in result:
                self._ms_token = result["access_token"]
                self._ms_user = credentials.get('user_email', 'me')
                self._initialized = True
                logger.info("Microsoft 365 email service initialized successfully")
                return True
            else:
                logger.error(f"Failed to get MS Graph token: {result.get('error_description', 'Unknown error')}")
                return False
                
        except ImportError:
            logger.error("msal package not installed. Run: pip install msal")
            return False
        except Exception as e:
            logger.error(f"Microsoft 365 init error: {e}")
            return False
    
    async def _init_gmail(self, credentials: Dict[str, str]) -> bool:
        """Initialize Gmail API client"""
        try:
            from google.oauth2.credentials import Credentials
            from google_auth_oauthlib.flow import InstalledAppFlow
            from google.auth.transport.requests import Request
            from googleapiclient.discovery import build
            import pickle
            
            SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
            
            creds = None
            token_path = credentials.get('token_json', 'gmail_token.pickle')
            credentials_path = credentials.get('credentials_json') or os.getenv('GMAIL_CREDENTIALS_PATH')
            
            # Load existing token
            if os.path.exists(token_path):
                with open(token_path, 'rb') as token:
                    creds = pickle.load(token)
            
            # Refresh or get new token
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    if not credentials_path or not os.path.exists(credentials_path):
                        logger.error("Gmail credentials file not found")
                        return False
                    flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
                    creds = flow.run_local_server(port=0)
                
                # Save token
                with open(token_path, 'wb') as token:
                    pickle.dump(creds, token)
            
            self.gmail_client = build('gmail', 'v1', credentials=creds)
            self._gmail_user = credentials.get('user_email', 'me')
            self._initialized = True
            logger.info("Gmail service initialized successfully")
            return True
            
        except ImportError:
            logger.error("Google API packages not installed. Run: pip install google-auth google-auth-oauthlib google-api-python-client")
            return False
        except Exception as e:
            logger.error(f"Gmail init error: {e}")
            return False
    
    async def wait_for_email(
        self,
        provider: EmailProvider,
        inbox: str,
        subject_filter: Optional[str] = None,
        sender_filter: Optional[str] = None,
        timeout_seconds: int = 60,
        poll_interval_seconds: int = 5,
        received_after: Optional[datetime] = None
    ) -> Optional[EmailMessage]:
        """
        Wait for an email to arrive matching the filters.
        
        Args:
            provider: Email provider to use
            inbox: Email inbox to monitor
            subject_filter: Subject must contain this text (case-insensitive)
            sender_filter: Sender must contain this text
            timeout_seconds: Max time to wait
            poll_interval_seconds: Time between checks
            received_after: Only consider emails received after this time
            
        Returns:
            EmailMessage if found, None if timeout
        """
        if received_after is None:
            received_after = datetime.now(timezone.utc) - timedelta(minutes=5)
        
        start_time = datetime.now()
        end_time = start_time + timedelta(seconds=timeout_seconds)
        
        logger.info(f"Waiting for email (timeout: {timeout_seconds}s, subject: {subject_filter}, from: {sender_filter})")
        
        while datetime.now() < end_time:
            try:
                emails = await self._fetch_recent_emails(provider, inbox, limit=10)
                
                for email in emails:
                    # Check received time
                    if email.received_at < received_after:
                        continue
                    
                    # Check subject filter
                    if subject_filter and subject_filter.lower() not in email.subject.lower():
                        continue
                    
                    # Check sender filter  
                    if sender_filter and sender_filter.lower() not in email.sender.lower():
                        continue
                    
                    logger.info(f"Found matching email: {email.subject}")
                    return email
                
                # Wait before next poll
                await asyncio.sleep(poll_interval_seconds)
                
            except Exception as e:
                logger.error(f"Error polling for email: {e}")
                await asyncio.sleep(poll_interval_seconds)
        
        logger.warning(f"Timeout waiting for email after {timeout_seconds}s")
        return None
    
    async def _fetch_recent_emails(
        self,
        provider: EmailProvider,
        inbox: str,
        limit: int = 10
    ) -> List[EmailMessage]:
        """Fetch recent emails from inbox"""
        if provider == EmailProvider.MICROSOFT_365:
            return await self._fetch_ms_emails(inbox, limit)
        elif provider == EmailProvider.GMAIL:
            return await self._fetch_gmail_emails(inbox, limit)
        return []
    
    async def _fetch_ms_emails(self, inbox: str, limit: int) -> List[EmailMessage]:
        """Fetch emails from Microsoft 365"""
        try:
            import httpx
            
            user = inbox if inbox and inbox != 'me' else self._ms_user
            url = f"https://graph.microsoft.com/v1.0/users/{user}/mailFolders/inbox/messages"
            params = {
                "$top": limit,
                "$orderby": "receivedDateTime desc",
                "$select": "id,subject,body,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,internetMessageHeaders"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    params=params,
                    headers={"Authorization": f"Bearer {self._ms_token}"}
                )
                response.raise_for_status()
                data = response.json()
            
            emails = []
            for msg in data.get('value', []):
                email = EmailMessage(
                    id=msg['id'],
                    subject=msg.get('subject', ''),
                    body_text=msg.get('bodyPreview', ''),
                    body_html=msg.get('body', {}).get('content', ''),
                    sender=msg.get('from', {}).get('emailAddress', {}).get('address', ''),
                    recipients=[r.get('emailAddress', {}).get('address', '') for r in msg.get('toRecipients', [])],
                    cc=[r.get('emailAddress', {}).get('address', '') for r in msg.get('ccRecipients', [])],
                    received_at=datetime.fromisoformat(msg.get('receivedDateTime', '').replace('Z', '+00:00')),
                    attachments=[],  # Fetch separately if needed
                    headers={h.get('name', ''): h.get('value', '') for h in msg.get('internetMessageHeaders', [])}
                )
                emails.append(email)
            
            return emails
            
        except Exception as e:
            logger.error(f"Error fetching MS emails: {e}")
            return []
    
    async def _fetch_gmail_emails(self, inbox: str, limit: int) -> List[EmailMessage]:
        """Fetch emails from Gmail"""
        try:
            user = inbox if inbox and inbox != 'me' else self._gmail_user
            
            # List messages
            results = self.gmail_client.users().messages().list(
                userId=user,
                maxResults=limit,
                labelIds=['INBOX']
            ).execute()
            
            messages = results.get('messages', [])
            emails = []
            
            for msg_ref in messages:
                msg = self.gmail_client.users().messages().get(
                    userId=user,
                    id=msg_ref['id'],
                    format='full'
                ).execute()
                
                headers = {h['name']: h['value'] for h in msg.get('payload', {}).get('headers', [])}
                
                # Extract body
                body_text = ''
                body_html = ''
                payload = msg.get('payload', {})
                
                if 'body' in payload and payload['body'].get('data'):
                    body_text = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')
                elif 'parts' in payload:
                    for part in payload['parts']:
                        if part.get('mimeType') == 'text/plain' and part.get('body', {}).get('data'):
                            body_text = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                        elif part.get('mimeType') == 'text/html' and part.get('body', {}).get('data'):
                            body_html = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
                
                # Parse received date
                received_str = headers.get('Date', '')
                try:
                    from email.utils import parsedate_to_datetime
                    received_at = parsedate_to_datetime(received_str)
                except:
                    received_at = datetime.now(timezone.utc)
                
                email = EmailMessage(
                    id=msg['id'],
                    subject=headers.get('Subject', ''),
                    body_text=body_text,
                    body_html=body_html,
                    sender=headers.get('From', ''),
                    recipients=headers.get('To', '').split(','),
                    cc=headers.get('Cc', '').split(',') if headers.get('Cc') else [],
                    received_at=received_at,
                    attachments=[],
                    headers=headers
                )
                emails.append(email)
            
            return emails
            
        except Exception as e:
            logger.error(f"Error fetching Gmail: {e}")
            return []
    
    async def verify_email(
        self,
        provider: EmailProvider,
        inbox: str,
        assertions: List[EmailAssertion],
        subject_filter: Optional[str] = None,
        sender_filter: Optional[str] = None,
        timeout_seconds: int = 60,
        extract_link: Optional[Dict[str, str]] = None,
        extract_otp: Optional[Dict[str, str]] = None
    ) -> EmailVerificationResult:
        """
        Complete email verification workflow.
        
        Args:
            provider: Email provider
            inbox: Inbox to monitor
            assertions: List of assertions to verify
            subject_filter: Filter emails by subject
            sender_filter: Filter emails by sender
            timeout_seconds: Max wait time
            extract_link: Extract link config {"pattern": "...", "store_as": "varName"}
            extract_otp: Extract OTP config {"pattern": "...", "store_as": "varName"}
            
        Returns:
            EmailVerificationResult with success status and extracted values
        """
        start_time = datetime.now()
        extracted_values = {}
        assertion_results = []
        
        # Wait for email
        email = await self.wait_for_email(
            provider=provider,
            inbox=inbox,
            subject_filter=subject_filter,
            sender_filter=sender_filter,
            timeout_seconds=timeout_seconds
        )
        
        if not email:
            return EmailVerificationResult(
                success=False,
                message=f"No email received within {timeout_seconds} seconds",
                duration_ms=int((datetime.now() - start_time).total_seconds() * 1000)
            )
        
        # Run assertions
        all_passed = True
        for assertion in assertions:
            result = self._run_assertion(email, assertion)
            assertion_results.append(result)
            if not result['passed']:
                all_passed = False
        
        # Extract link if requested
        if extract_link:
            pattern = extract_link.get('pattern')
            store_as = extract_link.get('store_as', 'extractedLink')
            links = email.extract_links(pattern)
            if links:
                extracted_values[store_as] = links[0]
                logger.info(f"Extracted link: {links[0][:50]}...")
            else:
                all_passed = False
                assertion_results.append({
                    'type': 'extract_link',
                    'passed': False,
                    'message': f"No link found matching pattern: {pattern}"
                })
        
        # Extract OTP if requested
        if extract_otp:
            pattern = extract_otp.get('pattern')
            store_as = extract_otp.get('store_as', 'extractedOTP')
            otp = email.extract_otp(pattern)
            if otp:
                extracted_values[store_as] = otp
                logger.info(f"Extracted OTP: {otp}")
            else:
                all_passed = False
                assertion_results.append({
                    'type': 'extract_otp',
                    'passed': False,
                    'message': f"No OTP found matching pattern: {pattern}"
                })
        
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        
        return EmailVerificationResult(
            success=all_passed,
            message="All email assertions passed" if all_passed else "Some assertions failed",
            email=email,
            extracted_values=extracted_values,
            assertion_results=assertion_results,
            duration_ms=duration_ms
        )
    
    def _run_assertion(self, email: EmailMessage, assertion: EmailAssertion) -> Dict[str, Any]:
        """Run a single assertion against an email"""
        assertion_type = assertion.type
        expected = assertion.expected
        case_sensitive = assertion.case_sensitive
        
        passed = False
        message = ""
        actual = ""
        
        try:
            if assertion_type == 'subject_contains':
                actual = email.subject
                if case_sensitive:
                    passed = expected in actual
                else:
                    passed = expected.lower() in actual.lower()
                message = f"Subject {'contains' if passed else 'does not contain'} '{expected}'"
                
            elif assertion_type == 'subject_equals':
                actual = email.subject
                if case_sensitive:
                    passed = expected == actual
                else:
                    passed = expected.lower() == actual.lower()
                message = f"Subject {'equals' if passed else 'does not equal'} '{expected}'"
                
            elif assertion_type == 'body_contains':
                passed = email.contains_text(expected, case_sensitive)
                message = f"Body {'contains' if passed else 'does not contain'} '{expected}'"
                
            elif assertion_type == 'from_equals':
                actual = email.sender
                if case_sensitive:
                    passed = expected == actual
                else:
                    passed = expected.lower() == actual.lower()
                message = f"Sender {'equals' if passed else 'does not equal'} '{expected}'"
                
            elif assertion_type == 'from_contains':
                actual = email.sender
                if case_sensitive:
                    passed = expected in actual
                else:
                    passed = expected.lower() in actual.lower()
                message = f"Sender {'contains' if passed else 'does not contain'} '{expected}'"
                
            elif assertion_type == 'has_attachment':
                passed = len(email.attachments) > 0
                if expected:
                    # Check for specific attachment name
                    passed = any(a.get('name', '').lower() == expected.lower() for a in email.attachments)
                message = f"Email {'has' if passed else 'does not have'} attachment" + (f" '{expected}'" if expected else "")
                
            elif assertion_type == 'recipient_contains':
                actual = ', '.join(email.recipients)
                if case_sensitive:
                    passed = any(expected in r for r in email.recipients)
                else:
                    passed = any(expected.lower() in r.lower() for r in email.recipients)
                message = f"Recipients {'contain' if passed else 'do not contain'} '{expected}'"
                
            elif assertion_type == 'has_link':
                links = email.extract_links(expected if expected else None)
                passed = len(links) > 0
                message = f"Email {'has' if passed else 'does not have'} link" + (f" matching '{expected}'" if expected else "")
                
            elif assertion_type == 'has_otp':
                otp = email.extract_otp(expected if expected else None)
                passed = otp is not None
                message = f"Email {'has' if passed else 'does not have'} OTP code"
                
            else:
                message = f"Unknown assertion type: {assertion_type}"
                
        except Exception as e:
            message = f"Assertion error: {str(e)}"
        
        return {
            'type': assertion_type,
            'expected': expected,
            'actual': actual,
            'passed': passed,
            'message': message
        }


# Singleton instance
_email_service: Optional[EmailVerificationService] = None

def get_email_service() -> EmailVerificationService:
    """Get or create the email verification service"""
    global _email_service
    if _email_service is None:
        _email_service = EmailVerificationService()
    return _email_service

