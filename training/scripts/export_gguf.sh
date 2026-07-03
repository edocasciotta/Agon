#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Convert the fused MLX model to GGUF and register it with Ollama.
#
# Prerequisites (run once):
#   git clone https://github.com/ggerganov/llama.cpp vendor/llama.cpp
#   cd vendor/llama.cpp && pip install -r requirements.txt
#
# Usage (from repo root):
#   bash training/scripts/export_gguf.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRAINING_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$TRAINING_DIR/.." && pwd)"

FUSED_DIR="$TRAINING_DIR/output/fused_f16"
GGUF_DIR="$TRAINING_DIR/output/gguf"
LLAMA_CPP="$REPO_ROOT/vendor/llama.cpp"
MODEL_NAME="agon-assistant"

mkdir -p "$GGUF_DIR"

# ── Step 1: Convert MLX → GGUF (F16 first, then quantise) ────────────────────
echo "Converting MLX model to GGUF..."
python "$LLAMA_CPP/convert_hf_to_gguf.py" \
  "$FUSED_DIR" \
  --outfile "$GGUF_DIR/agon-f16.gguf" \
  --outtype f16

echo "Quantising to Q4_K_M (~2 GB)..."
"$LLAMA_CPP/build/bin/llama-quantize" \
  "$GGUF_DIR/agon-f16.gguf" \
  "$GGUF_DIR/agon-q4_k_m.gguf" \
  Q4_K_M

# ── Step 2: Create Ollama Modelfile ──────────────────────────────────────────
MODELFILE="$GGUF_DIR/Modelfile"
cat > "$MODELFILE" <<EOF
FROM $GGUF_DIR/agon-q4_k_m.gguf

# Agon AI assistant — fine-tuned on Llama 3.2 3B
PARAMETER temperature 0.2
PARAMETER top_p 0.9
PARAMETER num_ctx 8192
PARAMETER stop "<|eot_id|>"
EOF

# ── Step 3: Register with Ollama ──────────────────────────────────────────────
echo "Registering model with Ollama as '$MODEL_NAME'..."
ollama create "$MODEL_NAME" -f "$MODELFILE"

echo ""
echo "=== Export complete ==="
echo "Model registered: $MODEL_NAME"
echo ""
echo "To use with Agon, set in backend/.env:"
echo "  LLM_PROVIDER=ollama"
echo "  LLM_MODEL=ollama/$MODEL_NAME"
echo ""
echo "Test it:"
echo "  ollama run $MODEL_NAME"
