# Flowstral Recorder - Privacy Policy

**Effective Date:** February 24, 2026
**Last Updated:** February 24, 2026

Flowstral Recorder is a Chrome extension developed by Flowstral (QAAI) that records browser interactions to generate automated test scripts. This privacy policy explains what data the extension collects, how it is used, and how it is protected.

---

## 1. Data We Collect

The Flowstral Recorder extension collects the following data **only while actively recording** (the user must explicitly start a recording session):

### 1.1 User Interactions
- Click events (element selectors, element text, element attributes)
- Form input events (field names, field labels, field values)
- Navigation events (page URLs visited during recording)
- Keyboard events (special keys such as Enter, Tab, Escape)
- Select/dropdown changes (selected option text and value)

### 1.2 Optional: Network Traffic (Disabled by Default)
- HTTP request URLs, methods, status codes, and timing data
- Request and response headers (with sensitive headers masked -- see Section 4)
- Request body content for API calls (XMLHttpRequest and Fetch requests only)
- WebSocket connection data

Network capture must be explicitly enabled by the user via the "Capture Network" toggle in the extension sidebar.

### 1.3 Optional: Screenshots
- Screenshots may be captured during test execution or when using AI-powered features
- Screenshots are taken only of the active browser tab and only during an active session

### 1.4 Extension Settings
- Configured backend server URL
- Recording preferences (stored in `chrome.storage.local`)

---

## 2. How We Use Your Data

All collected data is used exclusively for QA test automation purposes:

- **Generate test scripts:** Recorded interactions are converted into Playwright test scripts that can be replayed for automated testing.
- **Fix broken selectors:** When a test step fails, AI-powered self-healing analyzes page structure to suggest alternative element selectors.
- **Protocol-level testing:** Optional network traffic data can be exported as HAR (HTTP Archive) files for load testing and API testing.
- **Test case generation:** Recorded sessions can be converted into structured test cases in multiple formats (Markdown, Gherkin, ISTQB).

---

## 3. Where Data Is Stored

### 3.1 Local Storage
- Recording state and actions are stored in the browser's `chrome.storage.local` API
- Data remains on the user's machine and is accessible only to the extension
- Data is cleared when the extension is uninstalled

### 3.2 Configured Backend Server (Optional)
- When a backend server URL is configured, recording sessions may be sent to that server for persistence and team collaboration
- The backend server is **user-configured** -- Flowstral does not operate a mandatory cloud service for extension data
- Non-localhost backend connections are automatically upgraded to HTTPS to protect data in transit

### 3.3 AI Services (Optional)
- When AI-powered features are used (auto-fix, AI test generation), relevant page structure data may be sent to:
  - **OpenAI API** (for selector healing and test generation)
  - **Configured backend server** (which may route to other LLM providers)
- Sensitive field values and authentication headers are masked before any data is sent to AI services

---

## 4. What Data Is Masked

The extension automatically masks sensitive information to protect user privacy:

### 4.1 Sensitive Form Fields
Fields matching any of the following patterns have their values replaced with `[MASKED]`:
- Password fields (`type="password"`)
- Fields with names/IDs containing: `password`, `secret`, `token`, `api-key`, `credit-card`, `card-number`, `cvv`, `cvc`, `ssn`, `social-security`, `pin`, `otp`, `verification-code`

### 4.2 Sensitive HTTP Headers
The following headers are replaced with `[MASKED]` in captured network traffic:
- `Authorization`
- `Cookie` / `Set-Cookie`
- `X-API-Key`
- `X-Auth-Token`
- `X-CSRF-Token` / `X-XSRF-Token`
- `Proxy-Authorization`
- `WWW-Authenticate`
- `X-Forwarded-For`

### 4.3 Correlation Pattern Detection
Auth token and session ID correlation detection is disabled in the Chrome extension to prevent inadvertent collection of authentication credentials. Full correlation detection is available only in the Flowstral Desktop application.

---

## 5. User Controls

### 5.1 Recording Control
- Recording only occurs when explicitly started by the user
- Users can pause, resume, or stop recording at any time
- The extension badge shows "REC" when recording is active

### 5.2 Network Capture Control
- Network traffic capture is disabled by default
- Users must explicitly enable it via the sidebar toggle
- Network capture can be stopped independently of UI recording

### 5.3 Data Deletion
- Users can clear all recorded data via the "Clear" button in the sidebar
- Uninstalling the extension removes all locally stored data
- Data sent to a configured backend server is subject to that server's data retention policies

### 5.4 Permissions
- The extension uses optional permissions -- users are prompted before any host access or network capture is enabled
- The extension does not access browsing data outside of active recording sessions

---

## 6. Permissions Explained

| Permission | Why We Need It |
|------------|----------------|
| `activeTab` | Access the current page to record user actions |
| `storage` | Save recordings and settings locally |
| `scripting` | Inject the recording script into pages |
| `sidePanel` | Display the recording controls sidebar |
| `tabs` (optional) | Track multi-tab recording sessions |
| `webRequest` (optional) | Capture network requests for performance testing |
| `downloads` (optional) | Export test scripts as files |

### Host Permissions
We request access to `https://*/*`, `http://localhost/*`, and `http://127.0.0.1/*` because:
1. **QA Testing Scope**: Users need to test their own applications on any HTTPS domain
2. **Localhost Testing**: Users frequently test local development servers
3. **Enterprise Applications**: Enterprise apps like Salesforce, ServiceNow, and Workday use various subdomains

We only activate on pages where you explicitly start a recording session.

---

## 7. Third-Party Services

### 7.1 OpenAI
- Used for AI-powered features (selector healing, test generation)
- Only page structure metadata is sent (not full page content)
- Sensitive values are masked before transmission
- Subject to OpenAI's privacy policy: https://openai.com/privacy

### 7.2 User-Configured Backend Server
- The extension can optionally send data to a backend server configured by the user
- Flowstral does not control or have access to user-configured backend servers
- HTTPS is enforced for all non-localhost backend connections

### 7.3 No Analytics or Advertising
The extension does not use:
- Analytics services
- Advertising networks
- Third-party tracking
- Telemetry or usage data collection

---

## 8. Data Retention

- **Local data:** Stored in `chrome.storage.local` for the lifetime of the extension installation. Cleared on uninstall.
- **Session data:** Recording sessions are session-based and can be cleared at any time by the user.
- **Backend data:** Retention of data sent to a configured backend server is determined by the server operator.
- **AI service data:** Subject to the respective AI provider's data retention policies.

---

## 9. Data Security

- All non-localhost backend communication uses HTTPS
- Sensitive form field values are masked at the point of capture (never stored in plain text)
- Sensitive HTTP headers are masked before storage or transmission
- The extension does not collect or transmit data when not actively recording
- No data is sold to or shared with third parties for advertising or marketing purposes
- All data is stored using Chrome's encrypted storage APIs
- No remote code execution -- all scripts are bundled with the extension

---

## 10. Children's Privacy

The Flowstral Recorder extension is a professional QA automation tool intended for use by software development and testing professionals. It is not directed at children under 13 years of age and does not knowingly collect personal information from children.

---

## 11. Changes to This Policy

We may update this privacy policy as features change. Changes will be reflected in the "Last Updated" date at the top of this document. Continued use of the extension after changes constitutes acceptance of the updated policy.

---

## 12. Contact Information

For questions, concerns, or requests regarding this privacy policy or the extension's data practices:

- **Email:** support@flowstral.com
- **Website:** https://flowstral.com
- **GitHub:** https://github.com/maddynolan/QAOne

---

## Summary for Chrome Web Store Review

**Flowstral Recorder is a LOCAL-FIRST test automation tool.**

1. No remote code execution - all scripts are bundled with the extension
2. No PII collection - sensitive form values and auth headers are masked at point of capture
3. No external data transmission by default - backend sync is opt-in and user-configured
4. All host permission usage is user-initiated (explicit recording start required)
5. Network capture is opt-in (disabled by default) with automatic header masking
6. Auto-scanning of dropdown menus is disabled to prevent unintended side effects
7. HTTPS enforced for all non-localhost backend connections
8. Compliant with Manifest V3 security requirements
