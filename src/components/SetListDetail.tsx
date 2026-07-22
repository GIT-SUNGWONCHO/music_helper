import { useEffect, useRef, useState } from 'react'
import type { Song, SetList } from '../types'

interface Props {
  setlist: SetList
  songs: Song[]
  onBack: () => void
  onOpenSong: (id: string) => void
  onRename: (name: string) => void
  onReorder: (songIds: string[]) => void
  onRemoveSong: (songId: string) => void
  onDelete: () => void
}

export function SetListDetail({ setlist, songs, onBack, onOpenSong, onRename, onReorder, onRemoveSong, onDelete }: Props) {
  const [name, setName] = useState(setlist.name)
  const [order, setOrder] = useState(setlist.songIds)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => setName(setlist.name), [setlist.id, setlist.name])
  useEffect(() => setOrder(setlist.songIds), [setlist.id, setlist.songIds])

  const bySong = new Map(songs.map((s) => [s.id, s]))
  const resolvedOrder = order.filter((id) => bySong.has(id))

  function commitRename() {
    const v = name.trim()
    if (v && v !== setlist.name) onRename(v)
    else setName(setlist.name)
  }

  useEffect(() => {
    if (dragIndex === null) return
    function move(e: PointerEvent) {
      const y = e.clientY
      let targetIndex = dragIndex as number
      for (let i = 0; i < rowRefs.current.length; i++) {
        const el = rowRefs.current[i]
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (y >= rect.top && y <= rect.bottom) { targetIndex = i; break }
      }
      if (targetIndex !== dragIndex) {
        setOrder((prev) => {
          const next = prev.slice()
          const [moved] = next.splice(dragIndex as number, 1)
          next.splice(targetIndex, 0, moved)
          return next
        })
        setDragIndex(targetIndex)
      }
    }
    function up() {
      setDragIndex((idx) => {
        if (idx !== null) onReorder(order)
        return null
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragIndex])

  return (
    <div className="page list">
      <div className="toolbar">
        <button className="btn" onClick={onBack}>← 셋리스트</button>
        <div className="spacer" />
        <button className="btn btn--ghost btn--danger" onClick={onDelete}>삭제</button>
      </div>

      <div style={{ padding: '16px' }}>
        <input className="setlist-name-input" value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        <p className="hint" style={{ padding: '4px 0 14px' }}>
          {resolvedOrder.length}곡 · 손잡이(⠿)를 눌러 끌면 순서를 바꿀 수 있어요
        </p>

        <div className="setlist-rows">
          {resolvedOrder.map((songId, i) => {
            const song = bySong.get(songId)!
            return (
              <div key={songId} ref={(el) => { rowRefs.current[i] = el }}
                className={'setlist-row' + (dragIndex === i ? ' is-dragging' : '')}>
                <button type="button" className="setlist-row__handle"
                  onPointerDown={(e) => { e.preventDefault(); setDragIndex(i) }}>⠿</button>
                <button className="setlist-row__body" onClick={() => onOpenSong(songId)}>
                  <div className="row__title">{song.title}{song.version && <span className="row__version"> ({song.version})</span>}</div>
                  <div className="row__artist">{song.artist || '—'}</div>
                </button>
                <button className="row__del" title="빼기" onClick={() => onRemoveSong(songId)}>×</button>
              </div>
            )
          })}
          {resolvedOrder.length === 0 && <p className="empty">아직 곡이 없습니다. 라이브러리에서 담아보세요.</p>}
        </div>
      </div>
    </div>
  )
}
