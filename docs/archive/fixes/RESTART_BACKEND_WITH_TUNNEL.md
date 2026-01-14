# 🔄 Restart Backend with SSH Tunnel

## Current Setup

You have an SSH tunnel:
```bash
ssh -N -L 31143:127.0.0.1:11434 madhujanu@192.168.1.233
```

This forwards:
- **Local port 31143** → **DGX Spark port 11434** (Ollama)

## Steps to Fix

### Step 1: Verify SSH Tunnel is Running

```powershell
# Check if port 31143 is listening (SSH tunnel)
netstat -ano | findstr ":31143.*LISTENING"
```

If not running, start it:
```bash
ssh -N -L 31143:127.0.0.1:11434 madhujanu@192.168.1.233
```

### Step 2: .env File Created

I've created `backend/.env` with:
```
OLLAMA_URL=http://localhost:31143
USE_FINETUNED_MODEL=true
FINETUNED_MODEL_NAME=qa-expert:7b
```

### Step 3: Restart Backend

```bash
cd backend
python test_simple.py
```

**Or if using uvicorn directly:**
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
```

### Step 4: Verify Connection

**Check backend logs for:**
```
OllamaService initialized - Using Ollama at: http://localhost:31143
Fine-tuned model enabled: qa-expert:7b (for quick mode)
```

**Test the connection:**
```bash
curl http://localhost:31143/api/tags
```

Should return list of Ollama models including `qa-expert:7b`

---

## Troubleshooting

### SSH Tunnel Not Working

```bash
# Test tunnel connection
curl http://localhost:31143/api/tags

# If fails, restart SSH tunnel:
ssh -N -L 31143:127.0.0.1:11434 madhujanu@192.168.1.233
```

### Backend Still Can't Connect

1. **Check .env file exists:**
   ```bash
   cat backend/.env
   ```

2. **Verify OLLAMA_URL:**
   Should be `http://localhost:31143` (not the direct IP)

3. **Restart backend** after changing .env

---

## Success Indicators

✅ **Backend logs show:**
```
Using Ollama at: http://localhost:31143
Fine-tuned model enabled: qa-expert:7b
```

✅ **API test works:**
```bash
curl -X POST http://localhost:8000/ai/generate-tests \
  -H "Content-Type: application/json" \
  -d '{"requirements": "Test login", "test_type": "automated", "context": {"mode": "quick"}}'
```

✅ **No connection errors in logs**






