import { useState } from 'react'
import type { Song, Section, Bar } from '../types'
import { newBar, newSection } from '../db'
import { NOTE_NAMES } from '../music/chords'

interface Props {
  song: Song
  onSave: (song: Song) => void
  onCancel: () => void
  onDelete: (id: string) => void
}

const COMMON_LABELS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Interlude', 'Outro']

export function SongEditor({ song, onSave, onCancel, onDelete }: Props) {
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
          <label className="field">
            <span>키</span>
            <select value={draft.originalKey} onChange={(e) => set('originalKey', e.target.value)}>
              {NOTE_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="field">
            <span>BPM</span>
            <input type="number" min={0} value={draft.tempo ?? ''}
              onChange={(e) => set('tempo', e.target.value ? +e.target.value : undefined)} />
          </label>
        </div>
        <label className="field">
          <span>태그 (쉼표로 구분)</span>
          <input value={draft.tags.join(', ')}
            onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />
        </label>
      </div>

      <p className="hint">마디를 클릭해 <b>코드</b>와 <b>가사</b>를 바로 입력하세요. 한 마디에 코드 두 개는 띄어쓰기로 (예: <code>Gsus4 G</code>).</p>

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
                  <input
                    className="bar__chord-input"
                    value={bar.chords.join(' ')}
                    placeholder="코드"
                    onChange={(e) => patchBar(sec.id, bar.id, { chords: e.target.value.split(/\s+/).filter(Boolean) })}
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
