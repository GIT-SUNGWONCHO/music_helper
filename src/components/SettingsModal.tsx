import { useState } from 'react'
import { loadSettings, saveSettings, MODEL_SUGGESTIONS, type AiSettings } from '../ai/settings'
import { listGeminiModels } from '../ai/generate'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const [s, setS] = useState<AiSettings>(() => loadSettings())
  const [show, setShow] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelMsg, setModelMsg] = useState('')

  function save() {
    saveSettings({ ...s, apiKey: s.apiKey.trim(), model: s.model.trim() })
    onClose()
  }

  async function loadModels() {
    setModelMsg('')
    setLoadingModels(true)
    try {
      const list = await listGeminiModels(s.apiKey)
      setModels(list)
      if (list.length === 0) {
        setModelMsg('사용 가능한 모델이 없습니다.')
      } else {
        setModelMsg(`${list.length}개 모델을 불러왔습니다. 아래에서 선택하세요.`)
        if (!list.includes(s.model)) setS((v) => ({ ...v, model: list[0] }))
      }
    } catch (e) {
      setModelMsg((e as Error).message)
    } finally {
      setLoadingModels(false)
    }
  }

  const options = models.length ? models : MODEL_SUGGESTIONS[s.provider]

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong>AI 생성 설정</strong>
          <button className="btn btn--icon btn--ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal__body">
          <label className="field">
            <span>프로바이더</span>
            <select value={s.provider} onChange={(e) => setS({ ...s, provider: e.target.value as AiSettings['provider'] })}>
              <option value="gemini">Google Gemini</option>
            </select>
          </label>

          <label className="field">
            <span>API 키 (이 브라우저에만 저장됨)</span>
            <div className="input-row">
              <input type={show ? 'text' : 'password'} value={s.apiKey} placeholder="AIza..."
                onChange={(e) => setS({ ...s, apiKey: e.target.value })} />
              <button className="btn btn--ghost btn--sm" onClick={() => setShow((v) => !v)}>{show ? '숨김' : '표시'}</button>
            </div>
          </label>

          <div className="field">
            <span>모델</span>
            <div className="input-row">
              {models.length ? (
                <select value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })}>
                  {options.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input list="model-suggestions" value={s.model} placeholder="gemini-..."
                  onChange={(e) => setS({ ...s, model: e.target.value })} />
              )}
              <button className="btn btn--sm" onClick={loadModels} disabled={loadingModels || !s.apiKey.trim()}>
                {loadingModels ? '불러오는 중…' : '모델 불러오기'}
              </button>
            </div>
            <datalist id="model-suggestions">
              {MODEL_SUGGESTIONS[s.provider].map((m) => <option key={m} value={m} />)}
            </datalist>
            {modelMsg && <div className={'model-msg' + (/오류|않|없/.test(modelMsg) ? ' model-msg--err' : '')}>{modelMsg}</div>}
          </div>

          <p className="hint" style={{ padding: '4px 0 0' }}>
            키 발급: <code>aistudio.google.com/apikey</code>. 키를 넣고 <b>모델 불러오기</b>를 누르면 이 키로 실제 쓸 수 있는 모델만 골라줍니다.
          </p>
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>취소</button>
          <button className="btn btn--primary" onClick={save}>저장</button>
        </div>
      </div>
    </div>
  )
}
