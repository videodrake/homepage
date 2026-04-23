# Onroad / zenera.kr — 워크스페이스 안내

> 이 레포를 처음 여는 사람이 5~10분 안에 **지금 무슨 프로젝트이고, 어디가 건드려도 되는 곳이고, 뭐부터 만져보면 되는지** 알 수 있도록 정리한 문서.

---

## 1. 한 줄 요약

- **제품**: 러너(runner) 지구력 건강기능식품 브랜드 **Onroad / 지구력코어 (Endurance Core)**.
- **도메인**: https://zenera.kr (Cafe24 SaaS 호스팅).
- **주요 성분 메시지**: 옥타코사놀(Octacosanol) 40mg · 하루 한 정 · 60정 1팩.
- **이 레포**: Cafe24 기본 스킨 위에 `.onroad-page` 커스텀 오버레이로 만든 에디토리얼 톤 커머스 사이트. 디자인 프로토타입(`project/`)과 실제 운영 스킨(`cafe24/`) 두 벌을 같이 관리함.

---

## 2. 지금 상태 (at a glance)

| 항목 | 상태 |
|------|------|
| 브랜치 | `main` (유일) |
| 최근 커밋 | `8f7058f Remodel buy panel CTA stack (trendy editorial layout)` |
| origin/main과 | 동기화됨 (`git push` 완료 기준) |
| 작업 흐름 | 요청 → 로컬 수정 → 커밋·푸시 → **사용자가 FTP로 업로드** → zenera.kr 반영 |
| 환경 | WSL2 + Node + Python3 + /tmp에 Playwright |
| 디자인 레퍼런스 | https://kinomix.co.kr (구조·밀도·인터랙션 참조, 색상 톤은 Onroad 독자) |

**지금 어디에 무게중심이 있나**: **상품 상세 페이지의 우측 도킹 구매 패널**. 최근 2~3일간 커밋 대부분이 이 영역을 리모델링한 작업. 홈·브랜드 페이지는 구조 완성되어 있고 추가 터치만 누적 중.

---

## 3. 폴더 구조

```
homepage/
├── README.md                    ← 이 문서
├── .gitignore
├── cafe24_FTP_guide.docx        ← Cafe24 폴더·변수·실전 플레이북 (docx)
│
├── project/                     ← 디자인 원본 (정적 HTML 프로토타입)
│   ├── index.html               ← 홈
│   ├── main.css                 ← 디자인 시스템 + 전 페이지 스타일 (1065 라인)
│   ├── product/
│   │   ├── detail.html          ← 제품 상세
│   │   └── detail_v1.html       ← 이전 버전 (비교용)
│   ├── shopinfo/                ← 브랜드/가이드 페이지들
│   │   ├── company.html               — 브랜드 스토리
│   │   ├── endurance-core.html        — 지구력코어 제품 랜딩
│   │   ├── health-functional.html     — 기능성 표시사항
│   │   ├── ingredient-science.html    — 성분 과학
│   │   ├── intake-guide.html          — 섭취 가이드
│   │   └── runner-reviews.html        — 러너 후기 큐레이션
│   ├── layout/                  ← 공용 레이아웃(헤더/푸터 등)
│   ├── uploads/                 ← 아직 업로드 전 시안 에셋
│   └── _qa/                     ← Playwright QA 도구 (아래 9절 참고)
│
├── cafe24/                      ← 실제 운영 스킨 (Cafe24 템플릿)
│   ├── index.html
│   ├── product/detail.html
│   ├── shopinfo/                ← project/와 파일명 거의 1:1 (+ guide.html 1개)
│   ├── layout/basic/
│   │   ├── layout.html          ← 사이트 레이아웃 root
│   │   ├── header.html
│   │   ├── footer.html
│   │   ├── css/
│   │   │   ├── ec-base-*.css    ← Cafe24 시스템 CSS (절대 편집 금지)
│   │   │   └── onroad.css       ← 우리 커스텀 스킨 (4,149 라인, 지금 가장 핫한 파일)
│   │   └── js/
│   │       ├── basic.js, layout.js, popup.js …   ← Cafe24 기본 JS (건드리지 말 것)
│   │       └── onroad-brand.js  ← 우리 커스텀 스크립트 (스크롤/도킹/리빌)
│   ├── SkinImg/img/             ← 사이트에 쓰이는 이미지 자산
│   ├── order/, member/, myshop/, board/, …   ← Cafe24 기능 모듈 (편집 금지 영역)
│   └── llms.txt
│
├── kinomix/                     ← 레퍼런스 사이트 스냅샷 (HTML·CSS 덤프)
│   ├── home/                    — kinomix.co.kr 홈페이지
│   ├── detail/                  — kinomix 상품 상세
│   ├── screens/                 — 주요 스크린샷
│   └── NOTES.md                 — 참고 주요 애니메이션·UX 노트
│
├── tools/
│   └── generate-reviews         ← 리뷰 데이터 생성 유틸
│
├── chats/                       ← 디자인 핸드오프 시점의 claude.ai/design 대화 기록
│   └── chat1.md                 (프로젝트 의도 확인용 — 건드릴 필요 없음)
│
└── 문제1.png ~ 문제4.png         ← 사용자가 문제 상황 보고용으로 붙인 스크린샷
```

---

## 4. 두 세계: `project/` vs `cafe24/`

### 왜 분리되어 있나
- `project/` = **자유로운 디자인 샌드박스**. 정적 HTML, 외부 의존성 최소. Playwright로 브라우저 렌더 검증 가능.
- `cafe24/` = **실제 운영 스킨**. Cafe24 SaaS가 런타임에 `{$변수}`, `module="..."`, `<!--@css(...)-->` 등을 치환함. 정적 서버로 띄우면 제대로 안 보임.
- 디자인은 `project/`에서 먼저 굳히고 → `cafe24/`로 이식하는 방식. 단, 최근 수 주간은 cafe24/ 쪽에서 바로 iteration 하는 경우가 많아지고 있음.

### 권한·수정 범위 차이

| 범주 | `project/` | `cafe24/` |
|------|-----------|-----------|
| 레이아웃·HTML | 마음대로 | 템플릿 바깥 래퍼만 OK |
| 전역 CSS | `main.css` 자유 편집 | **반드시 `layout/basic/css/onroad.css`로만** |
| 커스텀 JS | `<script>` 자유 | **`layout/basic/js/onroad-brand.js`로만** (전역 `/js/`에 쓰지 말 것) |
| `{$var}` 템플릿 | 없음 | **절대 금지** (runtime 치환됨) |
| `module="..."` 속성 | 없음 | **절대 금지** (Cafe24 모듈 wrapper) |
| `<!--@layout/css/js/import(...)-->` | 없음 | **절대 금지** (Cafe24 디렉티브) |
| `order/`, `member/`, `myshop/`, `css/module/`, `js/module/` | 없음 | **폴더 전체 금지** (시스템 파일) |

이 규칙은 `cafe24_FTP_guide.docx`에서 확정. 어긴 적 없음.

### 이식 파일 매핑 (대응관계)
- `project/shopinfo/*.html` ↔ `cafe24/shopinfo/*.html` (파일명 1:1, cafe24만 `guide.html` 1개 더 있음)
- `project/layout/basic/` ↔ `cafe24/layout/basic/`
- `project/main.css` → `cafe24/layout/basic/css/onroad.css`로 이식 (같은 토큰 시스템 공유)

---

## 5. 디자인 시스템 (토큰 · 타이포 · 컨벤션)

`project/main.css`의 `:root` + `cafe24/layout/basic/css/onroad.css` 상단 블록에 동일 정의.

### 컬러
| 토큰 | 값 | 용도 |
|------|-----|------|
| `--c-cream` | `#f4efe6` | 기본 배경 (따뜻한 페이퍼) |
| `--c-cream-2` | `#ebe4d6` | 섹션 구분용 페이퍼 tone |
| `--c-paper` | `#faf7f1` | 밝은 페이퍼 |
| `--c-ink` | `#141210` | 본문·테두리 기본 (오프블랙) |
| `--c-char` / `--c-text` | `#2a2622` / `#1f1d1a` | 본문 텍스트 |
| `--c-meta` | `#8a847c` | 보조 메타 텍스트 |
| `--c-line` | `#d8d0c2` | 구분선 |
| **`--c-signal`** | **`#c8321e`** | **핵심 시그널 레드** (CTA, 하이라이트, italic 포인트) |
| `--c-signal-2` | `#9a2615` | Signal hover/눌렀을 때 |

### 폰트
```
--font-serif: 'Fraunces', 'Noto Serif KR', Georgia, serif;
--font-sans:  'Inter', 'Noto Sans KR', -apple-system, sans-serif;
--font-mono:  'JetBrains Mono', SFMono-Regular, Menlo, monospace;
```

**현재 방향**: 제품 상세 `.infoArea` 구매 구간에선 sans로 **전면 통일**했음. 다른 페이지(홈·브랜드)에선 여전히 serif(디스플레이 타이포) + mono(데이터·숫자) 혼용이 기본 레시피.

### 스페이싱 토큰
`--s-1: 4px` ~ `--s-32: 128px`로 8·16·24 단위 곱셈 스케일. `var(--s-4)` = 16px.
컨테이너: `--container: 1440px`. 헤더 높이: `--header-h: 72px`.

### 네이밍 컨벤션
- 홈 디자인 시스템 클래스: `hero`, `section`, `sec-head`, `empathy-cell`, `counter`, `content-card`, `final-cta`…
- 제품 상세 전용: **`pd-*` 접두어** (`pd-grid`, `pd-media`, `pd-info`, `pd-name`, `pd-review`, …)
- 패럴랙스·말풍선 등 새 커스텀: **`onroad-*` 접두어** (`onroad-parallax`, `onroad-bubble`, `onroad-bubble--ship`).
- Cafe24 스킨에서는 `.onroad-page .xxx` 스코프 필수 — 글로벌 셀렉터 오염 방지 (메모리 규칙).

### 리빌 애니메이션
- 홈: **AOS 2.3.4** (`data-aos="fade-up"` + `data-aos-delay`). CDN 링크.
- 커스텀: Hero 단어별 stagger, pin-stage 가로 스크롤, showcase 병 회전, 카운터 tween은 별도 스크롤 이벤트 로직 유지 (AOS 아님).

---

## 6. 페이지 인벤토리

| 경로 (project/) | 경로 (cafe24/) | 역할 | 상태 |
|---|---|---|---|
| `index.html` | `index.html` | 홈 | AOS 적용 완료, hero 이미지 플레이스홀더(`/SkinImg/img/jg_hero_pc.jpg` 미업로드) |
| `product/detail.html` | `product/detail.html` | 제품 상세 | 리뷰 진입 시 **사이드 도킹 구매 패널**(PC), 말풍선, AOS 리빌, 풀블리드 10/50/30/10 레이아웃. **최근 작업 집중 영역.** |
| `product/detail_v1.html` | — | 이전 버전 | 비교용, 라이브 연동 없음 |
| `shopinfo/company.html` | `shopinfo/company.html` | 브랜드 스토리 | 풀폭 리빌드 완료 |
| `shopinfo/endurance-core.html` | `shopinfo/endurance-core.html` | 지구력코어 랜딩 | Chapter 1~5 구조, sticky hero, 4-col trust 그리드 |
| `shopinfo/ingredient-science.html` | `shopinfo/ingredient-science.html` | 성분 과학 저널 | OK |
| `shopinfo/intake-guide.html` | `shopinfo/intake-guide.html` | 섭취 가이드 | OK |
| `shopinfo/runner-reviews.html` | `shopinfo/runner-reviews.html` | 러너 후기 큐레이션 | OK |
| `shopinfo/health-functional.html` | `shopinfo/health-functional.html` | 기능성 표시사항 (의무 고지) | OK |
| — | `shopinfo/guide.html` | Cafe24 전용 가이드 | 스킨 내장 |

---

## 7. 제품 상세 페이지 (핵심 작업 영역) 구조

`cafe24/product/detail.html`의 섹션 구성:

```
.section.path                       ← 브레드크럼
.titleArea.display_tablet_only      ← 모바일 전용 타이틀

.section.jg-product-detail-page     ← 최상위 래퍼 (module="product_detail")
  .detailArea                       ← 2-col 그리드 (이미지 | 구매 정보)
    .imgArea.xans-product-image     ← 좌측 sticky 이미지 (position: sticky; top: 110px)
    .infoArea                       ← 우측 구매 섹션 ← ★ 도킹 대상
      .headingArea                  ← eyebrow + h1 + 3줄 lede
      .pd-spec-block                ← [ Product Info ] 스펙 테이블
      (렌탈/정기배송/옵션 Cafe24 모듈 — 편집 금지)
      #totalProducts                ← 수량·금액 요약 (+/− 스텝퍼)
      .totalPrice                   ← "총 결제 예정 금액"
      .action_button                ← CTA 행 (바로구매 · 장바구니 · 찜)
      .ec-base-button.soldout       ← 품절 상태 전환
      a.btnNormal.mrt10             ← 대량구매문의 (ghost row)

.section.jg-product-additional-page ← 리뷰·상세이미지·Q&A·관련상품 컨테이너
  .pd-flow.pd-flow--review          ← 리뷰 섹션
  .pd-flow.pd-flow--detail #prdDetail ← 상세 이미지 (풀블리드)
  #prdQnA.pd-flow.pd-flow--qna      ← Q&A 섹션
  #prdInfo                          ← 결제/배송/교환·환불/서비스 안내 (ec-base-fold accordion) ← ★ 도킹 해제 기준
```

### 우측 도킹 패널 로직 (`cafe24/layout/basic/js/onroad-brand.js`)

- **PC (min-width: 1024px) 전용**.
- `.pd-flow--review`(리뷰 섹션) top이 **뷰포트 세로 중앙선**에 도달하면 `.infoArea.is-docked` 토글 ON.
- `#prdInfo`(맨 아래 안내 블록) top이 뷰포트에 25% 진입하면 OFF (Q&A 지나면서 자연스럽게 사라짐).
- docked 상태: `position: fixed; top: 120px; right: 12vw; width: clamp(280px, 26vw, 440px); border: 1px solid --c-ink`.
- 레이아웃 점프 방지: `.detailArea`의 `min-height`를 pre-dock 시점의 `.infoArea` 높이로 JS가 잠가둠(ResizeObserver 동반).
- body에 `.has-docked-info` 클래스 같이 토글.

### 페이지 가로 레이아웃 비율 (PC)

`body.onroad-page .jg-product-additional-page`와 `#prdDetail`·`.description`을 **뷰포트 full-bleed**로 꺼내서 다음 비율:

```
10vw gutter | 50vw 콘텐츠(리뷰·상세) | 30vw 구매 패널 | 10vw gutter
```

- 내부 `.pd-flow` 계열 / `.ec-base-table` / 상세 이미지는 `width: 100%`로 50vw 꽉 채움.
- 구매 패널 clamp 320~540px.

---

## 8. Cafe24 스킨 규칙 (실전)

### 절대 금지
1. `{$var}` 플레이스홀더 — 삭제·변경 금지 (런타임 치환값).
2. `module="..."` 속성 붙은 요소의 내부 구조 변경 금지 (outer 래퍼로만 스타일).
3. `<!--@layout / css / js / import(...)-->` 디렉티브 — 절대 건드리지 말 것.
4. `layout/basic/css/ec-base-*.css` — Cafe24 시스템 CSS, 편집 금지.
5. `order/`, `member/`, `myshop/`, `css/module/`, `js/module/` 폴더 전체 금지.
6. `layout/basic/layout.html`의 카트 카운트 스크립트·로그인 체크·팝업 호출 JS 제거 금지 (숨기고 싶으면 `display:none`으로).

### 안전 영역
- `shopinfo/*.html` — module 래퍼 바깥 HTML 자유
- `layout/basic/header.html` / `footer.html`의 non-module 부분
- `layout/basic/css/onroad.css` — 우리 커스텀 스킨 (기존 규칙 override 시 `.onroad-page` 스코프 + `!important` 필수)
- `layout/basic/js/onroad-brand.js` — 우리 커스텀 JS (IIFE 패턴, `document.querySelector('.onroad-page')` 있을 때만 실행)

### 새 CSS/JS 파일 추가 규칙
- 반드시 `layout/basic/css/` 또는 `layout/basic/js/` 아래에 추가.
- `layout.html` `<head>`에 `<!--@css(/layout/basic/css/파일명.css)-->` 1줄만 추가.
- 글로벌 `/css/`, `/js/` 덮어쓰지 말 것.

### 커스텀 클래스 네이밍
- `.onroad-` 접두어로 모두 네임스페이스.
- 상세페이지 전용은 `.pd-` 유지 (이미 광범위 배포됨).

---

## 9. 로컬 개발 · QA

### project/ 로컬 서빙
```bash
cd /home/videodrake/homepage/project
(python3 -m http.server 8765 >/tmp/srv.log 2>&1 &)
# 정리: pkill -f "http.server 8765"
```
→ http://localhost:8765/ 에서 미리보기. cafe24/는 템플릿 치환 때문에 정적 서빙 불가.

### Playwright QA
- WSL에서 Windows Chromium을 Playwright로 구동. **`/tmp/node_modules/playwright`**에 설치 상태(세션 스코프일 수 있음 — 없으면 `cd /tmp && npm i -D playwright && npx playwright install chromium` 재설치).
- 라이브 사이트 실측: `import { chromium } from '/tmp/node_modules/playwright/index.mjs'` 패턴으로 `/tmp/probe_*.mjs` 스크립트 돌림.
- 뷰포트 기본 1440×900 (데스크톱), 390×844 (모바일).

### _qa 도구 (project/ 전용 회귀 파이프라인)
```
project/_qa/
├── run.mjs          ← 9페이지 × 5뷰포트 회귀 러너
├── probe.mjs, checks.mjs, fixers.mjs, diagnose.mjs, report.mjs
├── sync-cafe24.mjs  ← project/ 변경분을 cafe24/로 동기화 (주의해서 사용)
├── _artifacts/      ← 스크린샷/리포트 결과
└── _backup/
```
구체 사용법은 `project/_qa/package.json` 참고. 에러 0 유지가 목표.

---

## 10. 배포 워크플로

1. **로컬 편집** (cursor/claude/vscode 등으로).
2. **커밋 + 푸시** (`git push origin main`) → GitHub에 기록.
3. **사용자가 FTP로 업로드** — 자동 배포 안 됨. 대상 파일 직접 올려야 zenera.kr에 반영됨.
4. **캐시 반영 확인**
   - 기본: 본인 브라우저 `Ctrl+Shift+R` (하드 리로드).
   - 안 바뀌면: `cafe24/layout/basic/layout.html`의 `<!--@css(.../onroad.css)-->`를 `<!--@css(.../onroad.css?v=해시)-->` 로 수정하고 layout.html도 함께 업로드 → 모든 방문자에게 새 파일 강제 로드.
   - 다음 CSS 업데이트 시 `?v=숫자` 값을 올려가며 갱신.

---

## 11. 최근 작업 타임라인 (구매 패널 집중)

최근 ~3주간 주요 마일스톤. `git log --oneline` 참고.

| Hash | 커밋 제목 | 요지 |
|------|-----------|------|
| `f7bb7a8` | Switch home scroll reveals to AOS | 홈 커스텀 IO 리빌 → AOS 라이브러리 전환 |
| `26ee339` | Add hero-follow parallax section to home | hero 다음 "창문 뒤 이미지" 패럴랙스 1곳 |
| `7525638` | Flatten product detail tabs into scroll layout | 상세 탭 구조 해체 → 세로 스크롤 + 스크롤-스파이 |
| `b89a4a2` | Dock product info panel to right on review scroll (PC) | 리뷰 진입 시 `.pd-info` 우측 도킹 (project/) |
| `0b79706` | Add pulsing bubbles to product detail | +무료배송 / N명 구매 말풍선 2종 |
| `2e7a5ee` | Dock product info panel to right on review scroll (cafe24 PC) | cafe24 버전 도킹 이식 |
| `68bf342` | Full-bleed product detail to true 10/50/30/10 ratio | 상세 섹션을 뷰포트 full-bleed로 꺼내고 비율 확정 |
| `e186ffd` | Narrow, lower the dock panel + earlier trigger tied to review | 트리거 포인트를 리뷰 헤딩 중앙 도달로 변경 |
| `af38cfd` | Clean up the buy section: unified type, wider stepper, spec intro | `.infoArea` 폰트 sans 통일, Product Info eyebrow |
| `a4e9d70` | Quantity stepper: neutralize Cafe24 absolute-positioned anchors | 수량 +/− Cafe24 base CSS의 `position:absolute` 중화 |
| `84df367` | Quantity stepper: kill Cafe24 base glyph bars | 버튼에 겹치던 Cafe24 `::before` 가로막대·`::after` 세로막대 제거 |
| `1fdaac8` | Shrink number input, restyle total-price label, kill all black hovers | 검은 호버 전면 제거 → signal red 전환 |
| `5836361` | Dock releases after Q&A, modernize notices, strip black hovers | 도킹 해제를 `#prdInfo` 기준으로, `.ec-base-fold` 안내 현대화 |
| `db72a6c` | Fix docked panel right-edge clipping | 패널 우측 잘림 (padding 우선순위 + right 12vw 이동) |
| `8f7058f` | Remodel buy panel CTA stack (trendy editorial layout) | CTA 3행 배치(바로구매 풀폭 / 장바구니+♡ 50/50 / 대량구매 ghost) |

### 반복 이슈와 교훈
- **!important 전쟁**: Cafe24 기본 CSS + `#id` 셀렉터 + `!important` 조합을 이기려면 우리도 스코프 + `!important`로 맞받아야 함. 사전에 어떤 규칙이 활성인지 Playwright로 `getComputedStyle` 찍어보는 게 빠름.
- **Cafe24 `::before` / `::after` 아이콘 바**: +/− 버튼을 CSS 박스 그림(가로·세로 막대)으로 그리기 때문에 `content` 뿐 아니라 `position`·`background`·`width`·`height`도 같이 리셋해야 함.
- **Full-bleed 꺼내기**: Cafe24 `#contents > .section { width: min(...) }` 규칙이 1240px로 잡기 때문에, 뷰포트 full-bleed엔 `width: 100vw; margin-left: calc(50% - 50vw)` 기법 필수.
- **스크롤 튐 원인**: 도킹 시 `.infoArea`가 flow에서 빠지면 `.detailArea` 그리드 높이가 줄어 문서 전체가 당겨짐 → `detailArea.style.minHeight` 미리 잠금.

---

## 12. Known issues / Gotchas

- **Hero 이미지 플레이스홀더**: `/SkinImg/img/jg_hero_pc.jpg`, `jg_banner_*.jpg` 등이 zenera.kr 서버에 아직 업로드 안 돼 404 반환. 기존 이슈라 디자인 작업과 직교 — 사용자가 이미지 업로드하면 자동 복구됨. 로컬 project/에서도 같음.
- **cafe24/ 정적 서빙 불가**: `{$var}` 미치환 + `<!--@...-->` 디렉티브가 그대로 보임. 로컬 검증은 `project/`에서, cafe24는 라이브 실측(Playwright on zenera.kr).
- **도킹 패널 모바일 미적용**: `matchMedia('(min-width: 1024px)')` 조건으로 PC만 동작. 모바일은 기존 스택 레이아웃 유지.
- **대량의 pre-existing 변경분이 누적**: 세션 시작 시점마다 cafe24/ 쪽에 uncommitted 상태로 남은 변경이 많았음. 커밋 분리(예전 먼저 커밋 → 세션 작업 별도 커밋) 패턴으로 정리함.
- **문제*.png 4개**: 워크스페이스 루트의 스크린샷은 사용자가 문제 보고용으로 붙인 임시 자료. `.gitignore` 안 돼있음. 정리 시점에 제거해도 됨.
- **폴더 권한 때문에 못 가져온 파일**: `preference/product/product_category.ini`, `order/ec_orderform/*.html` 등 일부 Cafe24 서버 주입 파일들. 디자인 작업과 무관 — 무시.

---

## 13. 바깥 자원 (레퍼런스)

- **라이브 사이트**: https://zenera.kr — 로컬 변경의 최종 목적지.
- **레퍼런스 사이트**: https://kinomix.co.kr — Cafe24 기반, 구조/밀도/인터랙션 참조 (색상 톤은 다름, 카피만).
- **kinomix 스냅샷**: `kinomix/home/`, `kinomix/detail/`, `kinomix/screens/`, `kinomix/NOTES.md`에 오프라인 참조.
- **Cafe24 FTP 가이드**: `cafe24_FTP_guide.docx` — 폴더 구조·변수·실전 플레이북. 상세 경로·변수 필요할 때 참고.
- **Chats**: `chats/chat1.md` — 최초 claude.ai/design 디자인 핸드오프 대화 (프로젝트 원래 의도 참조용).
- **메모리 파일**: `/home/videodrake/.claude/projects/-home-videodrake-homepage/memory/` — Claude Code auto-memory. Cafe24 규칙·Playwright 사용법·kinomix 참조 등 세션 간 컨텍스트 저장소.

---

## 14. 지금 바로 뭐부터 봐야 하나 (신규 진입 시)

1. 이 README 다 읽기.
2. `cafe24_FTP_guide.docx` 훑기 — Cafe24 규칙 체감.
3. `cafe24/layout/basic/css/onroad.css`와 `cafe24/layout/basic/js/onroad-brand.js` 둘 다 열어두기 — 커스텀 스킨의 두 중심 파일.
4. 브라우저에서 https://zenera.kr/product/detail.html?product_no=11 열고 스크롤하며 도킹 동작 직접 체험.
5. 최근 커밋 5개 `git show` 로 훑으면 지금 작업 컨텍스트가 바로 잡힘.
6. 사용자의 다음 요청을 기다리되, 요청이 cafe24/ 기능 영역(결제·회원·모듈) 건드리는 거면 **반드시 8절 규칙 재확인 후 스코프 좁혀 응답**.

---

_마지막 업데이트: 2026-04-24, 커밋 `8f7058f` 기준._
