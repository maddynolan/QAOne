# 🔧 Fix: Conda Installation - Architecture Issue

## Problem

The conda installer failed with "Exec format error" - this means wrong architecture.

## Solution: Check Architecture and Install Correct Version

### Step 1: Check Your System Architecture

**On DGX Spark, run:**

```bash
uname -m
```

**Possible outputs:**
- `x86_64` = Intel/AMD 64-bit (use x86_64 installer)
- `aarch64` = ARM 64-bit (use ARM installer)
- `arm64` = ARM 64-bit (use ARM installer)

### Step 2: Install Correct Conda Version

**For x86_64 (Intel/AMD):**
```bash
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh -b -p ~/miniconda3
```

**For aarch64 (ARM - common on some DGX systems):**
```bash
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh
bash Miniconda3-latest-Linux-aarch64.sh -b -p ~/miniconda3
```

### Step 3: Add to PATH

```bash
export PATH="$HOME/miniconda3/bin:$PATH"
echo 'export PATH="$HOME/miniconda3/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Step 4: Verify

```bash
conda --version
```

---

## Alternative: Use Python venv (No Conda Needed)

If conda installation continues to fail, we can modify the script to use `venv` instead:

**On DGX Spark, you can create a venv-based setup:**

```bash
cd ~/qa_finetuning/dgx_training_package

# Check Python version
python3 --version

# Create venv
python3 -m venv ~/qa_finetuning/venv

# Activate
source ~/qa_finetuning/venv/bin/activate

# Install dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install transformers>=4.40.0 peft>=0.8.0 accelerate>=0.27.0
pip install datasets>=2.16.0 bitsandbytes>=0.42.0 scipy pyyaml

# Verify GPU
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}')"

# Run training
python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml
```


