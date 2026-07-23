/** One measure (마디). Holds the chord(s) played in it and the lyric fragment under it. */
export interface Bar {
  id: string
  /** 0..N chord tokens in this bar. Usually 1, sometimes 2 (e.g. Gsus4 → G). Empty = hold / no change. */
  chords: string[]
  /** Lyric fragment sung under this bar. Empty for instrumental bars. */
  lyric: string
}

export interface Section {
  id: string
  /** Verse / Chorus / Bridge / Intro / Interlude / Outro ... */
  label: string
  bars: Bar[]
}

/** 연습 상태 플래그 — 곡마다 하나. */
export type PracticeStatus = 'want' | 'practicing' | 'done'

export const PRACTICE_STATUSES: { value: PracticeStatus; label: string }[] = [
  { value: 'want', label: '연습대기' },
  { value: 'practicing', label: '연습중' },
  { value: 'done', label: '완료' },
]

export function statusLabel(s: PracticeStatus): string {
  return PRACTICE_STATUSES.find((x) => x.value === s)?.label ?? s
}

export interface Song {
  id: string
  title: string
  /** 같은 제목 다른 편곡을 구분하는 짧은 태그 (예: "남키", "어쿠스틱"). 제목 본문에는 넣지 않음. */
  version?: string
  artist: string
  /** Key the chords are written in (transpose reference). e.g. "C", "G", "Bb". */
  originalKey: string
  /** 빠르기 BPM (0/undefined = 미표기) */
  tempo?: number
  /** 분위기 태그 (예: 잔잔, 신나는, 우울) */
  moodTags: string[]
  /** 장르 태그 (예: Rock, Ballad, City Pop) */
  genreTags: string[]
  /** 연습 상태 */
  status: PracticeStatus
  /** 카포 프렛 (0 = 카포 없음) — 저장 코드는 사운딩 코드, 뷰에서 운지 코드로 변환 */
  capoFret?: number
  /** 코드명 → 선택한 운지 인덱스 (chords-db positions 배열 기준) */
  fingerings?: Record<string, number>
  /** 코드표 스트립에서 숨긴 코드명 목록 */
  hiddenChords?: string[]
  /** 사용자가 직접 추가한 코드표 코드명 목록 */
  pinnedChords?: string[]
  sections: Section[]
  createdAt: number
  updatedAt: number
}

/** Set List(셋리스트) — 합주/연습용으로 곡을 모아 순서까지 정해놓는 모음. */
export interface SetList {
  id: string
  name: string
  /** 순서가 있는 곡 id 목록 */
  songIds: string[]
  createdAt: number
  updatedAt: number
}
