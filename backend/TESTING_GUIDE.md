# Testing Guide - LLM-Powered Application Analysis

## 🧪 How to Test the New LLM Integration

### Step 1: Verify Backend is Running

```bash
# Check if backend is running
# Should see: "Application startup complete" in logs
```

### Step 2: Verify OpenAI API Key

```bash
# Check .env file has:
OPENAI_API_KEY=sk-...

# Or check in backend/.env
```

### Step 3: Test in Website

1. **Navigate to Exploration Page:**
   - Go to: `http://localhost:3000/exploration`
   - You should see the "Explore App" tab

2. **Run Complete Workflow:**
   - Enter URL: `https://www.walmart.com/`
   - Set max pages: `20` (for faster testing)
   - Enable: "Generate test cases"
   - Click: **"Run Complete Workflow"**

3. **What to Look For:**
   - **In Logs:** Look for:
     ```
     Initial LLM analysis: ecommerce (confidence: high)
     Mid-exploration LLM analysis: ecommerce, 5 entities
     ```
   
   - **In UI:** After workflow completes, you should see:
     - **AI-Powered Application Analysis** card (NEW!)
     - Shows domain, entities, critical flows
     - Appears in "Explore App" tab

4. **Check Test Cases Tab:**
   - Click "Test Cases" tab
   - Should see domain-specific test cases
   - Test cases should be relevant to the application type

---

## 🔍 What the LLM Analysis Shows

### Initial Analysis (Pre-Exploration):
- **Domain:** ecommerce, healthcare, crm, etc.
- **Confidence:** high, medium, low
- **Expected Entities:** Product, Order, Patient, etc.
- **Exploration Focus:** What to prioritize

### Complete Analysis (Post-Exploration):
- **Domain:** Confirmed domain
- **Application Type:** Specific type (e.g., "retail_ecommerce")
- **Primary Entities:** What the app manages
- **Key Operations:** What users can do
- **Critical Flows:** Flows that must be tested
- **Test Priorities:** High/medium/low for each flow

---

## 🐛 Troubleshooting

### Issue: No LLM Analysis Card Appears

**Check:**
1. Is OpenAI API key set? Check `.env` file
2. Check logs for errors:
   ```bash
   Get-Content logs\app.log -Tail 50 | Select-String -Pattern "LLM|OpenAI|analyze"
   ```
3. Is LLM analysis in capability map?
   - Check browser console (F12)
   - Look for `capabilityMap.llm_analysis` in response

**Fix:**
- If OpenAI not available, system falls back to heuristics
- Check `OPENAI_API_KEY` in `.env`
- Restart backend after adding API key

### Issue: "OpenAI service not available"

**Fix:**
1. Add `OPENAI_API_KEY` to `.env` file
2. Restart backend
3. Verify key is valid

### Issue: LLM Analysis Fails

**Check Logs:**
```bash
Get-Content logs\app.log -Tail 100 | Select-String -Pattern "LLM.*failed|analyze.*failed"
```

**Common Causes:**
- API key invalid or expired
- Network issues
- Rate limiting
- Invalid JSON response

**Fallback:**
- System automatically falls back to heuristics
- Exploration continues normally
- Test cases still generated (using standard generator)

---

## 📊 Expected Results

### For E-commerce (walmart.com):
```
Initial Analysis:
- Domain: ecommerce
- Confidence: high
- Expected Entities: Product, Order, Cart

Complete Analysis:
- Domain: ecommerce
- Application Type: retail_ecommerce
- Primary Entities: Product, Order, Cart, Customer
- Critical Flows:
  - Product Discovery and Purchase
  - Checkout Flow
  - Order Management
```

### For Healthcare:
```
Initial Analysis:
- Domain: healthcare
- Confidence: high
- Expected Entities: Patient, Appointment, Prescription

Complete Analysis:
- Domain: healthcare
- Application Type: patient_portal
- Primary Entities: Patient, Appointment, Medical Record
- Critical Flows:
  - Appointment Scheduling
  - Medical Records Access
  - Prescription Management
```

---

## 🧪 Manual Testing Steps

### Test 1: E-commerce Application
1. URL: `https://www.walmart.com/`
2. Expected: Domain = "ecommerce"
3. Expected: Entities = ["Product", "Order", "Cart"]
4. Expected: Flows include "Product Discovery", "Checkout"

### Test 2: Healthcare Application
1. URL: Any patient portal
2. Expected: Domain = "healthcare"
3. Expected: Entities = ["Patient", "Appointment"]
4. Expected: Flows include "Appointment Scheduling"

### Test 3: CRM Application
1. URL: Any CRM system
2. Expected: Domain = "crm"
3. Expected: Entities = ["Contact", "Lead", "Opportunity"]
4. Expected: Flows include "Lead Management"

---

## 📝 Verification Checklist

After running workflow, verify:

- [ ] **Logs show LLM analysis:**
  - "Initial LLM analysis: ..."
  - "Mid-exploration LLM analysis: ..."

- [ ] **UI shows AI Analysis card:**
  - Domain displayed
  - Entities listed
  - Critical flows shown

- [ ] **Test cases are domain-specific:**
  - Relevant to application type
  - Not generic

- [ ] **Capability map includes analysis:**
  - `capabilityMap.llm_analysis` exists
  - `capabilityMap.initial_analysis` exists

---

## 🔧 Debug Commands

### Check if LLM is being called:
```bash
Get-Content logs\app.log | Select-String -Pattern "LLMApplicationAnalyzer|analyze_url|analyze_structure"
```

### Check for errors:
```bash
Get-Content logs\app.log | Select-String -Pattern "Error|Exception|Failed" | Select-Object -Last 20
```

### Check OpenAI availability:
```bash
python -c "from app.services.llm.openai_service import get_openai_service; s = get_openai_service(); print('Available:', s.is_available())"
```

---

## 🎯 Success Indicators

✅ **Success if you see:**
- AI-Powered Application Analysis card in UI
- Domain correctly identified
- Entities and flows listed
- Domain-specific test cases generated
- No errors in logs

❌ **Failure if you see:**
- No AI Analysis card
- Generic test cases (not domain-specific)
- Errors in logs about LLM/OpenAI
- "OpenAI service not available" warnings

---

## 🚀 Quick Test

**Fastest way to test:**
1. Go to `/exploration`
2. Enter: `https://www.walmart.com/`
3. Set max pages: `10` (faster)
4. Enable "Generate test cases"
5. Click "Run Complete Workflow"
6. Wait for completion
7. Look for "AI-Powered Application Analysis" card
8. Check "Test Cases" tab for domain-specific tests

**Expected time:** 2-3 minutes

---

This guide will help you verify the LLM integration is working correctly!
