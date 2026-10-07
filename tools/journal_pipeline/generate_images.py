from __future__ import annotations

import argparse
import base64
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from .io_utils import load_boxes_json
from .series_blocks import build_prompt


PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_dry_run(boxes_path: Path, asset_dir: Path, log_path: Path, sleep_seconds: float = 0.0) -> None:
    context, boxes = load_boxes_json(boxes_path)
    asset_dir.mkdir(parents=True, exist_ok=True)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    entries = []

    for box in boxes:
        started_at = now_iso()
        prompt = build_prompt(context.series_id, box)
        output_path = asset_dir / box.output_name
        output_path.write_bytes(PNG_1X1)
        sidecar = output_path.with_suffix(".prompt.txt")
        sidecar.write_text(prompt, encoding="utf-8")
        if sleep_seconds > 0:
            time.sleep(sleep_seconds)
        entries.append(
            {
                "image_id": box.image_id,
                "status": "SUCCESS",
                "adapter": "dry-run",
                "output_path": str(output_path),
                "prompt_path": str(sidecar),
                "ratio": box.ratio,
                "attempts": 1,
                "started_at": started_at,
                "ended_at": now_iso(),
            }
        )

    log_path.write_text(json.dumps({"journal_id": context.journal_id, "entries": entries}, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate images from parsed boxes.")
    parser.add_argument("boxes", type=Path)
    parser.add_argument("--asset-dir", type=Path)
    parser.add_argument("--log", type=Path)
    parser.add_argument("--adapter", choices=["dry-run"], default="dry-run")
    parser.add_argument("--sleep", type=float, default=0.0)
    args = parser.parse_args()

    context, _ = load_boxes_json(args.boxes)
    asset_dir = args.asset_dir or Path("assets") / context.journal_id
    log_path = args.log or Path("logs") / f"{context.journal_id}_image_generation.log"
    generate_dry_run(args.boxes, asset_dir, log_path, args.sleep)
    print(f"generated dry-run images -> {asset_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

