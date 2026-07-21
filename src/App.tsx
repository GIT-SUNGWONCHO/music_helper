import { useEffect, useRef, useState, useCallback } from 'react'
import type { Song } from './types'
import type { GenerateResult } from './ai/generate'
import { db, allSongs, saveSong, deleteSong, newSong, exportJson, importJson } from './db'
import { seedSongs } from './seed'
import { SongList } from './components/SongList'
import { SongView } from './components/SongView'
import { SongEditor } from './components/SongEditor'
import { SettingsModal } from './components/SettingsModal'
import { GenerateModal } from './components/GenerateModal'

type Modal = 'none' | 'generate' | 'settings'

type Screen = { name: 'list' } | { name: 'view'; id: string } | { name: 'edit'; id: string; isNew?: boolean }

export default function App() {
  const [songs, setSongs] = useState<Song[]>([])
  const [screen, setScreen] = useState<Screen>({ name: 'list' })
  const [ready, setReady] = useState(false)
  const [modal, setModal] = useState<Modal>('none')
  const [genMeta, setGenMeta] = useState<Omit<GenerateResult, 'song'> | null>(null)
  const [generatedSong, setGeneratedSong] = useState<Song | null>(null)

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

  const current = (id: string) => songs.find((s) => s.id === id) ?? (generatedSong?.id === id ? generatedSong : undefined)

  async function handleSave(song: Song) {
    await saveSong(song)
    await refresh()
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
    await refresh()
    setScreen({ name: 'list' })
  }
  function handleNew() {
    const s = newSong()
    setGeneratedSong(s)
    setScreen({ name: 'edit', id: s.id, isNew: true })
  }
  async function handleGenerated({ song, ...meta }: GenerateResult) {
    setModal('none')
    setGenMeta(meta)
    setGeneratedSong(song)
    setScreen({ name: 'edit', id: song.id, isNew: true })
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
          onDelete={handleDelete} onNew={handleNew} onGenerate={() => setModal('generate')}
          onSettings={() => setModal('settings')} />
      )}
      {screen.name === 'view' && song && (
        <SongView song={song} onEdit={() => setScreen({ name: 'edit', id: song.id })} onBack={() => setScreen({ name: 'list' })} />
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

      {modal === 'settings' && (
        <SettingsModal onClose={() => setModal('none')} onExport={handleExport} onImport={handleImport} />
      )}
      {modal === 'generate' && (
        <GenerateModal onClose={() => setModal('none')} onOpenSettings={() => setModal('settings')} onGenerated={handleGenerated} />
      )}
    </>
  )
}
