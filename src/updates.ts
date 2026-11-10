// 업데이트 노트 — 새 기능 추가할 때마다 맨 위에 항목 추가 + package.json version도 같이 올릴 것.
export interface UpdateEntry {
  version: string
  date: string
  notes: string[]
}

export const UPDATE_LOG: UpdateEntry[] = [
  { version: '0.16.0', date: '2026-11-10', notes: ['AI 모델이 붐비거나 무료 한도를 넘으면 다른 모델로 자동 전환해서 생성', '오류 안내를 이해하기 쉬운 문장으로 변경(모델 붐빔·사용량 한도·연결 문제·키 문제 구분)', 'AI가 읽지 못하는 사이트(네이버 블로그 등) 링크는 넣는 즉시 안내하고 이미지 첨부를 권장', '생성이 실패하면 원인을 자동으로 진단해서 알려줌, 응답이 2분 넘게 없으면 자동 중단'] },
  { version: '0.15.0', date: '2026-07-23', notes: ['섹션 맨 뒤 마디 추가 버튼 제거(마디별 삽입 기능으로 대체)', '설정을 일반/관리자 탭으로 분리, 코드색 버튼을 설정 > 일반으로 이동', '코드 기본색을 코랄핑크로 변경', 'AI 생성 화면에 추가 요청사항(자유 프롬프트) 입력칸 추가, 참고 악보 섹션 제목/설명 위계 및 이미지·링크 라벨 정리', '코드 추가 패널을 운지 다이어그램 가로 스크롤로 변경, 흔히 쓰는 코드 종류(메이저/마이너/7th/sus 등)가 앞쪽에 오도록 정렬', '코드 추가 패널 루트 음 선택 줄이 화면 밖으로 넘쳐 전체 화면이 눌려 보이던 버그 수정', '코드표 표기를 maj → M으로 변경(예: Cmaj7 → CM7)', 'G/B 등 슬래시 코드의 전용 운지(더 쉬운 오픈 셰이프)를 못 찾던 버그 수정'] },
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
