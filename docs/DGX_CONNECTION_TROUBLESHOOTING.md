# DGX Connection Troubleshooting Guide

## Issue: Connection Timeout to DGX Server

If you're getting `Failed to connect` or `Connection timeout`, follow these steps:

---

## Step 1: Verify DGX IP Address

### On the DGX Server:

SSH into your DGX server and run:

```bash
# Get all IP addresses
hostname -I

# Or more detailed
ip addr show

# Or check network interfaces
ifconfig
```

Look for the IP address that's on the same network as your laptop.

**Common scenarios:**
- If your laptop is on `192.168.1.x`, DGX should be on `192.168.1.x`
- If your laptop is on `10.0.0.x`, DGX should be on `10.0.0.x`
- If using VPN, check VPN IP range

### From Your Laptop:

Test basic connectivity (ping):

```powershell
# Test if DGX is reachable
Test-Connection -ComputerName 10.0.0.50 -Count 4

# Or
ping 10.0.0.50
```

If ping fails, the IP is wrong or network is blocked.

---

## Step 2: Check Ollama is Running on DGX

### On the DGX Server:

SSH to DGX and verify Ollama:

```bash
# Check if Ollama process is running
ps aux | grep ollama

# Check if Ollama service is running
systemctl status ollama

# Or if using Docker
docker ps | grep ollama

# Test local connection
curl http://localhost:11434/api/tags
```

If Ollama isn't running, start it:

```bash
# Start Ollama service
sudo systemctl start ollama

# Or if using Docker
docker start ollama-container
```

---

## Step 3: Check Ollama is Listening on All Interfaces

**CRITICAL:** Ollama might only be listening on `localhost` (127.0.0.1), which means it won't accept connections from other machines.

### On the DGX Server:

Check what Ollama is listening on:

```bash
# Check what's listening on port 11434
sudo netstat -tlnp | grep 11434
# or
sudo ss -tlnp | grep 11434
# or
sudo lsof -i :11434
```

**What to look for:**
- ✅ `0.0.0.0:11434` or `*:11434` = Good! Listening on all interfaces
- ❌ `127.0.0.1:11434` or `localhost:11434` = Problem! Only listening locally

### Fix: Configure Ollama to Listen on All Interfaces

**Option A: Set Environment Variable**

Edit Ollama service configuration:

```bash
# If using systemd service
sudo systemctl edit ollama

# Add this:
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"

# Restart
sudo systemctl restart ollama
```

**Option B: Start Ollama Manually**

```bash
# Set environment variable
export OLLAMA_HOST=0.0.0.0:11434

# Start Ollama
ollama serve
```

**Option C: Docker Configuration**

If using Docker, ensure port mapping and host:

```bash
docker run -d \
  -p 11434:11434 \
  -e OLLAMA_HOST=0.0.0.0:11434 \
  --name ollama \
  ollama/ollama
```

---

## Step 4: Check Firewall Rules

### On the DGX Server:

Check if firewall is blocking port 11434:

```bash
# Check firewall status
sudo ufw status
# or
sudo firewall-cmd --list-all

# If firewall is active, allow port 11434
sudo ufw allow 11434/tcp
# or
sudo firewall-cmd --add-port=11434/tcp --permanent
sudo firewall-cmd --reload
```

---

## Step 5: Test from DGX to Laptop (Reverse)

From DGX, test if it can reach your laptop:

```bash
# On DGX, test connection to your laptop
curl http://YOUR_LAPTOP_IP:8001/health
```

This verifies network connectivity in both directions.

---

## Step 6: Verify Network Route

### From Your Laptop:

Check if you can reach the DGX at all:

```powershell
# Test network connectivity
Test-NetConnection -ComputerName 10.0.0.50 -Port 11434

# Check routing
route print | findstr "10.0.0"
```

---

## Step 7: Alternative Connection Methods

### Option A: SSH Tunnel (If Direct Connection Fails)

If you can SSH to DGX but can't directly connect to Ollama:

```bash
# Create SSH tunnel
ssh -L 11434:localhost:11434 user@10.0.0.50

# Then use localhost on your laptop
# OLLAMA_URL=http://localhost:11434
```

### Option B: Use Hostname Instead of IP

If DGX has a hostname:

```bash
# Test with hostname
curl http://dgx-sparx:11434/api/tags

# Or
curl http://dgx-sparx.company.com:11434/api/tags
```

### Option C: Check for Proxy/VPN

If behind corporate network or VPN:

```bash
# Check proxy settings
echo $http_proxy
echo $https_proxy

# May need to configure proxy or use VPN
```

---

## Step 8: Verify Port is Correct

Ollama might be on a different port:

```bash
# On DGX, check what port Ollama is actually using
sudo netstat -tlnp | grep ollama
# or check Ollama config
cat ~/.ollama/config  # or wherever config is stored
```

Default is `11434`, but it might be configured differently.

---

## Quick Diagnostic Script

Run this on your laptop to test various scenarios:

```python
# test_dgx_detailed.py
import socket
import requests
import sys

def test_connection(host, port):
    print(f"Testing {host}:{port}...")
    
    # Test 1: TCP connection
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((host, port))
        sock.close()
        if result == 0:
            print(f"  ✅ TCP connection successful")
        else:
            print(f"  ❌ TCP connection failed (error code: {result})")
            return False
    except Exception as e:
        print(f"  ❌ TCP connection error: {str(e)}")
        return False
    
    # Test 2: HTTP request
    try:
        url = f"http://{host}:{port}/api/tags"
        response = requests.get(url, timeout=10)
        if response.ok:
            print(f"  ✅ HTTP request successful")
            data = response.json()
            models = data.get("models", [])
            print(f"  ✅ Found {len(models)} model(s)")
            return True
        else:
            print(f"  ⚠️  HTTP request failed: {response.status_code}")
            return False
    except requests.exceptions.Timeout:
        print(f"  ❌ HTTP request timeout")
        return False
    except Exception as e:
        print(f"  ❌ HTTP request error: {str(e)}")
        return False

if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else "10.0.0.50"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 11434
    
    print("=" * 60)
    print("DGX Connection Diagnostic")
    print("=" * 60)
    
    if test_connection(host, port):
        print("\n✅ Connection successful! You can proceed.")
    else:
        print("\n❌ Connection failed. Check:")
        print("  1. DGX IP address is correct")
        print("  2. Ollama is running on DGX")
        print("  3. Ollama is listening on 0.0.0.0 (not just localhost)")
        print("  4. Firewall allows port 11434")
        print("  5. Network connectivity between laptop and DGX")
```

Run it:
```bash
python test_dgx_detailed.py 10.0.0.50 11434
```

---

## Common Solutions Summary

| Issue | Solution |
|-------|----------|
| Connection timeout | Check Ollama is listening on `0.0.0.0:11434` not `127.0.0.1:11434` |
| Connection refused | Check firewall allows port 11434 |
| Wrong IP | Verify DGX IP with `hostname -I` on DGX |
| Ollama not running | Start Ollama service on DGX |
| Network not reachable | Check VPN/network configuration |
| Different port | Verify Ollama port with `netstat` |

---

## Next Steps After Connection Works

Once connection is successful:

1. ✅ Set `OLLAMA_URL` environment variable
2. ✅ Update `backend/.env` file
3. ✅ Restart backend
4. ✅ Test test generation
5. ✅ Run evaluation scripts

---

## Still Having Issues?

If connection still fails after all checks:

1. **Contact DGX administrator** to verify:
   - Ollama is running
   - Port 11434 is open
   - Network configuration is correct

2. **Use SSH tunnel** as temporary solution:
   ```bash
   ssh -L 11434:localhost:11434 user@dgx-ip
   ```

3. **Check DGX logs**:
   ```bash
   # On DGX
   journalctl -u ollama -f
   # or Docker logs
   docker logs ollama
   ```


