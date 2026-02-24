# Backend API - Enterprise Deploy-ready
# Python 3.10+, uvicorn. Use cloud LLM API keys (OpenAI/Anthropic); OLLAMA not used for SaaS.

FROM python:3.10-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security (CIS Docker Benchmark 4.1)
RUN groupadd -r appuser && useradd -r -g appuser -u 1001 -d /app -s /sbin/nologin appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create logs directory and set ownership
RUN mkdir -p /app/logs && chown -R appuser:appuser /app

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Run as non-root user
USER appuser

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
