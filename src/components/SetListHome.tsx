import { useState } from 'react'
import type { SetList } from '../types'

interface Props {
  setlists: SetList[]
  onOpen: (id: string) => void
  onCreate: (name: string) => void
  onDelete: (id: string) => void
}

export function SetListHome({ setlists, onOpen, onCreate, onDelete }: Props) {
  const [newName, setNewName] = useState('')

  function create() {
    const name = newName.trim()
    if (!name) return
    onCreate(name)
    setNewName('')
  }

  return (
    <>
      <div className="input-row setlist-create-row">
        <input className="text-input" placeholder="새 셋리스트 이름" value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()} />
        <button className="btn btn--sm" disabled={!newName.trim()} onClick={create}>+</button>
      </div>

      <div className="rows">
        {setlists.map((sl) => (
          <div key={sl.id} className="row-wrap">
            <button className="row" onClick={() => onOpen(sl.id)}>
              <div className="row__body">
                <div className="row__title">{sl.name}</div>
                <div className="row__artist">{sl.songIds.length}곡</div>
              </div>
            </button>
            <button className="icon-x icon-x--lg row__del" title="삭제" onClick={() => onDelete(sl.id)}>×</button>
          </div>
        ))}
        {setlists.length === 0 && <p className="empty">아직 셋리스트가 없습니다. 위에서 만들어보세요.</p>}
      </div>
    </>
  )
}
