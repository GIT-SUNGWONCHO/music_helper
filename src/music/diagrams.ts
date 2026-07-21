// Map a chord token to a guitar fingering shape from chords-db.
import guitarDb from '@tombatossals/chords-db/lib/guitar.json'
import { parseChord, pitchClass, NOTE_NAMES } from './chords'

export interface ChordPosition {
  frets: number[] // per string, low-E first. -1 = muted, 0 = open, n = fret number
  fingers: number[]
  baseFret: number
  barres: number[]
  capo?: boolean
}

interface DbSuffix {
  suffix: string
  positions: ChordPosition[]
}

const db = guitarDb as unknown as {
  main: { strings: number; fretsOnChord: number }
  chords: Record<string, DbSuffix[]>
}

export const GUITAR_STRINGS = db.main.strings
export const FRETS_ON_CHORD = db.main.fretsOnChord

// chords-db uses these root keys: C Csharp D Eb E F Fsharp G Ab A Bb B
const DB_ROOT: Record<string, string> = {
  'C#': 'Csharp',
  'F#': 'Fsharp',
}

function dbRootKey(root: string): string | null {
  // normalize enharmonic to the db's canonical 12-name spelling first
  const pc = pitchClass(root)
  if (Number.isNaN(pc)) return null
  const canonical = NOTE_NAMES[pc]
  return DB_ROOT[canonical] ?? canonical
}

// map a chord quality string to a db suffix name
function dbSuffix(quality: string): string[] {
  const q = quality.trim()
  if (q === '' || q === 'M' || q === 'maj' || q === 'major') return ['major']
  if (q === 'm' || q === 'min' || q === '-' || q === 'minor') return ['minor']
  const alias: Record<string, string> = {
    M7: 'maj7',
    'Δ': 'maj7',
    'Δ7': 'maj7',
    mM7: 'mmaj7',
    mMaj7: 'mmaj7',
    '+': 'aug',
    '°': 'dim',
    'ø': 'm7b5',
    sus: 'sus4',
    '2': 'sus2',
  }
  if (alias[q]) return [alias[q]]
  // otherwise assume the quality already matches a db suffix (7, m7, sus4, add9, 9, maj9, ...)
  // provide graceful fallbacks by stripping trailing extensions
  const fallbacks = [q]
  if (q.startsWith('m') && q !== 'major') fallbacks.push('m7', 'minor')
  else fallbacks.push('7', 'major')
  return fallbacks
}

export interface DiagramResult {
  name: string
  position: ChordPosition
  strings: number
  exact: boolean
}

/** 코드 토큰의 모든 운지(positions)를 반환. */
export function getPositions(token: string): { positions: ChordPosition[]; exact: boolean } | null {
  const parsed = parseChord(token)
  if (!parsed) return null
  const rootKey = dbRootKey(parsed.root)
  if (!rootKey) return null
  const entries = db.chords[rootKey]
  if (!entries) return null

  const wanted = dbSuffix(parsed.quality)
  for (let i = 0; i < wanted.length; i++) {
    const entry = entries.find((e) => e.suffix === wanted[i])
    if (entry && entry.positions.length) {
      return { positions: entry.positions, exact: i === 0 }
    }
  }
  return null
}

export function getDiagram(token: string, positionIndex = 0): DiagramResult | null {
  const all = getPositions(token)
  if (!all) return null
  const idx = Math.min(Math.max(0, positionIndex), all.positions.length - 1)
  return {
    name: token,
    position: all.positions[idx],
    strings: GUITAR_STRINGS,
    exact: all.exact,
  }
}

/** 루트 음의 chords-db 보유 코드 종류(suffix) 목록. */
export function suffixesForRoot(root: string): string[] {
  const key = dbRootKey(root)
  if (!key) return []
  return (db.chords[key] ?? []).filter((e) => e.positions.length > 0).map((e) => e.suffix)
}

/** 루트 + db suffix → 표시용 코드명 (major는 생략, minor는 m). */
export function displayChordName(root: string, suffix: string): string {
  if (suffix === 'major') return root
  if (suffix === 'minor') return root + 'm'
  return root + suffix
}

/** A rough "is this hard for a beginner" heuristic to decide which chords to diagram by default. */
const EASY = new Set([
  'C', 'D', 'E', 'G', 'A',
  'Am', 'Dm', 'Em',
  'C7', 'D7', 'E7', 'G7', 'A7', 'B7',
  'Cmaj7', 'Dmaj7', 'Gmaj7',
  'Am7', 'Dm7', 'Em7',
  'Dsus4', 'Dsus2', 'Asus4', 'Asus2', 'Esus4',
])

export function isHardChord(token: string): boolean {
  const t = token.trim()
  if (EASY.has(t)) return false
  const parsed = parseChord(t)
  if (!parsed) return false
  // barre-ish, slash, or extended chords are worth showing
  if (parsed.bass) return true
  // any 7th/extended/altered quality not whitelisted in EASY is worth diagramming
  if (/(maj|M7|sus|add|dim|aug|mmaj|11|13|9|6|7|#|b5)/.test(parsed.quality)) return true
  // plain majors/minors on F, Bb, B, F#, Ab etc. are barre chords -> hard
  const pos = getDiagram(t)
  if (pos && (pos.position.barres.length > 0 || pos.position.baseFret > 1)) return true
  return false
}
