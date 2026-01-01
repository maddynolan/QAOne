"""
API Router for Complex Verification Services

Endpoints for:
- Email verification (Microsoft 365, Gmail)
- PDF verification
- File download verification
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
import base64
import tempfile
import os
import logging

from ..services.complex_verifications.email_service import (
    EmailVerificationService, EmailProvider, EmailAssertion, get_email_service
)
from ..services.complex_verifications.pdf_service import (
    PDFVerificationService, PDFAssertion, get_pdf_service
)
from ..services.complex_verifications.file_service import (
    FileVerificationService, FileAssertion, get_file_service
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/complex-verify", tags=["Complex Verifications"])


# ============================================================================
# MODELS
# ============================================================================

class EmailAssertionModel(BaseModel):
    """Email assertion configuration"""
    type: str = Field(..., description="Assertion type: subject_contains, body_contains, from_equals, etc.")
    expected: str = Field(..., description="Expected value")
    case_sensitive: bool = Field(default=False)


class EmailVerifyRequest(BaseModel):
    """Request to verify an email"""
    provider: Literal["microsoft_365", "gmail"] = Field(..., description="Email provider")
    inbox: str = Field(..., description="Inbox/email address to monitor")
    credentials: Dict[str, str] = Field(default={}, description="Provider credentials (or use env vars)")
    subject_filter: Optional[str] = Field(default=None, description="Filter by subject")
    sender_filter: Optional[str] = Field(default=None, description="Filter by sender")
    timeout_seconds: int = Field(default=60, description="Max time to wait for email")
    assertions: List[EmailAssertionModel] = Field(default=[], description="Assertions to verify")
    extract_link: Optional[Dict[str, str]] = Field(default=None, description="Extract link: {pattern, store_as}")
    extract_otp: Optional[Dict[str, str]] = Field(default=None, description="Extract OTP: {pattern, store_as}")


class EmailVerifyResponse(BaseModel):
    """Response from email verification"""
    success: bool
    message: str
    email_subject: Optional[str] = None
    email_from: Optional[str] = None
    email_received_at: Optional[str] = None
    extracted_values: Dict[str, Any] = {}
    assertion_results: List[Dict[str, Any]] = []
    duration_ms: int = 0


class PDFAssertionModel(BaseModel):
    """PDF assertion configuration"""
    type: str = Field(..., description="Assertion type: contains_text, page_count, title_equals, etc.")
    expected: str = Field(..., description="Expected value")
    page: Optional[int] = Field(default=None, description="Page number for page-specific assertions")
    row: Optional[int] = Field(default=None, description="Table row for table assertions")
    col: Optional[int] = Field(default=None, description="Table column for table assertions")
    case_sensitive: bool = Field(default=False)


class PDFVerifyRequest(BaseModel):
    """Request to verify a PDF"""
    source: str = Field(..., description="PDF source: path, URL, or base64 content")
    source_type: Literal["path", "url", "base64"] = Field(default="path", description="Type of source")
    headers: Optional[Dict[str, str]] = Field(default=None, description="HTTP headers for URL download")
    assertions: List[PDFAssertionModel] = Field(default=[], description="Assertions to verify")
    extract_text: Optional[Dict[str, str]] = Field(default=None, description="Extract text: {pattern, store_as}")
    extract_table: Optional[Dict[str, Any]] = Field(default=None, description="Extract table: {page, table_index, store_as}")


class PDFVerifyResponse(BaseModel):
    """Response from PDF verification"""
    success: bool
    message: str
    page_count: Optional[int] = None
    title: Optional[str] = None
    author: Optional[str] = None
    text_preview: Optional[str] = None  # First 500 chars
    extracted_values: Dict[str, Any] = {}
    assertion_results: List[Dict[str, Any]] = []
    duration_ms: int = 0


class FileAssertionModel(BaseModel):
    """File assertion configuration"""
    type: str = Field(..., description="Assertion type: file_exists, size_min, csv_row_count, etc.")
    expected: str = Field(..., description="Expected value")
    row: Optional[int] = Field(default=None, description="Row index for CSV/Excel")
    col: Optional[Any] = Field(default=None, description="Column index or name")
    sheet: Optional[str] = Field(default=None, description="Sheet name for Excel")


class FileVerifyRequest(BaseModel):
    """Request to verify a file"""
    file_path: str = Field(..., description="Path to the file")
    file_type: Literal["auto", "csv", "excel", "json", "xml", "image", "any"] = Field(default="auto")
    csv_options: Optional[Dict[str, str]] = Field(default=None, description="CSV options: delimiter, encoding")
    assertions: List[FileAssertionModel] = Field(default=[], description="Assertions to verify")
    extract_value: Optional[Dict[str, Any]] = Field(default=None, description="Extract value: {path/row/col, store_as}")


class FileVerifyResponse(BaseModel):
    """Response from file verification"""
    success: bool
    message: str
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    row_count: Optional[int] = None  # For CSV/Excel
    column_count: Optional[int] = None  # For CSV/Excel
    extracted_values: Dict[str, Any] = {}
    assertion_results: List[Dict[str, Any]] = []
    duration_ms: int = 0


# ============================================================================
# EMAIL VERIFICATION ENDPOINTS
# ============================================================================

@router.post("/email/initialize")
async def initialize_email_service(
    provider: Literal["microsoft_365", "gmail"],
    credentials: Dict[str, str] = Body(...)
):
    """
    Initialize email verification service with credentials.
    
    For Microsoft 365:
    - client_id: Azure AD App Client ID
    - client_secret: Azure AD App Client Secret
    - tenant_id: Azure AD Tenant ID
    - user_email: Email to monitor (optional, defaults to service account)
    
    For Gmail:
    - credentials_json: Path to OAuth credentials file
    - token_json: Path to save token (optional)
    - user_email: Email to monitor (optional, defaults to 'me')
    """
    service = get_email_service()
    provider_enum = EmailProvider(provider)
    
    success = await service.initialize(provider_enum, credentials)
    
    if success:
        return {"success": True, "message": f"{provider} email service initialized successfully"}
    else:
        raise HTTPException(status_code=400, detail=f"Failed to initialize {provider} email service")


@router.post("/email/verify", response_model=EmailVerifyResponse)
async def verify_email(request: EmailVerifyRequest):
    """
    Wait for and verify an email.
    
    This endpoint will:
    1. Wait for an email matching the filters to arrive (up to timeout)
    2. Run all specified assertions against the email
    3. Extract links/OTP codes if requested
    4. Return results
    """
    service = get_email_service()
    
    # Initialize if credentials provided
    if request.credentials:
        provider_enum = EmailProvider(request.provider)
        await service.initialize(provider_enum, request.credentials)
    
    # Convert assertions
    assertions = [
        EmailAssertion(
            type=a.type,
            expected=a.expected,
            case_sensitive=a.case_sensitive
        )
        for a in request.assertions
    ]
    
    # Run verification
    result = await service.verify_email(
        provider=EmailProvider(request.provider),
        inbox=request.inbox,
        assertions=assertions,
        subject_filter=request.subject_filter,
        sender_filter=request.sender_filter,
        timeout_seconds=request.timeout_seconds,
        extract_link=request.extract_link,
        extract_otp=request.extract_otp
    )
    
    return EmailVerifyResponse(
        success=result.success,
        message=result.message,
        email_subject=result.email.subject if result.email else None,
        email_from=result.email.sender if result.email else None,
        email_received_at=result.email.received_at.isoformat() if result.email else None,
        extracted_values=result.extracted_values,
        assertion_results=result.assertion_results,
        duration_ms=result.duration_ms
    )


@router.post("/email/check-latest")
async def check_latest_email(
    provider: Literal["microsoft_365", "gmail"],
    inbox: str,
    limit: int = 5
):
    """
    Check latest emails in inbox (for debugging/testing).
    """
    service = get_email_service()
    
    emails = await service._fetch_recent_emails(
        EmailProvider(provider),
        inbox,
        limit
    )
    
    return {
        "count": len(emails),
        "emails": [
            {
                "id": e.id,
                "subject": e.subject,
                "from": e.sender,
                "received_at": e.received_at.isoformat(),
                "body_preview": e.body_text[:200] if e.body_text else ""
            }
            for e in emails
        ]
    }


# ============================================================================
# PDF VERIFICATION ENDPOINTS
# ============================================================================

@router.post("/pdf/verify", response_model=PDFVerifyResponse)
async def verify_pdf(request: PDFVerifyRequest):
    """
    Verify a PDF document.
    
    Source can be:
    - path: Local file path
    - url: URL to download PDF from
    - base64: Base64-encoded PDF content
    """
    service = get_pdf_service()
    
    # Convert assertions
    assertions = [
        PDFAssertion(
            type=a.type,
            expected=a.expected,
            page=a.page,
            row=a.row,
            col=a.col,
            case_sensitive=a.case_sensitive
        )
        for a in request.assertions
    ]
    
    # Run verification
    result = await service.verify_pdf(
        pdf_source=request.source,
        source_type=request.source_type,
        assertions=assertions,
        extract_text=request.extract_text,
        extract_table=request.extract_table,
        headers=request.headers
    )
    
    return PDFVerifyResponse(
        success=result.success,
        message=result.message,
        page_count=result.document.metadata.page_count if result.document else None,
        title=result.document.metadata.title if result.document else None,
        author=result.document.metadata.author if result.document else None,
        text_preview=result.document.full_text[:500] if result.document else None,
        extracted_values=result.extracted_values,
        assertion_results=result.assertion_results,
        duration_ms=result.duration_ms
    )


@router.post("/pdf/verify-upload", response_model=PDFVerifyResponse)
async def verify_pdf_upload(
    file: UploadFile = File(...),
    assertions: str = Form(default="[]"),
    extract_text: str = Form(default="null"),
    extract_table: str = Form(default="null")
):
    """
    Verify an uploaded PDF file.
    """
    import json
    
    service = get_pdf_service()
    
    # Save uploaded file to temp
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as f:
        content = await file.read()
        f.write(content)
        temp_path = f.name
    
    try:
        # Parse JSON form fields
        assertions_list = json.loads(assertions)
        extract_text_dict = json.loads(extract_text) if extract_text != "null" else None
        extract_table_dict = json.loads(extract_table) if extract_table != "null" else None
        
        # Convert assertions
        pdf_assertions = [
            PDFAssertion(
                type=a.get('type', ''),
                expected=a.get('expected', ''),
                page=a.get('page'),
                row=a.get('row'),
                col=a.get('col'),
                case_sensitive=a.get('case_sensitive', False)
            )
            for a in assertions_list
        ]
        
        # Run verification
        result = await service.verify_pdf(
            pdf_source=temp_path,
            source_type="path",
            assertions=pdf_assertions,
            extract_text=extract_text_dict,
            extract_table=extract_table_dict
        )
        
        return PDFVerifyResponse(
            success=result.success,
            message=result.message,
            page_count=result.document.metadata.page_count if result.document else None,
            title=result.document.metadata.title if result.document else None,
            author=result.document.metadata.author if result.document else None,
            text_preview=result.document.full_text[:500] if result.document else None,
            extracted_values=result.extracted_values,
            assertion_results=result.assertion_results,
            duration_ms=result.duration_ms
        )
    finally:
        # Cleanup
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@router.post("/pdf/parse")
async def parse_pdf(
    source: str = Body(...),
    source_type: Literal["path", "url", "base64"] = Body(default="path"),
    headers: Optional[Dict[str, str]] = Body(default=None)
):
    """
    Parse a PDF and return its content (for debugging/preview).
    """
    service = get_pdf_service()
    temp_file = None
    
    try:
        # Get PDF file
        if source_type == "url":
            pdf_path = await service.download_pdf(source, headers)
            temp_file = pdf_path
        elif source_type == "base64":
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as f:
                f.write(base64.b64decode(source))
                pdf_path = f.name
                temp_file = pdf_path
        else:
            pdf_path = source
        
        if not pdf_path:
            raise HTTPException(status_code=400, detail="Could not access PDF")
        
        document = service.parse_pdf(pdf_path)
        if not document:
            raise HTTPException(status_code=400, detail="Failed to parse PDF")
        
        return {
            "page_count": document.metadata.page_count,
            "title": document.metadata.title,
            "author": document.metadata.author,
            "pages": [
                {
                    "page_number": p.page_number,
                    "text_preview": p.text[:1000],
                    "table_count": len(p.tables)
                }
                for p in document.pages
            ]
        }
    finally:
        if temp_file and os.path.exists(temp_file):
            os.unlink(temp_file)


# ============================================================================
# FILE VERIFICATION ENDPOINTS
# ============================================================================

@router.post("/file/verify", response_model=FileVerifyResponse)
async def verify_file(request: FileVerifyRequest):
    """
    Verify a downloaded file (CSV, Excel, JSON, XML, image, etc.)
    """
    service = get_file_service()
    
    # Convert assertions
    assertions = [
        FileAssertion(
            type=a.type,
            expected=a.expected,
            row=a.row,
            col=a.col,
            sheet=a.sheet
        )
        for a in request.assertions
    ]
    
    # Run verification
    result = await service.verify_file(
        file_path=request.file_path,
        file_type=request.file_type,
        assertions=assertions,
        csv_options=request.csv_options,
        extract_value=request.extract_value
    )
    
    row_count = None
    column_count = None
    
    if result.csv_data:
        row_count = result.csv_data.row_count
        column_count = result.csv_data.column_count
    elif result.excel_data and result.excel_data.sheet_names:
        first_sheet = result.excel_data.sheets[result.excel_data.sheet_names[0]]
        row_count = first_sheet.row_count
        column_count = first_sheet.column_count
    
    return FileVerifyResponse(
        success=result.success,
        message=result.message,
        file_name=result.file_info.name if result.file_info else None,
        file_size=result.file_info.size_bytes if result.file_info else None,
        file_type=result.file_info.extension if result.file_info else None,
        row_count=row_count,
        column_count=column_count,
        extracted_values=result.extracted_values,
        assertion_results=result.assertion_results,
        duration_ms=result.duration_ms
    )


@router.post("/file/verify-upload", response_model=FileVerifyResponse)
async def verify_file_upload(
    file: UploadFile = File(...),
    file_type: str = Form(default="auto"),
    assertions: str = Form(default="[]"),
    csv_options: str = Form(default="null"),
    extract_value: str = Form(default="null")
):
    """
    Verify an uploaded file.
    """
    import json
    
    service = get_file_service()
    
    # Determine file extension from upload
    ext = os.path.splitext(file.filename or '')[1]
    
    # Save uploaded file to temp
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as f:
        content = await file.read()
        f.write(content)
        temp_path = f.name
    
    try:
        # Parse JSON form fields
        assertions_list = json.loads(assertions)
        csv_options_dict = json.loads(csv_options) if csv_options != "null" else None
        extract_value_dict = json.loads(extract_value) if extract_value != "null" else None
        
        # Convert assertions
        file_assertions = [
            FileAssertion(
                type=a.get('type', ''),
                expected=a.get('expected', ''),
                row=a.get('row'),
                col=a.get('col'),
                sheet=a.get('sheet')
            )
            for a in assertions_list
        ]
        
        # Run verification
        result = await service.verify_file(
            file_path=temp_path,
            file_type=file_type,
            assertions=file_assertions,
            csv_options=csv_options_dict,
            extract_value=extract_value_dict
        )
        
        row_count = None
        column_count = None
        
        if result.csv_data:
            row_count = result.csv_data.row_count
            column_count = result.csv_data.column_count
        elif result.excel_data and result.excel_data.sheet_names:
            first_sheet = result.excel_data.sheets[result.excel_data.sheet_names[0]]
            row_count = first_sheet.row_count
            column_count = first_sheet.column_count
        
        return FileVerifyResponse(
            success=result.success,
            message=result.message,
            file_name=file.filename,
            file_size=result.file_info.size_bytes if result.file_info else None,
            file_type=result.file_info.extension if result.file_info else None,
            row_count=row_count,
            column_count=column_count,
            extracted_values=result.extracted_values,
            assertion_results=result.assertion_results,
            duration_ms=result.duration_ms
        )
    finally:
        # Cleanup
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@router.get("/file/parse-csv")
async def parse_csv_file(
    file_path: str,
    delimiter: str = ",",
    encoding: str = "utf-8",
    max_rows: int = 100
):
    """
    Parse a CSV file and return preview (for debugging).
    """
    service = get_file_service()
    
    csv_data = service.parse_csv(file_path, delimiter, encoding)
    if not csv_data:
        raise HTTPException(status_code=400, detail="Failed to parse CSV")
    
    return {
        "headers": csv_data.headers,
        "row_count": csv_data.row_count,
        "column_count": csv_data.column_count,
        "rows_preview": csv_data.rows[:max_rows]
    }


# ============================================================================
# UTILITY ENDPOINTS
# ============================================================================

@router.get("/capabilities")
async def get_verification_capabilities():
    """
    Get available verification capabilities and installed libraries.
    """
    pdf_service = get_pdf_service()
    file_service = get_file_service()
    
    return {
        "email": {
            "providers": ["microsoft_365", "gmail"],
            "assertions": [
                "subject_contains", "subject_equals",
                "body_contains", "from_equals", "from_contains",
                "has_attachment", "recipient_contains",
                "has_link", "has_otp"
            ],
            "extractions": ["link", "otp"]
        },
        "pdf": {
            "libraries": {
                "pypdf2": pdf_service.has_pypdf2,
                "pdfplumber": pdf_service.has_pdfplumber,
                "pymupdf": pdf_service.has_pymupdf
            },
            "assertions": [
                "contains_text", "not_contains_text",
                "page_count", "page_count_min", "page_count_max",
                "title_equals", "title_contains", "author_equals",
                "text_matches", "table_contains", "table_cell_equals",
                "has_images"
            ],
            "extractions": ["text_pattern", "table"]
        },
        "file": {
            "libraries": {
                "pandas": file_service.has_pandas,
                "openpyxl": file_service.has_openpyxl,
                "pillow": file_service.has_pillow,
                "xmltodict": file_service.has_xmltodict
            },
            "types": ["csv", "excel", "json", "xml", "image"],
            "assertions": {
                "general": [
                    "file_exists", "file_name_contains", "file_name_equals",
                    "file_extension", "size_min", "size_max", "size_equals"
                ],
                "csv": [
                    "csv_row_count", "csv_row_count_min", "csv_column_count",
                    "csv_header_contains", "csv_cell_equals", "csv_cell_contains"
                ],
                "excel": [
                    "excel_sheet_exists", "excel_sheet_count"
                ],
                "json": [
                    "json_path_equals", "json_path_exists", "json_array_length"
                ],
                "image": [
                    "image_width", "image_height", "image_format",
                    "image_min_width", "image_min_height"
                ]
            }
        }
    }

