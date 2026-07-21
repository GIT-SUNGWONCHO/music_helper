import { useState, useRef } from 'react'
import type { Song, Section, Bar } from '../types'
import { PRACTICE_STATUSES } from '../types'
import type { GenerateResult } from '../ai/generate'
import { newBar, newSection } from '../db'
import { NOTE_NAMES, transposeChord, transposeNote } from '../music/chords'
import { GENRE_TAGS, MOOD_TAGS } from '../tags'
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

function TagPicker({ label, options, selected, onChange }: {
  label: string
  options: readonly string[]
  selected: string[]
  onChange: (tags: string[]) => void
}) {
  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag])
  }
  // 리스트에 없는 기존 태그(AI 생성/과거 데이터)도 표시하고 눌러서 제거 가능
  const legacy = selected.filter((t) => !options.includes(t))
  return (
    <div className="field">
      <span>{label}</span>
      <div className="tag-select">
        {options.map((t) => (
          <button key={t} type="button"
            className={'chip chip--select' + (selected.includes(t) ? ' is-on' : '')}
            onClick={() => toggle(t)}>{t}</button>
        ))}
        {legacy.map((t) => (
          <button key={t} type="button" className="chip chip--select is-on" title="리스트 외 태그 — 누르면 제거"
            onClick={() => toggle(t)}>{t} ×</button>
        ))}
      </div>
    </div>
  )
}

export function SongEditor({ song, genMeta, onSave, onCancel, onDelete }: Props) {
  const [draft, setDraft] = useState<Song>(() => structuredClone(song))

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
  /** 전체 곡을 ±1반음 전조(모든 코드 이동 + 키 라벨 갱신). 저장된 운지는 코드명이 바뀌므로 초기화. */
  function transposeBy(semis: 1 | -1) {
    setDraft((d) => ({
      ...d,
      originalKey: transposeNote(d.originalKey, semis),
      sections: d.sections.map((s) => ({
        ...s,
        bars: s.bars.map((b) => ({ ...b, chords: b.chords.map((c) => transposeChord(c, semis)) })),
      })),
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

  return (
    <div className="page editor">
      <div className="toolbar">
        <button className="btn" onClick={onCancel}>취소</button>
        <div className="toolbar__title"><strong>악보 편집</strong></div>
        <button className="btn btn--primary" onClick={() => onSave(draft)}>저장</button>
      </div>

      <div className="form">
        <div className="form__row">
          <label className="field field--grow">
            <span>제목</span>
            <input value={draft.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <label className="field field--grow">
            <span>아티스트</span>
            <input value={draft.artist} onChange={(e) => set('artist', e.target.value)} />
          </label>
          <div className="field">
            <span>키 / 전조</span>
            <div className="key-ctrl">
              <button type="button" className="btn btn--icon" title="반음 내려 전조 (코드 이동)" onClick={() => transposeBy(-1)}>−</button>
              <select value={draft.originalKey} title="키 라벨 직접 지정 (코드는 안 바뀜)"
                onChange={(e) => set('originalKey', e.target.value)}>
                {NOTE_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button type="button" className="btn btn--icon" title="반음 올려 전조 (코드 이동)" onClick={() => transposeBy(1)}>+</button>
            </div>
          </div>
          <label className="field">
            <span>BPM</span>
            <input type="number" min={0} value={draft.tempo ?? ''}
              onChange={(e) => set('tempo', e.target.value ? +e.target.value : undefined)} />
          </label>
          <label className="field">
            <span>카포</span>
            <select value={draft.capoFret ?? 0} onChange={(e) => set('capoFret', +e.target.value)}>
              <option value={0}>없음</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>{n}번 프렛</option>
              ))}
            </select>
          </label>
        </div>
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
        <TagPicker label="장르 태그" options={GENRE_TAGS} selected={draft.genreTags}
          onChange={(tags) => set('genreTags', tags)} />
        <TagPicker label="분위기 태그" options={MOOD_TAGS} selected={draft.moodTags}
          onChange={(tags) => set('moodTags', tags)} />
      </div>

      {genMeta && <GenNotice meta={genMeta} />}
      <ChordStrip sections={draft.sections} editable
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
              {sec.bars.map((bar) => (
                <div className="bar bar--edit" key={bar.id}>
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
              ))}
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
        <button className="btn btn--danger" onClick={() => onDelete(draft.id)}>이 곡 삭제</button>
      </div>
    </div>
  )
}
