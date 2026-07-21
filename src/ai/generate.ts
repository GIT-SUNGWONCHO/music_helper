import type { Song } from '../types'
import { newSong, newSection, newBar } from '../db'
import { NOTE_NAMES, pitchClass } from '../music/chords'
import type { AiSettings } from './settings'
import { recordUsage, type GenType } from './usage'
import { GENRE_TAGS, MOOD_TAGS } from '../tags'

export type Difficulty = 'simple' | 'original' | 'rich'

export const DIFFICULTIES: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'simple', label: '쉽게', desc: '오픈 코드만 — 초보자용 편곡' },
  { value: 'original', label: '원곡', desc: '원곡 코드 그대로' },
  { value: 'rich', label: '풍성하게', desc: '원곡보다 화음 풍부하게' },
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
  unknown?: unknown
  reason?: unknown
  confidence?: unknown
  basis?: unknown
}

const DIFFICULTY_RULE: Record<Difficulty, string> = {
  simple:
    'Arrangement: SIMPLIFIED. Rewrite the chords so a beginner can play using only open-position chords (Am Em Dm C G D E A and basic 7ths). Replace all barre chords, sus, add, maj7, and slash chords with the nearest simple open chord.',

  original:
    `Arrangement: FAITHFUL TO ORIGINAL. Reproduce the exact chord progression from the original recording. The goal is accuracy — do NOT simplify.
IMPORTANT RULES for selecting chords when sources disagree:
- sus2 and sus4 are DISTINCT chords (they replace the 3rd), not optional decorations. A source writing "Dsus4" and one writing "D" are transcribing different chords. Always prefer the sus version.
- Slash chords (G/B, D/F#, Am/E) define the bass line and must be preserved.
- When sources disagree, prefer the harmonically richer/more detailed version. The simpler version is almost always the beginner-simplified one.
- Cross-check with your knowledge of the recording. If sources show a plain chord but the recording clearly uses a richer voicing, trust the recording.
SELF-CHECK before output: Did I write a plain major/minor where the original uses sus2/sus4/maj7/m7? Did I drop any slash chord? If so, restore them.`,

  rich:
    'Arrangement: ENRICHED. Start from the original chord progression and add tasteful color: maj7, add9, sus2, passing chords, richer voicings. Stay in the same key and feel — do NOT use jazz or extended chords (no 9th, 11th, 13th, b13, dim, aug).',
}

function buildPrompt(title: string, artist: string, difficulty: Difficulty, tool: GeminiTool, refUrl?: string): string {
  const who = artist ? `"${title}" by ${artist}` : `"${title}"`
  let source: string
  if (tool === 'image') {
    source = `Reference chord-sheet IMAGE(S) are attached. They are the GROUND TRUTH for key, chords, lyrics, and structure — read them DIRECTLY and base the entire chart on what is shown (then apply the arrangement rule).
Transcribe every chord and lyric fragment exactly as printed. Do NOT change the key or substitute chords.
If the image is unreadable or is not a chord sheet for this song, output ONLY: {"unknown": true, "reason": "<one Korean sentence why>"}.`
  } else if (tool === 'url') {
    source = `A reference chord-sheet URL is provided: ${refUrl}
Read it with the url_context tool. The reference is the GROUND TRUTH for key, chords, lyrics, and structure — base the entire chart on it (then apply the arrangement rule).
If the URL cannot be read, or it does not contain this song's chart, output ONLY: {"unknown": true, "reason": "<one Korean sentence why>"}.`
  } else {
    source = `Use web search if available to find the ACCURATE lyrics and chords for ${who}.
- Search multiple sources (guitar tab sites, chord sites) and pick the most detailed and accurate version — NOT the most simplified beginner version. Simplified charts often drop sus4, sus2, maj7 and passing chords that define the song.
- For Korean songs, prefer Korean chord sites (예: 코드팝, 기타코드, melon chord).`
  }

  return `You are a guitar chord-chart transcriber. Output a measure-based (마디 단위) chord chart for the song ${who}.

${source}

ACCURACY RULES — top priority, NEVER invent:
- Do NOT invent or guess the key, chords, tempo, or lyrics. A plausible-but-wrong chart is WORSE than admitting you don't know.
- If you do not reliably know this exact song and have no readable reference, output ONLY: {"unknown": true, "reason": "<one Korean sentence why>"}.
- In the chart JSON, also report:
  - "confidence": "high" (I know this exact recording/chart well) or "medium" (I know the song but some details may differ).
  - "basis": one short Korean sentence — what this chart is based on (참고 링크 / 웹 검색 결과 / 학습 지식 등 구체적으로).
- If your honest confidence is lower than "medium", output the unknown JSON above instead of a chart.

Rules:
- ${DIFFICULTY_RULE[difficulty]}
- Write chords the way a guitarist actually plays them (e.g. C, Am7, G/B, FM7, Dsus4). Do NOT use a capo — write the sounding chords in a comfortable key.
- Split the song into sections (Intro, Verse, Pre-Chorus, Chorus, Bridge, Interlude, Outro …).
- Each section is a list of bars (measures). Each bar has:
  - "chords": array of chord strings played in that bar (usually 1, sometimes 2; empty [] if the chord just holds).
  - "lyric": the lyric fragment sung during that bar ("" for instrumental bars).
- Keep lyrics segmented so each fragment lines up under the bar where it is sung.
- "originalKey": the key the chords are written in, one of C C# D Eb E F F# G Ab A Bb B.
- "tempo": BPM integer ONLY if you are confident of the real tempo. If unsure, OMIT the field entirely — never guess a BPM.
- "genreTags": 1-3 tags chosen ONLY from this list: ${GENRE_TAGS.join(', ')}.
- "moodTags": 1-3 tags chosen ONLY from this list: ${MOOD_TAGS.join(', ')}.

Output ONLY a single JSON object, no markdown, no commentary, in exactly this shape:
{
  "title": "...",
  "artist": "...",
  "originalKey": "C",
  "tempo": 92,
  "confidence": "high",
  "basis": "무엇을 근거로 만들었는지 한 문장",
  "genreTags": ["..."],
  "moodTags": ["..."],
  "sections": [
    { "label": "Verse", "bars": [
      { "chords": ["Dsus4"], "lyric": "가사 조각" },
      { "chords": ["D"],     "lyric": "" },
      { "chords": ["G/B"],   "lyric": "다음 가사" },
      { "chords": ["Am7"],   "lyric": "" }
    ]}
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
type GeminiTool = 'search' | 'url' | 'image' | 'none'
export interface RefImage { mimeType: string; data: string } // data: base64, no data: prefix
interface CallResult { text: string; inputTokens: number; outputTokens: number; totalTokens: number; searchUsed: boolean; refUsed: boolean; imageUsed: boolean }

async function callGemini(
  title: string,
  artist: string,
  s: AiSettings,
  tool: GeminiTool,
  difficulty: Difficulty,
  refUrl?: string,
  images?: RefImage[],
): Promise<CallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    s.model,
  )}:generateContent?key=${encodeURIComponent(s.apiKey)}`
  const reqParts: Record<string, unknown>[] = [{ text: buildPrompt(title, artist, difficulty, tool, refUrl) }]
  if (tool === 'image' && images) {
    for (const img of images) reqParts.push({ inline_data: { mime_type: img.mimeType, data: img.data } })
  }
  const body: Record<string, unknown> = {
    contents: [{ parts: reqParts }],
    // temperature 0: 악보 전사는 창의성이 아니라 정확도 문제. 0.3에서는 같은 곡도
    // 실행마다 sus4 등 디테일이 사라지는 편차가 확인됨(3회 중 2회 누락).
    generationConfig: { temperature: 0 },
  }
  if (tool === 'search') body.tools = [{ google_search: {} }]
  else if (tool === 'url') body.tools = [{ url_context: {} }]

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
    const toolLabel: Record<GeminiTool, string> = { search: '검색', url: '링크 읽기', image: '이미지 읽기', none: '' }
    throw new Error(`Gemini ${res.status}${toolLabel[tool] ? ` (${toolLabel[tool]} 사용)` : ''}: ${t.slice(0, 260)}`)
  }
  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts
  const text = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? '').join('') : ''
  if (!text.trim()) throw new Error('빈 응답을 받았습니다. 다시 시도해 주세요.')

  // 검색/링크 소스 로깅 (개발용 — 브라우저 콘솔에서 확인)
  const grounding = data?.candidates?.[0]?.groundingMetadata
  const actualSearchUsed = tool === 'search' && !!grounding
  if (grounding) {
    const queries: string[] = grounding.webSearchQueries ?? []
    const chunks: { web?: { uri?: string; title?: string } }[] = grounding.groundingChunks ?? []
    console.group('[MusicHelper] Gemini 검색 소스')
    console.log('검색어:', queries)
    chunks.forEach((c, i) => console.log(`[${i + 1}] ${c.web?.title ?? ''} — ${c.web?.uri ?? ''}`))
    console.groupEnd()
  }
  const urlMeta = data?.candidates?.[0]?.urlContextMetadata?.urlMetadata as
    | { retrievedUrl?: string; urlRetrievalStatus?: string }[]
    | undefined
  const refUsed = tool === 'url'
    && Array.isArray(urlMeta)
    && urlMeta.some((u) => u.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS')
  if (urlMeta) console.log('[MusicHelper] 참고 링크 읽기:', urlMeta)

  const meta = data?.usageMetadata ?? {}
  const inputTokens = Number(meta.promptTokenCount) || 0
  const outputTokens = Number(meta.candidatesTokenCount) || 0
  // totalTokenCount는 thinking 토큰까지 포함 — 유료 과금은 이 기준. 없으면 input+output로 대체.
  const totalTokens = Number(meta.totalTokenCount) || inputTokens + outputTokens
  return { text, inputTokens, outputTokens, totalTokens, searchUsed: actualSearchUsed, refUsed, imageUsed: tool === 'image' }
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

export type Confidence = 'high' | 'medium' | 'low'

export interface GenerateResult {
  song: Song
  searchUsed: boolean
  refUsed: boolean
  imageUsed: boolean
  confidence?: Confidence
  basis?: string
}

/** 모델이 곡을 몰라서 생성을 거부한 경우. */
export class UnknownSongError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'UnknownSongError'
  }
}

function asConfidence(v: unknown): Confidence | undefined {
  return v === 'high' || v === 'medium' || v === 'low' ? v : undefined
}

/** 제목(+아티스트)으로 악보를 생성해 Song(마디 모델)로 반환.
 *  정답 우선순위: 이미지 > 링크 > 웹 검색 > 학습 지식. */
export async function generateChart(
  title: string,
  artist: string,
  settings: AiSettings,
  difficulty: Difficulty = 'original',
  refUrl?: string,
  refImages?: RefImage[],
): Promise<GenerateResult> {
  if (!settings.apiKey.trim()) throw new Error('먼저 설정에서 Gemini API 키를 입력하세요.')
  if (settings.provider !== 'gemini') throw new Error('현재는 Gemini만 지원합니다.')

  const t = title.trim()
  const a = artist.trim()
  const ref = refUrl?.trim() || undefined
  const imgs = refImages && refImages.length > 0 ? refImages : undefined
  let result: CallResult
  if (imgs) {
    // 참고 이미지 모드: 첨부 악보 이미지를 정답 기준으로 전사
    result = await callGemini(t, a, settings, 'image', difficulty, undefined, imgs)
  } else if (ref) {
    // 참고 링크 모드: url_context로 페이지를 읽어 정답 기준으로 사용
    result = await callGemini(t, a, settings, 'url', difficulty, ref)
  } else {
    try {
      result = await callGemini(t, a, settings, 'search', difficulty)
    } catch (e) {
      console.warn('[MusicHelper] 검색(그라운딩) 호출 실패 — 검색 없이 재시도. 원인:', (e as Error).message)
      result = await callGemini(t, a, settings, 'none', difficulty)
    }
  }
  // 과금 기준 출력 = 전체 - 입력 (thinking 토큰 포함)
  const genType: GenType = result.imageUsed ? 'image' : result.refUsed ? 'url' : result.searchUsed ? 'search' : 'knowledge'
  recordUsage(result.inputTokens, result.totalTokens - result.inputTokens, genType)

  let chart: GenChart
  try {
    chart = JSON.parse(extractJson(result.text))
  } catch {
    throw new Error('생성 결과를 해석하지 못했습니다(JSON 파싱 실패). 다시 시도해 주세요.')
  }

  if (chart.unknown) {
    const reason = typeof chart.reason === 'string' && chart.reason.trim()
      ? chart.reason.trim()
      : '모델이 이 곡을 확실히 알지 못합니다.'
    throw new UnknownSongError(reason)
  }

  return {
    song: toSong(chart, t, a),
    searchUsed: result.searchUsed,
    refUsed: result.refUsed,
    imageUsed: result.imageUsed,
    confidence: asConfidence(chart.confidence),
    basis: typeof chart.basis === 'string' ? chart.basis.trim() : undefined,
  }
}
