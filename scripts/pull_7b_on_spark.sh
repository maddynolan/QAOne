#!/bin/bash
# Script to pull 7B model on Spark DGX
# Run this ON Spark: ssh madhujanu@spark-d435.local, then: bash pull_7b_on_spark.sh

echo "============================================================"
echo "Pulling qwen2.5-coder:7b on Spark DGX"
echo "============================================================"
echo ""
echo "This will download ~4-5 GB and may take several minutes..."
echo ""

ollama pull qwen2.5-coder:7b

echo ""
echo "============================================================"
echo "Verifying model is loaded..."
echo "============================================================"
ollama list | grep -i "7b"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 7B model is now loaded!"
else
    echo ""
    echo "❌ 7B model not found. Check for errors above."
fi

