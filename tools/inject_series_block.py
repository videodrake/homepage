"""
inject_series_block.py — 시리즈 고정 블록을 이미지 프롬프트에 주입.

입력: parse_boxes.py --json 출력 (stdin)
출력: 시리즈 블록이 prefix로 추가된 JSON (stdout)

사용 예:
    python parse_boxes.py file.md --json \\
      | python inject_series_block.py --series journal-01

설계 결정:
1. 시리즈 블록은 prefix로 추가하되, 명시적 디렉티브 형식으로 분리
   (기존 프롬프트와 자연스럽게 어우러지지 않고 "시리즈 톤 가이드"로 분명히 표시)
2. 멱등성 — 이미 주입된 prompt는 건너뜀 (마커로 판별)
3. 종류가 photo/graphic에 매칭 안 되면 (예: 비표준 종류) 그대로 통과
"""

import sys
import json
import argparse
import yaml
from pathlib import Path


def _configure_stdio() -> None:
    for stream_name in ("stdin", "stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


_configure_stdio()


INJECTION_MARKER = "[Series style guide:"

# series_blocks/ 폴더의 가능한 위치들 (우선순위 순)
# 1. 스크립트와 같은 폴더 (단독 사용 시)
# 2. 스크립트의 부모 폴더 (tools/ 안에서 실행 시, repo 루트에 series_blocks/)
# 3. 현재 작업 디렉토리 (pwd가 repo 루트일 때)
SERIES_BLOCKS_DIR_CANDIDATES = [
    Path(__file__).parent / "series_blocks",
    Path(__file__).parent.parent / "series_blocks",
    Path.cwd() / "series_blocks",
]


def find_series_blocks_dir():
    """series_blocks/ 폴더의 실제 위치를 찾는다."""
    for candidate in SERIES_BLOCKS_DIR_CANDIDATES:
        if candidate.exists() and candidate.is_dir():
            return candidate
    return SERIES_BLOCKS_DIR_CANDIDATES[0]  # fallback


def load_series(series_id):
    """series_blocks/<series_id>.yaml을 로드."""
    base_dir = find_series_blocks_dir()
    path = base_dir / f"{series_id}.yaml"
    if not path.exists():
        # 모든 후보 위치를 에러 메시지에 포함
        searched = [str(c) for c in SERIES_BLOCKS_DIR_CANDIDATES]
        raise FileNotFoundError(
            f"시리즈 블록 정의 없음: {series_id}\n"
            f"검색한 위치:\n  " + "\n  ".join(searched)
        )
    return yaml.safe_load(path.read_text(encoding='utf-8'))


def build_directive(series, image_type):
    """이미지 종류에 맞는 시리즈 디렉티브 한 줄을 생성.

    Returns:
        str or None: 적용 대상 아니면 None
    """
    category = _categorize_type(image_type, series['type_mapping'])
    if not category:
        return None

    block = series[category]
    # 키 순서는 dict 삽입 순서대로 (Python 3.7+ 보장)
    values = list(block.values())

    directive = f"{INJECTION_MARKER} {' / '.join(values)}]"
    return directive


def _categorize_type(image_type, mapping):
    """이미지 종류를 photo / graphic / None으로 분류.

    Args:
        image_type: 예 "분위기 사진", "다이어그램 (개념 도식)"
        mapping: {'photo': [...], 'graphic': [...]}
    """
    if not image_type:
        return None
    for category, keywords in mapping.items():
        for kw in keywords:
            if kw in image_type:
                return category
    return None


def inject_to_image(image, series):
    """이미지 1개의 prompt에 시리즈 디렉티브를 prefix로 주입.

    멱등성: 이미 주입된 prompt는 건너뜀.
    """
    if not image.get('prompt'):
        return image  # 프롬프트 없으면 통과 (validation에서 잡힘)

    if image['prompt'].startswith(INJECTION_MARKER):
        return image  # 이미 주입됨

    directive = build_directive(series, image.get('type'))
    if not directive:
        # 매칭 안 되는 종류 — 그대로 통과
        image['series_injection'] = {
            'applied': False,
            'reason': f"종류 '{image.get('type')}' 매핑 없음",
        }
        return image

    # prefix로 추가, 빈 줄로 구분
    image['prompt'] = f"{directive}\n\n{image['prompt']}"
    image['series_injection'] = {
        'applied': True,
        'series_id': series['series_id'],
        'category': _categorize_type(image['type'], series['type_mapping']),
    }
    return image


def main():
    parser = argparse.ArgumentParser(
        description='parse_boxes.py JSON을 받아 시리즈 블록을 prompt에 주입합니다.'
    )
    parser.add_argument(
        '--series', required=True,
        help='시리즈 ID (series_blocks/<id>.yaml 파일명)'
    )
    args = parser.parse_args()

    # 시리즈 정의 로드
    series = load_series(args.series)

    # stdin에서 JSON 읽기
    data = json.load(sys.stdin)

    # 각 이미지에 주입
    for image in data.get('images', []):
        inject_to_image(image, series)

    # 메타 정보 추가
    data['series'] = {
        'id': series['series_id'],
        'name': series['series_name'],
        'applied_count': sum(
            1 for img in data['images']
            if img.get('series_injection', {}).get('applied')
        ),
        'skipped_count': sum(
            1 for img in data['images']
            if not img.get('series_injection', {}).get('applied')
        ),
    }

    json.dump(data, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
