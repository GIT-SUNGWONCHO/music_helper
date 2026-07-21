import type { Section } from '../types'
import { transposeChord } from '../music/chords'

interface Props {
  sections: Section[]
  semitones: number
}

/** Read-only Guitar-Pro-style measure grid: barlines, chords over lyric. */
export function MeasureGrid({ sections, semitones }: Props) {
  return (
    <div className="sheet">
      {sections.map((sec) => (
        <section className="sec" key={sec.id}>
          <div className="sec__label">{sec.label}</div>
          <div className="bars">
            {sec.bars.map((bar) => (
              <div className="bar" key={bar.id}>
                <div className="bar__chords" data-count={bar.chords.length}>
                  {bar.chords.length === 0 ? (
                    <span className="bar__hold">%</span>
                  ) : (
                    bar.chords.map((c, i) => (
                      <span className="bar__chord" key={i}>{transposeChord(c, semitones)}</span>
                    ))
                  )}
                </div>
                <div className="bar__lyric">{bar.lyric || ' '}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
