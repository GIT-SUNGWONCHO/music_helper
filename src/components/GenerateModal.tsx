import { useState } from 'react'
import { loadSettings, hasApiKey } from '../ai/settings'
import { generateChart, UnknownSongError, DIFFICULTIES, type Difficulty, type GenerateResult, type RefImage } from '../ai/generate'

interface Props {
  onClose: () => void
  onGenerated: (result: GenerateResult) => void
  onOpenSettings: () => void
}

interface PickedImage extends RefImage {
  name: string
  url: string // object URL for thumbnail
}

const MAX_IMAGES = 4

function fileToImage(file: File): Promise<PickedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve({
        mimeType: file.type || 'image/jpeg',
        data: result.slice(comma + 1),
        name: file.name,
        url: URL.createObjectURL(file),
      })
    }
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'))
    reader.readAsDataURL(file)
  })
}

export function GenerateModal({ onClose, onGenerated, onOpenSettings }: Props) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [refUrl, setRefUrl] = useState('')
  const [images, setImages] = useState<PickedImage[]>([])
  const [difficulty, setDifficulty] = useState<Difficulty>('original')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unknownReason, setUnknownReason] = useState('')
  const keyReady = hasApiKey()

  async function addFiles(files: FileList | null) {
    if (!files) return
    const picked: PickedImage[] = []
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      if (images.length + picked.length >= MAX_IMAGES) break
      picked.push(await fileToImage(f))
    }
    setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES))
  }
  function removeImage(i: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[i].url)
      return prev.filter((_, j) => j !== i)
    })
  }

  async function run() {
    if (!title.trim()) { setError('곡 제목을 입력하세요.'); return }
    if (!artist.trim()) { setError('아티스트를 입력하세요.'); return }
    setError('')
    setUnknownReason('')
    setLoading(true)
    try {
      const refImages: RefImage[] = images.map((i) => ({ mimeType: i.mimeType, data: i.data }))
      const result = await generateChart(title, artist, loadSettings(), difficulty, refUrl, refImages)
      onGenerated(result)
    } catch (e) {
      if (e instanceof UnknownSongError) setUnknownReason(e.message)
      else setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal" onClick={loading ? undefined : onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <strong style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />
            </svg>
            AI로 악보 만들기
          </strong>
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
            <input value={title} autoFocus placeholder="예: Creep"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && keyReady && !loading) run() }} />
          </label>
          <label className="field">
            <span>아티스트</span>
            <input value={artist} placeholder="예: Radiohead"
              onChange={(e) => setArtist(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && keyReady && !loading) run() }} />
          </label>

          <div className="field">
            <span>참고 악보 (선택)</span>
            <p className="hint" style={{ padding: '0 0 6px' }}>정확도를 높이려면 악보 이미지나 링크를 넣으세요.</p>
            <div className="ref-images">
              {images.map((img, i) => (
                <div className="ref-thumb" key={i}>
                  <img src={img.url} alt={img.name} />
                  <button className="ref-thumb__x" title="삭제" onClick={() => removeImage(i)}>×</button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label className="ref-add">
                  + 이미지
                  <input type="file" accept="image/*" multiple hidden
                    onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
                </label>
              )}
            </div>
            <input value={refUrl} placeholder="또는 코드 악보 페이지 주소 https://…"
              disabled={images.length > 0}
              onChange={(e) => setRefUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && keyReady && !loading) run() }} />
            {images.length > 0
              ? <div className="hint" style={{ padding: '4px 0 0' }}>이미지를 우선 사용합니다 (링크 무시).</div>
              : (
                <div className="notice notice--tip">
                  💡 <a href={`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent((title + ' ' + artist).trim())}`}
                    target="_blank" rel="noreferrer">Ultimate Guitar에서 "{title || '곡'}" 검색</a>해서
                  Chords 악보 주소를 붙여넣으면 정확도가 확 올라가요.
                </div>
              )}
          </div>

          <div className="field">
            <span>코드 난이도</span>
            <div className="seg">
              {DIFFICULTIES.map((d) => (
                <button key={d.value} type="button" title={d.desc}
                  className={'seg__btn' + (difficulty === d.value ? ' is-on' : '')}
                  onClick={() => setDifficulty(d.value)}>{d.label}</button>
              ))}
            </div>
            <div className="diff-desc">{DIFFICULTIES.find((d) => d.value === difficulty)?.desc}</div>
          </div>

          {loading && <div className="notice notice--busy">악보 생성 중… (10~30초)</div>}
          {error && <div className="notice notice--error">{error}</div>}
          {unknownReason && (
            <div className="notice notice--warn">
              생성하지 않았습니다 — {unknownReason}
              <br />부정확한 악보를 지어내는 대신 중단했어요. <b>악보 이미지</b>를 첨부하거나 <b>참고 링크</b>를 넣고 다시 시도하면 정확하게 만들 수 있어요.
            </div>
          )}
          <p className="hint" style={{ padding: '2px 0 0' }}>
            생성 후 <b>편집기로 열립니다</b> — 코드가 틀린 부분은 마디에서 바로 고치세요.
          </p>
        </div>

        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose} disabled={loading}>취소</button>
          <button className="btn btn--ai" onClick={run} disabled={loading || !keyReady}>
            {loading && <span className="spin" />}
            {loading ? '생성 중…' : '생성'}
          </button>
        </div>
      </div>
    </div>
  )
}
