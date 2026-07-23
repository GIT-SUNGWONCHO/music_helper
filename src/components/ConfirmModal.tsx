interface Props {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 브라우저 기본 confirm() 대신 쓰는 테마 확인창 — 삭제 등 되돌릴 수 없는 동작 전 확인. */
export function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }: Props) {
  return (
    <div className="modal" onClick={onCancel}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong>{title}</strong>
          <button className="btn btn--icon btn--ghost" onClick={onCancel}>✕</button>
        </div>
        <div className="modal__body">
          <p style={{ margin: 0 }}>{message}</p>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onCancel}>취소</button>
          <button className={'btn btn--primary' + (danger ? ' btn--danger' : '')} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
