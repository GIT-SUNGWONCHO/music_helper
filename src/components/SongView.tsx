import { useMemo, useState } from 'react'
import type { Song } from '../types'
import { statusLabel } from '../types'
import { transposeNote, keyDistance } from '../music/chords'
import { collectChords } from '../music/song'
import { isHardChord } from '../music/diagrams'
import { MeasureGrid } from './MeasureGrid'
import { ChordDiagram } from './ChordDiagram'

interface Props {
  song: Song
  onEdit: () => void
  onBack: () => void
}

export function SongView({ song, onEdit, onBack }: Props) {
  const [semitones, setSemitones] = useState(0)
  const [scale, setScale] = useState(1)

  const displayKey = transposeNote(song.originalKey, semitones)
  const hardChords = useMemo(
    () => collectChords(song.sections, semitones).filter(isHardChord),
    [song, semitones],
  )

  return (
    <div className="page view">
      <div className="toolbar">
        <button className="btn" onClick={onBack}>← 목록</button>
        <div className="toolbar__title">
          <strong>{song.title}</strong>
          {song.artist && <span className="muted"> · {song.artist}</span>}
        </div>
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

        <div className="ctrl meta">
          <span className={'chip chip--status chip--' + song.status}>{statusLabel(song.status)}</span>
          {song.tempo ? <span className="chip">♩ {song.tempo}</span> : null}
          {song.genreTags.map((t) => <span key={'g' + t} className="chip chip--genre">{t}</span>)}
          {song.moodTags.map((t) => <span key={'m' + t} className="chip chip--mood">{t}</span>)}
        </div>
      </div>

      {hardChords.length > 0 && (
        <div className="diagram-strip">
          {hardChords.map((c) => <ChordDiagram key={c} chord={c} />)}
        </div>
      )}

      <div style={{ fontSize: `${scale}rem` }}>
        <MeasureGrid sections={song.sections} semitones={semitones} />
      </div>

      {semitones !== 0 && (
        <p className="hint">원키 {song.originalKey} → {displayKey} ({keyDistance(song.originalKey, displayKey) >= 0 ? '+' : ''}{keyDistance(song.originalKey, displayKey)}반음)</p>
      )}
    </div>
  )
}
