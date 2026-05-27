"""
regulation_check.py — 자사몰 Journal 발행 직전 규제 자동 검사.

자동화 계획서 §4의 6항목을 검사한다:
  1. "지구력코어" 0회 (제품명 직접 언급 금지)
  2. "옥타코사놀" 등 성분명 — 원료 학술 정보 맥락 허용(WARN). 차단 기준은
     제품명 직접 언급과 기능성 단정 광고이며, 성분명 단순 등장은 비차단이다.
     (운영 결정 2026-05: '본문 0회 룰' → '제품명 0회·기능성 단정 광고 0회'로 갱신)
  3. 5대 금지어 0회 (스테미너/피로/파워/젊음/힘없는)
  4. 의약품 오인 용어 0회 (복용/효능/효과/임상시험/처방/알약)
  5. 푸터 안내 문장 0건 (§6-5 합법 우회 구조 — 본문에서 푸터 가리키기 금지)
  6. 면책 문구 존재

사용 예:
    # 발행본 .md만 검사
    python regulation_check.py published.md

    # .md + JSON(이미지 메타) 같이 검사
    python regulation_check.py published.md --json injected.json

    # 파이프로 JSON 받기 (정수 파이프라인 마지막에)
    python parse_boxes.py file.md --json \\
      | python regulation_check.py published.md --json -

설계 결정:
- 한국어 조사 처리: 단어 + (이|가|을|를|은|는|에|의|로|...) 패턴
- 거짓 양성 방지: "효과적" 같은 합성어 제외 위해 단어 경계 활용
- FAIL vs WARN 분리: FAIL은 즉시 차단, WARN은 보고만
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
# 위반 사전
# ──────────────────────────────────────────────

# 한국어 조사 패턴 — 단어 뒤에 붙어도 매칭되도록
KOREAN_PARTICLE = r'(?:[은는이가을를에의로으로와과도만부터까지나도]?)'

# 한국어 단어 경계: 앞이 한글이 아니어야 함 (조어 방지)
# 예: "효과" 검사 시 "효과적인"은 잡고, 부분 위치를 보고함
KOR_BOUNDARY_BEFORE = r'(?<![가-힣])'
KOR_BOUNDARY_AFTER = r'(?![가-힣])'  # 한글이 뒤따르면 다른 단어


def make_korean_pattern(word, with_particle=True):
    """한국어 단어를 단어 경계 + 선택적 조사로 매칭하는 정규식 생성.

    예: "효과" → 앞에 한글 없고, 뒤에 한글이 와도 매칭 (합성어도 탐지)
    """
    escaped = re.escape(word)
    # 앞 경계만 엄격하게. 뒤는 조사 또는 비한글이 와야 함
    return re.compile(
        KOR_BOUNDARY_BEFORE + escaped + KOREAN_PARTICLE + r'(?![가-힣])',
        re.UNICODE
    )


# 위반 사전 (FAIL — 즉시 차단)
PROHIBITED = {
    # 1. 제품명
    'product_names': {
        'patterns': ['지구력코어', '지구력 코어'],
        'severity': 'FAIL',
        'category': '제품명 직접 언급',
        'rule': '§6-4 자사몰 BOFU/제품 페이지 외 전면 금지',
    },
    # 2. 성분명은 PROHIBITED(FAIL)에서 제외 — INGREDIENT_WORDS로 WARN 처리.
    #    운영 결정(2026-05): 원료 학술 정보 맥락의 성분명 등장은 차단하지 않는다.
    # 3. 5대 금지어
    'five_blocked': {
        'patterns': [
            '스테미너', '스태미너', '스태미나',
            '피로', '피곤',
            '파워업', '파워',
            '젊음', '젊어', '젊다',
            '힘없는', '힘 없는',
        ],
        'severity': 'FAIL',
        'category': '5대 금지어',
        'rule': '§6-2 옥타코사놀 5대 금지어',
    },
    # 4. 의약품 오인 용어
    'medicine_terms': {
        'patterns': [
            '복용',
            '효능',
            '임상시험',
            '처방',
            '알약',
        ],
        'severity': 'FAIL',
        'category': '의약품 오인 용어',
        'rule': '§6-3 의약품으로 오인될 수 있는 표현 금지',
    },
}

# "효과"는 워낙 흔해서 별도 처리 (WARN으로 분류 + 합성어 화이트리스트)
EFFECT_WORD = '효과'
EFFECT_WHITELIST_NEXT = [
    '적', '적으로', '적인',  # "효과적인"은 일상어로 허용
]

# 성분명 — 원료 학술 정보 맥락 허용(WARN). 차단 기준은 제품명·기능성 단정 광고다.
INGREDIENT_WORDS = ['옥타코사놀']

# 5. 푸터 안내 문장 (§6-5 합법 우회 구조 핵심 방어선)
FOOTER_HINTS = {
    'patterns': [
        '하단',
        '푸터',
        '아래 버튼', '아래의 버튼',
        '아래에서',
        '본 사이트', '본 페이지', '본 브랜드',
        '우리 제품', '자사 제품', '저희 제품',
        '구매 버튼', '구매하기',
        '제품 페이지', '상품 페이지',
    ],
    'severity': 'FAIL',
    'category': '푸터 안내 문장',
    'rule': '§6-5 본문에서 푸터 가리키기 금지',
}

# 6. 면책 문구 마커 (존재 검사)
DISCLAIMER_MARKERS = [
    '제품정보와 관련 없는',
    '학술 자료에 근거한',
    '일반 건강정보',
    '의학적 진단을 대체',
]


# ──────────────────────────────────────────────
# 검사 엔진
# ──────────────────────────────────────────────

def find_occurrences(text, word, lines):
    """text에서 word가 등장하는 (line_no, line_text) 리스트를 반환."""
    pattern = make_korean_pattern(word)
    occurrences = []
    for line_no, line in enumerate(lines, start=1):
        for m in pattern.finditer(line):
            occurrences.append({
                'line': line_no,
                'matched': m.group(0),
                'context': line.strip()[:120],
                'position': m.start(),
            })
    return occurrences


def check_prohibited_category(text, lines, category_key, category_def):
    """위반 사전의 한 카테고리를 검사."""
    findings = []
    for word in category_def['patterns']:
        occurrences = find_occurrences(text, word, lines)
        if occurrences:
            findings.append({
                'word': word,
                'occurrences': occurrences,
            })
    return findings


def check_effect_word(text, lines):
    """'효과' 단독 검사 (합성어 제외)."""
    occurrences = []
    # "효과" 매칭하되 화이트리스트 합성어 제외
    pattern = re.compile(
        KOR_BOUNDARY_BEFORE + re.escape(EFFECT_WORD) + r'(?P<next>[가-힣]?)',
        re.UNICODE
    )
    for line_no, line in enumerate(lines, start=1):
        for m in pattern.finditer(line):
            next_char = m.group('next')
            # 다음 글자로 합성어 화이트리스트 체크
            after = line[m.end() - len(next_char):m.end() + 3]
            is_whitelisted = False
            for wl in EFFECT_WHITELIST_NEXT:
                if after.startswith(wl):
                    is_whitelisted = True
                    break
            if not is_whitelisted:
                occurrences.append({
                    'line': line_no,
                    'matched': m.group(0).rstrip(next_char) if next_char else m.group(0),
                    'context': line.strip()[:120],
                })
    return [{'word': '효과', 'occurrences': occurrences}] if occurrences else []


def check_ingredient_word(text, lines):
    """성분명(옥타코사놀) WARN 검사.

    운영 결정(2026-05): 성분명 단순 등장은 차단하지 않는다. Journal이 원료의
    화학·식물학적 정체와 연구 이력을 다루는 학술 정보 맥락에서 성분명을 쓰는 것은
    허용하며, 차단 기준은 '제품명 직접 언급'과 '기능성 단정 광고'다. 성분명 등장은
    사람이 광고성 단정 여부를 검토하도록 WARN으로만 보고한다.
    """
    findings = []
    for word in INGREDIENT_WORDS:
        occurrences = find_occurrences(text, word, lines)
        if occurrences:
            findings.append({'word': word, 'occurrences': occurrences})
    return findings


def check_disclaimer(text):
    """면책 문구 마커 존재 검사. 최소 2개 매칭되면 통과."""
    matched_markers = [m for m in DISCLAIMER_MARKERS if m in text]
    return {
        'ok': len(matched_markers) >= 2,
        'matched_markers': matched_markers,
        'required_count': 2,
    }


def check_text(text):
    """본문 전체 검사. 검사 결과 dict 반환."""
    lines = text.split('\n')

    results = {
        'fail': [],
        'warn': [],
        'disclaimer': check_disclaimer(text),
    }

    # FAIL 카테고리
    for cat_key, cat_def in PROHIBITED.items():
        findings = check_prohibited_category(text, lines, cat_key, cat_def)
        if findings:
            results['fail'].append({
                'category': cat_def['category'],
                'rule': cat_def['rule'],
                'findings': findings,
            })

    # 푸터 안내 (별도)
    footer_findings = check_prohibited_category(text, lines, 'footer', FOOTER_HINTS)
    if footer_findings:
        results['fail'].append({
            'category': FOOTER_HINTS['category'],
            'rule': FOOTER_HINTS['rule'],
            'findings': footer_findings,
        })

    # "효과" WARN
    effect_findings = check_effect_word(text, lines)
    if effect_findings:
        results['warn'].append({
            'category': '"효과" 단독 사용',
            'rule': '§6-3 의약품 오인 가능성 — 문맥 검토 필요',
            'findings': effect_findings,
        })

    # 성분명 WARN (운영 결정: 원료 학술 정보 맥락 허용, 광고 단정 여부만 사람이 검토)
    ingredient_findings = check_ingredient_word(text, lines)
    if ingredient_findings:
        results['warn'].append({
            'category': '성분명 직접 언급 (원료 학술 정보 맥락 — 광고 단정 여부 검토)',
            'rule': '§6-4 제품명 0회·기능성 단정 광고 0회 (성분명 단순 등장은 비차단)',
            'findings': ingredient_findings,
        })

    # 면책 문구 누락
    if not results['disclaimer']['ok']:
        results['fail'].append({
            'category': '면책 문구 누락',
            'rule': '§6-5 Journal 본문 끝 면책 문구 필수',
            'findings': [{
                'word': '면책 문구',
                'occurrences': [{
                    'line': 0,
                    'matched': f"매칭된 마커 {len(results['disclaimer']['matched_markers'])}개 (최소 2개 필요)",
                    'context': '면책 문구 마커: ' + ', '.join(DISCLAIMER_MARKERS),
                }],
            }],
        })

    results['ok'] = len(results['fail']) == 0
    return results


def check_image_meta(json_data):
    """JSON의 이미지 메타(alt, caption)를 검사.

    이미지 메타도 본문과 동일 규제 영역이라 같은 사전 적용.
    """
    if not json_data or 'images' not in json_data:
        return None

    findings_per_image = []
    for img in json_data['images']:
        # alt와 caption만 검사 (프롬프트는 사람이 안 읽음)
        alt = img.get('alt') or ''
        caption = img.get('caption') or ''
        combined = f"{alt}\n{caption}"

        if not combined.strip():
            continue

        img_result = check_text(combined)
        # 이미지 메타에는 면책 문구가 없는 게 정상
        img_result['fail'] = [
            f for f in img_result['fail']
            if f['category'] != '면책 문구 누락'
        ]

        if img_result['fail'] or img_result['warn']:
            findings_per_image.append({
                'image_id': img['id'],
                'image_name': img.get('name'),
                'alt': alt,
                'caption': caption,
                'fail': img_result['fail'],
                'warn': img_result['warn'],
            })

    return findings_per_image


# ──────────────────────────────────────────────
# 리포트
# ──────────────────────────────────────────────

def print_report(text_result, image_result):
    """사람이 읽기 쉬운 리포트 출력."""
    print("═" * 60)
    print("규제 자동 검사 리포트")
    print("═" * 60)

    # 면책 문구
    print(f"\n[면책 문구]")
    d = text_result['disclaimer']
    if d['ok']:
        print(f"  ✅ 통과 (마커 {len(d['matched_markers'])}/{d['required_count']}개 매칭)")
        for m in d['matched_markers']:
            print(f"     - '{m}'")
    else:
        print(f"  ❌ 누락 (마커 {len(d['matched_markers'])}/{d['required_count']}개)")

    # 본문 FAIL
    print(f"\n[본문 FAIL] {len(text_result['fail'])}건")
    for f in text_result['fail']:
        print(f"\n  ❌ {f['category']} ({f['rule']})")
        for finding in f['findings']:
            print(f"     단어: '{finding['word']}'")
            for occ in finding['occurrences'][:5]:  # 최대 5건만 표시
                print(f"       line {occ['line']:>4}: {occ.get('context', '')[:80]}")
            if len(finding['occurrences']) > 5:
                print(f"       ... 외 {len(finding['occurrences']) - 5}건")

    # 본문 WARN
    if text_result['warn']:
        print(f"\n[본문 WARN] {len(text_result['warn'])}건")
        for w in text_result['warn']:
            print(f"\n  ⚠️  {w['category']} ({w['rule']})")
            for finding in w['findings']:
                for occ in finding['occurrences'][:3]:
                    print(f"     line {occ['line']:>4}: {occ.get('context', '')[:80]}")

    # 이미지 메타
    if image_result is not None:
        print(f"\n[이미지 메타] alt/캡션 검사")
        if not image_result:
            print(f"  ✅ 모든 이미지 메타 통과")
        else:
            for img in image_result:
                print(f"\n  IMG-{img['image_id']} ({img['image_name']})")
                if img['fail']:
                    for f in img['fail']:
                        print(f"    ❌ {f['category']}")
                        for finding in f['findings']:
                            print(f"       단어: '{finding['word']}'")
                if img['warn']:
                    for w in img['warn']:
                        print(f"    ⚠️  {w['category']}")

    # 최종 판정
    print()
    print("═" * 60)
    image_fail = bool(image_result) and any(img['fail'] for img in image_result)
    overall_ok = text_result['ok'] and not image_fail
    if overall_ok:
        print("✅ 최종 판정: PASS — 발행 가능")
    else:
        print("❌ 최종 판정: FAIL — 발행 차단")
    print("═" * 60)
    return overall_ok


# ──────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='자사몰 Journal 발행 직전 규제 자동 검사 (§4 6항목).'
    )
    parser.add_argument('md_file', help='발행본 마크다운 파일')
    parser.add_argument(
        '--json', default=None,
        help='이미지 메타가 든 JSON 파일 (- 면 stdin)'
    )
    args = parser.parse_args()

    # 본문 로드
    text = Path(args.md_file).read_text(encoding='utf-8')

    # JSON 로드 (선택)
    json_data = None
    if args.json:
        if args.json == '-':
            json_data = json.load(sys.stdin)
        else:
            json_data = json.loads(Path(args.json).read_text(encoding='utf-8'))

    # 검사 실행
    text_result = check_text(text)
    image_result = check_image_meta(json_data) if json_data else None

    # 리포트
    ok = print_report(text_result, image_result)

    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
