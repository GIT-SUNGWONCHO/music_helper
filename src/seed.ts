import type { Song, Bar } from './types'
import { newSong, newSection, newBar } from './db'

// Compact bar builder: b('G','creep') or b(['Gsus4','G'],"i'm a") or b() for empty.
function b(chords: string | string[] = [], lyric = ''): Bar {
  return newBar(Array.isArray(chords) ? chords : chords ? [chords] : [], lyric)
}

export function seedSongs(): Song[] {
  const creep = newSong({
    title: 'Creep',
    artist: 'Radiohead',
    originalKey: 'G',
    tempo: 92,
    tags: ['Rock', 'Alternative', '우울', '기타'],
    sections: [
      newSection('Intro', [
        b('G'), b(['Gsus4', 'G']), b('B'), b(['Bsus4', 'B']),
        b('C'), b(['Csus4', 'C']), b('Cm'), b('Cm'),
      ]),
      newSection('Verse', [
        b('G', 'When you were here before'), b(['Gsus4', 'G']), b('B', "couldn't look you in the eye"), b(['Bsus4', 'B'], "You're just like"),
        b('C', 'an angel'), b(['Csus4', 'C']), b('Cm', 'your skin makes me cry'), b('Cm', 'you float like a'),
        b('G', 'feather'), b(['Gsus4', 'G']), b('B', 'in a beautiful world'), b(['Bsus4', 'B'], 'i wish i was'),
        b('C', 'special'), b(['Csus4', 'C']), b('Cm', "you're so fucking special"), b('Cm', "but i'm a"),
      ]),
      newSection('Chorus', [
        b('G', 'creep'), b(['Gsus4', 'G'], "i'm a"), b('B', 'weirdo'), b(['Bsus4', 'B'], 'what the hell am i'),
        b('C', 'doing here'), b(['Csus4', 'C'], "i don't belong here"), b('Cm'), b('Cm'),
      ]),
    ],
  })

  const bampyeonji = newSong({
    title: '밤편지',
    artist: '아이유',
    originalKey: 'C', // 코드는 C 셰이프 표기 (원곡은 카포3 → 울림키 Eb)
    tempo: 75,
    tags: ['Ballad', '발라드', '잔잔', '기타', '카포3'],
    sections: [
      newSection('Verse', [
        b('FM7', '이 밤 그날의'), b(['Gsus4', 'G'], '반딧불을'), b('Em7', '당신의'), b('Am7'),
        b('Dm7', '음 사랑한다는'), b(['F/G', 'G'], '말이에요'), b('CM7'), b('FM7'),
      ]),
      newSection('Chorus', [
        b('FM7', '난 파도가'), b(['FmM7', 'Fm6'], '머물던'), b('Em7', '모래 위에 적힌'), b('Am7', '글씨처럼'),
        b('Dm7', '그대가 멀리'), b('E7', '사라져 버릴 것 같아'), b(['Am7', 'G/B'], '늘 그리워'), b(['C', 'CM7/E'], '그리워'),
      ]),
    ],
  })

  return [creep, bampyeonji]
}
