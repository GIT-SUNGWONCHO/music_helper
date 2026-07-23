import { OWNERS, type Owner } from '../supabase'

interface Props {
  onChoose: (owner: Owner) => void
}

/** 이 기기에서 처음 열었을 때 한 번 — 성원/지인 중 누구인지 명확히 고르게 함.
 *  이걸 안 거치면 기본값(성원)으로 조용히 저장돼 지인 데이터가 성원 계정에 섞임. */
export function OwnerPicker({ onChoose }: Props) {
  return (
    <div className="loading" style={{ flexDirection: 'column', gap: 18 }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>
        이 기기는 누가 쓰나요?
      </div>
      <div className="hint" style={{ padding: 0, textAlign: 'center' }}>
        기기별로 한 번만 고르면 됩니다. 나중에 목록 화면 상단에서 언제든 바꿀 수 있어요.
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {OWNERS.map((o) => (
          <button key={o.value} className="btn btn--primary btn--lg"
            onClick={() => onChoose(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
