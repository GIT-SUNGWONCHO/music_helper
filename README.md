# Music Helper 🎸

기타/베이스 연주용 **코드 악보** 웹앱. PC·태블릿·모바일 공용.
혼자 쓰다 지인 확장 목적, 무료 지향.

## 배포
https://music-helper-five.vercel.app/

Vercel에 연결 배포됨. 데이터는 Supabase(Postgres)에 저장(기기 간 동기화됨) — `.env.local`에
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` 필요, Vercel 프로젝트 환경변수에도 동일하게 설정돼 있어야 함.

## 스택
- React 18 + Vite + TypeScript
- Dexie(IndexedDB) — **로컬 우선** 저장 + JSON 내보내기/가져오기
- `@tombatossals/chords-db` — 기타 운지 다이어그램(앱 번들에 내장, 오프라인)
- vite-plugin-pwa

## 실행
```bash
npm install
npm run dev            # http://localhost:5173
npm run dev -- --host  # 같은 와이파이의 폰/태블릿에서 접속
npm run build          # 프로덕션 빌드 (tsc + vite)
```

## 데이터 모델 (마디 기반)
`Song → sections[] → bars[] → { chords: string[], lyric }` — 기타프로식 마디 구조.
- 코드는 **연주자가 실제로 잡는 그대로** 저장, `originalKey`가 조옮김 기준
- 카포/베이스 모드는 UI에서 제외(추후 재검토)

## 주요 코드
- `src/types.ts` — Song/Section/Bar 타입
- `src/db.ts` — Dexie 스키마, CRUD, newSong/newSection/newBar, export/import
- `src/music/chords.ts` — 코드 파싱·조옮김 (12음 스펠링이 chords-db와 1:1)
- `src/music/song.ts` — 마디 헬퍼(transposeBar, collectChords)
- `src/music/diagrams.ts` — chords-db 운지 조회 + 어려운 코드 판별
- `src/components/MeasureGrid.tsx` — 읽기용 마디 그리드 렌더러
- `src/components/SongEditor.tsx` — 마디 인라인 편집기
- `src/components/SongView.tsx` — 뷰어(키 조옮김·글자크기·운지도 스트립)
- `src/components/ChordDiagram.tsx` — SVG 운지 다이어그램
- `src/seed.ts` — 데모곡(Creep, 밤편지) 마디 형태

## 현재 상태 / 다음 할 일
- ✅ 마디 기반 모델·렌더러·에디터, 키 조옮김, 어려운 코드 운지도, 태그 필터, 저장/내보내기, Cal 스타일 디자인
- ⬜ **AI 자동 생성 (다음 단계)**: 곡 제목 입력 → **Gemini**(Google 검색 그라운딩 + 구조화 JSON)로 가사·섹션·마디·코드 채움 → 악보에서 손보기
  - 설정에 API 키 입력(브라우저 저장) + 프로바이더/모델 선택, 프로바이더 어댑터로 GPT/Claude 교체 가능
  - 기본 Gemini(3.5 Flash + 검색 그라운딩, 무료분 월 5,000), 어려운 곡만 상위 모델로 승급
- ⬜ 2단계: 베이스 운지 DB, 코드별 운지 직접 선택
- ⬜ 3단계: 음원 분리(Demucs, 로컬)
