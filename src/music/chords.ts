// Chord parsing, transposition and capo math.
// Display spelling is intentionally the SAME 12-name set that chords-db uses,
// so a transposed chord name maps 1:1 onto a diagram lookup with no enharmonic drift.

export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const

const BASE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Note name (with any # / b) -> pitch class 0..11 */
export function pitchClass(note: string): number {
  const letter = note[0]?.toUpperCase()
  if (!(letter in BASE_PC)) return NaN
  let pc = BASE_PC[letter]
  for (const ch of note.slice(1)) {
    if (ch === '#' || ch === '♯') pc++
    else if (ch === 'b' || ch === '♭') pc--
    else break
  }
  return ((pc % 12) + 12) % 12
}

export function noteFromPc(pc: number): string {
  return NOTE_NAMES[((pc % 12) + 12) % 12]
}

export function transposeNote(note: string, semitones: number): string {
  const pc = pitchClass(note)
  if (Number.isNaN(pc)) return note
  return noteFromPc(pc + semitones)
}

export interface ParsedChord {
  root: string
  quality: string
  bass?: string
}

const CHORD_RE = /^([A-G][#b♯♭]?)([^/]*)(?:\/([A-G][#b♯♭]?))?$/

export function parseChord(token: string): ParsedChord | null {
  const t = token.trim()
  const m = CHORD_RE.exec(t)
  if (!m) return null
  return { root: m[1], quality: m[2] ?? '', bass: m[3] }
}

/** Transpose a single chord token by N semitones. Non-chords pass through unchanged. */
export function transposeChord(token: string, semitones: number): string {
  if (!token) return token
  const parsed = parseChord(token)
  if (!parsed) return token // e.g. "N.C.", "%", unknown text
  const root = transposeNote(parsed.root, semitones)
  const bass = parsed.bass ? '/' + transposeNote(parsed.bass, semitones) : ''
  return root + parsed.quality + bass
}

/** Signed semitone distance from one key/root to another, e.g. G -> A = 2, G -> F = -2. */
export function keyDistance(fromKey: string, toKey: string): number {
  const a = parseChord(fromKey)?.root ?? fromKey
  const b = parseChord(toKey)?.root ?? toKey
  const d = pitchClass(b) - pitchClass(a)
  // pick the shortest signed direction in [-6, 6] so transposing reads naturally
  let s = ((d % 12) + 12) % 12
  if (s > 6) s -= 12
  return s
}
