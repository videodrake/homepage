from __future__ import annotations

import argparse
import html
import json
from pathlib import Path

from .io_utils import load_boxes_json


def render_review(boxes_path: Path, asset_path: str, output: Path) -> None:
    context, boxes = load_boxes_json(boxes_path)
    cards = []
    for box in boxes:
        image_src = f"{asset_path.rstrip('/')}/{box.output_name}"
        prompt_preview = html.escape(box.prompt[:800])
        cards.append(
            f"""
      <article class="card">
        <img src="{html.escape(image_src)}" alt="{html.escape(box.alt)}">
        <div class="meta">
          <h2>IMG-{box.image_id}: {html.escape(box.name)}</h2>
          <p><strong>Type</strong> {html.escape(box.image_type)}</p>
          <p><strong>Ratio</strong> {html.escape(box.ratio)}</p>
          <p><strong>Alt</strong> {html.escape(box.alt)}</p>
          <p><strong>Caption</strong> {html.escape(box.caption)}</p>
          <details>
            <summary>Prompt</summary>
            <pre>{prompt_preview}</pre>
          </details>
        </div>
      </article>
"""
        )

    html_doc = f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(context.journal_id)} review</title>
  <style>
    body {{ margin: 0; font-family: Arial, sans-serif; background: #f7f7f4; color: #1f2933; }}
    header {{ padding: 24px; border-bottom: 1px solid #d8d8d2; background: #fff; }}
    h1 {{ margin: 0; font-size: 22px; }}
    main {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; padding: 16px; }}
    .card {{ background: #fff; border: 1px solid #d8d8d2; border-radius: 8px; overflow: hidden; }}
    img {{ width: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: #ecece8; display: block; }}
    .meta {{ padding: 14px; }}
    h2 {{ font-size: 16px; margin: 0 0 10px; }}
    p {{ font-size: 13px; line-height: 1.45; margin: 6px 0; }}
    pre {{ white-space: pre-wrap; font-size: 12px; line-height: 1.4; }}
  </style>
</head>
<body>
  <header>
    <h1>{html.escape(context.journal_id)} image review</h1>
  </header>
  <main>
{''.join(cards)}
  </main>
</body>
</html>
"""
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html_doc, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Render a simple Journal image review HTML.")
    parser.add_argument("boxes", type=Path)
    parser.add_argument("--asset-path", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    render_review(args.boxes, args.asset_path, args.out)
    print(f"wrote review html -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

