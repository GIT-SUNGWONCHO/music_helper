import Dexie, { type Table } from 'dexie'
import type { Song, Section, Bar } from './types'

export class MusicHelperDb extends Dexie {
  songs!: Table<Song, string>

  constructor() {
    super('music-helper')
    // v1 (legacy, ChordPro text model)
    this.version(1).stores({
      songs: 'id, title, artist, originalKey, updatedAt, *tags',
    })
    // v2: measure-based model. Old-shape rows can't render — clear on upgrade so seeds refresh.
    this.version(2)
      .stores({ songs: 'id, title, artist, originalKey, updatedAt, *tags' })
      .upgrade((tx) => tx.table('songs').clear())
    // v3: split tags into mood/genre + add practice status. Migrate existing rows in place.
    this.version(3)
      .stores({ songs: 'id, title, artist, originalKey, updatedAt, status, *moodTags, *genreTags' })
      .upgrade((tx) =>
        tx.table('songs').toCollection().modify((s: Record<string, unknown>) => {
          s.moodTags = s.moodTags ?? []
          s.genreTags = s.genreTags ?? (Array.isArray(s.tags) ? s.tags : [])
          s.status = s.status ?? 'want'
          delete s.tags
        }),
      )
  }
}

export const db = new MusicHelperDb()

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

export async function saveSong(song: Song): Promise<void> {
  song.updatedAt = Date.now()
  await db.songs.put(song)
}

export async function deleteSong(id: string): Promise<void> {
  await db.songs.delete(id)
}

export async function allSongs(): Promise<Song[]> {
  return db.songs.orderBy('updatedAt').reverse().toArray()
}

export async function exportJson(): Promise<string> {
  const songs = await db.songs.toArray()
  return JSON.stringify({ app: 'music-helper', version: 2, songs }, null, 2)
}

export async function importJson(text: string): Promise<number> {
  const data = JSON.parse(text)
  const songs: Song[] = Array.isArray(data) ? data : data.songs
  if (!Array.isArray(songs)) throw new Error('올바른 백업 파일이 아닙니다.')
  await db.songs.bulkPut(songs)
  return songs.length
}
