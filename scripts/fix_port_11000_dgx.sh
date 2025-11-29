#!/bin/bash
# Fix port 11000 issue on DGX Spark

echo "=========================================="
echo "Checking port 11000 on DGX Spark"
echo "=========================================="
echo ""

# Check what's using port 11000
echo "1. Checking what's using port 11000..."
sudo netstat -tlnp | grep 11000 || echo "   Port 11000 is NOT in use"
echo ""

# Check if it's a Jupyter notebook
echo "2. Checking for Jupyter notebook processes..."
ps aux | grep -i jupyter | grep -v grep || echo "   No Jupyter processes found"
echo ""

# Check if it's a monitoring service
echo "3. Checking for monitoring services..."
ps aux | grep -E "monitor|11000" | grep -v grep || echo "   No monitoring services found on port 11000"
echo ""

# Check SSH connections
echo "4. Checking SSH connections..."
netstat -tlnp | grep :22 | head -5
echo ""

# If port 11000 is in use, show how to kill it
echo "=========================================="
echo "If port 11000 is in use, kill it with:"
echo "  sudo lsof -ti:11000 | xargs kill -9"
echo ""
echo "Or find the process:"
echo "  sudo lsof -i :11000"
echo "=========================================="



