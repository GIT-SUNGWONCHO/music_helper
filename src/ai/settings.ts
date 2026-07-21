// AI 생성 설정 — 브라우저 localStorage에만 저장(키는 본인 기기에만).
export type Provider = 'gemini'

export interface AiSettings {
  provider: Provider
  apiKey: string
  model: string
}

const STORAGE_KEY = 'mh.ai.settings.v1'

// 결제 미연결 무료 키 — 공개 배포 번들에 노출돼도 재발급으로 대응 가능한 수준의 위험만 짐.
// 설정에서 각자 자기 키를 입력하면 그 키가 우선 사용됨(아래 loadSettings 참고).
const SHARED_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? ''

export const DEFAULT_SETTINGS: AiSettings = {
  provider: 'gemini',
  apiKey: SHARED_API_KEY,
  // '-latest' 별칭: 신규 키는 구버전(2.5 등) 사용 불가라 별칭이 안전. 2.5는 기존 키에서만 동작.
  model: 'gemini-flash-latest',
}

/** 프로바이더별 추천 모델(설정에서 고르거나 직접 입력). */
export const MODEL_SUGGESTIONS: Record<Provider, string[]> = {
  gemini: ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'],
}

export function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const merged = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
    // 직접 입력한 키가 없으면 공유 기본 키로 대체(빈 문자열로 저장돼 있던 과거 설정 포함)
    if (!merged.apiKey.trim()) merged.apiKey = SHARED_API_KEY
    return merged
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function hasApiKey(): boolean {
  return loadSettings().apiKey.trim().length > 0
}
