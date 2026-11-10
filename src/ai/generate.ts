import type { Song } from '../types'
import { newSong, newSection, newBar } from '../db'
import { NOTE_NAMES, pitchClass } from '../music/chords'
import type { AiSettings } from './settings'
import { recordUsage, type GenType } from './usage'
import { fetchLyrics, type FoundLyrics } from './lyrics'

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

function buildPrompt(title: string, artist: string, difficulty: Difficulty, tool: GeminiTool, refUrl?: string, userNote?: string, lyrics?: string): string {
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
  } else if (tool === 'video') {
    // 실측: 귀로 듣고 코드를 따게 하면 키부터 틀린 악보를 자신 있게 지어낸다(같은 곡 2회 모두).
    // 화면에 보이는 코드만 읽게 하고, 없으면 거절하게 한다.
    source = `A YouTube video for this song is attached. It is the GROUND TRUTH — base the entire chart on it (then apply the arrangement rule).
- Use ONLY chords that are VISIBLY SHOWN in the video frames: chord names, chord diagrams, tab, sheet music, or a lesson naming the chords. Read them from the screen and keep the key the video is played in.
- Do NOT work out chords by listening to the audio. If the video shows no chords on screen (e.g. a music video, a lyrics video, an audio-only upload, a live clip), output ONLY: {"unknown": true, "reason": "이 영상에는 코드가 화면에 나오지 않습니다."}.
${lyrics ? '' : `- Take lyrics from what is sung or shown in the video. If the video has no vocals and shows no lyrics, leave every "lyric" as "" instead of writing lyrics from memory.
`}If the video cannot be accessed or is not this song, output ONLY: {"unknown": true, "reason": "<one Korean sentence why>"}.`
  } else if (tool === 'none') {
    // 검색 도구 없이 호출하는 모드. "검색하라"고 시키면 최신 모델이 없는 도구를 부르려다
    // 깨진 호출(MALFORMED_FUNCTION_CALL)만 내놓고 빈 응답으로 끝난다(실측) — 도구가 없다고 분명히 알린다.
    source = `You have NO web search or browsing tools in this request — do not try to call any tool or function.
Write the chart from your own knowledge of ${who}. Aim for the detailed, accurate version (keep sus4, sus2, maj7 and passing chords), not a simplified beginner chart.`
  } else {
    source = `Use web search if available to find the ACCURATE lyrics and chords for ${who}.
- Search multiple sources (guitar tab sites, chord sites) and pick the most detailed and accurate version — NOT the most simplified beginner version. Simplified charts often drop sus4, sus2, maj7 and passing chords that define the song.
- For Korean songs, prefer Korean chord sites (예: 코드팝, 기타코드, melon chord).`
  }

  return `You are a guitar chord-chart transcriber. Output a measure-based (마디 단위) chord chart for the song ${who}.

${source}
${lyrics ? `
OFFICIAL LYRICS — the correct words of this song, from a lyrics database. They are the GROUND TRUTH for every "lyric" field:
- Use these words EXACTLY, in this order. Do not change, add, paraphrase or "correct" any word, and do not write lyrics from memory or from listening.
- Only split them into fragments and place each fragment under the bar where it is sung. Repeat a passage only where the song actually repeats it.
<lyrics>
${lyrics}
</lyrics>
` : ''}
ACCURACY RULES — top priority, NEVER invent:
- Do NOT invent or guess the key, chords, tempo, or lyrics. A plausible-but-wrong chart is WORSE than admitting you don't know.
- If you do not reliably know this exact song and have no readable reference, output ONLY: {"unknown": true, "reason": "<one Korean sentence why>"}.
- In the chart JSON, also report:
  - "confidence": "high" (I know this exact recording/chart well) or "medium" (I know the song but some details may differ).
  - "basis": one short Korean sentence — what this chart is based on (참고 링크 / 웹 검색 결과 / 학습 지식 등 구체적으로).
- If your honest confidence is lower than "medium", output the unknown JSON above instead of a chart.
${userNote ? `\nUSER REQUEST — follow this as long as it doesn't conflict with the accuracy rules above: ${userNote}\n` : ''}
Rules:
- ${DIFFICULTY_RULE[difficulty]}
- Write chords the way a guitarist actually plays them (e.g. C, Am7, G/B, FM7, Dsus4). Do NOT use a capo — write the sounding chords in a comfortable key.
- REPEAT/NAVIGATION MARKS: sources (especially scanned sheet music images) often encode repeats instead of writing every bar out — repeat barlines (|: … :|), numbered 1st/2nd (or 1st/2nd/3rd) endings (volta brackets), D.C. (Da Capo = go back to the start), D.S. (Dal Segno = go back to the 𝄋 segno sign), "To Coda"/Coda jumps, and Fine (end here). You MUST mentally play through these jumps and output the chart as the FULLY UNROLLED final sequence of bars in actual performance order — never a literal top-to-bottom copy of the printed page. Concretely: a repeated section becomes two (or more) separate consecutive sections/bar-runs in the output (e.g. a 1st verse that repeats with a different 2nd ending produces "Verse 1" ending in the 1st-ending bars, then "Verse 2" ending in the 2nd-ending bars instead); a D.C./D.S. jump means the bars from that point are re-emitted again later in the output at the point they're actually played, up to the Fine/Coda. Do not add navigation instructions as text in a lyric/chord field — always resolve them into real, ordered bars.
- Split the song into sections (Intro, Verse, Pre-Chorus, Chorus, Bridge, Interlude, Outro …).
- Each section is a list of bars (measures). Each bar has:
  - "chords": array of chord strings played in that bar (usually 1, sometimes 2; empty [] if the chord just holds).
  - "lyric": the lyric fragment sung during that bar ("" for instrumental bars).
- Keep lyrics segmented so each fragment lines up under the bar where it is sung.
- "originalKey": the key the chords are written in, one of C C# D Eb E F F# G Ab A Bb B.
- "tempo": BPM integer ONLY if you are confident of the real tempo. If unsure, OMIT the field entirely — never guess a BPM.

Output ONLY a single JSON object, no markdown, no commentary, in exactly this shape:
{
  "title": "...",
  "artist": "...",
  "originalKey": "C",
  "tempo": 92,
  "confidence": "high",
  "basis": "무엇을 근거로 만들었는지 한 문장",
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
type GeminiTool = 'search' | 'url' | 'video' | 'image' | 'none'
export interface RefImage { mimeType: string; data: string } // data: base64, no data: prefix
interface CallResult { text: string; inputTokens: number; outputTokens: number; totalTokens: number; searchUsed: boolean; refUsed: boolean; videoUsed: boolean; imageUsed: boolean; modelUsed: string }

/** 모델 하나가 응답을 안 줄 때 다음 모델로 넘어가기까지 기다리는 상한.
 *  실측: 정상 모델로 링크 모드 한 곡(108마디)이 76초 — 이미지 여러 장이면 더 걸리므로 넉넉히 잡음. */
const REQUEST_TIMEOUT_MS = 150_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 설정한 모델이 붐비거나(503) 무료 한도를 넘었거나(429) 없거나(404) 응답이 안 올 때 대신 시도할 모델.
 *  무료 한도는 모델마다 따로라 429에도 효과가 있다. 이 키로 못 쓰는 모델(404/403)은 건너뛴다.
 *  2.5 계열은 "신규 사용자 사용 불가"(404)라 넣지 않음. lite는 빠르지만 정확도가 낮아 마지막. */
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest']

/** 사용자에게 그대로 보여줄 오류. kind로 generateChart가 "검색 없이 재시도"할지 판단한다 —
 *  모델 붐빔·네트워크·키 문제는 다시 해도 같으므로 재시도하지 않는다. */
export class GeminiError extends Error {
  constructor(message: string, readonly kind: 'busy' | 'quota' | 'network' | 'auth' | 'cancelled' | 'other') {
    super(message)
    this.name = 'GeminiError'
  }
}

/** fetch가 응답조차 못 받았을 때 원인을 좁혀 준다.
 *  생성은 POST + Content-Type이라 브라우저가 preflight(OPTIONS)를 먼저 보내지만,
 *  모델 목록은 헤더 없는 GET이라 preflight가 없다. 둘의 성패를 비교하면
 *  "요청이 막힌 것"인지 "키가 죽은 것"인지 "구글 자체에 못 닿는 것"인지 갈린다. */
async function diagnoseFetchFailure(apiKey: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`,
    )
  } catch {
    return 'Google 서버에 연결되지 않아요. 콘텐츠 차단기·VPN·비공개 릴레이를 끄거나, Wi-Fi ↔ 셀룰러를 바꿔서 다시 시도해 주세요.'
  }
  if (res.ok) {
    return 'Google 서버에는 연결되는데 생성 요청만 막히고 있어요. 광고/콘텐츠 차단기나 방화벽을 꺼 보세요.'
  }
  const t = await res.text().catch(() => '')
  if (res.status === 400 && /API key not valid/i.test(t)) {
    return 'API 키가 더 이상 유효하지 않아요. 설정 > 관리자에서 새 키로 바꿔 주세요.'
  }
  return `Google 서버 응답이 이상해요(오류 코드 ${res.status}). 잠시 뒤 다시 시도해 주세요.`
}

/** 대체 모델까지 다 실패했을 때, 마지막 응답 코드에 맞는 안내. */
function exhaustedMessage(lastStatus: number): string {
  if (lastStatus === 0) return 'AI가 너무 오래 응답하지 않아 중단했어요. 잠시 뒤에 다시 시도해 주세요.'
  if (lastStatus === 429) return 'AI 무료 사용량 한도를 다 썼어요. 잠시 뒤(길면 내일) 다시 시도해 주세요.'
  if (lastStatus === 404) return '설정된 AI 모델을 찾을 수 없어요. 설정 > 관리자에서 \'모델 불러오기\'로 다른 모델을 골라 주세요.'
  return '지금 AI 모델이 붐벼서 생성하지 못했어요. 1~2분 뒤에 다시 시도해 주세요.'
}

async function callGemini(
  title: string,
  artist: string,
  s: AiSettings,
  tool: GeminiTool,
  difficulty: Difficulty,
  refUrl?: string,
  images?: RefImage[],
  userNote?: string,
  signal?: AbortSignal,
  lyrics?: string,
): Promise<CallResult> {
  const reqParts: Record<string, unknown>[] = [{ text: buildPrompt(title, artist, difficulty, tool, refUrl, userNote, lyrics) }]
  // 유튜브 영상은 주소를 그대로 넘기면 Gemini가 영상을 프레임(약 1초에 1장)과 소리로 읽는다.
  if (tool === 'video' && refUrl) reqParts.unshift({ file_data: { file_uri: refUrl } })
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
  // 생각 단계 줄이기: 링크·이미지는 정답이 주어져 옮겨 적는 일이라 길게 생각할 필요가 없다.
  // 실측(같은 링크·같은 곡): 기본값은 생각 토큰 6천~9천 개를 쓰느라 35초, 'low'는 10초, 원본 코드 일치율은 같음.
  // 이미지는 도돌이표를 풀어 써야 해서 한 단계 높게 둔다. 제목만 넣는 모드는 기억에 의존하므로 기본값 그대로.
  const thinkingLevel = tool === 'url' || tool === 'video' ? 'low' : tool === 'image' ? 'medium' : undefined
  const bodyWithThinking = thinkingLevel
    ? { ...body, generationConfig: { temperature: 0, thinkingConfig: { thinkingLevel } } }
    : body

  // 같은 모델로 일시적 실패(5xx·네트워크)를 몇 번 재시도하고, 붐빔/한도/없는 모델이면 다음 모델로 넘어간다.
  const models = [s.model, ...FALLBACK_MODELS.filter((m) => m !== s.model)]
  let res: Response | undefined
  let modelUsed = s.model
  let lastStatus = 0
  modelLoop: for (const model of models) {
    const isFallback = model !== s.model
    const maxAttempts = isFallback ? 2 : 3
    let useThinking = !!thinkingLevel // 이 설정을 모르는 모델이면 아래에서 빼고 다시 보낸다
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(s.apiKey)}`
    for (let attempt = 1; ; attempt++) {
      if (signal?.aborted) throw new GeminiError('생성을 취소했어요.', 'cancelled')
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      const onCancel = () => controller.abort()
      signal?.addEventListener('abort', onCancel)
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(useThinking ? bodyWithThinking : body),
          signal: controller.signal,
        })
        clearTimeout(timer)
        signal?.removeEventListener('abort', onCancel)
      } catch (e) {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onCancel)
        if (signal?.aborted) throw new GeminiError('생성을 취소했어요.', 'cancelled')
        if ((e as Error).name === 'AbortError') {
          // 응답이 아예 안 오는 건 그 모델 문제(실측: 일부 최신 모델이 503도 없이 매달림) —
          // 같은 모델을 다시 기다리면 시간만 배로 드니 바로 다음 모델로 넘어간다.
          console.warn(`[MusicHelper] ${model} ${REQUEST_TIMEOUT_MS / 1000}초 무응답 — 다음 모델로`)
          lastStatus = 0
          continue modelLoop
        }
        if (attempt < maxAttempts) {
          await sleep(attempt * 2000) // 2초, 4초
          continue
        }
        console.warn('[MusicHelper] Gemini 요청 실패:', model, e)
        // 연결 문제는 모델을 바꿔도 같으므로 바로 알린다.
        throw new GeminiError(`인터넷 연결 문제로 AI에 요청을 보내지 못했어요. ${await diagnoseFetchFailure(s.apiKey)}`, 'network')
      }
      if (res.ok) {
        modelUsed = model
        break modelLoop
      }
      lastStatus = res.status
      const t = (await res.text().catch(() => '')).replace(/\s+/g, ' ').trim()
      console.warn(`[MusicHelper] Gemini ${res.status} (${model}, ${tool}):`, t.slice(0, 300))
      if (res.status === 400 && useThinking && /thinking/i.test(t)) {
        useThinking = false // 생각 단계 설정을 지원하지 않는 모델(직접 입력한 구형 모델 등)
        continue
      }
      const transient = res.status >= 500
      if (transient && attempt < maxAttempts) {
        await sleep(attempt * 2000)
        continue
      }
      // 붐빔·한도·없는 모델 → 다음 모델. 대체 모델을 이 키로 못 쓰는 경우(403)도 건너뛴다.
      if (transient || res.status === 429 || res.status === 404 || (isFallback && res.status === 403)) {
        continue modelLoop
      }
      if (res.status === 400 && /API key not valid/i.test(t)) {
        throw new GeminiError('API 키가 올바르지 않아요. 설정 > 관리자에서 키를 확인해 주세요.', 'auth')
      }
      if (res.status === 403) {
        throw new GeminiError('API 키에 권한이 없어요. 설정 > 관리자에서 키를 확인해 주세요.', 'auth')
      }
      // 없는 영상·비공개·연령 제한 영상은 400(invalid argument)으로 온다(실측) — 다시 해도 같으므로 주소를 확인하게 한다.
      if (tool === 'video' && res.status === 400) {
        throw new GeminiError('유튜브 영상을 열지 못했어요. 주소가 맞는지, 비공개나 연령 제한 영상이 아닌지 확인해 주세요.', 'other')
      }
      const what = tool === 'url' ? '링크를 읽는 중에' : tool === 'video' ? '유튜브 영상을 보는 중에' : tool === 'image' ? '이미지를 읽는 중에' : ''
      throw new GeminiError(`AI가 ${what ? what + ' ' : ''}요청을 처리하지 못했어요(오류 코드 ${res.status}). 다시 시도해 주세요.`, 'other')
    }
  }
  if (!res || !res.ok) throw new GeminiError(exhaustedMessage(lastStatus), lastStatus === 429 ? 'quota' : 'busy')
  if (modelUsed !== s.model) console.warn(`[MusicHelper] ${s.model} 대신 ${modelUsed}로 생성`)
  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts
  const text = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? '').join('') : ''
  if (!text.trim()) {
    const finish = String(data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason ?? '')
    console.warn(`[MusicHelper] ${modelUsed}/${tool} 빈 응답, finishReason=${finish}`)
    if (/RECITATION|SAFETY|PROHIBITED|BLOCKLIST|SPII/.test(finish)) {
      throw new GeminiError('AI가 저작권·안전 정책 때문에 이 곡을 쓰지 않았어요. 참고 링크나 악보 이미지를 넣으면 만들 수 있어요.', 'other')
    }
    if (finish === 'MAX_TOKENS') {
      throw new GeminiError('곡이 너무 길어서 AI가 끝까지 쓰지 못했어요. 다시 시도해 주세요.', 'other')
    }
    throw new GeminiError('AI가 빈 답을 보냈어요. 다시 시도해 주세요.', 'other')
  }

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
  return { text, inputTokens, outputTokens, totalTokens, searchUsed: actualSearchUsed, refUsed, videoUsed: tool === 'video', imageUsed: tool === 'image', modelUsed }
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
  /** 유튜브 영상 화면의 코드를 읽어서 만든 경우 */
  videoUsed: boolean
  imageUsed: boolean
  /** 가사 DB에서 가져온 가사를 썼으면 그 곡("가수 - 곡명"). 없으면 가사는 AI가 쓴 것 */
  lyricsSource?: string
  confidence?: Confidence
  basis?: string
  /** 설정한 모델이 붐벼서 대신 쓴 모델(대체가 없었으면 undefined) */
  fallbackModel?: string
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

/** 유튜브 영상 주소면 표준 주소(https://www.youtube.com/watch?v=ID)로 바꿔 돌려주고, 아니면 null.
 *  watch?v= · youtu.be/ · shorts/ · live/ · embed/ 형태를 받는다. */
export function youtubeWatchUrl(url: string): string | null {
  const t = url.trim()
  if (!t) return null
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null
  else if (host === 'youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v')
    else id = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/)?.[1] ?? null
  }
  return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null
}

/** 제목(+아티스트)으로 악보를 생성해 Song(마디 모델)로 반환.
 *  정답 우선순위: 이미지 > 링크(유튜브 영상 포함) > 웹 검색 > 학습 지식. */
export async function generateChart(
  title: string,
  artist: string,
  settings: AiSettings,
  difficulty: Difficulty = 'original',
  refUrl?: string,
  refImages?: RefImage[],
  userNote?: string,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  if (!settings.apiKey.trim()) throw new Error('먼저 설정에서 Gemini API 키를 입력하세요.')
  if (settings.provider !== 'gemini') throw new Error('현재는 Gemini만 지원합니다.')

  const t = title.trim()
  const a = artist.trim()
  const ref = refUrl?.trim() || undefined
  const imgs = refImages && refImages.length > 0 ? refImages : undefined
  const note = userNote?.trim() || undefined
  let result: CallResult
  // 가사는 AI가 쓰게 두면 지어낸다(실측: 가사가 안 나오는 영상에서 엉뚱한 가사, 규칙으로는 못 막음).
  // 원본에 가사가 적혀 있는 이미지·악보 링크 말고는 가사 DB에서 찾아 정답으로 넘긴다.
  const yt = ref ? youtubeWatchUrl(ref) : null
  const dbLyrics: FoundLyrics | null = imgs || (ref && !yt) ? null : await fetchLyrics(t, a, signal)
  if (imgs) {
    // 참고 이미지 모드: 첨부 악보 이미지를 정답 기준으로 전사
    result = await callGemini(t, a, settings, 'image', difficulty, undefined, imgs, note, signal)
  } else if (yt) {
    // 유튜브 링크 모드: 영상 화면에 나오는 코드를 읽어 정답 기준으로 사용
    result = await callGemini(t, a, settings, 'video', difficulty, yt, undefined, note, signal, dbLyrics?.text)
  } else if (ref) {
    // 참고 링크 모드: url_context로 페이지를 읽어 정답 기준으로 사용
    result = await callGemini(t, a, settings, 'url', difficulty, ref, undefined, note, signal)
  } else {
    try {
      result = await callGemini(t, a, settings, 'search', difficulty, undefined, undefined, note, signal, dbLyrics?.text)
    } catch (e) {
      // 모델 붐빔·네트워크·키 문제·취소는 검색을 빼고 다시 해도 똑같으므로 바로 알린다.
      // 한도 초과(429)는 다시 해 본다 — 검색 기능은 생성과 한도가 따로라(실측: 검색만 429, 검색 없이는 정상)
      // 검색 한도만 찬 경우가 많다.
      if (e instanceof GeminiError && e.kind !== 'other' && e.kind !== 'quota') throw e
      console.warn('[MusicHelper] 검색(그라운딩) 호출 실패 — 검색 없이 재시도. 원인:', (e as Error).message)
      result = await callGemini(t, a, settings, 'none', difficulty, undefined, undefined, note, signal, dbLyrics?.text)
    }
  }
  // 과금 기준 출력 = 전체 - 입력 (thinking 토큰 포함)
  const genType: GenType = result.imageUsed ? 'image' : result.refUsed || result.videoUsed ? 'url' : result.searchUsed ? 'search' : 'knowledge'
  recordUsage(result.inputTokens, result.totalTokens - result.inputTokens, genType)

  let chart: GenChart
  try {
    chart = JSON.parse(extractJson(result.text))
  } catch {
    throw new Error('AI가 보낸 악보를 읽지 못했어요(형식이 깨져 있음). 다시 시도해 주세요.')
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
    videoUsed: result.videoUsed,
    imageUsed: result.imageUsed,
    lyricsSource: dbLyrics?.source,
    confidence: asConfidence(chart.confidence),
    basis: typeof chart.basis === 'string' ? chart.basis.trim() : undefined,
    fallbackModel: result.modelUsed !== settings.model ? result.modelUsed : undefined,
  }
}
