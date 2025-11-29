# ✅ Check DGX Ollama Status

## You're on DGX (Linux), not Windows!

**On Linux/DGX, use:**
- `curl` instead of `Invoke-WebRequest`
- `ollama list` to see models
- `systemctl status ollama` to check service

---

## ✅ Commands to Run on DGX

### Check Ollama is Running
```bash
# Check Ollama service
systemctl status ollama

# Or check process
ps aux | grep ollama | grep -v grep

# Or check if port is listening
netstat -tlnp | grep 11434
# OR
ss -tlnp | grep 11434
```

### Check Available Models
```bash
# List installed models
ollama list

# Should show: qwen3-coder:30b
```

### Test Ollama API
```bash
# Test API endpoint
curl http://localhost:11434/api/tags

# Should return JSON with models list
```

### Test Model Directly
```bash
# Test if model works
ollama run qwen3-coder:30b "Hello, test"
```

---

## 🔧 If Ollama Not Running

### Start Ollama Service
```bash
# Start Ollama
sudo systemctl start ollama

# Or if no systemd
ollama serve &
```

### Check Ollama Logs
```bash
# Check service logs
sudo journalctl -u ollama -n 50

# Or check process output
```

---

## 🚀 Start SSH Tunnel from Windows

**On your Windows machine, run:**
```powershell
ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local
```

**This forwards:**
- Windows localhost:31143 → DGX localhost:11434

**Keep this terminal open!**

---

## ✅ Verify Everything Works

### On DGX:
```bash
# 1. Check Ollama is running
curl http://localhost:11434/api/tags

# 2. Check model exists
ollama list | grep qwen3-coder:30b
```

### On Windows (after starting tunnel):
```powershell
# Test tunnel connection
Invoke-WebRequest http://localhost:31143/api/tags
```

**Should return same models list!**

---

## 📋 Summary

1. ✅ **On DGX:** Use `curl` and `ollama` commands (Linux)
2. ✅ **Check Ollama:** `curl http://localhost:11434/api/tags`
3. ✅ **Check models:** `ollama list`
4. ✅ **On Windows:** Start SSH tunnel to connect
5. ✅ **Test tunnel:** `Invoke-WebRequest http://localhost:31143/api/tags`

**Run the curl command on DGX to check Ollama!** 🚀




