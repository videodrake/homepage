from __future__ import annotations

import json
from pathlib import Path

from .models import ImageBox, JournalContext


def load_boxes_json(path: Path) -> tuple[JournalContext, list[ImageBox]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    journal = payload["journal"]
    context = JournalContext(
        journal_id=journal["journal_id"],
        series_id=journal["series_id"],
        source_path=Path(journal["source_path"]),
    )
    boxes = [ImageBox(**item) for item in payload["boxes"]]
    return context, boxes

