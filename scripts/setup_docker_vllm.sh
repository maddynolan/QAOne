#!/bin/bash
# Setup Docker vLLM with FP8/FP4 support for DGX Spark GB10
# Optimized for 128GB GPU

set -e

echo "============================================================"
echo "🐳 Docker vLLM Setup for DGX Spark GB10"
echo "============================================================"
echo ""

WORK_DIR="${1:-~/qa_finetuning}"
MODEL_DIR="${WORK_DIR}/outputs/qa-expert-30b-coder"
VLLM_PORT="${VLLM_PORT:-8000}"

echo "Work directory: $WORK_DIR"
echo "Model directory: $MODEL_DIR"
echo "vLLM port: $VLLM_PORT"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Installing..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Check NVIDIA Docker
if ! docker info | grep -q nvidia; then
    echo "⚠️  NVIDIA Docker runtime not configured"
    echo "Installing nvidia-docker2..."
    distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
    curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
    curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
    sudo apt-get update
    sudo apt-get install -y nvidia-docker2
    sudo systemctl restart docker
fi

# Pull vLLM image (latest with FP8 support)
echo "📥 Pulling vLLM Docker image..."
docker pull vllm/vllm-openai:latest

# Create Docker Compose file
echo "📝 Creating Docker Compose configuration..."
cat > ${WORK_DIR}/docker/docker-compose.yml << EOF
version: '3.8'

services:
  vllm:
    image: vllm/vllm-openai:latest
    container_name: qa-vllm-server
    runtime: nvidia
    environment:
      - CUDA_VISIBLE_DEVICES=0
      - VLLM_USE_MODELSCOPE=False
    ports:
      - "${VLLM_PORT}:8000"
    volumes:
      - ${MODEL_DIR}:/models/qa-expert-30b-coder
      - ${WORK_DIR}/docker/logs:/var/log/vllm
    command: >
      vllm serve /models/qa-expert-30b-coder
      --host 0.0.0.0
      --port 8000
      --dtype auto
      --max-model-len 4096
      --gpu-memory-utilization 0.95
      --enforce-eager
      --quantization fp8
      --tensor-parallel-size 1
      --trust-remote-code
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
EOF

# Create startup script
cat > ${WORK_DIR}/docker/start_vllm.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose up -d
echo "✅ vLLM server starting..."
echo "Check logs: docker-compose logs -f"
echo "Check status: docker-compose ps"
EOF

chmod +x ${WORK_DIR}/docker/start_vllm.sh

# Create stop script
cat > ${WORK_DIR}/docker/stop_vllm.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker-compose down
echo "✅ vLLM server stopped"
EOF

chmod +x ${WORK_DIR}/docker/stop_vllm.sh

echo ""
echo "✅ Docker vLLM setup complete!"
echo ""
echo "To start vLLM server:"
echo "  cd ${WORK_DIR}/docker && ./start_vllm.sh"
echo ""
echo "To stop:"
echo "  cd ${WORK_DIR}/docker && ./stop_vllm.sh"
echo ""
echo "To check logs:"
echo "  docker-compose -f ${WORK_DIR}/docker/docker-compose.yml logs -f"
echo ""




