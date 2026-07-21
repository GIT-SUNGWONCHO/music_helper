import { useMemo, useState } from 'react'
import type { Section } from '../types'
import { collectChords } from '../music/song'
import { transposeChord, parseChord, NOTE_NAMES } from '../music/chords'
import { isHardChord, getPositions, suffixesForRoot, displayChordName } from '../music/diagrams'
import { ChordDiagram } from './ChordDiagram'

interface Props {
  sections: Section[]
  semitones?: number
  /** 곡의 으뜸음(현재 표시 기준, 전조/카포 반영된 값) — 난이도와 무관하게 항상 코드표에 포함 */
  rootKey?: string
  fingerings?: Record<string, number>
  hiddenChords?: string[]
  pinnedChords?: string[]
  /** true면 클릭해서 운지 선택/삭제/코드 추가 가능 (편집 화면용) */
  editable?: boolean
  onChange?: (patch: {
    fingerings?: Record<string, number>
    hiddenChords?: string[]
    pinnedChords?: string[]
  }) => void
}

/** 곡에 쓰인 어려운 코드 + 으뜸음 코드 + 직접 추가한 코드의 운지표 스트립. */
export function ChordStrip({
  sections, semitones = 0, rootKey, fingerings, hiddenChords, pinnedChords, editable, onChange,
}: Props) {
  const [openChord, setOpenChord] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addRoot, setAddRoot] = useState('C')

  const hidden = hiddenChords ?? []
  const pinned = pinnedChords ?? []

  const chords = useMemo(() => {
    const all = collectChords(sections, semitones)
    const hardSet = new Set(all.filter(isHardChord))
    // 슬래시 코드가 코드표에 나오면, 그 기준(베이스 없는) 코드도 곡에 실제로 쓰였을 때만 같이 보여줌
    for (const c of hardSet) {
      const parsed = parseChord(c)
      if (!parsed?.bass) continue
      const base = parsed.root + parsed.quality
      if (all.includes(base)) hardSet.add(base)
    }
    // 곡의 으뜸음 코드는 난이도와 무관하게 항상 포함(실제로 쓰였을 때만)
    if (rootKey && all.includes(rootKey)) hardSet.add(rootKey)
    const auto = all.filter((c) => hardSet.has(c))
    const merged = [...auto]
    for (const p of pinned) {
      const t = transposeChord(p, semitones)
      if (!merged.includes(t)) merged.push(t)
    }
    return merged.filter((c) => !hidden.includes(c))
  }, [sections, semitones, pinned, hidden])

  if (!editable && chords.length === 0) return null

  const openPositions = openChord ? getPositions(openChord) : null

  function pick(chord: string, idx: number) {
    onChange?.({ fingerings: { ...fingerings, [chord]: idx } })
    setOpenChord(null)
  }
  function remove(chord: string) {
    if (pinned.includes(chord)) onChange?.({ pinnedChords: pinned.filter((c) => c !== chord) })
    else onChange?.({ hiddenChords: [...hidden, chord] })
    if (openChord === chord) setOpenChord(null)
  }
  function unhide(chord: string) {
    onChange?.({ hiddenChords: hidden.filter((c) => c !== chord) })
  }
  function addChord(name: string) {
    setAdding(false)
    if (hidden.includes(name)) { unhide(name); return }
    if (!pinned.includes(name) && !chords.includes(name)) onChange?.({ pinnedChords: [...pinned, name] })
  }

  return (
    <div className="diagram-strip-wrap">
      {editable && (
        <div className="diagram-strip__hint">코드표를 누르면 운지를 바꿀 수 있어요</div>
      )}
      <div className="diagram-strip">
        {chords.map((c) =>
          editable ? (
            <div className="diagram-cell" key={c}>
              <button
                className={'diagram-btn' + (openChord === c ? ' is-open' : '')}
                onClick={() => { setAdding(false); setOpenChord(openChord === c ? null : c) }}
                title="운지 선택"
              >
                <ChordDiagram chord={c} positionIndex={fingerings?.[c] ?? 0} />
              </button>
              <button className="diagram-cell__x" title="코드표 삭제" onClick={() => remove(c)}>×</button>
            </div>
          ) : (
            <ChordDiagram key={c} chord={c} positionIndex={fingerings?.[c] ?? 0} />
          ),
        )}
        {editable && (
          <button
            className={'chord-add' + (adding ? ' is-on' : '')}
            onClick={() => { setOpenChord(null); setAdding((a) => !a) }}
          >+ 코드 추가</button>
        )}
      </div>

      {editable && openChord && openPositions && (
        <div className="chord-picker">
          <div className="chord-picker__head">
            <strong>{openChord}</strong> 운지 선택
            <div className="spacer" />
            <button className="btn btn--icon btn--ghost" onClick={() => setOpenChord(null)}>✕</button>
          </div>
          <div className="chord-picker__grid">
            {openPositions.positions.map((_, i) => (
              <button
                key={i}
                className={'diagram-btn' + ((fingerings?.[openChord] ?? 0) === i ? ' is-selected' : '')}
                onClick={() => pick(openChord, i)}
              >
                <ChordDiagram chord={openChord} positionIndex={i} />
              </button>
            ))}
          </div>
        </div>
      )}

      {editable && adding && (
        <div className="chord-picker">
          <div className="chord-picker__head">
            <strong>코드 추가</strong> 루트 음 → 코드 종류 선택
            <div className="spacer" />
            <button className="btn btn--icon btn--ghost" onClick={() => setAdding(false)}>✕</button>
          </div>
          <div className="seg">
            {NOTE_NAMES.map((r) => (
              <button key={r} type="button"
                className={'seg__btn' + (addRoot === r ? ' is-on' : '')}
                onClick={() => setAddRoot(r)}>{r}</button>
            ))}
          </div>
          <div className="suffix-grid">
            {suffixesForRoot(addRoot).map((s) => {
              const name = displayChordName(addRoot, s)
              return (
                <button key={s} className="chip chip--restore" onClick={() => addChord(name)}>{name}</button>
              )
            })}
          </div>
        </div>
      )}

      {editable && hidden.length > 0 && (
        <div className="hidden-chords">
          삭제한 코드표:
          {hidden.map((c) => (
            <button key={c} className="chip chip--restore" onClick={() => unhide(c)} title="다시 표시">
              {c} +
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
