#!/bin/bash
# Quick script to serve benchmark app

echo "Starting benchmark application server..."
echo "Access at: http://localhost:8080/benchmark-app/index.html"
echo ""
echo "Press Ctrl+C to stop"

cd benchmark-app
python3 -m http.server 8080

