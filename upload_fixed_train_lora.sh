#!/bin/bash
# Upload fixed train_lora.py to DGX

# On your LOCAL machine, run this to upload the fixed file:
scp -o StrictHostKeyChecking=no train_lora_dgx.py madhujanu@spark-d435.local:~/qa_finetuning/scripts/train_lora.py

echo "✅ Fixed file uploaded!"
echo ""
echo "On DGX, verify:"
echo "  cd ~/qa_finetuning/scripts && grep -A 5 'CRITICAL FIX' train_lora.py"




