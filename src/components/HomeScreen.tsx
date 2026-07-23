import { useState } from 'react'
import type { Song, SetList } from '../types'
import { OWNERS, type Owner } from '../supabase'
import { ChordLibraryModal } from './ChordLibraryModal'
import { UpdateNotesModal } from './UpdateNotesModal'
import { SongList } from './SongList'
import { SetListHome } from './SetListHome'
import { SetListDetail } from './SetListDetail'
import { currentVersion, hasUnseenUpdate, markUpdatesSeen } from '../updates'

export type HomeTab = 'library' | 'setlists'

interface Props {
  tab: HomeTab
  setlistId?: string
  onTabChange: (tab: HomeTab) => void
  songs: Song[]
  owner: Owner
  onSwitchOwner: (o: Owner) => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onGenerate: () => void
  onImportSong: (song: Song) => void
  onSettings: () => void
  setlists: SetList[]
  onOpenSetList: (id: string) => void
  onCloseSetListDetail: () => void
  onOpenSetlistSong: (id: string) => void
  onCreateSetList: (name: string, songId?: string) => void
  onDeleteSetList: (id: string) => void
  onToggleSongInSetList: (setlistId: string, songId: string) => void
  onRenameSetList: (id: string, name: string) => void
  onReorderSetList: (id: string, songIds: string[]) => void
  onRemoveSongFromSetList: (setlistId: string, songId: string) => void
}

export function HomeScreen({
  tab, setlistId, onTabChange, songs, owner, onSwitchOwner, onOpen, onDelete, onNew, onGenerate, onImportSong, onSettings,
  setlists, onOpenSetList, onCloseSetListDetail, onOpenSetlistSong, onCreateSetList, onDeleteSetList,
  onToggleSongInSetList, onRenameSetList, onReorderSetList, onRemoveSongFromSetList,
}: Props) {
  const [showChordLib, setShowChordLib] = useState(false)
  const [showUpdates, setShowUpdates] = useState(false)
  const [unseenUpdate, setUnseenUpdate] = useState(hasUnseenUpdate)
  const activeSetList = setlistId ? setlists.find((s) => s.id === setlistId) : undefined

  function openUpdates() {
    setShowUpdates(true)
    markUpdatesSeen()
    setUnseenUpdate(false)
  }

  return (
    <div className="list">
      <div className="app-header">
        <div className="app-header__brand-row">
          <div className="app-header__brand">GENCHRD<span className="app-header__brand-dot">.</span></div>
          <button className="update-badge" onClick={openUpdates}>
            <span className="update-badge__text">v{currentVersion()}</span>
            {unseenUpdate && <span className="update-badge__dot" />}
          </button>
        </div>
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
      {showUpdates && <UpdateNotesModal onClose={() => setShowUpdates(false)} />}

      {tab === 'library' && (
        <SongList songs={songs} owner={owner} onOpen={onOpen} onDelete={onDelete} onNew={onNew} onGenerate={onGenerate}
          onImportSong={onImportSong}
          setlists={setlists} onToggleSongInSetList={onToggleSongInSetList} onCreateSetList={onCreateSetList} />
      )}
      {tab === 'setlists' && (
        activeSetList ? (
          <SetListDetail setlist={activeSetList} songs={songs}
            onBack={onCloseSetListDetail}
            onOpenSong={onOpenSetlistSong}
            onRename={(name) => onRenameSetList(activeSetList.id, name)}
            onReorder={(songIds) => onReorderSetList(activeSetList.id, songIds)}
            onRemoveSong={(songId) => onRemoveSongFromSetList(activeSetList.id, songId)}
            onDelete={() => onDeleteSetList(activeSetList.id)} />
        ) : (
          <SetListHome setlists={setlists} onOpen={onOpenSetList} onCreate={onCreateSetList} onDelete={onDeleteSetList} />
        )
      )}
    </div>
  )
}
