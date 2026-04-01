import { supabase } from '../config/supabaseClient';

export interface PlayerSaveData {
  user_id: string;
  x: number;
  y: number;
  depth: number;
  gear: Record<string, string | null>;
  updated_at?: string;
}

/**
 * Save player state to Supabase.
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
 * Load player state from Supabase.
 * Returns null if no save exists yet.
 */
export async function loadPlayerState(userId: string): Promise<PlayerSaveData | null> {
  const { data, error } = await supabase
    .from('player_state')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle(); // returns null instead of error when no row found

  if (error) {
    console.error('[PlayerState] Load failed:', error.message);
    return null;
  }

  return data as PlayerSaveData;
}

/**
 * Get the current Supabase user ID.
 * Returns null if not authenticated.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
