/**
 * PlayerCharacter.ts
 *
 * Data structure for a Subterraliens player character.
 * Based on the G-Core system from the Subterraliens Starter Book.
 *
 * Stats are stored as raw numeric values (not rank labels).
 * Common rank values: 2 (Pathetic), 5 (Below Average), 8 (Average),
 *                     10 (Decent), 20 (Excellent), 30 (Extraordinary)
 *
 * Derived stats (health, wild) are computed, not stored.
 * Current HP is tracked separately for runtime damage.
 */

// ---------------------------------------------------------------------------
// Enums & Constants
// ---------------------------------------------------------------------------

export const STAT_RANKS = {
  PATHETIC:      2,
  BELOW_AVERAGE: 5,
  AVERAGE:       8,
  DECENT:        10,
  EXCELLENT:     20,
  EXTRAORDINARY: 30,
} as const;

export type StatRank = typeof STAT_RANKS[keyof typeof STAT_RANKS];

/** Roll a single d10 stat (Average=8, Decent=10, Excellent=20) */
export function rollStatRank(): StatRank {
  const roll = Math.ceil(Math.random() * 10);
  if (roll <= 6) return STAT_RANKS.AVERAGE;
  if (roll <= 8) return STAT_RANKS.DECENT;
  return STAT_RANKS.EXCELLENT;
}

/** Roll a d10% (d10 × 10, range 10–100) */
export function rollD10Percent(): number {
  return Math.ceil(Math.random() * 10) * 10;
}

// ---------------------------------------------------------------------------
// Special Focus (Skills)
// ---------------------------------------------------------------------------

export const FOCUS_LEVELS = {
  BASIC:       5,
  EXPERIENCED: 10,
  SEASONED:    20,
  EXPERT:      30,
  MASTER:      40,
} as const;

export type FocusLevel = typeof FOCUS_LEVELS[keyof typeof FOCUS_LEVELS];

export interface SpecialFocus {
  name: string;    // e.g. "Pistols", "Botany", "Geology"
  bonus: FocusLevel;
}

// ---------------------------------------------------------------------------
// Character Concepts (Classes)
// ---------------------------------------------------------------------------

export type CharacterConcept =
  | 'educator'
  | 'engineer'
  | 'lawyer'
  | 'paramedic'
  | 'scientist'
  | 'journalist'
  | 'student';

export const CONCEPT_FOCUS: Record<CharacterConcept, SpecialFocus> = {
  educator:   { name: 'History',          bonus: FOCUS_LEVELS.EXPERT },
  engineer:   { name: 'Civil Engineering', bonus: FOCUS_LEVELS.EXPERT },
  lawyer:     { name: 'Law',              bonus: FOCUS_LEVELS.EXPERT },
  paramedic:  { name: 'Trauma Care',      bonus: FOCUS_LEVELS.EXPERT },
  scientist:  { name: 'Geology',          bonus: FOCUS_LEVELS.EXPERT },
  journalist: { name: 'Investigation',    bonus: FOCUS_LEVELS.EXPERT },
  student:    { name: 'Film Production',  bonus: FOCUS_LEVELS.EXPERIENCED },
};

// ---------------------------------------------------------------------------
// Background & Motivation
// ---------------------------------------------------------------------------

export type Background =
  | 'typical_childhood'
  | 'tragic_loss'
  | 'grew_up_poor'
  | 'religious_family'
  | 'subterralien_encounter';

export type Motivation =
  | 'revenge'
  | 'missing_loved_one'
  | 'blackmailed'
  | 'boosting_views'
  | 'treasure_hunting'
  | 'debunking'
  | 'research';

// ---------------------------------------------------------------------------
// Primary Stats
// ---------------------------------------------------------------------------

export interface PrimaryStats {
  // Physical
  rumble:     number;   // Hand-to-hand / melee combat
  agility:    number;   // Dodging, shooting, initiative, actions/turn
  might:      number;   // Strength, lifting, movement speed
  moxie:      number;   // Endurance, toughness, resisting toxins

  // Mental
  smarts:     number;   // Knowledge, hacking, identifying things
  perception: number;   // Awareness, spotting threats
  spirit:     number;   // Willpower, resisting fear & possession
}

// ---------------------------------------------------------------------------
// Derived Stats (computed, not stored)
// ---------------------------------------------------------------------------

/** HEALTH = rumble + agility + might + moxie */
export function computeMaxHealth(stats: PrimaryStats): number {
  return stats.rumble + stats.agility + stats.might + stats.moxie;
}

/** WILD = smarts + perception + spirit */
export function computeMaxWild(stats: PrimaryStats): number {
  return stats.smarts + stats.perception + stats.spirit;
}

// ---------------------------------------------------------------------------
// Full Character Definition
// ---------------------------------------------------------------------------

export interface PlayerCharacter {
  // Identity
  id:         string;   // UUID (matches Supabase user_id)
  name:       string;
  concept:    CharacterConcept;
  background: Background;
  motivation: Motivation;

  // Core stats (rolled or assigned)
  stats: PrimaryStats;

  // Derived stat maximums (computed from stats)
  maxHealth:  number;   // = computeMaxHealth(stats)
  maxWild:    number;   // = computeMaxWild(stats)

  // Runtime/current values (tracked during play)
  currentHealth: number;
  currentWild:   number;

  // Social stats (fixed at creation per rules)
  popularity: number;   // default 10
  resources:  number;   // default 10

  // Skills
  focuses: SpecialFocus[];  // typically 2–3 at creation

  // Optional flaw
  flaw?: string;            // e.g. "Recklessness (-10 SPIRIT in solo ops)"

  // Inventory
  gear: string[];           // item IDs or names
}

// ---------------------------------------------------------------------------
// Factory: Roll a new character
// ---------------------------------------------------------------------------

export function rollNewCharacter(
  id: string,
  name: string,
  concept: CharacterConcept,
  background: Background,
  motivation: Motivation,
  primaryFocus: SpecialFocus,
  secondaryFocus: SpecialFocus,
): PlayerCharacter {
  const stats: PrimaryStats = {
    rumble:     rollStatRank(),
    agility:    rollStatRank(),
    might:      rollStatRank(),
    moxie:      rollStatRank(),
    smarts:     rollStatRank(),
    perception: rollStatRank(),
    spirit:     rollStatRank(),
  };

  const maxHealth = computeMaxHealth(stats);
  const maxWild   = computeMaxWild(stats);

  // Concept grants a profession-specific focus at +30
  const conceptFocus = CONCEPT_FOCUS[concept];

  return {
    id,
    name,
    concept,
    background,
    motivation,
    stats,
    maxHealth,
    maxWild,
    currentHealth: maxHealth,
    currentWild:   maxWild,
    popularity:    10,
    resources:     10,
    focuses: [conceptFocus, primaryFocus, secondaryFocus],
    gear:    [],
  };
}

// ---------------------------------------------------------------------------
// Roll formula helper
// ---------------------------------------------------------------------------

/**
 * Roll a skill check: STAT + specialFocusBonus + d10%
 * Returns the total result.
 */
export function rollCheck(statValue: number, focusBonus: number = 0): number {
  return statValue + focusBonus + rollD10Percent();
}
