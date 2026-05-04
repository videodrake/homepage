from __future__ import annotations

import argparse
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Finding:
    check_id: int
    name: str
    line: int
    excerpt: str


CHECKS: list[tuple[int, str, list[str]]] = [
    (1, "지구력 코어 계열 0회", [r"지구\s*力\s*코어", r"지구력\s*코어"]),
    (2, "옥타코사놀 0회", [r"옥타코사놀"]),
    (
        3,
        "5대 금지어 0회",
        [r"스테미너", r"스태미너", r"스태미나", r"피로", r"피곤", r"파워업?", r"젊음", r"젊다", r"젊어", r"힘\s*없는"],
    ),
    (4, "의약품 오인 용어 0회", [r"복용", r"효능", r"효과", r"임상시험", r"처방", r"알약"]),
    (
        5,
        "푸터 안내 문장 0건",
        [r"하단", r"푸터", r"아래\s*버튼", r"아래에서", r"본\s*사이트", r"본\s*페이지", r"우리\s*제품", r"자사\s*제품", r"저희\s*제품", r"본\s*브랜드"],
    ),
]

DISCLAIMER_MARKERS = ["일반 건강정보", "의학적 진단을 대체", "특정 제품의 광고가 아닙니다"]


def normalize(text: str) -> str:
    return unicodedata.normalize("NFKC", text)


def find_matches(text: str) -> dict[int, list[Finding]]:
    findings: dict[int, list[Finding]] = {check_id: [] for check_id, _, _ in CHECKS}
    for line_no, raw_line in enumerate(text.splitlines(), start=1):
        line = normalize(raw_line)
        for check_id, name, patterns in CHECKS:
            for pattern in patterns:
                if re.search(pattern, line, flags=re.IGNORECASE):
                    findings[check_id].append(Finding(check_id, name, line_no, raw_line.strip()))
                    break
    return findings


def check_disclaimer(text: str) -> bool:
    tail = "\n".join(text.splitlines()[-20:])
    return any(marker in tail for marker in DISCLAIMER_MARKERS)


def render_yaml(text: str, checked_file: Path) -> str:
    findings = find_matches(text)
    disclaimer_ok = check_disclaimer(text)
    overall_fail = any(findings.values()) or not disclaimer_ok
    lines = [
        "regulation_check:",
        f"  status: {'FAIL' if overall_fail else 'PASS'}",
        f"  checked_file: {checked_file.as_posix()}",
        "  details:",
    ]
    for check_id, name, _ in CHECKS:
        matches = findings[check_id]
        lines.extend(
            [
                f"    - check_id: {check_id}",
                f"      name: \"{name}\"",
                f"      result: {'FAIL' if matches else 'PASS'}",
                f"      occurrences: {len(matches)}",
            ]
        )
        if matches:
            lines.append("      locations:")
            for match in matches:
                excerpt = match.excerpt.replace('"', "'")
                lines.extend([f"        - line: {match.line}", f"          excerpt: \"{excerpt}\""])
    lines.extend(
        [
            "    - check_id: 6",
            "      name: \"면책 문구 존재\"",
            f"      result: {'PASS' if disclaimer_ok else 'FAIL'}",
            f"      occurrences: {1 if disclaimer_ok else 0}",
        ]
    )
    return "\n".join(lines) + "\n"


def run_check(path: Path, output: Path | None = None) -> bool:
    text = path.read_text(encoding="utf-8")
    yaml = render_yaml(text, path)
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(yaml, encoding="utf-8")
    return "status: PASS" in yaml.splitlines()[1]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run deterministic Journal regulation checks.")
    parser.add_argument("source", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    ok = run_check(args.source, args.out)
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

