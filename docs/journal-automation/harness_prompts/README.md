# 하네스 프롬프트

> 발행 매핑 가이드의 Step 1~3을 Claude Project에서 반복 실행할 때 쓰는 복붙용 프롬프트.
> 목적은 글마다 결과물의 구조, 파일명, 이미지 명세, 검증 리포트가 흔들리지 않게 고정하는 것이다.

## 파일 목록

| 파일 | 용도 | 기본 산출물 |
|---|---|---|
| `AUTO_JOURNAL_START_PROMPT.md` | 주제 선정부터 Claude가 스스로 진행 | 다음 미완료 Journal `.md` 1개 |
| `FIRST_JOURNAL_01A_COPY_PROMPT.md` | 첫 글을 빠르게 시작하는 복붙용 요약 프롬프트 | `journal-01-a.md` |
| `step1_journal_a_master_prompt.md` | Journal №X-A 마스터 작성 | 자사몰 Journal A `.md` 1개 |
| `step2_naver_cluster_from_journal_a_prompt.md` | Journal A의 H2 2개를 네이버 TOFU 클러스터 2편으로 변환 | 네이버 `.md` 2개 |
| `step3_journal_b_master_prompt.md` | Journal №X-B 마스터 작성 | 자사몰 Journal B `.md` 1개 |

## 사용 순서

1. Claude Project에 기존 `project_knowledge/` 문서와 `custom_instructions_추가.md`를 업로드한다.
2. 실행하려는 단계의 하네스 프롬프트를 새 대화 첫 메시지로 붙여넣는다.
3. 자율 시작 프롬프트는 입력값을 채우지 않는다. 나머지 하네스는 프롬프트 상단의 `<입력값>` 블록만 채운다.
4. Claude 출력의 `검증 리포트`가 모두 PASS인지 확인한다.
5. Journal 산출물은 사용자가 읽고 검토한 뒤 `content/draft/`로 넘긴다.
6. 파일명은 반드시 `journal-NN-X.md` 형식으로 저장한다. 첫 글은 `journal-01-a.md`다.

## 균일화 원칙

- 모든 하네스는 `입력값 -> 작업 순서 -> 출력 계약 -> 검증 리포트` 순서를 갖는다.
- 출력은 항상 마크다운 파일 단위로 분리한다.
- 이미지 마커는 항상 `[IMG-N: 식별명]` 단독 줄이다.
- 이미지 명세는 항상 `## 이미지 명세` 아래 `### IMG-N — 식별명` 순서다.
- 제품명, 성분명, 5대 금지어, 의약품 오인 용어는 금지한다.
- Codex가 처리할 Journal 파일명은 반드시 `journal-`로 시작한다.
- Codex PR은 `codex/journal-...` 브랜치와 `journal-ready` 라벨을 사용한다.
- SEO/AEO는 키워드 반복이 아니라 질문에 대한 직접 답변, 명확한 H2, FAQ, 비교표, alt 텍스트로 구현한다.
- 글은 실제 러너의 흔한 문제에서 시작하고, 과학 기반 설명을 거쳐 일상 적용으로 닫는다.
- 한국 30~40대 러너가 바로 알아볼 생활/대회 맥락을 최소 2개 반영한다.
- 독자를 탓하거나 혼내지 않고, 과한 응원/썸네일식 과장/친한 척하는 구어체를 피한다.
- 최종 편집은 `유용성 -> 신뢰 -> 웹 독해 -> 한국 독자 감성 -> AI스러움 제거` 순서로 본다.
- AI처럼 과도하게 균일한 문체를 피하되, 일부러 틀린 문장이나 과한 구어체를 만들지는 않는다.
