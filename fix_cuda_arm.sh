#!/bin/bash
# Fix CUDA for ARM PyTorch on DGX

cd ~/qa_finetuning
source venv/bin/activate

# Set CUDA library path
export LD_LIBRARY_PATH=/usr/local/cuda-13.0/lib64:/usr/local/cuda-13.0/targets/sbsa-linux/lib:$LD_LIBRARY_PATH

# Test CUDA
echo "Testing CUDA availability..."
python3 -c "import torch; print('PyTorch:', torch.__version__); print('CUDA Available:', torch.cuda.is_available())"

if python3 -c "import torch; exit(0 if torch.cuda.is_available() else 1)" 2>/dev/null; then
    echo "CUDA is available! You can start training."
    python3 -c "import torch; print('GPU:', torch.cuda.get_device_name(0))"
else
    echo "CUDA still not available. May need Docker or different approach."
fi




