# Real Websites for Benchmark Testing

This document lists actual websites where you can test the 10 complex enterprise scenarios to validate the 98% stability claim.

---

## Scenario 1: Financial Trading Portal - Buy Limit Order

**Test Flow**: Select Asset → Open Order Modal → Input Price → Set Duration → Click Submit  
**Failure Mode**: Dynamic ID re-render on price change  
**Healing Mechanism**: Layer 2 (Role/Name) selector

### Real Websites:

1. **TradingView Paper Trading**
   - URL: https://www.tradingview.com/chart/
   - Features: Real-time trading interface, order forms, dynamic updates
   - Test: Create a paper trade order (requires free account)

2. **Investing.com Demo Account**
   - URL: https://www.investing.com/
   - Features: Trading simulator, order forms
   - Test: Use demo account to place orders

3. **eToro (Demo Account)**
   - URL: https://www.etoro.com/
   - Features: Social trading platform with order forms
   - Test: Create demo account and place trades

4. **Interactive Brokers Paper Trading**
   - URL: https://www.interactivebrokers.com/
   - Features: Professional trading interface
   - Test: Paper trading account (requires registration)

---

## Scenario 2: B2B CMS - Drag and Drop Image Block

**Test Flow**: Drag Image Block from sidebar to document canvas  
**Failure Mode**: Pixel coordinate failure  
**Healing Mechanism**: Semantic dragTo() with data-testid

### Real Websites:

1. **Notion**
   - URL: https://www.notion.so/
   - Features: Drag-and-drop blocks, content management
   - Test: Create page, drag blocks around (free account)

2. **Airtable**
   - URL: https://www.airtable.com/
   - Features: Database with drag-and-drop interface
   - Test: Create base, drag fields/records

3. **Trello**
   - URL: https://trello.com/
   - Features: Kanban board with drag-and-drop cards
   - Test: Create board, drag cards between lists (free account)

4. **Monday.com (Free Trial)**
   - URL: https://monday.com/
   - Features: Project management with drag-and-drop
   - Test: Create workspace, drag items

5. **Webflow (Free Account)**
   - URL: https://webflow.com/
   - Features: Visual CMS with drag-and-drop builder
   - Test: Create site, drag elements

---

## Scenario 3: Internal CRM / Helpdesk Dashboard - Virtualized Table

**Test Flow**: Filter table by Status → Click Edit on 10th row  
**Failure Mode**: Virtualized indexing (XPath breaks)  
**Healing Mechanism**: Text + relative locator with auto-scroll

### Real Websites:

1. **Zendesk (Free Trial)**
   - URL: https://www.zendesk.com/
   - Features: Helpdesk with large ticket tables
   - Test: View tickets, filter, edit ticket (free trial)

2. **HubSpot CRM (Free)**
   - URL: https://www.hubspot.com/products/crm
   - Features: CRM with contact/company tables
   - Test: View contacts, filter, edit contact (free account)

3. **Salesforce (Developer Edition - Free)**
   - URL: https://developer.salesforce.com/signup
   - Features: Enterprise CRM with large data tables
   - Test: Create developer account, view records, filter

4. **Freshdesk (Free Trial)**
   - URL: https://www.freshworks.com/freshdesk/
   - Features: Helpdesk with ticket management
   - Test: View tickets, filter, edit

5. **Pipedrive (Free Trial)**
   - URL: https://www.pipedrive.com/
   - Features: Sales CRM with deal pipeline
   - Test: View deals, filter, edit deal

---

## Scenario 4: Insurance Quote Generator - Multi-Step Form

**Test Flow**: Navigate steps 3-4, Next button disabled during validation  
**Failure Mode**: Race condition (clicks before enabled)  
**Healing Mechanism**: Dynamic wait (toBeEnabled)

### Real Websites:

1. **Progressive Insurance Quote**
   - URL: https://www.progressive.com/auto/online-quote/
   - Features: Multi-step insurance quote form
   - Test: Start quote, navigate through steps

2. **Geico Quote Tool**
   - URL: https://www.geico.com/get-a-quote/
   - Features: Multi-step auto insurance quote
   - Test: Complete quote form with validation

3. **State Farm Quote**
   - URL: https://www.statefarm.com/insurance/auto/get-a-quote
   - Features: Insurance quote with multiple steps
   - Test: Navigate through form steps

4. **Allstate Quote**
   - URL: https://www.allstate.com/online-insurance/auto-quote.aspx
   - Features: Multi-step quote process
   - Test: Complete quote form

---

## Scenario 5: Government/Healthcare Portal - iFrame Consent

**Test Flow**: Complete consent form in third-party iframe  
**Failure Mode**: iFrame context loss (generic ID)  
**Healing Mechanism**: iframe title attribute

### Real Websites:

1. **Google OAuth Consent**
   - URL: Any site using Google OAuth (e.g., https://stackoverflow.com/users/login)
   - Features: OAuth consent in iframe
   - Test: Click "Sign in with Google", handle consent iframe

2. **Facebook Login (Embedded)**
   - URL: Sites using Facebook login (e.g., https://www.spotify.com/us/login)
   - Features: Facebook login in iframe
   - Test: Click "Continue with Facebook", handle iframe

3. **Stripe Payment Form (Test Mode)**
   - URL: Any site with Stripe checkout (test mode)
   - Features: Payment form in iframe
   - Test: Use test card, complete payment in iframe

4. **YouTube Embed Consent**
   - URL: Sites with YouTube embeds requiring consent
   - Features: Cookie consent in iframe
   - Test: Handle consent dialog in iframe

---

## Scenario 6: Analytics / BI Tool - Canvas Chart Rendering

**Test Flow**: Change chart type from Bar to Line using toolbar  
**Failure Mode**: SVG icon instability  
**Healing Mechanism**: Role + aria-label

### Real Websites:

1. **Google Analytics (Free)**
   - URL: https://analytics.google.com/
   - Features: Analytics dashboard with chart controls
   - Test: View reports, change chart types (free account)

2. **Tableau Public (Free)**
   - URL: https://public.tableau.com/
   - Features: Data visualization with chart types
   - Test: View dashboards, interact with charts

3. **Chart.js Examples**
   - URL: https://www.chartjs.org/docs/latest/samples/
   - Features: Chart library demos
   - Test: Change chart types in examples

4. **Plotly Chart Studio (Free)**
   - URL: https://chart-studio.plotly.com/
   - Features: Interactive charts with type switching
   - Test: Create chart, change type

5. **Observable (Free)**
   - URL: https://observablehq.com/
   - Features: Data visualization notebooks
   - Test: View notebooks, interact with charts

---

## Scenario 7: E-Commerce - Promotional Pop-ups

**Test Flow**: Verify final price after closing promotional modal  
**Failure Mode**: Pop-up interruption (element obscured)  
**Healing Mechanism**: Auto-triage (detect and close modal)

### Real Websites:

1. **Amazon (Product Pages)**
   - URL: https://www.amazon.com/
   - Features: Product pages with promotional popups
   - Test: View product, handle popups, check price

2. **eBay (Product Pages)**
   - URL: https://www.ebay.com/
   - Features: Product listings with offers/popups
   - Test: View item, handle popups

3. **Target (Product Pages)**
   - URL: https://www.target.com/
   - Features: E-commerce with promotional modals
   - Test: Browse products, handle popups

4. **Best Buy (Product Pages)**
   - URL: https://www.bestbuy.com/
   - Features: Electronics with promotional offers
   - Test: View product, handle modals

5. **Walmart (Product Pages)**
   - URL: https://www.walmart.com/
   - Features: E-commerce with promotional popups
   - Test: Browse products, handle interruptions

---

## Scenario 8: Job Application Portal - File Upload

**Test Flow**: Upload résumé using drag-and-drop file zone  
**Failure Mode**: Hidden input access  
**Healing Mechanism**: Playwright native API (setInputFiles)

### Real Websites:

1. **LinkedIn Easy Apply**
   - URL: https://www.linkedin.com/jobs/
   - Features: Job applications with resume upload
   - Test: Apply to job, upload resume (requires account)

2. **Indeed Apply**
   - URL: https://www.indeed.com/
   - Features: Job applications with file upload
   - Test: Apply to job, upload resume (free account)

3. **Glassdoor Apply**
   - URL: https://www.glassdoor.com/Job/
   - Features: Job applications with resume upload
   - Test: Apply to job, upload file

4. **Monster Apply**
   - URL: https://www.monster.com/
   - Features: Job applications with resume upload
   - Test: Apply to job, upload resume

5. **AngelList (Startup Jobs)**
   - URL: https://angel.co/jobs
   - Features: Startup job applications
   - Test: Apply to job, upload resume

---

## Scenario 9: Live Collaboration Tool - Asynchronous Chat

**Test Flow**: Send message, assert timestamp  
**Failure Mode**: Async content (timestamp not rendered)  
**Healing Mechanism**: Semantic assertion with pattern matching

### Real Websites:

1. **Slack (Free Workspace)**
   - URL: https://slack.com/
   - Features: Team chat with timestamps
   - Test: Send message, verify timestamp (free workspace)

2. **Discord (Free)**
   - URL: https://discord.com/
   - Features: Chat with message timestamps
   - Test: Send message, verify async rendering

3. **Microsoft Teams (Free)**
   - URL: https://www.microsoft.com/en-us/microsoft-teams/
   - Features: Team collaboration chat
   - Test: Send message, verify timestamp

4. **Rocket.Chat (Demo)**
   - URL: https://www.rocket.chat/
   - Features: Open-source chat platform
   - Test: Use demo, send message

5. **Element (Matrix Chat)**
   - URL: https://element.io/
   - Features: Decentralized chat
   - Test: Create account, send message

---

## Scenario 10: Cloud Console / Settings Page - Dynamic Attribute

**Test Flow**: Click user profile name (capitalization changes by role)  
**Failure Mode**: Case sensitivity  
**Healing Mechanism**: Fuzzy text matching (case-insensitive)

### Real Websites:

1. **AWS Console (Free Tier)**
   - URL: https://console.aws.amazon.com/
   - Features: Cloud console with user profile
   - Test: View profile, test name variations (free tier)

2. **Google Cloud Console (Free Trial)**
   - URL: https://console.cloud.google.com/
   - Features: Cloud platform with user settings
   - Test: View profile, test dynamic attributes

3. **Azure Portal (Free Account)**
   - URL: https://portal.azure.com/
   - Features: Cloud console with user profile
   - Test: View profile, test name display

4. **GitHub Settings**
   - URL: https://github.com/settings/profile
   - Features: User profile with dynamic display
   - Test: View profile, test name variations

5. **DigitalOcean Dashboard**
   - URL: https://cloud.digitalocean.com/
   - Features: Cloud console with user profile
   - Test: View profile settings

---

## Practice Sites (Safe for Testing)

These sites are specifically designed for automation testing practice:

1. **The Internet (Herokuapp)**
   - URL: http://the-internet.herokuapp.com/
   - Features: Various UI elements, forms, dynamic content
   - Perfect for: General testing practice

2. **SauceDemo**
   - URL: https://www.saucedemo.com/
   - Features: E-commerce demo site
   - Perfect for: E-commerce testing

3. **ParaBank**
   - URL: https://parabank.parasoft.com/
   - Features: Banking application demo
   - Perfect for: Financial application testing

4. **Practice Test Automation**
   - URL: https://practice.expandtesting.com/
   - Features: Various test scenarios
   - Perfect for: Dynamic content testing

5. **QA Brains Practice Site**
   - URL: https://qabrains.com/practice-site
   - Features: Multiple test scenarios
   - Perfect for: Comprehensive testing

---

## Testing Guidelines

### Ethical Considerations
- ✅ Use test/demo accounts when available
- ✅ Respect rate limits and terms of service
- ✅ Don't overload servers with excessive requests
- ✅ Use headless mode for automated tests
- ✅ Clean up test data after testing

### Best Practices
1. **Start with Practice Sites**: Test on dedicated practice sites first
2. **Use Test Accounts**: Create separate test accounts for real sites
3. **Rate Limiting**: Add delays between test actions
4. **Error Handling**: Implement proper error handling for dynamic content
5. **Documentation**: Document which sites work best for each scenario

### Test Execution Order
1. Run benchmark app tests first (local, controlled)
2. Run practice site tests (safe, designed for testing)
3. Run real website tests (production, requires care)

---

## Quick Reference

| Scenario | Best Practice Site | Best Real Site | Difficulty |
|----------|-------------------|---------------|------------|
| 1. Trading | - | TradingView Paper Trading | Medium |
| 2. CMS | The Internet | Notion | Easy |
| 3. CRM | ParaBank | HubSpot CRM (Free) | Medium |
| 4. Insurance | - | Progressive Quote | Easy |
| 5. iFrame | The Internet | Google OAuth | Medium |
| 6. Analytics | - | Google Analytics | Easy |
| 7. E-Commerce | SauceDemo | Amazon | Medium |
| 8. File Upload | The Internet | LinkedIn Easy Apply | Medium |
| 9. Chat | - | Slack (Free) | Easy |
| 10. Profile | - | GitHub Settings | Easy |

---

**Last Updated**: 2025-01-XX  
**Status**: Ready for testing  
**Next Steps**: Start with practice sites, then move to real websites

