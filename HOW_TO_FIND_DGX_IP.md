# 🔍 How to Find DGX IP Address

## Method 1: If You Can SSH to DGX (Easiest)

If you can SSH to DGX Spark, just run these commands on DGX:

```bash
# SSH to DGX Spark first
ssh your-username@dgx-hostname

# Then run one of these:
hostname -I

# Or more detailed:
ip addr show

# Or check specific interface:
ip addr show eth0

# Or old style:
ifconfig
```

**Look for:** The IP address on the same network as your laptop (usually `192.168.x.x` or `10.0.x.x`)

---

## Method 2: Check Your Existing SSH Tunnel

If you're already using an Ollama tunnel, check how you set it up:

### Check Your SSH Tunnel Command

Look for any terminal/console where you ran something like:
```bash
ssh -L 31143:localhost:11434 user@DGX_IP
```

The `DGX_IP` part is what you need!

### Check Active SSH Connections

**On Windows (PowerShell):**
```powershell
# Check active SSH connections
netstat -an | findstr "31143"

# Or check all SSH connections
netstat -an | findstr "ESTABLISHED" | findstr "22"
```

**On Linux/Mac:**
```bash
# Check active SSH connections
netstat -an | grep 31143
# or
ss -tnp | grep 31143
```

---

## Method 3: From Your Laptop - Check Network

### Check Your Own IP First

**On Windows (PowerShell):**
```powershell
# Get your laptop's IP
ipconfig

# Look for "IPv4 Address" - usually something like:
# 192.168.1.100
# 10.0.0.50
```

**On Linux/Mac:**
```bash
ip addr show
# or
ifconfig
```

### Then Find DGX on Same Network

DGX should be on the same network range. If your laptop is `192.168.1.100`, DGX might be `192.168.1.50` or similar.

**Scan your network (if you have permission):**
```powershell
# PowerShell - scan local network
1..254 | ForEach-Object {
    $ip = "192.168.1.$_"
    if (Test-Connection -ComputerName $ip -Count 1 -Quiet) {
        Write-Host "$ip - Reachable"
    }
}
```

**Or use a network scanner tool** (like Advanced IP Scanner, Angry IP Scanner)

---

## Method 4: Check Your SSH Config File

If you've saved SSH connection details:

**On Windows:**
```powershell
# Check SSH config
cat $env:USERPROFILE\.ssh\config
# or
type C:\Users\YourUsername\.ssh\config
```

**On Linux/Mac:**
```bash
cat ~/.ssh/config
```

Look for entries like:
```
Host dgx-spark
    HostName 10.0.0.50
    User your-username
    Port 22
```

---

## Method 5: Check Your .env or Config Files

Check if you've saved the IP anywhere:

```powershell
# Search for IP addresses in your project
cd C:\QAAI
Get-ChildItem -Recurse -Include *.env,*.config,*.yaml,*.yml,*.json | Select-String -Pattern "\d+\.\d+\.\d+\.\d+"
```

Look for IP addresses that might be your DGX.

---

## Method 6: Ask Your System Administrator

If DGX is managed by your IT team:
- Check with your system administrator
- Check internal documentation
- Check network inventory/tools

---

## Method 7: Check Router/Network Management

If you have access to your router/network management:
- Check DHCP client list
- Look for hostname "dgx-spark" or "dgx"
- Check ARP table: `arp -a` (shows recently contacted IPs)

---

## Quick Test Once You Have IP

Once you think you have the IP, test it:

```powershell
# Test SSH connection
ssh your-username@DGX_IP

# Or test Ollama directly
curl http://DGX_IP:11434/api/tags
```

---

## Most Likely Scenario

If you're already using Ollama via tunnel (`localhost:31143`), you probably set up the tunnel with:

```bash
ssh -L 31143:localhost:11434 user@DGX_IP
```

**Check:**
1. Your terminal history
2. Any scripts you might have saved
3. Your SSH config file

The DGX IP is in that command!

---

## Still Can't Find It?

**Try these:**
1. Check if you have a hostname instead of IP (like `dgx-spark.company.com`)
2. Check if DGX is accessible via hostname:
   ```bash
   ping dgx-spark
   ping dgx
   ping dgx-sparx
   ```
3. Contact whoever set up the DGX system


