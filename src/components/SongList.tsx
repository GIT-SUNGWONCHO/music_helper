import { useMemo, useState, useEffect } from 'react'
import type { Song, PracticeStatus, SetList } from '../types'
import { PRACTICE_STATUSES } from '../types'
import type { Owner } from '../supabase'
import { SetListPickerModal } from './SetListPickerModal'
import { ImportSongModal } from './ImportSongModal'

interface Props {
  songs: Song[]
  owner: Owner
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onGenerate: () => void
  onImportSong: (song: Song) => void
  setlists: SetList[]
  onToggleSongInSetList: (setlistId: string, songId: string) => void
  onCreateSetList: (name: string, songId?: string) => void
}

function toggleIn<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

type SortBy = 'recent' | 'title'
type SortDir = 'asc' | 'desc'
type SortKey = 'recent-desc' | 'recent-asc' | 'title-asc' | 'title-desc'
const SORT_OPTIONS: { key: SortKey; sortBy: SortBy; dir: SortDir; label: string }[] = [
  { key: 'recent-desc', sortBy: 'recent', dir: 'desc', label: '최신순' },
  { key: 'recent-asc', sortBy: 'recent', dir: 'asc', label: '오래된순' },
  { key: 'title-asc', sortBy: 'title', dir: 'asc', label: '제목순 (가나다)' },
  { key: 'title-desc', sortBy: 'title', dir: 'desc', label: '제목순 (역순)' },
]

function loadSortKey(owner: Owner): SortKey {
  const v = localStorage.getItem('mh.sortBy.' + owner)
  // 이전 버전(방향 없이 recent/title만 저장)과 호환
  if (v === 'recent') return 'recent-desc'
  if (v === 'title') return 'title-asc'
  return SORT_OPTIONS.some((o) => o.key === v) ? (v as SortKey) : 'recent-desc'
}

export function SongList({
  songs, owner, onOpen, onDelete, onNew, onGenerate, onImportSong,
  setlists, onToggleSongInSetList, onCreateSetList,
}: Props) {
  const [query, setQuery] = useState('')
  const [statusF, setStatusF] = useState<PracticeStatus[]>([])
  const [sortKey, setSortKeyState] = useState<SortKey>(() => loadSortKey(owner))
  const [sortSheetOpen, setSortSheetOpen] = useState(false)

  useEffect(() => setSortKeyState(loadSortKey(owner)), [owner])

  function setSortKey(v: SortKey) {
    setSortKeyState(v)
    localStorage.setItem('mh.sortBy.' + owner, v)
  }
  const [pickerSong, setPickerSong] = useState<Song | null>(null)
  const [fabOpen, setFabOpen] = useState(false)
  const [showImport, setShowImport] = useState(false)

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
    const result = songs.filter((s) => {
      if (statusF.length && !statusF.includes(s.status)) return false
      if (!q) return true
      return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    })
    const opt = SORT_OPTIONS.find((o) => o.key === sortKey)!
    return result.sort((a, b) => {
      const cmp = opt.sortBy === 'title' ? a.title.localeCompare(b.title, 'ko') : a.updatedAt - b.updatedAt
      return opt.dir === 'asc' ? cmp : -cmp
    })
  }, [songs, query, statusF, sortKey])

  return (
    <>
      <input className="search" placeholder="제목·아티스트 검색"
        value={query} onChange={(e) => setQuery(e.target.value)} />

      {sortSheetOpen && (
        <div className="modal" onClick={() => setSortSheetOpen(false)}>
          <div className="modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <strong>정렬</strong>
              <button className="btn btn--icon btn--ghost" onClick={() => setSortSheetOpen(false)}>✕</button>
            </div>
            <div className="modal__body" style={{ gap: 2 }}>
              {SORT_OPTIONS.map((o) => (
                <button key={o.key} type="button"
                  className={'sheet-option' + (sortKey === o.key ? ' is-on' : '')}
                  onClick={() => { setSortKey(o.key); setSortSheetOpen(false) }}>
                  {o.label}
                  {sortKey === o.key && <span className="sheet-option__check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="filter-row">
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

        <button type="button" className="sort-trigger" onClick={() => setSortSheetOpen(true)}>
          정렬 · {SORT_OPTIONS.find((o) => o.key === sortKey)?.label}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      <div className="rows">
        {filtered.map((s) => (
          <div key={s.id} className="row-wrap">
            <button className="row" onClick={() => onOpen(s.id)}>
              <div className={'row__dot status-dot--' + s.status} title={PRACTICE_STATUSES.find((x) => x.value === s.status)?.label} />
              <div className="row__body">
                <div className="row__title">{s.title}{s.version && <span className="row__version"> ({s.version})</span>}</div>
                <div className="row__artist">{s.artist || '—'}</div>
              </div>
            </button>
            <button className="row__add" title="셋리스트에 담기" onClick={() => setPickerSong(s)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.5 4h9A1.5 1.5 0 0 1 16 5.5V20l-6-4-6 4V5.5A1.5 1.5 0 0 1 5.5 4z" />
              </svg>
            </button>
            <button className="icon-x icon-x--lg row__del" title="삭제" onClick={() => onDelete(s.id)}>×</button>
          </div>
        ))}
        {filtered.length === 0 && <p className="empty">악보가 없습니다. 아래 + 버튼으로 시작하세요.</p>}
      </div>

      {pickerSong && (
        <SetListPickerModal song={pickerSong} setlists={setlists}
          onToggle={onToggleSongInSetList}
          onCreate={(name, songId) => onCreateSetList(name, songId)}
          onClose={() => setPickerSong(null)} />
      )}

      {showImport && (
        <ImportSongModal owner={owner} onImport={onImportSong} onClose={() => setShowImport(false)} />
      )}

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
            <button className="fab-action fab-action--import" onClick={() => { setFabOpen(false); setShowImport(true) }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />
              </svg>
              다른 사람 악보 가져오기
            </button>
          </div>
        )}
        <button className={'fab' + (fabOpen ? ' is-open' : '')} onClick={() => setFabOpen((o) => !o)}>
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ transition: 'transform 0.2s', transform: fabOpen ? 'rotate(45deg)' : 'none' }}>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </>
  )
}
