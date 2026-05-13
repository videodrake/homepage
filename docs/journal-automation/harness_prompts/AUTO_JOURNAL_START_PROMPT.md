# 자율 Journal 시작 프롬프트

Claude Project 새 대화에서 주제 선정부터 원고 작성까지 맡길 때 이 파일 전체를 붙여넣는다.

```text
Custom Instructions와 Project Knowledge 전체를 기준으로, 다음 자사몰 Journal 글을 주제 선정부터 스스로 진행해줘.

먼저 내부적으로 아래 문서를 확인해.

- Git 연결이 있으면 content/CONTENT_STATE.md
- Git 연결이 있으면 content/CONTENT_LOG.md
- Git 연결이 있으면 content/draft/, content/published/, assets/ 실제 파일 상태
- 콘텐츠_발행_로그.md
- 자리1_활성시리즈.md
- 자리1_출력사양.md
- 자리1_자가검증.md
- 자리1_콘텐츠품질_가이드.md
- mode_journal.md
- 이미지_가이드.md
- 발행_매핑_가이드.md
- 규제_핵심요약_치트시트.md
- 키워드_리서치_가이드.md

만약 이 Claude Project에서 GitHub 또는 Git 저장소 문서를 읽을 수 있다면, Project Knowledge의 로그보다 Git 저장소의 최신 `content/CONTENT_STATE.md`와 `content/CONTENT_LOG.md`를 우선해. `CONTENT_STATE.md`가 없으면 Git 저장소의 최신 `CONTENT_LOG.md`를 봐. Git 상태 파일과 실제 `content/draft/`, `content/published/` 파일이 다르면 실제 파일 상태를 우선해. Git을 읽을 수 없으면 Project Knowledge의 `콘텐츠_발행_로그.md`를 백업 기준으로 진행해.

주제 선정 기준:
- 이미 발행된 글과 중복하지 말 것
- `완료` 또는 `초안` 상태 글과 중복하지 말 것
- `deployed`, `published_md_ready`, `drafting`, `reviewed_ready_for_codex`, `codex_processing`, `blocked` 상태 글과 중복하지 말 것
- `예정` 상태이거나 로그에 없는 다음 순서의 글을 우선할 것
- 아직 완료되지 않은 시리즈 중 앞 순서를 우선할 것
- 제품명/성분명 직접 언급이 필요한 주제는 뒤로 미룰 것
- 한국 30~40대 남성 러너가 실제로 겪는 문제를 우선할 것
- 검색 질문으로 성립하고, Journal 1편과 네이버 파생글 2편으로 자연스럽게 확장되는 주제를 고를 것
- 규제 위험이 낮은 TOFU 건강정보 주제를 우선할 것

기본 우선순위:
Journal 01-A -> Journal 01-B -> Journal 02-A -> Journal 02-B -> Journal 03-A/B

진행 방식:
1. 내부적으로 후보 3개를 평가하되, 긴 평가표는 출력하지 말 것.
2. 가장 적합한 주제를 하나 선택할 것.
3. 선택 이유를 3줄 이내로만 밝힐 것.
4. 곧바로 하나의 마크다운 원고를 출력할 것.

출력 조건:
- 하나의 마크다운 파일 내용만 출력
- 코드블록으로 감싸지 말 것
- YAML frontmatter 포함
- filename과 slug는 반드시 journal-NN-X 형식
- 이미지 마커 5~8개
- 모든 이미지 마커는 [IMG-N: 식별명] 단독 줄
- ## 이미지 명세 포함
- 모든 명세 헤더는 ### IMG-N — 식별명
- 각 명세에는 종류, 비율, alt 텍스트, 프롬프트 필수
- 이미지 프롬프트에는 각 장면의 고유 내용만 적고, 시리즈 공통 색감/모델/조명/스타일은 반복하지 말 것
- 제품명 0회
- 성분명 0회
- 5대 금지어 0회
- 의약품 오인 용어 0회
- 푸터/하단/제품 페이지/구매 안내 0회
- 본문 끝에 일반 건강정보 면책 문구 포함
- 마지막에 검증 리포트 포함

품질 기준:
- 첫 300~500자는 설명이 아니라 한국 30~40대 러너가 알아볼 실제 대회/훈련 장면으로 시작
- 핵심 요약 첫 문장에서 질문에 직접 답변
- 한국 생활/대회 맥락 최소 2개 반영
- 독자를 탓하거나 혼내지 말 것
- 과한 응원, 썸네일식 과장, 친한 척하는 구어체 금지
- 과학 설명은 러너의 문제 -> 몸 안의 원리 -> 숫자/비교 -> 적용 -> 한계 순서
- 출처 없는 "연구에 따르면" 표현 금지
- 최종 출력 전 유용성 -> 신뢰 -> 웹 독해 -> 한국 독자 감성 -> AI스러움 제거 순서로 자체 편집
```
