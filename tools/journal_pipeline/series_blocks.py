from __future__ import annotations

from .models import ImageBox


SERIES_BLOCKS = {
    "journal-01": {
        "photo": [
            "[색감] cool blue-grey color grade with muted teal shadows, desaturated highlights",
            "[모델] Korean male runner in his late 30s, lean build, contemplative expression",
            "[조명] early dawn or soft morning light, cool restrained editorial mood",
            "[스타일] editorial magazine aesthetic, Magazine B style, no text overlay",
        ],
        "diagram": [
            "[배경] off-white background (#FAFAF7)",
            "[메인] deep navy (#1A2B3C) primary",
            "[액센트] warm orange (#E8743C) accent",
            "[폰트] Pretendard for Korean labels, rendered correctly",
            "[스타일] flat clean editorial design, no 3D effects",
        ],
    }
}


PHOTO_KEYWORDS = ("분위기", "인물", "사진", "장면", "헤더")
DIAGRAM_KEYWORDS = ("다이어그램", "인포그래픽", "데이터", "시각화", "차트", "도식")


def classify_image_type(box: ImageBox) -> str:
    image_type = box.image_type
    if any(keyword in image_type for keyword in DIAGRAM_KEYWORDS):
        return "diagram"
    if any(keyword in image_type for keyword in PHOTO_KEYWORDS):
        return "photo"
    raise ValueError(f"Cannot classify image type for IMG-{box.image_id}: {box.image_type}")


def build_prompt(series_id: str, box: ImageBox) -> str:
    block_type = classify_image_type(box)
    try:
        block = SERIES_BLOCKS[series_id][block_type]
    except KeyError as exc:
        raise ValueError(f"Missing series block for {series_id}/{block_type}") from exc
    return "\n".join(block + ["", box.prompt])

