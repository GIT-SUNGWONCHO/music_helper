import { useEffect, useRef, useState, useCallback } from 'react'
import type { Song } from './types'
import { db, allSongs, saveSong, deleteSong, newSong, exportJson, importJson } from './db'
import { seedSongs } from './seed'
import { SongList } from './components/SongList'
import { SongView } from './components/SongView'
import { SongEditor } from './components/SongEditor'
import { SettingsModal } from './components/SettingsModal'
import { GenerateModal } from './components/GenerateModal'

type Modal = 'none' | 'generate' | 'settings'

type Screen = { name: 'list' } | { name: 'view'; id: string } | { name: 'edit'; id: string }

export default function App() {
  const [songs, setSongs] = useState<Song[]>([])
  const [screen, setScreen] = useState<Screen>({ name: 'list' })
  const [ready, setReady] = useState(false)
  const [modal, setModal] = useState<Modal>('none')

  const refresh = useCallback(async () => setSongs(await allSongs()), [])
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    ;(async () => {
      const count = await db.songs.count()
      if (count === 0) await db.songs.bulkPut(seedSongs())
      await refresh()
      setReady(true)
    })()
  }, [refresh])

  const current = (id: string) => songs.find((s) => s.id === id)

  async function handleSave(song: Song) {
    await saveSong(song)
    await refresh()
    setScreen({ name: 'view', id: song.id })
  }
  async function handleDelete(id: string) {
    if (!confirm('이 곡을 삭제할까요?')) return
    await deleteSong(id)
    await refresh()
    setScreen({ name: 'list' })
  }
  async function handleNew() {
    const s = newSong()
    await saveSong(s)
    await refresh()
    setScreen({ name: 'edit', id: s.id })
  }
  async function handleGenerated(s: Song) {
    await saveSong(s)
    await refresh()
    setModal('none')
    setScreen({ name: 'edit', id: s.id })
  }
  async function handleExport() {
    const text = await exportJson()
    const blob = new Blob([text], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `music-helper-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  async function handleImport(file: File) {
    try {
      const n = await importJson(await file.text())
      await refresh()
      alert(`${n}곡을 가져왔습니다.`)
    } catch (e) {
      alert('가져오기 실패: ' + (e as Error).message)
    }
  }

  if (!ready) return <div className="loading">불러오는 중…</div>

  const song = screen.name === 'list' ? undefined : current(screen.id)
  if (screen.name !== 'list' && !song) {
    setScreen({ name: 'list' })
    return null
  }

  return (
    <>
      {screen.name === 'list' && (
        <SongList songs={songs} onOpen={(id) => setScreen({ name: 'view', id })}
          onNew={handleNew} onGenerate={() => setModal('generate')} onSettings={() => setModal('settings')}
          onExport={handleExport} onImport={handleImport} />
      )}
      {screen.name === 'view' && song && (
        <SongView song={song} onEdit={() => setScreen({ name: 'edit', id: song.id })} onBack={() => setScreen({ name: 'list' })} />
      )}
      {screen.name === 'edit' && song && (
        <SongEditor song={song} onSave={handleSave} onCancel={() => setScreen({ name: 'view', id: song.id })} onDelete={handleDelete} />
      )}

      {modal === 'settings' && <SettingsModal onClose={() => setModal('none')} />}
      {modal === 'generate' && (
        <GenerateModal onClose={() => setModal('none')} onOpenSettings={() => setModal('settings')} onGenerated={handleGenerated} />
      )}
    </>
  )
}
