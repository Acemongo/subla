// Gear panel UI — data model and shell for gear selection + upgrade system

export interface GearItem {
  id: string;
  name: string;
  slot: 'helmet' | 'suit' | 'boots' | 'tool' | 'weapon';
  tier: number;
  description: string;
  stats: Record<string, number>;
}

export const STARTER_GEAR: GearItem[] = [
  {
    id: 'hardhat_basic',
    name: 'Basic Hard Hat',
    slot: 'helmet',
    tier: 1,
    description: 'Standard construction helmet. Minimal protection.',
    stats: { defense: 1 },
  },
  {
    id: 'hiking_boots',
    name: 'Trail Boots',
    slot: 'boots',
    tier: 1,
    description: 'Good grip on loose rock. Standard issue for any descent.',
    stats: { speed: 1 },
  },
  {
    id: 'headlamp',
    name: 'LED Headlamp',
    slot: 'tool',
    tier: 1,
    description: 'Extends visibility in deep tunnels.',
    stats: { visionRange: 2 },
  },
  {
    id: 'climbing_axe',
    name: 'Climbing Axe',
    slot: 'weapon',
    tier: 1,
    description: 'Doubles as a weapon when things get weird down there.',
    stats: { attack: 2 },
  },
];
