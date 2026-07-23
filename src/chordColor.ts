import type { Owner } from './supabase'

export const CHORD_COLOR_PRESETS: { label: string; value: string }[] = [
  { label: '테라코타(기본)', value: '#a8583f' },
  { label: '머스타드골드', value: '#b8862f' },
  { label: '코랄핑크', value: '#d97d6e' },
  { label: '파치먼트크림', value: '#ddc9a3' },
  { label: '슬레이트블루', value: '#4b607f' },
  { label: '세이지그린', value: '#6b8a7a' },
]

const DEFAULT_CHORD_COLOR = CHORD_COLOR_PRESETS[0].value

function key(owner: Owner): string {
  return 'mh.chordColor.' + owner
}

export function loadChordColor(owner: Owner): string {
  return localStorage.getItem(key(owner)) ?? DEFAULT_CHORD_COLOR
}

export function saveChordColor(owner: Owner, hex: string): void {
  localStorage.setItem(key(owner), hex)
}

export function applyChordColor(hex: string): void {
  document.documentElement.style.setProperty('--chord', hex)
}
