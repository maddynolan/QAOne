"""
Complex Verification Services for ArisTrace QA Platform

This module provides advanced verification capabilities:
- Email Verification (Microsoft 365, Gmail)
- PDF Verification
- File Download Verification
- Enhanced Database Assertions

All services can be used as:
1. Standalone step types in the workflow editor
2. Assertion types attached to existing steps
"""

from .email_service import EmailVerificationService, EmailVerificationResult
from .pdf_service import PDFVerificationService, PDFVerificationResult
from .file_service import FileVerificationService, FileVerificationResult

__all__ = [
    'EmailVerificationService',
    'EmailVerificationResult',
    'PDFVerificationService', 
    'PDFVerificationResult',
    'FileVerificationService',
    'FileVerificationResult',
]

