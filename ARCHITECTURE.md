# Music Helper — 아키텍처 설명서

> 코드를 잘 몰라도 "이 앱이 어떻게 돌아가는지" 파악할 수 있도록 작성.

---

## 한 줄 요약

**서버 없이, 브라우저 하나로 다 돌아가는 기타 코드 악보 앱.**
데이터는 내 컴퓨터(브라우저 내장 DB)에 저장. AI(Gemini)만 외부 API.

---

## 기술 스택

| 역할 | 기술 | 한마디 |
|---|---|---|
| 화면(UI) | React 18 + TypeScript | 화면 조각(컴포넌트)을 조합해서 앱을 만드는 방식 |
| 빌드 도구 | Vite | 코드 저장하면 브라우저에 즉시 반영해주는 개발 서버 |
| 로컬 DB | IndexedDB + Dexie.js | 브라우저 안에 내장된 DB. 앱을 꺼도 데이터 유지됨 |
| AI 생성 | Google Gemini API | 곡 제목 → 악보 JSON 자동 생성. 유일하게 인터넷 필요 |
| 운지 DB | @tombatossals/chords-db | 기타 코드별 손가락 위치. 앱 안에 번들로 내장됨 |
| PWA | vite-plugin-pwa | 오프라인에서도 작동, 홈 화면에 설치 가능 |

**백엔드(서버): 없음.** 모든 코드가 브라우저에서 실행됨.

---

## 화면 흐름

```
목록(SongList)
    │
    ├─── 곡 선택 ──▶ 뷰어(SongView)  ──▶ 편집(SongEditor)
    │
    ├─── [+ 새 곡]  ──────────────────▶ 편집(SongEditor)
    │
    └─── [✨ AI 생성]  ──▶ GenerateModal ──▶ 편집(SongEditor)
```

항상 편집기로 끝남. 생성하든 불러오든 마지막엔 직접 손보는 구조.

---

## 데이터 구조

```
Song (곡)
├── title, artist, originalKey, tempo
├── moodTags[], genreTags[], status
└── sections[] (섹션: Verse, Chorus, Bridge…)
        └── bars[] (마디 하나하나)
                ├── chords: ["G", "Em"]   ← 이 마디에서 치는 코드
                └── lyric: "눈을 감으면"   ← 이 마디 아래 가사
```

기타프로(GuitarPro)처럼 **마디 단위**로 쪼갠 게 특징.
코드와 가사가 마디별로 묶여 있어서 조옮김도 마디째로 처리됨.

---

## 파일 구조 설명

```
src/
├── types.ts          ← 위의 데이터 구조(Song/Section/Bar)를 TypeScript로 정의
├── db.ts             ← 저장·불러오기·삭제·export/import (Dexie 사용)
├── App.tsx           ← 화면 전환 (list / view / edit) 담당
├── seed.ts           ← 앱 첫 실행 시 뜨는 데모곡 (Creep, 밤편지)
│
├── components/       ← 화면 조각들 (.tsx = 화면 있는 파일)
│   ├── SongList      ← 곡 목록, 검색, 태그 필터
│   ├── SongView      ← 악보 읽기 (키 조옮김, 글자 크기, 운지도)
│   ├── SongEditor    ← 마디 직접 편집
│   ├── MeasureGrid   ← 마디 그리드 렌더러 (SongView 안에서 사용)
│   ├── ChordDiagram  ← SVG로 그리는 운지 다이어그램
│   ├── GenerateModal ← AI 생성 팝업
│   └── SettingsModal ← Gemini API 키 설정 팝업
│
├── ai/               ← AI 관련 코드 (.ts = 화면 없는 로직 파일)
│   ├── generate.ts   ← Gemini 호출, 프롬프트, JSON → Song 변환
│   ├── settings.ts   ← API 키·모델 설정 저장/불러오기 (localStorage)
│   └── usage.ts      ← 토큰 사용량 집계
│
└── music/            ← 음악 순수 로직
    ├── chords.ts     ← 코드명 파싱, 12음 조옮김 계산
    ├── diagrams.ts   ← chords-db에서 운지 조회, 어려운 코드 판별
    └── song.ts       ← 마디 단위 헬퍼 (조옮김, 코드 목록 추출)
```

---

## .ts vs .tsx 구분

| 확장자 | 뜻 | 언제 씀 |
|---|---|---|
| `.ts` | TypeScript | 화면(HTML) 없는 순수 로직. 계산, DB, API 호출 |
| `.tsx` | TypeScript + JSX | 화면을 렌더링하는 컴포넌트. HTML처럼 생긴 코드가 들어감 |

---

## AI 생성 흐름

```
사용자: 곡 제목 입력
       ↓
GenerateModal → generate.ts
       ↓
Gemini API (구글) 호출
  - 웹 검색 그라운딩으로 실제 가사/코드 검색
  - 마디 단위 JSON 반환 요청
       ↓
JSON 파싱 → Song 객체로 변환
       ↓
IndexedDB에 저장 → SongEditor로 자동 이동
```

API 키는 내 브라우저 localStorage에만 저장됨. 서버로 전송 안 됨.

---

## 다음 개발 예정

1. **베이스 운지 DB** — 코드별 운지 직접 선택
2. **음원 분리** — Demucs(AI)로 로컬에서 반주/보컬 분리
