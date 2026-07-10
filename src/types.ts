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

export interface Song {
  id: string
  title: string
  artist: string
  /** Key the chords are written in (transpose reference). e.g. "C", "G", "Bb". */
  originalKey: string
  /** 빠르기 BPM (0/undefined = 미표기) */
  tempo?: number
  /** 장르 / 기분 / 악기구성 등 자유 태그 */
  tags: string[]
  sections: Section[]
  createdAt: number
  updatedAt: number
}
