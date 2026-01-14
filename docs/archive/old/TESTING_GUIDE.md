# Testing Guide: API Import & Gherkin Converter

## 1. API Import Tool Testing

### Access the UI
- Navigate to: **http://localhost:5173/api-import** (or your frontend URL)
- Or click "API Import" in the sidebar

### Test Scenarios

#### Test 1: Upload OpenAPI/Swagger File
1. Go to "Upload File" tab
2. Click "Select File" and choose an OpenAPI JSON or YAML file
3. Wait for import to complete
4. **Expected**: 
   - Success message showing number of endpoints and test cases
   - "Results" tab becomes active
   - Summary shows format, endpoints count, and test cases count

#### Test 2: Paste OpenAPI Specification
1. Go to "Paste Specification" tab
2. Select format: "OpenAPI/Swagger"
3. Paste this sample OpenAPI spec:
```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Sample API",
    "version": "1.0.0"
  },
  "servers": [{"url": "https://api.example.com"}],
  "paths": {
    "/users": {
      "get": {
        "summary": "Get users",
        "responses": {"200": {"description": "Success"}}
      },
      "post": {
        "summary": "Create user",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": {"type": "string"},
                  "email": {"type": "string"}
                }
              }
            }
          }
        },
        "responses": {"201": {"description": "Created"}}
      }
    }
  }
}
```
4. Click "Import Specification"
5. **Expected**: Same as Test 1

#### Test 3: Generate Playwright Tests
1. After importing a spec (from Test 1 or 2)
2. Go to "Results" tab
3. Select framework: "Playwright (TypeScript)"
4. Click "Generate Test Scripts"
5. Go to "Generated Tests" tab
6. **Expected**:
   - Test code displayed in TypeScript
   - Setup instructions shown
   - Download button available

#### Test 4: Generate pytest Tests
1. Same as Test 3, but select "pytest (Python)"
2. **Expected**: Python test code generated

#### Test 5: Generate Postman Collection
1. Same as Test 3, but select "Postman Collection"
2. **Expected**: JSON Postman collection with test scripts

#### Test 6: Test Different Formats
- Try uploading a WSDL file (if available)
- Try uploading a Postman collection JSON
- Try uploading a GraphQL schema file

### API Endpoints to Test Directly

#### Test Import via API
```bash
curl -X POST http://localhost:8000/api/import/spec \
  -H "Content-Type: application/json" \
  -d '{
    "spec_content": "{\"openapi\":\"3.0.0\",\"info\":{\"title\":\"Test API\"},\"paths\":{}}",
    "spec_format": "openapi",
    "content_type": "json"
  }'
```

#### Test File Upload via API
```bash
curl -X POST http://localhost:8000/api/import/spec/file \
  -F "file=@path/to/openapi.json" \
  -F "spec_format=openapi"
```

#### Test Test Generation
```bash
curl -X POST http://localhost:8000/api/import/generate-tests \
  -H "Content-Type: application/json" \
  -d '{
    "parsed_spec": {...parsed_spec_from_import...},
    "framework": "playwright",
    "include_negative": true,
    "include_boundary": true,
    "include_security": true
  }'
```

---

## 2. Gherkin Converter Testing

### Access the UI
- Navigate to: **http://localhost:5173/gherkin** (or your frontend URL)
- Or click "Gherkin Converter" in the sidebar

### Test Scenarios

#### Test 1: Convert Single Requirement by ID
1. Go to "Single Requirement" tab
2. Enter a requirement ID (e.g., from your database)
3. Click "Convert"
4. **Expected**:
   - Success message
   - Gherkin feature file displayed
   - Copy and Download buttons available
   - Feature includes:
     - Feature header with title
     - Background section (if applicable)
     - Multiple scenarios (happy path, error handling, etc.)

#### Test 2: Convert from Text
1. Go to "From Text" tab
2. Paste this requirement text:
```
As a user, I want to login to the application so that I can access my account.

Acceptance Criteria:
- User can login with valid credentials
- User sees error message with invalid credentials
- User can reset password if forgotten
```
3. Click "Convert to Gherkin"
4. **Expected**:
   - Gherkin feature file generated
   - Contains "Feature:" header
   - Contains "Scenario:" sections
   - Uses proper Given-When-Then format

#### Test 3: Batch Conversion
1. Go to "Batch Conversion" tab
2. Select multiple requirements from the list
3. Click "Convert X Requirements"
4. **Expected**:
   - Success message with count
   - Multiple feature files displayed (one per requirement)
   - Each with Copy and Download buttons

#### Test 4: Verify Gherkin Format
Check that generated Gherkin includes:
- ✅ `Feature:` header with description
- ✅ `Background:` section (if applicable)
- ✅ `Scenario:` sections with proper names
- ✅ `Given`, `When`, `Then`, `And`, `But` keywords
- ✅ Proper indentation
- ✅ Meaningful step descriptions

### Sample Requirement for Testing

**Title**: User Login
**Description**: As a registered user, I want to login to the application using my email and password so that I can access my personalized dashboard.

**Acceptance Criteria**:
1. User can login with valid email and password
2. User sees error message when credentials are invalid
3. User can reset password via "Forgot Password" link
4. User is redirected to dashboard after successful login

**Expected Gherkin Output**:
```gherkin
Feature: User Login
  As a registered user
  I want to login to the application using my email and password
  So that I can access my personalized dashboard

  Background:
    Given I am on the application login page
    And I have valid access credentials

  Scenario: Successful login with valid credentials
    Given I am on the application login page
    When I enter valid email and password
    And I click the login button
    Then I should be redirected to the dashboard
    And I should see my personalized content

  Scenario: Error handling for invalid credentials
    Given I am on the application login page
    When I enter invalid email or password
    And I click the login button
    Then I should see an appropriate error message
    And the system should handle the error gracefully

  Scenario: Password reset functionality
    Given I am on the application login page
    When I click the "Forgot Password" link
    Then I should see the password reset form
    And I should be able to request password reset
```

### API Endpoints to Test Directly

#### Test Single Conversion
```bash
curl -X POST http://localhost:8000/api/gherkin/convert \
  -H "Content-Type: application/json" \
  -d '{
    "requirement_id": "req-123"
  }'
```

#### Test Text Conversion
```bash
curl -X POST http://localhost:8000/api/gherkin/convert \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": {
      "title": "User Login",
      "description": "As a user, I want to login...",
      "source": "manual"
    },
    "include_background": true,
    "max_scenarios": 5
  }'
```

#### Test Batch Conversion
```bash
curl -X POST http://localhost:8000/api/gherkin/convert-batch \
  -H "Content-Type: application/json" \
  -d '{
    "requirement_ids": ["req-1", "req-2", "req-3"],
    "output_format": "feature_files"
  }'
```

#### Test with Project ID
```bash
curl -X POST http://localhost:8000/api/gherkin/convert-batch \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "proj-123",
    "output_format": "single_file"
  }'
```

---

## 3. Quick Test Checklist

### API Import
- [ ] UI loads correctly
- [ ] File upload works
- [ ] Text paste works
- [ ] OpenAPI format supported
- [ ] WSDL format supported (if file available)
- [ ] Postman format supported
- [ ] GraphQL format supported
- [ ] Test generation works for all frameworks
- [ ] Download functionality works
- [ ] Error handling displays properly

### Gherkin Converter
- [ ] UI loads correctly
- [ ] Single requirement conversion works
- [ ] Text conversion works
- [ ] Batch conversion works
- [ ] Gherkin format is valid
- [ ] Copy to clipboard works
- [ ] Download functionality works
- [ ] Error handling displays properly
- [ ] Requirements list loads (for batch)

---

## 4. Troubleshooting

### API Import Issues
- **No endpoints found**: Check if spec format is correct
- **Import fails**: Verify file format matches selected format
- **Test generation fails**: Check if parsed_spec is valid

### Gherkin Converter Issues
- **Requirement not found**: Verify requirement ID exists in database
- **Empty Gherkin**: Check if requirement has description or acceptance criteria
- **Batch fails**: Ensure requirement IDs are valid

### Backend Connection
- Verify backend is running: `http://localhost:8000`
- Check CORS settings if frontend is on different port
- Verify API_BASE_URL in frontend matches backend URL


