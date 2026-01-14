# 🤖 Automated Test Generation & Execution Flow

## Current Problem

When clicking "Generate AI" button:
- ✅ Generates manual test steps
- ❌ Doesn't generate automated scripts when testType = "automated"
- ❌ Doesn't execute scripts automatically
- ❌ Doesn't post results to dashboard

## Solution: Enhanced AI Generation with Auto-Execution

### New Flow for Automated Tests

1. **User clicks "Generate AI" with testType = "automated"**
2. **Backend generates Playwright code**
3. **Backend automatically executes the script**
4. **Backend creates test run and stores results**
5. **Frontend shows results in dashboard**

## Implementation Plan

### Step 1: Enhanced AI Generation Endpoint

Create new endpoint: `POST /ai/generate-and-execute-automated`

This endpoint will:
- Generate Playwright code from description
- Execute it automatically using PlaywrightRunner
- Create test run
- Store results in database
- Return test run ID and results

### Step 2: Update Frontend

Modify `generateWithAI` function to:
- Check if testType === "automated"
- Call new endpoint instead of regular generation
- Show execution progress
- Navigate to test run detail page with results

### Step 3: Add Auto-Execution Option

Add checkbox: "Execute automatically after generation"
- If checked: Generate → Execute → Show results
- If unchecked: Generate → Show code review → Manual execution

## Code Implementation

### Backend: New Endpoint

```python
@app.post("/ai/generate-and-execute-automated")
async def generate_and_execute_automated(request: Request, body: dict):
    """
    Generate automated test script and execute it immediately
    Returns test run with results
    """
    try:
        description = body.get("description", "")
        test_name = body.get("name", "Generated Test")
        project_id = body.get("project_id")
        org_id = body.get("org_id")
        
        if not description:
            raise HTTPException(status_code=400, detail="Description required")
        
        # 1. Generate Playwright code
        from app.services.prompt_templates import PROMPT_REQ_TO_AUTOMATION_TESTS
        
        prompt = PROMPT_REQ_TO_AUTOMATION_TESTS.format(requirement=description)
        result = await ollama_service.generate(prompt, mode="ui", validate_json=False)
        playwright_code = result.get("response", "")
        
        # Extract code from markdown if needed
        import re
        code_match = re.search(r'```typescript\n(.*?)\n```', playwright_code, re.DOTALL)
        if code_match:
            playwright_code = code_match.group(1)
        
        # 2. Execute the generated code
        from app.services.playwright_runner import PlaywrightRunner
        from app.services.test_results_storage import store_test_run, store_test_run_step
        
        # Create test run
        run_id = await store_test_run(
            project_id=project_id,
            name=f"Auto-Generated: {test_name}",
            status="running",
            environment="local",
            started_at=datetime.utcnow().isoformat()
        )
        
        # Initialize runner
        runner = PlaywrightRunner()
        await runner.initialize()
        
        try:
            # Parse steps from generated code (simplified)
            # In production, you'd parse the Playwright code properly
            steps = parse_playwright_steps(playwright_code)
            
            # Create test case object
            test_case = TestCase(
                case_id=str(uuid.uuid4()),
                title=test_name,
                description=description,
                steps=steps
            )
            
            # Execute test
            result = await runner.run_test_case(test_case)
            
            # Store results
            await store_test_run_step(
                run_id=run_id,
                case_id=test_case.case_id,
                title=test_case.title,
                status=result.status,
                duration_ms=result.duration,
                error_message=result.error,
                stdout="\n".join(result.logs) if result.logs else None
            )
            
            # Update test run status
            from app.services.postgres_direct import execute_update
            await execute_update(
                "test_runs",
                {"status": "completed" if result.status == "passed" else "failed"},
                {"id": run_id}
            )
            
            return {
                "status": "success",
                "test_run_id": run_id,
                "execution_result": {
                    "status": result.status,
                    "duration": result.duration,
                    "error": result.error,
                    "logs": result.logs
                },
                "generated_code": playwright_code
            }
            
        finally:
            await runner.cleanup()
            
    except Exception as e:
        logger.error(f"Error in generate-and-execute-automated: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

### Frontend: Update generateWithAI

```typescript
const generateWithAI = async () => {
  if (!formData.description.trim()) {
    toast.error("Please provide a description before generating with AI");
    return;
  }

  setIsGenerating(true);
  try {
    // Check if automated and should auto-execute
    const isAutomated = formData.testType === "automated" || formData.testType === "ui";
    const autoExecute = isAutomated; // Can add checkbox for this later
    
    if (isAutomated && autoExecute) {
      // Generate and execute automatically
      toast.info("Generating automated test and executing...");
      
      const response = await fetch("http://localhost:8000/ai/generate-and-execute-automated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name || "Generated Test",
          description: formData.description,
          project_id: "your-project-id",
          org_id: "your-org-id"
        })
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate and execute test");
      }
      
      const data = await response.json();
      
      if (data.status === "success") {
        toast.success(
          `Test ${data.execution_result.status === "passed" ? "passed" : "failed"}! ` +
          `Duration: ${data.execution_result.duration}ms`
        );
        
        // Navigate to test run detail page
        navigate(`/runs/${data.test_run_id}`);
        
        // Optionally save test case
        setGeneratedCode(data.generated_code);
        setShowCodeReview(true);
      }
    } else {
      // Regular generation flow (existing code)
      const response = await customLLMService.generateTestCase(request);
      // ... existing code ...
    }
  } catch (error) {
    console.error("Error generating test case:", error);
    toast.error(`Failed to generate test case: ${error.message}`);
  } finally {
    setIsGenerating(false);
  }
};
```

## Alternative: Enhance Existing Endpoint

Instead of new endpoint, enhance `/ai/generate-tests` to:
- Accept `auto_execute: true` parameter
- If test_type is "automated" and auto_execute is true:
  - Generate code
  - Execute it
  - Return test run with results

## User Experience Flow

### Option 1: Always Auto-Execute Automated Tests
- User selects testType = "automated"
- Clicks "Generate AI"
- System: Generate → Execute → Show results
- User sees test run with execution results

### Option 2: Optional Auto-Execution
- Add checkbox: "Execute automatically"
- If checked: Generate → Execute → Show results
- If unchecked: Generate → Show code → Manual execution

## Next Steps

1. ✅ Create backend endpoint for generate-and-execute
2. ✅ Update frontend to call new endpoint for automated tests
3. ✅ Add execution progress indicator
4. ✅ Navigate to test run detail page after execution
5. ✅ Show generated code in test case for future reference






