import type { Song } from '../types'
import { newSong, newSection, newBar } from '../db'
import { NOTE_NAMES, pitchClass } from '../music/chords'
import type { AiSettings } from './settings'
import { recordUsage } from './usage'

export type Difficulty = 'simple' | 'original' | 'rich'

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'simple', label: '간단하게' },
  { value: 'original', label: '원곡 그대로' },
  { value: 'rich', label: '풍성하게' },
]

// ---- shape the LLM is asked to return ----
interface GenBar { chords?: unknown; lyric?: unknown }
interface GenSection { label?: unknown; bars?: unknown }
interface GenChart {
  title?: unknown
  artist?: unknown
  originalKey?: unknown
  tempo?: unknown
  genreTags?: unknown
  moodTags?: unknown
  sections?: unknown
}

const DIFFICULTY_RULE: Record<Difficulty, string> = {
  simple:
    'Chord difficulty: SIMPLE. Use the easiest common chords (mostly basic major/minor, a few 7ths). Avoid embellishments, extensions and slash chords. Good for beginners.',
  original:
    'Chord difficulty: ORIGINAL. Reproduce the chords of the well-known/original arrangement as accurately as possible, INCLUDING the characteristic embellishments that define the song (sus2, sus4, add9, maj7, m7, slash chords like G/B, quick passing chords). Do NOT over-simplify — if the original moves G→Gsus4→G, write that.',
  rich:
    'Chord difficulty: RICH. Use a colorful, fuller voicing set an intermediate/advanced player would use (7ths, 9ths, maj7, sus, add9, slash and passing chords) while staying faithful to the harmony.',
}

function buildPrompt(title: string, artist: string, difficulty: Difficulty): string {
  const who = artist ? `"${title}" by ${artist}` : `"${title}"`
  return `You are a guitar chord-chart transcriber. Use web search to find the ACCURATE lyrics and chords for the song ${who}, then output a measure-based (마디 단위) chord chart.

Rules:
- Search the web for the real lyrics and a widely-used chord chart. Prefer Korean chord sites for Korean songs.
- ${DIFFICULTY_RULE[difficulty]}
- Write chords the way a guitarist actually plays them (e.g. C, Am7, G/B, FM7, Dsus4). Do NOT use a capo — write the sounding chords in a comfortable key.
- Split the song into sections (Intro, Verse, Pre-Chorus, Chorus, Bridge, Interlude, Outro …).
- Each section is a list of bars (measures). Each bar has:
  - "chords": array of chord strings played in that bar (usually 1, sometimes 2; empty [] if the chord just holds).
  - "lyric": the lyric fragment sung during that bar ("" for instrumental bars).
- Keep lyrics segmented so each fragment lines up under the bar where it is sung.
- "originalKey": the key the chords are written in, one of C C# D Eb E F F# G Ab A Bb B.
- "tempo": approximate BPM (integer) if known, else omit.
- "genreTags": 1-3 genre tags. "moodTags": 1-3 mood tags (Korean is fine, e.g. 잔잔, 신나는, 우울).

Output ONLY a single JSON object, no markdown, no commentary, in exactly this shape:
{
  "title": "...",
  "artist": "...",
  "originalKey": "C",
  "tempo": 92,
  "genreTags": ["..."],
  "moodTags": ["..."],
  "sections": [
    { "label": "Verse", "bars": [ { "chords": ["G"], "lyric": "가사 조각" }, { "chords": ["Gsus4","G"], "lyric": "" } ] }
  ]
}`
}

// ---- parse ----
function extractJson(text: string): string {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return t
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x).trim()).filter(Boolean)
}

function normalizeKey(v: unknown): string {
  const raw = typeof v === 'string' ? v.trim() : ''
  const pc = pitchClass(raw.replace(/m(aj)?.*$/i, '')) // drop any quality, keep root
  if (!Number.isNaN(pc)) return NOTE_NAMES[pc]
  return 'C'
}

function toSong(c: GenChart, fbTitle: string, fbArtist: string): Song {
  const rawSections = Array.isArray(c.sections) ? (c.sections as GenSection[]) : []
  const sections = rawSections
    .map((s) => {
      const bars = (Array.isArray(s.bars) ? (s.bars as GenBar[]) : [])
        .map((b) => newBar(asStringArray(b.chords), typeof b.lyric === 'string' ? b.lyric.trim() : ''))
      return { label: typeof s.label === 'string' && s.label.trim() ? s.label.trim() : 'Verse', bars }
    })
    .filter((s) => s.bars.length > 0)
    .map((s) => newSection(s.label, s.bars))

  const tempoNum = typeof c.tempo === 'number' ? c.tempo : Number(c.tempo)

  return newSong({
    title: (typeof c.title === 'string' && c.title.trim()) || fbTitle || '제목 없음',
    artist: (typeof c.artist === 'string' && c.artist.trim()) || fbArtist || '',
    originalKey: normalizeKey(c.originalKey),
    tempo: Number.isFinite(tempoNum) && tempoNum > 0 ? Math.round(tempoNum) : undefined,
    genreTags: asStringArray(c.genreTags),
    moodTags: asStringArray(c.moodTags),
    status: 'want',
    sections: sections.length ? sections : [newSection()],
  })
}

// ---- Gemini call ----
interface CallResult { text: string; inputTokens: number; outputTokens: number }

async function callGemini(
  title: string,
  artist: string,
  s: AiSettings,
  useSearch: boolean,
  difficulty: Difficulty,
): Promise<CallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    s.model,
  )}:generateContent?key=${encodeURIComponent(s.apiKey)}`
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: buildPrompt(title, artist, difficulty) }] }],
    generationConfig: { temperature: 0.3 },
  }
  if (useSearch) body.tools = [{ google_search: {} }]

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new Error('네트워크 오류: ' + (e as Error).message)
  }
  if (!res.ok) {
    const t = (await res.text().catch(() => '')).replace(/\s+/g, ' ').trim()
    if (res.status === 400 && /API key not valid/i.test(t)) throw new Error('API 키가 올바르지 않습니다.')
    throw new Error(`Gemini ${res.status}${useSearch ? ' (검색 사용)' : ''}: ${t.slice(0, 260)}`)
  }
  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts
  const text = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? '').join('') : ''
  if (!text.trim()) throw new Error('빈 응답을 받았습니다. 다시 시도해 주세요.')
  const meta = data?.usageMetadata ?? {}
  const inputTokens = Number(meta.promptTokenCount) || 0
  const outputTokens = Number(meta.candidatesTokenCount) || 0
  return { text, inputTokens, outputTokens }
}

/** 이 API 키로 generateContent가 가능한 Gemini 모델 이름 목록을 조회. */
export async function listGeminiModels(apiKey: string): Promise<string[]> {
  if (!apiKey.trim()) throw new Error('먼저 API 키를 입력하세요.')
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`
  let res: Response
  try {
    res = await fetch(url)
  } catch (e) {
    throw new Error('네트워크 오류: ' + (e as Error).message)
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    if (res.status === 400 && /API key not valid/i.test(t)) throw new Error('API 키가 올바르지 않습니다.')
    throw new Error(`모델 목록 오류 ${res.status}: ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  const models = Array.isArray(data?.models) ? data.models : []
  const names = models
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      (m.supportedGenerationMethods ?? []).includes('generateContent'),
    )
    .map((m: { name?: string }) => String(m.name ?? '').replace(/^models\//, ''))
    .filter((n: string) => /gemini/i.test(n) && !/embedding|aqa|vision-latest/i.test(n))
  // flash 계열을 위로 정렬(저렴/기본 추천)
  return names.sort((a: string, b: string) => {
    const score = (n: string) => (/flash/i.test(n) ? 0 : /pro/i.test(n) ? 1 : 2)
    return score(a) - score(b) || a.localeCompare(b)
  })
}

/** 제목(+아티스트)으로 악보를 생성해 Song(마디 모델)로 반환. */
export async function generateChart(
  title: string,
  artist: string,
  settings: AiSettings,
  difficulty: Difficulty = 'original',
): Promise<Song> {
  if (!settings.apiKey.trim()) throw new Error('먼저 설정에서 Gemini API 키를 입력하세요.')
  if (settings.provider !== 'gemini') throw new Error('현재는 Gemini만 지원합니다.')

  const t = title.trim()
  const a = artist.trim()
  // 그라운딩(웹검색)으로 먼저 시도 → 실패하면 검색 없이 모델 지식으로 재시도.
  let result: CallResult
  try {
    result = await callGemini(t, a, settings, true, difficulty)
  } catch {
    // 검색 조합이 막힌 경우가 많음 → 검색 없이 재시도. 이것도 실패하면 그 에러를 노출.
    result = await callGemini(t, a, settings, false, difficulty)
  }
  recordUsage(result.inputTokens, result.outputTokens)

  let chart: GenChart
  try {
    chart = JSON.parse(extractJson(result.text))
  } catch {
    throw new Error('생성 결과를 해석하지 못했습니다(JSON 파싱 실패). 다시 시도해 주세요.')
  }
  return toSong(chart, t, a)
}
