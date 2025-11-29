# Transfer Scripts to DGX Spark GB10

## Quick Transfer Commands

### From Windows PowerShell (in C:\QAAI directory):

```powershell
# Transfer the main setup script
scp scripts/run_on_dgx.sh madhujanu@192.168.1.233:~/

# Transfer other useful scripts (optional)
scp scripts/setup_30b_only.sh madhujanu@192.168.1.233:~/
scp scripts/check_and_remove_models.sh madhujanu@192.168.1.233:~/
```

### If SCP asks for password:
- Enter your SSH password when prompted
- If it asks about host key, type `yes`

### If SCP is not available:
Install OpenSSH Client:
1. Settings > Apps > Optional Features
2. Add "OpenSSH Client"

---

## After Transferring

### SSH to DGX and run:

```bash
# Connect to DGX
ssh madhujanu@192.168.1.233

# Make script executable
chmod +x ~/run_on_dgx.sh

# Run the script
bash ~/run_on_dgx.sh
```

---

## Alternative: Copy-Paste Method

If SCP doesn't work, you can:

1. **View the script content:**
   ```powershell
   cat scripts/run_on_dgx.sh
   ```

2. **SSH to DGX:**
   ```powershell
   ssh madhujanu@192.168.1.233
   ```

3. **Create the file on DGX:**
   ```bash
   nano ~/run_on_dgx.sh
   # Paste the content, save with Ctrl+X, then Y, then Enter
   ```

4. **Make executable and run:**
   ```bash
   chmod +x ~/run_on_dgx.sh
   bash ~/run_on_dgx.sh
   ```

---

## Verify Transfer

After transferring, verify on DGX:

```bash
ssh madhujanu@192.168.1.233
ls -la ~/run_on_dgx.sh
cat ~/run_on_dgx.sh  # View first few lines
```




