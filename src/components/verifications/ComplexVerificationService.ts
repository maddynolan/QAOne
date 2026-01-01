/**
 * Complex Verification Service
 * 
 * Client-side service for interacting with the complex verification API endpoints.
 */

import { getApiBaseUrl } from '@/lib/api-config';
import type { 
  EmailVerifyConfig, 
  PDFVerifyConfig, 
  FileVerifyConfig,
  EmailVerifyResponse,
  PDFVerifyResponse,
  FileVerifyResponse
} from './types';

const API_BASE = getApiBaseUrl();

export class ComplexVerificationService {
  
  /**
   * Initialize email service with credentials
   */
  static async initializeEmail(
    provider: 'microsoft_365' | 'gmail',
    credentials: Record<string, string>
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/api/complex-verify/email/initialize?provider=${provider}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to initialize email service');
    }
    
    return response.json();
  }
  
  /**
   * Verify an email
   */
  static async verifyEmail(config: EmailVerifyConfig & { credentials?: Record<string, string> }): Promise<EmailVerifyResponse> {
    const response = await fetch(`${API_BASE}/api/complex-verify/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: config.provider,
        inbox: config.inbox,
        credentials: config.credentials || {},
        subject_filter: config.subjectFilter,
        sender_filter: config.senderFilter,
        timeout_seconds: config.timeoutSeconds,
        assertions: config.assertions.filter(a => a.enabled).map(a => ({
          type: a.type,
          expected: a.expected,
          case_sensitive: a.caseSensitive || false
        })),
        extract_link: config.extractLink ? {
          pattern: config.extractLink.pattern,
          store_as: config.extractLink.storeAs
        } : null,
        extract_otp: config.extractOTP ? {
          pattern: config.extractOTP.pattern,
          store_as: config.extractOTP.storeAs
        } : null
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Email verification failed');
    }
    
    const data = await response.json();
    return {
      success: data.success,
      message: data.message,
      emailSubject: data.email_subject,
      emailFrom: data.email_from,
      emailReceivedAt: data.email_received_at,
      extractedValues: data.extracted_values || {},
      assertionResults: data.assertion_results || [],
      durationMs: data.duration_ms
    };
  }
  
  /**
   * Check latest emails (for debugging)
   */
  static async checkLatestEmails(
    provider: 'microsoft_365' | 'gmail',
    inbox: string,
    limit: number = 5
  ): Promise<{ count: number; emails: any[] }> {
    const response = await fetch(
      `${API_BASE}/api/complex-verify/email/check-latest?provider=${provider}&inbox=${encodeURIComponent(inbox)}&limit=${limit}`,
      { method: 'POST' }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to check emails');
    }
    
    return response.json();
  }
  
  /**
   * Verify a PDF
   */
  static async verifyPDF(config: PDFVerifyConfig): Promise<PDFVerifyResponse> {
    const response = await fetch(`${API_BASE}/api/complex-verify/pdf/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: config.source,
        source_type: config.sourceType === 'download' ? 'path' : config.sourceType,
        assertions: config.assertions.filter(a => a.enabled).map(a => ({
          type: a.type,
          expected: a.expected,
          page: a.page,
          row: a.row,
          col: a.col,
          case_sensitive: a.caseSensitive || false
        })),
        extract_text: config.extractText ? {
          pattern: config.extractText.pattern,
          store_as: config.extractText.storeAs,
          page: config.extractText.page
        } : null,
        extract_table: config.extractTable ? {
          page: config.extractTable.page,
          table_index: config.extractTable.tableIndex,
          store_as: config.extractTable.storeAs
        } : null
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'PDF verification failed');
    }
    
    const data = await response.json();
    return {
      success: data.success,
      message: data.message,
      pageCount: data.page_count,
      title: data.title,
      author: data.author,
      textPreview: data.text_preview,
      extractedValues: data.extracted_values || {},
      assertionResults: data.assertion_results || [],
      durationMs: data.duration_ms
    };
  }
  
  /**
   * Verify a PDF from uploaded file
   */
  static async verifyPDFUpload(
    file: File,
    config: Omit<PDFVerifyConfig, 'source' | 'sourceType'>
  ): Promise<PDFVerifyResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assertions', JSON.stringify(
      config.assertions.filter(a => a.enabled).map(a => ({
        type: a.type,
        expected: a.expected,
        page: a.page,
        row: a.row,
        col: a.col,
        case_sensitive: a.caseSensitive || false
      }))
    ));
    
    if (config.extractText) {
      formData.append('extract_text', JSON.stringify({
        pattern: config.extractText.pattern,
        store_as: config.extractText.storeAs,
        page: config.extractText.page
      }));
    }
    
    if (config.extractTable) {
      formData.append('extract_table', JSON.stringify({
        page: config.extractTable.page,
        table_index: config.extractTable.tableIndex,
        store_as: config.extractTable.storeAs
      }));
    }
    
    const response = await fetch(`${API_BASE}/api/complex-verify/pdf/verify-upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'PDF verification failed');
    }
    
    const data = await response.json();
    return {
      success: data.success,
      message: data.message,
      pageCount: data.page_count,
      title: data.title,
      author: data.author,
      textPreview: data.text_preview,
      extractedValues: data.extracted_values || {},
      assertionResults: data.assertion_results || [],
      durationMs: data.duration_ms
    };
  }
  
  /**
   * Verify a file
   */
  static async verifyFile(filePath: string, config: FileVerifyConfig): Promise<FileVerifyResponse> {
    const response = await fetch(`${API_BASE}/api/complex-verify/file/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_path: filePath,
        file_type: config.fileType,
        csv_options: config.csvOptions,
        assertions: config.assertions.filter(a => a.enabled).map(a => ({
          type: a.type,
          expected: a.expected,
          row: a.row,
          col: a.col,
          sheet: a.sheet
        })),
        extract_value: config.extractValue ? {
          path: config.extractValue.path,
          row: config.extractValue.row,
          col: config.extractValue.col,
          sheet: config.extractValue.sheet,
          store_as: config.extractValue.storeAs
        } : null
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'File verification failed');
    }
    
    const data = await response.json();
    return {
      success: data.success,
      message: data.message,
      fileName: data.file_name,
      fileSize: data.file_size,
      fileType: data.file_type,
      rowCount: data.row_count,
      columnCount: data.column_count,
      extractedValues: data.extracted_values || {},
      assertionResults: data.assertion_results || [],
      durationMs: data.duration_ms
    };
  }
  
  /**
   * Verify an uploaded file
   */
  static async verifyFileUpload(
    file: File,
    config: Omit<FileVerifyConfig, 'downloadTrigger'>
  ): Promise<FileVerifyResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', config.fileType);
    formData.append('assertions', JSON.stringify(
      config.assertions.filter(a => a.enabled).map(a => ({
        type: a.type,
        expected: a.expected,
        row: a.row,
        col: a.col,
        sheet: a.sheet
      }))
    ));
    
    if (config.csvOptions) {
      formData.append('csv_options', JSON.stringify(config.csvOptions));
    }
    
    if (config.extractValue) {
      formData.append('extract_value', JSON.stringify({
        path: config.extractValue.path,
        row: config.extractValue.row,
        col: config.extractValue.col,
        sheet: config.extractValue.sheet,
        store_as: config.extractValue.storeAs
      }));
    }
    
    const response = await fetch(`${API_BASE}/api/complex-verify/file/verify-upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'File verification failed');
    }
    
    const data = await response.json();
    return {
      success: data.success,
      message: data.message,
      fileName: data.file_name,
      fileSize: data.file_size,
      fileType: data.file_type,
      rowCount: data.row_count,
      columnCount: data.column_count,
      extractedValues: data.extracted_values || {},
      assertionResults: data.assertion_results || [],
      durationMs: data.duration_ms
    };
  }
  
  /**
   * Get available verification capabilities
   */
  static async getCapabilities(): Promise<{
    email: { providers: string[]; assertions: string[]; extractions: string[] };
    pdf: { libraries: Record<string, boolean>; assertions: string[]; extractions: string[] };
    file: { libraries: Record<string, boolean>; types: string[]; assertions: Record<string, string[]> };
  }> {
    const response = await fetch(`${API_BASE}/api/complex-verify/capabilities`);
    
    if (!response.ok) {
      throw new Error('Failed to get capabilities');
    }
    
    return response.json();
  }
}

