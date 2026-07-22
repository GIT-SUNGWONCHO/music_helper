-- Supabase SQL Editor에서 이 파일 전체를 붙여넣고 실행하세요.
-- 로그인 계정은 없음 — owner 컬럼('sungwon' | 'friend')으로만 데이터를 나눔.
-- 신뢰하는 지인 1명과만 링크를 공유하는 전제라 RLS는 anon 전체 허용으로 둠.

create table if not exists songs (
  id text primary key,
  owner text not null check (owner in ('sungwon', 'friend')),
  title text not null,
  version text,
  artist text not null default '',
  original_key text not null default 'C',
  tempo integer,
  mood_tags text[] not null default '{}',
  genre_tags text[] not null default '{}',
  status text not null default 'want',
  capo_fret integer default 0,
  fingerings jsonb default '{}',
  hidden_chords text[] default '{}',
  pinned_chords text[] default '{}',
  sections jsonb not null default '[]',
  created_at bigint not null,
  updated_at bigint not null
);

-- 기존 테이블에 이미 songs가 있다면(2026-07 이전 생성) 아래 한 줄만 SQL Editor에서 실행하면 됨:
-- alter table songs add column if not exists version text;

create index if not exists songs_owner_idx on songs (owner);

alter table songs enable row level security;

create policy "anon full access" on songs
  for all
  using (true)
  with check (true);
