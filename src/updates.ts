// 업데이트 노트 — 새 기능 추가할 때마다 맨 위에 항목 추가 + package.json version도 같이 올릴 것.
export interface UpdateEntry {
  version: string
  date: string
  notes: string[]
}

export const UPDATE_LOG: UpdateEntry[] = [
  { version: '0.15.0', date: '2026-07-23', notes: ['섹션 맨 뒤 마디 추가 버튼 제거(마디별 삽입 기능으로 대체)'] },
  { version: '0.14.0', date: '2026-07-23', notes: ['다른 사람 악보 가져오기(읽기 전용 복사)', '정렬 옵션 오름차순/내림차순으로 확장', '뷰어 스크롤 버튼 스타일 조정'] },
  { version: '0.13.0', date: '2026-07-23', notes: ['코드 색 커스터마이징', '마디 중간에 끼워넣기 기능'] },
  { version: '0.12.0', date: '2026-07-23', notes: ['디자인 시스템 전면 정리'] },
  { version: '0.11.0', date: '2026-07-22', notes: ['셋리스트 기능 추가'] },
  { version: '0.10.0', date: '2026-07-22', notes: ['정렬 바텀시트화', '버튼 크기 통일', '제목/버전 분리', 'BPM 제목줄로 이동'] },
]

const SEEN_KEY = 'mh.updates.seen.v1'

export function currentVersion(): string {
  return UPDATE_LOG[0]?.version ?? '0.1.0'
}

export function hasUnseenUpdate(): boolean {
  return localStorage.getItem(SEEN_KEY) !== currentVersion()
}

export function markUpdatesSeen(): void {
  localStorage.setItem(SEEN_KEY, currentVersion())
}
