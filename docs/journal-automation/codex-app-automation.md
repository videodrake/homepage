# Codex App Automation 설정안

이 문서는 Codex App에서 어떤 이벤트를 설정하고, 어떤 task prompt를 넣어야 하는지 정의한다.

## 전체 흐름

```text
content/inbox/*.md push
→ Codex App automation 시작
→ pipeline 명령 실행
→ 성공 시 generated files commit
→ draft PR 생성
→ 사람 검수
→ merge
```

Git을 이벤트 버스로 사용한다. Codex App은 repo 변경 이벤트를 받아 스크립트를 실행하고, 그 결과를 별도 branch와 draft PR로 올린다.

## Automation 1: Journal Intake

### Trigger

```text
Event: push
Path filter: content/inbox/*.md
Base branch: main
```

반드시 path filter를 `content/inbox/*.md`로 제한한다. 아래 경로는 트리거에 포함하지 않는다.

```text
assets/**
logs/**
content/published/**
content/processed/**
content/failed/**
```

이 경로들을 트리거에 포함하면 automation이 자신이 만든 commit에 다시 반응해 루프가 생길 수 있다.

### Task prompt

Codex App automation prompt에는 아래 문장을 넣는다.

```text
Process new Journal markdown files in content/inbox.

Run:
python -m tools.journal_pipeline.automate_inbox --inbox content/inbox --adapter dry-run

Then run:
python -m unittest discover -s tools/tests -v

If the commands pass:
- Commit generated files under content/published, assets, logs, and content/processed.
- Open a draft PR titled "[Journal Automation] generated Journal assets".
- In the PR body, include paths to logs/*_pipeline.json, logs/*_regulation.yaml, and logs/*_review.html.
- Include a short summary of image count, regulation status, and published markdown path.

If any command fails:
- Commit content/failed and logs/*_automation_failure.json or logs/*_regulation.yaml.
- Do not open a publish PR.
- Summarize the failure and exact file paths.

Never merge automatically.
Never edit files outside Journal automation outputs unless needed to fix the automation pipeline.
```

## Automation 2: PR Packaging

선택 사항이다. 첫 도입에서는 Automation 1만 써도 된다.

### Trigger

```text
Event: pull_request opened or synchronized
Path filter:
- logs/*_pipeline.json
- logs/*_regulation.yaml
- logs/*_review.html
```

### Task prompt

```text
Review the generated Journal automation artifacts for this PR.

Check:
- logs/*_pipeline.json has images_expected == images_generated.
- logs/*_regulation.yaml status is PASS.
- content/published/*.md has no [IMG-n] placeholders.
- logs/*_review.html exists.

Update the PR body with:
- image generation summary
- regulation summary
- review HTML path
- any warning or blocker

Do not merge the PR.
```

## Branch and PR policy

- Codex App should create a new branch for generated outputs.
- Branch name recommendation: `codex/journal-{journal_id}-automation`
- PR title recommendation: `[Journal Automation] {journal_id}`
- PR type: draft
- Merge: manual only

## Adapter policy

초기 설정은 `dry-run`이다.

```bash
python -m tools.journal_pipeline.automate_inbox --inbox content/inbox --adapter dry-run
```

이 상태에서는 실제 이미지를 만들지 않고 placeholder PNG와 `img-*.prompt.txt`를 생성한다.

실제 자동 이미지 생성 연결 후에는 아래 중 하나로 바꾼다.

```bash
python -m tools.journal_pipeline.automate_inbox --inbox content/inbox --adapter codex-app
python -m tools.journal_pipeline.automate_inbox --inbox content/inbox --adapter openai
```

`codex-app` adapter는 Codex App 이미지 생성 기능을 호출하는 방식이 확정된 뒤 구현한다. API 기반으로 완전 자동화할 경우 `openai` adapter를 구현한다.

