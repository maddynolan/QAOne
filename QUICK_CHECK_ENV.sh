#!/bin/bash
# Quick check script - run this on DGX Spark to see what's available

echo "============================================================"
echo "🔍 Checking Python Environment"
echo "============================================================"
echo ""

echo "1. Python version:"
python3 --version 2>&1 || echo "   ❌ python3 not found"
echo ""

echo "2. Pip version:"
pip3 --version 2>&1 || echo "   ⚠️  pip3 not found"
echo ""

echo "3. Conda:"
command -v conda >/dev/null && echo "   ✅ conda found: $(conda --version)" || echo "   ❌ conda not found"
echo ""

echo "4. Docker:"
command -v docker >/dev/null && echo "   ✅ docker found: $(docker --version)" || echo "   ❌ docker not found"
echo ""

echo "5. Virtual environments:"
if [ -d ~/qa_finetuning/venv ]; then
    echo "   ✅ Found: ~/qa_finetuning/venv"
elif [ -d ~/qa_finetuning/.venv ]; then
    echo "   ✅ Found: ~/qa_finetuning/.venv"
elif [ -d ~/qa_finetuning/dgx_training_package/venv ]; then
    echo "   ✅ Found: ~/qa_finetuning/dgx_training_package/venv"
else
    echo "   ❌ No venv found"
fi
echo ""

echo "6. Required Python packages:"
echo -n "   torch: "
python3 -c "import torch; print('✅', torch.__version__)" 2>&1 || echo "❌ not installed"

echo -n "   transformers: "
python3 -c "import transformers; print('✅', transformers.__version__)" 2>&1 || echo "❌ not installed"

echo -n "   peft: "
python3 -c "from peft import PeftModel; print('✅ installed')" 2>&1 || echo "❌ not installed"
echo ""

echo "7. Training environment check:"
if [ -f ~/qa_finetuning/docker_training.log ]; then
    echo "   ✅ Found docker_training.log"
    echo "   Training was likely done in Docker"
elif [ -d ~/qa_finetuning/outputs/qa-expert-7b-v1 ]; then
    echo "   ✅ Found trained model"
    echo "   Model exists: outputs/qa-expert-7b-v1"
fi
echo ""

echo "============================================================"
echo "💡 Recommendations:"
echo "============================================================"

if python3 -c "import torch" 2>/dev/null; then
    echo "✅ Packages are available! You can run the deployment script."
elif command -v docker >/dev/null && [ -f ~/qa_finetuning/docker_training.log ]; then
    echo "💡 Training was done in Docker. Use Docker for merging too."
elif command -v pip3 >/dev/null; then
    echo "💡 Install packages: pip3 install torch transformers peft accelerate"
elif [ -d ~/qa_finetuning/venv ] || [ -d ~/qa_finetuning/.venv ]; then
    echo "💡 Activate venv: source ~/qa_finetuning/venv/bin/activate"
else
    echo "💡 Need to set up Python environment first"
fi
echo ""






