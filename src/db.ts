import type { Song, Section, Bar } from './types'
import { supabase, type Owner } from './supabase'

let counter = 0
export function uid(): string {
  return 'x' + Math.abs(hashStr(String(performance.now()) + ':' + counter++)).toString(36)
}
function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

export function newBar(chords: string[] = [], lyric = ''): Bar {
  return { id: uid(), chords, lyric }
}

export function newSection(label = 'Verse', bars?: Bar[]): Section {
  return { id: uid(), label, bars: bars ?? [newBar(), newBar(), newBar(), newBar()] }
}

export function newSong(partial?: Partial<Song>): Song {
  const now = Date.now()
  return {
    id: uid(),
    title: '제목 없음',
    artist: '',
    originalKey: 'C',
    tempo: undefined,
    moodTags: [],
    genreTags: [],
    status: 'want',
    capoFret: 0,
    sections: [newSection()],
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

// ---- Supabase row <-> Song mapping ----
interface SongRow {
  id: string
  owner: string
  title: string
  artist: string
  original_key: string
  tempo: number | null
  mood_tags: string[] | null
  genre_tags: string[] | null
  status: string
  capo_fret: number | null
  fingerings: Record<string, number> | null
  hidden_chords: string[] | null
  pinned_chords: string[] | null
  sections: Section[] | null
  created_at: number
  updated_at: number
}

function toRow(song: Song, owner: Owner): SongRow {
  return {
    id: song.id,
    owner,
    title: song.title,
    artist: song.artist,
    original_key: song.originalKey,
    tempo: song.tempo ?? null,
    mood_tags: song.moodTags,
    genre_tags: song.genreTags,
    status: song.status,
    capo_fret: song.capoFret ?? 0,
    fingerings: song.fingerings ?? {},
    hidden_chords: song.hiddenChords ?? [],
    pinned_chords: song.pinnedChords ?? [],
    sections: song.sections,
    created_at: song.createdAt,
    updated_at: song.updatedAt,
  }
}

function fromRow(row: SongRow): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    originalKey: row.original_key,
    tempo: row.tempo ?? undefined,
    moodTags: row.mood_tags ?? [],
    genreTags: row.genre_tags ?? [],
    status: (row.status as Song['status']) ?? 'want',
    capoFret: row.capo_fret ?? 0,
    fingerings: row.fingerings ?? {},
    hiddenChords: row.hidden_chords ?? [],
    pinnedChords: row.pinned_chords ?? [],
    sections: row.sections ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function requireClient() {
  if (!supabase) throw new Error('Supabase 설정이 필요합니다. 설정에서 URL/키를 확인하세요.')
  return supabase
}

export async function allSongs(owner: Owner): Promise<Song[]> {
  const { data, error } = await requireClient()
    .from('songs')
    .select('*')
    .eq('owner', owner)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as SongRow[]).map(fromRow)
}

export async function countSongs(owner: Owner): Promise<number> {
  const { count, error } = await requireClient()
    .from('songs')
    .select('id', { count: 'exact', head: true })
    .eq('owner', owner)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function saveSong(song: Song, owner: Owner): Promise<void> {
  song.updatedAt = Date.now()
  const { error } = await requireClient().from('songs').upsert(toRow(song, owner))
  if (error) throw new Error(error.message)
}

export async function bulkSaveSongs(songs: Song[], owner: Owner): Promise<void> {
  const rows = songs.map((s) => toRow({ ...s, updatedAt: s.updatedAt || Date.now() }, owner))
  const { error } = await requireClient().from('songs').upsert(rows)
  if (error) throw new Error(error.message)
}

export async function deleteSong(id: string): Promise<void> {
  const { error } = await requireClient().from('songs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
