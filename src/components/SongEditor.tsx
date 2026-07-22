import { useState, useRef, Fragment } from 'react'
import type { Song, Section, Bar } from '../types'
import { PRACTICE_STATUSES } from '../types'
import type { GenerateResult } from '../ai/generate'
import { newBar, newSection } from '../db'
import { NOTE_NAMES, transposeChord, transposeNote } from '../music/chords'
import { mergeBarsPairwise, splitBarsInHalf } from '../music/song'
import { ChordStrip } from './ChordStrip'

type GenMeta = Omit<GenerateResult, 'song'>

interface Props {
  song: Song
  genMeta?: GenMeta | null
  onSave: (song: Song) => void
  onCancel: () => void
  onDelete: (id: string) => void
}

const CONFIDENCE_LABEL: Record<string, string> = { high: '높음', medium: '중간', low: '낮음' }
const ROW_SIZE = 4

interface RowRef { secIdx: number; start: number; len: number }

/** AI 생성 직후 — 무엇을 근거로 만들었고 얼마나 믿을 수 있는지 안내. */
function GenNotice({ meta }: { meta: GenMeta }) {
  const conf = meta.confidence ? ` · 신뢰도: ${CONFIDENCE_LABEL[meta.confidence]}` : ''
  const basis = meta.basis ? ` · 근거: ${meta.basis}` : ''
  if (meta.imageUsed) {
    return <div className="notice notice--ok">첨부한 악보 이미지를 읽어서 생성했습니다{conf}{basis}</div>
  }
  if (meta.refUsed) {
    return <div className="notice notice--ok">참고 링크를 읽어서 생성했습니다{conf}{basis}</div>
  }
  if (meta.searchUsed) {
    return <div className="notice notice--ok">웹 검색 결과를 기반으로 생성했습니다{conf}{basis}</div>
  }
  return (
    <div className="notice notice--warn">
      웹 검색 없이 AI 학습 지식만으로 생성했습니다{conf}{basis}
      <br />키·코드·가사가 실제와 다를 수 있습니다. 정확한 악보가 필요하면 생성 시 <b>참고 악보 링크</b>를 넣어 주세요.
    </div>
  )
}

const COMMON_LABELS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Interlude', 'Outro']
const MAX_CHORDS_PER_BAR = 2

function ChordTagInput({ chords, onChange }: { chords: string[]; onChange: (c: string[]) => void }) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    const v = input.trim()
    if (v && chords.length < MAX_CHORDS_PER_BAR) onChange([...chords, v])
    setInput('')
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commit() }
    else if (e.key === 'Backspace' && input === '' && chords.length > 0) onChange(chords.slice(0, -1))
  }

  return (
    <div className="chord-tag-input" onClick={() => inputRef.current?.focus()}>
      {chords.map((c, i) => (
        <span key={i} className="chord-tag">
          {c}
          <button
            className="chord-tag__x"
            onMouseDown={(e) => { e.preventDefault(); onChange(chords.filter((_, j) => j !== i)) }}
          >×</button>
        </span>
      ))}
      {chords.length < MAX_CHORDS_PER_BAR && (
        <input
          ref={inputRef}
          className="chord-tag__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={commit}
          placeholder={chords.length === 0 ? '코드' : '+'}
          size={chords.length === 0 ? 4 : 2}
        />
      )}
    </div>
  )
}

export function SongEditor({ song, genMeta, onSave, onCancel, onDelete }: Props) {
  const [draft, setDraft] = useState<Song>(() => structuredClone(song))
  const [relabeling, setRelabeling] = useState(false)
  // 마디 합치기/나누기 — 실제로 마디 개수를 바꾸는 진짜 편집. 한 번에 한 단계만.
  // "원래대로"는 합치기/나누기 직전의 sections(마디 데이터)만 정확히 스냅샷 복원함 — 제목/아티스트/키 등
  // 다른 필드나 그 사이의 코드·가사 수정은 영향받지 않지만, 대신 그 사이 마디 내용 수정은 함께 사라짐.
  const [structureOp, setStructureOp] = useState<'none' | 'merged' | 'split'>('none')
  const [preOpSections, setPreOpSections] = useState<Section[] | null>(null)

  function applyMerge() {
    setPreOpSections(draft.sections)
    setDraft((d) => ({ ...d, sections: mergeBarsPairwise(d.sections) }))
    setStructureOp('merged')
  }
  function applySplit() {
    setPreOpSections(draft.sections)
    setDraft((d) => ({ ...d, sections: splitBarsInHalf(d.sections) }))
    setStructureOp('split')
  }
  function undoStructureOp() {
    if (preOpSections) setDraft((d) => ({ ...d, sections: preOpSections }))
    setStructureOp('none')
    setPreOpSections(null)
  }

  function set<K extends keyof Song>(key: K, value: Song[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }
  function patchSection(id: string, patch: Partial<Section>) {
    setDraft((d) => ({ ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  }
  function patchBar(secId: string, barId: string, patch: Partial<Bar>) {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id !== secId ? s : { ...s, bars: s.bars.map((b) => (b.id === barId ? { ...b, ...patch } : b)) },
      ),
    }))
  }
  function addBar(secId: string) {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === secId ? { ...s, bars: [...s.bars, newBar()] } : s)),
    }))
  }
  function removeBar(secId: string, barId: string) {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === secId ? { ...s, bars: s.bars.filter((b) => b.id !== barId) } : s)),
    }))
  }
  /** 전체 곡을 ±1반음 전조(모든 코드 이동 + 키 라벨 갱신). 코드명이 바뀌므로 핀 고정/숨김 목록도 같이 전조하고, 운지 선택은 초기화. */
  function transposeBy(semis: 1 | -1) {
    setDraft((d) => ({
      ...d,
      originalKey: transposeNote(d.originalKey, semis),
      sections: d.sections.map((s) => ({
        ...s,
        bars: s.bars.map((b) => ({ ...b, chords: b.chords.map((c) => transposeChord(c, semis)) })),
      })),
      pinnedChords: (d.pinnedChords ?? []).map((c) => transposeChord(c, semis)),
      hiddenChords: (d.hiddenChords ?? []).map((c) => transposeChord(c, semis)),
      fingerings: {},
    }))
  }
  function addSection() {
    setDraft((d) => ({ ...d, sections: [...d.sections, newSection()] }))
  }
  function removeSection(id: string) {
    setDraft((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== id) }))
  }
  function moveSection(id: string, dir: -1 | 1) {
    setDraft((d) => {
      const i = d.sections.findIndex((s) => s.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.sections.length) return d
      const arr = d.sections.slice()
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...d, sections: arr }
    })
  }
  /** 이 4마디 줄을 바로 뒤에 복제(코드/가사 복사, 새 id 발급). */
  function duplicateRow(row: RowRef) {
    setDraft((d) => {
      const sections = d.sections.map((s) => ({ ...s, bars: s.bars.slice() }))
      const sec = sections[row.secIdx]
      const copy = sec.bars.slice(row.start, row.start + row.len).map((b) => newBar([...b.chords], b.lyric))
      sec.bars.splice(row.start + row.len, 0, ...copy)
      return { ...d, sections }
    })
  }
  /** 이 4마디 줄을 같은 섹션 내 앞/뒤 줄과 통째로 자리 바꿈. 섹션 경계면 인접 섹션으로 넘어감. */
  function moveRow(row: RowRef, dir: -1 | 1) {
    setDraft((d) => {
      const sections = d.sections.map((s) => ({ ...s, bars: s.bars.slice() }))
      const sec = sections[row.secIdx]
      const chunk = sec.bars.splice(row.start, row.len)
      if (dir === -1) {
        if (row.start > 0) {
          sec.bars.splice(Math.max(0, row.start - ROW_SIZE), 0, ...chunk)
        } else if (row.secIdx > 0) {
          sections[row.secIdx - 1].bars.push(...chunk)
        } else {
          sec.bars.splice(row.start, 0, ...chunk)
        }
      } else {
        if (row.start < sec.bars.length) {
          const nextLen = Math.min(ROW_SIZE, sec.bars.length - row.start)
          sec.bars.splice(row.start + nextLen, 0, ...chunk)
        } else if (row.secIdx < sections.length - 1) {
          sections[row.secIdx + 1].bars.unshift(...chunk)
        } else {
          sec.bars.splice(row.start, 0, ...chunk)
        }
      }
      return { ...d, sections }
    })
  }

  return (
    <div className="page editor">
      <div className="toolbar">
        <button className="btn" onClick={onCancel}>취소</button>
        <div className="toolbar__title"><strong>악보 편집</strong></div>
        <button className="btn btn--primary" onClick={() => onSave(draft)}>저장</button>
      </div>

      <div className="form">
        <div className="field">
          <span>연습 상태</span>
          <div className="seg">
            {PRACTICE_STATUSES.map((st) => (
              <button
                key={st.value}
                type="button"
                className={'seg__btn seg__btn--' + st.value + (draft.status === st.value ? ' is-on' : '')}
                onClick={() => set('status', st.value)}
              >{st.label}</button>
            ))}
          </div>
        </div>
        <div className="form__row">
          <label className="field field--grow">
            <span>제목</span>
            <input value={draft.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <label className="field field--version">
            <span>버전 (선택)</span>
            <input value={draft.version ?? ''} placeholder="예: 남키"
              onChange={(e) => set('version', e.target.value || undefined)} />
          </label>
        </div>
        <div className="form__row">
          <label className="field field--grow">
            <span>아티스트</span>
            <input value={draft.artist} onChange={(e) => set('artist', e.target.value)} />
          </label>
          <label className="field field--narrow">
            <span>BPM</span>
            <input type="number" min={0} value={draft.tempo ?? ''}
              onChange={(e) => set('tempo', e.target.value ? +e.target.value : undefined)} />
          </label>
          <div className="field">
            <span>키 (전조)</span>
            <div className="key-ctrl">
              <button type="button" className="btn btn--icon" onClick={() => transposeBy(-1)}>−</button>
              {relabeling ? (
                <select autoFocus className="key-ctrl__select" value={draft.originalKey}
                  onBlur={() => setRelabeling(false)}
                  onChange={(e) => { set('originalKey', e.target.value); setRelabeling(false) }}>
                  {NOTE_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : (
                <button type="button" className="key-ctrl__value" title="이름만 바꾸기(코드는 그대로)"
                  onClick={() => setRelabeling(true)}>{draft.originalKey}</button>
              )}
              <button type="button" className="btn btn--icon" onClick={() => transposeBy(1)}>+</button>
            </div>
          </div>
          <label className="field">
            <span>카포</span>
            <select value={draft.capoFret ?? 0} onChange={(e) => set('capoFret', +e.target.value)}>
              <option value={0}>없음</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>{n}번 프렛</option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>마디</span>
            <div className="ctrl">
              <button className="btn btn--sm" title="두 마디씩 하나로 합침(저장됨)"
                onClick={applyMerge} disabled={structureOp !== 'none'}>합치기</button>
              <button className="btn btn--sm" title="마디를 둘로 나눔(저장됨)"
                onClick={applySplit} disabled={structureOp !== 'none'}>나누기</button>
              {structureOp !== 'none' && (
                <button className="btn btn--ghost btn--sm" title="합치기/나누기 직전 마디 상태로 정확히 복원(그 사이 마디 수정 내용은 사라짐)"
                  onClick={undoStructureOp}>원래대로</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {genMeta && <GenNotice meta={genMeta} />}
      <ChordStrip sections={draft.sections} rootKey={draft.originalKey} editable
        fingerings={draft.fingerings} hiddenChords={draft.hiddenChords} pinnedChords={draft.pinnedChords}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />

      <p className="hint">코드 입력 후 <b>Enter</b> 또는 <b>Space</b>로 확정. 마디당 최대 2개. <b>Backspace</b>로 마지막 코드 삭제.</p>

      <div className="sheet sheet--edit">
        {draft.sections.map((sec, si) => (
          <section className="sec" key={sec.id}>
            <div className="sec__edit-head">
              <input className="sec__label-input" list="labels" value={sec.label}
                onChange={(e) => patchSection(sec.id, { label: e.target.value })} />
              <div className="spacer" />
              <button className="btn btn--icon" title="위로" onClick={() => moveSection(sec.id, -1)} disabled={si === 0}>↑</button>
              <button className="btn btn--icon" title="아래로" onClick={() => moveSection(sec.id, 1)} disabled={si === draft.sections.length - 1}>↓</button>
              <button className="btn btn--icon btn--danger" title="섹션 삭제" onClick={() => removeSection(sec.id)}>✕</button>
            </div>
            <div className="bars">
              {sec.bars.map((bar, bi) => {
                const rowStart = Math.floor(bi / ROW_SIZE) * ROW_SIZE
                const isRowEnd = (bi + 1) % ROW_SIZE === 0 || bi === sec.bars.length - 1
                const row: RowRef = { secIdx: si, start: rowStart, len: bi - rowStart + 1 }
                const canUp = !(si === 0 && rowStart === 0)
                const canDown = !(si === draft.sections.length - 1 && bi === sec.bars.length - 1)
                return (
                  <Fragment key={bar.id}>
                    <div className="bar bar--edit">
                      <button className="bar__x" title="마디 삭제" onClick={() => removeBar(sec.id, bar.id)}>×</button>
                      <ChordTagInput
                        chords={bar.chords}
                        onChange={(c) => patchBar(sec.id, bar.id, { chords: c })}
                      />
                      <input
                        className="bar__lyric-input"
                        value={bar.lyric}
                        placeholder="가사"
                        onChange={(e) => patchBar(sec.id, bar.id, { lyric: e.target.value })}
                      />
                    </div>
                    {isRowEnd && (
                      <div className="bar-row-ops">
                        <button className="btn btn--icon" title="이 4마디 줄 복제" onClick={() => duplicateRow(row)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="11" height="11" rx="1.5" />
                            <path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" />
                          </svg>
                        </button>
                        <button className="btn btn--icon" title="줄 위로 (섹션 경계 넘어감)" disabled={!canUp} onClick={() => moveRow(row, -1)}>↑</button>
                        <button className="btn btn--icon" title="줄 아래로 (섹션 경계 넘어감)" disabled={!canDown} onClick={() => moveRow(row, 1)}>↓</button>
                      </div>
                    )}
                  </Fragment>
                )
              })}
              <button className="bar bar--add" onClick={() => addBar(sec.id)}>+ 마디</button>
            </div>
          </section>
        ))}
        <datalist id="labels">
          {COMMON_LABELS.map((l) => <option key={l} value={l} />)}
        </datalist>
        <button className="btn btn--ghost btn--block" onClick={addSection}>+ 섹션 추가</button>
      </div>

      <div className="editor__footer">
        <button className="btn btn--ghost btn--sm btn--danger" onClick={() => onDelete(draft.id)}>이 곡 삭제</button>
      </div>
    </div>
  )
}
