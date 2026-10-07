from __future__ import annotations

import unittest
from pathlib import Path

from tools.journal_pipeline.inject_images import inject_images
from tools.journal_pipeline.parse_boxes import parse_file, write_boxes_json
from tools.journal_pipeline.regulation_check import render_yaml


ROOT = Path(__file__).resolve().parents[2]
SAMPLE = ROOT / "tools" / "tests" / "fixtures" / "journal_01_A_with_images.md"


class PipelineTests(unittest.TestCase):
    def test_parse_sample_specs(self) -> None:
        context, boxes = parse_file(SAMPLE)
        self.assertEqual(context.journal_id, "journal-01-a")
        self.assertEqual(len(boxes), 6)
        self.assertEqual([box.image_id for box in boxes], [1, 2, 3, 4, 5, 6])
        self.assertEqual(boxes[0].alt, "마라톤 30km 표지판을 지나는 러너의 새벽 풍경")
        self.assertIn("cinematic editorial photograph", boxes[0].prompt)

    def test_inject_removes_specs_and_placeholders(self) -> None:
        context, boxes = parse_file(SAMPLE)
        tmp_path = ROOT / "logs" / "test_tmp"
        tmp_path.mkdir(parents=True, exist_ok=True)
        boxes_json = tmp_path / "boxes.json"
        out = tmp_path / "published.md"
        write_boxes_json(context, boxes, boxes_json)
        inject_images(SAMPLE, boxes_json, "/assets/journal-01-a", out)
        result = out.read_text(encoding="utf-8")
        self.assertIn("![마라톤 30km 표지판을 지나는 러너의 새벽 풍경](/assets/journal-01-a/img-1.png)", result)
        self.assertNotIn("[IMG-1:", result)
        self.assertNotIn("## 이미지 명세", result)

    def test_regulation_sample_passes(self) -> None:
        context, boxes = parse_file(SAMPLE)
        tmp_path = ROOT / "logs" / "test_tmp"
        tmp_path.mkdir(parents=True, exist_ok=True)
        boxes_json = tmp_path / "boxes.json"
        out = tmp_path / "published_for_check.md"
        write_boxes_json(context, boxes, boxes_json)
        inject_images(SAMPLE, boxes_json, "/assets/journal-01-a", out)
        text = out.read_text(encoding="utf-8")
        yaml = render_yaml(text, SAMPLE)
        self.assertIn("status: PASS", yaml.splitlines()[1])

    def test_regulation_fails_footer_hint(self) -> None:
        text = "본문입니다.\n더 자세한 정보는 하단의 버튼에서 확인하세요.\n일반 건강정보\n"
        yaml = render_yaml(text, Path("bad.md"))
        self.assertIn("status: FAIL", yaml.splitlines()[1])
        self.assertIn("check_id: 5", yaml)


if __name__ == "__main__":
    unittest.main()
