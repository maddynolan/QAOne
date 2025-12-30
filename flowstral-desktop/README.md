# Flowstral Desktop Agent

Enterprise-grade test automation agent that runs on your machine, controls browsers via Playwright, and connects to Flowstral Cloud or your On-Premise server.

## Features

- **Native Browser Control**: Uses Playwright for reliable, fast browser automation
- **Persistent Sessions**: Remembers logins, MFA, and cookies across sessions
- **Smart Recording**: Captures user interactions with intelligent element detection
- **Self-Healing Locators**: Multiple fallback selectors for resilient tests
- **Cloud & On-Prem**: Works with Flowstral Cloud or your private server
- **License Management**: Flexible licensing for teams and enterprises
- **Auto-Updates**: Seamless updates with rollback capability

## System Requirements

- **Windows**: Windows 10/11 (64-bit)
- **macOS**: macOS 10.15 (Catalina) or later
- **Linux**: Ubuntu 18.04+, Debian 9+, CentOS 7+
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 500MB for installation + browser data

## Installation

### Windows
1. Download `Flowstral-Setup.exe` from your portal
2. Run the installer and follow the prompts
3. Launch from Start Menu or Desktop

### macOS
1. Download `Flowstral.dmg` from your portal
2. Open the DMG and drag Flowstral to Applications
3. Launch from Applications folder

### Linux
1. Download `Flowstral.AppImage` from your portal
2. Make it executable: `chmod +x Flowstral.AppImage`
3. Run: `./Flowstral.AppImage`

## License Activation

1. Open Flowstral Desktop
2. Go to Settings > License
3. Enter your license key (format: `FLOWSTRAL-XXXXX-XXXXX-XXXXX-XXXXX`)
4. Click "Activate"

### License Types

| Type | Users | Features | Support |
|------|-------|----------|---------|
| Trial | 1 | Basic recording & playback | Community |
| Professional | 1 | + Reports, Parallel, API | Email (48h) |
| Enterprise | 5-50 | + CI/CD, Self-Healing, AI | Priority (24h) |
| Unlimited | Org-wide | + Custom integrations | Dedicated (4h) |

## Connecting to Server

### Flowstral Cloud (SaaS)
1. Go to Settings > Server Connection
2. Server URL should be: `https://app.flowstral.com`
3. Click "Connect"

### On-Premise Server
1. Ensure your Flowstral server is running
2. Go to Settings > Server Connection
3. Enter your server URL (e.g., `https://flowstral.yourcompany.com`)
4. Click "Connect"

## Recording Tests

1. Enter a URL in the Test Studio
2. Click "Start Recording"
3. Interact with the browser window that opens
4. Click "Stop Recording" when done
5. Review and edit recorded steps
6. Click "Generate Test" to create automation code

## Configuration

Settings are stored in:
- **Windows**: `%APPDATA%\flowstral-desktop\config.json`
- **macOS**: `~/Library/Application Support/flowstral-desktop/config.json`
- **Linux**: `~/.config/flowstral-desktop/config.json`

### Browser Data Location

Persistent browser data (cookies, sessions) is stored in:
- **Windows**: `%APPDATA%\.flowstral\browser-data`
- **macOS**: `~/.flowstral/browser-data`
- **Linux**: `~/.flowstral/browser-data`

## Command Line Options

```bash
# Start in development mode (DevTools open)
flowstral --dev

# Specify a different server
flowstral --server https://custom.server.com

# Reset all settings
flowstral --reset
```

## Troubleshooting

### Browser won't launch
- Ensure no antivirus is blocking Playwright browsers
- Try deleting `browser-data` folder and restarting

### Can't connect to server
- Check server URL is correct
- Verify firewall allows outbound WebSocket connections
- Try pinging the server: `ping app.flowstral.com`

### License activation fails
- Ensure internet connectivity
- Check license hasn't expired
- Verify you haven't exceeded device limit

### Recording captures wrong elements
- Try clicking directly on text instead of containers
- Use the element inspector to manually adjust selectors
- Report issues to improve our AI detection

## Building from Source

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Run in development
npm run dev

# Build for distribution
npm run build       # All platforms
npm run build:win   # Windows only
npm run build:mac   # macOS only
npm run build:linux # Linux only
```

## Security

- All communications use TLS encryption
- License keys are stored encrypted
- Browser automation uses sandboxed contexts
- No test data leaves your network without explicit cloud configuration

## Support

- **Documentation**: https://docs.flowstral.com
- **Email**: support@flowstral.com
- **Community**: https://community.flowstral.com

## Version History

### v1.0.0 (December 2024)
- Initial release
- Browser recording with Playwright
- License management
- Cloud & On-Prem connectivity
- Windows, macOS, Linux support

---

Copyright (c) 2024 Flowstral Inc. All Rights Reserved.

