from __future__ import annotations

import argparse
import re
from pathlib import Path

from .io_utils import load_boxes_json


SPEC_HEADING_RE = re.compile(r"^##\s+이미지\s+명세\s*$")
PLACEHOLDER_RE = re.compile(r"^\[IMG-(?P<id>\d+):\s*(?P<name>[^\]]+)\]\s*$")


def strip_image_specs(text: str) -> str:
    lines = text.splitlines()
    for idx, line in enumerate(lines):
        if SPEC_HEADING_RE.match(line.strip()):
            trimmed = lines[:idx]
            while trimmed and trimmed[-1].strip() in {"", "---"}:
                trimmed.pop()
            return "\n".join(trimmed).rstrip() + "\n"
    return text


def inject_images(source: Path, boxes_path: Path, asset_path: str, output: Path) -> None:
    _, boxes = load_boxes_json(boxes_path)
    by_id = {box.image_id: box for box in boxes}
    text = strip_image_specs(source.read_text(encoding="utf-8"))
    rendered: list[str] = []

    for line in text.splitlines():
        match = PLACEHOLDER_RE.match(line.strip())
        if not match:
            rendered.append(line)
            continue
        image_id = int(match.group("id"))
        if image_id not in by_id:
            raise ValueError(f"No parsed image spec for placeholder IMG-{image_id}")
        box = by_id[image_id]
        rendered.append(f"![{box.alt}]({asset_path.rstrip('/')}/{box.output_name})")
        if box.caption:
            rendered.append("")
            rendered.append(box.caption)

    result = "\n".join(rendered).rstrip() + "\n"
    if PLACEHOLDER_RE.search(result):
        raise ValueError("Unreplaced IMG placeholder remains after injection.")
    if "## 이미지 명세" in result:
        raise ValueError("Image spec appendix remains after injection.")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(result, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Replace IMG placeholders with markdown image embeds.")
    parser.add_argument("source", type=Path)
    parser.add_argument("--boxes", type=Path, required=True)
    parser.add_argument("--asset-path", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    inject_images(args.source, args.boxes, args.asset_path, args.out)
    print(f"wrote injected markdown -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

