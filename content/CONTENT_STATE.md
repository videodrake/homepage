# Journal Content State

> Git에 들어가는 콘텐츠 진행 원장. Claude Project가 GitHub/Git 저장소를 읽을 수 있으면 이 파일을 최우선으로 보고 다음 Journal 주제를 결정한다.

---

## 1. 판정 원칙

Claude가 다음 글을 고를 때 읽는 순서:

1. 이 파일: `content/CONTENT_STATE.md`
2. 실제 파일 상태: `content/draft/`, `content/published/`, `assets/`
3. Git 발행 로그: `content/CONTENT_LOG.md`
4. Project Knowledge의 `콘텐츠_발행_로그.md` (Git 로그를 읽을 수 없을 때만 백업으로 사용)
5. 활성 시리즈: `series_blocks/*.yaml` 및 `자리1_활성시리즈.md`

충돌 시 우선순위:

- `published`가 있으면 완료로 본다.
- `draft`가 있으면 초안/검토 중으로 본다.
- 이 원장에는 완료인데 파일이 없으면 사용자 확인이 필요하다.
- 이 원장에는 미작성인데 `published` 파일이 있으면 파일 상태를 우선한다.

Claude는 `완료`, `초안`, `published 있음` 상태의 글을 새로 쓰지 않는다.

---

## 2. 상태 코드

| 상태 | 의미 | Claude 동작 |
|---|---|---|
| `not_started` | 아직 작성 전 | 후보 가능 |
| `drafting` | Claude 작성 중 또는 사용자 검토 전 | 중복 작성 금지 |
| `reviewed_ready_for_codex` | 사용자가 검토했고 Codex 투입 대기 | 중복 작성 금지 |
| `codex_processing` | 자리 2 처리 중 | 중복 작성 금지 |
| `published_md_ready` | `content/published` 생성 완료 | 다음 단계 대기 |
| `deployed` | 자사몰 배포 완료 | 완료 |
| `blocked` | 규제/전략상 보류 | 선택 금지 |

---

## 3. 현재 Journal 진행 상태

| slug | series | part | title | status | next_action | notes |
|---|---|---:|---|---|---|---|
| `journal-01-a` | `journal-01` | A | 왜 30km에서 무너지는가 | `deployed` | 완료 | `/journal/journal-01-a.html` 발행 완료. |
| `journal-01-b` | `journal-01` | B | 30km 이후 페이스를 지키는 법 | `deployed` | 완료 | `/journal/journal-01-b.html` 발행 완료. |
| `journal-02-a` | `journal-02` | A | 마지막 2주가 기록을 만든다 — 테이퍼링이 회수하는 6% | `deployed` | 완료 | `/journal/journal-02-a.html` 발행 완료. |
| `journal-02-b` | `journal-02` | B | 대회 24시간 루틴 | `blocked` | `journal-02-a` 배포 후 작성 | B편은 전날 저녁~출발선 24시간 루틴으로 확정. |
| `journal-03-a` | `journal-03` | A | 옥타코사놀이 달리기에 주는 것 | `blocked` | 권위 축적 후 별도 규제 검토 | 성분 직접 언급 시리즈. 가장 마지막. |

---

## 4. 다음 글 선택 규칙

현재 상태 기준 추천:

```text
next_slug: journal-02-b
next_reason: journal-02-a 자사몰 배포 완료. B편(전날 저녁~출발선 24시간 루틴)으로 이어간다.
```

Claude가 자동 주제선정을 할 때:

1. `status = not_started` 중 가장 위에 있는 slug를 고른다.
2. 단, 같은 시리즈의 앞 part가 완료되지 않았으면 뒤 part는 고르지 않는다.
3. `blocked`는 사용자가 명시적으로 해제하기 전까지 고르지 않는다.
4. `content/draft/<slug>.md` 또는 `content/published/<slug>.md`가 있으면 이 표보다 파일 상태를 우선한다.

---

## 5. 업데이트 방법

Claude가 원고를 출력한 뒤 사용자가 검토 전이면:

```text
status: drafting
next_action: 사용자 검토
```

사용자가 검토해 `content/draft/<slug>.md`로 저장하면:

```text
status: reviewed_ready_for_codex
next_action: Codex 자리 2 처리
```

Codex가 PR을 병합하고 `content/published/<slug>.md`가 생기면:

```text
status: published_md_ready
next_action: Claude Code 자리 3 배포
```

Claude Code 배포가 끝나면:

```text
status: deployed
next_action: 다음 Journal 선택
```

이때 Claude Code는 `content/CONTENT_LOG.md`도 함께 갱신한다.

이 파일과 `content/CONTENT_LOG.md`는 Git에 커밋되어야 다음 Claude Project 세션에서 최신 방향을 유지할 수 있다.
