import { useEffect, useRef, useState, useCallback } from 'react'
import type { Song } from './types'
import type { GenerateResult } from './ai/generate'
import { allSongs, saveSong, deleteSong, newSong, countSongs, bulkSaveSongs } from './db'
import { supabaseReady, loadOwner, saveOwner, type Owner } from './supabase'
import { seedSongs } from './seed'
import { SongList } from './components/SongList'
import { SongView } from './components/SongView'
import { SongEditor } from './components/SongEditor'
import { SettingsModal } from './components/SettingsModal'
import { GenerateModal } from './components/GenerateModal'
import { PinPrompt } from './components/PinPrompt'

type Modal = 'none' | 'generate' | 'settings' | 'pin'

const SETTINGS_UNLOCKED_KEY = 'mh.settings.unlocked'

type Screen = { name: 'list' } | { name: 'view'; id: string } | { name: 'edit'; id: string; isNew?: boolean }

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
  const [songs, setSongs] = useState<Song[]>([])
  const [screen, setScreen] = useState<Screen>({ name: 'list' })
  const [ready, setReady] = useState(false)
  const [modal, setModal] = useState<Modal>('none')
  const [genMeta, setGenMeta] = useState<Omit<GenerateResult, 'song'> | null>(null)
  const [generatedSong, setGeneratedSong] = useState<Song | null>(null)
  const [settingsUnlocked, setSettingsUnlocked] = useState(() => localStorage.getItem(SETTINGS_UNLOCKED_KEY) === '1')

  const refresh = useCallback(async (o: Owner) => setSongs(await allSongs(o)), [])
  const seedChecked = useRef<Set<Owner>>(new Set())

  useEffect(() => {
    if (!supabaseReady) { setReady(true); return }
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
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [owner, refresh])

  function switchOwner(o: Owner) {
    saveOwner(o)
    setOwner(o)
    setScreen({ name: 'list' })
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
      setScreen({ name: 'list' })
      return
    }
    await deleteSong(id)
    await refresh(owner)
    setScreen({ name: 'list' })
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
  if (!supabaseReady) return <SupabaseSetupNotice />
  if (!ready) return <div className="loading">불러오는 중…</div>

  const song = screen.name === 'list' ? undefined : current(screen.id)
  if (screen.name !== 'list' && !song) {
    setScreen({ name: 'list' })
    return null
  }

  return (
    <>
      {screen.name === 'list' && (
        <SongList songs={songs} owner={owner} onSwitchOwner={switchOwner} onOpen={(id) => setScreen({ name: 'view', id })}
          onDelete={handleDelete} onNew={handleNew} onGenerate={() => setModal('generate')}
          onSettings={() => setModal(settingsUnlocked ? 'settings' : 'pin')} />
      )}
      {screen.name === 'view' && song && (
        <SongView song={song} onEdit={() => setScreen({ name: 'edit', id: song.id })} onBack={() => setScreen({ name: 'list' })}
          onDuplicate={() => handleDuplicate(song)} onDelete={handleDelete} />
      )}
      {screen.name === 'edit' && song && (
        <SongEditor song={song} genMeta={genMeta}
          onSave={handleSave}
          onCancel={() => {
            setGenMeta(null)
            if (screen.name === 'edit' && screen.isNew) { setGeneratedSong(null); setScreen({ name: 'list' }) }
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
