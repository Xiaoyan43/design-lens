# Evaluation plan

The point of this folder is to make DesignLens's accuracy a **number, not a vibe** — the same discipline
used on the L1 Help Desk Copilot (category accuracy 80% → 92% on a labelled set).

## Set
- ~50 royalty-free architecture/design images (houses, apartments, civic, interiors), spread across
  styles and settings so the test isn't all easy modern glass boxes.
- For each image, a hand-written ground-truth label: `building_type`, `primary_materials` (set),
  `setting`, and a small set of acceptable `architectural_style` tags.

## Metrics
- **building_type / setting** — exact-match accuracy.
- **primary_materials / architectural_style** — set overlap (precision / recall → F1), since more than
  one answer can be correct.
- Report a **baseline** (first naive prompt + loose schema) vs the **tuned** version (controlled
  vocabulary + few-shot + tighter tool schema), both at `temperature=0` so the numbers are reproducible.

## Why it matters
It shows the candidate can tell whether an AI feature actually works, find the weak field, and lift it —
rather than shipping a demo that looks clever and quietly gets things wrong.

## Layout (to add)
- `labels.jsonl` — one row per image: `{ "file": "...", "building_type": "...", "materials": [...], ... }`
- `run_eval.py` — calls the same extractor, scores against `labels.jsonl`, prints baseline vs tuned.
- Images live in `eval/images/` and are **git-ignored** (royalty-free, not committed).
