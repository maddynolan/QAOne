#!/bin/bash
# Local script to transfer package and run training on DGX Spark
# Run this from your local machine

set -e

# Configuration - UPDATE THESE
DGX_USER="your-dgx-username"
DGX_IP="your-dgx-ip"
PACKAGE_DIR="dgx_training_package"

echo "============================================================"
echo "🚀 TRANSFER AND RUN TRAINING ON DGX SPARK"
echo "============================================================"
echo ""

# Check if package exists
if [ ! -d "$PACKAGE_DIR" ]; then
    echo "❌ Package directory not found: $PACKAGE_DIR"
    echo "💡 Run: python scripts/prepare_dgx_transfer.py"
    exit 1
fi

echo "📦 Package found: $PACKAGE_DIR"
echo ""

# Check SSH connection
echo "🔌 Testing SSH connection..."
if ssh -o ConnectTimeout=5 "${DGX_USER}@${DGX_IP}" "echo 'Connection successful'" 2>/dev/null; then
    echo "  ✅ SSH connection successful"
else
    echo "  ❌ Cannot connect to DGX Spark"
    echo "  💡 Please check:"
    echo "     - DGX_USER and DGX_IP in this script"
    echo "     - SSH access to DGX Spark"
    echo "     - Network connectivity"
    exit 1
fi
echo ""

# Transfer package
echo "📤 Transferring package to DGX Spark..."
echo "  This may take a few minutes..."
scp -r "$PACKAGE_DIR" "${DGX_USER}@${DGX_IP}:~/qa_finetuning/"
echo "  ✅ Package transferred"
echo ""

# Run automated setup and training
echo "🚀 Starting automated setup and training on DGX Spark..."
echo "  This will:"
echo "    - Setup environment (10-15 min)"
echo "    - Install dependencies (5-10 min)"
echo "    - Run training (2-4 hours)"
echo ""
echo "  ⚠️  This will run in the background"
echo "  📊 Monitor progress with: ssh ${DGX_USER}@${DGX_IP} 'tail -f ~/qa_finetuning/training.log'"
echo ""

# Create remote script
ssh "${DGX_USER}@${DGX_IP}" << 'ENDSSH'
cd ~/qa_finetuning/dgx_training_package
chmod +x auto_setup_and_train.sh
nohup ./auto_setup_and_train.sh > ../training.log 2>&1 &
echo $! > ../training.pid
echo "Training started! PID: $(cat ../training.pid)"
echo "Monitor with: tail -f ~/qa_finetuning/training.log"
ENDSSH

echo ""
echo "============================================================"
echo "✅ TRAINING STARTED ON DGX SPARK"
echo "============================================================"
echo ""
echo "📊 Monitor Progress:"
echo "  ssh ${DGX_USER}@${DGX_IP} 'tail -f ~/qa_finetuning/training.log'"
echo ""
echo "🛑 Stop Training (if needed):"
echo "  ssh ${DGX_USER}@${DGX_IP} 'kill \$(cat ~/qa_finetuning/training.pid)'"
echo ""
echo "📥 Check Results:"
echo "  ssh ${DGX_USER}@${DGX_IP} 'ls -lh ~/qa_finetuning/outputs/'"
echo ""

