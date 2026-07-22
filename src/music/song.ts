// Helpers over the measure-based Song model.
import type { Bar, Section } from '../types'
import { transposeChord } from './chords'

/** 화면 표시용 마디. 합쳐진 경우 원래 마디별로 코드를 슬롯으로 나눠 보존해
 *  각 원래 마디가 합쳐진 마디 안에서 자기 몫의 폭을 차지하도록 한다. */
export interface DisplayBar {
  id: string
  lyric: string
  /** 원래 마디 단위로 나뉜 코드 그룹. 합쳐지지 않았으면 슬롯 1개. */
  slots: string[][]
}

export interface DisplaySection {
  id: string
  label: string
  bars: DisplayBar[]
}

/** 보기 전용 마디 재구성. step>0: 2^step개씩 합침(원래 마디는 슬롯으로 보존), step<0: 각 마디를 2^|step|개로 나눔.
 *  원본 데이터는 건드리지 않고 표시용 사본만 반환. */
export function regroupSections(sections: Section[], step: number): DisplaySection[] {
  return sections.map((sec) => ({ id: sec.id, label: sec.label, bars: regroupBars(sec.bars, step) }))
}

function regroupBars(bars: Bar[], step: number): DisplayBar[] {
  if (step > 0) {
    const g = 2 ** step
    const out: DisplayBar[] = []
    for (let i = 0; i < bars.length; i += g) {
      const grp = bars.slice(i, i + g)
      out.push({
        id: grp[0].id,
        // 원래 마디별로 슬롯을 나눠서, 각 마디가 합쳐진 마디 안에서 자기 폭(1/그룹크기)만 차지하게 함
        slots: grp.map((b) => b.chords),
        lyric: grp.map((b) => b.lyric).filter(Boolean).join(' '),
      })
    }
    return out
  }
  if (step < 0) {
    const g = 2 ** -step
    const out: DisplayBar[] = []
    for (const b of bars) {
      out.push({ id: b.id, lyric: b.lyric, slots: [b.chords] })
      for (let k = 1; k < g; k++) out.push({ id: `${b.id}_s${k}`, lyric: '', slots: [[]] })
    }
    return out
  }
  return bars.map((b) => ({ id: b.id, lyric: b.lyric, slots: [b.chords] }))
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
