import { useState } from 'react'
import type { Owner } from '../supabase'
import { CHORD_COLOR_PRESETS, loadChordColor, saveChordColor, applyChordColor } from '../chordColor'

interface Props {
  owner: Owner
  onClose: () => void
}

/** 설정(PIN)과 분리된, 성원/민형 누구나 바로 여는 코드 색 선택 — owner별로 따로 저장됨. */
export function ChordColorModal({ owner, onClose }: Props) {
  const [color, setColor] = useState(() => loadChordColor(owner))

  function pick(hex: string) {
    setColor(hex)
    saveChordColor(owner, hex)
    applyChordColor(hex)
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong>코드 색</strong>
          <button className="btn btn--icon btn--ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <div className="chord-color-grid">
            {CHORD_COLOR_PRESETS.map((p) => (
              <button key={p.value} type="button" className={'chord-color-swatch' + (color === p.value ? ' is-on' : '')}
                title={p.label} style={{ background: p.value }} onClick={() => pick(p.value)}>
                {color === p.value && <span className="chord-color-swatch__check">✓</span>}
              </button>
            ))}
          </div>
          <label className="field">
            <span>직접 고르기</span>
            <input type="color" className="chord-color-picker" value={color}
              onChange={(e) => pick(e.target.value)} />
          </label>

          <div className="chord-color-preview">
            <div className="chord-color-preview__label">예시</div>
            <div className="chord-color-preview__row"><span className="bar__chord" style={{ color }}>F</span></div>
            <div className="bar__lyric">얼어붙은 마음에</div>
            <div className="chord-color-preview__row"><span className="bar__chord" style={{ color }}>G</span></div>
            <div className="bar__lyric">누가 입맞춰줄까요</div>
          </div>

          <p className="hint" style={{ padding: '4px 0 0' }}>여기서 고른 색은 코드명 색에만 적용되고, 이 기기의 이 계정({owner === 'sungwon' ? '성원' : '민형'})에만 저장됩니다.</p>
        </div>
      </div>
    </div>
  )
}
