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
  // "M"으로 쓴 메이저7 계열(M9, M11, M7b5, mM9 등)을 db suffix 표기(maj9, mmaj9 등)로 정규화
  const normalized = q.replace(/^mM(?=[0-9])/, 'mmaj').replace(/^M(?=[0-9])/, 'maj')
  // otherwise assume the quality already matches a db suffix (7, m7, sus4, add9, 9, maj9, ...)
  // provide graceful fallbacks by stripping trailing extensions
  const fallbacks = normalized === q ? [q] : [normalized, q]
  if (normalized.startsWith('m') && normalized !== 'major') fallbacks.push('m7', 'minor')
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
  // 3도 베이스 슬래시 코드 — chords-db에 정확한 운지가 없는 것들. 기존 chords-db 운지에서
  // 아래쪽 줄을 뮤트해나가며 목표 베이스음이 나오는 지점을 찾아 파생(검증된 실제 셰이프 기반이라
  // 손으로 통째로 지어낸 것보다 신뢰도 높음), 손으로 음정 재검산 완료.
  'C/E': { frets: [-1, -1, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0], baseFret: 1, barres: [] },
  'C#/F': { frets: [-1, -1, 3, 1, 2, 1], fingers: [0, 0, 3, 1, 2, 1], baseFret: 1, barres: [] },
  'Eb/G': { frets: [-1, -1, 3, 1, 2, 1], fingers: [0, 0, 3, 1, 2, 1], baseFret: 3, barres: [] },
  'A/C#': { frets: [-1, -1, -1, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], baseFret: 5, barres: [] },
  'Bb/D': { frets: [-1, 3, 1, 1, 1, -1], fingers: [0, 3, 1, 1, 1, 0], baseFret: 3, barres: [] },
  'B/Eb': { frets: [-1, -1, -1, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], baseFret: 7, barres: [] },
  'Cm/Eb': { frets: [-1, -1, 1, 0, 1, 3], fingers: [0, 0, 2, 0, 1, 4], baseFret: 1, barres: [] },
  'C#m/E': { frets: [-1, -1, 2, 1, 2, -1], fingers: [0, 0, 2, 1, 3, 0], baseFret: 1, barres: [] },
  'Em/G': { frets: [-1, -1, -1, 0, 0, 0], fingers: [0, 0, 0, 0, 0, 0], baseFret: 1, barres: [] },
  'Fm/Ab': { frets: [-1, -1, -1, 1, 1, 1], fingers: [0, 0, 0, 1, 1, 1], baseFret: 1, barres: [] },
  'Gm/Bb': { frets: [-1, 1, 0, 0, 3, 3], fingers: [0, 1, 0, 0, 3, 4], baseFret: 1, barres: [] },
  'Am/C': { frets: [-1, -1, -1, 4, 4, 4], fingers: [0, 0, 0, 4, 4, 4], baseFret: 2, barres: [] },
  'Bbm/C#': { frets: [-1, -1, -1, 1, 1, 1], fingers: [0, 0, 0, 1, 1, 1], baseFret: 6, barres: [] },
}

/** 파워코드(5) — chords-db에 없어서 무빙 셰이프를 직접 계산. 6번줄(로우E) 루트 셰이프와
 *  5번줄(A) 루트 셰이프 2종. 물리적으로 항상 정확함(근사 아님). */
function powerChordPositions(rootPc: number): ChordPosition[] {
  const fret6 = ((rootPc - OPEN_STRING_PC[0]) % 12 + 12) % 12
  const fret5 = ((rootPc - OPEN_STRING_PC[1]) % 12 + 12) % 12
  const shape6: ChordPosition = fret6 === 0
    ? { frets: [0, 2, 2, -1, -1, -1], fingers: [0, 2, 3, 0, 0, 0], baseFret: 1, barres: [] }
    : { frets: [1, 3, 3, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0], baseFret: fret6, barres: [] }
  const shape5: ChordPosition = fret5 === 0
    ? { frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 2, 3, 0, 0], baseFret: 1, barres: [] }
    : { frets: [-1, 1, 3, 3, -1, -1], fingers: [0, 1, 3, 4, 0, 0], baseFret: fret5, barres: [] }
  return [shape6, shape5]
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

// chords-db가 슬래시 코드 전용 운지(예: G의 '/B')를 표기할 때 쓰는 스펠링이 곡마다 샵/플랫이 섞여 있어 둘 다 시도.
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** 코드 토큰의 모든 운지(positions)를 반환. 슬래시 코드는 베이스 음이 실제로 최저음으로 울리는 운지를 우선함. */
export function getPositions(token: string): { positions: ChordPosition[]; exact: boolean } | null {
  const parsed = parseChord(token)
  if (!parsed) return null
  if (parsed.quality.trim() === '5' && !parsed.bass) {
    const pc = pitchClass(parsed.root)
    if (Number.isNaN(pc)) return null
    return { positions: powerChordPositions(pc), exact: true }
  }
  const rootKey = dbRootKey(parsed.root)
  if (!rootKey) return null
  const entries = db.chords[rootKey]
  if (!entries) return null

  const wanted = dbSuffix(parsed.quality)
  // 메이저 트라이어드 슬래시 코드는 chords-db가 전용 운지(예: G의 '/B')를 따로 제공하는 경우가 있음 —
  // 일반 메이저 코드에서 우연히 그 베이스음이 나오는 자리를 찾는 것보다 훨씬 자연스러운 운지라 우선함.
  if (parsed.bass && wanted[0] === 'major') {
    const bassPc = pitchClass(parsed.bass)
    if (!Number.isNaN(bassPc)) {
      for (const name of [SHARP_NAMES[bassPc], FLAT_NAMES[bassPc]]) {
        const slashEntry = entries.find((e) => e.suffix === '/' + name)
        if (slashEntry && slashEntry.positions.length) {
          return { positions: slashEntry.positions, exact: true }
        }
      }
    }
  }
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

// 자주 쓰는 코드 종류를 앞쪽에 두기 위한 우선순위(명시 안 된 종류는 뒤로, 서로간 원래 순서는 유지).
const SUFFIX_PRIORITY = [
  'major', 'minor', '7', 'm7', 'maj7', 'sus2', 'sus4', 'add9', '6', 'm6',
  '9', 'm9', 'maj9', 'dim', 'aug', '69', 'm69', '7sus4', 'm11', 'maj11',
]

/** 루트 음의 코드 종류(suffix) 목록. chords-db 보유 목록 + 직접 계산하는 파워코드(5).
 *  흔히 쓰는 종류(메이저/마이너/7th/sus 등)가 앞쪽에 오도록 정렬. */
export function suffixesForRoot(root: string): string[] {
  const key = dbRootKey(root)
  if (!key) return []
  const dbSuffixes = (db.chords[key] ?? []).filter((e) => e.positions.length > 0).map((e) => e.suffix)
  const rank = (s: string) => {
    const i = SUFFIX_PRIORITY.indexOf(s)
    return i === -1 ? SUFFIX_PRIORITY.length : i
  }
  const sorted = [...dbSuffixes].sort((a, b) => rank(a) - rank(b))
  return ['5', ...sorted]
}

/** 루트 + db suffix → 표시용 코드명 (major는 생략, minor는 m, maj7 계열은 M7로 표기). */
export function displayChordName(root: string, suffix: string): string {
  if (suffix === 'major') return root
  if (suffix === 'minor') return root + 'm'
  return root + suffix.replace(/maj/g, 'M')
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

