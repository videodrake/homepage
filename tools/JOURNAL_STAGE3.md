# Onroad Journal publishing adapter

이 저장소의 러닝 노트는 정적 개별 URL을 가진 글로 발행됩니다. 검색엔진이 읽을 수 있고, 모든 글 하단에서 지구력코어 상품 페이지로 연결됩니다.

## 발행 흐름

1. `content/published/<slug>.md`에 최종 원고를 저장합니다.
2. 이미지는 `assets/<slug>/img-N.png`에 저장합니다.
3. 원고의 frontmatter에 `category`, `date_drafted`, `image_count`를 입력합니다.
4. 아래 명령으로 규제 검사와 스킨 생성을 함께 실행합니다.

```powershell
node tools/build-journal-cafe24.mjs content/published/<slug>.md --slug <slug> --write-cafe24
```

기본 대상은 `skin9`입니다. 다른 스킨을 사용할 때만 `--skin-dir <folder>`를 추가합니다.

## 자동으로 갱신되는 파일

- `skin9/journal/<slug>.html`
- `skin9/SkinImg/img/journal/<slug>/`
- `skin9/journal/index.html`
- `skin9/sitemap.xml`

글 목록, 검색 필터, 카테고리 수, 최신 글 영역과 사이트맵은 새 글을 발행할 때 자동 갱신됩니다.

## 권장 카테고리

- `마라톤 준비`
- `훈련 루틴`
- `대회 준비`
- `계절 러닝`
- `러닝 과학`

카테고리를 무분별하게 늘리지 말고 위 다섯 개 안에서 선택합니다.

## 안전 기준

`regulation_check.py`를 우회하지 않습니다. 일반 러닝 정보와 제품의 기능성은 구분하고, 피로회복·즉효·운동 성과 보장·질병 예방 및 치료 표현은 사용하지 않습니다.
