# Setting Up Remote Ollama on DGX Sparx via Tunnel

This guide shows how to configure your system to use Qwen models running on a remote DGX Sparx server via a tunnel connection.

## Overview

Your Qwen 2.5 models (7B, 14B, 32B) are running on DGX Sparx, but your backend and evaluation scripts are on your laptop. You have a tunnel set up that maps the remote Ollama port to `localhost:31143` on your laptop.

**Tunnel URL:** `http://localhost:31143` (maps to DGX Ollama on port 11434)

## Step 1: Verify Tunnel Connection

### 1.1 Test Tunnel Connection

Your tunnel should be active and mapping DGX Ollama to `localhost:31143`. Test it:

```bash
curl http://localhost:31143/api/tags
```

You should see your Qwen models listed, for example:
```json
{
  "models": [
    {"name": "qwen2.5:7b-instruct", ...},
    {"name": "qwen2.5-coder:14b", ...},
    {"name": "qwen2.5-coder:32b", ...}
  ]
}
```

### 1.2 If Tunnel is Not Active

If the connection fails, make sure your tunnel is running. Common tunnel methods:

**SSH Tunnel:**
```bash
ssh -L 31143:localhost:11434 user@dgx-sparx
```

**Or if Ollama is on a different IP on DGX:**
```bash
ssh -L 31143:DGX_INTERNAL_IP:11434 user@dgx-sparx
```

**Keep the tunnel active** - Don't close the terminal/SSH session while using the system.

---

## Step 2: Configure Backend to Use Tunnel

### 2.1 Set Environment Variable

Create or update `.env` file in the `backend` directory:

```bash
cd C:\QAAI\backend
```

Create/edit `.env` file:

```env
# Ollama Configuration - Via Tunnel to DGX
OLLAMA_URL=http://localhost:31143
```

**Important:** Use `localhost:31143` (your tunnel endpoint), not the direct DGX IP.

### 2.2 Update Backend Service

The `backend/app/services/ollama_service.py` already reads from `OLLAMA_URL` environment variable:

```python
self.ollama_base_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
```

So just setting the environment variable is enough!

### 2.3 Restart Backend

After setting the environment variable, restart your backend:

```bash
# Stop current backend (Ctrl+C)
# Then restart:
cd backend
python -m app.main
```

Or if using uvicorn directly:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

---

## Step 3: Configure Evaluation Scripts

### 3.1 Update Evaluation Script (Option A - Recommended)

Set environment variable before running:

**PowerShell:**
```powershell
$env:OLLAMA_URL = "http://localhost:31143"
python scripts/evaluate_llm.py manual qwen2.5-coder:14b
```

**Command Prompt:**
```cmd
set OLLAMA_URL=http://localhost:31143
python scripts/evaluate_llm.py manual qwen2.5-coder:14b
```

### 3.2 Update Evaluation Script (Option B - Permanent)

Edit `scripts/evaluate_llm.py` line ~17:
```python
# Change from:
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")

# To:
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:31143")  # Tunnel endpoint
```

### 3.3 Test Connection from Script

```bash
python -c "import requests; r = requests.get('http://localhost:31143/api/tags'); print(r.json())"
```

---

## Step 4: Test the Connection

### 4.1 Test Tunnel Connection First

```bash
curl http://localhost:31143/api/tags
```

You should see your Qwen models. If this fails, check your tunnel is active.

### 4.2 Test Backend Connection

```powershell
# Test if backend can reach Ollama via tunnel
Invoke-RestMethod -Uri "http://localhost:8001/health"

# The backend should show it's configured correctly
```

### 4.3 Test Direct Ollama Call via Tunnel

Use the test script:

```python
import os
import requests

# Set Tunnel URL
os.environ["OLLAMA_URL"] = "http://localhost:31143"  # Tunnel endpoint
ollama_url = os.getenv("OLLAMA_URL", "http://localhost:31143")

# Test connection
print(f"Testing connection to: {ollama_url}")

try:
    # List models
    response = requests.get(f"{ollama_url}/api/tags")
    if response.ok:
        models = response.json()
        print(f"✅ Connected! Available models:")
        for model in models.get("models", []):
            print(f"   - {model.get('name', 'Unknown')}")
    else:
        print(f"❌ Error: {response.status_code}")
except Exception as e:
    print(f"❌ Connection failed: {str(e)}")
    print(f"\nTroubleshooting:")
    print(f"1. Check DGX IP is correct: {ollama_url}")
    print(f"2. Ensure Ollama is running on DGX")
    print(f"3. Check firewall/network access")
```

Run it:
```bash
python test_dgx_connection.py
```

### 4.4 Test Test Generation via Backend

```powershell
$body = @{
    requirement = "User login functionality"
    test_type = "manual"
    mode = "ui"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Status: $($response.status)"
Write-Host "Model used: $($response.model)"
Write-Host "Test cases generated: $($response.count)"
```

If this works and shows the model name, you're all set!

---

## Step 5: Configure for Different Environments

### 5.1 Create Environment-Specific Configs

Create `.env.local` for local Ollama:
```env
OLLAMA_URL=http://localhost:11434
```

Create `.env.dgx` for DGX via tunnel:
```env
OLLAMA_URL=http://localhost:31143
```

### 5.2 Load Appropriate Config

In your backend startup script, load the right config:

```python
# backend/app/main.py or startup script
import os
from dotenv import load_dotenv

# Load environment-specific config
env_file = os.getenv("ENV_FILE", ".env.dgx")
load_dotenv(env_file)
```

---

## Step 6: Verify Everything Works

### 6.1 Check Backend Logs

When you start the backend, check the logs for Ollama connection:

```
INFO: Using Ollama at: http://10.0.0.50:11434
```

### 6.2 Run Evaluation

```powershell
# Set environment variable (PowerShell)
$env:OLLAMA_URL = "http://localhost:31143"

# Run evaluation
python scripts/evaluate_llm.py manual qwen2.5-coder:14b
```

Or set it inline:
```powershell
$env:OLLAMA_URL = "http://localhost:31143"; python scripts/evaluate_llm.py manual qwen2.5-coder:14b
```

### 6.3 Generate Tests via API

```powershell
$body = @{
    requirement = "Test requirement"
    test_type = "manual"
    mode = "ui"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Model used: $($response.model)"
Write-Host "Test cases generated: $($response.count)"
```

---

## Troubleshooting

### Issue: "Connection refused" or "Cannot connect"

**Solutions:**
1. **Check DGX IP is correct**
   ```powershell
   Test-NetConnection -ComputerName 10.0.0.50 -Port 11434
   ```

2. **Check Ollama is running on DGX**
   ```bash
   # SSH to DGX and check:
   ssh user@dgx-sparx
   curl http://localhost:11434/api/tags
   ```

3. **Check firewall rules**
   - DGX may need to allow port 11434
   - Your laptop may need to allow outbound connections

4. **Check Ollama is listening on all interfaces**
   ```bash
   # On DGX, check Ollama config
   # Should be: OLLAMA_HOST=0.0.0.0:11434
   ```

### Issue: "Timeout" or "Slow responses"

**Solutions:**
1. **Network latency** - Normal for remote connections
2. **Check network speed** between laptop and DGX
3. **Consider using 7B model** for faster responses over network
4. **Increase timeout** in `ollama_service.py`:
   ```python
   self.timeout = 300  # Increase from 120 to 300 seconds
   ```

### Issue: "Models not found"

**Solutions:**
1. **Verify models are on DGX**:
   ```bash
   # On DGX:
   ollama list
   ```

2. **Pull models if needed**:
   ```bash
   # On DGX:
   ollama pull qwen2.5:7b-instruct
   ollama pull qwen2.5-coder:14b
   ollama pull qwen2.5-coder:32b
   ```

### Issue: "Invalid response" or "JSON errors"

**Solutions:**
1. **Network issues** - Check connection stability
2. **Model loading** - Ensure model is fully loaded on DGX
3. **Try different model** - Use 14B or 32B for better quality

---

## Advanced Configuration

### Using Hostname Instead of IP

If your DGX has a hostname:

```env
OLLAMA_URL=http://dgx-sparx.company.com:11434
```

### Using HTTPS (if configured)

```env
OLLAMA_URL=https://dgx-sparx.company.com:11434
```

### Using Custom Port

If Ollama is on a different port:

```env
OLLAMA_URL=http://10.0.0.50:11435
```

### Load Balancing (Multiple DGX Servers)

If you have multiple DGX servers, you can implement round-robin:

```python
# In ollama_service.py
import random

dgx_servers = [
    "http://10.0.0.50:11434",
    "http://10.0.0.51:11434",
    "http://10.0.0.52:11434"
]

self.ollama_base_url = random.choice(dgx_servers)
```

---

## Quick Reference

**Tunnel Endpoint:** `http://localhost:31143`

**Environment Variable:**
```powershell
$env:OLLAMA_URL = "http://localhost:31143"
```

**Backend Config:**
```env
# backend/.env
OLLAMA_URL=http://localhost:31143
```

**Test Connection:**
```bash
curl http://localhost:31143/api/tags
```

**Keep Tunnel Active:** Don't close your SSH/tunnel session while using the system!

**Verify Models:**
```bash
# On DGX:
ollama list
```

---

## Summary

1. ✅ Get DGX IP address
2. ✅ Set `OLLAMA_URL` environment variable
3. ✅ Test connection from laptop
4. ✅ Update backend `.env` file
5. ✅ Restart backend
6. ✅ Test test generation
7. ✅ Run evaluation scripts

Your system will now use the remote Ollama instance on DGX Sparx!

