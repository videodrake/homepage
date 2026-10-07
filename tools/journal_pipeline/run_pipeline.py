from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from .generate_images import generate_dry_run
from .inject_images import inject_images
from .parse_boxes import parse_file, write_boxes_json
from .regulation_check import run_check
from .render_review import render_review
from .verify_images import verify_images


def run_all(source: Path, adapter: str = "dry-run") -> int:
    if adapter != "dry-run":
        raise ValueError("Only dry-run adapter is implemented in this local scaffold.")

    context, boxes = parse_file(source)
    logs_dir = Path("logs")
    boxes_path = logs_dir / f"{context.journal_id}_boxes.json"
    asset_dir = Path("assets") / context.journal_id
    log_path = logs_dir / f"{context.journal_id}_image_generation.log"
    output_md = Path("content") / "published" / f"{context.journal_id}.md"
    regulation_path = logs_dir / f"{context.journal_id}_regulation.yaml"
    review_path = logs_dir / f"{context.journal_id}_review.html"
    manifest_path = logs_dir / f"{context.journal_id}_pipeline.json"

    write_boxes_json(context, boxes, boxes_path)
    generate_dry_run(boxes_path, asset_dir, log_path)
    ok, errors = verify_images(boxes_path, asset_dir)
    if not ok:
        for error in errors:
            print(f"FAIL: {error}")
        return 1
    inject_images(source, boxes_path, f"/assets/{context.journal_id}", output_md)
    regulation_ok = run_check(output_md, regulation_path)
    render_review(boxes_path, f"../assets/{context.journal_id}", review_path)

    manifest = {
        "journal_id": context.journal_id,
        "series_id": context.series_id,
        "source_md": str(source),
        "boxes_json": str(boxes_path),
        "asset_dir": str(asset_dir),
        "output_md": str(output_md),
        "image_log": str(log_path),
        "regulation_yaml": str(regulation_path),
        "review_html": str(review_path),
        "boxes_expected": len(boxes),
        "images_expected": len(boxes),
        "images_generated": len(list(asset_dir.glob("img-*.png"))),
        "regulation_status": "PASS" if regulation_ok else "FAIL",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"pipeline manifest -> {manifest_path}")
    return 0 if regulation_ok else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Journal automation pipeline.")
    parser.add_argument("command", choices=["all"])
    parser.add_argument("source", type=Path)
    parser.add_argument("--adapter", choices=["dry-run"], default="dry-run")
    args = parser.parse_args()
    if args.command == "all":
        return run_all(args.source, args.adapter)
    raise AssertionError(args.command)


if __name__ == "__main__":
    raise SystemExit(main())
