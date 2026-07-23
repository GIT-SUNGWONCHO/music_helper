import { useEffect, useState } from 'react'
import type { Song } from '../types'
import { OWNERS, type Owner } from '../supabase'
import { allSongs } from '../db'

interface Props {
  owner: Owner
  onImport: (song: Song) => void
  onClose: () => void
}

/** 내 정체성(owner)은 그대로 두고, 상대방 라이브러리를 읽기 전용으로 보여준 뒤 골라서 내 라이브러리로 복사. */
export function ImportSongModal({ owner, onImport, onClose }: Props) {
  const other = OWNERS.find((o) => o.value !== owner)!
  const [songs, setSongs] = useState<Song[] | null>(null)
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    allSongs(other.value).then((s) => { if (!cancelled) setSongs(s) })
    return () => { cancelled = true }
  }, [other.value])

  function copy(s: Song) {
    onImport(s)
    setCopiedIds((prev) => new Set(prev).add(s.id))
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong>{other.label} 악보 가져오기</strong>
          <button className="btn btn--icon btn--ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          {songs === null && <p className="hint">불러오는 중…</p>}
          {songs && songs.length === 0 && <p className="hint">{other.label}의 악보가 없습니다.</p>}
          <div className="rows">
            {songs?.map((s) => (
              <div key={s.id} className="row-wrap">
                <div className="row" style={{ cursor: 'default' }}>
                  <div className="row__body">
                    <div className="row__title">{s.title}{s.version && <span className="row__version"> ({s.version})</span>}</div>
                    <div className="row__artist">{s.artist || '—'}</div>
                  </div>
                </div>
                <button className="btn btn--sm" disabled={copiedIds.has(s.id)} onClick={() => copy(s)}>
                  {copiedIds.has(s.id) ? '복사됨' : '복사'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
