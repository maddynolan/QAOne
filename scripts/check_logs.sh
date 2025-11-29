#!/bin/bash
# Quick script to check Flowstral logs (Linux/Mac)
# Usage: bash scripts/check_logs.sh

echo "=== Flowstral Logs (Last 100 lines) ==="
tail -100 backend/logs/app.log 2>/dev/null | grep -i -E "flowstral|test case|LLM|7b|qwen|model|artifact" -A 1 -B 1

echo ""
echo "=== Model Selection Logs ==="
tail -200 backend/logs/app.log 2>/dev/null | grep -i -E "_select_model|Using fast|7B|qwen2.5" -A 1 -B 1

echo ""
echo "=== Recent Errors ==="
tail -200 backend/logs/app.log 2>/dev/null | grep -i -E "Error|Failed|Exception|Traceback" -A 1 -B 1 | tail -20



