import { useState } from 'react'
import type { Song, SetList } from '../types'

interface Props {
  song: Song
  setlists: SetList[]
  onToggle: (setlistId: string, songId: string) => void
  onCreate: (name: string, songId: string) => void
  onClose: () => void
}

/** YouTube 재생목록처럼 — 곡 하나를 여러 셋리스트에 체크해서 담고, 없으면 그 자리에서 새로 만듦. */
export function SetListPickerModal({ song, setlists, onToggle, onCreate, onClose }: Props) {
  const [newName, setNewName] = useState('')

  function create() {
    const name = newName.trim()
    if (!name) return
    onCreate(name, song.id)
    setNewName('')
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong>셋리스트에 담기</strong>
          <button className="btn btn--icon btn--ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body" style={{ gap: 2 }}>
          {setlists.length === 0 && (
            <p className="hint" style={{ padding: '0 0 6px' }}>아직 셋리스트가 없습니다. 아래에서 만들어보세요.</p>
          )}
          {setlists.map((sl) => {
            const checked = sl.songIds.includes(song.id)
            return (
              <button key={sl.id} type="button"
                className={'sheet-option' + (checked ? ' is-on' : '')}
                onClick={() => onToggle(sl.id, song.id)}>
                <span>{sl.name} <span className="muted" style={{ fontSize: '0.85em' }}>· {sl.songIds.length}곡</span></span>
                {checked && <span className="sheet-option__check">✓</span>}
              </button>
            )
          })}
          <div className="input-row" style={{ marginTop: 10 }}>
            <input className="text-input" placeholder="새 셋리스트 이름" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()} />
            <button className="btn btn--sm" disabled={!newName.trim()} onClick={create}>만들기</button>
          </div>
        </div>
      </div>
    </div>
  )
}
