// ---------------------------------------------------------------------------
// Item types for Subterranean Los Angeles
// ---------------------------------------------------------------------------

export type GearSlot = 'helmet' | 'suit' | 'boots' | 'tool' | 'weapon';

export interface ItemStats {
  defense?:     number;
  speed?:       number;
  attack?:      number;
  visionRange?: number;
}

/** A piece of wearable/equippable gear with quality degradation */
export interface GearItem {
  id:            string;
  name:          string;
  slot:          GearSlot;
  tier:          number;        // 1–5
  stats:         ItemStats;
  description:   string;
  quality:       number;        // 0.0–1.0
  durabilityMax: number;        // uses before quality hits 0
  ammoType?:     string;        // if weapon, which ammo consumable it uses
  emoji:         string;
  weight:        number;        // carry weight units
}

/** A consumable stack (med kits, food, ammo, repair kits) */
export interface Consumable {
  id:          string;
  name:        string;
  quantity:    number;
  emoji:       string;
  description: string;
  effect?: {
    healHp?:   number;  // restore HP
    healWild?: number;  // restore WILD (mental stamina)
    repairQuality?: number; // restore gear quality (0.0–1.0) — applied to equipped item in slot
    repairSlot?: GearSlot;
  };
}

// ---------------------------------------------------------------------------
// Starting gear catalog
// ---------------------------------------------------------------------------

export const MAX_CARRY_WEIGHT = 20;

export const GEAR_CATALOG: Record<string, GearItem> = {
  hardhat: {
    id: 'hardhat', name: 'Hard Hat', slot: 'helmet', tier: 1,
    stats: { defense: 1 }, description: 'Standard construction helmet.',
    quality: 1.0, durabilityMax: 100, emoji: '⛑️', weight: 1,
  },
  caving_suit: {
    id: 'caving_suit', name: 'Caving Suit', slot: 'suit', tier: 1,
    stats: { defense: 2 }, description: 'Padded suit for tight tunnels.',
    quality: 1.0, durabilityMax: 80, emoji: '🦺', weight: 3,
  },
  trail_boots: {
    id: 'trail_boots', name: 'Trail Boots', slot: 'boots', tier: 1,
    stats: { speed: 1 }, description: 'Good grip on loose rock.',
    quality: 1.0, durabilityMax: 120, emoji: '🥾', weight: 1,
  },
  headlamp: {
    id: 'headlamp', name: 'LED Headlamp', slot: 'tool', tier: 1,
    stats: { visionRange: 2 }, description: 'Extends visibility in deep tunnels.',
    quality: 1.0, durabilityMax: 200, emoji: '🔦', weight: 1,
  },
  climbing_axe: {
    id: 'climbing_axe', name: 'Climbing Axe', slot: 'weapon', tier: 1,
    stats: { attack: 3 }, description: 'Doubles as a weapon when things get weird.',
    quality: 1.0, durabilityMax: 60, emoji: '⛏️', weight: 2,
  },
  pistol: {
    id: 'pistol', name: 'Pistol', slot: 'weapon', tier: 2,
    stats: { attack: 5 }, description: '9mm semi-auto. Needs ammo.',
    quality: 1.0, durabilityMax: 200, ammoType: 'ammo_9mm', emoji: '🔫', weight: 1,
  },
  shotgun: {
    id: 'shotgun', name: 'Sawed-Off Shotgun', slot: 'weapon', tier: 2,
    stats: { attack: 20 }, description: 'Devastating at close range. Needs shells.',
    quality: 1.0, durabilityMax: 80, ammoType: 'ammo_shells', emoji: '💥', weight: 3,
  },
  hazmat_helmet: {
    id: 'hazmat_helmet', name: 'Hazmat Helmet', slot: 'helmet', tier: 2,
    stats: { defense: 3 }, description: 'Full face protection. Found deeper down.',
    quality: 0.75, durabilityMax: 80, emoji: '🪖', weight: 2,
  },
  kevlar_vest: {
    id: 'kevlar_vest', name: 'Kevlar Vest', slot: 'suit', tier: 2,
    stats: { defense: 5 }, description: 'Stops bullets. Heavy.',
    quality: 0.6, durabilityMax: 60, emoji: '🛡️', weight: 5,
  },
  multitool: {
    id: 'multitool', name: 'Multitool w/ Knife', slot: 'tool', tier: 1,
    stats: { attack: 1, visionRange: 1 }, description: 'Useful for everything.',
    quality: 1.0, durabilityMax: 150, emoji: '🔪', weight: 1,
  },
};

export const CONSUMABLE_CATALOG: Record<string, Omit<Consumable, 'quantity'>> = {
  medkit: {
    id: 'medkit', name: 'First Aid Kit', emoji: '🩹',
    description: 'Restores 15 HP.',
    effect: { healHp: 15 },
  },
  food_ration: {
    id: 'food_ration', name: 'Food Ration', emoji: '🥫',
    description: 'Restores 5 HP and 5 WILD.',
    effect: { healHp: 5, healWild: 5 },
  },
  repair_kit: {
    id: 'repair_kit', name: 'Repair Kit', emoji: '🔧',
    description: 'Restores 50% quality to your weapon.',
    effect: { repairQuality: 0.5, repairSlot: 'weapon' },
  },
  ammo_9mm: {
    id: 'ammo_9mm', name: '9mm Ammo', emoji: '🔸',
    description: 'For pistols.',
  },
  ammo_shells: {
    id: 'ammo_shells', name: 'Shotgun Shells', emoji: '🔶',
    description: 'For shotguns.',
  },
  flare: {
    id: 'flare', name: 'Flare', emoji: '🔴',
    description: 'Lights up dark areas.',
  },
};

/** Quality label for display */
export function qualityLabel(q: number): { label: string; color: string } {
  if (q >= 0.8) return { label: 'Good',     color: '#60e060' };
  if (q >= 0.5) return { label: 'Worn',     color: '#e0e060' };
  if (q >= 0.2) return { label: 'Damaged',  color: '#e08030' };
  if (q >  0.0) return { label: 'Critical', color: '#e03030' };
  return              { label: 'Broken',    color: '#606060' };
}

/** Effective stats accounting for quality degradation */
export function effectiveStats(item: GearItem): ItemStats {
  const mult = item.quality < 0.1 ? 0.5 : 1.0;
  const s: ItemStats = {};
  if (item.stats.defense)     s.defense     = Math.round(item.stats.defense     * mult);
  if (item.stats.speed)       s.speed       = Math.round(item.stats.speed       * mult);
  if (item.stats.attack)      s.attack      = Math.round(item.stats.attack      * mult);
  if (item.stats.visionRange) s.visionRange = Math.round(item.stats.visionRange * mult);
  return s;
}
