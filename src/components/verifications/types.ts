/**
 * Types for Complex Verification Components
 */

// Email Verification Types
export interface EmailAssertion {
  id: string;
  type: EmailAssertionType;
  expected: string;
  caseSensitive?: boolean;
  enabled: boolean;
}

export type EmailAssertionType = 
  | 'subject_contains'
  | 'subject_equals'
  | 'body_contains'
  | 'from_equals'
  | 'from_contains'
  | 'has_attachment'
  | 'recipient_contains'
  | 'has_link'
  | 'has_otp';

export interface EmailVerifyConfig {
  provider: 'microsoft_365' | 'gmail';
  inbox: string;
  subjectFilter?: string;
  senderFilter?: string;
  timeoutSeconds: number;
  assertions: EmailAssertion[];
  extractLink?: {
    pattern?: string;
    storeAs: string;
  };
  extractOTP?: {
    pattern?: string;
    storeAs: string;
  };
}

// PDF Verification Types
export interface PDFAssertion {
  id: string;
  type: PDFAssertionType;
  expected: string;
  page?: number;
  row?: number;
  col?: number;
  caseSensitive?: boolean;
  enabled: boolean;
}

export type PDFAssertionType =
  | 'contains_text'
  | 'not_contains_text'
  | 'page_count'
  | 'page_count_min'
  | 'page_count_max'
  | 'title_equals'
  | 'title_contains'
  | 'author_equals'
  | 'text_matches'
  | 'table_contains'
  | 'table_cell_equals'
  | 'has_images';

export interface PDFVerifyConfig {
  source: string;
  sourceType: 'download' | 'url' | 'variable';
  downloadTrigger?: string;  // Selector of download button
  assertions: PDFAssertion[];
  extractText?: {
    pattern: string;
    storeAs: string;
    page?: number;
  };
  extractTable?: {
    page: number;
    tableIndex: number;
    storeAs: string;
  };
}

// File Verification Types
export interface FileAssertion {
  id: string;
  type: FileAssertionType;
  expected: string;
  row?: number;
  col?: number | string;
  sheet?: string;
  enabled: boolean;
}

export type FileAssertionType =
  // General file
  | 'file_exists'
  | 'file_name_contains'
  | 'file_name_equals'
  | 'file_extension'
  | 'size_min'
  | 'size_max'
  | 'size_equals'
  // CSV
  | 'csv_row_count'
  | 'csv_row_count_min'
  | 'csv_column_count'
  | 'csv_header_contains'
  | 'csv_cell_equals'
  | 'csv_cell_contains'
  // Excel
  | 'excel_sheet_exists'
  | 'excel_sheet_count'
  // JSON
  | 'json_path_equals'
  | 'json_path_exists'
  | 'json_array_length'
  // Image
  | 'image_width'
  | 'image_height'
  | 'image_format'
  | 'image_min_width'
  | 'image_min_height';

export interface FileVerifyConfig {
  downloadTrigger: string;  // Selector of download button
  fileType: 'auto' | 'csv' | 'excel' | 'json' | 'xml' | 'image' | 'any';
  assertions: FileAssertion[];
  csvOptions?: {
    delimiter?: string;
    encoding?: string;
  };
  extractValue?: {
    path?: string;
    row?: number;
    col?: number | string;
    sheet?: string;
    storeAs: string;
  };
}

// Step config union type
export type ComplexVerifyStepConfig = 
  | { type: 'email_verify'; config: EmailVerifyConfig }
  | { type: 'pdf_verify'; config: PDFVerifyConfig }
  | { type: 'file_verify'; config: FileVerifyConfig };

// API Response types
export interface EmailVerifyResponse {
  success: boolean;
  message: string;
  emailSubject?: string;
  emailFrom?: string;
  emailReceivedAt?: string;
  extractedValues: Record<string, any>;
  assertionResults: AssertionResult[];
  durationMs: number;
}

export interface PDFVerifyResponse {
  success: boolean;
  message: string;
  pageCount?: number;
  title?: string;
  author?: string;
  textPreview?: string;
  extractedValues: Record<string, any>;
  assertionResults: AssertionResult[];
  durationMs: number;
}

export interface FileVerifyResponse {
  success: boolean;
  message: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  rowCount?: number;
  columnCount?: number;
  extractedValues: Record<string, any>;
  assertionResults: AssertionResult[];
  durationMs: number;
}

export interface AssertionResult {
  type: string;
  expected: string;
  actual?: string;
  passed: boolean;
  message: string;
}

// Assertion type metadata for UI
export const EMAIL_ASSERTION_TYPES: Record<EmailAssertionType, { label: string; description: string }> = {
  subject_contains: { label: 'Subject Contains', description: 'Email subject contains text' },
  subject_equals: { label: 'Subject Equals', description: 'Email subject exactly matches' },
  body_contains: { label: 'Body Contains', description: 'Email body contains text' },
  from_equals: { label: 'From Equals', description: 'Sender email matches exactly' },
  from_contains: { label: 'From Contains', description: 'Sender email contains text' },
  has_attachment: { label: 'Has Attachment', description: 'Email has attachment (optionally by name)' },
  recipient_contains: { label: 'Recipient Contains', description: 'Recipients include email' },
  has_link: { label: 'Has Link', description: 'Email contains link (optionally matching pattern)' },
  has_otp: { label: 'Has OTP Code', description: 'Email contains OTP/verification code' },
};

export const PDF_ASSERTION_TYPES: Record<PDFAssertionType, { label: string; description: string }> = {
  contains_text: { label: 'Contains Text', description: 'PDF contains text' },
  not_contains_text: { label: 'Not Contains Text', description: 'PDF does not contain text' },
  page_count: { label: 'Page Count Equals', description: 'PDF has exact page count' },
  page_count_min: { label: 'Min Page Count', description: 'PDF has at least N pages' },
  page_count_max: { label: 'Max Page Count', description: 'PDF has at most N pages' },
  title_equals: { label: 'Title Equals', description: 'PDF title matches' },
  title_contains: { label: 'Title Contains', description: 'PDF title contains text' },
  author_equals: { label: 'Author Equals', description: 'PDF author matches' },
  text_matches: { label: 'Text Matches Pattern', description: 'PDF text matches regex' },
  table_contains: { label: 'Table Contains', description: 'PDF table contains text' },
  table_cell_equals: { label: 'Table Cell Equals', description: 'Specific table cell matches' },
  has_images: { label: 'Has Images', description: 'PDF contains images' },
};

export const FILE_ASSERTION_TYPES: Record<FileAssertionType, { label: string; description: string; category: string }> = {
  file_exists: { label: 'File Exists', description: 'File was downloaded', category: 'general' },
  file_name_contains: { label: 'Name Contains', description: 'File name contains text', category: 'general' },
  file_name_equals: { label: 'Name Equals', description: 'File name matches exactly', category: 'general' },
  file_extension: { label: 'Extension', description: 'File has extension', category: 'general' },
  size_min: { label: 'Min Size', description: 'File is at least N bytes', category: 'general' },
  size_max: { label: 'Max Size', description: 'File is at most N bytes', category: 'general' },
  size_equals: { label: 'Size Equals', description: 'File is exactly N bytes', category: 'general' },
  csv_row_count: { label: 'Row Count', description: 'CSV has N rows', category: 'csv' },
  csv_row_count_min: { label: 'Min Rows', description: 'CSV has at least N rows', category: 'csv' },
  csv_column_count: { label: 'Column Count', description: 'CSV has N columns', category: 'csv' },
  csv_header_contains: { label: 'Header Contains', description: 'CSV headers include', category: 'csv' },
  csv_cell_equals: { label: 'Cell Equals', description: 'CSV cell value matches', category: 'csv' },
  csv_cell_contains: { label: 'Cell Contains', description: 'CSV cell contains text', category: 'csv' },
  excel_sheet_exists: { label: 'Sheet Exists', description: 'Excel has sheet', category: 'excel' },
  excel_sheet_count: { label: 'Sheet Count', description: 'Excel has N sheets', category: 'excel' },
  json_path_equals: { label: 'JSON Path Equals', description: 'JSON path value matches', category: 'json' },
  json_path_exists: { label: 'JSON Path Exists', description: 'JSON path exists', category: 'json' },
  json_array_length: { label: 'Array Length', description: 'JSON array has N items', category: 'json' },
  image_width: { label: 'Width Equals', description: 'Image width is N px', category: 'image' },
  image_height: { label: 'Height Equals', description: 'Image height is N px', category: 'image' },
  image_format: { label: 'Format', description: 'Image format matches', category: 'image' },
  image_min_width: { label: 'Min Width', description: 'Image is at least N px wide', category: 'image' },
  image_min_height: { label: 'Min Height', description: 'Image is at least N px tall', category: 'image' },
};

