# Pipeline Contract

이 문서는 Journal 자동화 파이프라인이 기대하는 입력, 출력, 실패 조건을 정의한다.

## 입력

Claude가 만든 markdown 파일을 `content/inbox/`에 넣는다.

예:

```text
content/inbox/journal_01_A_with_images.md
```

문서에는 본문 플레이스홀더와 이미지 명세가 있어야 한다.

본문 예:

```markdown
[IMG-1: 도입부 헤더]
```

이미지 명세 예:

```markdown
## 이미지 명세

### IMG-1 — 도입부 헤더

- **종류**: 분위기 사진
- **위치**: 제목 직후, 핵심 요약박스 직전
- **위치 의도**: 글의 첫인상
- **비율**: 21:9
- **alt 텍스트**: "마라톤 30km 표지판을 지나는 러너의 새벽 풍경"
- **캡션**: "30km. 풀코스의 약 70% 지점."

**프롬프트 (GPT Image 2)**:
> A cinematic editorial photograph...
```

## 폴더 상태 전이

```text
content/inbox/
→ content/processing/
→ content/processed/   성공
→ content/failed/      실패
```

성공한 원본 markdown은 `content/processed/`로 이동한다. 실패한 원본 markdown은 `content/failed/`로 이동한다.

## 성공 산출물

성공 시 다음 파일들이 생성되어야 한다.

```text
content/published/{journal_id}.md
content/processed/{journal_id}.md
assets/{journal_id}/img-1.png
assets/{journal_id}/img-1.prompt.txt
logs/{journal_id}_boxes.json
logs/{journal_id}_image_generation.log
logs/{journal_id}_pipeline.json
logs/{journal_id}_regulation.yaml
logs/{journal_id}_review.html
```

`dry-run` adapter에서는 `img-*.png`가 placeholder이고, 실제 생성용 prompt는 `img-*.prompt.txt`에 저장된다.

## 실패 산출물

실패 시 다음 중 하나가 생성된다.

```text
content/failed/{source_file}.md
logs/{source_file}_automation_failure.json
logs/{journal_id}_regulation.yaml
```

실패한 경우 publish PR을 만들지 않는다.

## 차단 조건

아래 조건 중 하나라도 발생하면 실패로 처리한다.

- 이미지 명세를 파싱할 수 없음
- `[IMG-n]` placeholder와 `### IMG-n` 명세가 불일치
- 이미지 번호가 1부터 연속되지 않음
- 필수 필드 누락: 종류, 위치, 위치 의도, 비율, alt 텍스트, 캡션, 프롬프트
- 생성 이미지 파일 누락
- 생성 이미지 파일 크기 0 byte
- 본문 치환 후 `[IMG-n]` placeholder가 남음
- 본문 치환 후 `## 이미지 명세` 부록이 남음
- 규제 검사 FAIL

## 규제 검사

PR 생성 전 6개 항목을 검사한다.

1. 지구력 코어 계열 표현 0회
2. 옥타코사놀 0회
3. 5대 금지어 0회
4. 의약품 오인 용어 0회
5. 푸터 안내 문장 0건
6. 면책 문구 존재

검사 결과는 `logs/{journal_id}_regulation.yaml`에 저장한다.

## PR 생성 조건

PR을 만들려면 다음 조건을 모두 만족해야 한다.

- `logs/{journal_id}_pipeline.json` 존재
- `images_expected == images_generated`
- `regulation_status == PASS`
- `content/published/{journal_id}.md` 존재
- `logs/{journal_id}_review.html` 존재

PR은 draft로 만들고 사람이 최종 검수한다.

