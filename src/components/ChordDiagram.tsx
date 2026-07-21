import { getDiagram, FRETS_ON_CHORD } from '../music/diagrams'

interface Props {
  chord: string
  size?: number
  positionIndex?: number
}

/** Small vertical guitar chord diagram (low-E string on the left). */
export function ChordDiagram({ chord, size = 1, positionIndex = 0 }: Props) {
  const d = getDiagram(chord, positionIndex)
  const W = 66 * size
  const H = 84 * size

  if (!d) {
    return (
      <div className="diagram diagram--missing" style={{ width: W }}>
        <div className="diagram__name">{chord}</div>
        <div className="diagram__unknown">운지 없음</div>
      </div>
    )
  }

  const pos = d.position
  const nStr = d.strings
  const nFret = FRETS_ON_CHORD
  const baseFret = pos.baseFret
  // baseFret > 1이면 왼쪽에 "Nfr" 라벨 공간 확보
  const padLeft = (baseFret > 1 ? 22 : 8) * size
  const padRight = 8 * size
  const padTop = 16 * size
  const boardW = W - padLeft - padRight
  const boardH = H - padTop - 10 * size
  const strGap = boardW / (nStr - 1)
  const fretGap = boardH / nFret

  const strX = (i: number) => padLeft + i * strGap
  const fretY = (row: number) => padTop + row * fretGap

  // chords-db의 frets/barres 값은 baseFret 기준 상대값(1 = baseFret 위치)
  const dots = []
  for (let i = 0; i < nStr; i++) {
    const f = pos.frets[i]
    const x = strX(i)
    if (f === -1) {
      dots.push(
        <text key={'m' + i} x={x} y={padTop - 4 * size} className="dg-mark">×</text>,
      )
    } else if (f === 0) {
      dots.push(
        <circle key={'o' + i} cx={x} cy={padTop - 6 * size} r={3 * size} className="dg-open" />,
      )
    } else {
      const row = f - 0.5
      dots.push(
        <circle key={'d' + i} cx={x} cy={fretY(row)} r={5 * size} className="dg-dot" />,
      )
      const finger = pos.fingers[i]
      if (finger) {
        dots.push(
          <text key={'f' + i} x={x} y={fretY(row) + 3.2 * size} className="dg-finger">{finger}</text>,
        )
      }
    }
  }

  // barres
  const barreEls = pos.barres.map((b, idx) => {
    const row = b - 0.5
    const idxs = pos.frets.map((f, i) => (f === b ? i : -1)).filter((i) => i >= 0)
    if (idxs.length < 2) return null
    const x1 = strX(Math.min(...idxs))
    const x2 = strX(Math.max(...idxs))
    return (
      <line key={'b' + idx} x1={x1} y1={fretY(row)} x2={x2} y2={fretY(row)} className="dg-barre" strokeWidth={9 * size} />
    )
  })

  return (
    <div className="diagram" style={{ width: W }}>
      <div className="diagram__name">{d.exact ? chord : chord + '≈'}</div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* nut or base-fret marker */}
        {baseFret === 1 ? (
          <line x1={padLeft} y1={padTop} x2={padLeft + boardW} y2={padTop} className="dg-nut" />
        ) : (
          <text x={padLeft - 4 * size} y={fretY(0.65)} className="dg-basefret">{baseFret}fr</text>
        )}
        {/* frets */}
        {Array.from({ length: nFret + 1 }, (_, r) => (
          <line key={'fr' + r} x1={padLeft} y1={fretY(r)} x2={padLeft + boardW} y2={fretY(r)} className="dg-fret" />
        ))}
        {/* strings */}
        {Array.from({ length: nStr }, (_, i) => (
          <line key={'st' + i} x1={strX(i)} y1={padTop} x2={strX(i)} y2={padTop + boardH} className="dg-string" />
        ))}
        {barreEls}
        {dots}
      </svg>
    </div>
  )
}
