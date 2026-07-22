import { useState } from 'react'
import { NOTE_NAMES } from '../music/chords'
import { suffixesForRoot, displayChordName } from '../music/diagrams'
import { ChordDiagram } from './ChordDiagram'

interface Props {
  onClose: () => void
}

/** 설정에서만 들어갈 수 있는 전체 코드표 — 루트 음을 고르면 그 루트의 모든 코드 종류를
 *  운지도로 쭉 보여줌(참고용, 곡에 추가되지 않음). */
export function ChordLibraryModal({ onClose }: Props) {
  const [root, setRoot] = useState('C')
  const suffixes = suffixesForRoot(root)

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__card modal__card--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong>전체 코드표</strong>
          <button className="btn btn--icon btn--ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal__body">
          <div className="seg seg--wrap">
            {NOTE_NAMES.map((r) => (
              <button key={r} type="button"
                className={'seg__btn' + (root === r ? ' is-on' : '')}
                onClick={() => setRoot(r)}>{r}</button>
            ))}
          </div>

          <div className="chord-library-grid">
            {suffixes.map((suf) => (
              <ChordDiagram key={suf} chord={displayChordName(root, suf)} />
            ))}
          </div>
          <p className="hint" style={{ padding: '10px 0 0' }}>
            {suffixes.length}개 코드 · 여러 운지가 있는 코드는 대표 운지 하나만 표시됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}
