# 2026 하반기 여행 캘린더

`plan.json` 한 파일을 읽어 7~12월 달력에 일정을 표시하는 정적 웹앱입니다. `plan.json`은 `index.html`과 **같은 폴더**에 둡니다. 빌드 과정이 없어 폴더 그대로 배포하면 동작합니다.

## 일정 추가/수정 방법

`plan.json` 파일만 고치면 됩니다. (이 파일 하나가 달력의 유일한 데이터 소스입니다.)

구조:

```json
{
  "title": "2026 하반기",
  "subtitle": "7월 – 12월 · 여행과 리프레시",
  "events": [
    { "start": "2026-07-28", "end": "2026-07-31", "category": "해외여행", "place": "방콕", "memo": "가족여행" },
    { "start": "2026-08-15", "category": "행사", "place": "광복절" }
  ]
}
```

- 하루 일정이면 `end`는 생략 가능
- `category`는 아래 5가지 중 하나:
  - `해외여행` (파랑) · `워케이션` (초록) · `휴가` (자홍) · `출장` (회청) · `행사` (주황)
- `memo`는 생략 가능
- `title` / `subtitle`도 생략 가능 (생략 시 기본값 사용)

> 참고: 달력은 **접속한 달부터 6개월**을 표시합니다(연도 경계 자동 처리). 예) 2026년 6월에 열면 2026년 6월–11월. 그 범위 밖 날짜의 일정은 표시되지 않습니다. 헤더 부제는 보이는 범위에 맞춰 자동으로 바뀝니다. (`plan.json`에 `title`/`subtitle`을 넣으면 고정 문구로 덮어쓸 수 있습니다.)

## Vercel 배포 (GitHub 연동 — 추천)

1. GitHub에 새 저장소를 만들고 이 폴더의 파일을 모두 올립니다.
2. [vercel.com/new](https://vercel.com/new) 에서 그 저장소를 Import 합니다.
3. Framework Preset은 **Other**(정적), Build Command 비움, Output Directory 비움(또는 `.`)으로 두고 Deploy.
4. 배포 완료 후 발급된 URL이 여러분의 여행 캘린더 주소입니다.

이후에는 GitHub에서 `plan.json`만 수정하면 Vercel이 자동으로 재배포합니다.

### 대안: Vercel CLI

```
npm i -g vercel
cd 이폴더
vercel --prod
```

명령 실행 시 안내에 따라 로그인하면 배포됩니다. (업데이트할 때마다 `vercel --prod` 재실행)
