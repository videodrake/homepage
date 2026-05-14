"""
inject_images.py — 본문의 [IMG-N: 식별명] 마커를 이미지 임베드로 치환.

입력:
  - 원본 .md 파일 (인자)
  - parse_boxes.py + inject_series_block.py 결과 JSON (stdin)
출력:
  - 마커가 ![alt](path)로 치환된 .md (stdout)

사용 예:
    python parse_boxes.py file.md --json \\
      | python inject_series_block.py --series journal-01 \\
      | python inject_images.py file.md --asset-base /assets/journal-01-a \\
      > published.md

핵심 규칙:
- [IMG-N: 식별명] 단독 줄 → ![alt 텍스트](경로) + 다음 줄 캡션(이탤릭)
- "## 이미지 명세" 섹션은 기본 제거 (--keep-spec 옵션으로 보존 가능)
- JSON validation.ok=False면 stderr 경고 후 exit 1
"""

import re
import sys
import json
import argparse
from pathlib import Path


def _configure_stdio() -> None:
    for stream_name in ("stdin", "stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


_configure_stdio()


# parse_boxes.py와 동일한 마커 패턴
MARKER_PATTERN = re.compile(
    r'^\s*\[IMG-(\d+):\s*([^\]]+)\]\s*$',
    re.MULTILINE
)

# 명세 섹션 시작 — "## 이미지 명세"
SPEC_SECTION_PATTERN = re.compile(
    r'\n*---\s*\n+##\s+이미지 명세[\s\S]*$',
    re.MULTILINE
)
# fallback: --- 없이 바로 ## 이미지 명세
SPEC_SECTION_PATTERN_NO_HR = re.compile(
    r'\n+##\s+이미지 명세[\s\S]*$',
    re.MULTILINE
)


def build_image_path(asset_base, img_id, extension='png'):
    """이미지 파일 경로를 만든다.

    예: build_image_path('/assets/journal-01-a', 3, 'png')
        → '/assets/journal-01-a/img-3.png'
    """
    base = asset_base.rstrip('/')
    return f"{base}/img-{img_id}.{extension}"


def replace_markers(md_text, images_by_id, asset_base, extension='png'):
    """본문 마커를 이미지 임베드로 치환.

    Args:
        md_text: 원본 마크다운
        images_by_id: {1: {'alt': '...', 'caption': '...'}, ...}
        asset_base: 이미지 경로 베이스
        extension: 파일 확장자

    Returns:
        (치환된 md_text, 치환 통계 dict)
    """
    stats = {'replaced': 0, 'missing': []}

    def replacer(match):
        img_id = int(match.group(1))
        marker_name = match.group(2).strip()

        img = images_by_id.get(img_id)
        if not img:
            stats['missing'].append({'id': img_id, 'name': marker_name})
            # 안전 fallback: 원본 마커 유지 (사용자가 사고를 인지하도록)
            return match.group(0)

        alt = img.get('alt') or marker_name
        path = build_image_path(asset_base, img_id, extension)
        caption = img.get('caption')

        # 마크다운 이미지 + (선택)캡션
        embed = f"![{alt}]({path})"
        if caption:
            embed += f"\n*{caption}*"

        stats['replaced'] += 1
        return embed

    new_md = MARKER_PATTERN.sub(replacer, md_text)
    return new_md, stats


def strip_spec_section(md_text):
    """## 이미지 명세 섹션부터 끝까지 제거.

    --- 구분자가 있는 경우 그것도 함께 제거.
    """
    # 1차: --- 포함 패턴 시도
    stripped = SPEC_SECTION_PATTERN.sub('\n', md_text)
    if stripped != md_text:
        return stripped.rstrip() + '\n'
    # 2차: --- 없이
    stripped = SPEC_SECTION_PATTERN_NO_HR.sub('\n', md_text)
    return stripped.rstrip() + '\n'


def main():
    parser = argparse.ArgumentParser(
        description='본문 IMG 마커를 이미지 임베드로 치환합니다.'
    )
    parser.add_argument('md_file', help='원본 마크다운 파일')
    parser.add_argument(
        '--asset-base', required=True,
        help='이미지 경로 베이스 (예: /assets/journal-01-a)'
    )
    parser.add_argument(
        '--extension', default='png',
        help='이미지 확장자 (기본: png)'
    )
    parser.add_argument(
        '--keep-spec', action='store_true',
        help='## 이미지 명세 섹션을 보존 (기본: 제거)'
    )
    args = parser.parse_args()

    # 원본 .md 로드
    md_text = Path(args.md_file).read_text(encoding='utf-8')

    # stdin에서 JSON 로드
    data = json.load(sys.stdin)

    # validation 실패면 거부
    if not data.get('validation', {}).get('ok'):
        print(
            f"❌ 입력 JSON의 validation.ok=False. 치환 중단.",
            file=sys.stderr
        )
        sys.exit(1)

    # 이미지를 id로 인덱싱
    images_by_id = {img['id']: img for img in data.get('images', [])}

    # 마커 치환
    new_md, stats = replace_markers(
        md_text, images_by_id, args.asset_base, args.extension
    )

    # 명세 섹션 제거 (옵션 없으면)
    if not args.keep_spec:
        new_md = strip_spec_section(new_md)

    # stdout으로 출력
    sys.stdout.write(new_md)

    # stderr로 통계
    print(
        f"✅ 마커 치환: {stats['replaced']}개",
        file=sys.stderr
    )
    if stats['missing']:
        print(
            f"⚠️  JSON에 없는 마커 {len(stats['missing'])}개 (원본 유지):",
            file=sys.stderr
        )
        for m in stats['missing']:
            print(f"   IMG-{m['id']} ({m['name']})", file=sys.stderr)
        sys.exit(1)

    sys.exit(0)


if __name__ == '__main__':
    main()
