import { useState } from 'react'
import { loadSettings, saveSettings, MODEL_SUGGESTIONS, type AiSettings } from '../ai/settings'
import { listGeminiModels } from '../ai/generate'
import { getUsage, estimateCostUsd, USD_TO_KRW, GEN_TYPE_LABEL, type GenType } from '../ai/usage'

interface Props {
  onClose: () => void
}

/** AI 사용량 요약 — 이 브라우저에서 성공한 생성만 집계(다른 사용자/기기는 각자 집계됨). */
function UsagePanel() {
  const u = getUsage()
  if (u.totalCount === 0) return null
  const totalTokens = u.totalInput + u.totalOutput
  const totalCost = estimateCostUsd(u.totalInput, u.totalOutput)
  const avgTokens = Math.round(totalTokens / u.totalCount)
  const avgCost = totalCost / u.totalCount
  const fmt = (usd: number) => `$${usd.toFixed(usd < 0.01 ? 4 : 2)} (₩${Math.round(usd * USD_TO_KRW).toLocaleString()})`
  return (
    <div className="usage-panel">
      <div className="usage-panel__title">AI 사용량 (이 브라우저 기준)</div>
      <table className="usage-table">
        <tbody>
          <tr><td>생성한 곡</td><td>{u.totalCount}곡 (이번 달 {u.monthCount}곡)</td></tr>
          <tr><td>무료 한도</td><td>하루 1,500회 (요청 횟수 기준)</td></tr>
          <tr><td>총 토큰</td><td>{totalTokens.toLocaleString()} (입력 {u.totalInput.toLocaleString()} / 출력·사고 {u.totalOutput.toLocaleString()})</td></tr>
          <tr><td>곡당 평균</td><td>{avgTokens.toLocaleString()} 토큰 · {fmt(avgCost)}</td></tr>
          <tr><td>유료 환산 누적</td><td>{fmt(totalCost)}</td></tr>
        </tbody>
      </table>

      <div className="usage-panel__title" style={{ marginTop: 14 }}>유형별 사용</div>
      <table className="usage-table">
        <tbody>
          {(Object.keys(GEN_TYPE_LABEL) as GenType[]).map((k) => {
            const st = u.byType[k]
            const tok = st.input + st.output
            return (
              <tr key={k}>
                <td>{GEN_TYPE_LABEL[k]}</td>
                <td>{st.count > 0
                  ? `${st.count}곡 · ${tok.toLocaleString()} 토큰 · 곡당 ${Math.round(tok / st.count).toLocaleString()}`
                  : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="hint" style={{ padding: '4px 0 0' }}>
        무료 한도는 <b>요청 횟수 기준(하루 1,500회)</b>이라 토큰 양은 거의 영향 없습니다. 유료 환산은 추정치이며 무료 키는 실제 청구 $0.
      </p>
    </div>
  )
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

          <UsagePanel />
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>취소</button>
          <button className="btn btn--primary" onClick={save}>저장</button>
        </div>
      </div>
    </div>
  )
}
