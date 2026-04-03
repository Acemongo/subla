import type { GearItem, GearSlot, Consumable } from './Item';
import { GEAR_CATALOG, CONSUMABLE_CATALOG } from './Item';

// ---------------------------------------------------------------------------
// Inventory state
// ---------------------------------------------------------------------------

export interface InventoryState {
  equipped: Partial<Record<GearSlot, GearItem>>;
  bag:      GearItem[];       // unequipped gear
  consumables: Consumable[];  // stacked consumables
}

export interface InventorySaveData {
  equipped:    Partial<Record<GearSlot, GearItem>>;
  bag:         GearItem[];
  consumables: Consumable[];
}

// ---------------------------------------------------------------------------
// Inventory class
// ---------------------------------------------------------------------------

export class Inventory {
  public equipped:     Partial<Record<GearSlot, GearItem>> = {};
  public bag:          GearItem[]   = [];
  public consumables:  Consumable[] = [];

  /** Callbacks fired on any change — UIScene listens to refresh display */
  private onChange?: () => void;

  constructor(onChange?: () => void) {
    this.onChange = onChange;
  }

  // ---------------------------------------------------------------------------
  // Load / save
  // ---------------------------------------------------------------------------

  load(data: InventorySaveData): void {
    this.equipped    = data.equipped    ?? {};
    this.bag         = data.bag         ?? [];
    this.consumables = data.consumables ?? [];
    this.onChange?.();
  }

  toSaveData(): InventorySaveData {
    return {
      equipped:    this.equipped,
      bag:         this.bag,
      consumables: this.consumables,
    };
  }

  /** Build starter inventory from chosen gear IDs */
  static buildStarter(weaponId: 'pistol' | 'shotgun' | 'climbing_axe'): InventorySaveData {
    const equipped: Partial<Record<GearSlot, GearItem>> = {
      helmet:  { ...GEAR_CATALOG.hardhat },
      suit:    { ...GEAR_CATALOG.caving_suit },
      boots:   { ...GEAR_CATALOG.trail_boots },
      tool:    { ...GEAR_CATALOG.headlamp },
      weapon:  { ...GEAR_CATALOG[weaponId] ?? GEAR_CATALOG.climbing_axe },
    };

    const consumables: Consumable[] = [
      { ...CONSUMABLE_CATALOG.medkit,      quantity: 2 },
      { ...CONSUMABLE_CATALOG.food_ration, quantity: 3 },
      { ...CONSUMABLE_CATALOG.repair_kit,  quantity: 1 },
      { ...CONSUMABLE_CATALOG.flare,       quantity: 4 },
    ];

    // Add ammo if gun
    if (weaponId === 'pistol') {
      consumables.push({ ...CONSUMABLE_CATALOG.ammo_9mm, quantity: 20 });
    } else if (weaponId === 'shotgun') {
      consumables.push({ ...CONSUMABLE_CATALOG.ammo_shells, quantity: 10 });
    }

    return { equipped, bag: [], consumables };
  }

  // ---------------------------------------------------------------------------
  // Equip / unequip
  // ---------------------------------------------------------------------------

  equip(item: GearItem): void {
    const current = this.equipped[item.slot];
    if (current) this.bag.push(current);  // move current to bag
    this.equipped[item.slot] = item;
    this.bag = this.bag.filter(b => b.id !== item.id);
    this.onChange?.();
  }

  unequip(slot: GearSlot): void {
    const item = this.equipped[slot];
    if (!item) return;
    this.bag.push(item);
    delete this.equipped[slot];
    this.onChange?.();
  }

  // ---------------------------------------------------------------------------
  // Consumables
  // ---------------------------------------------------------------------------

  addConsumable(id: string, qty = 1): void {
    const existing = this.consumables.find(c => c.id === id);
    if (existing) {
      existing.quantity += qty;
    } else {
      const def = CONSUMABLE_CATALOG[id];
      if (def) this.consumables.push({ ...def, quantity: qty });
    }
    this.onChange?.();
  }

  /** Use a consumable. Returns effect applied, or null if can't use. */
  useConsumable(
    id: string,
    currentHp: number, maxHp: number,
    currentWild: number, maxWild: number,
  ): { newHp: number; newWild: number } | null {
    const item = this.consumables.find(c => c.id === id && c.quantity > 0);
    if (!item) return null;

    let newHp   = currentHp;
    let newWild = currentWild;

    if (item.effect?.healHp)   newHp   = Math.min(maxHp,   currentHp   + item.effect.healHp);
    if (item.effect?.healWild) newWild = Math.min(maxWild, currentWild + item.effect.healWild);

    if (item.effect?.repairQuality != null && item.effect.repairSlot) {
      const gear = this.equipped[item.effect.repairSlot];
      if (gear) {
        gear.quality = Math.min(1.0, gear.quality + item.effect.repairQuality);
      }
    }

    item.quantity--;
    if (item.quantity <= 0) {
      this.consumables = this.consumables.filter(c => c.id !== id);
    }

    this.onChange?.();
    return { newHp, newWild };
  }

  // ---------------------------------------------------------------------------
  // Durability
  // ---------------------------------------------------------------------------

  /** Call when weapon is used in combat */
  degradeWeapon(): void {
    const weapon = this.equipped.weapon;
    if (!weapon) return;
    weapon.quality = Math.max(0, weapon.quality - (1 / weapon.durabilityMax));
    this.onChange?.();
  }

  /** Call when player takes a hit */
  degradeArmor(slots: GearSlot[] = ['helmet', 'suit', 'boots']): void {
    for (const slot of slots) {
      const item = this.equipped[slot];
      if (item) item.quality = Math.max(0, item.quality - (1 / item.durabilityMax));
    }
    this.onChange?.();
  }

  // ---------------------------------------------------------------------------
  // Ammo
  // ---------------------------------------------------------------------------

  hasAmmo(): boolean {
    const weapon = this.equipped.weapon;
    if (!weapon?.ammoType) return true;  // melee = always usable
    const ammo = this.consumables.find(c => c.id === weapon.ammoType);
    return (ammo?.quantity ?? 0) > 0;
  }

  consumeAmmo(): void {
    const weapon = this.equipped.weapon;
    if (!weapon?.ammoType) return;
    const ammo = this.consumables.find(c => c.id === weapon.ammoType);
    if (ammo && ammo.quantity > 0) {
      ammo.quantity--;
      if (ammo.quantity === 0) this.consumables = this.consumables.filter(c => c.id !== weapon.ammoType);
      this.onChange?.();
    }
  }
}
