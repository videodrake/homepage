"""
pipeline.py — Journal 자동화 파이프라인 통합 러너.

한 번의 호출로 다음을 순차 실행:
  1. parse_boxes.py           파싱 + 검증
  2. inject_series_block.py   시리즈 톤 주입
  3. generate_images.py       Codex CLI 이미지 생성
  4. inject_images.py         마크다운 치환
  5. regulation_check.py      규제 자동 검사 (발행 직전 게이트)

사용 예:
    # 전체 실행 (mock 어댑터, 검증용)
    python pipeline.py file.md \\
      --series journal-01 \\
      --slug journal-01-a \\
      --adapter mock

    # 실제 운영 (shell 어댑터)
    export CODEX_CMD='codex exec "..."'
    python pipeline.py file.md \\
      --series journal-01 \\
      --slug journal-01-a \\
      --adapter shell \\
      --output-dir ./published

    # 단계 건너뛰기 (이미지 생성 없이 검증만)
    python pipeline.py file.md \\
      --series journal-01 \\
      --slug journal-01-a \\
      --skip-generate

각 단계 실패 시 즉시 중단. 중간 파일은 --intermediates-dir로 보존 가능.
"""

import os
import sys
import json
import argparse
import subprocess
import tempfile
import shutil
from pathlib import Path


def _configure_stdio() -> None:
    for stream_name in ("stdin", "stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


_configure_stdio()


SCRIPT_DIR = Path(__file__).parent


# ──────────────────────────────────────────────
# 단계 실행 헬퍼
# ──────────────────────────────────────────────

def run_step(name, cmd, stdin_data=None, check=True):
    """한 단계 실행. stdout/stderr/exit_code 캡처해서 반환.

    Args:
        name: 단계 이름 (로그용)
        cmd: 명령어 리스트
        stdin_data: stdin으로 보낼 데이터 (str 또는 bytes)
        check: True면 실패 시 SystemExit

    Returns:
        result: subprocess.CompletedProcess
    """
    print(f"\n━━━ {name} ━━━", file=sys.stderr)
    print(f"  $ {' '.join(str(c) for c in cmd)}", file=sys.stderr)

    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")

    result = subprocess.run(
        cmd,
        input=stdin_data,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=env,
    )

    # stderr는 진행 상황이라 항상 보여줌
    if result.stderr:
        for line in result.stderr.splitlines():
            print(f"  {line}", file=sys.stderr)

    if check and result.returncode != 0:
        print(f"\n❌ {name} 실패 (exit {result.returncode}) — 파이프라인 중단", file=sys.stderr)
        sys.exit(result.returncode)

    return result


def save_intermediate(intermediates_dir, name, content):
    """중간 결과를 디버깅용 파일로 저장."""
    if intermediates_dir:
        path = Path(intermediates_dir) / name
        path.write_text(content, encoding='utf-8')
        print(f"  💾 중간 파일 저장: {path}", file=sys.stderr)


# ──────────────────────────────────────────────
# 파이프라인
# ──────────────────────────────────────────────

def run_pipeline(args):
    """전체 파이프라인 실행."""
    md_file = Path(args.md_file)
    if not md_file.exists():
        print(f"❌ 파일 없음: {md_file}", file=sys.stderr)
        sys.exit(1)

    # 출력 디렉토리 준비
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    asset_dir = output_dir / 'assets' / args.slug
    published_path = output_dir / f"{args.slug}.md"

    # 중간 파일 디렉토리
    intermediates_dir = None
    if args.intermediates_dir:
        intermediates_dir = Path(args.intermediates_dir)
        intermediates_dir.mkdir(parents=True, exist_ok=True)

    print(f"📋 파이프라인 시작", file=sys.stderr)
    print(f"   입력: {md_file}", file=sys.stderr)
    print(f"   슬러그: {args.slug}", file=sys.stderr)
    print(f"   시리즈: {args.series}", file=sys.stderr)
    print(f"   출력: {published_path}", file=sys.stderr)
    print(f"   에셋: {asset_dir}", file=sys.stderr)

    # ── 1단계: parse_boxes.py ──
    result = run_step(
        "1/5 파싱 + 검증 (parse_boxes.py)",
        [sys.executable, str(SCRIPT_DIR / 'parse_boxes.py'), str(md_file), '--json'],
    )
    parsed_json = result.stdout
    save_intermediate(intermediates_dir, '1_parsed.json', parsed_json)

    # ── 2단계: inject_series_block.py ──
    result = run_step(
        "2/5 시리즈 톤 주입 (inject_series_block.py)",
        [sys.executable, str(SCRIPT_DIR / 'inject_series_block.py'), '--series', args.series],
        stdin_data=parsed_json,
    )
    injected_json = result.stdout
    save_intermediate(intermediates_dir, '2_series_injected.json', injected_json)

    # ── 3단계: generate_images.py ──
    if args.skip_generate:
        print(f"\n━━━ 3/5 이미지 생성 — 건너뜀 (--skip-generate) ━━━", file=sys.stderr)
        generated_json = injected_json
    else:
        cmd = [
            sys.executable, str(SCRIPT_DIR / 'generate_images.py'),
            '--asset-dir', str(asset_dir),
            '--adapter', args.adapter,
            '--between-calls', str(args.between_calls),
        ]
        if args.force_regenerate:
            cmd.append('--force')
        if args.dry_run:
            cmd.append('--dry-run')

        result = run_step(
            "3/5 이미지 생성 (generate_images.py)",
            cmd,
            stdin_data=injected_json,
        )
        generated_json = result.stdout
        save_intermediate(intermediates_dir, '3_generated.json', generated_json)

    # ── 4단계: inject_images.py ──
    # asset-base는 자사몰 사이트의 URL 경로 (실제 파일 경로와 다를 수 있음)
    asset_url_base = args.asset_url_base or f"/assets/{args.slug}"

    result = run_step(
        "4/5 마크다운 치환 (inject_images.py)",
        [
            sys.executable, str(SCRIPT_DIR / 'inject_images.py'),
            str(md_file),
            '--asset-base', asset_url_base,
        ],
        stdin_data=generated_json,
    )
    published_md = result.stdout
    save_intermediate(intermediates_dir, '4_published.md', published_md)

    # 발행본 파일 저장
    published_path.write_text(published_md, encoding='utf-8')
    print(f"  💾 발행본 저장: {published_path}", file=sys.stderr)

    # ── 5단계: regulation_check.py ──
    # 임시로 generated_json을 파일로 저장 (regulation_check은 파일 또는 stdin)
    with tempfile.NamedTemporaryFile(
        mode='w', encoding='utf-8', suffix='.json', delete=False
    ) as f:
        f.write(generated_json)
        json_path = f.name

    try:
        result = run_step(
            "5/5 규제 자동 검사 (regulation_check.py)",
            [
                sys.executable, str(SCRIPT_DIR / 'regulation_check.py'),
                str(published_path),
                '--json', json_path,
            ],
            check=False,  # 실패해도 리포트는 stdout으로 보여주기
        )
    finally:
        Path(json_path).unlink(missing_ok=True)

    # 리포트는 stdout으로 메인 출력에 표시
    sys.stdout.write(result.stdout)

    # ── 최종 판정 ──
    print(f"\n{'═' * 60}", file=sys.stderr)
    if result.returncode == 0:
        print(f"✅ 파이프라인 완료 — 발행 준비됨", file=sys.stderr)
        print(f"   📄 {published_path}", file=sys.stderr)
        print(f"   📁 {asset_dir}", file=sys.stderr)
    else:
        print(f"❌ 규제 검사 실패 — 발행본 생성됐으나 차단", file=sys.stderr)
        print(f"   📄 {published_path} (검수 필요)", file=sys.stderr)
    print(f"{'═' * 60}", file=sys.stderr)

    return result.returncode


# ──────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Journal 자동화 파이프라인 통합 러너.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('md_file', help='입력 마크다운 파일')
    parser.add_argument('--series', required=True,
                        help='시리즈 ID (예: journal-01)')
    parser.add_argument('--slug', required=True,
                        help='발행 슬러그 (예: journal-01-a)')

    # 출력
    parser.add_argument('--output-dir', default='./published',
                        help='발행본 출력 디렉토리 (기본: ./published)')
    parser.add_argument('--asset-url-base', default=None,
                        help='이미지 URL 베이스 (기본: /assets/<slug>)')
    parser.add_argument('--intermediates-dir', default=None,
                        help='중간 파일 보존 디렉토리 (디버깅용)')

    # 이미지 생성
    parser.add_argument('--adapter', default='mock', choices=['mock', 'shell'],
                        help='이미지 생성 어댑터 (기본: mock)')
    parser.add_argument('--between-calls', type=float, default=7.0,
                        help='호출 사이 텀 (초, 기본: 7)')
    parser.add_argument('--force-regenerate', action='store_true',
                        help='이미 있는 이미지도 강제 재생성')
    parser.add_argument('--dry-run', action='store_true',
                        help='이미지 생성 시뮬레이션만')

    # 단계 건너뛰기
    parser.add_argument('--skip-generate', action='store_true',
                        help='이미지 생성 단계 건너뛰기 (검증만)')

    args = parser.parse_args()

    sys.exit(run_pipeline(args))


if __name__ == '__main__':
    main()
