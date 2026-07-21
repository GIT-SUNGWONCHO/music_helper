import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** 환경변수가 아직 설정 안 됐으면 앱이 안내 화면을 보여줄 수 있도록. */
export const supabaseReady = Boolean(url && anonKey)

export const supabase = supabaseReady ? createClient(url!, anonKey!) : null

export type Owner = 'sungwon' | 'friend'
export const OWNERS: { value: Owner; label: string }[] = [
  { value: 'sungwon', label: '성원' },
  { value: 'friend', label: '지인' },
]

const OWNER_KEY = 'mh.owner.v1'

/** 로그인 없이 기기별로 "누구 화면인지"만 로컬에 기억. 계정 아님 — 데이터 접근 권한과 무관. */
export function loadOwner(): Owner {
  const v = localStorage.getItem(OWNER_KEY)
  return v === 'friend' ? 'friend' : 'sungwon'
}

export function saveOwner(owner: Owner): void {
  localStorage.setItem(OWNER_KEY, owner)
}
