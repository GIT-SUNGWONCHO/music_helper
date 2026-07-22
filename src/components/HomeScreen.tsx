import { useState } from 'react'
import type { Song, SetList } from '../types'
import { OWNERS, type Owner } from '../supabase'
import { ChordLibraryModal } from './ChordLibraryModal'
import { SongList } from './SongList'
import { SetListHome } from './SetListHome'

export type HomeTab = 'library' | 'setlists'

interface Props {
  tab: HomeTab
  onTabChange: (tab: HomeTab) => void
  songs: Song[]
  owner: Owner
  onSwitchOwner: (o: Owner) => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onGenerate: () => void
  onSettings: () => void
  setlists: SetList[]
  onOpenSetList: (id: string) => void
  onCreateSetList: (name: string, songId?: string) => void
  onDeleteSetList: (id: string) => void
  onToggleSongInSetList: (setlistId: string, songId: string) => void
}

export function HomeScreen({
  tab, onTabChange, songs, owner, onSwitchOwner, onOpen, onDelete, onNew, onGenerate, onSettings,
  setlists, onOpenSetList, onCreateSetList, onDeleteSetList, onToggleSongInSetList,
}: Props) {
  const [showChordLib, setShowChordLib] = useState(false)

  return (
    <div className="list">
      <div className="app-header">
        <div className="app-header__brand">GENCHRD<span className="app-header__brand-dot">.</span></div>
        <div className="app-header__actions">
          <button className="btn btn--ghost btn--sm" onClick={() => setShowChordLib(true)}>코드표</button>
          <button className="btn btn--ghost btn--sm" onClick={onSettings}>설정</button>
        </div>
      </div>

      <div className="owner-row">
        <div className="seg">
          {OWNERS.map((o) => (
            <button key={o.value} type="button"
              className={'seg__btn' + (owner === o.value ? ' is-on' : '')}
              onClick={() => onSwitchOwner(o.value)}>{o.label}</button>
          ))}
        </div>
      </div>

      <div className="tab-bar">
        <button type="button" className={'tab-bar__btn' + (tab === 'library' ? ' is-on' : '')}
          onClick={() => onTabChange('library')}>라이브러리</button>
        <button type="button" className={'tab-bar__btn' + (tab === 'setlists' ? ' is-on' : '')}
          onClick={() => onTabChange('setlists')}>셋리스트</button>
      </div>

      {showChordLib && <ChordLibraryModal onClose={() => setShowChordLib(false)} />}

      {tab === 'library' && (
        <SongList songs={songs} onOpen={onOpen} onDelete={onDelete} onNew={onNew} onGenerate={onGenerate}
          setlists={setlists} onToggleSongInSetList={onToggleSongInSetList} onCreateSetList={onCreateSetList} />
      )}
      {tab === 'setlists' && (
        <SetListHome setlists={setlists} onOpen={onOpenSetList} onCreate={onCreateSetList} onDelete={onDeleteSetList} />
      )}
    </div>
  )
}
