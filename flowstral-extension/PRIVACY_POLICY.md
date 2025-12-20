# Flowstral Recorder - Privacy Policy

**Last Updated:** December 20, 2024

## Overview

Flowstral Recorder is a browser extension that helps QA professionals and developers record browser interactions and generate automated test scripts. This privacy policy explains what data we collect, how we use it, and your rights regarding your data.

## Data Collection

### What We Collect

Flowstral Recorder operates primarily on your local machine. We collect the following data types:

| Data Type | Where Stored | Purpose |
|-----------|--------------|---------|
| DOM Element Information | Local (Extension Storage) | Generate stable selectors for test automation |
| User Click/Input Actions | Local (Extension Storage) | Record test steps |
| Page URLs | Local (Extension Storage) | Navigate during test replay |
| Network Requests (Optional) | Local (Extension Storage) | Performance testing analysis |

### What We Do NOT Collect

- ❌ **Personally Identifiable Information (PII)**: We do not collect names, emails, passwords, or any personal data entered into forms
- ❌ **Form Values**: When recording, we capture the action ("fill field") but NOT the actual text you type (unless you explicitly enable Smart Fill data generation)
- ❌ **Cookies or Session Data**: We do not access or transmit authentication cookies
- ❌ **Browsing History**: We only record pages during an active recording session
- ❌ **Data from Non-Recorded Pages**: The extension only activates when you explicitly start a recording

## Data Storage

### Local Storage Only (Default)
By default, all recorded data remains on your device in Chrome's local extension storage. No data is transmitted to any server.

### Optional Cloud Sync
If you choose to use cloud features (save to server, share with team), data is transmitted to your configured server endpoint only. We do not operate any third-party data collection servers.

## Permissions Explained

We request the following Chrome permissions:

| Permission | Why We Need It |
|------------|----------------|
| `activeTab` | Access the current page to record user actions |
| `storage` | Save recordings and settings locally |
| `tabs` | Track multi-tab recording sessions |
| `scripting` | Inject the recording script into pages |
| `downloads` | Export test scripts as files |
| `sidePanel` | Display the recording controls |
| `webRequest` | (Optional) Capture network requests for performance testing |

### Host Permissions (`<all_urls>`)
We request access to all URLs because:
1. **QA Testing Scope**: Users need to test their own applications on any domain
2. **Localhost Testing**: Users frequently test `localhost` development servers
3. **Enterprise Applications**: Enterprise apps like Salesforce, ServiceNow, and Workday use various subdomains

**We only activate on pages where you explicitly start a recording session.**

## Data Security

- All data is stored using Chrome's encrypted storage APIs
- No data is transmitted without explicit user action
- Network capture data is processed locally and never sent to external services
- Generated test scripts contain only selectors and action types, not sensitive data

## Your Rights

You can:
- **View** all stored data in Chrome's extension storage
- **Delete** all stored data by clearing extension storage or uninstalling
- **Export** your recordings as local files
- **Disable** network capture at any time

## Third-Party Services

Flowstral Recorder does not use:
- Analytics services
- Advertising networks
- Third-party tracking
- External APIs (unless you configure a self-hosted backend)

## Children's Privacy

This extension is designed for professional QA and development use. We do not knowingly collect data from children under 13.

## Changes to This Policy

We will update this policy as features change. The "Last Updated" date at the top reflects the most recent revision.

## Contact

For privacy questions or data requests, contact:
- GitHub: [Open an Issue](https://github.com/your-repo/flowstral)
- Email: privacy@your-domain.com

---

## Summary for Chrome Web Store Review

**Flowstral Recorder is a LOCAL-FIRST test automation tool.**

1. ✅ No remote code execution - all scripts are bundled with the extension
2. ✅ No PII collection - we record actions, not data values
3. ✅ No external data transmission by default
4. ✅ All host permission usage is user-initiated (explicit recording start)
5. ✅ Compliant with Manifest V3 security requirements

