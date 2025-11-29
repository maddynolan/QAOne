#!/bin/bash
# Check models on Spark DGX via SSH tunnel
# Make sure SSH tunnel is running: ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local

echo "Checking models on Spark DGX (via SSH tunnel on port 31143)..."
echo ""

curl -s http://localhost:31143/api/tags | python3 -m json.tool



