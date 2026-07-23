# Music Helper — 디자인 토큰/규칙

이 문서는 "완성된 최종 디자인"이 아니라 **바꾸기 쉬운 살아있는 참고 자료**다. 값 하나를 바꾸면 그 토큰을 쓰는 모든 곳이 같이 바뀌는 게 목적이지, 매번 전체를 다시 짜라는 뜻이 아니다.

**새 화면/기능을 만들 때는 여기 있는 걸 먼저 재사용하고, 없을 때만 새로 만든다.** 새로 만들면 이 파일에도 추가한다.

## 색 토큰 (`src/styles.css` `:root`)

| 토큰 | 값 | 의미 |
|---|---|---|
| `--accent` | `#f3701e` (주황) | 버튼/탭/포커스링 등 인터랙션 전반. "이건 클릭 가능"을 뜻하는 색 |
| `--accent-soft` | `color-mix(accent 65%, white)` | accent보다 밝은 파생값 — 강조 텍스트, hover 등 |
| `--accent-dim` | `color-mix(accent 55%, black)` | accent보다 어두운 파생값 |
| `--accent-ink` | `#1a120b` | accent 배경(꽉 찬 버튼) 위에 올라가는 텍스트색 |
| `--chord` | `#a8583f` (톤 낮춘 주황/테라코타), 기본값. **런타임에 owner별로 오버라이드됨** | **코드명 전용.** `src/chordColor.ts`(프리셋+커스텀 피커, `ChordColorModal.tsx`)가 owner별 localStorage 값을 읽어 `document.documentElement.style.setProperty('--chord', ...)`로 덮어씀. 설정(PIN)과 분리된 진입점(헤더 "코드색" 버튼) — 성원/민형 둘 다 비밀번호 없이 바로 바꿀 수 있음 |
| `--teal` | `#3a9ca0` | AI 생성 관련 액션 전용(스파클 버튼 등). accent(주황)와 색상군 자체가 달라 항상 구분됨 |
| `--amber` | `#d8a13a` | 연습상태 "연습중", 경고(`.notice--warn`) 등 |
| `--st-want` / `--st-practicing` / `--st-done` | `#b8455f` / `var(--amber)` / `#4f9d6e` | 연습 상태 3종 색 |
| `--danger` | `#e0685a` | 삭제 등 파괴적 액션 |
| `--bg` / `--bg-row` / `--bg-card` / `--bg-elev` | 다크 배경 4단계 | 레이어 깊이 표현(뒤→앞 순) |
| `--text` / `--muted` / `--faint` | 크림 텍스트 3단계 | 정보 위계(본문 → 보조 → 흐림) |
| `--border` / `--border-soft` / `--border-strong` | 크림톤 반투명 보더 3단계 | 구분선 강도 |

**색 사용 원칙**: `--accent`(인터랙션)와 `--chord`(데이터)는 절대 같은 색으로 되돌리지 않는다 — 이 둘을 분리한 게 이번 정리의 핵심이었다(전에는 `--chord: var(--accent)`라 코드명이 곧 버튼색이었고, "클릭 가능"과 "그냥 데이터"가 구분이 안 됐음).

## 여백 스케일

```
--sp-1: 4px   --sp-2: 8px   --sp-3: 12px   --sp-4: 16px   --sp-5: 24px
```

padding/gap을 정할 때 이 다섯 값 중 하나를 쓴다. 애매하면 `--sp-3`(카드/행 안쪽) 또는 `--sp-4`(모달/툴바 안쪽)가 기본값.

## Radius 스케일

| 토큰 | 값 | 용도 |
|---|---|---|
| `--r-xs` | 6px | 작은 컨트롤(세그먼트 버튼, 셀렉트) |
| `--r-sm` | 8px | 기본 버튼/인풋/카드 |
| `--r` | 12px | 큰 카드, 모달 상단 |
| `--r-lg` | 16px | FAB, 강조 카드 |

하드코딩한 px 값(4/5/6px 등) 대신 항상 이 토큰을 쓴다.

## 폰트

- `--font-sans`: Pretendard 우선, 일반 텍스트/제목
- `--font-mono`: Space Mono 우선, 코드명/라벨/숫자류(DAW스러운 느낌의 핵심)
- `--font-display`: Bebas Neue, 브랜드 워드마크(GENCHRD.) 전용

## 버튼 (4티어)

| 티어 | 클래스 | 용도 |
|---|---|---|
| Primary | `.btn.btn--primary` | 화면/모달당 하나뿐인 핵심 CTA (저장/생성/확인) |
| Secondary-Strong | `.btn` (기본) | 뚜렷한 탐색/유틸 액션 (← 목록, 취소, 합치기/나누기) |
| Secondary-Quiet | `.btn.btn--ghost` | 옆에 있는 강한 액션 대비 낮은 비중 (복제, 원키 되돌리기) |
| Icon | `.btn.btn--icon` | +/− 스테퍼, ↑/↓ 이동, 모달 닫기 ✕ |

- `--sm`: 목록형/반복형 맥락에서만(헤더 유틸 버튼, "만들기" 등). 화면의 유일한 주 액션/뒤로가기에는 쓰지 않는다.
- `--lg`: 첫 실행처럼 화면 전체가 큰 선택 하나뿐인 경우(OwnerPicker)
- **삭제(destructive) 버튼**: 하위 항목 개별 삭제 = `.btn--icon.btn--danger`(✕). 곡/셋리스트 같은 상위 개체 전체 삭제 = `.btn--ghost.btn--danger`(사이즈 기본, `--sm` 금지), **항상 화면 상단 툴바**에 위치 — 뷰어/에디터 둘 다 동일한 자리·크기.

## 인풋 (2종)

- **박스형** (`.field input`, `.field select`, `.search`, `.text-input`): 폼 필드, 검색창, 독립적인 텍스트 입력 전부 이 하나의 규칙 공유(`--r-sm`, `9px 11px`, sans 0.9rem). `.field` 래퍼 안의 input/select는 자동으로 이 스타일이 적용되니, `.field` 밖에서 쓰는 단독 input에는 `.text-input`을 붙인다.
- **밑줄형** (`.text-underline`): 제목처럼 큰 글씨로 그 자리에서 바로 고치는 인라인 편집(셋리스트 이름 등).
- `.field`/`.search`/`.text-input`/`.text-underline` 밖에 새 input을 만들 때는 반드시 이 중 하나를 붙인다 — className 없는 input은 브라우저 기본(라이트) 스타일로 노출되는 실버그가 된다.

## 연습상태 배지

색/점(`status-dot status-dot--{want|practicing|done}`)은 어디서나 동일 — 라이브러리 필터 pill, 뷰어 배지(`.chip.chip--status.chip--{status}`), 에디터 세그먼트 버튼(`.seg__btn--{status}`) 셋 다 같은 점+색을 쓴다. 컨테이너 모양(알약/칩/세그먼트)은 맥락에 따라 달라도 된다 — 인터랙션이 다르기 때문(필터=다중선택, 에디터=단일선택).

## 아이콘

- **삭제(×)**: `.icon-x` (그리드 셀 모서리에 얹는 18×18 페이드인 버튼 — `.diagram-cell__x`, `.bar__x`). 리스트 행처럼 항상 보여야 하고 탭 영역이 커야 하면 `.icon-x.icon-x--lg` (`.row__del`). 사진 위에 얹는 `.ref-thumb__x`만 예외 — 사진 대비를 위해 반투명 어두운 배경을 쓰되 다크테마 토큰(`--bg`/`--text`) 기반으로 유지.
- **추가**: `.chord-add`(점선 알약)가 기준 색 문법(idle=`--border-strong`+`--muted`, hover=`--accent` 보더+`--accent-soft` 색) — `.ref-add`(점선 정사각형), `.bar--add`(그리드 셀)도 hover 시 같은 보더/텍스트 색을 쓴다. 모양은 맥락에 따라 다르지만 색은 통일.
- **모달 닫기 vs 인라인 패널 접기**: 진짜 모달을 닫을 때만 ✕. 인라인 하위 패널(코드 운지 선택기 등)을 접을 때는 셰브런(▲) 아이콘으로 구분한다.
- **추가/복원 어포던스**: 클릭해서 담는 칩(`.chip.chip--restore`)은 항상 `이름 +` 형태로 텍스트에 `+`를 붙여 "클릭하면 추가/복원됨"을 표시한다.
- **목록 안에서 새로 만들기**: "만들기" 액션은 아이콘/색 버튼이 아니라 인풋 옆에 붙는 평범한 `.btn.btn--sm`(무채색) 버튼, 라벨은 `+`(예: 셋리스트 만들기). 화려하게 만들지 않는다.

## 코드 다이어그램

운지 점(`.dg-dot`)·바레(`.dg-barre`)는 `--accent-soft`(옅은 주황) 고정 — `--chord`가 아니다. 코드표에서 "지금 여기를 누르라"는 위치 안내는 인터랙션 신호에 가까워서 accent 계열을 쓴다.

## 확인 모달

삭제처럼 되돌릴 수 없는 동작은 브라우저 기본 `confirm()`을 쓰지 않고 `<ConfirmModal title message confirmLabel danger onConfirm onCancel />`을 쓴다(기존 `.modal`/`.modal__card` 패턴 재사용). 확정 버튼이 파괴적이면 `danger` prop → `.btn--primary.btn--danger`(꽉 찬 빨강)로 렌더링됨.

## 컨트롤 그룹 카드화

여러 컨트롤 그룹(글자/키/카포/마디 등)이 한 줄에 나열될 때는 그룹마다 `.ctrl`에 옅은 배경+보더를 줘서 어디까지가 한 그룹인지 시각적으로 구분한다(라벨 텍스트만으로 구분하지 않음).
