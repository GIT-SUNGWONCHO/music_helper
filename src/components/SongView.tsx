import { useState } from 'react'
import type { Song } from '../types'
import { statusLabel } from '../types'
import { transposeNote, keyDistance } from '../music/chords'
import { regroupSections } from '../music/song'
import { MeasureGrid } from './MeasureGrid'
import { ChordStrip } from './ChordStrip'

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

  const displayKey = transposeNote(song.originalKey, semitones)
  // 운지 코드 오프셋 = 전조 반음 - 카포 프렛
  const fingeringOffset = semitones - capo
  const viewSections = regroupSections(song.sections, mergeStep)

  return (
    <div className="page view">
      <div className="toolbar">
        <button className="btn" onClick={onBack}>← 목록</button>
        <div className="toolbar__title">
          <strong>{song.title}</strong>
          {song.artist && <span className="muted"> · {song.artist}</span>}
        </div>
        <button className="btn btn--ghost btn--sm btn--danger" onClick={() => onDelete(song.id)}>삭제</button>
        <button className="btn btn--ghost btn--sm" onClick={onDuplicate}>복제</button>
        <button className="btn" onClick={onEdit}>편집</button>
      </div>

      <div className="controls">
        <div className="ctrl">
          <span className="ctrl__label">키</span>
          <button className="btn btn--icon" onClick={() => setSemitones((s) => s - 1)}>−</button>
          <span className="ctrl__value">{displayKey}</span>
          <button className="btn btn--icon" onClick={() => setSemitones((s) => s + 1)}>+</button>
          {semitones !== 0 && (
            <button className="btn btn--ghost btn--sm" onClick={() => setSemitones(0)}>원키 {song.originalKey}</button>
          )}
        </div>

        <div className="ctrl">
          <span className="ctrl__label">글자</span>
          <button className="btn btn--icon" onClick={() => setScale((s) => Math.max(0.7, +(s - 0.1).toFixed(2)))}>A−</button>
          <button className="btn btn--icon" onClick={() => setScale((s) => Math.min(1.6, +(s + 0.1).toFixed(2)))}>A+</button>
        </div>

        <div className="ctrl">
          <span className="ctrl__label">마디</span>
          <button className="btn btn--sm" title="두 마디를 하나로 합치기" onClick={() => setMergeStep((n) => Math.min(2, n + 1))} disabled={mergeStep >= 2}>합치기</button>
          <button className="btn btn--sm" title="한 마디를 둘로 나누기" onClick={() => setMergeStep((n) => Math.max(-2, n - 1))} disabled={mergeStep <= -2}>나누기</button>
          {mergeStep !== 0 && (
            <button className="btn btn--ghost btn--sm" onClick={() => setMergeStep(0)}>원래대로</button>
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

        <div className="ctrl meta">
          <span className={'chip chip--status chip--' + song.status}>{statusLabel(song.status)}</span>
          {song.tempo ? <span className="chip">♩ {song.tempo}</span> : null}
        </div>
      </div>

      <ChordStrip sections={song.sections} semitones={fingeringOffset} rootKey={transposeNote(song.originalKey, fingeringOffset)}
        fingerings={song.fingerings} hiddenChords={song.hiddenChords} pinnedChords={song.pinnedChords} />

      <div style={{ fontSize: `${scale}rem` }}>
        <MeasureGrid sections={viewSections} semitones={fingeringOffset} />
      </div>

      {(semitones !== 0 || capo > 0) && (
        <p className="hint">
          원키 {song.originalKey}
          {semitones !== 0 && ` → ${displayKey} (${keyDistance(song.originalKey, displayKey) >= 0 ? '+' : ''}${keyDistance(song.originalKey, displayKey)}반음)`}
          {capo > 0 && ` · Capo ${capo} 운지 코드`}
        </p>
      )}
    </div>
  )
}
