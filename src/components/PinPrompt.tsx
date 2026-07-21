import { useState } from 'react'

const PIN = '2958'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

/** 설정 화면 진입용 PIN 게이트. 실제 보안이 아니라 지인이 무심코 안 들어오게 막는 용도. */
export function PinPrompt({ onClose, onSuccess }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function submit() {
    if (value === PIN) onSuccess()
    else { setError(true); setValue('') }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 320 }}>
        <div className="modal__head">
          <strong>설정 잠금</strong>
          <button className="btn btn--icon btn--ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <label className="field">
            <span>PIN 입력</span>
            <input type="password" inputMode="numeric" autoFocus value={value}
              onChange={(e) => { setValue(e.target.value); setError(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
          </label>
          {error && <div className="notice notice--error">PIN이 올바르지 않습니다.</div>}
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>취소</button>
          <button className="btn btn--primary" onClick={submit}>확인</button>
        </div>
      </div>
    </div>
  )
}
