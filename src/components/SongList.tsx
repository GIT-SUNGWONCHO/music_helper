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
      <header className="app-header">
        <h1>🎸 Music Helper</h1>
        <div className="app-header__actions">
          <button className="btn" onClick={onExport}>내보내기</button>
          <label className="btn">
            가져오기
            <input type="file" accept="application/json" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
          </label>
          <button className="btn btn--primary" onClick={onNew}>+ 새 악보</button>
        </div>
      </header>

      <input className="search" placeholder="제목·아티스트·태그 검색"
        value={query} onChange={(e) => setQuery(e.target.value)} />

      {allTags.length > 0 && (
        <div className="tag-filter">
          {allTags.map((t) => (
            <button key={t} className={'tag' + (activeTags.includes(t) ? ' is-on' : '')} onClick={() => toggleTag(t)}>{t}</button>
          ))}
          {activeTags.length > 0 && <button className="tag tag--clear" onClick={() => setActiveTags([])}>초기화</button>}
        </div>
      )}

      <div className="cards">
        {filtered.map((s) => (
          <button key={s.id} className="card" onClick={() => onOpen(s.id)}>
            <div className="card__title">{s.title}</div>
            <div className="card__artist">{s.artist || '—'}</div>
            <div className="card__meta">
              <span className="chip">{s.originalKey}</span>
              {s.tempo ? <span className="chip">♩ {s.tempo}</span> : null}
            </div>
            <div className="card__tags">{s.tags.map((t) => <span key={t} className="chip chip--tag">{t}</span>)}</div>
          </button>
        ))}
        {filtered.length === 0 && <p className="empty">악보가 없습니다. “+ 새 악보”로 시작하세요.</p>}
      </div>
    </div>
  )
}
