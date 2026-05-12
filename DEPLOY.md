# DEPLOY.md — main 머지 → 라이브 자동 반영

이 레포에서 코드 변경 → 라이브(`https://zenera.kr`) 반영까지의 표준 절차. **이 레포를 처음 보는 에이전트(또는 사람)가 이 문서만 보고 첫 배포를 실수 없이 끝낼 수 있도록** 작성됨.

---

## 0. 한 장으로 보는 그림

```
[로컬 편집]
   ↓ (git commit)
[feature 브랜치: claude/review-…]
   ↓ (git push)
[GitHub: feature 브랜치]
   ↓ (PR 생성 → 머지)        ← main 직접 푸시는 HTTP 403, 반드시 PR 경유
[GitHub: main 브랜치]
   ↓ (workflow 자동 트리거)
[GitHub Actions: Deploy cafe24 skin to SFTP]
   ↓ (lftp mirror)
[Cafe24 SFTP: /base/...]
   ↓ (CDN 캐시 → 사용자 브라우저)
[zenera.kr 라이브]
```

소요 시간: 커밋 → 라이브 반영까지 약 1~3분.

---

## 1. 무엇이 어디로 배포되는가

| 로컬 경로 | SFTP 원격 경로 | 비고 |
|----------|----------------|------|
| `cafe24/**` 전체 | `/base/**` | 1:1 미러. SFTP 루트(`/`)는 read-only, `/base/`가 실제 스킨 루트 |
| 그 외 (`README.md`, `tools/`, `chats/`, `.github/`, `kinomix/` 등) | (배포 안 됨) | path filter로 제외 |

배포 트리거(`.github/workflows/deploy-cafe24.yml`):
- `main` 브랜치 푸시 + 변경이 `cafe24/**` 또는 워크플로 파일 자체일 때
- 또는 Actions UI에서 수동 `workflow_dispatch`

---

## 2. 사전 준비 (한 번만 설정)

GitHub repo Settings → Secrets and variables → Actions → New repository secret 으로 네 개:

| Secret name | 값 |
|-------------|-----|
| `CAFE24_SFTP_HOST` | `ecimg-ftp-c01.cafe24img.com` |
| `CAFE24_SFTP_PORT` | `8006` |
| `CAFE24_SFTP_USER` | 카페24 디자인 FTP 계정 ID |
| `CAFE24_SFTP_PASS` | 카페24 디자인 FTP 비번 |

비번 변경되면 `CAFE24_SFTP_PASS`만 업데이트. 워크플로 수정 불필요.

---

## 3. 표준 배포 절차 (4 단계)

### 3-1. 로컬 편집 + 커밋

```bash
# 항상 feature 브랜치에서 작업. 권장 브랜치명:
#   claude/review-homepage-commits-<slug>  (Claude Code 세션 자동 생성)
#   feat/<scope>-<short-desc>              (사람/타 에이전트)
git checkout claude/review-homepage-commits-fswwO  # 또는 git checkout -b feat/...

# 편집 후
git add <changed-files>
git commit -m "<descriptive message>"
```

커밋 메시지 컨벤션은 `git log --oneline -10` 으로 톤 맞추기. "왜" 위주, 본문은 컨텍스트 + 사용자 보고 + 트레이드오프.

### 3-2. feature 브랜치 푸시

```bash
git push -u origin <branch-name>
```

네트워크 에러는 4회까지 지수 백오프 재시도(2s/4s/8s/16s). 그 외 에러(403 등)는 재시도 금지.

### 3-3. main으로 PR 생성 + 머지

**중요**: `main` 직접 푸시는 권한 없음(`HTTP 403`). 반드시 PR 경유.

세 가지 경로 중 환경에 맞는 것 선택:

#### 경로 A — GitHub MCP (Claude Code 등 MCP 지원 에이전트)
```
mcp__github__create_pull_request:
  owner: videodrake
  repo: homepage
  base: main
  head: <feature-branch-name>
  title: <short title>
  body: <summary + test plan>
→ 응답에서 PR number 받음 (예: 13)

mcp__github__merge_pull_request:
  owner: videodrake
  repo: homepage
  pullNumber: 13
  merge_method: merge      # or "squash" — repo policy 따라 선택
```

#### 경로 B — `gh` CLI (해당 권한이 있는 에이전트)
```bash
gh pr create --base main --head <branch> --title "..." --body "..."
gh pr merge <PR#> --merge          # 또는 --squash
```

#### 경로 C — 사람 (브라우저)
GitHub web UI → Pull requests → New PR → base: main, head: feature → Create → Merge.

### 3-4. 자동 배포 확인

머지 직후 GitHub Actions 탭에 "Deploy cafe24 skin to SFTP" workflow run이 자동 시작됨. 1~2분 소요.

- 성공(녹색 체크) → 라이브 강력 새로고침(`Ctrl+Shift+R`)으로 확인
- 실패(빨강) → 5절 "트러블슈팅" 참조

---

## 4. 워크플로 옵션 (`workflow_dispatch`)

수동 실행할 때 Actions 탭 → "Run workflow" 드롭다운에 두 입력:

| 입력 | 기본 | 의미 |
|------|------|------|
| `dry_run` | `false` | `true`면 lftp `--dry-run` 모드, 실제 업로드 안 함. 변경 시뮬레이션만 |
| `delete_remote` | `false` | `true`면 `--delete` 활성화. **로컬에 없는 원격 파일 삭제**. 기본 OFF (안전) |

`delete_remote=true` 사용 패턴:
1. 먼저 `dry_run=true` + `delete_remote=true`로 실행 → 로그에서 어떤 파일이 지워질지 확인
2. 안전하면 `dry_run=false` + `delete_remote=true`로 재실행 → 실제 청소

`push` trigger(자동 배포)는 **항상 add/update only**. 안전을 위함.

---

## 5. 트러블슈팅

### "permission denied (./<dir>)" / 권한 거부
원인: 카페24가 chmod 호출 거부 (디자인 FTP 정책).
대응: 워크플로에 `--no-perms` 플래그 이미 포함. 업로드 자체는 성공함. 이 에러가 나오는데 빨간 X로 끝나면 lftp 버전 문제 — 보통 무시 가능.

### "Login incorrect"
원인: `CAFE24_SFTP_PASS` 만료/오타.
대응: 카페24 어드민에서 디자인 FTP 비번 확인/재설정 → repo Secret 업데이트.

### "Access failed: permission denied (index.html)" — 루트 경로 거부
원인: 누군가가 `--reverse cafe24/ /` 로 설정 (SFTP 루트는 read-only).
대응: `.github/workflows/deploy-cafe24.yml`에서 `mirror ... cafe24/ /base/` 확인. `/base/` 빠지면 안 됨.

### 머지 직후 라이브가 깨져 보임 (CSS 없음 / 폰트 깨짐)
원인: lftp `xfer:clobber on` 때문에 파일 remove → write 단계가 race. 그 짧은 순간에 페이지 로드하면 일부 파일 404.
대응: 워크플로 끝날 때까지 대기 → 강력 새로고침. 1분 안에 정상화됨. 영구 깨짐이면 다른 원인.

### main으로 직접 push했더니 `HTTP 403`
원인: main 브랜치 보호 또는 토큰 권한 제한.
대응: 직접 푸시 절대 재시도 금지. feature 브랜치 → PR → MCP/gh로 머지 (3-3절).

### 1e6cdc1처럼 사용자가 로컬 커밋만 만들고 푸시 안 함
증상: `git fetch --all` 후에도 해당 커밋이 어느 브랜치에도 없음.
대응: 사용자에게 푸시 요청. 또는 `git show <sha>` 출력 직접 받아서 patch로 적용.

### 카페24 옵티마이저가 옛 CSS/JS 서빙
카페24는 `optimizer_user.php?filename=<hash>` 로 CSS/JS 번들을 서빙. 파일 내용 변경되면 해시 갱신 → 새 URL → 캐시 무효화. 보통 자동 해결.
영구히 옛 코드가 보이면: agreement.html에서 시도한 것처럼 `<!--@js(...)-->` 디렉티브 대신 인라인 `<script>` 블록으로 우회 가능 (단 카페24 모듈 div 안에 두면 안 됨).

---

## 6. 잘 알려진 제약 (카페24 특성)

| 항목 | 제약 / 권장 |
|------|-----------|
| SFTP 루트 | `/`는 read-only. 실제 스킨은 `/base/` |
| chmod | 차단됨 → 워크플로 `--no-perms` |
| 카페24 어드민 웹에디터 | 사용자가 웹에디터로 라이브 직접 편집할 수 있음. 그 변경분은 git에 없음 → SFTP 미러가 덮어쓰면 손실. **첫 배포 전 `dry_run=true`로 시뮬, 충돌 가능성 점검** |
| 카페24 default UI 컴포넌트(`.btnClose`, `.ec-base-paginate` 일부 등) | CSS만으로 완전 override 어려운 경우 종종 발생. cascade 전쟁 길어지면 **카페24 default를 그대로 두고 컨테이너만 톤 조정**하는 게 권장 |
| `<!--@js(...)-->` / `<!--@css(...)-->` 디렉티브 | `<div module="...">` 블록 안에 있어도 보통 동작하지만 일부 페이지에서 모듈 렌더링과 충돌 가능. 안 잡히면 인라인 `<script>` / `<link>` 우회 |
| `--delete` 미러 | 기본 OFF. ON으로 켤 때는 dry-run 필수 |

---

## 7. 첫 배포 체크리스트 (신규 에이전트용)

```
[ ] git status 깨끗한가? (uncommitted 변경 없는가)
[ ] 작업 브랜치 명확한가? (feature 브랜치인가, main 아닌가)
[ ] 변경 파일이 cafe24/ 안에 있나? (그 외 폴더 변경만이면 배포 안 트리거됨 — 의도된 상황인지 확인)
[ ] 카페24 어드민에서 최근 웹에디터 편집 있었는지 사용자에게 확인
[ ] 커밋 메시지에 "왜" 명시
[ ] 푸시 → PR → 머지 (3-3절 경로 A/B/C 중 택1)
[ ] Actions 탭에서 deploy run 녹색 확인
[ ] 라이브 강력 새로고침으로 시각 확인
[ ] 회귀 발견 시 즉시 revert PR (절대 force push로 덮지 말 것)
```

---

## 8. 관련 파일

- `.github/workflows/deploy-cafe24.yml` — 워크플로 정의
- `CAFE24_RULES.md` — 카페24 규칙 / 변수 / 경로
- `README.md` §12-13 — 카페24 운영 컨텍스트 일반
- 본 문서 — 배포 절차
