import type { Song, Section, Bar, SetList } from './types'
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
    version: undefined,
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

export function newSetList(name: string, songIds: string[] = []): SetList {
  const now = Date.now()
  return { id: uid(), name, songIds, createdAt: now, updatedAt: now }
}

// ---- Supabase row <-> Song mapping ----
interface SongRow {
  id: string
  owner: string
  title: string
  version: string | null
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

function toRow(song: Song): SongRow {
  return {
    id: song.id,
    owner: song.owner ?? 'sungwon',
    title: song.title,
    version: song.version ?? null,
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
    owner: row.owner as Owner,
    title: row.title,
    version: row.version ?? undefined,
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

/** 성원/민형 공유 라이브러리 — owner로 필터링하지 않고 전체를 반환(누가 만들었는지는 Song.owner로 표시만). */
export async function allSongs(): Promise<Song[]> {
  const { data, error } = await requireClient()
    .from('songs')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as SongRow[]).map(fromRow)
}

export async function countSongs(): Promise<number> {
  const { count, error } = await requireClient()
    .from('songs')
    .select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function saveSong(song: Song): Promise<void> {
  song.updatedAt = Date.now()
  const { error } = await requireClient().from('songs').upsert(toRow(song))
  if (error) throw new Error(error.message)
}

/** 최초 시드 전용 — songs에 owner가 없으면 기본값으로 채움. */
export async function bulkSaveSongs(songs: Song[], owner: Owner): Promise<void> {
  const rows = songs.map((s) => toRow({ ...s, owner: s.owner ?? owner, updatedAt: s.updatedAt || Date.now() }))
  const { error } = await requireClient().from('songs').upsert(rows)
  if (error) throw new Error(error.message)
}

export async function deleteSong(id: string): Promise<void> {
  const { error } = await requireClient().from('songs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---- Supabase row <-> SetList mapping ----
interface SetListRow {
  id: string
  owner: string
  name: string
  song_ids: string[] | null
  created_at: number
  updated_at: number
}

function setListToRow(setlist: SetList, owner: Owner): SetListRow {
  return {
    id: setlist.id,
    owner,
    name: setlist.name,
    song_ids: setlist.songIds,
    created_at: setlist.createdAt,
    updated_at: setlist.updatedAt,
  }
}

function setListFromRow(row: SetListRow): SetList {
  return {
    id: row.id,
    name: row.name,
    songIds: row.song_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function allSetLists(owner: Owner): Promise<SetList[]> {
  const { data, error } = await requireClient()
    .from('setlists')
    .select('*')
    .eq('owner', owner)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as SetListRow[]).map(setListFromRow)
}

export async function saveSetList(setlist: SetList, owner: Owner): Promise<void> {
  setlist.updatedAt = Date.now()
  const { error } = await requireClient().from('setlists').upsert(setListToRow(setlist, owner))
  if (error) throw new Error(error.message)
}

export async function deleteSetList(id: string): Promise<void> {
  const { error } = await requireClient().from('setlists').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
