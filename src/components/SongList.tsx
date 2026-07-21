import { useMemo, useState, useEffect } from 'react'
import type { Song, PracticeStatus } from '../types'
import { PRACTICE_STATUSES } from '../types'
import { OWNERS, type Owner } from '../supabase'

interface Props {
  songs: Song[]
  owner: Owner
  onSwitchOwner: (o: Owner) => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onGenerate: () => void
  onSettings: () => void
}

function toggleIn<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

export function SongList({ songs, owner, onSwitchOwner, onOpen, onDelete, onNew, onGenerate, onSettings }: Props) {
  const [query, setQuery] = useState('')
  const [statusF, setStatusF] = useState<PracticeStatus[]>([])
  const [fabOpen, setFabOpen] = useState(false)

  useEffect(() => {
    if (!fabOpen) return
    const close = () => setFabOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [fabOpen])

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of songs) m[s.status] = (m[s.status] ?? 0) + 1
    return m
  }, [songs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return songs.filter((s) => {
      if (statusF.length && !statusF.includes(s.status)) return false
      if (!q) return true
      return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    })
  }, [songs, query, statusF])

  return (
    <div className="list">
      <div className="app-header">
        <div className="app-header__brand">GENCHRD<span className="app-header__brand-dot">.</span></div>
        <div className="app-header__actions">
          <div className="seg">
            {OWNERS.map((o) => (
              <button key={o.value} type="button"
                className={'seg__btn' + (owner === o.value ? ' is-on' : '')}
                onClick={() => onSwitchOwner(o.value)}>{o.label}</button>
            ))}
          </div>
          <button className="btn btn--ghost btn--sm" onClick={onSettings}>설정</button>
        </div>
      </div>

      <h1>라이브러리</h1>

      <input className="search" placeholder="제목·아티스트 검색"
        value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="status-filter">
        <button className={'status-pill' + (statusF.length === 0 ? ' is-on' : '')} onClick={() => setStatusF([])}>
          전체 <span className="status-pill__n">{songs.length}</span>
        </button>
        {PRACTICE_STATUSES.map((st) => (
          <button key={st.value}
            className={'status-pill' + (statusF.includes(st.value) ? ' is-on' : '')}
            onClick={() => setStatusF((f) => toggleIn(f, st.value))}>
            <span className={'status-dot status-dot--' + st.value} />
            {st.label} <span className="status-pill__n">{statusCounts[st.value] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="rows">
        {filtered.map((s) => (
          <div key={s.id} className="row-wrap">
            <button className="row" onClick={() => onOpen(s.id)}>
              <div className={'row__dot status-dot--' + s.status} title={PRACTICE_STATUSES.find((x) => x.value === s.status)?.label} />
              <div className="row__body">
                <div className="row__title">{s.title}</div>
                <div className="row__artist">{s.artist || '—'}</div>
              </div>
              <span className="row__meta">{s.originalKey}{s.tempo ? ` · ${s.tempo}` : ''}</span>
              <svg className="row__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="row__del" title="삭제" onClick={() => onDelete(s.id)}>×</button>
          </div>
        ))}
        {filtered.length === 0 && <p className="empty">악보가 없습니다. 아래 + 버튼으로 시작하세요.</p>}
      </div>

      <div className="fab-group" onClick={(e) => e.stopPropagation()}>
        {fabOpen && (
          <div className="fab-actions">
            <button className="fab-action fab-action--ai" onClick={() => { setFabOpen(false); onGenerate() }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />
              </svg>
              AI로 만들기
            </button>
            <button className="fab-action fab-action--new" onClick={() => { setFabOpen(false); onNew() }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              직접 만들기
            </button>
          </div>
        )}
        <button className={'fab' + (fabOpen ? ' is-open' : '')} onClick={() => setFabOpen((o) => !o)}>
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ transition: 'transform 0.2s', transform: fabOpen ? 'rotate(45deg)' : 'none' }}>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
