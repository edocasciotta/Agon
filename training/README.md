# Agon Fine-Tuning

Fine-tunes **Llama 3.2 3B** on Agon-specific conversations so the AI assistant
runs fully offline, with no API costs and no rate limits.

Runs entirely on a **MacBook Air M5 16 GB** via Apple MLX.

---

## Directory structure

```
training/
├── config/
│   ├── studio_fixtures.json   ← sample studio data used in training examples
│   └── tools.json             ← tool schemas (create_class, cancel_class)
├── dataset/                   ← generated JSONL files (git-tracked)
│   ├── train.jsonl
│   ├── valid.jsonl
│   └── test.jsonl
├── output/                    ← training artifacts (git-ignored)
│   ├── adapters/              ← LoRA checkpoint
│   ├── fused/                 ← merged model
│   └── gguf/                  ← quantised GGUF + Modelfile
├── scripts/
│   ├── generate_dataset.py    ← generate training examples from templates
│   ├── validate_dataset.py    ← validate JSONL format before training
│   ├── train.sh               ← MLX LoRA fine-tuning
│   └── export_gguf.sh         ← convert to GGUF + register with Ollama
└── README.md
```

---

## When to regenerate the dataset

| Change | Regenerate? |
|---|---|
| New location / instructor / class type | **No** — injected at runtime via system prompt |
| New action (e.g. `book_class_for_client`) | **Yes** — add examples + retrain |
| New documentation / FAQ | **No** — add to docs, injected via context |
| Language / tone adjustment | **Yes** — update templates + retrain |

---

## Step 1 — Generate the dataset

```bash
# From repo root
python training/scripts/generate_dataset.py
```

Produces `dataset/train.jsonl` (~1200 examples), `valid.jsonl` (~150), `test.jsonl` (~150).

---

## Step 2 — Validate

```bash
python training/scripts/validate_dataset.py
```

All three files must show `OK` before training.

---

## Step 3 — Install MLX-LM (once)

```bash
pip install mlx-lm
```

---

## Step 4 — Fine-tune (leave overnight if needed)

```bash
bash training/scripts/train.sh
```

Estimated time on M5 16 GB:
- Llama 3.2 1B → ~45 min
- Llama 3.2 3B → ~2–3 hours

---

## Step 5 — Export to GGUF and load into Ollama

**Prerequisites (once):**
```bash
git clone https://github.com/ggerganov/llama.cpp vendor/llama.cpp
cd vendor/llama.cpp
pip install -r requirements.txt
make llama-quantize          # or: cmake -B build && cmake --build build --target llama-quantize
```

**Export:**
```bash
bash training/scripts/export_gguf.sh
```

---

## Step 6 — Point Agon at the local model

In `backend/.env`:
```
LLM_PROVIDER=ollama
LLM_MODEL=ollama/agon-assistant
LLM_API_KEY=
```

Restart the backend. No other code changes needed.

---

## Adding training examples for a new feature

When a new action is added to the Agon agent (e.g. `book_class`):

1. Add the tool schema to `config/tools.json`
2. Add generator functions in `scripts/generate_dataset.py`
   (follow the same pattern as `gen_create_happy_path`, `gen_cancel_happy_path`)
3. Call the new generator inside `generate_all()`
4. Re-run `generate_dataset.py` → `validate_dataset.py` → `train.sh`

Expect ~2 hours of work per new action + one training run.
