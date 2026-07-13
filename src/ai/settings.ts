// AI 생성 설정 — 브라우저 localStorage에만 저장(키는 본인 기기에만).
export type Provider = 'gemini'

export interface AiSettings {
  provider: Provider
  apiKey: string
  model: string
}

const STORAGE_KEY = 'mh.ai.settings.v1'

export const DEFAULT_SETTINGS: AiSettings = {
  provider: 'gemini',
  apiKey: '',
  // '-latest' 별칭 → 항상 현재 flash. 특정 버전 종료(deprecation) 문제를 피함.
  model: 'gemini-flash-latest',
}

/** 프로바이더별 추천 모델(설정에서 고르거나 직접 입력). */
export const MODEL_SUGGESTIONS: Record<Provider, string[]> = {
  gemini: ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-pro'],
}

// 신규 사용자에게 종료된 모델 → 최신 별칭으로 자동 교체
const DEPRECATED_MODELS = new Set(['gemini-2.5-flash', 'gemini-2.5-flash-001'])

export function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const s: AiSettings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
    if (DEPRECATED_MODELS.has(s.model)) s.model = DEFAULT_SETTINGS.model
    return s
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
