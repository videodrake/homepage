# 카페24 적용 규칙 (Cafe24 Application Rules)

> 이 문서는 `cafe24/` 폴더의 코드를 zenera.kr 라이브에 안전하게 적용하기 위한 **운영 규칙·렌더 메커니즘·사고 회피 체크리스트**다.
> 새로 작업을 시작하기 전 **§1 TL;DR + §15 체크리스트**는 반드시 다시 읽는다.
> 워크스페이스 일반 안내는 [`README.md`](./README.md)를, 한 줄짜리 점프 노트는 메모리(`~/.claude/projects/-home-videodrake-homepage/memory/`)를 참고.

---

## 목차

1. [TL;DR — 가장 자주 어기는 5가지](#1-tldr)
2. [카페24 스킨이 어떻게 렌더되는가 — 멘탈 모델](#2-멘탈-모델)
3. [파일 구조와 수정 권한 영역](#3-파일-구조와-수정-권한-영역)
4. [카페24 지시문 (`<!--@*-->`) 레퍼런스](#4-카페24-지시문-레퍼런스)
5. [모듈 시스템 (`module="..."`)](#5-모듈-시스템)
6. [템플릿 변수 (`{$...}`) 와 필터](#6-템플릿-변수와-필터)
7. [런타임 주입 — `xans-*` 클래스, `displaynone`](#7-런타임-주입)
8. [CSS 번들 (`optimizer.php`) 동작과 캐시](#8-css-번들과-캐시)
9. [CSS specificity 충돌 — 해결 패턴](#9-specificity-패턴)
10. [헤더 · sticky · fixed 배치 규칙](#10-헤더-sticky-fixed-배치)
11. [디자인 번들 → 카페24 적용 브릿징](#11-디자인-번들-브릿징)
12. [`.onroad-page` 네임스페이스 규칙](#12-onroad-page-네임스페이스)
13. [FTP ↔ Cafe24 DB 이중 저장 함정](#13-ftp-db-이중-저장)
14. [검증 절차](#14-검증-절차)
15. [코드 변경 체크리스트 (전·후)](#15-체크리스트)
16. [사고 사례 백서](#16-사고-사례-백서)
17. [강제 구조와 디자인 제약 (Constraints)](#17-강제-구조와-디자인-제약)
18. [JS 런타임 해체분석 — 매 페이지 로드 시 일어나는 일](#18-js-런타임-해체분석)
19. [EZ 시스템 — 두 번째 모듈 레이어](#19-ez-시스템)
20. [`ec-base-*.css` suite 해체분석](#20-ec-base-css-suite-해체분석)
21. [모듈 391개 분류와 케이스 함정](#21-모듈-분류와-케이스-함정)
22. [서버 런타임 주입 카탈로그](#22-서버-런타임-주입-카탈로그)
23. [예약된 클래스/ID — 우리가 건드리면 안 되는 이름들](#23-예약된-이름)
24. [자체 점검 노트 — 1차 문서의 약점](#24-자체-점검-노트)
25. [용어집](#25-용어집)

---

## 1. TL;DR

이 다섯 가지만 지켜도 사고 90% 예방.

1. **`<!--@css(...)-->` 디렉티브에 쿼리 스트링 절대 금지** (`?v=`, `?t=` 모두). 옵티마이저가 다른 파일로 인식해 번들에서 통째 누락 → 라이브가 raw HTML로 렌더됨. 카페24가 자동으로 `?t=<timestamp>` 붙여주므로 수동 버전 불필요.
2. **`module="..."` / `{$변수}` / `<!--@layout|css|js|import(...)-->` 는 절대 삭제·이름변경 금지. 케이스도 1글자 변경 금지** (`Myshop_main` ≠ `myshop_main`, §21.2). 이 hook들은 서버가 런타임에 데이터를 주입하는 자리. 디자인 번들 HTML로 통째 대체하면 결제/장바구니/회원/가격이 모두 깨짐.
3. **`.site-header`는 `position: fixed; top: 0; z-index: 50`이다.** 그 위에 띄울 요소는 `position: fixed; top: 0; z-index > 50` + `:has()` 스코프로 헤더와 `#wrap`을 promo 높이만큼 밀어내야 한다 (§10). 추가로 layout.js의 `fixedHeader()`가 스크롤 시 `#contents`에 `margin-top: 72px` 인라인 박는 사실도 인지 (§18.3) — 두 padding/margin 누적 가능.
4. **시각 변경은 1 commit = 1 visual element.** promo + urgency + tabs + sticky를 한 커밋에 묶지 말 것. 깨졌을 때 어디 때문인지 분리 불가능 → 전체 revert만 가능.
5. **카페24 어드민 "디자인 편집" / "스마트디자인 편집" 페이지를 절대 열지 말 것.** DB의 옛 버전이 FTP 파일을 덮어써 작업이 통째로 사라진다.

---

## 2. 멘탈 모델

라이브 페이지가 만들어지는 순서를 정확히 알면 반복되는 사고가 거의 사라진다.

```
①  로컬 cafe24/ 파일                 (스킨 소스)
        │  FTP 업로드
        ▼
②  Cafe24 서버 파일 시스템            (FTP 미러 + DB 미러 둘 다 존재)
        │
        │  요청 들어오면 ↓
        ▼
③  스킨 템플릿 처리기                 (서버 사이드)
       │   - <!--@layout(...)--> 합치기
       │   - <!--@import(...)--> 삽입
       │   - {$변수} 치환 (회원·상품·카트·DB)
       │   - module="..." 요소에 .xans-* 클래스 주입, 서브트리에 데이터 바인드
       │   - {$xxx_display|display} → "displaynone" 또는 빈 문자열로 치환
       ▼
④  완성된 HTML
        │   <!--@css(...)--> / <!--@js(...)--> 디렉티브가 모은 파일을
        │   optimizer.php / optimizer_user.php 번들 1~2개로 minify+concat
        ▼
⑤  브라우저에 응답
       │  HTML 응답
       │  + <link href="...optimizer_user.php?...&t=<ts>"> (CSS 번들)
       │  + <script src="...optimizer.php?...&t=<ts>"> (JS 번들)
       ▼
⑥  브라우저 렌더
       │  - HTML 파싱
       │  - CSS 적용 (cascade)
       │  - JS 실행 (basic.js / layout.js / onroad-brand.js / 모듈 JS)
       │  - 일부 module이 추가 fetch (장바구니 카운트, 위시 상태 등)
```

핵심 통찰:

- **③에서 일어나는 모든 일은 로컬에서 재현 불가.** `python3 -m http.server`로 cafe24/를 띄워봤자 `{$변수}`도 `<!--@import-->`도 안 풀린다. 검증은 라이브 (zenera.kr) 또는 `project/` 디자인 샌드박스에서.
- **CSS 번들은 ④에서 합쳐진다.** `<!--@css(...)-->` 디렉티브가 옵티마이저 번들 입력. 디렉티브에 쿼리를 붙이면 옵티마이저 입력 키가 달라져 번들에서 빠진다 (사고 사례 §16-A).
- **④와 ⑤ 사이 캐시 레이어가 있다.** 옵티마이저는 첫 번째 요청에서 빌드하고 후속은 디스크 캐시 히트. 빌드 갱신은 보통 몇 분 안에 일어나지만 가끔 늦다.

---

## 3. 파일 구조와 수정 권한 영역

```
cafe24/
├─ index.html                       ← 홈 (사용 안 함; 실제 홈은 main.html이 차지)
├─ layout/basic/
│   ├─ layout.html        ★ 서브 페이지 layout (제품/회원/마이페이지/약관/팝업 등)
│   ├─ main.html          ★ 홈 전용 layout (다른 <body class>·CSS 추가)
│   ├─ popup.html         ★ 레이어 팝업 layout (.ec-base-layer 래퍼 전용)
│   ├─ intro.html         ★ 인트로 페이지 전용 layout
│   ├─ header.html / footer.html / sidebar.html / quick.html / topbanner.html
│   ├─ navigation.html / state_login.html / detail_layout.html
│   ├─ css/
│   │   ├─ ec-base-*.css            🚫 시스템 CSS — 절대 편집 금지
│   │   ├─ common.css / layout.css  🚫 시스템 CSS — 편집 금지
│   │   ├─ main.css / sub_style.css ⚠️  기본 테마 CSS — 가능하면 onroad.css에서 override
│   │   ├─ add_theme0[1-4].css      ⚠️  테마 변형 — 비워둬도 OK
│   │   ├─ add_layout.css           ⚠️  layout 보조 — 사용 안 함
│   │   └─ onroad.css               ✅ ★ 우리 커스텀 스킨 (~13,400 줄, 모든 .onroad-page 룰)
│   └─ js/
│       ├─ basic.js / layout.js / popup.js   🚫 시스템 JS — 편집 금지
│       └─ onroad-brand.js          ✅ ★ 우리 커스텀 JS (스크롤·도킹·sessionStorage)
│
├─ product/                         ⚠️  module 래퍼만 보존, 바깥은 편집 가능
│   ├─ detail.html                  ← module="product_detail", "product_image" 등 핵심
│   ├─ provider/  shoppQ/
├─ member/                          🚫 폴더 전체 금지 (단, login.html·join.html·agreement.html
│                                       처럼 디자인 표면만 손댄 파일들은 module 래퍼 보존하며 작업)
├─ myshop/                          🚫 폴더 전체 금지 (단, index.html / 등 디자인 표면 OK)
├─ order/                           🚫 폴더 전체 금지 (결제·주문 — 시스템 영역)
├─ board/                           🚫 시스템 게시판 — 손대지 말 것
├─ coupon/                          🚫 시스템 쿠폰 — 손대지 말 것
├─ shopinfo/                        ✅ 자유 영역 (브랜드/가이드/회사 페이지)
├─ smart-banner/                    🚫 카페24 컨테이너 — 편집 안 함
├─ ez/                              🚫 EZ 디자인 시스템 (theme switch) — 손대지 말 것
├─ apps/  attend/  estimate/  intro/  preference/  supply/  config/   🚫
├─ css/module/  js/module/          🚫 모듈별 시스템 CSS/JS — 편집 금지
├─ SkinImg/img/                     ✅ 정적 이미지 자산 (이미지 추가/교체 OK)
└─ svg/                             ✅ 인라인 SVG 아이콘 (편집 OK, 다른 파일이 @import로 끌어 씀)
```

### 4단계 권한 라벨

- **✅ 안전 영역 (자유 편집)**: `layout/basic/css/onroad.css`, `layout/basic/js/onroad-brand.js`, `shopinfo/*.html`, `SkinImg/img/`, `svg/`.
- **⚠️ module 보존 영역 (래퍼만 편집)**: `product/detail.html`, `product/list.html`, `myshop/index.html`, `member/login.html`, `member/join.html`, `member/agreement.html`, `index.html`, `layout/basic/{layout,main,header,footer,navigation,sidebar}.html`. 내부 `module="..."` / `{$...}` / `<!--@...-->` 는 모두 보존.
- **🚫 손대지 말 것**: `order/`, `board/`, `coupon/`, `apps/`, `attend/`, `estimate/`, `intro/`, `preference/`, `supply/`, `smart-banner/`, `ez/`, `config/`, `css/module/`, `js/module/`, `layout/basic/css/ec-base-*.css`, `layout/basic/js/{basic,layout,popup,...}.js`.
- **🛑 절대 열지 말 것 (어드민)**: 카페24 어드민의 *디자인 편집* / *스마트디자인 편집* 페이지. §13 참조.

### 새 파일을 추가할 때

1. CSS는 `layout/basic/css/onroad.css`에 **추가만** (별도 파일 만들지 않는다).
2. JS는 `layout/basic/js/onroad-brand.js`에 **추가만**.
3. 진짜로 분리해야 할 큰 신규 기능이라면:
   - 새 파일을 `layout/basic/css/` 또는 `layout/basic/js/` 아래 만들고,
   - `layout/basic/layout.html`에 `<!--@css(/layout/basic/css/파일명.css)-->` 1줄 추가 (쿼리 금지).
   - 글로벌 `/css/`, `/js/`에는 신규 파일을 만들지 않는다.

---

## 4. 카페24 지시문 레퍼런스

라이브 렌더 시 서버가 처리하는 ASCII 매크로. 모두 `<!--@...-->` 형태이며 HTML 주석 문법을 빌리지만 **카페24 서버에만 의미가 있다**.

| 디렉티브 | 의미 | 형식 |
|---|---|---|
| `<!--@layout(/path)-->` | 이 파일은 지정된 layout의 children. 나중에 layout이 `<!--@contents-->` 자리에 이 파일 내용을 채운다. | 페이지 첫 줄에 위치 |
| `<!--@contents-->` | layout 안에서 children 내용이 들어갈 자리 | layout 파일 내 1번 등장 |
| `<!--@import(/path)-->` | 빌드타임 include — path의 HTML을 그대로 끼워 넣음 (서버 사이드 SSI). 자주 쓰는 곳: header/footer/sidebar/svg 아이콘 | 어디든 |
| `<!--@css(/path)-->` | 옵티마이저 CSS 번들 입력에 추가. 순서대로 concat. | `<head>` 또는 `<body>` 어디든 (하지만 위에 있을수록 먼저 적용) |
| `<!--@js(/path)-->` | 옵티마이저 JS 번들 입력에 추가. | 어디든 |
| `<!--@define(name)-->` | 변수 정의 (사용 빈도 매우 낮음) | `index.html` `<!--@define(cmc_log)-->` 한 곳만 등장 |

### 디렉티브 사용 시 절대 규칙

- **쿼리 스트링 금지** — `<!--@css(/foo.css?v=1)-->` 는 옵티마이저가 별개 파일로 인식해 번들에서 통째 빠진다 (§16-A 사고).
- **경로 끝 슬래시 금지** — 디렉토리는 import 대상이 아니다.
- **공백·따옴표 금지** — `<!--@css( /foo.css )-->`, `<!--@css("/foo.css")-->` 모두 무효.
- **상대 경로 금지** — `../`, `./` 안 됨. 항상 `/layout/...`처럼 사이트 루트 절대 경로.
- **중복 등록 무해**하지만 같은 CSS가 두 번 합쳐져 cascade 순서가 꼬일 수 있음 — `layout.html`과 자식 페이지 양쪽에서 같은 `@css`를 등록하지 말 것.
- **layout 호출은 한 페이지당 1번** — `<!--@layout(...)-->`을 두 번 쓰면 동작 미정의.

### 사용 패턴

**서브 페이지 layout (`layout.html`):**
```
서브페이지 (예: product/detail.html)
  └─ <!--@layout(/layout/basic/layout.html)-->
        layout.html
        ├─ <head>: ec-base-*.css, swiper.min.css, basic.js, layout.js
        ├─ <body class="theme01 en-layout onroad-page">
        │   ├─ <!--@import(/layout/basic/header.html)-->
        │   ├─ <!--@import(/layout/basic/sidebar.html)-->
        │   ├─ #container > #contents > <!--@contents--> ← 자식 들어감
        │   ├─ <!--@import(/layout/basic/footer.html)-->
        │   └─ <!--@css(/layout/basic/css/onroad.css)-->  ← 마지막에 우리 커스텀 (cascade winner)
```

**홈 (`main.html`):**
```
index.html
  └─ <!--@layout(/layout/basic/main.html)-->
        main.html
        ├─ <head>: 같은 ec-base-*
        ├─ <body class="theme01 jg-layout onroad-page onroad-home">
        │   ├─ <!--@import(.../header.html)-->
        │   ├─ <!--@contents-->
        │   ├─ <!--@import(.../footer.html)-->
        │   └─ <!--@css(/layout/basic/css/onroad.css)-->
```

홈과 서브 페이지의 차이: `<body>` class (`en-layout` vs `jg-layout onroad-home`)와 `main.css` 추가 등록 정도.

**팝업 (`popup.html`):**
독립 layout. 헤더·푸터 없음. `.ec-base-layer` 래퍼 안에서 모듈만 그린다. 수령인 변경, 주소 검색, 환불 신청, 정기배송 수정 등이 사용.

---

## 5. 모듈 시스템

`module="..."` 속성이 붙은 요소는 **카페24 서버가 런타임에 데이터·자식 마크업을 채우는 hook**. 이 요소를 디자인 번들 HTML로 통째 대체하면 데이터가 사라진다.

### 동작 방식

서버 렌더 시점에 `module="product_detail"` 같은 요소에:
1. `xans-element- xans-product xans-product-detail` 클래스가 추가됨 (§7)
2. 자식 요소의 `{$변수}`가 실제 값으로 치환됨
3. 일부 모듈은 자식 마크업 자체를 서버가 채워 넣음 (예: `module="product_addimage"` — 추가 이미지 `<li>` 자동 생성)
4. 일부 모듈은 클라이언트 JS와 짝 (예: `module="product_image"`는 `/js/module/product/product_image.js`가 줌·스와이프 등 동작)

### 이 프로젝트에서 자주 쓰는 모듈

| 모듈 | 용도 | 위치 |
|---|---|---|
| `product_detail` | 제품 상세 최상위 — `{$product_*}` 변수 스코프 | `product/detail.html` |
| `product_image` | 메인 이미지 + 줌 + 모바일 스와이프 | detail.html `.imgArea` |
| `product_addimage` | 추가 이미지 리스트 | detail.html `.listImg` |
| `product_action` | 구매·장바구니·찜 버튼 영역 — `{$action_*}` 함수 주입 | detail.html `.action_button` |
| `product_option` / `product_mainoption` / `product_addoption` | 옵션 셀렉터 | detail.html option 영역 |
| `product_quantity` | 수량 +/− 스텝퍼 | detail.html `#totalProducts` |
| `product_review` / `product_qna` | 리뷰·문의 모듈 | detail.html `.pd-flow--review`, `--qna` |
| `product_headcategory` | 브레드크럼 | detail.html `.section.path` |
| `product_listnormal` / `product_listnew` / `product_listrecommend` | 리스트형 상품 | 카테고리·홈 |
| `member_login` | 로그인 폼 — `{$action_func_login}` 등 | member/login.html |
| `member_join` | 회원가입 폼 | member/join.html |
| `Layout_orderBasketcount` | 카트 카운트 표시 | header.html `.basket count` |
| `Layout_statelogon` / `Layout_statelogoff` | 로그인 상태 표시 영역 — 비로그인 시 only logon 자식이 displaynone | header.html, sidebar.html |
| `Layout_multishopShipping` | 다국어/배송 셀렉터 | layout.html (하단) |
| `myshop_main` / `myshop_summary` / `myshop_orderstate` / `myshop_asyncbankbook` / 등 | 마이페이지 위젯 | myshop/index.html |
| `Mall_Urgencycall` | 긴급 알림 배너 | header.html |

전체 391개 module 중 위가 자주 손대는 것들. 나머지는 시스템이 알아서.

### 모듈 작업 규칙

1. **`module="..."` 속성 자체와 그 요소의 outer tag는 절대 삭제·이름변경 금지.**
2. 자식 마크업 안의 `{$변수}`도 보존.
3. 디자인 톤 입히는 방법은:
   - outer 요소에 클래스 추가 (`<div module="product_image" class="imgArea pd-media">`)
   - outer 요소를 새 wrapper로 감싸기 (`<div class="pd-grid"> <div module="product_image">...</div> ... </div>`)
   - CSS에서 module 요소의 클래스(또는 `xans-product-image` 런타임 클래스)를 selector로 직접 스타일.
4. 자식 마크업 추가/제거: 카페24가 채워 넣는 영역(예: `product_addimage`의 `<li>`)에는 손대지 말 것. 단순한 데코 요소 추가는 outer 형제 위치에.

---

## 6. 템플릿 변수와 필터

### 변수 형식

- `{$variable_name}` — 단순 치환. 회원명, 상품가격, URL 등 거의 모든 동적 값.
- `{$variable_name|filter}` — 필터 적용 후 치환.

이 프로젝트에서 사용 중인 필터는 단 두 가지:

- `|display` — `displaynone` 또는 빈 문자열로 치환됨. 클래스 자리에 쓴다.  
  예: `<li class="{$disp_cate_1|display}">` → 카테고리 1이 활성이면 클래스 비워짐, 비활성이면 `displaynone` 클래스 추가됨.
- `|numberformat` — 천단위 콤마. 가격에 사용.

### 자주 등장하는 변수 카테고리 (총 2,328개)

- **상품**: `{$product_name}`, `{$product_price}`, `{$big_img}`, `{$add_img}`, `{$wish_icon}`, `{$mileage}`, …
- **회원**: `{$member_name}`, `{$member_id}`, `{$total_mileage}`, …
- **액션 함수**: `{$action_buy}`, `{$action_basket}`, `{$action_func_login}`, `{$action_nomember_order}`, `{$go_back}`, … — onclick 자리에 들어가는 JS 코드
- **표시 토글**: `{$xxx_display}`, `{$xxx_disp}` — `|display` 필터 짝꿍
- **링크**: `{$link_product_list_1}`, `{$link_product_detail}`, `{$link_basket}`, …
- **이미지**: `{$big_img}`, `{$icon_url}`, `{$shop_logo}`, …
- **카테고리/breadcrumb**: `{$name_1~4}`, `{$disp_cate_1~4}`, …

### 변수 사용 규칙

1. **변수명을 임의로 바꾸지 말 것.** `{$product_price}` → `{$product_total_price}` 같은 추측 금지. 카페24의 변수 사전에 있어야만 치환됨.
2. **변수 자체를 Mock 값으로 대체 금지.** `{$action_buy}` → `alert('buy')` 같은 정적 핸들러로 바꾸지 말 것 — 실제 결제 흐름이 끊김.
3. **`|display` 필터는 클래스 자리에만**. `style="{$xxx|display}"` 같은 사용은 카페24 동작 미정의.
4. **`{$action_*}`가 비어있을 가능성** 있음 — 비회원 구매 비활성, 모듈 비활성 등 어드민 설정에 따라. 클릭 죽으면 어드민 확인.

---

## 7. 런타임 주입

스킨 파일에는 안 보이지만 카페24 서버가 ③ 단계에서 추가하는 것들. 이걸 모르면 CSS가 의도치 않은 자식까지 흘러간다.

### 7.1 `xans-*` 클래스

`module="..."` 요소에 자동으로:
```
<div module="product_detail">
   ↓ 런타임에 ↓
<div module="product_detail" class="xans-element- xans-product xans-product-detail">
```

이름 규칙: `xans-element-` (모든 모듈에 공통) + `xans-{group}` + `xans-{group}-{subtype}`.

| module | 추가 클래스 |
|---|---|
| `product_detail` | `xans-element- xans-product xans-product-detail` |
| `product_image` | `xans-element- xans-product xans-product-image` |
| `product_action` | `xans-element- xans-product xans-product-action` |
| `member_login` | `xans-element- xans-member xans-member-login` |
| `myshop_main` | `xans-element- xans-myshop xans-myshop-main` |
| `Layout_orderBasketcount` | `xans-element- xans-layout xans-layout-orderbasketcount` (소문자!) |

**함정**: 글로벌 셀렉터 `.xans-product { padding-bottom: 80px }`는 product_detail뿐 아니라 product_image, product_action, product_addimage 등 **모든 자식 모듈에 흘러간다**. 항상 `.jg-product-detail-page` 같은 페이지 스코프나 `body.onroad-page`로 좁힐 것.

### 7.2 `displaynone` / `displayblock` 클래스

`{$xxx_display|display}` 결과:
- 조건 true → 빈 문자열 (클래스 추가 안 됨)
- 조건 false → `displaynone` 클래스 추가

`ec-base-*.css`에 `.displaynone { display: none !important }` 정의.

### 7.3 `Layout_statelogoff` 강제 숨김

`module="Layout_statelogoff"` 요소는 **로그인된 상태에서 서버가 자동으로 `displaynone` 클래스 주입**. 비로그인 상태로 Playwright로 보면 보이지만, 실사용자가 로그인된 채 방문하면 사라짐. 헤더 "Sign in / Sign up" 버튼이 비로그인일 때만 보이는 메커니즘.

### 7.4 `fw-filter` / `fw-label` / `fw-msg` 폼 검증 attribute

`<input fw-filter="isFill" fw-label="이메일" fw-msg="">` 같은 속성은 카페24 폼 검증 프레임워크가 사용. 절대 제거하지 말 것 — 회원가입·주문 폼이 검증 안 되어 통째로 깨진다.

### 7.5 `ec-base-chk` 체크박스 이중 구조

카페24 체크박스는 두 가지 패턴이 섞여 있음:

**A. 래퍼 구조 (전체 동의용):**
```html
<span class="ec-base-chk">
  <input type="checkbox" id="sAgreeAllChecked">
  <em class="checkbox"></em>   <!-- 가짜 체크박스 visual -->
</span>
<label for="sAgreeAllChecked">...</label>
```
input은 `opacity:0`로 숨기고 `em.checkbox`를 pseudo-checkbox로 그림. CSS 패턴: `input:checked ~ em.checkbox`.

**B. Raw input + class:**
```html
<input id="agree_service_check0" class="ec-base-chk" type="checkbox">
<label for="agree_service_check0">...</label>
```
input 자체에 `class="ec-base-chk"`. em 래퍼 없음.

함정: `:not(.ec-base-chk input)` descendant selector로 B를 거를 수 없다 (B는 input 자체가 `.ec-base-chk`이므로). 두 패턴 모두 다루려면 `:where(.ec-base-chk, input.ec-base-chk)` 같은 합집합 selector 필요.

JS 함정: 카페24 자체 핸들러(`join_agreement.js` 등)가 click을 가로채 native `:checked` 토글 대신 내부 상태 관리. Playwright `el.click()`이 예측대로 토글되지 않는 경우 있음.

---

## 8. CSS 번들과 캐시

### 8.1 옵티마이저 URL

라이브 페이지의 `<link>` 태그는:
```
https://zenera.kr/ind-script/optimizer.php?filename=<hash>&t=<ts>
https://zenera.kr/ind-script/optimizer_user.php?filename=<hash>&t=<ts>&user=T
```

- `optimizer.php` — 시스템 CSS 번들 (ec-base-*.css 등).
- `optimizer_user.php` — 우리 커스텀 CSS 번들 (onroad.css 등 사용자 추가).
- `t=<ts>`는 마지막 빌드 시각.
- `<hash>`는 어떤 파일들을 합쳤는지의 키.

### 8.2 빌드 트리거

FTP 업로드 후 약 몇 분 안에 카페24가 옵티마이저 번들을 자동 재빌드 (정확한 트리거 시점은 비공개). 우리가 강제 트리거할 수단은 사실상 없다 — 기다리거나, 캐시 버스트.

### 8.3 캐시 레이어들

브라우저는 `?t=` 값이 바뀌면 다시 받는다. 하지만:
- 이전 `t=` 응답이 브라우저 디스크 캐시에 ~1일 남아있을 수 있음.
- HTML 응답이 옛 `t=`를 박아주면 새 빌드 안 받음.

해결:
- 본인 브라우저: `Ctrl+Shift+R` (Cmd-Shift-R) 하드 리로드.
- Playwright 검증: `await page.goto(url + '?_=' + Date.now())` 캐시 버스트.
- 모든 방문자: 라이브 HTML이 새 `t=`를 박아주기를 기다림 (보통 자동).

### 8.4 디렉티브 ↔ 번들 매핑 함정 ⚠️

옵티마이저는 `<!--@css(...)-->` 디렉티브의 **인자 문자열을 키로 그룹핑**한다.

```
<!--@css(/layout/basic/css/onroad.css)-->            ← 키 A
<!--@css(/layout/basic/css/onroad.css?v=1)-->        ← 키 B (다른 파일로 인식)
```

`?v=1`처럼 쿼리를 붙이면 옵티마이저가 별개 파일로 보고 번들 빌드에서 빠진다. 결과: 라이브가 raw HTML로 렌더되고 `optimizer_user.php` 번들에서 `.onroad-page` 룰이 0개로 사라짐.

**카페24가 자동으로 `?t=<timestamp>` 를 응답 HTML에 붙여준다.** 우리가 수동 버전을 박을 필요는 한 번도 없다.

### 8.5 `<head>` vs `<body>` 디렉티브 위치

`layout.html`을 보면:
- `<head>`에 `<!--@css(common.css)-->` ... `<!--@css(ec-base-paginate.css)-->` (시스템 CSS)
- `<body>` 끝에 `<!--@css(sub_style.css)-->` ... `<!--@css(onroad.css)-->`, `<!--@js(onroad-brand.js)-->`

**`onroad.css`가 `layout.html` 마지막에 있는 이유**: cascade 순서상 우리 룰이 후순위 → 동일 specificity면 우리가 이긴다. `<head>`에 옮기지 말 것.

홈은 `main.html`에서, 서브 페이지는 `layout.html`에서, 팝업은 `popup.html`에서 각각 onroad.css를 등록 — 모두 마지막에 위치해야 한다 (이미 그러함).

### 8.6 onroad.css 단일 파일 정책

13,400+ 줄짜리 거대 파일이지만 분리하지 않는다. 이유:
- 파일이 늘어날 때마다 layout.html `@css` 디렉티브 추가 필요 → §16-A 사고 위험 ↑
- 옵티마이저 번들 파일 수 늘어남 → 디버깅 곤란
- 중복 selector 추적은 grep으로 처리

대신 파일 안에서 섹션 주석으로 가독성 유지:
```
/* =================== HEADER =================== */
/* =================== HERO === */
/* =================== PRODUCT DETAIL === */
```

### 8.7 캐시 버스트가 정말 필요할 때

`<!--@css(...)-->` 쿼리가 금지라면 어떻게 강제로 새 번들을 받게 하는가?

답: **할 수 없고, 할 필요도 없다.** 카페24가 자동으로 `?t=<ts>`를 갱신해주므로 새 방문자는 새 번들을 받는다. 본인 브라우저만 캐시 문제면 하드 리로드.

만약 강제로 새 키를 만들어야 하는 극단적 상황이라면 — onroad.css의 **내용**을 바꿔서 새 빌드 트리거. 파일명이나 디렉티브 인자는 절대 변경하지 말 것.

---

## 9. Specificity 패턴

### 9.1 충돌 지점

카페24 기본 스킨이 매우 specific. 우리 커스텀 룰이 자주 진다:
- `#totalPrice em { ... }` — ID selector (1,1,1) 이김
- `.ec-base-button .btnSubmit { ... }` — descendant + 클래스 두 번 (0,2,1)
- 카페24가 inline `style=` 박아주는 경우 — JS로만 이김

### 9.2 우선순위 사다리

| 순위 | 방법 | specificity | 안전도 |
|---|---|---|---|
| 1 | 기존 onroad.css 룰 직접 수정 | 그대로 | 최상 |
| 2 | `body.onroad-page .x` 추가 | (0,2,1) | 상 |
| 3 | `.onroad-page:has(.y) .x` 스코프 | (0,3,1) | 상 — `:has()` 지원 브라우저만 |
| 4 | `#id.class` 같이 ID + class 결합 | (1,n,1) | 상 |
| 5 | `!important` 추가 | cascade 우선 | 중 — 이미 남용된 영역에선 무력 |
| 6 | inline `<style>` 블록 페이지에 직접 | source order 마지막 | 중 |
| 7 | JS `el.style.setProperty('x', 'y', 'important')` | inline + important | 하 — 지저분, 마지막 수단 |

### 9.3 금지 패턴

- **같은 selector를 onroad.css 끝에 또 append**해 source order로 이기려는 시도. 이미 같은 룰이 8798·9086·11571 등 여러 곳에 있어서 어느 게 winner인지 추적 불가. 직접 수정이 정답.
- **`!important` 두 번 이상 같은 declaration에**. 무의미.
- **`html body.onroad-page ...`** 같이 specificity 늘리려 type selector를 쌓는 것 — class 추가가 더 깔끔.

### 9.4 검증

스크린샷만 믿지 말고 computed style 직접 확인:
```js
await page.evaluate(() => getComputedStyle(document.querySelector('.x')).gridArea);
```
또는 `sheet.cssRules` 순회로 매칭 룰 + specificity 직접 출력.

CSS 작성 후 braces 균형 확인:
```bash
node -e "const c=require('fs').readFileSync('cafe24/layout/basic/css/onroad.css','utf8'); console.log((c.match(/\{/g)||[]).length, (c.match(/\}/g)||[]).length)"
```

### 9.5 사례

- `.pf-card__title`이 dark 섹션에서 글자색 못 받음 → `color: var(--c-cream) !important` 명시 추가.
- `#totalPrice em` ID-base 룰이 `.totalPrice em`을 이김 → `#totalPrice.totalPrice em` 결합 selector로 우회.
- `.agreeAll { display: grid !important }` (8798)가 끝에 추가한 `display: flex !important` (11571)를 이김 → 결국 8798 직접 수정.
- `.btnToggle::before { transform: scale(3) }` 투명 오버레이가 클릭 가로챔 → `::before { content: none !important }`로 완전 제거.
- 제품상세 grid: `.detailArea.pd-grid > .imgArea { grid-area: image }`가 카페24 stacked 룰에 짐 → `body.onroad-page .jg-product-detail-page .detailArea.pd-grid > .imgArea { grid-area: image !important }`로 (0,5+,1) 확보.

---

## 10. 헤더 · sticky · fixed 배치

이번 promo bar 사고(§16-D)의 핵심. 헤더 위·아래에 무언가를 띄울 때 반드시 이 레시피.

### 10.1 사실

```css
.onroad-page .site-header {
  position: fixed; top: 0; left: 0; right: 0;
  z-index: 50;
  ...
}
```

- `position: fixed`라 흐름에서 빠짐.
- `#wrap > #container > #contents`는 y=0부터 시작 — 헤더가 그 위를 덮음.
- onroad.css에 **`#wrap` / `body`에 `padding-top` / `margin-top`이 없다** — 헤더 만큼의 빈 공간이 reserve되지 않음.

이게 가능한 이유: 메인·서브 페이지의 첫 섹션(hero, breadcrumb 등)이 보통 dark 배경이고, 헤더는 transparent 시작이라 시각적 겹침이 깔끔하다.

### 10.2 그 위에 무언가를 더 띄울 때

예: 상단 promo strip을 viewport y=0 (헤더보다 위)에 두고 싶다.

**필요한 3가지:**

1. **promo 자체를 fixed**:
   ```css
   .onroad-page .pd-promo {
     position: fixed; top: 0; left: 0; right: 0;
     z-index: 60;        /* 헤더 50보다 위 */
     height: 36px;
   }
   ```

2. **헤더를 promo 높이만큼 아래로**:
   ```css
   .onroad-page:has(.pd-promo) .site-header { top: 36px; }
   ```

3. **`#wrap`에 padding-top 추가** (안 하면 #contents가 promo + 헤더 뒤로 숨음):
   ```css
   .onroad-page:has(.pd-promo) #wrap { padding-top: 36px; }
   ```

`:has()` 스코프 덕에 promo가 있는 페이지에만 적용 — 다른 페이지는 영향 없음. 모바일에선 promo 높이 30px로 줄이고 같은 3개 모두 30px로 맞춤.

### 10.3 그 아래에 sticky 요소를 둘 때

예: 제품상세 우측 도킹 패널 (`.infoArea.is-docked`).

```css
.infoArea.is-docked {
  position: fixed;
  top: 120px;        /* 헤더 72px + 약간의 여유 */
  right: 12vw;
  ...
}
```

JS에서 `is-docked` 토글 조건: `.pd-flow--review` top이 viewport 세로 중앙선 도달.

### 10.4 흔한 함정

- **promo 추가 후 헤더가 promo를 덮음** → §10.2의 (1)만 했고 (2)·(3)을 빠뜨림.
- **`:has()` 미지원 브라우저** → 거의 없지만 IE는 무시. 카페24는 IE는 이미 지원 안 하므로 OK.
- **promo 안에 자식이 promo 높이를 키움** → `height` 박지 않으면 padding+content로 늘어나 (2)·(3) 픽셀이 어긋남. `height: 36px` 명시 + `overflow: hidden` 또는 자식 줄바꿈 방지.

---

## 11. 디자인 번들 브릿징

claude.ai/design 같은 도구로 받은 정적 HTML/CSS 프로토타입을 카페24에 적용할 때.

### 11.1 절대 금지

**디자인 번들의 HTML을 통째로 카페24 페이지에 붙여넣어 module 마크업을 대체하는 것.**

증상:
- 라이브가 디자인 미리보기와 완전히 다르게 보임 (module 구조가 디자인과 충돌)
- 가격·이미지·옵션·장바구니 동작 안 함
- "갈아엎어" 한 번에 1주일 깎인다

### 11.2 올바른 절차

1. **기존 카페24 파일에서 module hook 전부 식별**:
   - `<div module="...">` wrapper
   - `{$variable}` 템플릿
   - `<!--@css|js|import|layout(...)-->` 디렉티브
   - `fw-filter`, `fw-label`, `fw-msg` 폼 attribute
2. **이 hook들을 verbatim 보존.** 위치 옮기기, 새 wrapper로 감싸기, 클래스 추가는 OK. 삭제·이름변경 금지.
3. **디자인 톤은 다음으로만 입힘**:
   - 기존 요소에 wrapper 클래스 추가 (`<div class="pd-grid">`로 `imgArea` + `infoArea`를 감싸기)
   - onroad.css에서 카페24 클래스명을 직접 selector로 (`.imgArea`, `.infoArea`, `.xans-product-image`)
   - module wrapper **바깥**에 데코 형제 요소 추가 (urgency strip, sticky bar, tab nav 등)
4. **정적 디자인 콘텐츠 (가짜 가격, 가짜 카운트다운, mock 상품명) 는 module 출력을 대체 금지.** 빼거나, 데코 오버레이로 처리.
5. **커밋 전 `git diff`로 검증**: 변경 전 파일에 있던 `module="..."`, `{$...}`, `<!--@...-->`가 모두 살아 있는가? 없으면 STOP, 되돌려놓기.

### 11.3 실제 사례

- ✅ myshop dashboard 리빌드 — `module="myshop_asyncbankbook"`, `{$member_name}` 등 모두 보존하면서 `.my-hero` / `.my-grid` 디자인 입힘. 성공.
- ✅ 로그인 2-card 스택 — `module="member_login"` outer 그대로, `{$action_func_login}`, `{$action_nomember_order}`, `{$display_nomember|display}` 모두 보존. 성공.
- ❌ 제품상세 1차 시도 — 디자인 번들의 `pd-grid > pd-media + pd-info`가 `imgArea + infoArea`를 직접 대체. imgArea는 `module="product_image"`라 실제 이미지 안 뜸. revert 후 wrapping 방식으로 재작업.

### 11.4 "갈아엎어" 의미 해석

사용자가 *"갈아엎어" / "전부 다시" / "기존 다 지우고"* 라고 할 때 = **디자인 톤을 갈아엎는다는 뜻이지 module 배관을 갈아엎는 건 아니다.** 작업 시작 전에 보존할 module 목록을 사용자에게 한 번 더 확인하면 사고 0.

---

## 12. `.onroad-page` 네임스페이스

### 12.1 규칙

모든 우리 커스텀 CSS 룰은 `.onroad-page` (또는 `body.onroad-page`) 스코프 아래에 둔다. 이유:
- 카페24 기본 스킨 룰과 충돌 최소화
- 다른 테마(theme02~04)로 전환할 때 우리 스킨만 격리 OFF 가능
- 글로벌 selector 오염 방지

### 12.2 body 클래스 매트릭스

| layout | body class |
|---|---|
| `main.html` (홈) | `theme01 jg-layout onroad-page onroad-home` |
| `layout.html` (서브) | `theme01 en-layout onroad-page` |
| `popup.html` | layout마다 상이 |

### 12.3 페이지별 modifier 클래스

자주 쓰는 페이지 modifier (HTML 페이지 안에서 추가):

- 홈: `onroad-home`
- 제품상세: `onroad-detail` (또는 `onroad-page onroad-detail`)
- 브랜드 스토리: `onroad-company`
- 지구력코어: `onroad-endurance`
- 섭취 가이드: `onroad-intake`
- 성분 과학: `onroad-label` / `onroad-journal`
- 러너 후기: `onroad-runners`
- 가이드: `onroad-guide`
- 회사 정보: `onroad-supply`

페이지 전용 룰은 `body.onroad-page.onroad-detail .pd-grid { ... }` 같이 한 단계 더 좁힘.

### 12.4 새 클래스 추가 시 prefix

- 일반 컴포넌트: `onroad-` (예: `onroad-bubble`, `onroad-parallax`)
- 제품상세 전용: `pd-` (이미 광범위 배포됨 — `pd-grid`, `pd-media`, `pd-info`, `pd-promo`, `pd-urgency`, `pd-flow`)
- 마이페이지 전용: `my-` (`my-hero`, `my-grid`)
- 인증 페이지 전용: `jg-auth-`, `jg-pending-purchase`
- 이미 굳은 컨벤션을 깨지 말 것 — 새 prefix 만들지 말고 기존 컨벤션 따라가기.

---

## 13. FTP ↔ Cafe24 DB 이중 저장

카페24는 스킨을 **두 곳**에 보관:
1. **FTP 파일 시스템** (우리가 업로드하는 곳)
2. **카페24 DB** (어드민 *디자인 편집* / *스마트디자인 편집* 에디터가 읽고 쓰는 곳)

두 저장소는 **부분 동기화**.

### 13.1 위험 시나리오

```
1. FTP로 최신 onroad.css 업로드
2. (어드민 → 디자인 → "디자인 편집" 또는 "스마트디자인 편집" 페이지를 열음)
3. DB의 옛 버전이 에디터에 로드됨
4. 에디터가 자동 저장 또는 사용자가 수동 저장
5. FTP 파일이 DB 옛 버전으로 덮어씌워짐
6. → 방금 올린 수정 사라짐
```

사용자가 *"사이트 둘러보고 오면 수정사항이 되돌아간다"* 보고하면 99% 이 케이스.

### 13.2 예방

- **카페24 어드민의 "디자인 편집" / "스마트디자인 편집" 페이지를 절대 열지 말 것.**
- 실수로 열었으면 **저장 없이 즉시 닫기**.
- 변경사항이 사라졌으면 FTP로 다시 올려야 함.
- 디자인 변경은 100% FTP 흐름으로만.

### 13.3 어드민에서 사람이 해야 할 작업 (스킨 외)

다음은 디자인 편집과 무관하므로 어드민 사용 OK:
- 비회원 구매 허용 ON/OFF (상점관리 → 쇼핑몰 설정)
- 휴대전화 필수 토글
- CPO(개인정보보호책임자) 이름
- 리뷰 쓰기 권한
- 결제 게이트웨이 설정
- 도메인·이메일 설정

---

## 14. 검증 절차

### 14.1 빠른 점검 — curl

라이브 HTML이 우리 마커를 포함하는지:
```bash
curl -sL "https://zenera.kr/product/detail.html?product_no=11" | grep "pd-promo"
```

옵티마이저 번들에 우리 룰이 들어갔는지:
```bash
# 1. 라이브 페이지에서 optimizer_user.php URL 추출
curl -sL "https://zenera.kr/product/detail.html?product_no=11" \
  | grep -oE 'optimizer_user\.php[^"]+' | head -1

# 2. 그 URL을 fetch
curl -sL "https://zenera.kr/ind-script/optimizer_user.php?filename=...&t=...&user=T" \
  | grep -c "onroad-page"
# 0이면 번들에서 누락 — §16-A 사고 의심
```

### 14.2 Playwright 라이브 검증

```js
import { chromium } from '/tmp/node_modules/playwright/index.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
// 캐시 버스트로 새 번들 강제
await page.goto('https://zenera.kr/product/detail.html?product_no=11&_=' + Date.now(), { waitUntil: 'networkidle' });
const data = await page.evaluate(() => ({
  promoTop: getComputedStyle(document.querySelector('.pd-promo'))?.position,
  headerTop: getComputedStyle(document.querySelector('.site-header'))?.top,
  imgArea: getComputedStyle(document.querySelector('.imgArea'))?.gridArea,
}));
console.log(data);
```

### 14.3 로컬 변경 미리보기

**카페24 파일은 로컬 정적 서버로 미리보기 불가** (`{$변수}`, `<!--@import-->`가 안 풀림).

대안:
- `project/` 디자인 샌드박스에서 디자인 검증 (`python3 -m http.server 8765`)
- Playwright로 라이브 + `addStyleTag(content)` 로 로컬 onroad.css 주입 → CSS 변경만 미리보기
- HTML 변경은 `page.evaluate(() => { ... DOM mutation ... })` 로 시뮬레이션

### 14.4 컴퓨티드 스타일 vs 스크린샷

Specificity 충돌이 의심되면 항상 computed style을 직접 측정. 스크린샷만으로는 어떤 룰이 winner인지 알 수 없다.

```js
const winner = await page.evaluate(() => {
  const el = document.querySelector('.detailArea.pd-grid');
  const cs = getComputedStyle(el);
  return {
    display: cs.display,
    gridTemplateColumns: cs.gridTemplateColumns,
    gridTemplateAreas: cs.gridTemplateAreas,
  };
});
```

### 14.5 로그인 필요 페이지

`/myshop/*`, `/member/modify.html`, `/member/check_password.html` 등은 비로그인 시 `/member/login.html?returnUrl=...` 로 리다이렉트. Playwright headless에서 로그인 유지 어려움.

대안: 사용자가 로그인된 실 브라우저로 스크린샷 떠서 보내주기. 또는 페이지 구조만 정적 분석.

---

## 15. 체크리스트

### 15.1 코드 변경 **전**

- [ ] 변경할 파일이 §3의 ✅ 안전 영역 또는 ⚠️ module 보존 영역인가? 🚫면 STOP.
- [ ] `module="..."`, `{$...}`, `<!--@...-->` 의 위치를 다 식별했는가?
- [ ] 디자인 번들에서 가져오는 거라면 §11.2의 5단계를 따를 수 있는가?
- [ ] 변경이 시각적이라면 1 commit = 1 visual element 원칙을 지킬 수 있는가?
- [ ] CSS면 onroad.css 직접 수정인가? (append 금지)
- [ ] specificity 충돌이 예상되면 §9.2의 사다리에서 적정 단계를 골랐는가?
- [ ] fixed/sticky 추가라면 §10의 3가지 (자체 fixed + 헤더 offset + #wrap padding)를 모두 다뤘는가?

### 15.2 코드 변경 **후 (커밋 전)**

- [ ] `git diff`로 `module="..."`, `{$...}`, `<!--@...-->` 가 모두 보존되었는지 확인
- [ ] CSS면 braces 균형 OK (`node -e "..."` 카운트)
- [ ] `<!--@css(...)-->` 디렉티브에 쿼리 스트링 없는지 grep
  ```bash
  grep -rE '<!--@css\([^)]*\?' /home/videodrake/homepage/cafe24
  # 출력 있으면 STOP
  ```
- [ ] `<!--@layout(...)-->` 첫 줄 위치 보존
- [ ] FTP 가이드 docx에 명시된 금지 변경 (카트 카운트 스크립트 제거 등) 안 했는지
- [ ] 커밋 메시지에 "왜" 1줄 — what이 아닌 why

### 15.3 FTP 업로드 **후**

- [ ] `curl`로 라이브 HTML이 우리 마커 포함하는지
- [ ] `curl`로 optimizer_user.php 번들에 우리 룰 들어갔는지 (스타일 안 나오면 §16-A 의심)
- [ ] 본인 브라우저 하드 리로드 (`Ctrl+Shift+R`)
- [ ] Playwright 캐시 버스트로 1440·1024·390 viewport 스폿체크
- [ ] 가격·이미지·장바구니·옵션 클릭 등 **module 동작 회귀 테스트**
- [ ] 로그인 필요 페이지는 사용자에게 실 브라우저 확인 요청

### 15.4 사용자가 "안 바뀜" 보고할 때 디버깅 순서

1. FTP 업로드를 실제로 했는가? (가장 흔한 원인)
2. `curl ... | grep "<우리 마커>"` — HTML에 마커 있는가? 없으면 FTP 안 올라간 것.
3. optimizer_user.php 번들에 룰 있는가? 없으면:
   - `<!--@css(...)-->` 쿼리 스트링 사고? → grep으로 확인 + 제거
   - 카페24 빌드 트리거 늦음? → 5~10분 대기
   - 어드민 디자인 편집으로 덮어씌움? → §13
4. 브라우저 캐시? → 본인 하드 리로드 + Playwright `?_=<ts>` 검증
5. specificity 졌나? → computed style 직접 측정, §9.2 사다리 위로

---

## 16. 사고 사례 백서

### 16-A. `<!--@css(...)-->` 쿼리 스트링 사고 (2026-04-27)

- **증상**: zenera.kr 모든 서브 페이지(login/detail/myshop/agreement/shopinfo)가 raw 스타일링으로 렌더. 헤더·하이로 톤·도킹 패널 다 사라짐. 약 반나절.
- **원인**: 캐시 버스트 의도로 `layout.html`에 `<!--@css(/layout/basic/css/onroad.css?v=20260425-buyfix2)-->` 박음. 옵티마이저가 키 다르게 잡아 onroad.css가 번들에서 통째 누락.
- **확인**: `curl optimizer_user.php... | grep onroad-page` → 0개.
- **수정**: 1글자 fix — `?v=...` 제거. 단일 commit `e4d52e7`. FTP 업로드 후 ~몇 분 만에 복구.
- **교훈**: 카페24가 자동으로 `?t=<ts>` 붙여주므로 수동 버전 절대 박지 말 것. 캐시 버스트가 진짜 필요하면 onroad.css 내용을 바꿔서 새 빌드 트리거.

### 16-B. 디자인 번들 통째 적용 사고 (2026-04-27)

- **증상**: 제품상세 라이브가 디자인 미리보기와 완전 다르게 보임. 가격·옵션·이미지 안 뜸.
- **원인**: 디자인 번들의 `pd-grid > pd-media + pd-info`로 카페24 `imgArea + infoArea`를 통째 대체. imgArea는 `module="product_image"`라 안에 들어있던 cafe24 마크업 사라짐 → 이미지 데이터 끊김.
- **수정**: `git revert`. 다음 시도부터 outer wrapper + CSS 패턴 (§11.2).
- **교훈**: "갈아엎어"는 디자인 톤이지 module 배관이 아니다. 작업 전 보존할 module 목록 확인.

### 16-C. 스택 커밋 → 어디가 깨졌는지 분리 불가 (2026-04-27)

- **증상**: 제품상세에 promo + urgency + tabs + sticky 4개를 한 commit (f0e906e)에 묶어 추가. 라이브 보니 그리드 배치가 swap (image 우측, info 좌측). 무엇 때문인지 분리 불가.
- **원인**: `grid-template-areas`가 카페24 stacked 룰에 specificity 패배. 게다가 4개 추가가 한 커밋이라 어떤 게 트리거인지 알 수 없었음.
- **수정**: `git revert f0e906e` → 안전 상태로 복귀 후 1개씩 atomic하게 재시도.
- **교훈**: 1 commit = 1 visual element. 깨졌을 때 분리 가능한 단위로.

### 16-D. promo 바가 헤더 뒤에 숨음 (2026-04-25, 이번 사고)

- **증상**: 사용자가 "맨위 상단바가 사라졌다, 제품 이미지 위 타이머도 사라졌다" 보고.
- **원인 (promo)**: `.pd-promo`를 `position: relative; z-index: 1`로 넣어 #contents 첫 요소 자리에 놓음. 그러나 `.site-header`는 `position: fixed; top: 0; z-index: 50` → 헤더가 promo 위를 덮어 헤더 로고/네비가 promo 위에 그려지고 promo는 시각적으로 사라진 듯 보임.
- **원인 (urgency)**: 마크업·CSS는 정상이었으나 캐시·관찰 타이밍 문제로 보고 시점에 안 보였을 가능성.
- **수정**: §10.2 레시피 — `.pd-promo`를 `position: fixed; top: 0; z-index: 60`, `:has(.pd-promo)`로 `.site-header { top: 36px }`, `#wrap { padding-top: 36px }`. 모바일 30px. 단일 commit `b0f37c9`.
- **교훈**: §10에 "헤더 위에 무언가 띄울 때 3종 세트" 규칙으로 명문화.

### 16-E. agreeAll specificity 패배 (2026-04-24)

- **증상**: agreement 페이지 "전체 동의" 박스 layout이 디자인대로 안 됨.
- **원인**: onroad.css 8798라인 `.agreeAll { display: grid !important }`가 11571라인 끝에 추가한 `display: flex !important`를 이김. Specificity 동일이라 source order로 가야 하는데 — `addStyleTag`로 9000+ 줄 주입 시 일부 파싱 실패 가능성 의심.
- **수정**: 8798라인 직접 수정. append 시도 포기.
- **교훈**: 같은 selector를 끝에 또 박지 말 것. 직접 수정이 정답.

### 16-F. 비회원 구매 ghost click (2026-04-23)

- **증상**: 제품상세 "비회원 구매" 버튼 클릭해도 아무 일 없음.
- **원인**: `<a onclick="{$action_nomember_order}">` 가 어드민 "비회원 구매 허용 OFF" 상태에서 `<a onclick="">` 로 렌더 → 죽은 클릭.
- **수정**: `onroad-brand.js`에 fallback 핸들러 추가 — onclick 비어있으면 `/order/basket.html` 라우팅. 근본 해결: 어드민에서 비회원 구매 허용 ON.
- **교훈**: `{$action_*}` 변수가 어드민 설정에 따라 비어있을 수 있음. fallback 핸들러 권장.

### 16-G. quantity stepper 카페24 ::before 가로막대 (2026-04-23)

- **증상**: 수량 +/− 버튼에 가로·세로 막대가 겹쳐 보임.
- **원인**: 카페24 base CSS가 `.btnAmountUp::before` / `::after`를 absolute positioned glyph로 그림. 우리 디자인 + 카페24 glyph 둘 다 보임.
- **수정**: `.btnAmountUp::before { content: none !important }` 등으로 카페24 glyph 완전 제거.
- **교훈**: 카페24가 `::before`/`::after`로 아이콘 그리는 곳 다수. content + position + background + width + height 모두 리셋해야 깔끔.

---

## 17. 강제 구조와 디자인 제약

> **이 섹션의 목적**: "어떤 룰을 어겨선 안 되는가"가 아니라, **카페24가 우리 의지와 무관하게 박아두는 구조와 그 구조 때문에 디자인이 어떤 식으로 묶이는가**를 평가한다. 디자인은 항상 이 틀 **안에서** 한다 — 틀 자체를 바꾸려 하면 시스템이 깨진다.
>
> 항목별 형식: **(C) 강제되는 것 → (R) 결과 / 디자인 제약 → (M) 우리가 할 수 있는 대응.**

### 17.1 DOM — `#wrap > #container > #contents` 3단 nesting

- **(C)**: layout.html이 `<body>` 안에 `<div id="wrap"> <div id="container"> <div id="contents"> <!--@contents--> </div></div></div>` 강제. 자식 페이지는 `<!--@contents-->` 위치에만 들어감.
- **(R)**:
  - 페이지 전체를 viewport에 100vw로 꺼내려면 `width: 100vw; margin-left: calc(50% - 50vw)` 같은 full-bleed 트릭 필수. `#contents`의 max-width 제약을 정공으로 못 뺀다.
  - 페이지의 "최상위 요소"는 우리 게 아님. `#contents` 위에 무언가 박을 수 없음 — promo bar 같은 fixed 요소는 viewport 레이어로만 가능 (§10).
- **(M)**: full-bleed CSS 트릭 + `#contents` overflow 풀어주기 (`body.onroad-page #contents { overflow: visible }`는 onroad.css 70줄에 박혀있음).

### 17.2 layout.html이 `<body>`에 자동 박는 시스템 element들

다음은 layout.html이 모든 서브 페이지에 강제로 박는다 (지우면 결제·접근성·다국어 깨짐):

- `#skipNavigation` — 접근성 스킵 링크
- `#progressPaybar` (display:none 시작) — 결제 진행 모달
- `#layoutDimmed`, `.layer_shadow` — 모달 백드롭
- `<div module="Layout_multishopShipping">` — 다국어/배송 셀렉터 (`.ec-base-layer.typeModal`)
- `<!--ez-favicon[--> ... <!--ez-favicon]-->` — favicon 자동 관리 블록

- **(R)**: 우리 디자인이 `<body>` 직속 자식을 control 못 함. 풀스크린 오버레이를 만들 때 z-index 50 이상 + 카페24 모달과 겹치지 않게 z-index 매니지 필수. 카페24 결제 모달은 z-index 999+.
- **(M)**: 우리 z-index 룰을 50~100 사이로 잡고, 결제·다국어 모달이 뜨면 그 위에 박힘 (정상). `#progressPaybar` 같은 시스템 요소는 `display: none` 유지하지만 절대 DOM에서 지우지 말 것.

### 17.3 `<!--@contents-->` 직전 자동 삽입 — `.RTMB` 모바일 뒤로가기

layout.html이 `#contents` 첫 자식으로 강제 삽입:
```html
<span module="Layout_MobileAction" class="RTMB">
    <a href="#none" onclick="{$go_back}"><!--@import(/svg/icon-go-back.html)-->뒤로가기</a>
</span>
```

- **(C)**: 모든 서브 페이지의 `#contents` 첫 자식은 우리 게 아님 — 이 모바일 전용 뒤로가기 버튼.
- **(R)**: 페이지 첫 디자인 요소(eyebrow, hero, breadcrumb)가 `.RTMB` 다음에 옴. 모바일 ≤720px에서 `.RTMB`가 보이고 PC에서는 카페24 CSS가 숨김.
- **(M)**: `:nth-child(1)` 같은 selector 사용하지 말 것 (`.RTMB`가 1번이라 의도가 안 맞음). `:first-of-type` 또는 `.RTMB + *` 같은 형제 selector로 우회.

### 17.4 module 자식 마크업 카페24 자동 채움

`module="..."`은 outer는 우리가 박지만 일부 모듈은 **자식까지 서버가 채운다**:

| 모듈 | 자식이 누가 채우나 |
|---|---|
| `product_addimage` | 카페24 — `<ul class="list">` 안 `<li>`들 |
| `product_review` / `product_qna` | 카페24 — 리뷰 카드 / Q&A 행 |
| `product_listnormal` 등 리스트 | 카페24 — 상품 카드들 |
| `Layout_orderBasketcount` | 우리 — `<span class="count">{$basket_count}</span>` |
| `member_login` | 우리 — input 필드들 (자식 양식은 우리 책임) |
| `product_detail` | 우리 — outer만 모듈, 자식 영역들은 별도 module로 또 marking |

- **(C)**: outer 안에서 grid 자유 배치는 자식이 카페24가 채우는 모듈에선 불가능. 자식 element 개수·태그·클래스 모름.
- **(R)**:
  - `product_addimage` 안에 grid를 박으려면 `module="product_addimage"`의 outer/wrapper에 grid를 넣고, 자식 `<ul>`은 `display: contents` 또는 wrapper-aware grid로 처리.
  - 리뷰 카드 디자인 변경하려면 카페24가 박는 자식 클래스(`.review-card`, `.txc-textbox` 등)를 selector 삼아 CSS만 입힘.
- **(M)**: outer에 클래스 추가 → CSS만으로 자식 스타일링. 자식 마크업은 절대 손대지 말 것.

### 17.5 `<body class>`와 EZ 시스템 강제

- **(C)**: `<body class="theme01 ...">`는 EZ 디자인 시스템(`<ez-prop>`)이 박는다. 어드민에서 사용자가 theme02~04로 전환 가능 — 그러면 body class가 `theme02`로 바뀜.
- **(R)**:
  - 우리 onroad.css는 `theme01`이 default라는 가정으로 작성. 사용자가 theme 변경하면 일부 룰 못 먹을 가능성.
  - `<ez-prop data-version="1.0.0">` 안에 4개 테마 정의 (theme01~04). theme02~04는 빈 껍데기 — 사용자가 어드민에서 선택해도 시각 차이 거의 없음.
- **(M)**: 모든 onroad 룰은 `.onroad-page` 스코프(`theme01`과 무관)로 작성. 만약 `theme01` 의존 셀렉터가 있다면 명시 — 단 그런 selector는 현재 0개.

### 17.6 favicon 시스템 강제

- **(C)**: `<!--ez-favicon[-->` `<!--ez-favicon]-->` 마커 사이의 `<link>` / `<meta>` 태그 11개를 EZ 시스템이 자동 관리.
- **(R)**: favicon 변경하려면 어드민에서. 우리가 layout.html 직접 수정하면 다음 EZ 갱신 때 덮어씌워짐.
- **(M)**: 손대지 말 것. 사용자가 favicon 변경 원하면 어드민 가이드.

### 17.7 카페24 시스템 JS — basic.js / layout.js / popup.js / common.js / 모듈 JS

- **(C)**:
  - `basic.js` — DOM 헬퍼 (`hasClass`, `toggleClassAll`, …)
  - `layout.js` — 헤더·내비·검색 토글, sticky 동작
  - `popup.js` — `.ec-base-layer` 모달 open/close
  - `common.js` — `winPop`, `getQueryString`, `globalBuyBtnScrollFunc` 등 글로벌 함수
  - 모듈별 JS — `product_image.js`, `product_quantity.js`, `member_login.js` 등이 click handler 가로챔
- **(R)**:
  - 우리 `onroad-brand.js`가 같은 element에 click listener 등록하면 카페24 핸들러와 충돌 가능. 특히 폼 제출, 체크박스 토글, 옵션 셀렉터는 카페24 로직이 dominant.
  - Playwright `el.click()`이 예측대로 토글 안 되는 경우 = 카페24 자체 핸들러가 native 토글 막고 내부 상태 관리 (예: `join_agreement.js`).
- **(M)**:
  - 가능한 시각 변경만 onroad-brand.js로. 동작 변경은 카페24 모듈 JS와 협조.
  - click 가로채기 필요하면 capturing phase 등록 (`el.addEventListener('click', fn, true)`) — 단, 카페24 동작 깨지지 않게 우선순위 조심.
  - `{$action_*}` 표현식은 onclick에 그대로 두고, 우리는 같은 element의 별도 listener로 보조.

### 17.8 jQuery 글로벌 의존

- **(C)**: `basic.js`가 jQuery 기반(추정). `$` 글로벌 노출. `swiper-bundle.min.js`도 layout.html에 박혀 swiper API 글로벌.
- **(R)**: 우리 vanilla JS에서 `$` 변수를 selector 의미로 만들면 jQuery와 충돌. swiper 인스턴스 충돌도 가능 (우리가 swiper init 별도로 하면 카페24 인스턴스와 섞임).
- **(M)**: vanilla 사용 시 `$`, `jQuery`, `Swiper` 같은 이름 redeclare 금지. 우리 IIFE 안에서만 변수 선언.

### 17.9 CSS 시스템 강제 — `ec-base-*.css` + ID 셀렉터

- **(C)**:
  - `ec-base-button.css`, `ec-base-table.css` 등 13개 `ec-base-*.css`가 매우 specific한 룰들.
  - `#totalPrice em`, `#header`, `#container` 같은 ID 셀렉터들이 cascade 상위.
  - 카페24가 `<input style="...">` 같이 inline style 박는 곳도 있음 (특히 폼).
- **(R)**:
  - 우리 class-base 룰이 자주 짐. 결과: `!important` 남용.
  - 13,400 줄 onroad.css 안에서도 같은 selector 중복 정의 (8798·9086·11571 등) — append로 winner 못 정함.
- **(M)**: §9 specificity 사다리. 1순위는 항상 기존 룰 직접 수정.

### 17.10 모달·팝업 — `.ec-base-layer` + `popup.html` 강제

- **(C)**:
  - 수령인 변경, 주소 검색, 환불 신청, 정기배송 수정, 옵션 가이드 같은 거의 모든 모달은 `<!--@layout(/layout/basic/popup.html)-->` + `.ec-base-layer` 래퍼 사용.
  - popup.html은 `<head>`에 `ec-base-layer.css` 박음 → 모달 기본 톤 강제.
- **(R)**:
  - 모달 디자인을 페이지 본문과 통일하려면 `.ec-base-layer .header / .content / .ec-base-button` 셀렉터를 onroad.css에서 별도 override.
  - 모달은 별도 `<iframe>` 또는 새 창인 경우도 있음 — 그땐 onroad.css 적용 안 됨.
- **(M)**: 자주 보이는 모달은 onroad.css에서 `.ec-base-layer.onroad-modal { ... }` 같이 명시 override. 자세한 룰은 페이지에 클래스 추가해서 selector 좁힘.

### 17.11 `Layout_statelogoff` / `Layout_statelogon` 자동 토글

- **(C)**: 헤더의 "Sign in / Sign up" 버튼은 `module="Layout_statelogoff"`. 로그인 상태에서 카페24가 `displaynone` 클래스 자동 주입 → 비로그인일 때만 표시.
- **(R)**:
  - 비로그인용 헤더 디자인과 로그인용 헤더 디자인이 시각적으로 달라짐 (Sign in/up 버튼 자리가 비거나 다른 요소로 채워야 함).
  - Playwright headless = 비로그인 → Sign in/up 항상 보임. 로그인 사용자가 보는 화면과 다름.
- **(M)**: 헤더 좌·우 균형이 두 상태에서 모두 깨지지 않게 디자인. 로그인 시 빈 자리는 대신 `module="Layout_statelogon"`으로 마이페이지 단축 link 노출 (이미 `/myshop/index.html` icon이 그 역할).

### 17.12 URL 라우팅 강제 — 카페24 URL 패턴

- **(C)**: `/product/detail.html?product_no=11`, `/board/.../list.html?board_no=N`, `/myshop/index.html` 같은 URL만 카페24가 인식. URL rewrite, SPA, hash 라우팅 불가능 (카페24 PHP가 page resolve).
- **(R)**:
  - URL 구조 못 바꿈. "예쁜 URL" (`/products/endurance-core`) 같은 변경 불가.
  - 페이지간 이동은 항상 full reload.
- **(M)**: 디자인 톤은 페이지간 일관성으로 (서버 사이드 페이지 전환의 끊김을 시각 통일로 가림). pre-load hint (`<link rel="prefetch">`)는 layout.html에 추가 가능.

### 17.13 비로그인 보호 페이지 자동 redirect

- **(C)**: `/myshop/*`, `/member/modify.html`, `/member/check_password.html`, `/order/basket.html` (옵션) 등은 비로그인 시 카페24가 `/member/login.html?returnUrl=...` 로 자동 302.
- **(R)**:
  - Playwright headless 환경에서 로그인 유지 어려움 → 자동 회귀 테스트 불가능 페이지 다수.
  - 로컬 개발 시 라이브 정확히 재현 못함.
- **(M)**:
  - 로그인 필요 페이지는 정적 분석 + 사용자 실 브라우저 스크린샷 의존.
  - sessionStorage 같은 가벼운 client state 활용 (purchase intent 캡처 등).

### 17.14 이미지 호스팅 강제

- **(C)**:
  - 상품 이미지: `https://ecimg.cafe24img.com/pg2799b36297089020/zenera91/web/product/...` 카페24 CDN.
  - 콘텐츠 에디터 업로드: `https://ecimg.cafe24img.com/.../web/upload/NNEditor/...`
  - 우리 정적 자산: `/SkinImg/img/`
- **(R)**:
  - 상품 이미지 URL 우리가 못 박음. `{$big_img}`, `{$add_img}`, `{$icon_url}` 변수가 카페24 CDN URL을 채워줌.
  - 우리 디자인용 이미지(hero 배경, 패턴 등)는 `/SkinImg/img/`에 업로드 → `<img src="/SkinImg/img/jg_hero_pc.jpg">`.
  - `/SkinImg/img/`에 파일이 없으면 404 — 사용자 FTP 업로드 의존.
- **(M)**:
  - 디자인용 정적 자산은 `/SkinImg/img/` 명명 컨벤션 따라 (`jg_*.jpg/.png/.svg`).
  - 상품 이미지는 lazy load + fallback `<img loading="lazy">` 사용.

### 17.15 viewport / meta 강제

- **(C)**:
  - `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, minimum-scale=1.0, user-scalable=yes">` — 핀치 줌 허용 (max 2배).
  - `<meta http-equiv="X-UA-Compatible" content="IE=edge">` — IE 지원 모드 (사실상 최신 Edge).
  - Cache-Control: no-cache, Expires: 0 — PG (결제 게이트웨이) 호환용 강제.
- **(R)**:
  - 핀치 줌 가능 → 작은 글씨를 사용자가 줌으로 본다. 그래도 디자인 시 기본 가독 14px 이상 권장.
  - PG 캐시 헤더로 일부 페이지가 캐시 안 됨 (의도) → 다른 캐시 전략 무의미.
- **(M)**: 글자 크기 12px 이하는 `mono` 메타 텍스트에만. UI 글자는 14px+ 권장.

### 17.16 cache + build 지연

- **(C)**:
  - 옵티마이저 빌드: FTP 업로드 후 ~몇 분 (정확한 트리거 비공개). 강제 트리거 수단 없음.
  - 브라우저 캐시 ~1일.
- **(R)**:
  - 변경 후 즉시 라이브 검증 불가. "왜 안 바뀌었지?" 5분 후 다시 보기.
  - 사용자 신고 시 캐시인지 사고인지 판별 시간 듦.
- **(M)**: §15.4 디버깅 순서. 본인 하드 리로드 + Playwright 캐시 버스트로 자기 확신부터.

### 17.17 어드민 설정 강제 — 우리가 못 보는 토글들

- **(C)**: 카페24 어드민(상점관리, 회원관리, 상품관리, 주문관리)에 다음과 같은 토글이 디자인과 무관하게 동작에 영향:
  - 비회원 구매 허용 ON/OFF → `{$action_nomember_order}` 비어버릴 수 있음
  - 회원가입 필수 항목 (휴대폰, 이메일, 주소 등) → join.html 필드 동작에 영향
  - 리뷰 쓰기 권한 (구매자 only / 누구나) → `module="product_review"` 결과에 영향
  - 결제 게이트웨이 / PG사 → `order/`에 영향
  - CPO 이름, 사업자번호, 고객센터 등 → footer에 자동 채움
  - 다국어 활성 → `Layout_multishopShipping` 노출 여부
- **(R)**:
  - 디자인 검증 시점에 어드민 설정 모르면 "왜 클릭이 죽지?" 같은 ghost issue.
  - 디자인 의존 (예: 비회원 구매 인센티브 카드)이 어드민 OFF면 무의미.
- **(M)**:
  - `{$action_*}` 변수 사용 시 빈 값 fallback 핸들러 권장 (onroad-brand.js에서 비회원 구매에 이미 적용).
  - 디자인 시작 전 사용자에게 "이 어드민 토글이 ON인가?" 확인.

### 17.18 다국어 / 멀티쇼핑 강제 마크업

- **(C)**: layout.html `<body>` 끝에 `<div module="Layout_multishopShipping"> ... </div>` 강제 박힘. 어드민에서 다국어 활성 시 노출.
- **(R)**: 사용 안 하는 우리 (한국어 only) 같은 쇼핑몰에선 시각적으론 안 보이지만 DOM에 항상 있음. 의도치 않은 selector 매칭 가능.
- **(M)**: `body.onroad-page > #wrap > [module="Layout_multishopShipping"]` 같이 정확한 path로 selector 작성. 글로벌 `[module]` selector 같은 와일드카드 금지.

### 17.19 표준 컴포넌트 강제 — `ec-base-fold` accordion 등

- **(C)**: 안내·약관·FAQ 같은 토글 영역은 카페24 표준 `ec-base-fold` accordion 사용. JS는 `ec-base-fold.js`가 click 처리.
- **(R)**:
  - 디자인 톤은 자유롭게 override 가능 (`.ec-base-fold .head`, `.body` selector 직접 스타일).
  - 동작 (열림·닫힘 transition, multi-open 여부 등)은 시스템 따라야 함.
- **(M)**:
  - 시각만 입히고 동작은 시스템 사용. 동작 커스터마이즈 필요하면 `ec-base-fold` 안 쓰고 `<details>` 같은 native 사용 (단 카페24 다른 영역과 톤 분리됨).

### 17.20 `<title>` / `<meta description>` 카페24 자동 덮음 가능성

- **(C)**: `layout.html` `<head>`에 우리가 박은 `<title>온로드 | 지구력코어</title>`이 있지만, 카페24 어드민의 SEO 설정이 페이지별로 이 값을 덮을 수 있음 (확인 필요).
- **(R)**:
  - 페이지별 title/description 변경은 어드민 SEO 메뉴에서 — 우리가 layout.html에서 제어 못 할 수 있음.
- **(M)**:
  - 페이지별 SEO 변경은 어드민에서 사용자에게 요청.
  - 디폴트 title/description은 우리가 layout.html에 (현 상태).

### 17.21 종합 — 디자인의 "허용 면적"

위 강제 구조를 종합하면 우리 디자인 자유도는 다음과 같이 정리됨:

| 영역 | 자유도 |
|---|---|
| 페이지간 일관 톤 (컬러, 타이포, 스페이싱, 모션) | **높음** — onroad.css가 cascade 상위, `.onroad-page` 네임스페이스로 보장 |
| 페이지 레이아웃 (섹션 배치, 그리드, full-bleed) | **중** — `#contents` 안에서만 가능, full-bleed는 트릭 필요 |
| 컴포넌트 외양 (버튼, 카드, 입력 폼) | **중** — `ec-base-*` 룰 override + `!important` 사다리 |
| 모듈 outer 디자인 (제품 이미지 영역, 구매 패널) | **중** — outer wrapping + CSS만 가능 |
| 모듈 자식 마크업 (리뷰 카드 내부, 추가 이미지 li) | **낮음** — CSS만 가능, 마크업 변경 불가 |
| 동작 (클릭 핸들러, 폼 검증, 모달 동작) | **매우 낮음** — 카페24 시스템 따라야 함 |
| URL / 라우팅 / 페이지 전환 | **0** — 카페24 PHP 라우터 강제 |
| 결제 / 주문 흐름 | **0** — `order/` 시스템 영역 |
| 회원 / 인증 흐름 | **낮음** — 디자인 표면만 (login/join/agreement HTML) |
| 카트 / 위시 / 마일리지 데이터 표시 | **중** — 변수만 보존하면 디자인 자유 |

### 17.22 디자인 시작 전 5초 체크

새 페이지/섹션을 디자인하기 전에 다음 5개를 확인:

1. 이 페이지에 박혀있는 `module="..."` 와 `{$변수}` 목록은? (grep으로 추출)
2. 자식 마크업이 카페24 자동 채움 영역인가? (자유 디자인 vs CSS-only)
3. 비로그인/로그인 두 상태에서 화면이 어떻게 다른가? (`Layout_statelogoff`)
4. 모달이라면 `.ec-base-layer` 사용? `popup.html` layout?
5. 어드민 토글에 의존하는 동작인가? (비회원 구매, 리뷰 권한 등)

이 5개에 답하면 작업 자유도가 보임 → 디자인 범위 결정.

---

## 18. JS 런타임 해체분석

> **이 섹션의 가치**: 우리 onroad-brand.js가 실행될 때 이미 어떤 카페24 핸들러가 같은 element에 등록되어 있는지, 또 우리 CSS와 카페24 JS가 어떻게 충돌하는지 파악. 1차 문서의 §17.7은 추상적이었고 정확하지 않은 부분이 있었음.

### 18.1 페이지가 로드되면 실행되는 카페24 JS 인벤토리

**`layout.html` `<head>` / `<body>`에서 자동 등록 (이 순서로):**

| 파일 | 줄수 | 역할 |
|---|---|---|
| `swiper-bundle.min.js` | 12 | Swiper 라이브러리 글로벌 등록 (`Swiper`) |
| `js/module/product/sale_price.js` | — | 할인가 표시 모듈 |
| `layout/basic/js/basic.js` | 88 | DOM 헬퍼 + `.eTooltip`, `.eToggle div` 핸들러 |
| `layout/basic/js/layout.js` | 524 | 헤더 sticky · 검색 오버레이 · slide aside · 카테고리 · MutationObserver · jQuery 의존 · 쿠키 |
| `js/common.js` | 69 | `winPop`, `getQueryString`, `globalBuyBtnScrollFunc` |
| `ez/init.js` | 177 | EZST 컴포넌트 lifecycle, `ez-view-type-mobile` 클래스 토글 |
| `layout/basic/js/onroad-brand.js` | 274 | **우리 커스텀** (이게 마지막 — 위 것들 다 끝나고 init) |

**`main.html` 추가 등록:**
- `layout/basic/js/main.js` (132줄) — 홈 swiper, 탭 카테고리, EZST.register('image-gallery/2', …)

**팝업 (`popup.html`)에서:**
- `layout/basic/js/popup.js` (48줄) — `setResizePopup()` (window.resizeBy로 팝업 크기 자동 조정), `detectMobileDevice()`

**`/layout/basic/js/common.js`** — 256줄. 이건 layout.html에서 **import 안 됨** (이름 충돌, /js/common.js만 등록됨). 대신 일부 페이지가 직접 또는 모듈 JS가 끌어다 쓸 가능성. 실제 라이브에서 영향은 grep 추가 필요.

**모듈 JS (`/js/module/<area>/*.js`)** — 카페24가 자동으로 페이지에 필요한 만큼 로드. 우리가 직접 등록 안 함.

### 18.2 글로벌로 노출되는 함수·객체

페이지 어디서나 호출 가능하므로 우리 JS가 같은 이름 쓰면 충돌:

- **jQuery / `$`** — basic.js·layout.js·common.js 모두 jQuery 기반. jQuery 글로벌 노출.
- **`Swiper`** — swiper 인스턴스 생성자.
- **`EZST`** — EZ 시스템 (init.js + main.html `<script>`에서 `window.EZST = {q:[],register}` 박음).
- **`hasClass(el, name)`**, **`toggleClassAll(...)`**, **`findElements(...)`**, **`setAttributeAll(...)`** — basic.js 글로벌 함수.
- **`fixedHeader()`**, **`bottomNav()`**, **`bottomScroll()`**, **`searchLayer()`**, **`handleNav()`**, **`handleDimmed()`**, **`getOffset()`**, **`getQuickPosition()`**, **`getMainQuickPosition()`**, **`getSubQuickPosition()`**, **`setQuickScrollEvent()`**, **`quickGoTop()`**, **`topBanner()`**, **`getCurrentScrollPercentage()`** — layout.js 글로벌.
- **`setCookiem()`**, **`getCookiem()`**, **`delCookiem()`** — layout.js 쿠키 헬퍼 (jQuery 기반).
- **`top_category()`**, **`observeTopCategory()`**, **`ifmore()`** — layout.js 글로벌.
- **`winPop()`**, **`getQueryString()`**, **`globalBuyBtnScrollFunc()`** — js/common.js 글로벌.
- **`window.call_eTab`** — 페이지가 정의하면 common.js가 호출 (extension point).
- **`detectMobileDevice()`** — popup.js 글로벌.
- **`aCategory`** — slide_menu.js가 박는 글로벌 배열 (카테고리 트리).

**우리 onroad-brand.js 작성 시 금지 이름**: 위 모두. 우리는 IIFE 안에 변수 선언, 외부에 아무것도 박지 말 것.

### 18.3 layout.js × 우리 CSS 충돌 — `fixedHeader()` 함정 ⚠️

이건 1차 문서가 빠뜨린 매우 중요한 충돌.

**layout.js:48–58** (`fixedHeader()`):
```js
function fixedHeader() {
    var header = document.getElementById("header");
    var fixed_margin = document.getElementById("contents");
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    var header_height = document.getElementById("header").scrollHeight + 'px';

    if (scrollY > header.offsetTop) {
        header.classList.add("fixed");
        fixed_margin.style.marginTop = header_height;   // ← 여기
    } else {
        header.classList.remove("fixed");
        fixed_margin.style.marginTop = '0px';
    }
}
```

`window.addEventListener('scroll', ...)` 안에서 호출 → **스크롤할 때마다 `#contents.style.marginTop = '72px'` 인라인 박힘.**

**우리 onroad.css:124** 는 `.site-header`를 **처음부터** `position: fixed; top: 0`으로 만듦. 그래서:

- 페이지 처음 로드 (scrollY=0): `header.offsetTop`도 0 → `if` 조건 통과 → `#contents.style.marginTop = '72px'` 즉시 박힘 (그러나 `window.addEventListener('load')`에서만 호출하니 페이지 로드 직후에는 한 번만)
- 사용자 스크롤 → `requestAnimationFrame` 안에서 매번 `fixedHeader()` 호출 → 같은 인라인 스타일 계속 덮어씀.

**결과**:
- 우리 `:has(.pd-promo) #wrap { padding-top: 36px }`은 `#wrap`에 적용 (BLOCK 1).
- layout.js는 `#contents.style.marginTop` 인라인으로 72px 추가 (BLOCK 2).
- 두 padding/margin이 **누적**되어 #contents가 36 + 72 = 108px 아래로 밀림.
- 페이지 첫 화면이 헤더+promo 아래로 너무 많이 밀려있을 수 있음.

**대응**:
- 우리 onroad.css에 `body.onroad-page #contents { margin-top: 0 !important }` 추가하면 layout.js의 인라인 스타일 무시 가능 (inline `!important`만 inline 이김).
- 더 깔끔한 대안: `body.onroad-page #header { position: static; }`으로 fixed 풀고, layout.js의 fixedHeader 결과를 그대로 받음. 단 우리 디자인 기대(처음부터 floating)와 다름.
- 또는 layout.js의 `fixedHeader` 함수 자체를 onroad-brand.js에서 redefinition (`window.fixedHeader = function(){}` no-op으로) — 가장 확실하지만 다른 의존이 깨질 수 있어 신중.

**현재 상태**: 우리는 둘 다 한다는 사실을 모르고 디자인했음. 라이브 검증 시 `getComputedStyle(document.querySelector('#contents')).marginTop`을 찍어볼 것.

### 18.4 layout.js의 jQuery 후속 동작 (DOMContentLoaded)

276줄 이하 `jQuery(document).ready(...)` 안에서 일어나는 일들:

- **최상단 배너 쿠키** — `top_banner_cookie` 1일 hide. `.main_top_banner` 요소가 있고 `data-ez-display="visible"`이면 slideDown.
- **로그인 placeholder 주입** — `.xans-member-login` 보이면 `#member_passwd`에 placeholder "비밀번호" 주입.
- **비회원 주문조회 placeholder** — `.xans-myshop-orderhistorynologin` 보이면 100ms 후 placeholder 박음.
- **검색 인풋 클리어** — `#ec-product-searchdata-keyword` 삭제 버튼.
- **`#order_by` 정렬 셀렉트** — 첫 옵션 텍스트 "- 정렬방식 -"로 강제.
- **`.xans-layout-multishoplist` 1개일 때 hide** — 다국어 사용 안 하면 자동 숨김.
- **푸터 에스크로** — `.bt_escrow` `data-ez-escrow` 값으로 `data-ez-escrow-id` 매칭하여 표시.
- **로그인 SNS** — `.wrap_sns_log a` 중 `displaynone` 아닌 게 있으면 `.login__sns` display:block.
- **기획전 헤더 위치 조정** — `.xans-project-list h3 span` top을 `-header_height + 30`으로.
- **`#shoppQbtn`** — 모바일 상세검색 토글.
- **마이페이지 게시글 empty 메시지** — `.xans-myshop-boardpackage` 안에 board가 없으면 `.myshop_boardlist_empty` 표시.
- **`.btnMore` 더보기** — 클릭 시 `ifmore()` 600ms 후 호출 → 위시 아이콘·장바구니·옵션 미리보기 클래스 재처리.
- **`top_category()` + `observeTopCategory()`** — 헤더 카테고리 hover. `MutationObserver`가 `#header .xans-layout-category > ul` 자식 변동 감지 → `top_category()` 재실행. 카페24가 카테고리를 lazy load할 때 대비.

**우리에 미치는 영향**:
- 우리는 `.xans-member-login`, `.xans-myshop-orderhistorynologin` 같은 cafe24 클래스 selector를 onroad.css에서 직접 쓰는 경우가 있음. 그 안에 placeholder 주입은 `<input>` 텍스트 attribute라서 visual에 영향 없지만, 빈 `<input>`을 selector로 잡으려 하면 잡히지 않을 수 있음.
- `setTimeout(100ms)` 로 박는 placeholder는 page load 직후 100ms 안에 select하면 못 잡음 → Playwright `await page.waitForTimeout(150)` 후 검증.
- `ifmore()`에서 `.btnMore` 클릭마다 600ms 후 wish 아이콘 재처리 → 우리 Custom 클릭 핸들러가 이전에 박혔으면 살아남지만, 새로운 `.wish` 요소(예: 더보기로 추가된 상품)에는 우리 핸들러가 없음. delegated event listener (이벤트 위임) 필요.

### 18.5 popup.js 동작

```js
function setResizePopup() {
  var ePopup = document.querySelector('#popup');
  // ...
  window.resizeBy(iWrapWidth - iWindowWidth, iWrapHeight - iWindowHeight);
  if (isMobile) popup.style.width = '100%';
}
```

- 팝업 layout이 사용되는 페이지(수령인 변경, 환불 신청 등)는 `<div id="popup">` 첫 자식으로 콘텐츠 박음.
- popup.js가 페이지 콘텐츠 크기에 맞춰 window 자체를 resize. 모바일은 width 100%.
- **결과**: 팝업 디자인 시 `#popup` size가 사용자 화면을 좌우. CSS로 `min-width`, `max-height` 신중하게.

### 18.6 common.js (`/js/common.js`) 동작

- **`globalBuyBtnScrollFunc()`** — `#orderFixArea` 떠있는 구매 버튼 핸들러. `#orderFixItem` 또는 `#fixedActionButton`을 reference로 fadeIn/hide.
  - 우리 onroad.css line 4311 `.onroad-page #orderFixArea.gFixed { ... }` 참조 — `.gFixed` 클래스를 cafe24가 토글.
- **`getQueryString(key)`** — URL 쿼리 파싱. 다른 모듈 JS가 의지.
- **`winPop(url)`** — 300x300 팝업 윈도우.
- **`window.call_eTab`** — 페이지가 정의하면 common.js가 호출. 탭 시스템 진입점.
- **`$.eTab(ul)`** — `.selected` 클래스 토글로 탭.

### 18.7 basic.js × `.eTooltip` / `.eToggle`

- `.eTooltip` 안에 `<input>` 두면 focus시 다음 형제 요소를 display:block, blur시 display:none.
- `div.eToggle .title` 클릭하면 부모 `div.eToggle`에 `.selected` 토글.

**금지**: 우리 디자인에서 `.eTooltip`, `.eToggle` 클래스 그냥 쓰지 말 것. 의도치 않게 카페24 핸들러 발동.

### 18.8 EZST × main.js — EZ 컴포넌트 등록 패턴

main.js 56줄~131줄:
```js
EZST.register('image-gallery/2', function () {
  return {
    connect: connect,  // 섹션 추가/페이지 로드 시 호출
    change: change,    // 섹션 설정 변경 시 호출
  };
  function connect(section, type) { _reset(section, type); }
  function change(section, type) { _reset(section, type); }
  function _reset(section, type) {
    // 이 섹션 전용 초기화 로직
  }
});
```

- `data-ez-module="image-gallery/2"` 속성이 박힌 element가 페이지에 있으면 carousel/slider 자동 init.
- DOMContentLoaded 시 또는 register 호출 시 init.
- **`change`** 호출은 어드민에서 EZ 에디터로 컴포넌트 설정 바꿨을 때 (live preview용). 라이브에선 거의 안 일어남.

### 18.9 글로벌 클래스 토글 — `<body>` / `<html>`

| 클래스 | 위치 | 누가 박나 | 의미 |
|---|---|---|---|
| `theme01`~`theme04` | `<body>` | 서버 EZ 시스템 | 활성 테마 |
| `en-layout` / `jg-layout` | `<body>` | 우리 (layout.html / main.html에서 직접 박음) | 레이아웃 종류 |
| `onroad-page` | `<body>` | 우리 | 우리 스킨 활성 마커 |
| `onroad-home`, `onroad-detail`, … | `<body>` | 우리 (페이지별) | 페이지 모디파이어 |
| `expand` | `<body>` | layout.js | slide aside 메뉴 열림 |
| `searchExpand` | `<body>` | layout.js | 검색 오버레이 열림 |
| `button--fixed` | `<body>` | layout.js | `#orderFixArea` 활성 |
| `has-docked-info` | `<body>` | onroad-brand.js (우리) | 우리 도킹 패널 활성 |
| `ez-view-type-mobile` | `<html>` | ez/init.js | 뷰포트 ≤1024px |

`<html>`의 `ez-view-type-mobile`은 매우 중요 — **카페24의 "이 사용자는 모바일이다" 판정**. 우리 미디어 쿼리 대신 `html.ez-view-type-mobile .x { ... }` 같이 사용 가능 (단, 1024px 기준이라 우리 720px 기준과 다를 수 있음 — 혼용 시 주의).

---

## 19. EZ 시스템

> 1차 문서가 EZ 시스템을 "테마 스위치"로 단순화했음. 실제로는 카페24의 두 번째 모듈 레이어 — 클라이언트 사이드 컴포넌트 시스템.

### 19.1 두 가지 모듈 레이어 비교

| | `module="..."` (서버) | `data-ez-module="..."` (클라이언트) |
|---|---|---|
| 처리 | 서버 사이드 PHP | 클라이언트 사이드 JS (EZST) |
| 시점 | 서버 렌더 시 | DOMContentLoaded 후 |
| 역할 | DB 데이터 바인딩, `{$변수}` 치환, `xans-*` 클래스 주입 | 컴포넌트 lifecycle (init/connect/change/disconnect) |
| 인스턴스화 | 페이지에 selector 일치 → 자동 | `data-ez-module="name/version"` element 발견 → register된 핸들러 실행 |
| 우리가 등록 | 서버 카페24 framework — 우리 수정 불가 | **`EZST.register('name', { connect, change })` — 우리도 추가 가능** |

같은 element에 둘 다 붙을 수 있음:
```html
<div module="product_image" data-ez-module="image-gallery/2">
```
→ 서버: 이미지 데이터·줌 자식 마크업 채움. 클라이언트: EZST 핸들러로 carousel init.

### 19.2 EZ 선언 태그 (`<ez-prop>` 패밀리)

`layout.html` `<head>` 끝부분에 `<script type="text/ez-prop">` 안에 박혀있음:

```html
<ez-prop data-version="1.0.0">
  <ez-var data-prop="theme" data-namespace="ez.layout.theme" data-type="array">
    <ez-item data-id="theme01" data-name="온로드" data-desc="..." data-font="..."
             data-background-color="#FFFFFF" override-value="html"
             data-font-css="https://fonts.googleapis.com/...">
      온로드 공식몰 디자인
    </ez-item>
    <ez-item data-id="theme02" .../>
    ...
  </ez-var>
</ez-prop>
```

- `<ez-prop>` — 루트 prop 선언
- `<ez-var data-prop="..." data-namespace="..." data-type="...">` — 변수 정의
- `<ez-item data-id="...">` — 변수의 한 옵션
- `<ez-list>` — 리스트 형식
- `<ez-hash>` — 해시(딕셔너리) 형식
- `override-value="html"` — HTML inline override 허용

**중요**: `init.js`의 `_cleanup()`이 DOMContentLoaded 후 모든 `<ez-prop>`과 `<script type="text/ez-prop">`를 DOM에서 제거. 즉 라이브 `view-source:`에서는 보이지만 `document.body.innerHTML`에는 없음.

### 19.3 `data-ez-*` 속성 78종 카탈로그

조회된 모든 `data-ez-*` 속성을 의미별로 분류:

**섹션 정체 (identity):**
- `data-ez="contents-enduriz-header-1"` — 섹션 고유 ID. 어드민이 인식.
- `data-ez="layout-enduriz-container-1"` — 컨테이너 식별
- `data-ez="contents-102lhyg-1"` — auto-generated ID
- `data-ez-module="product-list-slide/2"` — EZ 컴포넌트 타입/버전 (주의: 슬래시 + 숫자가 버전)
- `data-ez-name="메인롱배너"` — 섹션 표시명 (어드민용)
- `data-ez-group="top-util-menu"` — 그룹핑

**역할 (role):**
- `data-ez-role="list"` — 이 element는 리스트 컨테이너
- `data-ez-role="content-list"`, `"content-item"` — 컨텐츠 리스트 구조
- `data-ez-role="title"`, `"subtitle"`, `"desc"`, `"name"`, `"address"`, `"a"` — semantic 마커
- `data-ez-role="image-list ez-column"` (공백 구분 다중) — 이미지 리스트 + ez-column 적용
- `data-ez-role="image-item ez-align"` — 정렬 가능 이미지
- `data-ez-role="layout"`, `"layout ez-discount-tag"` — 레이아웃 마커
- `data-ez-role="ez-mobile-layout"`, `"ez-align"`, `"ez-discount-tag"` — 동작 옵트인
- `data-ez-role="img-pc"`, `"img-mobile"` — 디바이스별 이미지
- `data-ez-role="style.background"` — 스타일 바인드
- `data-ez-role="tab-list"`, `"tab-item"`, `"video"` — 컴포넌트 내부 마커

**레이아웃 옵션:**
- `data-ez-layout="grid3"`, `"grid4"`, `"grid5_slide"` — 그리드 변형
- `data-ez-mobile-layout="slide"` — 모바일에서 슬라이드로 전환
- `data-ez-layoutsize="fit"`, `"full"` — 전체 폭 / 컨테이너 fit
- `data-ez-column="3"` — 컬럼 수 (최대치)
- `data-ez-item-length="3"` — 등록된 아이템 수 (실제)
- `data-ez-textsize="medium"` — 텍스트 크기 변형
- `data-ez-align="left"`, `"center"` — 정렬

**이미지 사이즈:**
- `data-ez-size-pc="1230 500"` — PC 권장 사이즈 (px, 공백 구분)
- `data-ez-size-mobile="720 500"`, `"720 767"` — 모바일 권장
- `data-ez-rawsrc=""` — 원본 src URL

**상태:**
- `data-ez-display="hidden"`, `"visible"` — 노출 토글
- `data-ez-theme="theme01"` — 활성 테마

**아이템 모음 (top-util-menu):**
- `data-ez-item="join"`, `"login"`, `"logout"`, `"modify"`, `"mypage"`, `"order"`, `"recent"` — 회원 메뉴 7항목 식별

**기타:**
- `data-ez-holder="product_list"`, `"product_listmain"` — placeholder 식별
- `data-ez-escrow-id="+ bt_escrow +"` — 에스크로 마크 (jQuery concat 결과)

### 19.4 HTML 루트의 `ez-view-type-mobile` 클래스

`init.js:114`:
```js
function _changeViewType(mq) {
  document.documentElement.classList.toggle('ez-view-type-mobile', mq.matches);
}
```

- `(max-width: 1024px)` 매치되면 `<html class="ez-view-type-mobile">`.
- `mq.addEventListener('change', ...)`로 resize에도 반응.
- **카페24 모바일 판정 단일 진실**. 미디어 쿼리 + class selector 조합으로 모바일 전용 룰 작성 가능:
  ```css
  html.ez-view-type-mobile .onroad-page .pd-grid { ... }
  ```
- 우리 디자인 미디어 쿼리는 보통 720px 기준이지만 EZ는 1024px 기준 — 720~1024 구간에선 둘이 다른 뷰를 줌. 디자인 시 의도적 결정 필요.

### 19.5 EZ 시스템과 우리 작업의 접점

대부분의 `data-ez-*`는 카페24가 어드민 에디터로 박는 거라 **우리는 손대지 않는다**. 하지만 우리가 접하는 곳:

- 우리 page-level 모디파이어 추가 시 기존 `data-ez="..."` 보존
- 사이드바 `data-ez-item="..."` 메뉴 항목은 삭제하지 말 것 (어드민에서 회원 7개 메뉴를 토글 가능 — 우리가 임의로 제거하면 어드민 설정 안 먹음)
- 컴포넌트 자체를 우리가 추가하려면 `EZST.register('name/version', { connect, change })` 패턴 따르기

### 19.6 EZ가 우리를 묶는 함정

- 어드민에서 사용자가 EZ로 컴포넌트 추가 → 우리 onroad.css 룰이 `data-ez-module="..."` 컴포넌트의 자식에 의도치 않게 흘러갈 수 있음
- 어드민에서 컴포넌트 삭제 → 우리가 의지하던 클래스가 사라짐
- `data-ez-display="hidden"`으로 에디터가 끈 섹션 → CSS에선 보이지만 우리 JS가 그걸 못 본 척하면 사용자가 어드민에서 켰을 때 무반응
- 컴포넌트 instance가 여러 개 박힘 → 같은 selector로 잡으면 모두 영향
- **방어**: 우리 selector는 `.onroad-` 또는 `.pd-` prefix 우선. cafe24/EZ 클래스 잡을 땐 항상 페이지 modifier (`.onroad-detail` 등)로 좁힘.

---

## 20. `ec-base-*.css` suite 해체분석

> 1차 문서는 "ec-base-*는 시스템 CSS, 편집 금지"라고만 적었음. 어떤 룰이 어디에 박혀있는지 모르면 specificity 싸움에서 진다. 13개 파일 1146줄 분석.

### 20.1 파일별 owner 영역

| 파일 | 줄수 | 주된 selector | 우리가 자주 부딪치는 영역 |
|---|---|---|---|
| `ec-base-button.css` | 112 | `[class^='btnNormal']`, `[class^='btnSubmit']`, `[class^='btnEm']` | 모든 버튼. 검은 배경 흰 글자 default. |
| `ec-base-fold.css` | 42 | `.ec-base-fold > .title / .contents`, `:after` 화살표 | accordion (안내·약관·FAQ). 화살표 transition 0.3s. |
| `ec-base-layer.css` | 64 | `.ec-base-layer`, `.typeModal`, `.typeLayer`, `.typeSide`, `.btnClose` | 모든 모달·레이어. z-index 1001. fixed center. |
| `ec-base-table.css` | 167 | `.ec-base-table table`, `.ec-base-table th/td`, `.ec-base-tbl` | 주문/마이페이지 표. |
| `ec-base-product.css` | 134 | `.ec-base-product .prdList`, `.title`, `.thumbnail` | 상품 그리드/리스트. |
| `ec-base-prdInfo.css` | 127 | 상품 spec 정보 표시 패턴 | 상세페이지 spec 박스. |
| `ec-base-tab.css` | 63 | `.ec-base-tab .menu`, `.option` | 탭 네비. |
| `ec-base-tooltip.css` | 81 | `.ec-base-tooltip` | 툴팁 박스. |
| `ec-base-ui.css` | 221 | `.txtInfo`, `.txtList`, `.txt11~18`, `.gBlank*`, `.titleArea h2` | **유틸리티 — 가장 광범위 충돌**. |
| `ec-base-box.css` | 52 | `.ec-base-box` | 박스 래퍼. |
| `ec-base-desc.css` | 33 | `.ec-base-desc` | 설명 블록. |
| `ec-base-help.css` | 27 | `.ec-base-help` | 도움말 박스. |
| `ec-base-paginate.css` | 23 | `.ec-base-paginate` | 페이징. |

### 20.2 `ec-base-button.css` 주요 룰

```css
[class^='btnNormal'], a[class^='btnNormal']     { ... color:#000; background-color:#fff; border:1px solid #bcbcbc; }
[class^='btnSubmit'], a[class^='btnSubmit']     { ... color:#fff; background-color:#000; }
[class^='btnNormal']:not(.disabled):hover       { border-color:#000; }
[class^='btnSubmit']:not(.disabled):hover       { ... }
[class^='btnNormal'].disabled                   { border-color:#e3e3e3; color:#999; }
```

- `[class^='btnNormal']` attribute selector — `.btnNormal`, `.btnNormalUI`, `.btnNormalRed` 등 모든 prefix 매치.
- specificity (0,1,1) — class 룰이지만 attribute selector 라 우리 `.btn { ... }`로는 못 이김.
- **이김**: `.onroad-page [class^='btnNormal'] { ... }` 또는 `.onroad-page .btnNormalRed { ... }`.

### 20.3 `ec-base-layer.css` 주요 룰

```css
.ec-base-layer-area     { position:fixed; top:0;right:0;bottom:0;left:0; background:rgba(0,0,0,0.3); z-index:1000; }
.ec-base-layer          { z-index:1001; border:1px solid #000; background:#fff; }
.ec-base-layer.typeModal { position:fixed; top:50%; left:0;right:0; transform:translateY(calc(-50% + 0.5px)); margin:0 auto; }
.ec-base-layer.typeSide  { position:fixed; display:flex; flex-direction:column; height:100%; border:0; }
.ec-base-layer .btnClose { position:absolute; right:7px; top:7px; transform:rotate(45deg); }
```

- z-index 1000(dimm) / 1001(layer) — 우리 z-index 50~60 위에 있음.
- 모달은 viewport center.
- typeSide는 풀높이 사이드 패널.
- `.btnClose`는 X 모양 (45도 회전 + ::before/::after 라인).

### 20.4 `ec-base-ui.css` 가장 위험한 utility

`.txt11`, `.txt12`, ..., `.txt18` — 폰트 크기 클래스. 카페24가 `<span class="txt12">` 같이 박는 곳 있음.
`.txtInfo`, `.txtList`, `.txtWarn`, `.txtEm`, `.txtSecondary`, `.txtSuccess` — 안내 텍스트 변형.
`.titleArea h2 { font-weight: normal }` — `.titleArea` 안 h2에 무조건 normal 적용.
`.gBlank5`, `.gBlank10`, ..., `.gBlank20` — 마진 유틸.

**우리가 받은 영향**:
- 우리 디자인 H2는 보통 700이지만 `.titleArea h2`는 normal로 강제됨 → `body.onroad-page .titleArea h2 { font-weight: 700 }` 같은 override 필요.
- `<span class="txt14">`가 카페24가 자동 박은 거면 우리 디자인 폰트 크기 system 따라가게 `.onroad-page .txt14 { font-size: var(--fs-base) }` 같이 override 가능.

### 20.5 cascade 위치

`layout.html`:
1. `<head>`에 13개 ec-base-*.css `@css`로 등록 (앞)
2. `<body>` 끝에 `sub_style.css`, `sub_theme.css`, `add_theme0[1-4].css`, `add_layout.css`, `main.css`, **`onroad.css`** (뒤)

→ ec-base-* < onroad.css. 동일 specificity면 onroad.css가 source order로 이김. 그러나 ID selector나 더 specific class chain 박힌 ec-base 룰은 source order만으로 못 이김.

---

## 21. 모듈 분류와 케이스 함정

> 1차 문서는 "391개 module 종류" 라고만 적었음. 실제 분류·이름 케이스 분석 누락.

### 21.1 namespace 그룹별 모듈 수 (392 unique values)

```
product_*       235  (lowercase) — 상품 영역
Myshop_*        158  (PascalCase!)
Layout_*         98  (PascalCase) — 레이아웃 chrome
Order_*          91  (PascalCase) — 주문/결제
myshop_*         71  (lowercase)
member_*         34  (lowercase)
MyShop_*         20  (MixedCase!)
Product_*        17  (PascalCase)
Mall_*           14  (PascalCase)
Coupon_*         11  (PascalCase)
attend_*         11  (lowercase)
board_*          11  (lowercase)
gift_*            9  (lowercase)
Estimate_*        6  (PascalCase)
project_*         5  (lowercase)
search_*          4  (lowercase)
Search_*          4  (PascalCase)
Member_*          4  (PascalCase)
coupon_*          3  (lowercase)
mall_*            4  (lowercase)
```

### 21.2 케이스 함정 ⚠️

**같은 기능 영역의 module 이름이 PascalCase / camelCase / MixedCase로 섞여있다.**

- 마이페이지: `Myshop_*` (158) AND `myshop_*` (71) AND `MyShop_*` (20) **세 가지 케이스 동시 사용**
- 회원: `Member_*` (4) AND `member_*` (34)
- 쇼핑몰: `Mall_*` (14) AND `mall_*` (4)
- 검색: `Search_*` (4) AND `search_*` (4)
- 상품: `Product_*` (17) AND `product_*` (235)
- 쿠폰: `Coupon_*` (11) AND `coupon_*` (3)

**왜 위험한가**:
- 우리가 `module="myshop_main"` 만들고 `module="Myshop_main"`로 바꾸면 카페24가 못 알아볼 가능성. 카페24 framework가 case-insensitive인지 case-sensitive인지 비공개.
- 디자인 번들 적용 시 grep으로 `module="myshop_*"` 만 찾으면 158개 `Myshop_*`을 놓침.
- 메모리에서 module 이름을 적을 때 정확한 케이스를 보존해야 함.

**대응**: 어떤 module이든 **원본 그대로 복사**. 이름 추측 금지. grep할 때는 case-insensitive (`grep -i`) 또는 와일드카드 (`module="[mM]yshop_main"`).

### 21.3 자주 쓰는 module 의미별 분류

**상품 표시:**
- `product_detail` — 상세 페이지 최상위
- `product_image` — 메인 이미지 + 줌 (자식 마크업 일부 카페24 채움)
- `product_addimage` — 추가 이미지 리스트 (자식 `<li>` 카페24 채움)
- `product_listnormal`, `product_listnew`, `product_listrecommend` — 리스트
- `product_relation`, `product_relationlist` — 관련 상품
- `product_recentlist`, `product_recentlistpaging` — 최근 본
- `product_normalpackage`, `product_normalpaging`, `product_normalmenu` — 일반 페이지

**상품 인터랙션:**
- `product_action` — 구매·장바구니·찜 버튼
- `product_quantity` — 수량 +/-
- `product_option`, `product_mainoption`, `product_addoption`, `product_fileoption` — 옵션
- `product_FirstSelect`, `product_SecondSelect`, `product_Colorchip` — 옵션 선택
- `product_Imagestyle` — 아이콘 스타일
- `product_zoom` — 줌

**상품 메타:**
- `product_review`, `product_reviewpaging` — 리뷰
- `product_qna`, `product_qnapaging` — 문의
- `product_headcategory`, `product_displaycategory`, `product_displaysubcategory` — 카테고리/breadcrumb
- `product_hashtag`, `product_categoryHashtag` — 해시태그
- `product_searchdata`, `product_searchOrderby`, `product_SearchFilterList`, `product_HotKeyword`, `product_RelateKeyword` — 검색
- `product_request`, `product_setproduct`, `product_addproduct` — 요청·세트·연관

**상품 특수:**
- `product_regularDiscount` — 정기배송 할인
- `product_rental` — 렌탈
- `product_stocklayer` — 재고 레이어
- `product_customsns` — SNS 공유
- `product_filterform` — 필터 폼
- `product_projectcategory` — 기획전 카테고리

**레이아웃 chrome:**
- `Layout_orderBasketcount` — 카트 카운트
- `Layout_statelogon`, `Layout_statelogoff`, `Layout_stateLogon` (대소문자 혼합!), `Layout_stateLogon` — 로그인 상태
- `Layout_login` — 로그인 폼 (사이드)
- `Layout_SearchHeader`, `Layout_SearchSide` — 검색
- `Layout_LogoTop`, `Layout_LogoBottom` — 로고
- `Layout_category` — 카테고리 (헤더)
- `Layout_MobileAction` — 모바일 액션 (RTMB 뒤로가기)
- `Layout_Myshop` — 마이페이지 위젯
- `Layout_footer`, `Layout_Info`, `Layout_shoppingInfo` — 푸터·정보
- `Layout_multishopShipping`, `Layout_multishopList`, `Layout_multishopListitem` — 다국어
- `Layout_productRecent` — 최근 본
- `Layout_orderBasketcount` — 카트 카운트
- `Layout_calendarBanner`, `Layout_attendBanner`, `Layout_couponzoneBanner`, `Layout_giftBanner`, `Layout_opdiaryBanner`, `Layout_sosBanner` — 배너들
- `Layout_Poll`, `Layout_bookmark`, `Layout_shortcut`, `Layout_conversionPc` — 기타
- `Layout_Second`, `Layout_Third`, `Layout_Fourth`, `Layout_Fifth` — 자유 위젯 슬롯 1~5
- `Layout_CategorySupplyList`, `Layout_project` — 추가 콘텐츠
- `layout_slidePackage` (lowercase) — 사이드 슬라이드

**회원/마이페이지** — `Myshop_*` (158)이 너무 많아 별도 큰 그룹. `myshop_main`, `myshop_summary`, `myshop_orderstate`, `myshop_asyncbankbook`, `myshop_likeit*`, `myshop_wishlist*`, `myshop_unavail*`, `myshop_history*`, …

**주문/결제** — `Order_*` (91), 우리는 `order/` 폴더 자체에 손 안 댐.

**기타**:
- `attend_*` — 출석 체크 시스템
- `board_*` — 게시판
- `Mall_Urgencycall`, `Mall_UrgencycallOrdHeader`, `Mall_UrgencycallOrdLogout`, `Mall_SupplyInfo`, `Mall_SupplyMainimage`, `Mall_SupplySearch` — 쇼핑몰 광역 모듈
- `Coupon_*` — 쿠폰
- `Estimate_*` — 견적
- `gift_*`, `Gift_*` — 사은품
- `project_*` — 기획전
- `Intro_memberPackage` — 인트로 페이지

### 21.4 module 이름 작업 시 안전 규칙

1. **이름 절대 임의 변경 금지** — 케이스 단 1글자도.
2. 새 module 추가하려면 카페24 어드민에서 모듈 활성 후 cafe24가 표준 이름을 박아줌. 우리가 임의 이름 박지 말 것.
3. module wrapper outer를 새 wrapper로 감쌀 때 outer module 속성 보존. inner도 보존.
4. module 이름을 selector로 쓸 때 case-insensitive selector는 없으므로 정확히 일치 (또는 `xans-*` 런타임 클래스 사용).

---

## 22. 서버 런타임 주입 카탈로그

> 우리 스킨 파일에는 **없는데** 라이브에서 추가되는 것들 종합. 1차 문서 §7은 일부만 다뤘음.

### 22.1 클래스

| 무엇 | 어디에 | 언제 박나 |
|---|---|---|
| `xans-element-` + `xans-{group}` + `xans-{group}-{subtype}` | `module="..."` 요소 | 모든 module 요소 (소문자로) |
| `displaynone` / `displayblock` | `class="{$xxx_display|display}"` 자리 | 조건부 |
| `selected`, `disabled`, `active` 등 상태 클래스 | 다양 | 상품 상태·옵션 선택·탭 활성에 따라 |
| `fixed` | `#header` | layout.js가 스크롤 시 |
| `is-hidden-top` | `.site-header` | 우리 onroad-brand.js |
| `gFixed` | `#orderFixArea` | common.js (globalBuyBtnScrollFunc) |
| 위시 `on` | `.icon__box .wish` | layout.js (ifmore) — `icon_status` attribute에 따라 |

### 22.2 inline style (JS가 박는 거)

| 무엇 | 어디에 | 언제 |
|---|---|---|
| `margin-top: <header_height>px` | `#contents` | layout.js의 `fixedHeader()` — 스크롤 시 |
| `top: <px>` | `#quick`, `.xans-project-list h3 span` | layout.js |
| `display: block` | `.xans-member-login .login__sns` | layout.js (DOMReady) |
| `display: flex` | `#footer .bt_escrow` | layout.js (DOMReady) |
| `display: none/block` (toggle) | 슬라이드 메뉴 자식 | slide_menu.js |
| placeholder 속성 | `#member_passwd`, `#order_*` | layout.js (100ms 후) |
| `data-is_closed` | `.xans-product-listmain h2` | common.js (`/layout/basic/js/common.js` — 만약 로드되면) |

**우리의 fight**: inline style은 specificity 가장 높음 (1,0,0,0). CSS로 못 이김 → `!important`만이 inline을 이김 (그것도 매번은 아님).

### 22.3 meta 태그 자동 주입

`view-source:`에 보이지만 우리 스킨 파일에는 없는 것:

- `<meta name="path_role" content="MAIN|SUB">` — 카페24가 페이지 종류 박음. layout.js 의지.
- `<meta name="csrf-token" content="...">` — CSRF 토큰 가능성 (확인 필요).
- 어드민 SEO 설정한 페이지: `<title>` / `<meta name="description">` 자동 덮어쓰기 가능.

**우리의 활용**: `meta[name="path_role"]`로 페이지 분기 가능 — 단 `MAIN/SUB` 두 값만.

### 22.4 응답 헤더

라이브 응답에 박히는 것 (서버):
- `Cache-Control: no-cache`, `Expires: 0`, `Pragma: no-cache` — `<meta>`로도 박혀있음. PG 호환.
- 세션 쿠키들 (CFCK, OEDP, …) — 카페24 세션 추적
- CSRF token 쿠키 가능

**우리의 영향**: 캐시 정책 우리가 못 바꿈. 모든 페이지 매번 fresh fetch.

### 22.5 동적 자식 마크업

서버가 `module=` outer 안에 채우는 것:
- `product_addimage` → `<ul class="list">` 안 `<li>`들 (실제 추가 이미지 개수만큼)
- `product_review` → 리뷰 카드들
- `product_qna` → Q&A 행들
- `product_listnormal` → 상품 카드들 (페이지당 N개)
- `Layout_orderBasketcount` → `{$basket_count}` 변수 치환만 (자식 마크업은 우리가 박음)
- `Layout_multishopShipping` → 다국어 셀렉터의 `<option>`들

**우리의 한계**: 자식 개수·구조 모름. CSS는 `:nth-child`, `:first-child` 사용 시 카페24 자동 채움 자식들에도 적용됨. flex/grid 자유 배치는 카페24가 박는 자식 패턴이 우리 의도와 일치할 때만.

---

## 23. 예약된 이름

> 우리가 새 클래스/ID 만들 때 **금지** 이름들. 카페24 시스템이 의지하므로 의도치 않게 동작 가로챔.

### 23.1 ID — 카페24 시스템 사용

`#header`, `#wrap`, `#container`, `#contents`, `#footer`, `#aside`, `#quick`, `#popup`, `#progressPaybar`, `#progressPaybarBackground`, `#progressPaybarView`, `#layoutDimmed`, `#layer_shadow`, `#skipNavigation`, `#orderFixArea`, `#orderFixItem`, `#fixedActionButton`, `#totalPrice`, `#totalProducts`, `#topBanner`, `#siteNav`, `#aside`, `#dimmedSlider`, `#topBanner`, `#zoom_wrap`, `#searchContent`, `#shoppQbtn`, `#keyword`, `#member_passwd`, `#member_id`, `#order_id`, `#order_password`, `#order_name`, `#order_by`, `#slideCateList`, `#slide_add_category`, `#top_banner_box_cloase`, `#prdDetail`, `#prdInfo`, `#prdQnA`, `#ec-product-searchdata-keyword`, `#ec-product-searchdata-searchkeyword_form`, `#ec-searchdata-area`

### 23.2 클래스 — JS 핸들러 매개

- `.eToggle`, `.eTooltip`, `.eSearch`, `.eNavFold`, `.eForm` — basic.js / layout.js / common.js가 자동 핸들러 등록
- `.btnClose`, `.btnSubmit*`, `.btnNormal*`, `.btnEm*`, `.btnDelete`, `.btnSearch` — base button + JS 트리거
- `.btnMore` — layout.js의 ifmore 트리거
- `.fixed`, `.expand`, `.searchExpand`, `.button--fixed` — 토글 상태 클래스
- `.gFixed` — 구매 버튼 fixed 상태
- `.bottom-nav__top`, `.bottom-nav--hide`, `.bottom-nav__top--show` — 하단 네비
- `.dimmed`, `.layer_shadow`, `.layerProgress` — 백드롭
- `.displaynone`, `.displayblock` — 서버 토글
- `.RTMB`, `.display_tablet_only` — 모바일 전용 표시
- `.ec-base-*` — 시스템 컴포넌트 prefix
- `.xans-*` — 서버 런타임 주입
- `.main_top_banner`, `.top_banner_close` — 상단 배너 (쿠키 시스템)

### 23.3 우리가 만든 prefix (충돌 없음 보장)

- `.onroad-*` — 우리 글로벌 컴포넌트
- `.pd-*` — 제품상세 전용
- `.my-*` — 마이페이지 전용
- `.jg-*` — 인증 페이지 전용 (`jg-auth-*`, `jg-pending-*`, `jg-info-page`, `jg-product-detail-page`, …)

### 23.4 `data-` 속성 예약

- `data-ez="..."`, `data-ez-*` — 78종 EZ 시스템 (§19.3)
- `data-ez-theme` — 테마
- `data-version` — 버전 마커
- `data-aos*` — AOS 라이브러리 (홈에서만 사용)
- `data-id` — `<ez-item>`이 사용

### 23.5 `data-aos` 등 외부 라이브러리

홈 페이지가 AOS 2.3.4 사용. CDN으로 등록. `data-aos="fade-up"`, `data-aos-delay="200"`, `data-aos-duration="1000"`. 이 속성들은 외부 라이브러리 소유 — 형식 따라가면 자동.

---

## 24. 자체 점검 노트

> 1차 문서(§1~17)에서 부정확하거나 보강이 필요했던 부분을 명시. 다음 작업 시 이 노트로 확인.

### 24.1 부정확했던 클레임

| 위치 | 1차 클레임 | 정정 |
|---|---|---|
| §3 | "옵티마이저 빌드 트리거 비공개" | 정확하지만 CSS 내용 변경이 빌드 자동 트리거. 타이밍이 비공개일 뿐. |
| §10 | ".site-header는 position:fixed; z-index:50" | **추가 충돌**: layout.js의 `fixedHeader()`가 `#contents.style.marginTop = '72px'` 인라인 박음. 우리 `:has()` padding과 누적 (§18.3). |
| §17.5 | "테마 시스템 = 단순 테마 스위치" | EZ 시스템은 테마 + 클라이언트 컴포넌트 lifecycle 시스템. 더 광범위 (§19). |
| §17.7 | "carepe24 시스템 JS는 click 가로챈다" | 정확하지만 구체화 부족. 18.1~18.8 참조. |
| §17.20 | "title 어드민 덮음 가능 — 확인 필요" | 어드민 SEO 설정이 페이지별로 덮음 가능. 그러나 layout.html `<title>`이 default. 확인 완료. |
| §22.3 | (1차 문서 없음) | 새로 추가: meta 태그 자동 주입 — `path_role`, CSRF 토큰 등. |

### 24.2 1차 문서가 빠뜨린 영역 (이번에 추가)

- **JS 런타임 분석**: §18 신설. 우리 onroad-brand.js가 실행될 때 이미 어떤 핸들러가 박혀있는지.
- **EZ 시스템 깊이**: §19 신설. `data-ez-*` 78종 카탈로그, EZST API.
- **layout.js × 우리 CSS 충돌**: §18.3에 명시. 실제 사고 가능성 있음.
- **ec-base-*.css 내용**: §20 신설. 13개 파일 1146줄 owner 영역.
- **모듈 이름 케이스 함정**: §21.2. 같은 영역에 PascalCase + camelCase + MixedCase 섞임.
- **예약 이름 카탈로그**: §23 신설. 우리가 만들면 안 되는 ID/클래스/data-*.
- **`<html class="ez-view-type-mobile">`**: §18.9 / §19.4. 카페24의 단일 모바일 진실.
- **`<meta name="path_role">` 서버 주입**: §22.3.

### 24.3 아직 미검증 영역 (다음 세션 우선순위)

1. **CSRF 토큰** — 카페24가 토큰을 어떻게 박는지, AJAX 요청에 어떻게 첨부하는지. 검증 필요.
2. **세션 쿠키 이름** — 어떤 쿠키가 어떤 의미인지. 라이브 inspect로 카탈로그.
3. **`<meta name="csrf-token">` 존재 여부** — view-source 직접 확인.
4. **`/exec/front/*` AJAX 엔드포인트 전체 목록** — 모듈 JS 안에 박혀있을 것.
5. **카페24 모바일 스킨 분기** — `skin_mobile_basic`이 별도 존재하는지. 우리는 단일 반응형이지만 카페24가 자동 분기할 가능성.
6. **`module`이 case-sensitive인가 case-insensitive인가** — 라이브에서 의도적 케이스 변경 테스트.
7. **`data-ez-mobile-layout="slide"` 등 EZ 모바일 옵션이 실제 렌더에 어떻게 영향** — 라이브 비교.
8. **`layout/basic/js/common.js`** (256줄) — 등록 안 됐지만 어디서 끌어 쓰는지. 삭제 가능한지.
9. **slide_menu.js의 `/exec/front/Product/SubCategory` 응답 구조** — 카테고리 트리 변환 로직.
10. **`<meta name="msapplication-*">`, `<meta name="theme-color">` 외 자동 주입 메타** — 추가 확인.

### 24.4 문서 체계 자체에 대한 메모

- **§1 TL;DR 5개**가 제일 중요 — 작업 전 무조건 확인. 새로운 사고 발생 시 갱신.
- **§15 체크리스트**는 실용 — 작업 흐름 진입점.
- **§16 사고 사례**는 시간 지나면 길어짐 — 주제별 그룹핑 또는 과거 1년+ 사례는 archive.md로 분리 고려.
- **§17 강제 구조**와 **§18~23 깊이 분석**은 reference — 처음부터 읽지 않음. TOC + 검색으로 진입.
- 새 사고/발견 시: §16 사례 + §1 TL;DR + 해당 깊이 섹션 동시 갱신.

---

## 25. 용어집

- **스킨 (skin)**: 카페24 쇼핑몰의 HTML/CSS/JS 템플릿 셋. 우리 `cafe24/` 폴더가 그것.
- **디자인 보관함 (Design Library)**: 카페24 어드민의 스킨 관리 영역. *디자인 편집* 기능은 §13의 사고 위험.
- **모듈 (module)**: `module="..."` 속성으로 표시된 서버 데이터 바인딩 hook. 391개 종류.
- **옵티마이저 (optimizer.php / optimizer_user.php)**: CSS·JS minify+concat 번들러.
- **디렉티브 (directive)**: `<!--@layout|css|js|import|contents|define-->` 매크로.
- **xans-* 클래스**: 카페24가 module 요소에 런타임 주입하는 네임스페이스 클래스.
- **fw-* attribute**: 폼 검증 프레임워크 attribute (`fw-filter`, `fw-label`, `fw-msg`, `fw-alone`).
- **EZ 디자인 (`ez/`, `<ez-prop>`, `<ez-var>`, `<ez-item>`)**: 카페24 EZ 시스템 (테마 스위치). 손대지 말 것.
- **RTMB**: 모바일 전용 표시 영역 클래스 (`.RTMB`).
- **xans-element-**: 모든 module 요소에 공통으로 추가되는 prefix.

---

_마지막 업데이트: 2026-04-25. 사고 사례 §16-D `b0f37c9` 직후._
