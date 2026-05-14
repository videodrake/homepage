"""
parse_boxes.py — Journal/네이버 .md 파일에서 IMG 마커와 명세를 추출하는 파서.

입력: 마크다운 파일 1개
출력: 마커-명세 매칭된 dict 리스트

핵심 패턴:
- 본문 마커: [IMG-N: 식별명] (단독 줄)
- 명세 헤더: ### IMG-N — 식별명 (em dash U+2014)
- 메타필드: - **키**: 값
- 프롬프트: **프롬프트 (GPT Image 2)**: 다음 줄부터 > 인용 블록 (멀티라인)
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


# ──────────────────────────────────────────────
# 1단계: 본문 마커 추출
# ──────────────────────────────────────────────

# [IMG-N: 식별명] — 단독 줄, 엄격한 정상 형식
MARKER_PATTERN = re.compile(
    r'^\s*\[IMG-(\d+):\s*([^\]]+)\]\s*$',
    re.MULTILINE
)

# 마커처럼 보이는 모든 대괄호 패턴 (의심 감지용)
# - IMG, img, 이미지, image 등 접두어 변형
# - 하이픈/언더스코어/공백 등 구분자 변형
# - 콜론 누락 또는 변형
SUSPICIOUS_MARKER_PATTERN = re.compile(
    r'\[(?:IMG|img|Img|이미지|image|Image)[\s\-_]*\d*[^\]]*\]'
)


def parse_markers(md_text):
    """본문에서 IMG 마커를 추출한다.

    Returns:
        dict: {
            'valid': [{'id': 1, 'name': '도입부 헤더', 'line': 20}, ...],
            'suspicious': [{'raw': '[IMG-2 콜론없음]', 'line': 11, 'reason': '...'}, ...],
        }
    """
    valid = []
    suspicious = []
    lines = md_text.split('\n')

    for i, line in enumerate(lines, start=1):
        # 1차: 엄격한 정상 패턴
        m = MARKER_PATTERN.match(line)
        if m:
            valid.append({
                'id': int(m.group(1)),
                'name': m.group(2).strip(),
                'line': i,
            })
            continue

        # 2차: 느슨한 의심 패턴
        for sm in SUSPICIOUS_MARKER_PATTERN.finditer(line):
            raw = sm.group(0)
            # 단독 줄이 아닌 인라인 케이스도 잡기 위해 finditer 사용
            suspicious.append({
                'raw': raw,
                'line': i,
                'reason': _diagnose_marker(raw),
            })

    return {'valid': valid, 'suspicious': suspicious}


def _diagnose_marker(raw):
    """의심 마커가 왜 정상 형식과 다른지 진단."""
    reasons = []

    # 접두어 검사
    if not raw.startswith('[IMG-'):
        if raw.startswith('[이미지'):
            reasons.append("접두어가 '이미지' (정상: 'IMG-')")
        elif raw.lower().startswith('[img'):
            if '_' in raw[:6]:
                reasons.append("'IMG_' 사용 (정상: 'IMG-')")
            elif raw[:5].lower() == '[img ' or raw[1:4].lower() == 'img' and raw[4] != '-':
                reasons.append("'IMG-' 하이픈 누락")
            else:
                reasons.append(f"접두어 형식 변형 ({raw[:5]})")
        else:
            reasons.append("접두어가 'IMG-' 아님")

    # 번호 검사
    body = raw.rstrip(']').lstrip('[')
    if not re.search(r'\d+', body):
        reasons.append("번호 누락")

    # 콜론 검사
    if ':' not in raw:
        reasons.append("콜론 ':' 누락 (정상: '[IMG-N: 식별명]')")

    # 식별명 검사
    after_colon = raw.split(':', 1)
    if len(after_colon) == 2:
        name = after_colon[1].rstrip(']').strip()
        if not name:
            reasons.append("식별명 비어있음")

    return ' / '.join(reasons) if reasons else "기타 변형"


# ──────────────────────────────────────────────
# 2단계: 명세 섹션 추출
# ──────────────────────────────────────────────

# 명세 섹션 시작 마커
SPEC_SECTION_HEADER = re.compile(r'^##\s+이미지 명세\s*$', re.MULTILINE)

# 명세 헤더: ### IMG-N — 식별명 (em dash 또는 hyphen 허용)
SPEC_HEADER_PATTERN = re.compile(
    r'^###\s+IMG-(\d+)\s*[—\-–]\s*(.+?)\s*$',
    re.MULTILINE
)

# 메타필드: - **키**: 값
META_FIELD_PATTERN = re.compile(
    r'^\s*-\s*\*\*([^*]+)\*\*\s*:\s*(.+?)\s*$',
    re.MULTILINE
)

# 프롬프트 시작 마커
PROMPT_START_PATTERN = re.compile(
    r'^\s*\*\*프롬프트[^*]*\*\*\s*:\s*$',
    re.MULTILINE
)


def parse_specs(md_text):
    """이미지 명세 섹션에서 각 명세를 추출한다.

    Returns:
        list of dict: [{'id': 1, 'name': '도입부 헤더', 'meta': {...}, 'prompt': '...'}, ...]
    """
    # 명세 섹션 시작 위치 찾기
    section_match = SPEC_SECTION_HEADER.search(md_text)
    if not section_match:
        return []

    spec_section = md_text[section_match.end():]

    # 각 ### IMG-N 헤더 위치 찾기
    headers = list(SPEC_HEADER_PATTERN.finditer(spec_section))
    if not headers:
        return []

    specs = []
    for i, header in enumerate(headers):
        # 이 명세 블록의 범위 = 이 헤더부터 다음 헤더 직전까지
        block_start = header.end()
        block_end = headers[i + 1].start() if i + 1 < len(headers) else len(spec_section)
        block = spec_section[block_start:block_end]

        spec = {
            'id': int(header.group(1)),
            'name': header.group(2).strip(),
            'meta': _parse_meta_fields(block),
            'prompt': _parse_prompt(block),
        }
        specs.append(spec)

    return specs


def _parse_meta_fields(block):
    """블록에서 - **키**: 값 형식의 메타필드를 dict로 추출."""
    meta = {}
    for m in META_FIELD_PATTERN.finditer(block):
        key = m.group(1).strip()
        value = m.group(2).strip()
        # alt 텍스트, 캡션은 따옴표로 감싸져 있으므로 벗기기
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        meta[key] = value
    return meta


def _parse_prompt(block):
    """블록에서 프롬프트 인용 블록을 추출. 멀티라인 + 빈 인용 줄 처리."""
    # 프롬프트 시작 마커 찾기
    prompt_match = PROMPT_START_PATTERN.search(block)
    if not prompt_match:
        return None

    # 마커 다음부터 끝까지의 텍스트를 줄 단위로 처리
    after_marker = block[prompt_match.end():]
    lines = after_marker.split('\n')

    prompt_lines = []
    started = False
    for line in lines:
        stripped = line.strip()
        # 빈 줄 처리
        if stripped == '':
            if started:
                # 인용이 시작된 후의 빈 줄은 일단 보류 (다음 줄에 따라 결정)
                # 만약 다음 줄도 > 가 아니면 끝
                continue
            else:
                # 시작 전 빈 줄은 무시
                continue
        # 인용 블록 줄
        if stripped.startswith('>'):
            # > 다음 공백 1개 제거. > 만 있으면 빈 줄로 처리
            content = stripped[1:].lstrip(' ')
            prompt_lines.append(content)
            started = True
        else:
            # 인용 블록이 아닌 줄을 만나면 종료
            if started:
                break
            # 시작 전이면 계속 찾기
            continue

    # 줄들을 합치되, 빈 줄은 단락 구분으로 유지
    if not prompt_lines:
        return None

    # 인용 블록 안의 줄들을 자연스럽게 합치기
    # 빈 줄(원본의 >만 있던 줄)은 \n\n 으로
    # 일반 줄은 \n 으로 연결 후 마지막에 단락 처리
    result = '\n'.join(prompt_lines)
    return result


# ──────────────────────────────────────────────
# 3단계: 매칭 검증
# ──────────────────────────────────────────────

def validate(markers, specs):
    """마커와 명세가 1:1 매칭되는지 + 필수 필드가 있는지 검증.

    Returns:
        dict: {
            'ok': bool,
            'marker_ids': set,
            'spec_ids': set,
            'orphan_markers': set,
            'orphan_specs': set,
            'name_mismatches': list,
            'incomplete_specs': list,  # 필수 필드 누락 명세
        }
    """
    marker_ids = {m['id'] for m in markers}
    spec_ids = {s['id'] for s in specs}

    orphan_markers = marker_ids - spec_ids
    orphan_specs = spec_ids - marker_ids

    # 식별명 일치 검사
    marker_names = {m['id']: m['name'] for m in markers}
    spec_names = {s['id']: s['name'] for s in specs}
    name_mismatches = []
    for img_id in marker_ids & spec_ids:
        if marker_names[img_id] != spec_names[img_id]:
            name_mismatches.append({
                'id': img_id,
                'marker_name': marker_names[img_id],
                'spec_name': spec_names[img_id],
            })

    # 필수 필드 누락 검사
    # 필수: 종류, 비율, alt 텍스트, 프롬프트
    # 선택: 위치, 위치 의도, 캡션
    REQUIRED_META = ['종류', '비율', 'alt 텍스트']
    incomplete_specs = []
    for spec in specs:
        missing = []
        for field in REQUIRED_META:
            if field not in spec['meta'] or not spec['meta'][field].strip():
                missing.append(field)
        if not spec.get('prompt') or not spec['prompt'].strip():
            missing.append('프롬프트')
        if missing:
            incomplete_specs.append({
                'id': spec['id'],
                'name': spec['name'],
                'missing': missing,
            })

    ok = (
        len(orphan_markers) == 0
        and len(orphan_specs) == 0
        and len(name_mismatches) == 0
        and len(incomplete_specs) == 0
    )

    return {
        'ok': ok,
        'marker_ids': marker_ids,
        'spec_ids': spec_ids,
        'orphan_markers': orphan_markers,
        'orphan_specs': orphan_specs,
        'name_mismatches': name_mismatches,
        'incomplete_specs': incomplete_specs,
    }


# ──────────────────────────────────────────────
# JSON Export — 다음 도구가 받기 좋은 형식
# ──────────────────────────────────────────────

# 비율 패턴: "21:9", "16:9", "4:5" 등
RATIO_PATTERN = re.compile(r'(\d+):(\d+)')


def normalize_ratio(raw):
    """비율 필드를 정규화한다.

    예:
    - "21:9 (와이드 시네마틱 헤더)" → "21:9"
    - "4:5" → "4:5"
    - "와이드" → None (인식 불가)
    """
    if not raw:
        return None
    m = RATIO_PATTERN.search(raw)
    return f"{m.group(1)}:{m.group(2)}" if m else None


def to_json_dict(result):
    """파싱 결과를 JSON-ready dict로 변환.

    마커와 명세가 매칭된 IMG들을 'images' 배열로 평탄화한다.
    다음 단계(시리즈 블록 주입, Codex 호출)가 바로 받을 수 있는 형식.
    """
    # 마커를 id로 인덱싱
    markers_by_id = {m['id']: m for m in result['markers']}

    images = []
    for spec in result['specs']:
        img_id = spec['id']
        marker = markers_by_id.get(img_id)
        meta = spec['meta']

        img = {
            'id': img_id,
            'name': spec['name'],
            'marker_line': marker['line'] if marker else None,
            'type': meta.get('종류'),
            'location': meta.get('위치'),
            'intent': meta.get('위치 의도'),
            'ratio': normalize_ratio(meta.get('비율', '')),
            'ratio_raw': meta.get('비율'),
            'alt': meta.get('alt 텍스트'),
            'caption': meta.get('캡션'),
            'prompt': spec.get('prompt'),
        }
        images.append(img)

    return {
        'filepath': result['filepath'],
        'validation': {
            'ok': result['validation']['ok'],
            'marker_count': len(result['markers']),
            'spec_count': len(result['specs']),
            'orphan_markers': sorted(result['validation']['orphan_markers']),
            'orphan_specs': sorted(result['validation']['orphan_specs']),
            'name_mismatches': result['validation']['name_mismatches'],
            'incomplete_specs': result['validation'].get('incomplete_specs', []),
            'suspicious_markers': result['validation'].get('suspicious_markers', []),
        },
        'images': images,
    }


# ──────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────

def parse_file(filepath):
    """파일 1개를 파싱해 전체 결과를 반환."""
    md_text = Path(filepath).read_text(encoding='utf-8')

    marker_result = parse_markers(md_text)
    markers = marker_result['valid']
    suspicious_markers = marker_result['suspicious']
    specs = parse_specs(md_text)
    validation = validate(markers, specs)

    # 의심 마커가 있으면 validation 결과에 반영
    if suspicious_markers:
        validation['ok'] = False
        validation['suspicious_markers'] = suspicious_markers
    else:
        validation['suspicious_markers'] = []

    return {
        'filepath': str(filepath),
        'markers': markers,
        'specs': specs,
        'validation': validation,
    }


def print_report(result):
    """파싱 결과를 사람이 읽기 좋게 출력."""
    print(f"파일: {result['filepath']}")
    print(f"마커: {len(result['markers'])}개")
    print(f"명세: {len(result['specs'])}개")

    v = result['validation']
    if v['ok']:
        print("✅ 마커-명세 매칭: 통과")
    else:
        print("❌ 마커-명세 매칭: 실패")
        if v.get('suspicious_markers'):
            print(f"   ⚠️  의심 마커 {len(v['suspicious_markers'])}개 발견:")
            for sm in v['suspicious_markers']:
                print(f"     line {sm['line']:>4}: {sm['raw']}")
                print(f"               → {sm['reason']}")
        if v['orphan_markers']:
            print(f"   명세 누락 마커: IMG-{sorted(v['orphan_markers'])}")
        if v['orphan_specs']:
            print(f"   마커 없는 명세: IMG-{sorted(v['orphan_specs'])}")
        if v['name_mismatches']:
            for nm in v['name_mismatches']:
                print(f"   IMG-{nm['id']} 식별명 불일치:")
                print(f"     마커: {nm['marker_name']}")
                print(f"     명세: {nm['spec_name']}")
        if v.get('incomplete_specs'):
            print(f"   ⚠️  필수 필드 누락 명세 {len(v['incomplete_specs'])}개:")
            for inc in v['incomplete_specs']:
                print(f"     IMG-{inc['id']} ({inc['name']}): {', '.join(inc['missing'])} 누락")

    print("\n--- 마커 상세 ---")
    for m in result['markers']:
        print(f"  line {m['line']:>4}: IMG-{m['id']} ({m['name']})")

    print("\n--- 명세 상세 ---")
    for s in result['specs']:
        print(f"\n  IMG-{s['id']} ({s['name']})")
        for k, v in s['meta'].items():
            short_v = v[:60] + '...' if len(v) > 60 else v
            print(f"    {k}: {short_v}")
        if s['prompt']:
            prompt_preview = s['prompt'][:120].replace('\n', ' ')
            prompt_len = len(s['prompt'])
            print(f"    프롬프트 ({prompt_len}자): {prompt_preview}...")
        else:
            print(f"    프롬프트: ❌ 추출 실패")


if __name__ == '__main__':
    arg_parser = argparse.ArgumentParser(
        description='Journal/네이버 .md 파일에서 IMG 마커와 명세를 추출합니다.'
    )
    arg_parser.add_argument('filepath', help='파싱할 마크다운 파일 경로')
    arg_parser.add_argument(
        '--json', action='store_true',
        help='파싱 결과를 JSON으로 stdout에 출력 (파이프 입력용)'
    )
    args = arg_parser.parse_args()

    result = parse_file(args.filepath)

    if args.json:
        json.dump(to_json_dict(result), sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write('\n')
    else:
        print_report(result)

    # 자동화 fail-fast: 검증 실패 시 exit code 1
    sys.exit(0 if result['validation']['ok'] else 1)
