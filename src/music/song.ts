// Helpers over the measure-based Song model.
import type { Bar, Section } from '../types'
import { transposeChord } from './chords'

/** 보기 전용 마디 재구성. step>0: 2^step개씩 합침(코드·가사 결합), step<0: 각 마디를 2^|step|개로 나눔.
 *  원본 데이터는 건드리지 않고 표시용 사본만 반환. */
export function regroupSections(sections: Section[], step: number): Section[] {
  if (step === 0) return sections
  return sections.map((sec) => ({ ...sec, bars: regroupBars(sec.bars, step) }))
}

function regroupBars(bars: Bar[], step: number): Bar[] {
  if (step > 0) {
    const g = 2 ** step
    const out: Bar[] = []
    for (let i = 0; i < bars.length; i += g) {
      const grp = bars.slice(i, i + g)
      out.push({
        id: grp[0].id,
        chords: grp.flatMap((b) => b.chords),
        lyric: grp.map((b) => b.lyric).filter(Boolean).join(' '),
      })
    }
    return out
  }
  const g = 2 ** -step
  const out: Bar[] = []
  for (const b of bars) {
    out.push(b)
    for (let k = 1; k < g; k++) out.push({ id: `${b.id}_s${k}`, chords: [], lyric: '' })
  }
  return out
}

export function transposeBar(bar: Bar, semitones: number): Bar {
  if (semitones === 0) return bar
  return { ...bar, chords: bar.chords.map((c) => transposeChord(c, semitones)) }
}

/** Distinct chords used across the song (after transposition), order-preserving. */
export function collectChords(sections: Section[], semitones: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const sec of sections) {
    for (const bar of sec.bars) {
      for (const raw of bar.chords) {
        const c = transposeChord(raw, semitones)
        if (!seen.has(c)) {
          seen.add(c)
          out.push(c)
        }
      }
    }
  }
  return out
}
