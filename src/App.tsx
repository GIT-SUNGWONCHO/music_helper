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
import { OwnerPicker } from './components/OwnerPicker'
import { HomeScreen, type HomeTab } from './components/HomeScreen'
import { ConfirmModal } from './components/ConfirmModal'
import { loadChordColor, applyChordColor } from './chordColor'

type Modal = 'none' | 'generate' | 'settings'

const SETTINGS_UNLOCKED_KEY = 'mh.settings.unlocked'

/** 홈 화면 상태 — 곡 뷰어/에디터에서 "목록으로" 눌렀을 때 정확히 여기로 돌아옴(라이브러리인지, 어떤 셋리스트 안이었는지 포함). */
interface HomeState { name: 'home'; tab: HomeTab; setlistId?: string }

type Screen =
  | HomeState
  | { name: 'view'; id: string; from: HomeState }
  | { name: 'edit'; id: string; isNew?: boolean; from: HomeState }

const LIBRARY_HOME: HomeState = { name: 'home', tab: 'library' }

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
  const [screen, setScreen] = useState<Screen>(LIBRARY_HOME)
  const [ready, setReady] = useState(false)
  const [modal, setModal] = useState<Modal>('none')
  const [genMeta, setGenMeta] = useState<Omit<GenerateResult, 'song'> | null>(null)
  const [generatedSong, setGeneratedSong] = useState<Song | null>(null)
  const [settingsUnlocked, setSettingsUnlocked] = useState(() => localStorage.getItem(SETTINGS_UNLOCKED_KEY) === '1')
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'admin'>('general')
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null)

  const refresh = useCallback(async (o: Owner) => setSongs(await allSongs(o)), [])
  const refreshSetLists = useCallback(async (o: Owner) => setSetLists(await allSetLists(o)), [])
  const seedChecked = useRef<Set<Owner>>(new Set())

  useEffect(() => {
    if (!ownerChosen) return
    applyChordColor(loadChordColor(owner))
  }, [owner, ownerChosen])

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
    setScreen(LIBRARY_HOME)
  }
  function chooseOwner(o: Owner) {
    saveOwner(o)
    setOwner(o)
    setOwnerChosen(true)
  }

  const current = (id: string) => songs.find((s) => s.id === id) ?? (generatedSong?.id === id ? generatedSong : undefined)

  async function handleSave(song: Song, from: HomeState) {
    await saveSong(song, owner)
    await refresh(owner)
    setGeneratedSong(null)
    setGenMeta(null)
    setScreen({ name: 'view', id: song.id, from })
  }
  function handleDelete(id: string, from: HomeState = LIBRARY_HOME) {
    setConfirmState({
      message: '이 곡을 삭제할까요?',
      onConfirm: async () => {
        setConfirmState(null)
        if (generatedSong?.id === id) {
          setGeneratedSong(null)
          setScreen(from)
          return
        }
        await deleteSong(id)
        await refresh(owner)
        setScreen(from)
      },
    })
  }
  function handleNew() {
    const s = newSong()
    setGeneratedSong(s)
    setScreen({ name: 'edit', id: s.id, isNew: true, from: LIBRARY_HOME })
  }
  function handleDuplicate(source: Song, from: HomeState) {
    const { id, createdAt, updatedAt, ...rest } = source
    const copy = newSong({ ...rest, title: rest.title + ' (복제)' })
    setGeneratedSong(copy)
    setScreen({ name: 'edit', id: copy.id, isNew: true, from })
  }
  async function handleGenerated({ song, ...meta }: GenerateResult) {
    setModal('none')
    setGenMeta(meta)
    setGeneratedSong(song)
    setScreen({ name: 'edit', id: song.id, isNew: true, from: LIBRARY_HOME })
  }
  async function handleImportSong(source: Song) {
    const { id, createdAt, updatedAt, ...rest } = source
    await saveSong(newSong(rest), owner)
    await refresh(owner)
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
  function handleDeleteSetList(id: string) {
    setConfirmState({
      message: '이 셋리스트를 삭제할까요?',
      onConfirm: async () => {
        setConfirmState(null)
        await deleteSetList(id)
        await refreshSetLists(owner)
        setScreen({ name: 'home', tab: 'setlists' })
      },
    })
  }

  if (!supabaseReady) return <SupabaseSetupNotice />
  if (!ownerChosen) return <OwnerPicker onChoose={chooseOwner} />
  if (!ready) return <div className="loading">불러오는 중…</div>

  const song = (screen.name === 'view' || screen.name === 'edit') ? current(screen.id) : undefined
  if ((screen.name === 'view' || screen.name === 'edit') && !song) {
    setScreen(LIBRARY_HOME)
    return null
  }

  return (
    <>
      {screen.name === 'home' && (
        <HomeScreen tab={screen.tab} setlistId={screen.setlistId}
          onTabChange={(tab) => setScreen({ name: 'home', tab, setlistId: screen.setlistId })}
          songs={songs} owner={owner} onSwitchOwner={switchOwner}
          onOpen={(id) => setScreen({ name: 'view', id, from: { name: 'home', tab: 'library' } })}
          onDelete={(id) => handleDelete(id, { name: 'home', tab: screen.tab, setlistId: screen.setlistId })}
          onNew={handleNew} onGenerate={() => setModal('generate')}
          onImportSong={handleImportSong}
          onSettings={() => { setSettingsInitialTab('general'); setModal('settings') }}
          setlists={setlists}
          onOpenSetList={(id) => setScreen({ name: 'home', tab: 'setlists', setlistId: id })}
          onCloseSetListDetail={() => setScreen({ name: 'home', tab: 'setlists' })}
          onOpenSetlistSong={(id) => setScreen({ name: 'view', id, from: { name: 'home', tab: 'setlists', setlistId: screen.setlistId } })}
          onCreateSetList={handleCreateSetList} onDeleteSetList={handleDeleteSetList}
          onToggleSongInSetList={handleToggleSongInSetList}
          onRenameSetList={handleRenameSetList} onReorderSetList={handleReorderSetList}
          onRemoveSongFromSetList={handleRemoveSongFromSetList} />
      )}
      {screen.name === 'view' && song && (
        <SongView song={song} onEdit={() => setScreen({ name: 'edit', id: song.id, from: screen.from })}
          onBack={() => setScreen(screen.from)}
          onDuplicate={() => handleDuplicate(song, screen.from)}
          onDelete={(id) => handleDelete(id, screen.from)} />
      )}
      {screen.name === 'edit' && song && (
        <SongEditor song={song} genMeta={genMeta}
          onSave={(s) => handleSave(s, screen.from)}
          onCancel={() => {
            setGenMeta(null)
            if (screen.name === 'edit' && screen.isNew) { setGeneratedSong(null); setScreen(screen.from) }
            else setScreen({ name: 'view', id: song.id, from: screen.from })
          }}
          onDelete={(id) => handleDelete(id, screen.from)} />
      )}

      {modal === 'settings' && (
        <SettingsModal onClose={() => setModal('none')} owner={owner}
          initialTab={settingsInitialTab}
          unlocked={settingsUnlocked}
          onUnlock={() => { localStorage.setItem(SETTINGS_UNLOCKED_KEY, '1'); setSettingsUnlocked(true) }} />
      )}
      {modal === 'generate' && (
        <GenerateModal onClose={() => setModal('none')}
          onOpenSettings={() => { setSettingsInitialTab('admin'); setModal('settings') }}
          onGenerated={handleGenerated} />
      )}

      {confirmState && (
        <ConfirmModal title="삭제" message={confirmState.message} confirmLabel="삭제" danger
          onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />
      )}
    </>
  )
}
