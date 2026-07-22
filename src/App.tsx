import { useEffect, useRef, useState, useCallback } from 'react'
import type { Song, SetList } from './types'
import type { GenerateResult } from './ai/generate'
import {
  allSongs, saveSong, deleteSong, newSong, countSongs, bulkSaveSongs,
  allSetLists, saveSetList, deleteSetList, newSetList,
} from './db'
import { supabaseReady, loadOwner, saveOwner, hasChosenOwner, type Owner } from './supabase'
import { seedSongs } from './seed'
import { SongView } from './components/SongView'
import { SongEditor } from './components/SongEditor'
import { SettingsModal } from './components/SettingsModal'
import { GenerateModal } from './components/GenerateModal'
import { PinPrompt } from './components/PinPrompt'
import { OwnerPicker } from './components/OwnerPicker'
import { HomeScreen, type HomeTab } from './components/HomeScreen'
import { SetListDetail } from './components/SetListDetail'

type Modal = 'none' | 'generate' | 'settings' | 'pin'

const SETTINGS_UNLOCKED_KEY = 'mh.settings.unlocked'

type Screen =
  | { name: 'home'; tab: HomeTab }
  | { name: 'view'; id: string }
  | { name: 'edit'; id: string; isNew?: boolean }
  | { name: 'setlist'; id: string }

function SupabaseSetupNotice() {
  return (
    <div className="loading" style={{ flexDirection: 'column', gap: 10, textAlign: 'center', padding: 20 }}>
      <div>Supabase 설정이 필요합니다.</div>
      <div className="hint" style={{ padding: 0 }}>
        프로젝트 루트에 <code>.env.local</code> 파일을 만들고<br />
        <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>를 채운 뒤 서버를 다시 시작하세요.
      </div>
    </div>
  )
}

export default function App() {
  const [owner, setOwner] = useState<Owner>(() => loadOwner())
  const [ownerChosen, setOwnerChosen] = useState(() => hasChosenOwner())
  const [songs, setSongs] = useState<Song[]>([])
  const [setlists, setSetLists] = useState<SetList[]>([])
  const [screen, setScreen] = useState<Screen>({ name: 'home', tab: 'library' })
  const [ready, setReady] = useState(false)
  const [modal, setModal] = useState<Modal>('none')
  const [genMeta, setGenMeta] = useState<Omit<GenerateResult, 'song'> | null>(null)
  const [generatedSong, setGeneratedSong] = useState<Song | null>(null)
  const [settingsUnlocked, setSettingsUnlocked] = useState(() => localStorage.getItem(SETTINGS_UNLOCKED_KEY) === '1')

  const refresh = useCallback(async (o: Owner) => setSongs(await allSongs(o)), [])
  const refreshSetLists = useCallback(async (o: Owner) => setSetLists(await allSetLists(o)), [])
  const seedChecked = useRef<Set<Owner>>(new Set())

  useEffect(() => {
    if (!supabaseReady) { setReady(true); return }
    if (!ownerChosen) return // 누구인지 고르기 전에는 어떤 owner로도 조회/시드하지 않음
    let cancelled = false
    ;(async () => {
      setReady(false)
      if (!seedChecked.current.has(owner)) {
        seedChecked.current.add(owner)
        const count = await countSongs(owner)
        if (count === 0) await bulkSaveSongs(seedSongs(), owner)
      }
      if (cancelled) return
      await refresh(owner)
      await refreshSetLists(owner)
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [owner, ownerChosen, refresh, refreshSetLists])

  function switchOwner(o: Owner) {
    saveOwner(o)
    setOwner(o)
    setScreen({ name: 'home', tab: 'library' })
  }
  function chooseOwner(o: Owner) {
    saveOwner(o)
    setOwner(o)
    setOwnerChosen(true)
  }

  const current = (id: string) => songs.find((s) => s.id === id) ?? (generatedSong?.id === id ? generatedSong : undefined)

  async function handleSave(song: Song) {
    await saveSong(song, owner)
    await refresh(owner)
    setGeneratedSong(null)
    setGenMeta(null)
    setScreen({ name: 'view', id: song.id })
  }
  async function handleDelete(id: string) {
    if (!confirm('이 곡을 삭제할까요?')) return
    if (generatedSong?.id === id) {
      setGeneratedSong(null)
      setScreen({ name: 'home', tab: 'library' })
      return
    }
    await deleteSong(id)
    await refresh(owner)
    setScreen({ name: 'home', tab: 'library' })
  }
  function handleNew() {
    const s = newSong()
    setGeneratedSong(s)
    setScreen({ name: 'edit', id: s.id, isNew: true })
  }
  function handleDuplicate(source: Song) {
    const { id, createdAt, updatedAt, ...rest } = source
    const copy = newSong({ ...rest, title: rest.title + ' (복제)' })
    setGeneratedSong(copy)
    setScreen({ name: 'edit', id: copy.id, isNew: true })
  }
  async function handleGenerated({ song, ...meta }: GenerateResult) {
    setModal('none')
    setGenMeta(meta)
    setGeneratedSong(song)
    setScreen({ name: 'edit', id: song.id, isNew: true })
  }

  async function handleCreateSetList(name: string, songId?: string) {
    await saveSetList(newSetList(name, songId ? [songId] : []), owner)
    await refreshSetLists(owner)
  }
  async function handleToggleSongInSetList(setlistId: string, songId: string) {
    const sl = setlists.find((s) => s.id === setlistId)
    if (!sl) return
    const songIds = sl.songIds.includes(songId) ? sl.songIds.filter((id) => id !== songId) : [...sl.songIds, songId]
    await saveSetList({ ...sl, songIds }, owner)
    await refreshSetLists(owner)
  }
  async function handleRenameSetList(id: string, name: string) {
    const sl = setlists.find((s) => s.id === id)
    if (!sl) return
    await saveSetList({ ...sl, name }, owner)
    await refreshSetLists(owner)
  }
  async function handleReorderSetList(id: string, songIds: string[]) {
    const sl = setlists.find((s) => s.id === id)
    if (!sl) return
    await saveSetList({ ...sl, songIds }, owner)
    await refreshSetLists(owner)
  }
  async function handleRemoveSongFromSetList(setlistId: string, songId: string) {
    const sl = setlists.find((s) => s.id === setlistId)
    if (!sl) return
    await saveSetList({ ...sl, songIds: sl.songIds.filter((id) => id !== songId) }, owner)
    await refreshSetLists(owner)
  }
  async function handleDeleteSetList(id: string) {
    if (!confirm('이 셋리스트를 삭제할까요?')) return
    await deleteSetList(id)
    await refreshSetLists(owner)
    setScreen({ name: 'home', tab: 'setlists' })
  }

  if (!supabaseReady) return <SupabaseSetupNotice />
  if (!ownerChosen) return <OwnerPicker onChoose={chooseOwner} />
  if (!ready) return <div className="loading">불러오는 중…</div>

  const song = (screen.name === 'view' || screen.name === 'edit') ? current(screen.id) : undefined
  if ((screen.name === 'view' || screen.name === 'edit') && !song) {
    setScreen({ name: 'home', tab: 'library' })
    return null
  }
  const activeSetList = screen.name === 'setlist' ? setlists.find((s) => s.id === screen.id) : undefined
  if (screen.name === 'setlist' && !activeSetList) {
    setScreen({ name: 'home', tab: 'setlists' })
    return null
  }

  return (
    <>
      {screen.name === 'home' && (
        <HomeScreen tab={screen.tab} onTabChange={(tab) => setScreen({ name: 'home', tab })}
          songs={songs} owner={owner} onSwitchOwner={switchOwner} onOpen={(id) => setScreen({ name: 'view', id })}
          onDelete={handleDelete} onNew={handleNew} onGenerate={() => setModal('generate')}
          onSettings={() => setModal(settingsUnlocked ? 'settings' : 'pin')}
          setlists={setlists} onOpenSetList={(id) => setScreen({ name: 'setlist', id })}
          onCreateSetList={handleCreateSetList} onDeleteSetList={handleDeleteSetList}
          onToggleSongInSetList={handleToggleSongInSetList} />
      )}
      {screen.name === 'setlist' && activeSetList && (
        <SetListDetail setlist={activeSetList} songs={songs}
          onBack={() => setScreen({ name: 'home', tab: 'setlists' })}
          onOpenSong={(id) => setScreen({ name: 'view', id })}
          onRename={(name) => handleRenameSetList(activeSetList.id, name)}
          onReorder={(songIds) => handleReorderSetList(activeSetList.id, songIds)}
          onRemoveSong={(songId) => handleRemoveSongFromSetList(activeSetList.id, songId)}
          onDelete={() => handleDeleteSetList(activeSetList.id)} />
      )}
      {screen.name === 'view' && song && (
        <SongView song={song} onEdit={() => setScreen({ name: 'edit', id: song.id })} onBack={() => setScreen({ name: 'home', tab: 'library' })}
          onDuplicate={() => handleDuplicate(song)} onDelete={handleDelete} />
      )}
      {screen.name === 'edit' && song && (
        <SongEditor song={song} genMeta={genMeta}
          onSave={handleSave}
          onCancel={() => {
            setGenMeta(null)
            if (screen.name === 'edit' && screen.isNew) { setGeneratedSong(null); setScreen({ name: 'home', tab: 'library' }) }
            else setScreen({ name: 'view', id: song.id })
          }}
          onDelete={handleDelete} />
      )}

      {modal === 'pin' && (
        <PinPrompt
          onClose={() => setModal('none')}
          onSuccess={() => {
            localStorage.setItem(SETTINGS_UNLOCKED_KEY, '1')
            setSettingsUnlocked(true)
            setModal('settings')
          }}
        />
      )}
      {modal === 'settings' && <SettingsModal onClose={() => setModal('none')} />}
      {modal === 'generate' && (
        <GenerateModal onClose={() => setModal('none')}
          onOpenSettings={() => setModal(settingsUnlocked ? 'settings' : 'pin')}
          onGenerated={handleGenerated} />
      )}
    </>
  )
}
