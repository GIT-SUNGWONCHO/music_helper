import { useMemo, useState } from 'react'
import type { Song, PracticeStatus } from '../types'
import { PRACTICE_STATUSES } from '../types'
import { getUsage, estimateCostUsd, USD_TO_KRW } from '../ai/usage'

interface Props {
  songs: Song[]
  onOpen: (id: string) => void
  onNew: () => void
  onGenerate: () => void
  onSettings: () => void
  onExport: () => void
  onImport: (file: File) => void
}

type StatusFilter = 'all' | PracticeStatus

function songTags(s: Song): string[] {
  return [...s.genreTags, ...s.moodTags]
}

export function SongList({ songs, onOpen, onNew, onGenerate, onSettings, onExport, onImport }: Props) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [activeTags, setActiveTags] = useState<string[]>([])

  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of songs) for (const t of songTags(s)) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [songs])

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of songs) m[s.status] = (m[s.status] ?? 0) + 1
    return m
  }, [songs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return songs.filter((s) => {
      if (status !== 'all' && s.status !== status) return false
      const tags = songTags(s)
      if (activeTags.length && !activeTags.every((t) => tags.includes(t))) return false
      if (!q) return true
      return (
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [songs, query, status, activeTags])

  function toggleTag(t: string) {
    setActiveTags((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]))
  }

  const usage = getUsage()
  const totalTokens = usage.totalInput + usage.totalOutput
  const costUsd = estimateCostUsd(usage.totalInput, usage.totalOutput)

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
          <button className="btn btn--ghost btn--icon" title="설정" onClick={onSettings}>⚙</button>
        </div>
      </div>

      <h1>라이브러리</h1>

      <button className="btn btn--primary btn--generate" onClick={onGenerate}>✨ AI로 악보 만들기</button>
      {usage.totalCount > 0 && (
        <div className="usage" title="유료 환산 추정치입니다. 무료 등급 실제 청구는 $0이며, 정확한 잔량은 Google AI Studio에서 확인하세요.">
          누적 <b>{usage.totalCount}</b>곡 · {totalTokens.toLocaleString()} 토큰
          <span className="usage__dim"> (입력 {usage.totalInput.toLocaleString()} / 출력 {usage.totalOutput.toLocaleString()})</span>
          <span className="usage__sep">·</span>
          유료 환산 ≈ ${costUsd.toFixed(costUsd < 0.01 ? 4 : 2)} (₩{Math.round(costUsd * USD_TO_KRW).toLocaleString()})
          <span className="usage__free"> · 무료 $0</span>
        </div>
      )}

      <input className="search" placeholder="제목·아티스트·태그 검색"
        value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="status-filter">
        <button className={'status-pill' + (status === 'all' ? ' is-on' : '')} onClick={() => setStatus('all')}>
          전체 <span className="status-pill__n">{songs.length}</span>
        </button>
        {PRACTICE_STATUSES.map((st) => (
          <button key={st.value}
            className={'status-pill status-pill--' + st.value + (status === st.value ? ' is-on' : '')}
            onClick={() => setStatus((s) => (s === st.value ? 'all' : st.value))}>
            <span className={'status-dot status-dot--' + st.value} />
            {st.label} <span className="status-pill__n">{statusCounts[st.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="tabs">
          <button className={'tab' + (activeTags.length === 0 ? ' is-on' : '')} onClick={() => setActiveTags([])}>전체</button>
          {allTags.map((t) => (
            <button key={t} className={'tab' + (activeTags.includes(t) ? ' is-on' : '')} onClick={() => toggleTag(t)}>{t}</button>
          ))}
          {activeTags.length > 0 && <button className="tab tab--clear" onClick={() => setActiveTags([])}>초기화</button>}
        </div>
      )}

      <div className="rows">
        {filtered.map((s) => (
          <button key={s.id} className="row" onClick={() => onOpen(s.id)}>
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
