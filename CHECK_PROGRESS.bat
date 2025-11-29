@echo off
REM Quick progress check script
python -c "from scripts.monitor_pipeline_progress import get_progress, print_progress; print_progress(get_progress())"
pause




