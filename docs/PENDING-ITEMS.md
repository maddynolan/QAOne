# Pending Items — Flowstral Platform

> Track all in-progress and upcoming work. Updated: 2026-03-14

---

## IDE Extensions & MCP (Built, Not Published)

| Item | Status | Next Step |
|------|--------|-----------|
| MCP Server (`flowstral-mcp/`) | Code complete, builds | Publish to npm as `@flowstral/mcp-server` |
| VS Code Extension (`flowstral-vscode/`) | Code complete, compiles | Package `.vsix`, publish to VS Code Marketplace |
| IntelliJ Plugin (`flowstral-intellij/`) | Code complete, built zip | Publish to JetBrains Marketplace |
| Marketplace accounts | Not started | Create publisher accounts (npm, VS Code Marketplace, JetBrains) |
| Extension icons/branding | Basic SVG placeholder | Design proper marketplace icons and banners |
| Extension testing | Not started | Test against running backend, fix any API mismatches |

---

## Code Signing & Distribution

| Item | Status | Next Step |
|------|--------|-----------|
| Azure Trusted Signing setup | Not started | Create Azure account, register Trusted Signing resource |
| Electron Builder integration | Not started | Add `azureSignOptions` to `flowstral-desktop/package.json` |
| CI/CD signing pipeline | Not started | Add signing to GitHub Actions workflow |
| SmartScreen validation | Not started | Verify no warnings after signing |

---

## Deployment & Infrastructure

| Item | Status | Decision |
|------|--------|----------|
| Hosting | Hetzner + Coolify (current recommendation) | Evaluate Azure only if enterprise customers require it |
| Domain setup | `flowstral.com` | Need `api.flowstral.com` pointing to backend |
| SSL/TLS | Via Coolify auto-cert | Already configured in deployment guide |

---

## Enterprise AI Testing (Previously Planned — 4 Priorities)

| Item | Status | Notes |
|------|--------|-------|
| Priority 1: AI Testing Polish | Completed (v3.25.x) | AgenticOrchestrator, FlowpilotPage, AIChatTesting |
| Priority 2: Blaze Explorer Rebuild | Completed (v3.25.x) | Concurrent crawling, auth, SSE, defect screenshots |
| Priority 3: Visual Assertions Per Step | Completed (v3.25.x) | Step-assert endpoint, PlaywrightRunner integration |
| Priority 4: Screenshot Streaming | Completed (v3.25.x) | WebSocket streaming, JPEG optimization |

---

## Marketing & Growth

| Item | Status | Next Step |
|------|--------|-----------|
| Marketing pages | Complete | Landing, Pricing, Compare, Blog, Demo, About, etc. |
| Analytics (GA4, Clarity, Crisp) | Configured | Need env vars set in production |
| SEO (sitemap, robots.txt, meta) | Complete | Monitor search console after deployment |
| Chrome Web Store extension | Submitted | Awaiting review |
