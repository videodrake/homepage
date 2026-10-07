from __future__ import annotations

import argparse
from pathlib import Path

from .io_utils import load_boxes_json


def verify_images(boxes_path: Path, asset_dir: Path) -> tuple[bool, list[str]]:
    _, boxes = load_boxes_json(boxes_path)
    errors: list[str] = []
    for box in boxes:
        path = asset_dir / box.output_name
        if not path.exists():
            errors.append(f"missing IMG-{box.image_id}: {path}")
            continue
        if path.stat().st_size <= 0:
            errors.append(f"empty IMG-{box.image_id}: {path}")
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            errors.append(f"unsupported extension IMG-{box.image_id}: {path}")
    return not errors, errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify generated image files.")
    parser.add_argument("boxes", type=Path)
    parser.add_argument("--asset-dir", type=Path)
    args = parser.parse_args()

    context, _ = load_boxes_json(args.boxes)
    asset_dir = args.asset_dir or Path("assets") / context.journal_id
    ok, errors = verify_images(args.boxes, asset_dir)
    if ok:
        print(f"PASS: all expected images exist in {asset_dir}")
        return 0
    for error in errors:
        print(f"FAIL: {error}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

