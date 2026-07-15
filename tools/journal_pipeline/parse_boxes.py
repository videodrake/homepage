from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from .models import ImageBox, JournalContext


PLACEHOLDER_RE = re.compile(r"^\[IMG-(?P<id>\d+):\s*(?P<name>[^\]]+)\]\s*$")
SECTION_RE = re.compile(r"^###\s+IMG-(?P<id>\d+)\s+[—-]\s+(?P<name>.+?)\s*$")
FIELD_RE = re.compile(r"^-\s+\*\*(?P<key>[^*]+)\*\*:\s*(?P<value>.*)\s*$")
QUOTE_RE = re.compile(r'^"(?P<value>.*)"$')
FRONTMATTER_SOURCE_RE = re.compile(r'^journal_source:\s*"?(?:Journal\s*)?№?(?P<num>\d+)-(?P<part>[A-Za-z])"?\s*$')
FILENAME_ID_RE = re.compile(r"journal[_-](?P<num>\d+)[_-](?P<part>[A-Za-z])")


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def derive_context(path: Path, text: str) -> JournalContext:
    for line in text.splitlines()[:40]:
        m = FRONTMATTER_SOURCE_RE.match(line.strip())
        if m:
            num = int(m.group("num"))
            part = m.group("part").lower()
            journal_id = f"journal-{num:02d}-{part}"
            return JournalContext(journal_id=journal_id, series_id=f"journal-{num:02d}", source_path=path)

    m = FILENAME_ID_RE.search(path.stem)
    if m:
        num = int(m.group("num"))
        part = m.group("part").lower()
        journal_id = f"journal-{num:02d}-{part}"
        return JournalContext(journal_id=journal_id, series_id=f"journal-{num:02d}", source_path=path)

    raise ValueError(f"Cannot derive journal id from frontmatter or filename: {path}")


def _clean_value(value: str) -> str:
    value = value.strip()
    m = QUOTE_RE.match(value)
    return m.group("value") if m else value


def _parse_placeholders(lines: list[str]) -> dict[int, int]:
    placeholders: dict[int, int] = {}
    for idx, line in enumerate(lines, start=1):
        m = PLACEHOLDER_RE.match(line.strip())
        if not m:
            continue
        image_id = int(m.group("id"))
        if image_id in placeholders:
            raise ValueError(f"Duplicate placeholder IMG-{image_id} at line {idx}")
        placeholders[image_id] = idx
    return placeholders


def _collect_prompt(lines: list[str], start_idx: int) -> tuple[str, int]:
    prompt_lines: list[str] = []
    idx = start_idx
    while idx < len(lines):
        raw = lines[idx]
        stripped = raw.strip()
        if stripped == "---" or SECTION_RE.match(stripped):
            break
        if stripped.startswith(">"):
            prompt_lines.append(stripped[1:].lstrip())
        elif prompt_lines and stripped == "":
            prompt_lines.append("")
        elif prompt_lines:
            break
        idx += 1
    prompt = "\n".join(prompt_lines).strip()
    return prompt, idx


def parse_image_specs(text: str) -> tuple[JournalContext, list[ImageBox]]:
    lines = text.splitlines()
    context = derive_context(Path("<memory>"), text)
    placeholders = _parse_placeholders(lines)
    boxes: list[ImageBox] = []

    idx = 0
    while idx < len(lines):
        section_match = SECTION_RE.match(lines[idx].strip())
        if not section_match:
            idx += 1
            continue

        image_id = int(section_match.group("id"))
        name = section_match.group("name").strip()
        spec_start_line = idx + 1
        fields: dict[str, str] = {}
        idx += 1

        while idx < len(lines):
            stripped = lines[idx].strip()
            if stripped.startswith("**프롬프트"):
                idx += 1
                prompt, idx = _collect_prompt(lines, idx)
                fields["프롬프트"] = prompt
                break
            field_match = FIELD_RE.match(stripped)
            if field_match:
                fields[field_match.group("key").strip()] = _clean_value(field_match.group("value"))
            if stripped == "---" or SECTION_RE.match(stripped):
                break
            idx += 1

        while idx < len(lines) and lines[idx].strip() not in {"---"} and not SECTION_RE.match(lines[idx].strip()):
            idx += 1

        required = {
            "종류": "image_type",
            "위치": "position",
            "위치 의도": "intent",
            "비율": "ratio",
            "alt 텍스트": "alt",
            "캡션": "caption",
            "프롬프트": "prompt",
        }
        missing = [key for key in required if not fields.get(key)]
        if missing:
            raise ValueError(f"IMG-{image_id} missing required fields at line {spec_start_line}: {', '.join(missing)}")
        if len(fields["프롬프트"]) < 20:
            raise ValueError(f"IMG-{image_id} prompt is too short at line {spec_start_line}")

        boxes.append(
            ImageBox(
                image_id=image_id,
                name=name,
                image_type=fields["종류"],
                position=fields["위치"],
                intent=fields["위치 의도"],
                ratio=fields["비율"],
                alt=fields["alt 텍스트"],
                caption=fields["캡션"],
                prompt=fields["프롬프트"],
                placeholder_line=placeholders.get(image_id),
                spec_start_line=spec_start_line,
                spec_end_line=idx + 1,
            )
        )

    if not boxes:
        raise ValueError("No image specs found. Expected sections like '### IMG-1 — name'.")

    ids = [box.image_id for box in boxes]
    expected = list(range(1, len(ids) + 1))
    if ids != expected:
        raise ValueError(f"Image specs must be sequential from 1. Expected {expected}, found {ids}")

    missing_placeholders = [box.image_id for box in boxes if box.placeholder_line is None]
    if missing_placeholders:
        raise ValueError(f"Missing body placeholders for IMG ids: {missing_placeholders}")

    return context, boxes


def parse_file(path: Path) -> tuple[JournalContext, list[ImageBox]]:
    text = read_text(path)
    context, boxes = parse_image_specs(text)
    return JournalContext(context.journal_id, context.series_id, path), boxes


def write_boxes_json(context: JournalContext, boxes: list[ImageBox], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "journal": context.to_dict(),
        "boxes": [box.to_dict() for box in boxes],
    }
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse Journal IMG specs into JSON.")
    parser.add_argument("source", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()

    context, boxes = parse_file(args.source)
    output = args.out or Path("logs") / f"{context.journal_id}_boxes.json"
    write_boxes_json(context, boxes, output)
    print(f"parsed {len(boxes)} image specs -> {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

