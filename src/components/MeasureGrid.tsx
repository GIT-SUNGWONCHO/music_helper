import type { DisplaySection } from '../music/song'
import { transposeChord } from '../music/chords'

interface Props {
  sections: DisplaySection[]
  semitones: number
}

/** 한 슬롯(=원래 마디 하나) 안의 코드 표시. 코드 2개면 슬롯을 반으로 나눠 배치. */
function ChordSlot({ chords, semitones }: { chords: string[]; semitones: number }) {
  return (
    <div className="bar__chords" data-count={chords.length}>
      {chords.length === 0 ? (
        <span className="bar__hold">%</span>
      ) : (
        chords.map((c, i) => (
          <span className="bar__chord" key={i}>{transposeChord(c, semitones)}</span>
        ))
      )}
    </div>
  )
}

/** Read-only Guitar-Pro-style measure grid: barlines, chords over lyric.
 *  마디가 합쳐진 경우 원래 마디 경계에 맞춰 슬롯별로 코드를 배치한다. */
export function MeasureGrid({ sections, semitones }: Props) {
  return (
    <div className="sheet">
      {sections.map((sec) => (
        <section className="sec" key={sec.id}>
          <div className="sec__label">{sec.label}</div>
          <div className="bars">
            {sec.bars.map((bar) => (
              <div className="bar" key={bar.id}>
                <div className="bar__slots" style={{ gridTemplateColumns: `repeat(${bar.slots.length}, 1fr)` }}>
                  {bar.slots.map((chords, i) => (
                    <ChordSlot key={i} chords={chords} semitones={semitones} />
                  ))}
                </div>
                <div className="bar__lyric">{bar.lyric || ' '}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
