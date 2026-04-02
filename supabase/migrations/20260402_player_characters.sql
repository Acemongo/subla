-- Migration: player_characters table
-- Stores the full Subterraliens character sheet for each user.
-- Run this in the Supabase SQL editor or via supabase db push.

create table if not exists public.player_characters (
  user_id         uuid        primary key references auth.users(id) on delete cascade,
  name            text        not null,
  concept         text        not null,
  background      text        not null,
  motivation      text        not null,

  -- Primary stats stored as JSONB: { rumble, agility, might, moxie, smarts, perception, spirit }
  stats           jsonb       not null,

  -- Derived stat maximums (computed at creation, stored for convenience)
  max_health      int         not null,
  max_wild        int         not null,

  -- Runtime values (updated during play)
  current_health  int         not null,
  current_wild    int         not null,

  -- Social stats
  popularity      int         not null default 10,
  resources       int         not null default 10,

  -- Skills: array of { name: string, bonus: number }
  focuses         jsonb       not null default '[]',

  -- Optional flaw description
  flaw            text,

  -- Inventory: array of item id/name strings
  gear            jsonb       not null default '[]',

  updated_at      timestamptz default now()
);

-- Row-level security: each user can only see and edit their own character
alter table public.player_characters enable row level security;

create policy "Users manage own character"
  on public.player_characters
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
