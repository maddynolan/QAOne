# 🔧 Fix: Conda Not Found on DGX Spark

## Current Issue

Training script started but stopped because **conda is not installed** on DGX Spark.

## Solution Options

### Option 1: Install Conda (Recommended)

**On DGX Spark, run:**

```bash
# Download Miniconda
cd ~
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh

# Install
bash Miniconda3-latest-Linux-x86_64.sh -b -p ~/miniconda3

# Add to PATH
echo 'export PATH="$HOME/miniconda3/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify
conda --version
```

### Option 2: Check if Conda Exists but Not in PATH

**On DGX Spark, check:**

```bash
# Check if conda is installed somewhere
which conda
find ~ -name conda 2>/dev/null
ls -la ~/miniconda3/bin/conda 2>/dev/null
ls -la ~/anaconda3/bin/conda 2>/dev/null

# If found, add to PATH
export PATH="$HOME/miniconda3/bin:$PATH"  # or wherever it is
```

### Option 3: Use System Python with venv (Alternative)

If you can't install conda, we can modify the script to use `venv` instead.

---

## After Installing Conda

Once conda is installed, restart the training:

```bash
cd ~/qa_finetuning/dgx_training_package
bash auto_setup_and_train.sh
```

---

## Quick Check

**On DGX Spark, run:**

```bash
# Check if conda exists
conda --version

# If not found, check PATH
echo $PATH

# Check if it's in common locations
ls -la ~/miniconda3/bin/conda 2>/dev/null || echo "Not in ~/miniconda3"
ls -la ~/anaconda3/bin/conda 2>/dev/null || echo "Not in ~/anaconda3"
ls -la /opt/conda/bin/conda 2>/dev/null || echo "Not in /opt/conda"
```


