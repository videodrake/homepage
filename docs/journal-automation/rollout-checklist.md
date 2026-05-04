# Rollout Checklist

이 체크리스트는 Codex App automation을 실제 운영에 넣기 위한 순서다.

## 1. Repo 준비

- [ ] `tools/journal_pipeline/` 스크립트가 repo에 들어가 있다.
- [ ] `content/inbox/` 폴더가 있다.
- [ ] `content/processing/` 폴더가 있다.
- [ ] `content/processed/` 폴더가 있다.
- [ ] `content/failed/` 폴더가 있다.
- [ ] `content/published/` 폴더가 있다.
- [ ] `assets/` 폴더가 있다.
- [ ] `logs/` 폴더가 있다.

빈 폴더는 Git에 남지 않으므로 필요하면 `.gitkeep`을 둔다.

## 2. Local smoke test

Claude 샘플 문서를 `content/inbox/`에 넣고 실행한다.

```bash
python -m tools.journal_pipeline.automate_inbox --inbox content/inbox --adapter dry-run
python -m unittest discover -s tools/tests -v
```

확인할 것:

- [ ] `content/published/{journal_id}.md` 생성
- [ ] `content/processed/{journal_id}.md` 생성
- [ ] `assets/{journal_id}/img-*.png` 생성
- [ ] `assets/{journal_id}/img-*.prompt.txt` 생성
- [ ] `logs/{journal_id}_pipeline.json` 생성
- [ ] `logs/{journal_id}_regulation.yaml` 생성
- [ ] `logs/{journal_id}_review.html` 생성
- [ ] 규제 검사 PASS
- [ ] unit test PASS

## 3. Codex App automation 생성

- [ ] GitHub repo를 Codex App에 연결
- [ ] 새 automation 생성
- [ ] trigger event를 push로 설정
- [ ] path filter를 `content/inbox/*.md`로 제한
- [ ] task prompt는 `codex-app-automation.md`의 Automation 1 prompt 사용
- [ ] 자동 merge 비활성화
- [ ] PR은 draft로 생성

## 4. 첫 실제 실행

- [ ] Claude 문서 1개만 `content/inbox/`에 추가
- [ ] commit/push
- [ ] Codex App automation 실행 확인
- [ ] draft PR 생성 확인
- [ ] `logs/*_pipeline.json` 확인
- [ ] `logs/*_regulation.yaml` 확인
- [ ] `logs/*_review.html` 확인
- [ ] `content/published/*.md`에서 `[IMG-n]` 잔존 여부 확인
- [ ] 이미지 preview 확인
- [ ] 문제가 없을 때만 merge

## 5. 실제 이미지 adapter 전환

초기에는 `dry-run`을 유지한다. 실제 이미지 생성까지 자동화할 준비가 끝난 뒤 adapter를 바꾼다.

전환 전 확인:

- [ ] Codex App에서 이미지 생성 호출 방식 확정
- [ ] 생성 파일을 `assets/{journal_id}/img-{n}.png`로 저장 가능
- [ ] 실패 응답을 감지 가능
- [ ] 3회 재시도 후 실패 처리 가능
- [ ] 생성 이미지 review HTML에서 확인 가능

전환 후 명령:

```bash
python -m tools.journal_pipeline.automate_inbox --inbox content/inbox --adapter codex-app
```

## 6. 운영 중 금지 사항

- [ ] `assets/**` 변경을 automation trigger로 쓰지 않는다.
- [ ] `logs/**` 변경을 automation trigger로 쓰지 않는다.
- [ ] `content/published/**` 변경을 automation trigger로 쓰지 않는다.
- [ ] PR을 자동 merge하지 않는다.
- [ ] 규제 검사 FAIL 상태에서 publish PR을 만들지 않는다.
- [ ] 신규 시리즈 첫 글을 곧바로 완전 자동화하지 않는다.

