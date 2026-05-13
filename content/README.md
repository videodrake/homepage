# content 폴더 사용법

## draft

Claude Project가 만든 `.md`를 사용자가 검토한 뒤 넣는 곳.

```text
content/draft/journal-XX-X.md
```

실제 작업 대기 폴더다. 샘플 파일을 여기에 두지 않는다.

## CONTENT_STATE.md

Git 기준 콘텐츠 진행 원장이다. Claude Project가 GitHub/Git 저장소를 읽을 수 있으면 이 파일을 최우선으로 보고 다음 Journal 주제를 결정한다.

```text
content/CONTENT_STATE.md
```

## CONTENT_LOG.md

Git 기준 발행 로그 원본이다. 최종 배포 후 Claude Code가 이 파일을 갱신한다. Project Knowledge에 들어가는 `콘텐츠_발행_로그.md`는 Git 접근이 안 될 때 쓰는 백업본이다.

```text
content/CONTENT_LOG.md
```

## processing

Codex 파이프라인 중간 산출물 자리. 사용자가 직접 만지지 않는다.

## published

Codex가 이미지 마커를 실제 이미지 링크로 치환한 발행 준비본을 넣는 곳.

```text
content/published/journal-XX-X.md
```

## rejected

검증 실패 또는 규제 실패 파일 격리 자리.

## examples

검증용 샘플 산출물 보관 자리. 실제 자동화 입력으로 쓰지 않는다.

```text
content/examples/journal-01-a/
```
