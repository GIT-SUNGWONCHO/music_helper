// Helpers over the measure-based Song model.
import type { Bar, Section } from '../types'
import { transposeChord } from './chords'

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
