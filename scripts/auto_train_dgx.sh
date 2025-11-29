#!/bin/bash
# Automated DGX Spark Training - Uses SSH to connect and run training
# This script will SSH to DGX Spark and execute everything automatically

set -e

# Configuration - UPDATE THESE VALUES
DGX_HOST="${DGX_HOST:-localhost}"  # Change to your DGX IP/hostname
DGX_USER="${DGX_USER:-your-username}"  # Change to your DGX username
DGX_SSH_PORT="${DGX_SSH_PORT:-22}"  # SSH port (usually 22, not 31143)
DGX_SSH_KEY="${DGX_SSH_KEY:-}"  # Optional: path to SSH key

# Port 31143 is for Ollama tunnel, not SSH
# For SSH, we need the actual DGX hostname/IP and SSH port (usually 22)

echo "============================================================"
echo "🚀 AUTOMATED DGX SPARK TRAINING"
echo "============================================================"
echo ""

# Check if package exists
if [ ! -d "dgx_training_package" ]; then
    echo "❌ Training package not found!"
    echo "💡 Run: python scripts/prepare_dgx_transfer.py"
    exit 1
fi

echo "📦 Package found: dgx_training_package"
echo ""

# Check if DGX connection details are set
if [ "$DGX_HOST" = "localhost" ] || [ "$DGX_USER" = "your-username" ]; then
    echo "⚠️  DGX connection details not configured!"
    echo ""
    echo "Please set environment variables:"
    echo "  export DGX_HOST=your-dgx-ip-or-hostname"
    echo "  export DGX_USER=your-dgx-username"
    echo "  export DGX_SSH_PORT=22  # Optional, default is 22"
    echo ""
    echo "Or edit this script and set the values directly."
    echo ""
    read -p "Enter DGX Host/IP: " DGX_HOST
    read -p "Enter DGX Username: " DGX_USER
    read -p "Enter SSH Port (default 22): " port_input
    DGX_SSH_PORT=${port_input:-22}
fi

echo "🔌 Connecting to DGX Spark..."
echo "  Host: $DGX_HOST"
echo "  User: $DGX_USER"
echo "  Port: $DGX_SSH_PORT"
echo ""

# Test SSH connection
echo "Testing SSH connection..."
if [ -n "$DGX_SSH_KEY" ]; then
    ssh -i "$DGX_SSH_KEY" -p "$DGX_SSH_PORT" -o ConnectTimeout=10 "$DGX_USER@$DGX_HOST" "echo 'SSH connection successful'" > /dev/null 2>&1
else
    ssh -p "$DGX_SSH_PORT" -o ConnectTimeout=10 "$DGX_USER@$DGX_HOST" "echo 'SSH connection successful'" > /dev/null 2>&1
fi

if [ $? -eq 0 ]; then
    echo "  ✅ SSH connection successful!"
else
    echo "  ❌ SSH connection failed!"
    echo "  💡 Check:"
    echo "     - DGX hostname/IP is correct"
    echo "     - SSH port is correct (usually 22, not 31143)"
    echo "     - SSH key is configured (if using key auth)"
    echo "     - Network connectivity"
    exit 1
fi

# Transfer package
echo ""
echo "📤 Transferring package to DGX Spark..."
if [ -n "$DGX_SSH_KEY" ]; then
    scp -i "$DGX_SSH_KEY" -P "$DGX_SSH_PORT" -r dgx_training_package "$DGX_USER@$DGX_HOST:~/qa_finetuning/"
else
    scp -P "$DGX_SSH_PORT" -r dgx_training_package "$DGX_USER@$DGX_HOST:~/qa_finetuning/"
fi

if [ $? -eq 0 ]; then
    echo "  ✅ Package transferred!"
else
    echo "  ❌ Transfer failed!"
    exit 1
fi

# Run training
echo ""
echo "🚀 Starting training on DGX Spark..."
echo "  This will run automatically for 3-5 hours"
echo ""

if [ -n "$DGX_SSH_KEY" ]; then
    ssh -i "$DGX_SSH_KEY" -p "$DGX_SSH_PORT" "$DGX_USER@$DGX_HOST" << 'ENDSSH'
        cd ~/qa_finetuning/dgx_training_package
        chmod +x auto_setup_and_train.sh
        nohup bash auto_setup_and_train.sh > ../training.log 2>&1 &
        echo $! > ../training.pid
        echo "Training started! PID: $(cat ../training.pid)"
        echo ""
        echo "Monitor with: tail -f ~/qa_finetuning/training.log"
ENDSSH
else
    ssh -p "$DGX_SSH_PORT" "$DGX_USER@$DGX_HOST" << 'ENDSSH'
        cd ~/qa_finetuning/dgx_training_package
        chmod +x auto_setup_and_train.sh
        nohup bash auto_setup_and_train.sh > ../training.log 2>&1 &
        echo $! > ../training.pid
        echo "Training started! PID: $(cat ../training.pid)"
        echo ""
        echo "Monitor with: tail -f ~/qa_finetuning/training.log"
ENDSSH
fi

echo ""
echo "============================================================"
echo "✅ TRAINING STARTED ON DGX SPARK!"
echo "============================================================"
echo ""
echo "📊 Monitor Progress:"
echo "  ssh -p $DGX_SSH_PORT $DGX_USER@$DGX_HOST 'tail -f ~/qa_finetuning/training.log'"
echo ""
echo "📁 Check Results:"
echo "  ssh -p $DGX_SSH_PORT $DGX_USER@$DGX_HOST 'ls -lh ~/qa_finetuning/outputs/'"
echo ""
echo "⏱️  Expected time: 3-5 hours"
echo ""


