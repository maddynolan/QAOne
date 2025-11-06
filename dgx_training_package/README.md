# QA Expert Fine-Tuning Package

## Contents

- **data/** - Training data (train.jsonl, val.jsonl)
- **scripts/** - Training scripts (train_lora.py, evaluate_model.py)
- **configs/** - Training configuration (lora_qwen7b_dgx.yaml)
- **setup.sh** - Setup script for DGX Spark

## Quick Start

### 1. Transfer to DGX Spark
```bash
scp -r dgx_training_package user@dgx-spark:~/qa_finetuning/
```

### 2. SSH to DGX Spark
```bash
ssh user@dgx-spark
cd ~/qa_finetuning/dgx_training_package
```

### 3. Run Setup
```bash
bash setup.sh
```

### 4. Activate Environment
```bash
conda activate qafn
```

### 5. Start Training
```bash
python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml
```

## Data Summary

- **Training examples:** 396
- **Validation examples:** 100
- **Total:** 496 examples
- **Quality:** 97% high quality (4+ stars)
- **Format:** JSONL (instruction/input/output)

## Expected Training Time

- **Estimated:** 2-4 hours on DGX Spark
- **Model output:** `outputs/qa-expert-7b-v1`

## Next Steps After Training

1. Evaluate model: `python scripts/evaluate_model.py --model outputs/qa-expert-7b-v1`
2. Convert to Ollama format
3. Deploy to Ollama server
4. Register in Model Registry
5. A/B test against base model

## Troubleshooting

- **GPU not detected:** Check `nvidia-smi` and CUDA installation
- **Out of memory:** Reduce batch_size in config
- **Training slow:** Check GPU utilization with `nvidia-smi`
