"""Score DesignLens's extraction against a hand-labelled set.

Usage:
    # 1. put images in eval/images/  and labels in eval/labels.jsonl  (see labels.example.jsonl)
    # 2. from the repo root, with the backend venv active and ANTHROPIC_API_KEY set:
    python eval/run_eval.py

Reports exact-match accuracy for building_type / setting and set-F1 for
materials / styles, at temperature=0 so the numbers are reproducible.
"""

from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "backend"))

from app.extractor import extract_design  # noqa: E402

IMAGES_DIR = os.path.join(HERE, "images")
LABELS = os.path.join(HERE, "labels.jsonl")
_MEDIA = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


def set_f1(pred: list[str], gold: list[str]) -> float:
    p, g = {x.lower().strip() for x in pred}, {x.lower().strip() for x in gold}
    if not p and not g:
        return 1.0
    if not p or not g:
        return 0.0
    tp = len(p & g)
    prec = tp / len(p)
    rec = tp / len(g)
    return 0.0 if prec + rec == 0 else 2 * prec * rec / (prec + rec)


def main() -> None:
    if not os.path.exists(LABELS):
        sys.exit(f"No labels file at {LABELS} — copy labels.example.jsonl to labels.jsonl and fill it in.")

    rows = [json.loads(line) for line in open(LABELS, encoding="utf-8") if line.strip()]
    n = bt_hits = set_hits = 0
    mat_f1 = sty_f1 = 0.0

    for row in rows:
        path = os.path.join(IMAGES_DIR, row["file"])
        if not os.path.exists(path):
            print(f"  skip (missing image): {row['file']}")
            continue
        ext = row["file"].rsplit(".", 1)[-1].lower()
        with open(path, "rb") as f:
            result = extract_design(f.read(), _MEDIA.get(ext, "image/jpeg"))
        a = result.attributes
        n += 1
        bt_hits += int(a.building_type == row.get("building_type"))
        set_hits += int(a.setting == row.get("setting"))
        mat_f1 += set_f1(a.primary_materials, row.get("materials", []))
        sty_f1 += set_f1(a.architectural_style, row.get("styles", []))
        print(f"  scored: {row['file']} -> {a.building_type}")

    if n == 0:
        sys.exit("No images scored. Put files in eval/images/ matching labels.jsonl.")

    print(f"\n=== DesignLens extraction eval (n={n}, temperature=0) ===")
    print(f"building_type accuracy : {bt_hits / n:.0%}")
    print(f"setting accuracy       : {set_hits / n:.0%}")
    print(f"materials set-F1       : {mat_f1 / n:.2f}")
    print(f"style set-F1           : {sty_f1 / n:.2f}")


if __name__ == "__main__":
    main()
