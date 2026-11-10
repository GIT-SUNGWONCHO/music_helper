// 가사 조회 — LRCLIB(lrclib.net). 사용자들이 올리는 무료 공개 가사 DB로, 키가 필요 없고 브라우저에서 바로 부를 수 있다.
// AI가 가사를 기억이나 귀로 쓰면 그럴듯하게 지어내므로(실측), 여기서 찾은 가사를 정답으로 넘겨 마디에 나눠 붙이게만 한다.

export interface FoundLyrics {
  text: string
  /** 어떤 곡의 가사를 썼는지 사용자에게 보여 주기 위한 "가수 - 곡명" */
  source: string
}

interface LrcRow {
  trackName?: string
  artistName?: string
  plainLyrics?: string | null
}

const API = 'https://lrclib.net/api/search'
const TIMEOUT_MS = 8000

/** 비교용: 공백·문장부호·괄호를 빼고 소문자로. */
const norm = (t: string) => t.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')

/** DB의 곡명이 찾는 제목과 같은 곡인지. 0 = 아님, 숫자가 클수록 확실.
 *  DB 곡명은 "영어 제목 (한글 제목)"이나 "한글 제목 English Title"처럼 적힌 경우가 많다. */
function titleMatch(rowTitle: string, title: string): number {
  const want = norm(title)
  if (!want) return 0
  if (norm(rowTitle) === want) return 3
  // 괄호·대시로 나뉜 조각 중 하나가 제목과 같으면 같은 곡으로 본다.
  if (rowTitle.split(/[()[\]（）]|\s[-–—]\s/).some((seg) => norm(seg) === want)) return 2
  const full = norm(rowTitle)
  if (full.startsWith(want) || full.endsWith(want)) return 1
  return 0
}

async function searchOnce(params: Record<string, string>, signal?: AbortSignal): Promise<LrcRow[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onCancel = () => controller.abort()
  signal?.addEventListener('abort', onCancel)
  try {
    const res = await fetch(`${API}?${new URLSearchParams(params)}`, { signal: controller.signal })
    if (!res.ok) throw new Error(`LRCLIB ${res.status}`)
    const rows = await res.json()
    return Array.isArray(rows) ? rows.filter((r: LrcRow) => (r.plainLyrics ?? '').trim()) : []
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onCancel)
  }
}

/** 가끔 응답이 늦거나, 요청이 몰리면 429로 거절돼서(실측) 잠깐 쉬고 한 번은 다시 시도한다. 사용자가 생성을 멈춘 경우는 제외. */
async function search(params: Record<string, string>, signal?: AbortSignal): Promise<LrcRow[]> {
  try {
    return await searchOnce(params, signal)
  } catch (e) {
    if (signal?.aborted) throw e
    console.warn('[MusicHelper] 가사 DB 조회 실패 — 재시도:', (e as Error).message)
    await new Promise((r) => setTimeout(r, 1500))
    return searchOnce(params, signal)
  }
}

const found = (r: LrcRow): FoundLyrics => ({
  text: (r.plainLyrics ?? '').trim(),
  source: `${r.artistName ?? ''} - ${r.trackName ?? ''}`.trim(),
})

/** 제목+가수로 가사를 찾는다. 못 찾거나 확실하지 않거나 조회에 실패하면 null(가사 없이 생성하게 둔다). */
export async function fetchLyrics(title: string, artist: string, signal?: AbortSignal): Promise<FoundLyrics | null> {
  // 앱에서 버전 표시로 붙이는 "(남키)" 같은 괄호는 곡명이 아니므로 뺀다.
  const t = title.replace(/\([^)]*\)/g, ' ').trim()
  if (!t) return null
  try {
    // 1) 제목+가수로 찾기 — 가수까지 맞은 결과라 제목이 앞뒤로만 맞아도 받아들인다.
    const byArtist = (await search({ track_name: t, artist_name: artist }, signal))
      .map((r) => ({ r, m: titleMatch(r.trackName ?? '', t) }))
      .filter((x) => x.m > 0)
      .sort((a, b) => b.m - a.m)
    if (byArtist.length) return found(byArtist[0].r)

    // 2) 제목만으로 찾기 — DB에는 가수가 영어 이름이나 원곡 가수로 올라간 경우가 많다(커버곡 등).
    //    제목이 같은 다른 노래의 가사를 넣으면 안 되므로, 제목이 정확히 맞고 그 결과들의 가사가
    //    모두 같은 노래일 때(첫 소절이 같을 때)만 쓴다.
    const byTitle = (await search({ track_name: t }, signal)).filter((r) => titleMatch(r.trackName ?? '', t) >= 2)
    if (!byTitle.length) return null
    const openings = new Set(byTitle.map((r) => norm(r.plainLyrics ?? '').slice(0, 12)))
    return openings.size === 1 ? found(byTitle[0]) : null
  } catch (e) {
    console.warn('[MusicHelper] 가사 DB 조회 실패 — 가사 없이 진행:', (e as Error).message)
    return null // 가사 DB가 느리거나 꺼져 있어도 생성은 계속한다
  }
}
