# Feature: Marketing Pages, SEO & Web Analytics

> Public-facing marketing infrastructure including 18 pages, GA4/Clarity/Crisp analytics, UTM tracking, SEO meta tags, Schema.org structured data, and lead capture.

Last updated: 2026-02-20

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Marketing Pages Inventory](#3-marketing-pages-inventory)
4. [Web Analytics Service](#4-web-analytics-service)
5. [SEO Infrastructure](#5-seo-infrastructure)
6. [Lead Capture](#6-lead-capture)
7. [Event Tracking Reference](#7-event-tracking-reference)
8. [Configuration](#8-configuration)
9. [Known Gaps & TODOs](#9-known-gaps--todos)

---

## 1. Overview

Flowstral's marketing layer is a set of 18 public-facing React pages that serve as the product's website, combined with a unified analytics service, SEO infrastructure, and lead capture pipeline. All marketing pages are public routes (no authentication required) and are rendered as standard React components using React Router.

**Total codebase:** ~8,500 lines across 18 page files + 224-line analytics service + 130-line leads service + SEO assets.

Key capabilities:

- **18 marketing pages** covering landing, pricing, product features, competitor comparisons, blog, cost calculator, legal, and auth flows
- **3 analytics providers** (Google Analytics 4, Microsoft Clarity, Crisp Live Chat) injected dynamically at runtime
- **UTM parameter tracking** with sessionStorage persistence and CRM pre-fill
- **Schema.org structured data** (SoftwareApplication + Organization) embedded in `index.html`
- **SEO assets**: sitemap.xml (28 URLs), robots.txt (marketing allow / app disallow), Open Graph + Twitter Card meta tags
- **Lead capture service** posting to `POST /api/leads/capture` with UTM attribution
- **Electron exclusion**: all analytics and tracking are disabled when running inside the desktop app

---

## 2. Architecture

```
User Browser (Marketing Site)
+---------------------------------------------------------------+
|                                                                 |
|  App.tsx                                                        |
|  ├── useEffect → initAnalytics()                                |
|  │   ├── injectGA4()      → <script> gtag.js                   |
|  │   ├── injectClarity()  → <script> clarity.ms                |
|  │   ├── injectCrisp()    → <script> crisp.chat                |
|  │   └── captureUTMParams() → sessionStorage                   |
|  │                                                              |
|  ├── <RouteTracker />     → trackPageView() on every navigate   |
|  │                                                              |
|  └── <Routes>                                                   |
|      ├── /                  → LandingPage                       |
|      ├── /pricing           → PricingPage                       |
|      ├── /demo              → DemoPage                          |
|      ├── /about             → AboutPage                         |
|      ├── /contact           → ContactPage                       |
|      ├── /download          → DownloadPage                      |
|      ├── /signup            → SignUpPage                        |
|      ├── /signin            → SignInPage                        |
|      ├── /welcome           → WelcomePage                       |
|      ├── /faq               → FAQPage                           |
|      ├── /blog              → BlogPage                          |
|      ├── /blog/:slug        → BlogPage (article view)           |
|      ├── /compare/:comp     → ComparePage (5 competitors)       |
|      ├── /tools/cost-calc   → CostCalculatorPage                |
|      ├── /products/smart-*  → SmartRecorderPage                 |
|      ├── /products/:feature → FeaturePage (10 product configs)  |
|      ├── /terms             → TermsPage                         |
|      ├── /privacy           → PrivacyPage                       |
|      ├── /resources/:page   → PlaceholderPage                   |
|      └── /company/:page     → PlaceholderPage                   |
|                                                                 |
+---------------------------------------------------------------+
          |                    |                    |
          v                    v                    v
    Google Analytics 4   Microsoft Clarity    Crisp Live Chat
    (page views, events) (session replays)   (widget, chat)
          |
          v
    Lead Capture API
    POST /api/leads/capture
    (email, name, company, source, UTM params)
```

### Data Flow — Analytics

1. `App.tsx` calls `initAnalytics()` once in `useEffect` on mount
2. `initAnalytics()` checks `isElectron()` — if true, returns immediately (no tracking in desktop app)
3. If env vars are present, injects GA4, Clarity, and Crisp `<script>` tags into `<head>` dynamically
4. `captureUTMParams()` reads `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` from URL query string, stores in `sessionStorage` key `flowstral_utm`, and fires a `campaign_hit` GA4 event
5. `RouteTracker` component (rendered inside `<Router>`) calls `trackPageView(location.pathname)` on every route change via `useLocation` + `useEffect`
6. Individual pages call `trackCTAClick()`, `trackSignup()`, `trackPricingView()`, `trackEnterpriseInquiry()`, etc. on specific user actions

### Data Flow — Lead Capture

1. User fills out form on SignUpPage or ContactPage
2. Page calls `captureSignupLead()` or `captureContactLead()` from `leads-service.ts`
3. Service auto-attaches UTM params from URL, current page URL
4. `POST /api/leads/capture` fires asynchronously (non-blocking — failure does not prevent signup)

---

## 3. Marketing Pages Inventory

### 3.1 Full Page Table

| # | Page | File | Route | Lines | Purpose |
|---|------|------|-------|-------|---------|
| 1 | Landing | `src/pages/LandingPage.tsx` | `/`, `/landing` | 1,962 | Hero with interactive tab switcher showing all 8 testing modules, social proof section, CTA section |
| 2 | Pricing | `src/pages/marketing/PricingPage.tsx` | `/pricing` | 774 | Free vs Enterprise tiers, 8 testing packs with feature lists, FAQ accordion |
| 3 | Demo | `src/pages/marketing/DemoPage.tsx` | `/demo` | 1,070 | Interactive product walkthrough with feature spotlights |
| 4 | Compare | `src/pages/marketing/ComparePage.tsx` | `/compare/:competitor` | 464 | Dynamic competitor comparison — 5 configs: katalon, selenium, postman, cypress, tricentis |
| 5 | Blog | `src/pages/marketing/BlogPage.tsx` | `/blog`, `/blog/:slug` | 344 | 8 seed posts, category filtering, search, featured posts |
| 6 | Cost Calculator | `src/pages/marketing/CostCalculatorPage.tsx` | `/tools/cost-calculator` | 357 | Interactive savings estimator with 8 tool categories |
| 7 | FAQ | `src/pages/marketing/FAQPage.tsx` | `/faq` | 372 | 15+ questions in accordion layout |
| 8 | Feature | `src/pages/marketing/FeaturePage.tsx` | `/products/:feature` | 354 | Dynamic feature landing for 10 product areas |
| 9 | Smart Recorder | `src/pages/marketing/SmartRecorderPage.tsx` | `/products/smart-recorder` | 325 | Dedicated feature spotlight for the Smart Recorder |
| 10 | Welcome | `src/pages/marketing/WelcomePage.tsx` | `/welcome` | 350 | Post-signup onboarding flow |
| 11 | SignUp | `src/pages/marketing/SignUpPage.tsx` | `/signup` | 329 | Registration with email validation, lead capture |
| 12 | Privacy | `src/pages/marketing/PrivacyPage.tsx` | `/privacy` | 376 | Privacy policy |
| 13 | Terms | `src/pages/marketing/TermsPage.tsx` | `/terms` | 306 | Terms of service |
| 14 | Contact | `src/pages/marketing/ContactPage.tsx` | `/contact` | 281 | Enterprise sales inquiry form with lead capture |
| 15 | Placeholder | `src/pages/marketing/PlaceholderPage.tsx` | `/resources/:page`, `/company/:page` | 244 | Fallback for unbuilt resource/company pages |
| 16 | About | `src/pages/marketing/AboutPage.tsx` | `/about` | 234 | Company values, mission, team |
| 17 | SignIn | `src/pages/marketing/SignInPage.tsx` | `/signin` | 200 | Login page |
| 18 | Download | `src/pages/marketing/DownloadPage.tsx` | `/download` | 161 | Desktop app download with platform detection |

### 3.2 Landing Page (`/`)

**File:** `src/pages/LandingPage.tsx` (1,962 lines)

The primary entry point for the marketing site. In Electron, `/` redirects to `/dashboard` via the `RootRoute` component in `App.tsx`.

**Sections:**
- **MarketingHeader** — Sticky header with navigation links (Features, Pricing, Compare, Blog, About) and Sign In / Start Free CTAs
- **HeroSection** — Main headline, sub-headline, interactive tab switcher showing all 8 testing modules with descriptions
- **Flowpilot CTA** — Gradient card linking to `/products/flowpilot` (AI agent feature)
- **SocialProofSection** — Tool replacement visual (Selenium, Postman, JMeter, Applitools, axe DevTools, Sauce Labs crossed out, replaced by Flowstral), 3 value proposition cards (Consolidate Your QA Stack, Self-Healing Locators, No-Code Visual Builder), 4 trust indicators (On-Prem/Air-Gapped Ready, RBAC & Multi-Tenant, Docker + Kubernetes, Free Forever Plan)
- **CTASection** — Final conversion section with Start Free and Schedule Demo buttons
- **Footer** — Links to all marketing pages organized by category

**Analytics:** `trackCTAClick()` on all buttons — `explore_flowpilot`, `watch_demo`, `get_started_free`, `schedule_demo`, `sign_in`, `start_free`

### 3.3 Pricing Page (`/pricing`)

**File:** `src/pages/marketing/PricingPage.tsx` (774 lines)

Two-tier pricing with 8 testing packs:

| Tier | Price | Users | Test Runs | Included Packs |
|------|-------|-------|-----------|-----------------|
| Community (Free) | $0 | Up to 3 | 1,000/month | Smart Recorder, Visual Builder, REST & GraphQL API |
| Enterprise | Custom | Unlimited | Unlimited | All 8 packs, on-prem, SSO/SAML, 24/7 support |

**8 Testing Packs:** Automation, API Testing, Performance, Visual Testing, Accessibility, Mobile Testing, Salesforce, Test Management

**Analytics:** `trackPricingView()` on mount, `trackCTAClick()` on all tier buttons (`get_started_free`, `talk_to_sales`, `request_demo`, `contact_sales`, `chat_with_us`, `get_started_free_bottom`, `talk_to_sales_bottom`)

### 3.4 Comparison Pages (`/compare/:competitor`)

**File:** `src/pages/marketing/ComparePage.tsx` (464 lines)

Data-driven dynamic page that renders a comparison layout for each competitor. Uses a `CompetitorConfig` interface with `name`, `tagline`, `typicalCost`, `category`, `limitations[]`, `comparison[]` (feature rows with yes/partial/no status), `switchReasons[]`, and SEO metadata (`seoTitle`, `seoDescription`).

**5 Competitor Configs:**

| Slug | Competitor | Typical Cost |
|------|-----------|-------------|
| `katalon` | Katalon | $15K-60K/year |
| `selenium` | Selenium | $0 (OSS) + $50K-150K tooling |
| `postman` | Postman | $10K-30K/year |
| `cypress` | Cypress | $10K-40K/year |
| `tricentis` | Tricentis | $80K-300K/year |

Each config includes 14-16 feature comparison rows with status icons (check = yes, minus = partial, X = no) for both Flowstral and the competitor.

**Analytics:** `trackEvent('compare_view', { competitor })` on mount, `trackCTAClick()` on header and footer CTAs

### 3.5 Blog (`/blog`, `/blog/:slug`)

**File:** `src/pages/marketing/BlogPage.tsx` (344 lines)

Content marketing hub with 8 seed posts defined as inline data (can later be backed by CMS or MDX).

**Exported types:** `BlogPost` interface and `blogPosts` array (available for reuse across the app).

**BlogPost interface:**
```typescript
interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  date: string;
  featured?: boolean;
}
```

**Categories:** All, Best Practices, Migration Guides, Industry Trends, Tutorials, Salesforce, ROI & Strategy

**Features:**
- Category filtering via tab buttons
- Search across titles and excerpts
- Featured posts section for posts with `featured: true`
- Individual article view via `/blog/:slug`
- CTA section at bottom linking to signup

### 3.6 Cost Calculator (`/tools/cost-calculator`)

**File:** `src/pages/marketing/CostCalculatorPage.tsx` (357 lines)

Interactive savings estimator where users check which tool categories they currently use.

**8 Tool Categories:**

| Category | Examples | Annual Cost Range |
|----------|----------|-------------------|
| Browser Automation | Selenium, Cypress, Playwright, TestCafe | $15K-40K |
| API Testing | Postman, SoapUI, Insomnia, REST Assured | $10K-25K |
| Performance / Load | JMeter, k6, Gatling, NeoLoad, LoadRunner | $15K-50K |
| Visual Testing | Applitools, Percy, Chromatic | $12K-30K |
| Accessibility | Axe, WAVE, Deque, Siteimprove | $8K-20K |
| Mobile Testing | BrowserStack, Sauce Labs, Appium | $20K-60K |
| Salesforce Testing | Provar, Copado, OwnBackup | $25K-80K |
| Test Management | TestRail, Zephyr, qTest, PractiTest | $10K-30K |

**Calculation output:** Current annual spend, Flowstral cost, annual savings, per-tool breakdown, hidden savings (training, integration, context-switching)

**Analytics:** `trackEvent('cost_calculator_used', { tools_selected, estimated_savings })` fires when 2 or more tools are selected

### 3.7 Feature Pages (`/products/:feature`)

**File:** `src/pages/marketing/FeaturePage.tsx` (354 lines)

Template-based page that renders a different product feature landing based on the `:feature` URL parameter. Each config includes `title`, `tagline`, `description`, `icon`, color gradients, 6 feature cards, and highlight bullets.

**10 Feature Configs:**

| Slug | Title |
|------|-------|
| `visual-builder` | Visual Builder |
| `test-management` | Test Management |
| `api-testing` | API Testing |
| `performance-testing` | Performance Testing |
| `visual-testing` | Visual Testing |
| `accessibility-testing` | Accessibility Testing |
| `salesforce` | Salesforce Native |
| `analytics` | Analytics & Dashboards |
| `flowpilot` | Flowpilot |
| `mobile-testing` | Mobile Testing |

### 3.8 Dedicated Feature Page: Smart Recorder

**File:** `src/pages/marketing/SmartRecorderPage.tsx` (325 lines)
**Route:** `/products/smart-recorder`

Separate from the generic `FeaturePage` template. Has a dedicated route that takes priority over `/products/:feature` in the router (defined first in `App.tsx`).

### 3.9 Auth Pages

**SignUpPage** (`src/pages/marketing/SignUpPage.tsx`, 329 lines, `/signup`):
- Registration form with email, name, company, password fields
- Email validation
- Calls `captureSignupLead()` on success (lead capture)
- Fires `trackSignup('email')` on successful registration

**SignInPage** (`src/pages/marketing/SignInPage.tsx`, 200 lines, `/signin`):
- Login form with email and password
- Fires `trackEvent('login', { method: 'email' })` on successful sign-in

### 3.10 Other Pages

| Page | Key Details |
|------|-------------|
| **DemoPage** | Interactive product walkthrough (1,070 lines), hero + feature spotlights + final CTA |
| **ContactPage** | Enterprise sales form, calls `captureContactLead()` + `trackEnterpriseInquiry()` on submit |
| **DownloadPage** | Desktop app download with platform detection, `trackDownload()` available |
| **WelcomePage** | Post-signup onboarding flow |
| **FAQPage** | 15+ questions in accordion layout |
| **AboutPage** | Company values, mission statement |
| **TermsPage** | Legal terms of service |
| **PrivacyPage** | Privacy policy |
| **PlaceholderPage** | Fallback for `/resources/:page` and `/company/:page` (future pages) |

---

## 4. Web Analytics Service

**File:** `src/lib/web-analytics.ts` (224 lines)

Unified analytics service that manages 3 providers. All scripts are injected dynamically at runtime -- no modifications to `index.html` are required. The entire module is a no-op in Electron.

### 4.1 Providers

| Provider | Env Variable | Purpose |
|----------|-------------|---------|
| Google Analytics 4 | `VITE_GA4_MEASUREMENT_ID` | Page views, custom events, conversion tracking |
| Microsoft Clarity | `VITE_CLARITY_PROJECT_ID` | Session recordings, heatmaps, user behavior |
| Crisp Live Chat | `VITE_CRISP_WEBSITE_ID` | Live chat widget, customer support |

### 4.2 Electron Detection

The `isElectron()` function checks three signals:
1. `window.electron` exists (preload context bridge)
2. `window.flowstral` exists (Flowstral-specific bridge)
3. `navigator.userAgent` contains `'electron'`

If any signal is true, `initAnalytics()` returns immediately and no tracking scripts are injected.

### 4.3 Exported Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `initAnalytics()` | `() => void` | One-time init: inject GA4 + Clarity + Crisp, capture UTM params. Safe to call multiple times. |
| `trackPageView(path, title?)` | `(string, string?) => void` | Fire `page_view` event. Called by `RouteTracker` on every route change. |
| `trackEvent(eventName, params?)` | `(string, EventParams?) => void` | Generic custom GA4 event. |
| `trackCTAClick(ctaName, page)` | `(string, string) => void` | Fire `cta_click` with CTA name and page path. |
| `trackSignup(method?)` | `(string?) => void` | Fire `sign_up` event. Default method: `'email'`. |
| `trackFeatureEngaged(feature)` | `(string) => void` | Fire `feature_engaged` for first-use of a module. |
| `trackDownload(platform)` | `(string) => void` | Fire `app_download` for desktop downloads. |
| `trackPricingView()` | `() => void` | Fire `pricing_view`. Called on PricingPage mount. |
| `trackEnterpriseInquiry()` | `() => void` | Fire `enterprise_inquiry`. Called on ContactPage form submit. |
| `getUTMParams()` | `() => Record<string, string>` | Retrieve stored UTM params from `sessionStorage` key `flowstral_utm`. |
| `openCrispChat()` | `() => void` | Programmatically open the Crisp chat widget. |

### 4.4 UTM Parameter Tracking

**Capture flow:**
1. `captureUTMParams()` runs inside `initAnalytics()`
2. Reads 5 UTM keys from `window.location.search`: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
3. If any UTM param is present, stores them as JSON in `sessionStorage` key `flowstral_utm`
4. Fires `campaign_hit` GA4 event with the UTM params as event properties

**Retrieval:** `getUTMParams()` reads from `sessionStorage` and returns the stored object. Used by `leads-service.ts` for form pre-fill and attribution.

### 4.5 RouteTracker Component

Defined in `App.tsx` (line 151):

```typescript
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);
  return null;
}
```

Rendered inside the `<Router>` at the top level. Fires a `page_view` GA4 event on every client-side navigation.

### 4.6 GA4 Configuration

GA4 is configured with `send_page_view: false` to prevent automatic page view tracking. Page views are fired manually by `RouteTracker` to ensure accurate tracking of client-side route changes in the SPA.

---

## 5. SEO Infrastructure

### 5.1 Meta Tags (`index.html`)

**File:** `index.html` (105 lines)

| Tag Type | Content |
|----------|---------|
| `<title>` | Flowstral - Replace 5-8 QA Tools With One Platform |
| `<meta name="description">` | Unified no-code QA platform: browser recording, API testing, performance, visual regression, accessibility scanning, mobile & Salesforce testing. |
| `<meta name="keywords">` | test automation, QA platform, no-code testing, selenium alternative, postman alternative, visual testing, accessibility testing, load testing, API testing, Salesforce testing, browser recording, playwright |
| `<link rel="canonical">` | `https://flowstral.com/` |
| `<meta name="theme-color">` | `#6366f1` (indigo) |

### 5.2 Open Graph Tags

| Property | Value |
|----------|-------|
| `og:title` | Flowstral - Replace 5-8 QA Tools With One Platform |
| `og:description` | Unified no-code QA platform... Free to start. |
| `og:type` | website |
| `og:url` | `https://flowstral.com/` |
| `og:image` | `https://flowstral.com/og-image.png` |
| `og:site_name` | Flowstral |

### 5.3 Twitter Card Tags

| Property | Value |
|----------|-------|
| `twitter:card` | summary_large_image |
| `twitter:site` | @Flowstral |
| `twitter:title` | Flowstral - Replace 5-8 QA Tools With One Platform |
| `twitter:description` | Unified no-code QA platform... Free to start. |
| `twitter:image` | `https://flowstral.com/og-image.png` |

### 5.4 Schema.org Structured Data (JSON-LD)

Two structured data blocks are embedded in `index.html`:

**1. SoftwareApplication:**
```json
{
  "@type": "SoftwareApplication",
  "name": "Flowstral",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Windows, macOS, Linux, Web",
  "offers": [
    { "name": "Community (Free)", "price": "0" },
    { "name": "Enterprise", "price": "6500" }
  ],
  "aggregateRating": {
    "ratingValue": "4.8",
    "ratingCount": "50",
    "bestRating": "5"
  },
  "featureList": [
    "Browser Test Recording",
    "Visual No-Code Test Builder",
    "Multi-Protocol API Testing",
    "Performance & Load Testing",
    "Visual Regression Testing",
    "WCAG Accessibility Scanning",
    "Mobile Testing via Maestro",
    "Salesforce Native Testing",
    "AI Self-Healing Locators",
    "Cross-Browser Testing"
  ]
}
```

**2. Organization:**
```json
{
  "@type": "Organization",
  "name": "Flowstral",
  "url": "https://flowstral.com",
  "logo": "https://flowstral.com/flowstral-logo.svg",
  "sameAs": [
    "https://github.com/maddynolan/QAOne",
    "https://twitter.com/Flowstral"
  ],
  "contactPoint": {
    "contactType": "sales",
    "email": "sales@flowstral.com",
    "telephone": "+1-360-878-3752"
  }
}
```

### 5.5 Sitemap (`public/sitemap.xml`)

28 URLs organized into 5 groups:

| Group | Count | URLs |
|-------|-------|------|
| Core Marketing | 8 | `/`, `/pricing`, `/demo`, `/about`, `/contact`, `/download`, `/signup`, `/faq` |
| Product Features | 10 | `/products/smart-recorder`, `/products/visual-builder`, `/products/test-management`, `/products/api-testing`, `/products/performance-testing`, `/products/visual-testing`, `/products/accessibility-testing`, `/products/salesforce`, `/products/flowpilot`, `/products/mobile-testing` |
| Comparisons | 5 | `/compare/katalon`, `/compare/selenium`, `/compare/postman`, `/compare/cypress`, `/compare/tricentis` |
| Tools | 1 | `/tools/cost-calculator` |
| Legal | 2 | `/terms`, `/privacy` |

Priority mapping: `/` = 1.0, `/pricing` `/demo` `/signup` = 0.9, comparisons + features + tools = 0.8, `/about` = 0.7, `/faq` = 0.5, legal = 0.3

### 5.6 Robots.txt (`public/robots.txt`)

```
User-agent: Googlebot    → Allow: /
User-agent: Bingbot       → Allow: /
User-agent: Twitterbot    → Allow: /
User-agent: facebookexternalhit → Allow: /

User-agent: *
Allow: /
Disallow: /app
Disallow: /recorder
Disallow: /test-cases
Disallow: /dashboard
Disallow: /api
Disallow: /performance
Disallow: /admin

Sitemap: https://flowstral.com/sitemap.xml
```

Marketing pages are crawlable. All authenticated app routes are blocked from indexing.

---

## 6. Lead Capture

### 6.1 Leads Service

**File:** `src/lib/leads-service.ts` (130 lines)

Provides a unified lead capture pipeline that posts to `POST /api/leads/capture`. Lead capture is non-blocking -- if the API call fails, the user's primary action (signup, form submit) still succeeds.

### 6.2 LeadData Interface

```typescript
interface LeadData {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  source: 'signup' | 'contact' | 'demo' | 'pricing' | 'download';
  message?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  page_url?: string;
}
```

### 6.3 Helper Functions

| Function | Called From | Source Value |
|----------|-----------|-------------|
| `captureSignupLead(email, name?, company?)` | `SignUpPage.tsx` on successful registration | `'signup'` |
| `captureContactLead(email, name?, company?, message?, subject?)` | `ContactPage.tsx` on form submit | `'contact'` |
| `captureDemoLead(email, name?, company?)` | Available for demo request forms | `'demo'` |
| `capturePricingLead(email, name?, company?)` | Available for pricing page conversions | `'pricing'` |
| `captureLead(data)` | Base function called by all helpers | Per `data.source` |

### 6.4 UTM Attribution

The `captureLead()` function automatically enriches lead data with:
1. `page_url` — current `window.location.href` if not already provided
2. `utm_source`, `utm_medium`, `utm_campaign` — extracted from URL query params at the time of capture

This complements the `getUTMParams()` function from `web-analytics.ts` which retrieves session-persisted UTM params for form pre-fill.

---

## 7. Event Tracking Reference

### 7.1 All GA4 Events

| Event Name | Function | Where Fired | Key Parameters |
|------------|----------|-------------|----------------|
| `page_view` | `trackPageView()` | `RouteTracker` (App.tsx) on every route change | `page_path`, `page_title`, `page_location` |
| `cta_click` | `trackCTAClick(name, page)` | All marketing page buttons | `cta_name`, `page` |
| `sign_up` | `trackSignup(method)` | SignUpPage on successful registration | `method` (default: `'email'`) |
| `login` | `trackEvent('login')` | SignInPage on successful sign-in | `method` |
| `pricing_view` | `trackPricingView()` | PricingPage on mount | (none) |
| `enterprise_inquiry` | `trackEnterpriseInquiry()` | ContactPage on form submit | (none) |
| `campaign_hit` | `captureUTMParams()` | Auto on init when URL has `utm_*` params | `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` |
| `cost_calculator_used` | `trackEvent()` | CostCalculatorPage when 2+ tools selected | `tools_selected`, `estimated_savings` |
| `compare_view` | `trackEvent()` | ComparePage on mount | `competitor` |
| `feature_engaged` | `trackFeatureEngaged()` | Available for in-app feature tracking | `feature` |
| `app_download` | `trackDownload()` | Available for download tracking | `platform` |

### 7.2 All CTA Names Used

Organized by page:

**LandingPage:**
- `start_free` — header Start Free button
- `sign_in` — header Sign In button
- `explore_flowpilot` — Flowpilot CTA card
- `watch_demo` — hero Watch Demo button
- `get_started_free` — bottom CTA section
- `schedule_demo` — bottom CTA section

**PricingPage:**
- `start_free` — header
- `sign_in` — header
- `get_started_free` — Free tier CTA
- `talk_to_sales` — Enterprise tier CTA
- `request_demo` — Enterprise tier CTA
- `contact_sales` — FAQ section
- `chat_with_us` — FAQ section
- `get_started_free_bottom` — bottom CTA
- `talk_to_sales_bottom` — bottom CTA

**ComparePage:**
- `start_free` — header
- `sign_in` — header
- `get_started_free` — bottom CTA
- `talk_to_sales` — bottom CTA

**BlogPage:**
- `start_free` — header
- `sign_in` — header
- `get_started_free` — bottom CTA

**CostCalculatorPage:**
- `start_free` — header
- `sign_in` — header
- `get_started_free` — results CTA
- `talk_to_sales` — results CTA

**DemoPage:**
- `start_free` — header
- `sign_in` — header
- `start_free_trial` — bottom CTA
- `schedule_live_demo` — bottom CTA

**ContactPage:**
- `start_free` — header
- `sign_in` — header

**DownloadPage:**
- `start_free` — header
- `sign_in` — header
- `create_account_download` — download CTA

---

## 8. Configuration

### 8.1 Environment Variables

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `VITE_GA4_MEASUREMENT_ID` | No | `G-XXXXXXXXXX` | Google Analytics 4 measurement ID |
| `VITE_CLARITY_PROJECT_ID` | No | `abc123xyz` | Microsoft Clarity project ID |
| `VITE_CRISP_WEBSITE_ID` | No | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Crisp website ID (from app.crisp.chat Settings) |

All three are optional. If none are set, `initAnalytics()` returns immediately and no analytics are active.

### 8.2 Key Files

| File | Purpose |
|------|---------|
| `src/lib/web-analytics.ts` | Analytics service (224 lines) — GA4, Clarity, Crisp, UTM |
| `src/lib/leads-service.ts` | Lead capture service (130 lines) — POST /api/leads/capture |
| `src/App.tsx` | RouteTracker component + initAnalytics() call |
| `index.html` | SEO meta tags, Open Graph, Twitter Card, Schema.org JSON-LD |
| `public/sitemap.xml` | 28-URL sitemap for search engines |
| `public/robots.txt` | Crawler directives (allow marketing, disallow app) |
| `src/pages/LandingPage.tsx` | Main landing page (1,962 lines) |
| `src/pages/marketing/*.tsx` | 17 marketing page components |

### 8.3 Adding a New Marketing Page

1. Create component in `src/pages/marketing/NewPage.tsx`
2. Add route in `src/App.tsx` inside the public routes block (lines 248-266)
3. Add URL to `public/sitemap.xml` with appropriate priority and changefreq
4. Import and use `trackCTAClick()` from `@/lib/web-analytics` for button tracking
5. Add consistent header using the `MarketingHeader` pattern (sticky, with Sign In + Start Free CTAs)
6. If the page has a conversion action, use the appropriate lead capture helper from `@/lib/leads-service`

### 8.4 Adding a New Competitor Comparison

Add a new entry to the `competitors` record in `src/pages/marketing/ComparePage.tsx`:

```typescript
competitors['new-tool'] = {
  name: 'New Tool',
  tagline: 'One-line comparison headline',
  description: 'Paragraph explaining the competitor and gaps',
  typicalCost: '$X-YK/year',
  category: 'Category',
  limitations: ['Limitation 1', 'Limitation 2'],
  comparison: [
    { feature: 'Feature Name', flowstral: 'yes', competitor: 'no', note: 'Optional note' },
    // ... 14-16 rows
  ],
  switchReasons: ['Reason 1', 'Reason 2'],
  seoTitle: 'Flowstral vs New Tool',
  seoDescription: 'Meta description for SEO',
};
```

Then add the URL to `public/sitemap.xml`.

### 8.5 Adding a New Feature Page Product

Add a new entry to the `featureConfigs` record in `src/pages/marketing/FeaturePage.tsx`:

```typescript
featureConfigs['new-feature'] = {
  title: 'Feature Name',
  tagline: 'Short tagline',
  description: 'Feature description paragraph',
  icon: SomeLucideIcon,
  gradient: 'from-color-500 to-color-600',
  bgGradient: 'from-color-50 to-color-100',
  features: [
    { icon: Icon1, title: 'Card Title', desc: 'Card description' },
    // ... 6 feature cards
  ],
  highlights: ['Highlight 1', 'Highlight 2'],
};
```

Then add the URL to `public/sitemap.xml`.

---

## 9. Known Gaps & TODOs

| # | Gap | Impact | Suggested Fix |
|---|-----|--------|---------------|
| 1 | Blog posts are hardcoded inline data — no CMS or MDX backend | Content updates require code changes and deploys | Migrate to MDX files or headless CMS (Contentful, Sanity, Strapi) |
| 2 | `og-image.png` referenced in meta tags but may not exist in `public/` | Social sharing shows broken image | Create and add OG image (1200x630px) to `public/` |
| 3 | Blog article view (`/blog/:slug`) renders within the same `BlogPage` component — no dedicated article layout with full content | Blog posts only show excerpts, no full article body | Add full article content to blog post data or MDX files |
| 4 | No per-page `<title>` or `<meta description>` — SPA uses single `index.html` tags for all routes | All pages share the same SEO metadata in search results | Add `react-helmet-async` or similar for per-route meta tag management |
| 5 | Comparison page `seoTitle` and `seoDescription` are defined but not rendered into the DOM | SEO metadata per competitor page is wasted | Wire seoTitle/seoDescription into document.title or helmet |
| 6 | `PlaceholderPage` serves as catch-all for `/resources/:page` and `/company/:page` | Users hitting these routes see a generic placeholder | Build out actual resource and company pages |
| 7 | No `sitemap.xml` entry for `/blog`, `/signin`, `/welcome`, `/blog/:slug` | These pages are not discoverable by search engines | Add missing URLs to sitemap |
| 8 | `trackDownload()` is defined but not wired to actual download buttons in `DownloadPage` | Desktop app downloads are not tracked | Add `trackDownload('windows')` call to download button click handler |
| 9 | No A/B testing infrastructure | Cannot optimize conversion rates on CTAs or pricing | Integrate Google Optimize, PostHog, or custom feature flags |
| 10 | Lead capture API endpoint (`/api/leads/capture`) may not have a corresponding backend router | Leads may silently fail to persist | Verify backend router exists or create one in `backend/app/routers/platform/` |
| 11 | `openCrispChat()` is exported but only used in pricing page FAQ section; other "Chat with us" buttons navigate to `/contact` instead | Inconsistent chat experience | Wire all "Chat with us" buttons to `openCrispChat()` |
| 12 | No consent management / cookie banner for GDPR compliance | May violate EU privacy regulations for GA4 and Clarity | Add cookie consent banner that gates analytics script injection |
