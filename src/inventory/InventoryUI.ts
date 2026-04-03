import type { Inventory } from './Inventory';
import type { GearSlot, GearItem } from './Item';
import { qualityLabel, MAX_CARRY_WEIGHT } from './Item';

const SLOTS: GearSlot[] = ['helmet', 'suit', 'boots', 'tool', 'weapon'];
const SLOT_LABELS: Record<GearSlot, string> = {
  helmet: 'Helmet', suit: 'Suit', boots: 'Boots', tool: 'Tool', weapon: 'Weapon',
};

// ---------------------------------------------------------------------------
// InventoryUI — pure HTML overlay, no Phaser dependency
// Toggled with I key from GameScene.
// Calls back to GameScene for consumable use (needs HP/WILD values).
// ---------------------------------------------------------------------------

export class InventoryUI {
  private panel: HTMLDivElement | null = null;
  private visible = false;
  private inventory: Inventory;
  private onUseConsumable: (id: string) => void;

  constructor(
    inventory: Inventory,
    onUseConsumable: (id: string) => void,
  ) {
    this.inventory = inventory;
    this.onUseConsumable = onUseConsumable;
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  show(): void {
    this.visible = true;
    this.render();
  }

  hide(): void {
    this.visible = false;
    this.panel?.remove();
    this.panel = null;
  }

  isVisible(): boolean { return this.visible; }

  /** Re-render in place (called by inventory onChange callback) */
  refresh(): void {
    if (this.visible) this.render();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  private render(): void {
    this.panel?.remove();

    const panel = document.createElement('div');
    panel.dataset.sublaOverlay = 'inventory';
    panel.style.cssText = `
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 700px; max-height: 80vh;
      background: #0d0520ee;
      border: 1px solid #5030a0;
      border-radius: 10px;
      color: #e0d0ff;
      font-family: monospace;
      font-size: 13px;
      overflow-y: auto;
      z-index: 300;
      padding: 20px;
      box-sizing: border-box;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';
    header.innerHTML = `<span style="color:#c0a0ff; font-size:16px; font-weight:bold;">🎒 Inventory</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background:none; border:none; color:#7060a0; cursor:pointer;
      font-size:16px; font-family:monospace; padding:2px 6px;
    `;
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Carry weight bar
    const w = this.inventory.totalWeight();
    const mw = MAX_CARRY_WEIGHT;
    const wPct = Math.min(1, w / mw);
    const wColor = wPct >= 1 ? '#e03030' : wPct >= 0.8 ? '#e08030' : '#60a060';
    const weightDiv = document.createElement('div');
    weightDiv.style.cssText = 'margin-bottom:14px;';
    weightDiv.innerHTML = `
      <div style="display:flex; justify-content:space-between; color:${wColor}; font-size:11px; margin-bottom:3px;">
        <span>⚖ Carry Weight</span>
        <span>${w} / ${mw}</span>
      </div>
      <div style="height:4px; background:#1a0a3e; border-radius:2px; overflow:hidden;">
        <div style="height:100%; width:${Math.round(wPct*100)}%; background:${wColor}; border-radius:2px;"></div>
      </div>
    `;
    panel.appendChild(weightDiv);

    // ---- Equipped gear ----
    panel.appendChild(this.sectionLabel('Equipped'));
    const equippedGrid = document.createElement('div');
    equippedGrid.style.cssText = 'display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:16px;';
    for (const slot of SLOTS) {
      equippedGrid.appendChild(this.renderGearSlot(slot));
    }
    panel.appendChild(equippedGrid);

    // ---- Bag ----
    if (this.inventory.bag.length > 0) {
      panel.appendChild(this.sectionLabel('Bag'));
      const bagGrid = document.createElement('div');
      bagGrid.style.cssText = 'display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:16px;';
      for (const item of this.inventory.bag) {
        bagGrid.appendChild(this.renderBagItem(item));
      }
      panel.appendChild(bagGrid);
    }

    // ---- Consumables ----
    panel.appendChild(this.sectionLabel('Consumables'));
    if (this.inventory.consumables.length === 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'color:#4030a0; margin:4px 0 12px;';
      empty.textContent = 'No consumables.';
      panel.appendChild(empty);
    } else {
      const consGrid = document.createElement('div');
      consGrid.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;';
      for (const c of this.inventory.consumables) {
        consGrid.appendChild(this.renderConsumable(c.id));
      }
      panel.appendChild(consGrid);
    }

    // ---- Ammo status ----
    const weapon = this.inventory.equipped.weapon;
    if (weapon?.ammoType) {
      const ammo = this.inventory.consumables.find(c => c.id === weapon.ammoType);
      const ammoCount = ammo?.quantity ?? 0;
      const ammoEl = document.createElement('div');
      ammoEl.style.cssText = `
        margin-top:4px; padding:8px 12px;
        background:#1a0a3e; border-radius:6px;
        color:${ammoCount > 0 ? '#e0e060' : '#e03030'};
      `;
      ammoEl.textContent = `${weapon.emoji} ${weapon.name} — ${ammoCount > 0 ? ammoCount + ' rounds' : '⚠ OUT OF AMMO'}`;
      panel.appendChild(ammoEl);
    }

    // Stop clicks inside panel from bubbling to backdrop
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('mouseup',   (e) => e.stopPropagation());
    panel.addEventListener('click',     (e) => e.stopPropagation());

    document.body.appendChild(panel);
    this.panel = panel;
  }

  private onBackdropClick = () => { this.hide(); };

  // ---------------------------------------------------------------------------
  // Slot renderers
  // ---------------------------------------------------------------------------

  private renderGearSlot(slot: GearSlot): HTMLElement {
    const item = this.inventory.equipped[slot];
    const box = document.createElement('div');
    box.style.cssText = `
      background:#1a0a3e; border:1px solid ${item ? '#5030a0' : '#2a1060'};
      border-radius:6px; padding:8px; min-height:90px;
      display:flex; flex-direction:column; gap:4px;
      cursor:${item ? 'pointer' : 'default'};
    `;

    const slotLabel = document.createElement('div');
    slotLabel.style.cssText = 'color:#5040a0; font-size:10px; text-transform:uppercase; letter-spacing:1px;';
    slotLabel.textContent = SLOT_LABELS[slot];
    box.appendChild(slotLabel);

    if (!item) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#2a1060; font-size:20px; text-align:center; padding:8px 0;';
      empty.textContent = '—';
      box.appendChild(empty);
    } else {
      const emoji = document.createElement('div');
      emoji.style.cssText = 'font-size:22px; text-align:center;';
      emoji.textContent = item.emoji;
      box.appendChild(emoji);

      const name = document.createElement('div');
      name.style.cssText = 'color:#c0a0ff; font-size:11px; font-weight:bold;';
      name.textContent = item.name;
      box.appendChild(name);

      const ql = qualityLabel(item.quality);
      const qualEl = document.createElement('div');
      qualEl.style.cssText = `color:${ql.color}; font-size:10px;`;
      qualEl.textContent = `${ql.label} (${Math.round(item.quality * 100)}%)`;
      box.appendChild(qualEl);

      // Quality bar
      const bar = document.createElement('div');
      bar.style.cssText = 'height:3px; background:#1a0a3e; border-radius:2px; overflow:hidden; margin-top:2px;';
      const fill = document.createElement('div');
      fill.style.cssText = `height:100%; width:${Math.round(item.quality * 100)}%; background:${ql.color};`;
      bar.appendChild(fill);
      box.appendChild(bar);

      // Stats
      const stats = Object.entries(item.stats)
        .map(([k, v]) => `+${v} ${k}`)
        .join(' ');
      if (stats) {
        const statsEl = document.createElement('div');
        statsEl.style.cssText = 'color:#7060a0; font-size:10px;';
        statsEl.textContent = stats;
        box.appendChild(statsEl);
      }

      // Unequip button
      const unequipBtn = document.createElement('button');
      unequipBtn.textContent = 'Unequip';
      unequipBtn.style.cssText = `
        background:#2a1060; color:#a090ff; border:1px solid #3a1080;
        border-radius:4px; padding:2px 6px; font-size:10px;
        cursor:pointer; font-family:monospace; margin-top:auto;
      `;
      unequipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.inventory.unequip(slot);
        this.render();
      });
      box.appendChild(unequipBtn);
    }

    return box;
  }

  private renderBagItem(item: GearItem): HTMLElement {
    const box = document.createElement('div');
    box.style.cssText = `
      background:#1a0a3e; border:1px solid #3a1080;
      border-radius:6px; padding:8px; min-height:90px;
      display:flex; flex-direction:column; gap:4px;
    `;

    const slotLabel = document.createElement('div');
    slotLabel.style.cssText = 'color:#4030a0; font-size:10px; text-transform:uppercase;';
    slotLabel.textContent = SLOT_LABELS[item.slot];
    box.appendChild(slotLabel);

    const emoji = document.createElement('div');
    emoji.style.cssText = 'font-size:22px; text-align:center;';
    emoji.textContent = item.emoji;
    box.appendChild(emoji);

    const name = document.createElement('div');
    name.style.cssText = 'color:#9080c0; font-size:11px;';
    name.textContent = item.name;
    box.appendChild(name);

    const ql = qualityLabel(item.quality);
    const qualEl = document.createElement('div');
    qualEl.style.cssText = `color:${ql.color}; font-size:10px;`;
    qualEl.textContent = `${ql.label} (${Math.round(item.quality * 100)}%)`;
    box.appendChild(qualEl);

    const equipBtn = document.createElement('button');
    equipBtn.textContent = 'Equip';
    equipBtn.style.cssText = `
      background:#1a3060; color:#80c0ff; border:1px solid #304080;
      border-radius:4px; padding:2px 6px; font-size:10px;
      cursor:pointer; font-family:monospace; margin-top:auto;
      ${item.quality === 0 ? 'opacity:0.4; cursor:not-allowed;' : ''}
    `;
    if (item.quality > 0) {
      equipBtn.addEventListener('click', () => {
        this.inventory.equip(item);
        this.render();
      });
    }
    box.appendChild(equipBtn);

    return box;
  }

  private renderConsumable(id: string): HTMLElement {
    const item = this.inventory.consumables.find(c => c.id === id);
    if (!item) return document.createElement('div');

    const box = document.createElement('div');
    box.style.cssText = `
      background:#1a0a3e; border:1px solid #3a1080;
      border-radius:6px; padding:8px 12px;
      display:flex; align-items:center; gap:8px;
      min-width:120px;
    `;

    const emoji = document.createElement('span');
    emoji.style.fontSize = '20px';
    emoji.textContent = item.emoji;
    box.appendChild(emoji);

    const info = document.createElement('div');
    info.style.cssText = 'display:flex; flex-direction:column; gap:2px; flex:1;';

    const nameEl = document.createElement('div');
    nameEl.style.cssText = 'color:#c0a0ff; font-size:11px; font-weight:bold;';
    nameEl.textContent = `${item.name} ×${item.quantity}`;
    info.appendChild(nameEl);

    const desc = document.createElement('div');
    desc.style.cssText = 'color:#5040a0; font-size:10px;';
    desc.textContent = item.description;
    info.appendChild(desc);

    box.appendChild(info);

    // Use button (only for items with an effect, not ammo)
    if (item.effect) {
      const useBtn = document.createElement('button');
      useBtn.textContent = 'Use';
      useBtn.style.cssText = `
        background:#1a4020; color:#80e080; border:1px solid #2a6030;
        border-radius:4px; padding:3px 8px; font-size:11px;
        cursor:pointer; font-family:monospace;
      `;
      useBtn.addEventListener('click', () => {
        this.onUseConsumable(id);
        this.render();
      });
      box.appendChild(useBtn);
    }

    return box;
  }

  private sectionLabel(text: string): HTMLElement {
    const el = document.createElement('p');
    el.style.cssText = 'color:#5040a0; margin:0 0 6px; font-size:11px; text-transform:uppercase; letter-spacing:1px;';
    el.textContent = text;
    return el;
  }

  destroy(): void {
    document.removeEventListener('click', this.onBackdropClick);
    this.hide();
  }
}
