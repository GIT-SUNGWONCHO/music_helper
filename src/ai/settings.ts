// AI 생성 설정 — 브라우저 localStorage에만 저장(키는 본인 기기에만).
export type Provider = 'gemini'

export interface AiSettings {
  provider: Provider
  apiKey: string
  model: string
  /** 저장 당시의 기본 모델 세대(DEFAULT_MODEL_REV). 기본 모델이 바뀌었을 때 옛 기본값을 새것으로 옮기는 데 쓴다. */
  modelRev?: number
}

const STORAGE_KEY = 'mh.ai.settings.v1'

// 결제 미연결 무료 키 — 공개 배포 번들에 노출돼도 재발급으로 대응 가능한 수준의 위험만 짐.
// 설정에서 각자 자기 키를 입력하면 그 키가 우선 사용됨(아래 loadSettings 참고).
const SHARED_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? ''

/** 기본 모델을 바꿀 때마다 올린다(아래 loadSettings의 옮김 처리 참고). */
const DEFAULT_MODEL_REV = 2

export const DEFAULT_SETTINGS: AiSettings = {
  provider: 'gemini',
  apiKey: SHARED_API_KEY,
  // 실측(같은 키·같은 링크, 생각 단계 'low'): 3-flash-preview 10초, 3.6-flash 70초 이상.
  // 3.6-flash는 무료 한도도 하루 20회뿐이라 금방 바닥난다. 이 모델이 안 되면 generate.ts의 대체 모델로 넘어감.
  model: 'gemini-3-flash-preview',
  modelRev: DEFAULT_MODEL_REV,
}

/** 예전 기본값들. 사용자가 고른 게 아니라 기본값이 저장된 경우라 새 기본값으로 바꿔 준다.
 *  (flash-latest 별칭은 응답 없이 매달려서, 3.6-flash는 느려서 기본값에서 뺐다.) */
const FORMER_DEFAULT_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash']

/** 프로바이더별 추천 모델(설정에서 고르거나 직접 입력). */
export const MODEL_SUGGESTIONS: Record<Provider, string[]> = {
  gemini: ['gemini-3-flash-preview', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest'],
}

export function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const stored = raw ? JSON.parse(raw) : {}
    const merged: AiSettings = { ...DEFAULT_SETTINGS, ...stored }
    // 직접 입력한 키가 없으면 공유 기본 키로 대체(빈 문자열로 저장돼 있던 과거 설정 포함)
    if (!merged.apiKey.trim()) merged.apiKey = SHARED_API_KEY
    // 기본 모델이 바뀌기 전에 저장된 설정이면 옛 기본값만 새 기본값으로 옮긴다.
    // 그 뒤에 설정에서 직접 고른 모델(옛 기본값과 같은 것 포함)은 건드리지 않는다.
    if ((stored.modelRev ?? 0) < DEFAULT_MODEL_REV) {
      if (FORMER_DEFAULT_MODELS.includes(merged.model)) merged.model = DEFAULT_SETTINGS.model
      merged.modelRev = DEFAULT_MODEL_REV
    }
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
