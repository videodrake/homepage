from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ImageBox:
    image_id: int
    name: str
    image_type: str
    position: str
    intent: str
    ratio: str
    alt: str
    caption: str
    prompt: str
    placeholder_line: int | None = None
    spec_start_line: int | None = None
    spec_end_line: int | None = None

    @property
    def output_name(self) -> str:
        return f"img-{self.image_id}.png"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class JournalContext:
    journal_id: str
    series_id: str
    source_path: Path

    def to_dict(self) -> dict[str, str]:
        return {
            "journal_id": self.journal_id,
            "series_id": self.series_id,
            "source_path": str(self.source_path),
        }

