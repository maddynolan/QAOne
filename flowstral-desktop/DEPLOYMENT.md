# Flowstral Desktop Agent - Deployment Guide

This guide covers deployment options for Flowstral Desktop Agent in enterprise environments.

## Deployment Models

### 1. SaaS (Cloud) Deployment

**Best for**: Small teams, quick start, managed infrastructure

```
┌─────────────────┐     HTTPS/WSS      ┌─────────────────────┐
│  Desktop Agent  │◄──────────────────►│  Flowstral Cloud    │
│  (User's PC)    │                    │  app.flowstral.com  │
└─────────────────┘                    └─────────────────────┘
```

**Setup**:
1. Download agent from https://app.flowstral.com/downloads
2. Install on user machines
3. Enter license key
4. Connect to `https://app.flowstral.com`

**Pros**:
- Zero server management
- Automatic updates
- Always available

**Cons**:
- Test data passes through cloud
- Internet dependency

---

### 2. On-Premise Deployment

**Best for**: Large enterprises, data sovereignty, air-gapped networks

```
┌─────────────────┐     Internal       ┌─────────────────────┐
│  Desktop Agent  │◄──────────────────►│  Flowstral Server   │
│  (User's PC)    │     Network        │  (Your Data Center) │
└─────────────────┘                    └─────────────────────┘
```

**Server Requirements**:
- 4 CPU cores, 8GB RAM minimum
- 100GB storage
- Python 3.10+
- PostgreSQL 14+ (optional, SQLite default)
- Redis (optional, for caching)

**Setup**:

1. **Deploy Flowstral Server**:
```bash
# Clone repository
git clone https://github.com/flowstral/flowstral-server.git
cd flowstral-server

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

2. **Configure HTTPS** (required for secure connections):
```bash
# Using nginx as reverse proxy
sudo apt install nginx certbot

# Get SSL certificate
sudo certbot certonly --nginx -d flowstral.yourcompany.com

# Configure nginx
server {
    listen 443 ssl;
    server_name flowstral.yourcompany.com;
    
    ssl_certificate /etc/letsencrypt/live/flowstral.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flowstral.yourcompany.com/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

3. **Deploy Desktop Agents**:
   - Build custom installer with embedded server URL
   - Or configure via Group Policy

---

### 3. Hybrid Deployment

**Best for**: Distributed teams, mixed requirements

```
┌─────────────────┐                    ┌─────────────────────┐
│  Agent (Office) │◄──────────────────►│  On-Prem Server     │
└─────────────────┘                    │  (Execution only)   │
                                       └─────────────────────┘
                                                │
                                                ▼
┌─────────────────┐                    ┌─────────────────────┐
│  Agent (Remote) │◄──────────────────►│  Flowstral Cloud    │
└─────────────────┘                    │  (Orchestration)    │
                                       └─────────────────────┘
```

---

## Mass Deployment

### Windows (via GPO/SCCM)

**Silent Install**:
```cmd
Flowstral-Setup.exe /S /D=C:\Program Files\Flowstral
```

**Pre-configure Settings** (deploy config.json):
```json
{
  "serverUrl": "https://flowstral.yourcompany.com",
  "licenseKey": "FLOWSTRAL-XXXXX-XXXXX-XXXXX-XXXXX",
  "preferences": {
    "launchOnStartup": true,
    "minimizeToTray": true
  }
}
```

Location: `%APPDATA%\flowstral-desktop\config.json`

**GPO Registry Settings**:
```
HKLM\SOFTWARE\Flowstral\Desktop
  ServerUrl = "https://flowstral.yourcompany.com"
  LicenseKey = "FLOWSTRAL-XXXXX-..."
```

### macOS (via MDM)

**Package for Jamf/Kandji**:
1. Convert DMG to PKG with pre-configured settings
2. Deploy via MDM profile

**Configuration Profile**:
```xml
<dict>
  <key>serverUrl</key>
  <string>https://flowstral.yourcompany.com</string>
  <key>licenseKey</key>
  <string>FLOWSTRAL-XXXXX-...</string>
</dict>
```

### Linux

**Debian/Ubuntu**:
```bash
sudo dpkg -i flowstral_1.0.0_amd64.deb
sudo apt-get install -f  # Install dependencies
```

**RHEL/CentOS**:
```bash
sudo rpm -i flowstral-1.0.0.x86_64.rpm
```

---

## License Management

### License Types

| Type | Seats | Price* | Features |
|------|-------|--------|----------|
| Trial | 1 | Free | Basic recording, 14 days |
| Professional | 1-5 | $99/mo/seat | Full features |
| Enterprise | 10-100 | Custom | Full + Support |
| Unlimited | Org-wide | Custom | Full + Dedicated |

*Contact sales@flowstral.com for pricing

### Generating Licenses (Admin)

**Via API**:
```bash
curl -X POST https://flowstral.yourcompany.com/license/create \
  -H "Content-Type: application/json" \
  -d '{
    "type": "enterprise",
    "email": "team@company.com",
    "company": "Company Inc.",
    "maxActivations": 50,
    "validDays": 365
  }'
```

**Response**:
```json
{
  "key": "FLOWSTRAL-E7B4A-C9D2F-2512-ABC12",
  "type": "enterprise",
  "expiresAt": "2025-12-22T00:00:00",
  "maxActivations": 50
}
```

### Offline Licensing

For air-gapped networks:
1. Generate offline license on admin portal
2. License contains embedded type/expiry (validated locally)
3. No server connectivity required for validation

---

## Security Considerations

### Network Requirements

**Outbound Connections** (firewall rules):
```
# SaaS
*.flowstral.com:443 (HTTPS/WSS)

# On-Prem
your-server:443 (configurable)
```

### Data Handling

- **Test scripts**: Stored locally in agent
- **Screenshots**: Transmitted only during active recording (encrypted)
- **Credentials**: Never transmitted, entered directly in browser
- **Logs**: Local only, configurable retention

### Compliance

- SOC 2 Type II (SaaS)
- GDPR compliant data handling
- On-prem for data sovereignty requirements

---

## Troubleshooting

### Agent Won't Connect

1. Check server URL in settings
2. Verify network connectivity: `ping flowstral.yourcompany.com`
3. Check firewall rules for HTTPS/WSS
4. Review logs: `%APPDATA%\flowstral-desktop\logs\`

### License Issues

1. Verify key format: `FLOWSTRAL-XXXXX-XXXXX-XXXXX-XXXXX`
2. Check expiration date
3. Verify activation count not exceeded
4. Try offline validation (air-gapped mode)

### Recording Problems

1. Clear browser data folder
2. Reinstall Playwright browsers
3. Check for antivirus interference
4. Review agent logs for errors

---

## Support Contacts

- **Enterprise Support**: enterprise@flowstral.com
- **Technical Issues**: support@flowstral.com
- **Sales Inquiries**: sales@flowstral.com
- **Documentation**: https://docs.flowstral.com

