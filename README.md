# follow up & schedule

Notion의 **followup** 영역을 상단 글머리표 목록으로, **Schedule** 영역을 하단 달력으로 표시합니다.

달력 범위는 방문자의 현재 날짜가 속한 달부터 **3개월**입니다. 예를 들어 2026년 9월에는 9~11월, 12월에는 2026년 12월~2027년 2월을 표시합니다. 해당 월 안의 일정은 지난 날짜를 포함해 표시합니다.

## 구성

- `index.html`: React로 목록과 달력을 표시합니다.
- `api/notion.js`: Vercel 서버에서 Notion 페이지를 읽습니다.
- `lib/notion-content.js`: 두 제목 아래 텍스트를 목록과 일정으로 변환합니다.
- `plan.json`과 `plans/`는 기존 자료로 남아 있지만 화면에서 읽지 않습니다.

추가 라이브러리 설치나 빌드 과정은 필요 없습니다. **Notion API를 호출하는 서버 기능이 있으므로 GitHub Pages나 단순 파일 열기만으로는 동작하지 않습니다.**

## Vercel에서 한 번 설정하기

1. [Notion 연결 관리](https://www.notion.so/profile/integrations)에서 이 사이트용 Internal connection을 만들고 **Read content** 권한을 부여합니다.
2. Notion의 **FollowUp** 페이지에서 연결을 추가해 페이지 읽기를 허용합니다. 페이지 자체를 웹에 공개할 필요는 없습니다.
3. 기존 Vercel `refresh` 프로젝트의 **Settings → Environment Variables**에 다음 값을 추가합니다.
   - `NOTION_TOKEN`: 위 연결의 API 인증키. **Production**에 적용합니다. Preview 배포에서도 확인하려면 Preview에도 적용합니다.
   - `NOTION_PAGE_ID`: 선택 사항. 기본값은 `3befd6b6-3b07-80fd-9c0f-fc14838a1d87`입니다.
4. Vercel 설정은 **Framework Preset: Other**, **Build Command: 비움**, **Output Directory: 기본값**을 사용합니다. 기존 환경변수 변경 후에는 **Redeploy**하여 적용합니다.
5. 웹사이트를 새로고침해 목록과 일정을 확인합니다. `/api/notion`이 200 응답으로 `followup`, `events`, `warnings`를 반환하면 연결된 상태입니다.

ChatGPT의 Notion 연결과 배포된 웹사이트의 인증키 설정은 별개입니다. 인증키를 HTML, GitHub 또는 대화에 붙여 넣지 마세요. 실제 키는 Vercel 환경변수에만 저장합니다.

이 API는 위 페이지의 두 영역만 반환합니다. 웹사이트에 접근 가능한 사람에게 해당 두 영역의 내용이 표시됩니다.

## Notion 작성 형식

두 영역은 Notion의 제목 블록(제목 1, 2, 3)으로 구분합니다. 제목은 대소문자를 구분하지 않으며 `followup`과 `follow up` 모두 지원합니다. 같은 단계 또는 상위 단계의 다른 제목을 만나면 해당 영역 읽기를 끝냅니다.

### followup

제목 아래 글머리표 또는 일반 텍스트를 작성합니다. 순서와 내용을 유지해 화면의 글머리표로 표시합니다.

### Schedule

한 글머리표에 일정 하나를 작성합니다. 현재 작성한 중괄호 없는 형식과 아래 JSON 객체 형식을 모두 지원합니다.

```text
"start": "2026-11-03", "end": "2026-11-07", "category": "휴가", "place": "파타야", "memo": "해외여행"
```

- `start`: 필수, `YYYY-MM-DD` 형식.
- `end`: 선택, 생략하면 하루 일정. 종료일도 일정에 포함됩니다.
- `category`: 필수. `해외여행`, `워케이션`, `휴가`, `출장`, `행사`는 기존 색상을 사용하고 다른 분류는 회색으로 표시합니다.
- `place`: 필수, 달력에 표시할 이름.
- `memo`: 선택, 보조 설명.

잘못된 날짜나 형식의 일정은 제외하고 화면에 해당 항목 번호를 안내합니다. Notion 연결 실패는 별도로 표시하며 이전 파일 데이터로 대체하지 않습니다.

Notion 내용을 수정한 뒤 웹사이트를 새로고침하면 다시 읽습니다. 화면을 열어둔 상태에서 자동 갱신하지 않습니다.

## 검증

Node.js 22 이상에서 `node --test tests/*.test.js`로 파서와 API의 응답 처리를 검증할 수 있습니다.

공식 참고: [Notion API](https://developers.notion.com/), [인증키 관리](https://developers.notion.com/guides/get-started/handling-api-keys), [Vercel Functions](https://vercel.com/docs/functions).
