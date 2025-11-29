#!/bin/bash
# Automated Setup Script for DGX Spark GB10 - Qwen3-Coder-30B Only
# This script automates the entire setup process

set -e

# Configuration
DGX_HOST="${DGX_HOST:-}"
DGX_USER="${DGX_USER:-}"
DGX_SSH_PORT="${DGX_SSH_PORT:-22}"

echo "============================================================"
echo "🚀 DGX Spark GB10 - Qwen3-Coder-30B Setup"
echo "============================================================"
echo ""

# Get connection details
if [ -z "$DGX_HOST" ] || [ -z "$DGX_USER" ]; then
    echo "⚠️  DGX connection details not set!"
    echo ""
    read -p "Enter DGX Spark GB10 Hostname/IP: " DGX_HOST
    read -p "Enter DGX Username: " DGX_USER
    read -p "Enter SSH Port (default 22): " port_input
    DGX_SSH_PORT=${port_input:-22}
fi

echo "🔌 Connecting to DGX Spark GB10..."
echo "  Host: $DGX_HOST"
echo "  User: $DGX_USER"
echo "  Port: $DGX_SSH_PORT"
echo ""

# Test SSH connection
echo "Testing SSH connection..."
if ssh -p "$DGX_SSH_PORT" -o ConnectTimeout=10 "$DGX_USER@$DGX_HOST" "echo 'SSH connection successful'" > /dev/null 2>&1; then
    echo "  ✅ SSH connection successful"
else
    echo "  ❌ Cannot connect to DGX Spark GB10"
    echo "  💡 Please check connection details"
    exit 1
fi
echo ""

# Step 1: Install Qwen3-Coder-30B
echo "📥 Step 1: Installing Qwen3-Coder-30B model..."
echo "  This will take time (30B model is ~60GB)..."
ssh -p "$DGX_SSH_PORT" "$DGX_USER@$DGX_HOST" << 'ENDSSH'
    # Check if Ollama is installed
    if ! command -v ollama &> /dev/null; then
        echo "  ❌ Ollama not found. Installing..."
        curl -fsSL https://ollama.com/install.sh | sh
    fi
    
    # Pull Qwen3-Coder-30B
    echo "  📥 Pulling Qwen3-Coder-30B-Instruct..."
    ollama pull Qwen/Qwen3-Coder-30B-Instruct
    
    # Verify installation
    echo "  ✅ Model installed:"
    ollama list | grep -i qwen3
ENDSSH
echo ""

# Step 2: Create training directory
echo "📁 Step 2: Setting up training directory..."
ssh -p "$DGX_SSH_PORT" "$DGX_USER@$DGX_HOST" << 'ENDSSH'
    mkdir -p ~/qa_finetuning
    cd ~/qa_finetuning
    echo "  ✅ Training directory ready: ~/qa_finetuning"
ENDSSH
echo ""

# Step 3: Transfer training package
echo "📤 Step 3: Transferring training package..."
if [ ! -d "dgx_training_package" ]; then
    echo "  ❌ Training package not found!"
    echo "  💡 Please ensure dgx_training_package/ exists"
    exit 1
fi

echo "  Transferring files (this may take a few minutes)..."
scp -r -P "$DGX_SSH_PORT" dgx_training_package "$DGX_USER@$DGX_HOST:~/qa_finetuning/"
echo "  ✅ Package transferred"
echo ""

# Step 4: Setup Python environment
echo "🐍 Step 4: Setting up Python environment on DGX..."
ssh -p "$DGX_SSH_PORT" "$DGX_USER@$DGX_HOST" << 'ENDSSH'
    cd ~/qa_finetuning/dgx_training_package
    
    # Create venv
    python3 -m venv venv
    source venv/bin/activate
    
    # Install dependencies
    echo "  📦 Installing dependencies..."
    pip install --upgrade pip
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
    pip install transformers datasets peft accelerate bitsandbytes pyyaml
    
    echo "  ✅ Environment ready"
ENDSSH
echo ""

# Step 5: Check GPU
echo "🖥️  Step 5: Checking GPU..."
ssh -p "$DGX_SSH_PORT" "$DGX_USER@$DGX_HOST" << 'ENDSSH'
    echo "  GPU Information:"
    nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader
    echo ""
    echo "  ⚠️  Ensure you have 60GB+ GPU memory for 30B training"
ENDSSH
echo ""

# Step 6: Prepare training data
echo "📊 Step 6: Preparing training data..."
echo "  ⚠️  Make sure training data exists in dgx_training_package/data/"
echo "  - data/train.jsonl"
echo "  - data/val.jsonl"
echo ""

# Step 7: Start training
echo "🚀 Step 7: Ready to start training!"
echo ""
echo "To start training, run on DGX:"
echo "  ssh $DGX_USER@$DGX_HOST"
echo "  cd ~/qa_finetuning/dgx_training_package"
echo "  source venv/bin/activate"
echo "  python scripts/train_lora.py --config configs/lora_qwen3_30b_coder.yaml"
echo ""
echo "Or run automatically:"
read -p "Start training now? (y/n): " start_training
if [ "$start_training" = "y" ]; then
    echo ""
    echo "🚀 Starting training..."
    ssh -p "$DGX_SSH_PORT" "$DGX_USER@$DGX_HOST" << 'ENDSSH'
        cd ~/qa_finetuning/dgx_training_package
        source venv/bin/activate
        nohup python scripts/train_lora.py --config configs/lora_qwen3_30b_coder.yaml > training.log 2>&1 &
        echo $! > training.pid
        echo "  ✅ Training started! PID: $(cat training.pid)"
        echo "  📊 Monitor with: tail -f training.log"
ENDSSH
    echo ""
    echo "✅ Training started in background!"
    echo "📊 Monitor progress:"
    echo "  ssh $DGX_USER@$DGX_HOST 'tail -f ~/qa_finetuning/dgx_training_package/training.log'"
fi

echo ""
echo "============================================================"
echo "✅ Setup Complete!"
echo "============================================================"
echo ""
echo "Next Steps:"
echo "1. Monitor training: ssh $DGX_USER@$DGX_HOST 'tail -f ~/qa_finetuning/dgx_training_package/training.log'"
echo "2. After training: Merge LoRA weights (see DGX_SPARK_GB10_SETUP.md)"
echo "3. Deploy model: Set up vLLM or Ollama (see DGX_SPARK_GB10_SETUP.md)"
echo "4. Update backend config: Use only 30B model (see DGX_SPARK_GB10_SETUP.md)"
echo ""




