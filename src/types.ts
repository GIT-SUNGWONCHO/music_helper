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
  { value: 'want', label: '하고싶음' },
  { value: 'practicing', label: '연습중' },
  { value: 'done', label: '완료' },
]

export function statusLabel(s: PracticeStatus): string {
  return PRACTICE_STATUSES.find((x) => x.value === s)?.label ?? s
}

export interface Song {
  id: string
  title: string
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
  sections: Section[]
  createdAt: number
  updatedAt: number
}
