import { useState } from 'react'
import type { Song } from '../types'
import { loadSettings, hasApiKey } from '../ai/settings'
import { generateChart, DIFFICULTIES, type Difficulty } from '../ai/generate'

interface Props {
  onClose: () => void
  onGenerated: (song: Song) => void
  onOpenSettings: () => void
}

export function GenerateModal({ onClose, onGenerated, onOpenSettings }: Props) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('original')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const keyReady = hasApiKey()

  async function run() {
    if (!title.trim()) { setError('곡 제목을 입력하세요.'); return }
    setError('')
    setLoading(true)
    try {
      const song = await generateChart(title, artist, loadSettings(), difficulty)
      onGenerated(song)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal" onClick={loading ? undefined : onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong>✨ AI로 악보 만들기</strong>
          <button className="btn btn--icon btn--ghost" onClick={onClose} disabled={loading}>✕</button>
        </div>

        <div className="modal__body">
          {!keyReady && (
            <div className="notice">
              Gemini API 키가 필요합니다.
              <button className="btn btn--sm" onClick={onOpenSettings}>설정 열기</button>
            </div>
          )}
          <label className="field">
            <span>곡 제목</span>
            <input value={title} autoFocus placeholder="예: 밤편지"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && keyReady && !loading) run() }} />
          </label>
          <label className="field">
            <span>아티스트 (선택)</span>
            <input value={artist} placeholder="예: 아이유"
              onChange={(e) => setArtist(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && keyReady && !loading) run() }} />
          </label>

          <div className="field">
            <span>코드 난이도</span>
            <div className="seg">
              {DIFFICULTIES.map((d) => (
                <button key={d.value} type="button"
                  className={'seg__btn' + (difficulty === d.value ? ' is-on' : '')}
                  onClick={() => setDifficulty(d.value)}>{d.label}</button>
              ))}
            </div>
          </div>

          {loading && <div className="notice notice--busy">검색해서 악보 생성 중… (10~30초)</div>}
          {error && <div className="notice notice--error">{error}</div>}
          <p className="hint" style={{ padding: '2px 0 0' }}>
            생성 후 <b>편집기로 열립니다</b> — 코드가 틀린 부분은 마디에서 바로 고치세요.
          </p>
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose} disabled={loading}>취소</button>
          <button className="btn btn--primary" onClick={run} disabled={loading || !keyReady}>
            {loading ? '생성 중…' : '생성'}
          </button>
        </div>
      </div>
    </div>
  )
}
