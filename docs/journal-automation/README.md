# Journal Automation

이 폴더는 Claude가 생성한 Journal 원고를 Codex App automation으로 처리하기 위한 운영 문서다.

목표는 단순하다.

```text
Claude markdown 문서
→ content/inbox/에 commit/push
→ Codex App automation 실행
→ 이미지 생성, 본문 치환, 규제 검사
→ draft PR 생성
→ 사람이 preview 검수 후 merge
```

## 문서 구성

- `codex-app-automation.md`: Codex App에서 어떤 이벤트와 task prompt를 설정할지 설명한다.
- `pipeline-contract.md`: 자동화가 기대하는 폴더, 파일, 성공/실패 산출물 계약을 정의한다.
- `rollout-checklist.md`: 실제 도입 순서와 검수 체크리스트를 제공한다.

## 핵심 원칙

- `content/inbox/*.md` 변경만 자동화 트리거로 사용한다.
- `assets/`, `logs/`, `content/published/`, `content/processed/`, `content/failed/` 변경은 트리거로 사용하지 않는다.
- PR은 draft로 만들고 자동 merge하지 않는다.
- 규제 검사 실패 시 PR 생성으로 넘어가지 않는다.
- 신규 시리즈 첫 글은 dry-run과 수동 검수를 먼저 통과시킨 뒤 자동화에 합류시킨다.

## 운영자가 하는 일

1. Claude가 만든 Journal markdown을 `content/inbox/`에 넣는다.
2. 변경사항을 commit/push한다.
3. Codex App automation이 draft PR을 만들 때까지 기다린다.
4. PR에서 `logs/*_regulation.yaml`, `logs/*_pipeline.json`, `logs/*_review.html`를 확인한다.
5. preview에서 텍스트와 이미지를 직접 확인한다.
6. 문제가 없을 때만 merge한다.

## 구현 상태

현재 권장 구현은 두 단계로 나눈다.

1. 결정적 파이프라인
   - 이미지 명세 파싱
   - 프롬프트 추출
   - 이미지 파일 검증
   - 본문 `[IMG-n]` 치환
   - 규제 검사
   - review HTML 생성

2. 이미지 생성 adapter
   - 초기에는 `dry-run` adapter로 placeholder와 prompt sidecar를 생성한다.
   - Codex App에서 이미지 생성 호출 방식이 확정되면 `codex-app` adapter를 붙인다.
   - API 기반 완전 자동화가 필요하면 `openai` adapter를 별도로 붙인다.

## 관련 명령

Codex App automation이 실행할 기본 명령은 다음 형태다.

```bash
python -m tools.journal_pipeline.automate_inbox --inbox content/inbox --adapter dry-run
python -m unittest discover -s tools/tests -v
```

실제 이미지 생성 adapter가 준비되면 `--adapter dry-run`을 `--adapter codex-app` 또는 `--adapter openai`로 바꾼다.

