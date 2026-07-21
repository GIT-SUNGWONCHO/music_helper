// AI 생성 사용량 로컬 집계(브라우저). 정확한 무료 잔량은 API가 제공하지 않으므로 로컬 누적만 기록.

/** 생성에 쓴 정답 소스 유형. */
export type GenType = 'image' | 'url' | 'search' | 'knowledge'

export const GEN_TYPE_LABEL: Record<GenType, string> = {
  image: '이미지',
  url: '링크',
  search: '웹 검색',
  knowledge: '학습 지식',
}

interface TypeStat { count: number; input: number; output: number }

export interface AiUsage {
  totalCount: number
  totalInput: number
  totalOutput: number
  month: string // YYYY-MM
  monthCount: number
  monthInput: number
  monthOutput: number
  byType: Record<GenType, TypeStat>
}

const KEY = 'mh.ai.usage.v2'

// Gemini Flash 대략 요율(USD / 1M 토큰). 모델·시점에 따라 다르며 '유료 환산' 추정치.
export const PRICE_INPUT_PER_M = 0.3
export const PRICE_OUTPUT_PER_M = 2.5
export const USD_TO_KRW = 1400

function ym(): string {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
}

function emptyByType(): Record<GenType, TypeStat> {
  return {
    image: { count: 0, input: 0, output: 0 },
    url: { count: 0, input: 0, output: 0 },
    search: { count: 0, input: 0, output: 0 },
    knowledge: { count: 0, input: 0, output: 0 },
  }
}

export function getUsage(): AiUsage {
  const base: AiUsage = {
    totalCount: 0, totalInput: 0, totalOutput: 0,
    month: ym(), monthCount: 0, monthInput: 0, monthOutput: 0,
    byType: emptyByType(),
  }
  try {
    const u = { ...base, ...JSON.parse(localStorage.getItem(KEY) || '{}') } as AiUsage
    u.byType = { ...emptyByType(), ...(u.byType ?? {}) }
    if (u.month !== ym()) {
      u.month = ym()
      u.monthCount = 0
      u.monthInput = 0
      u.monthOutput = 0
    }
    return u
  } catch {
    return base
  }
}

export function recordUsage(inputTokens: number, outputTokens: number, type: GenType = 'knowledge'): void {
  const u = getUsage()
  u.totalCount += 1
  u.totalInput += inputTokens
  u.totalOutput += outputTokens
  u.monthCount += 1
  u.monthInput += inputTokens
  u.monthOutput += outputTokens
  const t = u.byType[type]
  t.count += 1
  t.input += inputTokens
  t.output += outputTokens
  try {
    localStorage.setItem(KEY, JSON.stringify(u))
  } catch {
    /* ignore quota errors */
  }
}

/** 유료 환산 예상 비용(USD). 무료 등급이면 실제 청구는 0. */
export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1e6) * PRICE_INPUT_PER_M + (outputTokens / 1e6) * PRICE_OUTPUT_PER_M
}
