"""
generate_images.py — Codex CLI를 통해 이미지를 생성하고 파일로 저장.

입력: parse_boxes.py + inject_series_block.py 결과 JSON (stdin)
출력: 각 이미지 생성 결과가 추가된 JSON (stdout)

사용 예:
    python parse_boxes.py file.md --json \\
      | python inject_series_block.py --series journal-01 \\
      | python generate_images.py \\
          --asset-dir /assets/journal-01-a \\
          --adapter mock

핵심 안전장치 (자동화 계획서 §6-1):
- 순차 처리 (병렬 X — 구독제 한도 보호)
- 호출 사이 5~10초 텀
- 한도 초과 시 지수 백오프 (30s → 60s → 120s)
- 3회 실패 시 중단
- 멱등성: 이미 파일이 있으면 건너뜀 (--force로 강제 재생성)

어댑터:
- mock: 빈 PNG 파일 생성 (전체 파이프 작동 검증용)
- shell: 사용자 셸 명령어 템플릿 (CODEX_CMD 환경 변수)
- (확장 예정) codex-cli: 실제 Codex CLI 직접 호출
"""

import os
import sys
import json
import time
import argparse
import subprocess
import tempfile
from pathlib import Path
from abc import ABC, abstractmethod


def _configure_stdio() -> None:
    for stream_name in ("stdin", "stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


_configure_stdio()


# ──────────────────────────────────────────────
# 어댑터 — Codex CLI 호출을 추상화
# ──────────────────────────────────────────────

class ImageGenAdapter(ABC):
    """이미지 생성기 추상 인터페이스."""

    @abstractmethod
    def generate(self, prompt, ratio, output_path):
        """프롬프트로 이미지를 생성해 output_path에 저장.

        Returns:
            dict: {
                'ok': bool,
                'path': str,
                'error': str | None,
                'rate_limited': bool,  # True면 호출자가 백오프
            }
        """
        pass


class MockAdapter(ImageGenAdapter):
    """전체 파이프 작동 검증용. 1x1 투명 PNG 생성."""

    # 1x1 transparent PNG (89bytes)
    BLANK_PNG = bytes.fromhex(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
        '0000000d49444154789c63000000000500000a2db40000000049454e44ae426082'
    )

    def generate(self, prompt, ratio, output_path):
        try:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            Path(output_path).write_bytes(self.BLANK_PNG)
            return {'ok': True, 'path': output_path, 'error': None, 'rate_limited': False}
        except Exception as e:
            return {'ok': False, 'path': output_path, 'error': str(e), 'rate_limited': False}


class ShellAdapter(ImageGenAdapter):
    """사용자 셸 명령어 템플릿으로 호출.

    환경 변수 CODEX_CMD에 명령어 템플릿 지정:
      {prompt_file}: 프롬프트가 든 임시 파일 경로
      {ratio}: 비율 (예: "21:9")
      {output}: 저장할 이미지 파일 경로

    예시:
      export CODEX_CMD='codex exec "이 프롬프트로 {ratio} 이미지를 생성해서 {output}에 저장하라. 프롬프트 파일: {prompt_file}"'

    종료 코드 0이면 성공으로 간주, 출력 파일 존재 여부로 한 번 더 검증.
    """

    RATE_LIMIT_KEYWORDS = ['rate limit', 'too many requests', 'quota', '429', '한도']

    def __init__(self):
        self.cmd_template = os.environ.get('CODEX_CMD')
        if not self.cmd_template:
            raise RuntimeError(
                "환경 변수 CODEX_CMD를 설정하세요.\n"
                "예시: export CODEX_CMD='codex exec \"...{prompt_file}...{ratio}...{output}\"'"
            )

    def generate(self, prompt, ratio, output_path):
        # 프롬프트를 임시 파일에 저장 (긴 프롬프트의 셸 이스케이프 회피)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        with tempfile.NamedTemporaryFile(
            mode='w', encoding='utf-8', suffix='.txt', delete=False
        ) as f:
            f.write(prompt)
            prompt_file = f.name

        try:
            cmd = self.cmd_template.format(
                prompt_file=prompt_file,
                ratio=ratio or '1:1',
                output=output_path,
            )
            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True, timeout=300
            )

            # 한도 초과 키워드 감지
            combined_output = (result.stdout + result.stderr).lower()
            is_rate_limited = any(
                kw in combined_output for kw in self.RATE_LIMIT_KEYWORDS
            )

            if result.returncode == 0 and Path(output_path).exists():
                return {'ok': True, 'path': output_path, 'error': None, 'rate_limited': False}
            else:
                error = result.stderr.strip() or f"exit code {result.returncode}"
                return {
                    'ok': False,
                    'path': output_path,
                    'error': error[:500],
                    'rate_limited': is_rate_limited,
                }
        except subprocess.TimeoutExpired:
            return {
                'ok': False, 'path': output_path,
                'error': 'timeout (5분 초과)', 'rate_limited': False,
            }
        except Exception as e:
            return {
                'ok': False, 'path': output_path,
                'error': str(e), 'rate_limited': False,
            }
        finally:
            try:
                os.unlink(prompt_file)
            except OSError:
                pass


def get_adapter(name):
    """어댑터 이름으로 인스턴스 생성."""
    if name == 'mock':
        return MockAdapter()
    elif name == 'shell':
        return ShellAdapter()
    else:
        raise ValueError(f"알 수 없는 어댑터: {name}")


# ──────────────────────────────────────────────
# 호출 정책 — 한도 보호 + 재시도
# ──────────────────────────────────────────────

class CallPolicy:
    """순차 호출 + 텀 + 백오프 + 재시도."""

    def __init__(self, between_calls=7, max_retries=3, backoff_sequence=(30, 60, 120)):
        self.between_calls = between_calls
        self.max_retries = max_retries
        self.backoff_sequence = backoff_sequence
        self.last_call_time = 0

    def wait_between_calls(self):
        """이전 호출과의 간격 보장."""
        elapsed = time.time() - self.last_call_time
        wait = self.between_calls - elapsed
        if wait > 0:
            time.sleep(wait)

    def call_with_retry(self, fn, log_prefix=''):
        """fn()을 호출하되 rate_limited 시 백오프 후 재시도.

        Returns:
            (result_dict, attempts: int)
        """
        for attempt in range(1, self.max_retries + 1):
            self.wait_between_calls()
            result = fn()
            self.last_call_time = time.time()

            if result['ok']:
                return result, attempt

            if not result.get('rate_limited'):
                # 한도 외 오류는 즉시 반환
                return result, attempt

            # 한도 초과 — 백오프
            if attempt < self.max_retries:
                backoff_idx = min(attempt - 1, len(self.backoff_sequence) - 1)
                wait = self.backoff_sequence[backoff_idx]
                print(
                    f"{log_prefix}한도 초과 — {wait}초 대기 후 재시도 ({attempt}/{self.max_retries})",
                    file=sys.stderr
                )
                time.sleep(wait)

        return result, self.max_retries


# ──────────────────────────────────────────────
# 메인 처리
# ──────────────────────────────────────────────

def build_output_path(asset_dir, img_id, extension='png'):
    return f"{asset_dir.rstrip('/')}/img-{img_id}.{extension}"


def generate_all(data, adapter, asset_dir, force=False, dry_run=False, extension='png'):
    """JSON의 모든 이미지를 순차 생성. 결과는 data에 반영.

    Returns:
        dict: {'success': N, 'skipped': N, 'failed': N, 'aborted': bool}
    """
    policy = CallPolicy()
    stats = {'success': 0, 'skipped': 0, 'failed': 0, 'aborted': False}

    images = data.get('images', [])
    total = len(images)

    for idx, img in enumerate(images, start=1):
        img_id = img['id']
        output_path = build_output_path(asset_dir, img_id, extension)
        prefix = f"[{idx}/{total}] IMG-{img_id} "

        # 멱등성: 이미 파일이 있으면 건너뜀
        if not force and Path(output_path).exists():
            print(f"{prefix}이미 존재 → 건너뜀 ({output_path})", file=sys.stderr)
            img['generation'] = {
                'status': 'skipped',
                'path': output_path,
                'reason': 'file exists',
            }
            stats['skipped'] += 1
            continue

        # 프롬프트 검증
        prompt = img.get('prompt')
        if not prompt:
            print(f"{prefix}❌ 프롬프트 없음 → 건너뜀", file=sys.stderr)
            img['generation'] = {
                'status': 'failed',
                'path': output_path,
                'error': 'no prompt',
            }
            stats['failed'] += 1
            continue

        if dry_run:
            print(f"{prefix}[DRY RUN] 생성 시뮬레이션 → {output_path}", file=sys.stderr)
            img['generation'] = {
                'status': 'dry_run',
                'path': output_path,
            }
            continue

        # 실제 호출 + 재시도
        print(f"{prefix}생성 중... ({img.get('type', '?')})", file=sys.stderr)
        result, attempts = policy.call_with_retry(
            lambda: adapter.generate(prompt, img.get('ratio'), output_path),
            log_prefix=prefix,
        )

        if result['ok']:
            print(f"{prefix}✅ 완료 → {output_path}", file=sys.stderr)
            img['generation'] = {
                'status': 'success',
                'path': output_path,
                'attempts': attempts,
            }
            stats['success'] += 1
        else:
            print(f"{prefix}❌ 실패: {result.get('error')}", file=sys.stderr)
            img['generation'] = {
                'status': 'failed',
                'path': output_path,
                'error': result.get('error'),
                'attempts': attempts,
            }
            stats['failed'] += 1

            # 한도 초과로 최종 실패면 전체 중단 (§6-1)
            if result.get('rate_limited'):
                print(
                    f"\n⛔ 한도 초과 {policy.max_retries}회 — 워크플로우 중단",
                    file=sys.stderr
                )
                stats['aborted'] = True
                # 남은 이미지는 처리 안 함
                for remaining in images[idx:]:
                    remaining['generation'] = {
                        'status': 'aborted',
                        'reason': 'rate limit exhausted',
                    }
                break

    return stats


def main():
    parser = argparse.ArgumentParser(
        description='Codex CLI로 이미지를 생성하고 파일로 저장합니다.'
    )
    parser.add_argument(
        '--asset-dir', required=True,
        help='이미지 저장 디렉토리 (예: /assets/journal-01-a)'
    )
    parser.add_argument(
        '--adapter', default='mock', choices=['mock', 'shell'],
        help='이미지 생성 어댑터 (기본: mock)'
    )
    parser.add_argument(
        '--force', action='store_true',
        help='이미 존재하는 파일도 강제 재생성'
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='실제 호출 없이 시뮬레이션만'
    )
    parser.add_argument(
        '--extension', default='png',
        help='이미지 확장자 (기본: png)'
    )
    parser.add_argument(
        '--between-calls', type=float, default=7.0,
        help='호출 사이 텀 (초, 기본: 7)'
    )
    args = parser.parse_args()

    # JSON 로드
    data = json.load(sys.stdin)

    # validation 실패면 거부
    if not data.get('validation', {}).get('ok'):
        print("❌ 입력 JSON의 validation.ok=False. 이미지 생성 중단.", file=sys.stderr)
        sys.exit(1)

    # 어댑터 준비
    try:
        adapter = get_adapter(args.adapter)
    except Exception as e:
        print(f"❌ 어댑터 초기화 실패: {e}", file=sys.stderr)
        sys.exit(2)

    # 텀 설정 적용
    print(
        f"⚙️  어댑터: {args.adapter}, 저장: {args.asset_dir}, 텀: {args.between_calls}s",
        file=sys.stderr
    )

    # 전체 생성
    stats = generate_all(
        data, adapter, args.asset_dir,
        force=args.force, dry_run=args.dry_run, extension=args.extension
    )

    # 결과 출력
    data['generation_stats'] = stats
    json.dump(data, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write('\n')

    print(
        f"\n📊 결과 — 성공: {stats['success']}, 건너뜀: {stats['skipped']}, "
        f"실패: {stats['failed']}, 중단: {stats['aborted']}",
        file=sys.stderr
    )

    # 종료 코드: 실패 또는 중단이면 1
    sys.exit(1 if stats['failed'] > 0 or stats['aborted'] else 0)


if __name__ == '__main__':
    main()
