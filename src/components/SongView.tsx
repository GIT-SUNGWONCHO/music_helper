import { useEffect, useRef, useState } from 'react'
import type { Song } from '../types'
import { statusLabel } from '../types'
import { transposeNote, keyDistance } from '../music/chords'
import { regroupSections } from '../music/song'
import { MeasureGrid } from './MeasureGrid'
import { ChordStrip } from './ChordStrip'

const NEAR_BOTTOM_PX = 40

/** 현재 스크롤 위치에서 화면의 2/3만큼 아래로, 마디(행) 경계에 맞춰 스냅한 목표 지점. */
function nextScrollTarget(container: HTMLElement): number {
  const bars = Array.from(container.querySelectorAll<HTMLElement>('.bar'))
  const current = window.scrollY
  const amount = window.innerHeight * (2 / 3)
  if (bars.length === 0) return current + amount
  const tops = Array.from(new Set(bars.map((b) => Math.round(b.getBoundingClientRect().top + current)))).sort((a, b) => a - b)
  const desired = current + amount
  const snapped = tops.find((t) => t >= desired)
  if (snapped !== undefined && snapped > current) return snapped
  // 다음 행이 목표 지점보다 가깝게(예: 화면이 매우 큰 경우) 있으면 최소 한 행은 이동
  return tops.find((t) => t > current) ?? document.body.scrollHeight
}

interface Props {
  song: Song
  onEdit: () => void
  onBack: () => void
  onDuplicate: () => void
  onDelete: (id: string) => void
}

export function SongView({ song, onEdit, onBack, onDuplicate, onDelete }: Props) {
  const [semitones, setSemitones] = useState(0)
  const [capo, setCapo] = useState(song.capoFret ?? 0)
  const [scale, setScale] = useState(1)
  const [mergeStep, setMergeStep] = useState(0) // +면 합치기(넓게), -면 나누기(잘게)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(false)

  const displayKey = transposeNote(song.originalKey, semitones)
  // 운지 코드 오프셋 = 전조 반음 - 카포 프렛
  const fingeringOffset = semitones - capo
  const viewSections = regroupSections(song.sections, mergeStep)

  useEffect(() => {
    function checkBottom() {
      setAtBottom(window.scrollY + window.innerHeight >= document.body.scrollHeight - NEAR_BOTTOM_PX)
    }
    checkBottom()
    window.addEventListener('scroll', checkBottom, { passive: true })
    window.addEventListener('resize', checkBottom)
    return () => {
      window.removeEventListener('scroll', checkBottom)
      window.removeEventListener('resize', checkBottom)
    }
  }, [viewSections])

  function scrollNext() {
    if (!sheetRef.current) return
    window.scrollTo({ top: nextScrollTarget(sheetRef.current), behavior: 'smooth' })
  }

  return (
    <div className="page view">
      <div className="toolbar toolbar--stacked">
        <div className="toolbar__row">
          <button className="btn" onClick={onBack}>← 목록</button>
          <div className="spacer" />
          <button className="btn btn--ghost btn--sm btn--danger" onClick={() => onDelete(song.id)}>삭제</button>
          <button className="btn btn--ghost btn--sm" onClick={onDuplicate}>복제</button>
          <button className="btn" onClick={onEdit}>편집</button>
        </div>
        <div className="toolbar__title toolbar__title--full toolbar__title--split">
          <div className="toolbar__title-text">
            <strong>{song.title}</strong>
            {song.artist && <span className="muted toolbar__artist"> · {song.artist}</span>}
          </div>
          <span className={'chip chip--status chip--' + song.status}>{statusLabel(song.status)}</span>
        </div>
      </div>

      <div className="controls">
        <div className="ctrl">
          <span className="ctrl__label">글자</span>
          <button className="btn btn--icon" onClick={() => setScale((s) => Math.max(0.7, +(s - 0.1).toFixed(2)))}>A−</button>
          <button className="btn btn--icon" onClick={() => setScale((s) => Math.min(1.6, +(s + 0.1).toFixed(2)))}>A+</button>
        </div>

        <div className="ctrl">
          <span className="ctrl__label">키</span>
          <button className="btn btn--icon" onClick={() => setSemitones((s) => s - 1)}>−</button>
          <span className="ctrl__value">{displayKey}</span>
          <button className="btn btn--icon" onClick={() => setSemitones((s) => s + 1)}>+</button>
          {semitones !== 0 && (
            <button className="btn btn--ghost btn--sm" onClick={() => setSemitones(0)}>원키 {song.originalKey}</button>
          )}
        </div>

        {capo > 0 && (
          <div className="ctrl">
            <span className="ctrl__label">카포</span>
            <button className="btn btn--icon" onClick={() => setCapo((c) => Math.max(0, c - 1))}>−</button>
            <span className="ctrl__value">{capo}프렛</span>
            <button className="btn btn--icon" onClick={() => setCapo((c) => Math.min(7, c + 1))}>+</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setCapo(0)}>카포 해제</button>
          </div>
        )}
        {capo === 0 && (
          <div className="ctrl">
            <span className="ctrl__label">카포</span>
            <button className="btn btn--ghost btn--sm" onClick={() => setCapo(1)}>끼우기</button>
          </div>
        )}

        <div className="ctrl">
          <span className="ctrl__label">마디</span>
          <button className="btn btn--sm" title="두 마디를 하나로 합치기" onClick={() => setMergeStep((n) => Math.min(2, n + 1))} disabled={mergeStep >= 2}>합치기</button>
          <button className="btn btn--sm" title="한 마디를 둘로 나누기" onClick={() => setMergeStep((n) => Math.max(-2, n - 1))} disabled={mergeStep <= -2}>나누기</button>
          {mergeStep !== 0 && (
            <button className="btn btn--ghost btn--sm" onClick={() => setMergeStep(0)}>원래대로</button>
          )}
        </div>

        {song.tempo ? (
          <div className="ctrl meta">
            <span className="chip">♩ {song.tempo}</span>
          </div>
        ) : null}
      </div>

      <ChordStrip sections={song.sections} semitones={fingeringOffset} rootKey={transposeNote(song.originalKey, fingeringOffset)}
        fingerings={song.fingerings} hiddenChords={song.hiddenChords} pinnedChords={song.pinnedChords} />

      <div ref={sheetRef} style={{ fontSize: `${scale}rem` }}>
        <MeasureGrid sections={viewSections} semitones={fingeringOffset} />
      </div>

      {(semitones !== 0 || capo > 0) && (
        <p className="hint">
          원키 {song.originalKey}
          {semitones !== 0 && ` → ${displayKey} (${keyDistance(song.originalKey, displayKey) >= 0 ? '+' : ''}${keyDistance(song.originalKey, displayKey)}반음)`}
          {capo > 0 && ` · Capo ${capo} 운지 코드`}
        </p>
      )}

      {!atBottom && (
        <button className="scroll-fab" title="다음 부분으로" onClick={scrollNext}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  )
}
