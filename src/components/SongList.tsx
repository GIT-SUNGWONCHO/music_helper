import { useMemo, useState } from 'react'
import type { Song } from '../types'

interface Props {
  songs: Song[]
  onOpen: (id: string) => void
  onNew: () => void
  onExport: () => void
  onImport: (file: File) => void
}

export function SongList({ songs, onOpen, onNew, onExport, onImport }: Props) {
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])

  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of songs) for (const t of s.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [songs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return songs.filter((s) => {
      if (activeTags.length && !activeTags.every((t) => s.tags.includes(t))) return false
      if (!q) return true
      return (
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [songs, query, activeTags])

  function toggleTag(t: string) {
    setActiveTags((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]))
  }

  return (
    <div className="list">
      <div className="app-header">
        <div className="app-header__brand">CHRD.</div>
        <div className="app-header__actions">
          <button className="btn btn--ghost btn--sm" onClick={onExport}>내보내기</button>
          <label className="btn btn--ghost btn--sm">
            가져오기
            <input type="file" accept="application/json" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
          </label>
        </div>
      </div>

      <h1>라이브러리</h1>

      <input className="search" placeholder="제목·아티스트·태그 검색"
        value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="tabs">
        <button className={'tab' + (activeTags.length === 0 ? ' is-on' : '')} onClick={() => setActiveTags([])}>전체</button>
        {allTags.map((t) => (
          <button key={t} className={'tab' + (activeTags.includes(t) ? ' is-on' : '')} onClick={() => toggleTag(t)}>{t}</button>
        ))}
        {activeTags.length > 0 && <button className="tab tab--clear" onClick={() => setActiveTags([])}>초기화</button>}
      </div>

      <div className="rows">
        {filtered.map((s) => (
          <button key={s.id} className="row" onClick={() => onOpen(s.id)}>
            <div className="row__dot" />
            <div className="row__body">
              <div className="row__title">{s.title}</div>
              <div className="row__artist">{s.artist || '—'}</div>
            </div>
            <span className="row__meta">{s.originalKey}{s.tempo ? ` · ${s.tempo}` : ''}</span>
            <svg className="row__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
        {filtered.length === 0 && <p className="empty">악보가 없습니다. 아래 + 버튼으로 시작하세요.</p>}
      </div>

      <button className="fab" title="새 악보" onClick={onNew}>
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
