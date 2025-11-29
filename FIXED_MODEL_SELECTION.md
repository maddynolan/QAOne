# Fixed Model Selection - All Endpoints Now Use Trained Model

## Problem
Multiple AI endpoints were defaulting to `mode="ui"` which uses the base model `qwen2.5-coder:14b` instead of `mode="quick"` which uses the trained `qa-expert:7b` model.

## Solution
Changed all endpoints to default to `mode="quick"` to ensure the trained model is used by default.

## Endpoints Fixed

1. ✅ `/ai/jira-to-testcases` - Changed from `"ui"` to `"quick"`
2. ✅ `/ai/testcase-to-playwright` - Changed from `"ui"` to `"quick"`
3. ✅ `/ai/openapi-to-tests` - Changed from `"ui"` to `"quick"`
4. ✅ `/ai/dom-to-testcases` - Changed from `"ui"` to `"quick"`
5. ✅ `/ai/triage` - Changed from hardcoded `"ui"` to `"quick"`
6. ✅ `/ai/requirement-to-testcases` - Changed from `"ui"` to `"quick"`

## Already Using "quick" Mode (No Changes Needed)

- ✅ `/ai/generate-tests` - Already defaults to `"quick"`
- ✅ `/ai/generate-tests-enhanced` - Already defaults to `"quick"`
- ✅ `/ai/generate-and-execute-automated` - Already uses `"quick"`

## What You'll See Now

When you use any AI endpoint, you should see logs like:

```
🔍 JIRA-TO-TESTCASES - Mode: quick
🔍 JIRA-TO-TESTCASES - Selected model: qa-expert:7b
🔍 Ollama API Response - Requested: qa-expert:7b, Actual: qa-expert:7b
✅ Using trained model: qa-expert:7b
```

Instead of:

```
🔍 Ollama API Response - Requested: qwen2.5-coder:14b, Actual: qwen2.5-coder:14b
⚠️  Using base model: qwen2.5-coder:14b
```

## Testing

1. Restart your backend server
2. Generate test cases using any AI endpoint
3. Check the logs - you should see "✅ Using trained model: qa-expert:7b"
4. If you still see base model, check:
   - Is `USE_FINETUNED_MODEL=true` in your `.env`?
   - Is `FINETUNED_MODEL_NAME=qa-expert:7b` in your `.env`?
   - Is the model actually available in Ollama? (Check with `/debug/model-info`)

## Override

Users can still override the mode by passing `"mode": "ui"` or `"mode": "heavy"` in the request body if they want to use a larger model for specific tasks.






