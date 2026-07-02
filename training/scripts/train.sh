#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Agon fine-tuning script — Apple Silicon (M5) via MLX-LM
#
# Prerequisites (run once):
#   pip install mlx-lm
#
# Usage (from repo root):
#   bash training/scripts/train.sh
#
# Output:
#   training/output/adapters/   ← LoRA adapter weights
#   training/output/fused/      ← merged model (ready for GGUF conversion)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRAINING_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BASE_MODEL="mlx-community/Llama-3.2-3B-Instruct-4bit"
ADAPTER_DIR="$TRAINING_DIR/output/adapters"
FUSED_DIR="$TRAINING_DIR/output/fused"
DATA_DIR="$TRAINING_DIR/dataset"

mkdir -p "$ADAPTER_DIR" "$FUSED_DIR"

echo "=== Agon fine-tuning ==="
echo "Base model : $BASE_MODEL"
echo "Dataset    : $DATA_DIR"
echo "Adapters   : $ADAPTER_DIR"
echo ""

# ── Step 1: Validate dataset ──────────────────────────────────────────────────
echo "Step 1/3 — Validating dataset..."
python "$SCRIPT_DIR/validate_dataset.py"

# ── Step 2: LoRA fine-tuning ──────────────────────────────────────────────────
echo ""
echo "Step 2/3 — Fine-tuning (this will take 2-3 hours on M5)..."
python -m mlx_lm.lora \
  --model "$BASE_MODEL" \
  --data "$DATA_DIR" \
  --train \
  --batch-size 4 \
  --num-layers 16 \
  --iters 1200 \
  --learning-rate 1e-4 \
  --lora-rank 16 \
  --lora-scale 32 \
  --adapter-path "$ADAPTER_DIR" \
  --save-every 200 \
  --val-batches 20

# ── Step 3: Fuse LoRA weights into base model ─────────────────────────────────
echo ""
echo "Step 3/3 — Fusing LoRA adapters into base model..."
python -m mlx_lm.fuse \
  --model "$BASE_MODEL" \
  --adapter-path "$ADAPTER_DIR" \
  --save-path "$FUSED_DIR"

echo ""
echo "=== Fine-tuning complete ==="
echo "Fused model saved to: $FUSED_DIR"
echo ""
echo "Next step: convert to GGUF and load into Ollama."
echo "Run: bash training/scripts/export_gguf.sh"
