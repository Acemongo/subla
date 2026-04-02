import { supabase } from '../config/supabaseClient';
import type { PlayerCharacter } from './PlayerCharacter';

// ---------------------------------------------------------------------------
// World state (position, gear) — existing table: player_state
// ---------------------------------------------------------------------------

export interface PlayerSaveData {
  user_id: string;
  x: number;
  y: number;
  depth: number;
  gear: Record<string, string | null>;
  updated_at?: string;
}

/**
 * Save player world state (position + gear) to Supabase.
 * Uses upsert so it creates or updates the row for this user.
 */
export async function savePlayerState(data: Omit<PlayerSaveData, 'updated_at'>): Promise<void> {
  const { error } = await supabase
    .from('player_state')
    .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) {
    console.error('[PlayerState] Save failed:', error.message);
  }
}

/**
 * Load player world state from Supabase.
 * Returns null if no save exists yet.
 */
export async function loadPlayerState(userId: string): Promise<PlayerSaveData | null> {
  const { data, error } = await supabase
    .from('player_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[PlayerState] Load failed:', error.message);
    return null;
  }

  return data as PlayerSaveData;
}

// ---------------------------------------------------------------------------
// Character sheet — table: player_characters
//
// Schema (run migration in supabase/migrations/):
//
//   create table public.player_characters (
//     user_id       uuid primary key references auth.users(id) on delete cascade,
//     name          text not null,
//     concept       text not null,
//     background    text not null,
//     motivation    text not null,
//     stats         jsonb not null,
//     max_health    int  not null,
//     max_wild      int  not null,
//     current_health int not null,
//     current_wild   int not null,
//     popularity    int  not null default 10,
//     resources     int  not null default 10,
//     focuses       jsonb not null default '[]',
//     flaw          text,
//     gear          jsonb not null default '[]',
//     updated_at    timestamptz default now()
//   );
//
//   alter table public.player_characters enable row level security;
//
//   create policy "Users manage own character"
//     on public.player_characters
//     for all using (auth.uid() = user_id);
//
// ---------------------------------------------------------------------------

/** Shape stored in the player_characters table (snake_case for Postgres) */
interface CharacterRow {
  user_id:        string;
  name:           string;
  concept:        string;
  background:     string;
  motivation:     string;
  stats:          PlayerCharacter['stats'];
  max_health:     number;
  max_wild:       number;
  current_health: number;
  current_wild:   number;
  popularity:     number;
  resources:      number;
  focuses:        PlayerCharacter['focuses'];
  flaw?:          string;
  gear:           string[];
  updated_at?:    string;
}

function toRow(char: PlayerCharacter): Omit<CharacterRow, 'updated_at'> {
  return {
    user_id:        char.id,
    name:           char.name,
    concept:        char.concept,
    background:     char.background,
    motivation:     char.motivation,
    stats:          char.stats,
    max_health:     char.maxHealth,
    max_wild:       char.maxWild,
    current_health: char.currentHealth,
    current_wild:   char.currentWild,
    popularity:     char.popularity,
    resources:      char.resources,
    focuses:        char.focuses,
    flaw:           char.flaw,
    gear:           char.gear,
  };
}

function fromRow(row: CharacterRow): PlayerCharacter {
  return {
    id:            row.user_id,
    name:          row.name,
    concept:       row.concept as PlayerCharacter['concept'],
    background:    row.background as PlayerCharacter['background'],
    motivation:    row.motivation as PlayerCharacter['motivation'],
    stats:         row.stats,
    maxHealth:     row.max_health,
    maxWild:       row.max_wild,
    currentHealth: row.current_health,
    currentWild:   row.current_wild,
    popularity:    row.popularity,
    resources:     row.resources,
    focuses:       row.focuses,
    flaw:          row.flaw,
    gear:          row.gear,
  };
}

/**
 * Save (upsert) a full character sheet to Supabase.
 */
export async function saveCharacter(char: PlayerCharacter): Promise<void> {
  const row = { ...toRow(char), updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from('player_characters')
    .upsert(row, { onConflict: 'user_id' });

  if (error) {
    console.error('[PlayerState] Character save failed:', error.message);
  }
}

/**
 * Load a character sheet from Supabase.
 * Returns null if the user hasn't created a character yet.
 */
export async function loadCharacter(userId: string): Promise<PlayerCharacter | null> {
  const { data, error } = await supabase
    .from('player_characters')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[PlayerState] Character load failed:', error.message);
    return null;
  }

  return data ? fromRow(data as CharacterRow) : null;
}

/**
 * Update only the runtime values (current HP, current WILD) —
 * called frequently during combat without rewriting the whole sheet.
 */
export async function saveCharacterRuntime(
  userId: string,
  currentHealth: number,
  currentWild: number,
): Promise<void> {
  const { error } = await supabase
    .from('player_characters')
    .update({
      current_health: currentHealth,
      current_wild:   currentWild,
      updated_at:     new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[PlayerState] Runtime save failed:', error.message);
  }
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

/**
 * Get the current Supabase user ID.
 * Returns null if not authenticated.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
