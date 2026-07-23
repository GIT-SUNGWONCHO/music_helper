import { UPDATE_LOG } from '../updates'

interface Props {
  onClose: () => void
}

/** 홈화면 배지에서 열리는 업데이트 노트 — 최신 버전이 맨 위. */
export function UpdateNotesModal({ onClose }: Props) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong>업데이트 노트</strong>
          <button className="btn btn--icon btn--ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal__body">
          <ul className="update-list">
            {UPDATE_LOG.map((entry) => (
              <li key={entry.version} className="update-entry">
                <div className="update-entry__head">
                  <span className="update-entry__version">v{entry.version}</span>
                  <span className="update-entry__date">{entry.date}</span>
                </div>
                <ul className="update-entry__notes">
                  {entry.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
