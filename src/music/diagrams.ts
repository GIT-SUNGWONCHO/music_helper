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

// 표준 튜닝 개방현 음 (낮은 E부터), pitchClass 기준 (C=0)
const OPEN_STRING_PC = [4, 9, 2, 7, 11, 4]

// chords-db에 없는 운지(주로 오픈 포지션 워킹 베이스)를 코드명 그대로 보정. 특정 곡이 아니라
// 이 정확한 코드명이 나오면 항상 적용되는 일반 데이터 — 전조된 코드명에는 적용 안 됨(오픈 셰이프라 이조 시 물리적으로 안 맞음).
const EXTRA_POSITIONS: Record<string, ChordPosition> = {
  'Asus2/G': { frets: [3, 0, 2, 2, 0, 0], fingers: [4, 0, 1, 2, 0, 0], baseFret: 1, barres: [] },
  'Asus2/F#': { frets: [2, 0, 2, 2, 0, 0], fingers: [4, 0, 1, 2, 0, 0], baseFret: 1, barres: [] },
  'Asus2/E': { frets: [0, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0], baseFret: 1, barres: [] },
}

/** 이 운지에서 실제로 울리는 가장 낮은 줄의 음(pitch class). 뮤트 줄은 건너뜀. */
function bassPitchClassOf(position: ChordPosition): number | null {
  for (let s = 0; s < position.frets.length; s++) {
    const f = position.frets[s]
    if (f === -1) continue
    const absoluteFret = f === 0 ? 0 : position.baseFret + f - 1
    const openPc = OPEN_STRING_PC[s] ?? OPEN_STRING_PC[OPEN_STRING_PC.length - 1]
    return (openPc + absoluteFret) % 12
  }
  return null
}

/** 코드 토큰의 모든 운지(positions)를 반환. 슬래시 코드는 베이스 음이 실제로 최저음으로 울리는 운지를 우선함. */
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
      if (parsed.bass) {
        const targetPc = pitchClass(parsed.bass)
        if (!Number.isNaN(targetPc)) {
          const matching = entry.positions.filter((p) => bassPitchClassOf(p) === targetPc)
          if (matching.length > 0) return { positions: matching, exact: i === 0 }
        }
        const extra = EXTRA_POSITIONS[token]
        if (extra) return { positions: [extra, ...entry.positions], exact: true }
        // chords-db에 이 베이스 음을 최저음으로 갖는 운지가 없음 — 일반 코드 모양으로 근사(≈ 표시)
        return { positions: entry.positions, exact: false }
      }
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

