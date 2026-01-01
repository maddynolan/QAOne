"""
PDF Verification Service for ArisTrace QA Platform

Features:
- Download and verify PDFs from web applications
- Extract text content from PDF pages
- Assert PDF contains specific text
- Verify PDF metadata (page count, title, author)
- Extract data from PDF tables
- Compare PDFs
"""

import os
import re
import logging
import tempfile
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class PDFMetadata:
    """PDF document metadata"""
    page_count: int
    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    creator: Optional[str] = None
    producer: Optional[str] = None
    creation_date: Optional[datetime] = None
    modification_date: Optional[datetime] = None


@dataclass
class PDFPage:
    """Represents a single PDF page"""
    page_number: int
    text: str
    tables: List[List[List[str]]] = field(default_factory=list)
    images: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class PDFDocument:
    """Represents a parsed PDF document"""
    path: str
    metadata: PDFMetadata
    pages: List[PDFPage]
    full_text: str
    
    def contains_text(self, text: str, case_sensitive: bool = False, page: Optional[int] = None) -> bool:
        """Check if PDF contains text"""
        search_text = self.full_text if page is None else self.pages[page - 1].text
        if case_sensitive:
            return text in search_text
        return text.lower() in search_text.lower()
    
    def get_page_text(self, page_number: int) -> str:
        """Get text from specific page (1-indexed)"""
        if 1 <= page_number <= len(self.pages):
            return self.pages[page_number - 1].text
        return ""
    
    def extract_pattern(self, pattern: str, page: Optional[int] = None) -> List[str]:
        """Extract all matches of a regex pattern"""
        search_text = self.full_text if page is None else self.pages[page - 1].text
        return re.findall(pattern, search_text, re.IGNORECASE)
    
    def find_text_position(self, text: str) -> Optional[Tuple[int, int]]:
        """Find page and approximate line where text appears"""
        for i, page in enumerate(self.pages):
            if text.lower() in page.text.lower():
                lines = page.text.split('\n')
                for j, line in enumerate(lines):
                    if text.lower() in line.lower():
                        return (i + 1, j + 1)
        return None


@dataclass
class PDFAssertion:
    """PDF assertion configuration"""
    type: str  # contains_text, page_count, has_text_at, table_contains, etc.
    expected: str
    page: Optional[int] = None  # For page-specific assertions
    row: Optional[int] = None  # For table assertions
    col: Optional[int] = None  # For table assertions
    case_sensitive: bool = False


@dataclass
class PDFVerificationResult:
    """Result of PDF verification"""
    success: bool
    message: str
    document: Optional[PDFDocument] = None
    extracted_values: Dict[str, Any] = field(default_factory=dict)
    assertion_results: List[Dict[str, Any]] = field(default_factory=list)
    duration_ms: int = 0


class PDFVerificationService:
    """
    Service for PDF verification in automated tests.
    
    Uses PyPDF2 for basic parsing and pdfplumber for advanced features like tables.
    """
    
    def __init__(self):
        self._check_dependencies()
    
    def _check_dependencies(self):
        """Check and log available PDF libraries"""
        self.has_pypdf2 = False
        self.has_pdfplumber = False
        self.has_pymupdf = False
        
        try:
            import PyPDF2
            self.has_pypdf2 = True
            logger.info("PyPDF2 available for PDF parsing")
        except ImportError:
            logger.warning("PyPDF2 not installed. Run: pip install PyPDF2")
        
        try:
            import pdfplumber
            self.has_pdfplumber = True
            logger.info("pdfplumber available for advanced PDF parsing")
        except ImportError:
            logger.debug("pdfplumber not installed (optional). Run: pip install pdfplumber")
        
        try:
            import fitz  # PyMuPDF
            self.has_pymupdf = True
            logger.info("PyMuPDF available for PDF parsing")
        except ImportError:
            logger.debug("PyMuPDF not installed (optional). Run: pip install PyMuPDF")
    
    async def download_pdf(self, url: str, headers: Optional[Dict[str, str]] = None) -> Optional[str]:
        """
        Download a PDF from URL to a temp file.
        
        Returns: Path to downloaded file or None on failure
        """
        try:
            import httpx
            
            async with httpx.AsyncClient(follow_redirects=True) as client:
                response = await client.get(url, headers=headers or {})
                response.raise_for_status()
                
                # Verify content type
                content_type = response.headers.get('content-type', '')
                if 'pdf' not in content_type.lower() and not url.lower().endswith('.pdf'):
                    logger.warning(f"Response may not be PDF: {content_type}")
                
                # Save to temp file
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as f:
                    f.write(response.content)
                    logger.info(f"PDF downloaded to: {f.name}")
                    return f.name
                    
        except Exception as e:
            logger.error(f"Failed to download PDF: {e}")
            return None
    
    def parse_pdf(self, pdf_path: str) -> Optional[PDFDocument]:
        """
        Parse a PDF file and extract content.
        
        Tries pdfplumber first (better table support), falls back to PyPDF2.
        """
        if not os.path.exists(pdf_path):
            logger.error(f"PDF file not found: {pdf_path}")
            return None
        
        # Try pdfplumber first (better for tables)
        if self.has_pdfplumber:
            try:
                return self._parse_with_pdfplumber(pdf_path)
            except Exception as e:
                logger.warning(f"pdfplumber parsing failed, trying PyPDF2: {e}")
        
        # Fall back to PyPDF2
        if self.has_pypdf2:
            try:
                return self._parse_with_pypdf2(pdf_path)
            except Exception as e:
                logger.error(f"PyPDF2 parsing failed: {e}")
        
        # Try PyMuPDF as last resort
        if self.has_pymupdf:
            try:
                return self._parse_with_pymupdf(pdf_path)
            except Exception as e:
                logger.error(f"PyMuPDF parsing failed: {e}")
        
        logger.error("No PDF parsing library available")
        return None
    
    def _parse_with_pdfplumber(self, pdf_path: str) -> PDFDocument:
        """Parse PDF using pdfplumber (best for tables)"""
        import pdfplumber
        
        pages = []
        full_text_parts = []
        
        with pdfplumber.open(pdf_path) as pdf:
            metadata = PDFMetadata(
                page_count=len(pdf.pages),
                title=pdf.metadata.get('Title'),
                author=pdf.metadata.get('Author'),
                subject=pdf.metadata.get('Subject'),
                creator=pdf.metadata.get('Creator'),
                producer=pdf.metadata.get('Producer')
            )
            
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                tables = []
                
                # Extract tables
                try:
                    extracted_tables = page.extract_tables()
                    if extracted_tables:
                        tables = extracted_tables
                except Exception as e:
                    logger.debug(f"Table extraction failed on page {i+1}: {e}")
                
                pages.append(PDFPage(
                    page_number=i + 1,
                    text=text,
                    tables=tables
                ))
                full_text_parts.append(text)
        
        return PDFDocument(
            path=pdf_path,
            metadata=metadata,
            pages=pages,
            full_text="\n".join(full_text_parts)
        )
    
    def _parse_with_pypdf2(self, pdf_path: str) -> PDFDocument:
        """Parse PDF using PyPDF2"""
        import PyPDF2
        
        pages = []
        full_text_parts = []
        
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            
            # Extract metadata
            meta = reader.metadata or {}
            metadata = PDFMetadata(
                page_count=len(reader.pages),
                title=meta.get('/Title'),
                author=meta.get('/Author'),
                subject=meta.get('/Subject'),
                creator=meta.get('/Creator'),
                producer=meta.get('/Producer')
            )
            
            for i, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                pages.append(PDFPage(
                    page_number=i + 1,
                    text=text,
                    tables=[]  # PyPDF2 doesn't support table extraction
                ))
                full_text_parts.append(text)
        
        return PDFDocument(
            path=pdf_path,
            metadata=metadata,
            pages=pages,
            full_text="\n".join(full_text_parts)
        )
    
    def _parse_with_pymupdf(self, pdf_path: str) -> PDFDocument:
        """Parse PDF using PyMuPDF (fitz)"""
        import fitz
        
        pages = []
        full_text_parts = []
        
        doc = fitz.open(pdf_path)
        
        metadata = PDFMetadata(
            page_count=len(doc),
            title=doc.metadata.get('title'),
            author=doc.metadata.get('author'),
            subject=doc.metadata.get('subject'),
            creator=doc.metadata.get('creator'),
            producer=doc.metadata.get('producer')
        )
        
        for i, page in enumerate(doc):
            text = page.get_text()
            pages.append(PDFPage(
                page_number=i + 1,
                text=text,
                tables=[]
            ))
            full_text_parts.append(text)
        
        doc.close()
        
        return PDFDocument(
            path=pdf_path,
            metadata=metadata,
            pages=pages,
            full_text="\n".join(full_text_parts)
        )
    
    async def verify_pdf(
        self,
        pdf_source: str,
        source_type: str = "path",  # "path", "url", "base64"
        assertions: List[PDFAssertion] = None,
        extract_text: Optional[Dict[str, str]] = None,  # {"pattern": "...", "store_as": "..."}
        extract_table: Optional[Dict[str, Any]] = None,  # {"page": 1, "table_index": 0, "store_as": "..."}
        headers: Optional[Dict[str, str]] = None  # For URL downloads
    ) -> PDFVerificationResult:
        """
        Complete PDF verification workflow.
        
        Args:
            pdf_source: Path, URL, or base64-encoded PDF
            source_type: Type of source ("path", "url", "base64")
            assertions: List of assertions to verify
            extract_text: Extract text matching pattern
            extract_table: Extract table data
            headers: HTTP headers for URL download
            
        Returns:
            PDFVerificationResult with success status and extracted values
        """
        start_time = datetime.now()
        assertions = assertions or []
        extracted_values = {}
        assertion_results = []
        temp_file = None
        
        try:
            # Get PDF file path
            if source_type == "url":
                pdf_path = await self.download_pdf(pdf_source, headers)
                if not pdf_path:
                    return PDFVerificationResult(
                        success=False,
                        message=f"Failed to download PDF from {pdf_source}",
                        duration_ms=int((datetime.now() - start_time).total_seconds() * 1000)
                    )
                temp_file = pdf_path
            elif source_type == "base64":
                import base64
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as f:
                    f.write(base64.b64decode(pdf_source))
                    pdf_path = f.name
                    temp_file = pdf_path
            else:
                pdf_path = pdf_source
            
            # Parse PDF
            document = self.parse_pdf(pdf_path)
            if not document:
                return PDFVerificationResult(
                    success=False,
                    message=f"Failed to parse PDF: {pdf_path}",
                    duration_ms=int((datetime.now() - start_time).total_seconds() * 1000)
                )
            
            # Run assertions
            all_passed = True
            for assertion in assertions:
                result = self._run_assertion(document, assertion)
                assertion_results.append(result)
                if not result['passed']:
                    all_passed = False
            
            # Extract text if requested
            if extract_text:
                pattern = extract_text.get('pattern', '')
                store_as = extract_text.get('store_as', 'extractedText')
                page = extract_text.get('page')
                
                matches = document.extract_pattern(pattern, page)
                if matches:
                    extracted_values[store_as] = matches[0] if len(matches) == 1 else matches
                    logger.info(f"Extracted text: {matches}")
                else:
                    all_passed = False
                    assertion_results.append({
                        'type': 'extract_text',
                        'passed': False,
                        'message': f"No text found matching pattern: {pattern}"
                    })
            
            # Extract table if requested
            if extract_table:
                page_num = extract_table.get('page', 1)
                table_index = extract_table.get('table_index', 0)
                store_as = extract_table.get('store_as', 'extractedTable')
                
                if page_num <= len(document.pages):
                    page_tables = document.pages[page_num - 1].tables
                    if table_index < len(page_tables):
                        extracted_values[store_as] = page_tables[table_index]
                        logger.info(f"Extracted table with {len(page_tables[table_index])} rows")
                    else:
                        all_passed = False
                        assertion_results.append({
                            'type': 'extract_table',
                            'passed': False,
                            'message': f"Table index {table_index} not found on page {page_num}"
                        })
            
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            
            return PDFVerificationResult(
                success=all_passed,
                message="All PDF assertions passed" if all_passed else "Some assertions failed",
                document=document,
                extracted_values=extracted_values,
                assertion_results=assertion_results,
                duration_ms=duration_ms
            )
            
        finally:
            # Cleanup temp file
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except:
                    pass
    
    def _run_assertion(self, document: PDFDocument, assertion: PDFAssertion) -> Dict[str, Any]:
        """Run a single assertion against a PDF document"""
        assertion_type = assertion.type
        expected = assertion.expected
        page = assertion.page
        case_sensitive = assertion.case_sensitive
        
        passed = False
        message = ""
        actual = ""
        
        try:
            if assertion_type == 'contains_text':
                passed = document.contains_text(expected, case_sensitive, page)
                scope = f"page {page}" if page else "document"
                message = f"PDF {scope} {'contains' if passed else 'does not contain'} '{expected}'"
                
            elif assertion_type == 'not_contains_text':
                passed = not document.contains_text(expected, case_sensitive, page)
                scope = f"page {page}" if page else "document"
                message = f"PDF {scope} {'does not contain' if passed else 'contains'} '{expected}'"
                
            elif assertion_type == 'page_count':
                actual = str(document.metadata.page_count)
                passed = actual == expected
                message = f"Page count is {actual}, expected {expected}"
                
            elif assertion_type == 'page_count_min':
                actual = str(document.metadata.page_count)
                passed = document.metadata.page_count >= int(expected)
                message = f"Page count {actual} {'≥' if passed else '<'} {expected}"
                
            elif assertion_type == 'page_count_max':
                actual = str(document.metadata.page_count)
                passed = document.metadata.page_count <= int(expected)
                message = f"Page count {actual} {'≤' if passed else '>'} {expected}"
                
            elif assertion_type == 'title_equals':
                actual = document.metadata.title or ""
                passed = actual == expected
                message = f"Title '{actual}' {'equals' if passed else 'does not equal'} '{expected}'"
                
            elif assertion_type == 'title_contains':
                actual = document.metadata.title or ""
                if case_sensitive:
                    passed = expected in actual
                else:
                    passed = expected.lower() in actual.lower()
                message = f"Title {'contains' if passed else 'does not contain'} '{expected}'"
                
            elif assertion_type == 'author_equals':
                actual = document.metadata.author or ""
                passed = actual == expected
                message = f"Author '{actual}' {'equals' if passed else 'does not equal'} '{expected}'"
                
            elif assertion_type == 'text_matches':
                # Regex match
                matches = document.extract_pattern(expected, page)
                passed = len(matches) > 0
                message = f"Pattern '{expected}' {'found' if passed else 'not found'} in PDF"
                
            elif assertion_type == 'table_contains':
                # Check if any table contains the expected text
                page_num = page or 1
                if page_num <= len(document.pages):
                    tables = document.pages[page_num - 1].tables
                    for table in tables:
                        for row in table:
                            for cell in row:
                                if cell and expected.lower() in str(cell).lower():
                                    passed = True
                                    break
                            if passed:
                                break
                        if passed:
                            break
                message = f"Table {'contains' if passed else 'does not contain'} '{expected}'"
                
            elif assertion_type == 'table_cell_equals':
                # Check specific cell: assertion.row, assertion.col
                page_num = page or 1
                row_idx = assertion.row or 0
                col_idx = assertion.col or 0
                
                if page_num <= len(document.pages):
                    tables = document.pages[page_num - 1].tables
                    if tables and row_idx < len(tables[0]) and col_idx < len(tables[0][row_idx]):
                        actual = str(tables[0][row_idx][col_idx] or "")
                        passed = actual == expected
                        message = f"Cell [{row_idx},{col_idx}] is '{actual}', expected '{expected}'"
                    else:
                        message = f"Cell [{row_idx},{col_idx}] not found"
                else:
                    message = f"Page {page_num} not found"
                    
            elif assertion_type == 'has_images':
                # Check if PDF has images
                image_count = sum(len(p.images) for p in document.pages)
                passed = image_count > 0
                message = f"PDF {'has' if passed else 'does not have'} images ({image_count} found)"
                
            else:
                message = f"Unknown assertion type: {assertion_type}"
                
        except Exception as e:
            message = f"Assertion error: {str(e)}"
        
        return {
            'type': assertion_type,
            'expected': expected,
            'actual': actual,
            'passed': passed,
            'message': message,
            'page': page
        }


# Singleton instance
_pdf_service: Optional[PDFVerificationService] = None

def get_pdf_service() -> PDFVerificationService:
    """Get or create the PDF verification service"""
    global _pdf_service
    if _pdf_service is None:
        _pdf_service = PDFVerificationService()
    return _pdf_service

