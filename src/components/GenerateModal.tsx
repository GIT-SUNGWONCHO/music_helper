import { useEffect, useRef, useState } from 'react'
import { loadSettings, hasApiKey } from '../ai/settings'
import { generateChart, GeminiError, UnknownSongError, DIFFICULTIES, type Difficulty, type GenerateResult, type RefImage } from '../ai/generate'

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

/** AI가 본문을 가져올 수 없는 사이트 — 봇 차단이나 로그인 요구 때문에 링크를 줘도 읽지 못한다.
 *  링크 모드는 읽기에 실패하면 생성 자체가 중단되므로, 넣는 시점에 미리 막고 대안을 안내한다. */
const UNREADABLE_SITES: { pattern: RegExp; label: string }[] = [
  { pattern: /(^|\.)blog\.naver\.com$/, label: '네이버 블로그' },
  { pattern: /(^|\.)cafe\.naver\.com$/, label: '네이버 카페' },
  { pattern: /(^|\.)band\.us$/, label: '네이버 밴드' },
  { pattern: /(^|\.)instagram\.com$/, label: '인스타그램' },
  { pattern: /(^|\.)facebook\.com$/, label: '페이스북' },
]

/** 읽을 수 없는 사이트면 그 이름을, 아니면 null. */
function unreadableSite(url: string): string | null {
  const t = url.trim()
  if (!t) return null
  let host: string
  try {
    host = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t).hostname.toLowerCase()
  } catch {
    return null // 아직 주소 형태가 아니면 입력 중으로 보고 참견하지 않음
  }
  return UNREADABLE_SITES.find((s) => s.pattern.test(host))?.label ?? null
}

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
  const [note, setNote] = useState('')
  const [images, setImages] = useState<PickedImage[]>([])
  const [difficulty, setDifficulty] = useState<Difficulty>('original')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unknownReason, setUnknownReason] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const keyReady = hasApiKey()

  // 생성 중 경과 시간(링크·이미지 모드는 1분 넘게 걸려서 멈춘 건지 알 수 있게)
  useEffect(() => {
    if (!loading) return
    setElapsed(0)
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(id)
  }, [loading])
  // 창을 닫으면 진행 중인 요청도 끊는다.
  useEffect(() => () => abortRef.current?.abort(), [])
  // 이미지가 있으면 링크는 무시되므로(아래 run 참고) 그때는 경고하지 않는다.
  const blockedSite = images.length > 0 ? null : unreadableSite(refUrl)

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
    if (blockedSite) { setError(`${blockedSite} 링크는 AI가 읽지 못합니다. 캡처해서 이미지로 첨부하거나 링크를 지워 주세요.`); return }
    setError('')
    setUnknownReason('')
    setLoading(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const refImages: RefImage[] = images.map((i) => ({ mimeType: i.mimeType, data: i.data }))
      const result = await generateChart(title, artist, loadSettings(), difficulty, refUrl, refImages, note.trim() || undefined, controller.signal)
      onGenerated(result)
    } catch (e) {
      if (e instanceof GeminiError && e.kind === 'cancelled') return // 직접 취소한 거라 안내 불필요
      if (e instanceof UnknownSongError) setUnknownReason(e.message)
      else setError((e as Error).message)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoading(false)
    }
  }

  /** 생성 중이면 요청만 멈추고 창은 그대로, 아니면 창을 닫는다. */
  function cancel() {
    if (loading) abortRef.current?.abort()
    else onClose()
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
          <button className="btn btn--icon btn--ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal__body">
          {!keyReady && (
            <div className="notice notice--row">
              Gemini API 키가 필요합니다.
              <button className="btn btn--sm" onClick={onOpenSettings}>설정 열기</button>
            </div>
          )}
          <label className="field">
            <div className="field-group__title">곡 제목</div>
            <input value={title} autoFocus placeholder="예: Creep"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && keyReady && !loading) run() }} />
          </label>
          <label className="field">
            <div className="field-group__title">아티스트</div>
            <input value={artist} placeholder="예: Radiohead"
              onChange={(e) => setArtist(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && keyReady && !loading) run() }} />
          </label>

          <div className="field">
            <div className="field-group__title">참고 악보 (선택)</div>
            <p className="hint" style={{ padding: '0 0 6px' }}>정확도를 높이려면 악보 이미지나 링크를 넣으세요.</p>

            <span>이미지</span>
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

            <span>또는 링크</span>
            <input value={refUrl} placeholder="코드 악보 페이지 주소 https://…"
              disabled={images.length > 0}
              onChange={(e) => setRefUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && keyReady && !loading) run() }} />
            {images.length > 0
              ? <div className="hint" style={{ padding: '4px 0 0' }}>이미지를 우선 사용합니다 (링크 무시).</div>
              : blockedSite
              ? (
                <div className="notice notice--warn">
                  {blockedSite}은(는) AI가 본문을 읽지 못합니다 (봇 차단·로그인 필요).
                  <br />그 페이지를 <b>캡처해서 위에 이미지로 첨부</b>하거나, 다른 코드 악보 사이트 주소를 넣어 주세요.
                </div>
              )
              : (
                <div className="notice notice--tip">
                  💡 <a href={`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent((title + ' ' + artist).trim())}`}
                    target="_blank" rel="noreferrer">Ultimate Guitar에서 "{title || '곡'}" 검색</a>해서
                  Chords 악보 주소를 붙여넣으면 정확도가 확 올라가요.
                </div>
              )}
          </div>

          <div className="field">
            <div className="field-group__title">코드 난이도</div>
            <div className="seg">
              {DIFFICULTIES.map((d) => (
                <button key={d.value} type="button" title={d.desc}
                  className={'seg__btn' + (difficulty === d.value ? ' is-on' : '')}
                  onClick={() => setDifficulty(d.value)}>{d.label}</button>
              ))}
            </div>
            <div className="diff-desc">{DIFFICULTIES.find((d) => d.value === difficulty)?.desc}</div>
          </div>

          <label className="field">
            <div className="field-group__title">추가 요청사항 (선택)</div>
            <textarea rows={2} value={note} placeholder="예: Dadd9는 Dsus2로, 도돌이표는 마디로 풀어서 써줘"
              onChange={(e) => setNote(e.target.value)} />
          </label>

          {loading && (
            <div className="notice notice--busy">
              악보 생성 중… {elapsed}초
              <br />보통 30초~1분, 링크·이미지를 읽을 땐 1~2분 걸려요.
            </div>
          )}
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
          <button className="btn btn--ghost" onClick={cancel}>{loading ? '생성 멈추기' : '취소'}</button>
          <button className="btn btn--ai" onClick={run} disabled={loading || !keyReady || !!blockedSite}>
            {loading && <span className="spin" />}
            {loading ? '생성 중…' : '생성'}
          </button>
        </div>
      </div>
    </div>
  )
}
