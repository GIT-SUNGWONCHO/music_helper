import type { DisplaySection } from '../music/song'
import { transposeChord } from '../music/chords'

interface Props {
  sections: DisplaySection[]
  semitones: number
}

/** 한 슬롯(=원래 마디 하나) 안의 코드 표시. 코드가 여러 개면 슬롯을 그 수만큼 균등하게 나눠 배치.
 *  코드 없으면 빈 채로 둠(홀드). */
function ChordSlot({ chords, semitones }: { chords: string[]; semitones: number }) {
  return (
    <div className="bar__chords" style={chords.length > 1 ? { display: 'grid', gridTemplateColumns: `repeat(${chords.length}, 1fr)` } : undefined}>
      {chords.map((c, i) => (
        <span className="bar__chord" key={i}>{transposeChord(c, semitones)}</span>
      ))}
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
