#!/bin/bash
# Quick start script for DGX Pipeline
# Usage: ./scripts/run_dgx_pipeline.sh

set -e

echo "============================================================"
echo "🚀 DGX Pipeline Quick Start"
echo "============================================================"
echo ""

# Check if environment variables are set
if [ -z "$DGX_HOST" ] || [ -z "$DGX_USER" ]; then
    echo "⚠️  DGX connection details not set!"
    echo ""
    read -p "Enter DGX Spark GB10 Hostname/IP: " DGX_HOST
    read -p "Enter DGX Username: " DGX_USER
    export DGX_HOST
    export DGX_USER
    echo ""
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python 3.8+"
    exit 1
fi

# Check dependencies
echo "📦 Checking dependencies..."
if ! python3 -c "import paramiko" 2>/dev/null; then
    echo "  Installing paramiko..."
    pip install paramiko tqdm
fi

# Run pipeline
echo ""
echo "🚀 Starting pipeline..."
echo ""

python3 scripts/dgx_pipeline_complete.py \
  --dgx-host "$DGX_HOST" \
  --dgx-user "$DGX_USER"

echo ""
echo "✅ Pipeline started!"
echo ""
echo "To monitor progress:"
echo "  python3 scripts/monitor_dgx_training.py"




