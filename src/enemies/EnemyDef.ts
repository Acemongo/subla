// ---------------------------------------------------------------------------
// Enemy definitions — ported from SUBTERRALIENS_REFERENCE.md
// ---------------------------------------------------------------------------

export type AttackType = 'melee' | 'ranged' | 'both';
export type EnemyState = 'idle' | 'aware' | 'pursue' | 'attack';

export interface EnemyDef {
  id:              string;
  name:            string;
  hp:              number;
  speed:           number;       // px/s when pursuing
  detectionRadius: number;       // tiles before becoming aware
  attackRange:     number;       // tiles (1 = adjacent for melee)
  attackType:      AttackType;
  attackDamage:    number;
  attackCooldown:  number;       // ms between attacks
  canMove:         boolean;
  spriteKey:       string;       // Phaser texture key prefix
  tint:            number;       // color tint (0xffffff = none)
  scale:           number;
  // Ranged projectile config (if attackType includes ranged)
  projectile?: {
    speed:  number;  // px/s
    color:  number;  // hex color
    radius: number;  // display size
  };
}

export const ENEMY_DEFS: Record<string, EnemyDef> = {

  morlock: {
    id:              'morlock',
    name:            'Morlock',
    hp:              42,
    speed:           120,
    detectionRadius: 4,
    attackRange:     1.5,   // tiles — adjacent
    attackType:      'melee',
    attackDamage:    10,
    attackCooldown:  5000,  // 5s (5 heartbeats)
    canMove:         true,
    spriteKey:       'morlock',
    tint:            0xffffff,  // no tint — use actual sprite colors
    scale:           0.45,
  },

  vine: {
    id:              'vine',
    name:            'Man-Eating Vine',
    hp:              10,
    speed:           0,          // stationary
    detectionRadius: 2,          // senses by touch/vibration
    attackRange:     1.5,
    attackType:      'melee',
    attackDamage:    10,
    attackCooldown:  1000,
    canMove:         false,
    spriteKey:       'char',
    tint:            0x226600,   // dark green
    scale:           0.4,
  },

  diablo_marioneta: {
    id:              'diablo_marioneta',
    name:            'Diablo Marioneta',
    hp:              15,
    speed:           150,
    detectionRadius: 5,
    attackRange:     1.5,
    attackType:      'melee',
    attackDamage:    10,
    attackCooldown:  1000,
    canMove:         true,
    spriteKey:       'char',
    tint:            0xaa44aa,   // sickly purple
    scale:           0.5,
  },

  animated_statue: {
    id:              'animated_statue',
    name:            'Animated Statue',
    hp:              120,
    speed:           60,         // slow but relentless
    detectionRadius: 6,
    attackRange:     1.5,
    attackType:      'melee',
    attackDamage:    20,
    attackCooldown:  2000,       // slow attacks
    canMove:         true,
    spriteKey:       'char',
    tint:            0x888888,   // grey stone
    scale:           0.6,        // bigger
  },

};
