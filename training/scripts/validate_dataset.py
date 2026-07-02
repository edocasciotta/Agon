#!/usr/bin/env python3
"""
Validate training JSONL files before fine-tuning.

Checks:
- Valid JSON on every line
- Required 'messages' key present
- Roles are valid (system/user/assistant/tool)
- Conversations start with system + user
- Tool calls have the expected structure
- No empty content strings

Usage:
    python training/scripts/validate_dataset.py
"""

import json
import sys
from pathlib import Path

DATASET_DIR = Path(__file__).parent.parent / "dataset"
VALID_ROLES = {"system", "user", "assistant", "tool"}
KNOWN_TOOLS = {"create_class", "cancel_class"}


def validate_file(path: Path) -> tuple[int, list[str]]:
    errors: list[str] = []
    count = 0

    with open(path, encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            count += 1

            try:
                ex = json.loads(line)
            except json.JSONDecodeError as e:
                errors.append(f"Line {line_num}: invalid JSON — {e}")
                continue

            if "messages" not in ex:
                errors.append(f"Line {line_num}: missing 'messages' key")
                continue

            msgs = ex["messages"]
            if not msgs:
                errors.append(f"Line {line_num}: empty messages list")
                continue

            if msgs[0]["role"] != "system":
                errors.append(f"Line {line_num}: first message must be 'system'")

            if len(msgs) < 2 or msgs[1]["role"] != "user":
                errors.append(f"Line {line_num}: second message must be 'user'")

            for i, msg in enumerate(msgs):
                role = msg.get("role")
                if role not in VALID_ROLES:
                    errors.append(f"Line {line_num}, msg {i}: unknown role '{role}'")

                content = msg.get("content")
                tool_calls = msg.get("tool_calls")

                if role == "assistant" and content is None and not tool_calls:
                    errors.append(f"Line {line_num}, msg {i}: assistant has neither content nor tool_calls")

                if role in ("system", "user", "tool") and not content:
                    errors.append(f"Line {line_num}, msg {i}: role '{role}' has empty content")

                if tool_calls:
                    for tc in tool_calls:
                        fn = tc.get("function", {})
                        name = fn.get("name", "")
                        if name not in KNOWN_TOOLS:
                            errors.append(f"Line {line_num}, msg {i}: unknown tool '{name}'")
                        try:
                            args = json.loads(fn.get("arguments", "{}"))
                            if not isinstance(args, dict):
                                errors.append(f"Line {line_num}: tool arguments must be a JSON object")
                        except json.JSONDecodeError:
                            errors.append(f"Line {line_num}: tool arguments are not valid JSON")

    return count, errors


def main() -> None:
    splits = ["train", "valid", "test"]
    all_ok = True

    for split in splits:
        path = DATASET_DIR / f"{split}.jsonl"
        if not path.exists():
            print(f"  MISSING  {split}.jsonl")
            all_ok = False
            continue

        count, errors = validate_file(path)
        if errors:
            all_ok = False
            print(f"  FAIL     {split}.jsonl  ({count} examples, {len(errors)} errors)")
            for e in errors[:10]:
                print(f"           {e}")
            if len(errors) > 10:
                print(f"           ... and {len(errors) - 10} more")
        else:
            print(f"  OK       {split}.jsonl  ({count} examples)")

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
