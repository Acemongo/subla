import Phaser from 'phaser';
import {
  rollStatRank,
  computeMaxHealth,
  computeMaxWild,
  STAT_RANKS,
  FOCUS_LEVELS,
  CONCEPT_FOCUS,
  type PrimaryStats,
  type PlayerCharacter,
  type CharacterConcept,
  type Background,
  type Motivation,
  type SpecialFocus,
} from '../player/PlayerCharacter';
import { saveCharacter } from '../player/PlayerState';

// ---------------------------------------------------------------------------
// Data tables
// ---------------------------------------------------------------------------

const CONCEPTS: { key: CharacterConcept; label: string }[] = [
  { key: 'educator',   label: 'Educator (History +30)'          },
  { key: 'engineer',   label: 'Engineer (Civil Engineering +30)' },
  { key: 'lawyer',     label: 'Lawyer (Law +30)'                 },
  { key: 'paramedic',  label: 'Paramedic (Trauma Care +30)'      },
  { key: 'scientist',  label: 'Scientist (Geology +30)'          },
  { key: 'journalist', label: 'Journalist (Investigation +30)'   },
  { key: 'student',    label: 'Student (Film Production +10)'    },
];

const FOCUSES: string[] = [
  'Pistols', 'Explosives', 'Botany', 'Geotactics',
  'Leadership', 'Mysticism', 'Stealth', 'Occult',
  'History', 'Geology', 'Investigation', 'Trauma Care',
  'Civil Engineering', 'Law', 'Film Production',
];

const BACKGROUNDS: { key: Background; label: string }[] = [
  { key: 'typical_childhood',       label: 'Typical childhood'                      },
  { key: 'tragic_loss',             label: 'Suffered a tragic loss'                 },
  { key: 'grew_up_poor',            label: 'Grew up poor'                           },
  { key: 'religious_family',        label: 'Grew up in a religious family'          },
  { key: 'subterralien_encounter',  label: 'Encountered a Subterralien as a child'  },
];

const MOTIVATIONS: { key: Motivation; label: string }[] = [
  { key: 'revenge',          label: 'Revenge'                  },
  { key: 'missing_loved_one',label: 'Find a missing loved one' },
  { key: 'blackmailed',      label: 'Blackmailed'              },
  { key: 'boosting_views',   label: 'Boost my vlog views'      },
  { key: 'treasure_hunting', label: 'Treasure hunting'         },
  { key: 'debunking',        label: 'Debunking urban legends'  },
  { key: 'research',         label: 'Research / survey work'   },
];

const STAT_KEYS: (keyof PrimaryStats)[] = [
  'rumble', 'agility', 'might', 'moxie', 'smarts', 'perception', 'spirit',
];

const STAT_LABELS: Record<keyof PrimaryStats, string> = {
  rumble:     'RUMBLE',
  agility:    'AGILITY',
  might:      'MIGHT',
  moxie:      'MOXIE',
  smarts:     'SMARTS',
  perception: 'PERCEPTION',
  spirit:     'SPIRIT',
};

// Stat rank upgrade ladder (for free points)
const RANK_LADDER = [
  STAT_RANKS.PATHETIC,
  STAT_RANKS.BELOW_AVERAGE,
  STAT_RANKS.AVERAGE,
  STAT_RANKS.DECENT,
  STAT_RANKS.EXCELLENT,
];

const FREE_POINTS_TOTAL   = 10;
const COST_STAT_UPGRADE   = 5;   // per rank step
const COST_ADD_FOCUS      = 10;  // add a new focus at +10
const MAX_REROLLS         = 3;
const FIXED_GEAR          = [
  'Gas Mask', 'Hard Hat', 'Smartphone w/ GPS', 'Canteen',
  'Caving Suit', 'Mini Backpack', 'LED Flashlight',
  'Flares (×4)', 'First Aid Kit', '50ft Rope', 'Multitool w/ Knife',
];

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export class CharacterCreateScene extends Phaser.Scene {
  private userId!: string;

  // State
  private stats!: PrimaryStats;
  private rerollsLeft = MAX_REROLLS;
  private freePoints  = FREE_POINTS_TOTAL;
  private statUpgrades: Partial<Record<keyof PrimaryStats, number>> = {}; // extra points spent per stat

  private selectedConcept!:    CharacterConcept;
  private selectedPrimaryFocus!:   string;
  private selectedSecondaryFocus!: string;
  private selectedBackground!: Background;
  private selectedMotivation!: Motivation;
  private selectedWeapon: 'pistol' | 'shotgun' = 'pistol';
  private extraFocuses: string[] = []; // bought with free points

  // DOM
  private container!: HTMLDivElement;
  private nameInput!: HTMLInputElement;

  // Phaser text refs for live updates
  private statTexts: Partial<Record<keyof PrimaryStats, HTMLElement>> = {};
  private hpText!: HTMLElement;
  private wildText!: HTMLElement;
  private freePointsText!: HTMLElement;
  private rerollText!: HTMLElement;
  private statusText!: HTMLElement;

  constructor() {
    super({ key: 'CharacterCreateScene' });
  }

  init(data: { userId: string }): void {
    this.userId = data.userId;
  }

  create(): void {
    this.rollStats();
    this.buildUI();
  }

  // -------------------------------------------------------------------------
  // Stat rolling
  // -------------------------------------------------------------------------

  private rollStats(): void {
    this.stats = {
      rumble:     rollStatRank(),
      agility:    rollStatRank(),
      might:      rollStatRank(),
      moxie:      rollStatRank(),
      smarts:     rollStatRank(),
      perception: rollStatRank(),
      spirit:     rollStatRank(),
    };
    this.statUpgrades = {};
    this.freePoints   = FREE_POINTS_TOTAL;
  }

  private effectiveStat(key: keyof PrimaryStats): number {
    return this.stats[key] + (this.statUpgrades[key] ?? 0);
  }

  private effectiveStats(): PrimaryStats {
    const s = {} as PrimaryStats;
    for (const k of STAT_KEYS) s[k] = this.effectiveStat(k);
    return s;
  }

  // -------------------------------------------------------------------------
  // Free-points: stat upgrade
  // -------------------------------------------------------------------------

  private canUpgradeStat(key: keyof PrimaryStats): boolean {
    if (this.freePoints < COST_STAT_UPGRADE) return false;
    const current = this.effectiveStat(key);
    const idx = RANK_LADDER.indexOf(current as typeof RANK_LADDER[number]);
    return idx !== -1 && idx < RANK_LADDER.length - 1;
  }

  private canDowngradeStat(key: keyof PrimaryStats): boolean {
    return (this.statUpgrades[key] ?? 0) > 0;
  }

  private upgradeStat(key: keyof PrimaryStats): void {
    if (!this.canUpgradeStat(key)) return;
    const current = this.effectiveStat(key);
    const idx = RANK_LADDER.indexOf(current as typeof RANK_LADDER[number]);
    const diff = RANK_LADDER[idx + 1] - current;
    this.statUpgrades[key] = (this.statUpgrades[key] ?? 0) + diff;
    this.freePoints -= COST_STAT_UPGRADE;
    this.refreshDerived();
  }

  private downgradeStat(key: keyof PrimaryStats): void {
    if (!this.canDowngradeStat(key)) return;
    const current = this.effectiveStat(key);
    const idx = RANK_LADDER.indexOf(current as typeof RANK_LADDER[number]);
    const diff = current - RANK_LADDER[idx - 1];
    this.statUpgrades[key] = (this.statUpgrades[key] ?? 0) - diff;
    this.freePoints += COST_STAT_UPGRADE;
    this.refreshDerived();
  }

  // -------------------------------------------------------------------------
  // Free-points: add extra focus
  // -------------------------------------------------------------------------

  private canAddFocus(): boolean {
    return this.freePoints >= COST_ADD_FOCUS;
  }

  // -------------------------------------------------------------------------
  // UI refresh helpers
  // -------------------------------------------------------------------------

  private refreshDerived(): void {
    const es = this.effectiveStats();
    for (const k of STAT_KEYS) {
      if (this.statTexts[k]) this.statTexts[k]!.textContent = String(this.effectiveStat(k));
    }
    if (this.hpText)         this.hpText.textContent         = String(computeMaxHealth(es));
    if (this.wildText)       this.wildText.textContent        = String(computeMaxWild(es));
    if (this.freePointsText) this.freePointsText.textContent  = String(this.freePoints);
    if (this.rerollText)     this.rerollText.textContent      = String(this.rerollsLeft);
  }

  // -------------------------------------------------------------------------
  // Build HTML overlay UI
  // -------------------------------------------------------------------------

  private buildUI(): void {
    // Remove old container if rebuildling
    this.cleanup();

    const C = (tag: string, style?: string, html?: string): HTMLElement => {
      const el = document.createElement(tag);
      if (style) el.style.cssText = style;
      if (html)  el.innerHTML = html;
      return el;
    };

    this.container = document.createElement('div');
    this.container.dataset.sublaOverlay = 'character-create';
    this.container.style.cssText = `
      position: fixed; inset: 0;
      background: #0d0520;
      color: #e0d0ff;
      font-family: monospace;
      font-size: 13px;
      overflow-y: auto;
      z-index: 200;
      padding: 24px;
      box-sizing: border-box;
    `;

    // ---- Title ----
    const title = C('h1', `
      text-align: center; color: #c0a0ff;
      font-size: 22px; margin: 0 0 4px;
    `, '🕳️ Create Your Subsplorer');
    const subtitle = C('p', `
      text-align: center; color: #5040a0; margin: 0 0 20px; font-size: 12px;
    `, 'Fill in the details below. Stats are partially rolled — spend free points to adjust.');
    this.container.appendChild(title);
    this.container.appendChild(subtitle);

    // ---- Two-column layout ----
    const grid = C('div', `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      max-width: 960px;
      margin: 0 auto;
    `);

    // ---- LEFT COLUMN ----
    const left = C('div');

    // Name
    left.appendChild(this.buildSection('Character Name'));
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Enter name…';
    this.nameInput.maxLength = 32;
    this.nameInput.style.cssText = this.inputStyle();
    left.appendChild(this.nameInput);

    // Concept
    left.appendChild(this.buildSection('Concept / Class'));
    const conceptSel = this.buildSelect(
      CONCEPTS.map(c => ({ value: c.key, label: c.label })),
      (v) => { this.selectedConcept = v as CharacterConcept; }
    );
    this.selectedConcept = CONCEPTS[0].key;
    left.appendChild(conceptSel);

    // Primary focus
    left.appendChild(this.buildSection('Primary Special Focus (+20)'));
    const pFocusSel = this.buildSelect(
      FOCUSES.map(f => ({ value: f, label: f })),
      (v) => { this.selectedPrimaryFocus = v; }
    );
    this.selectedPrimaryFocus = FOCUSES[0];
    left.appendChild(pFocusSel);

    // Secondary focus
    left.appendChild(this.buildSection('Secondary Special Focus (+10)'));
    const sFocusSel = this.buildSelect(
      FOCUSES.map(f => ({ value: f, label: f })),
      (v) => { this.selectedSecondaryFocus = v; },
      1 // default to second item
    );
    this.selectedSecondaryFocus = FOCUSES[1];
    left.appendChild(sFocusSel);

    // Background
    left.appendChild(this.buildSection('Background'));
    const bgSel = this.buildSelect(
      BACKGROUNDS.map(b => ({ value: b.key, label: b.label })),
      (v) => { this.selectedBackground = v as Background; }
    );
    this.selectedBackground = BACKGROUNDS[0].key;
    left.appendChild(bgSel);

    // Motivation
    left.appendChild(this.buildSection('Motivation'));
    const motSel = this.buildSelect(
      MOTIVATIONS.map(m => ({ value: m.key, label: m.label })),
      (v) => { this.selectedMotivation = v as Motivation; }
    );
    this.selectedMotivation = MOTIVATIONS[0].key;
    left.appendChild(motSel);

    // Starting weapon
    left.appendChild(this.buildSection('Starting Weapon'));
    const weaponDiv = C('div', 'display:flex; gap:10px;');
    (['pistol', 'shotgun'] as const).forEach(w => {
      const btn = C('button', this.toggleBtnStyle(w === 'pistol'),
        w === 'pistol' ? 'Pistol (5 dmg)' : 'Sawed-Off Shotgun (20 dmg)'
      ) as HTMLButtonElement;
      btn.addEventListener('click', () => {
        this.selectedWeapon = w;
        weaponDiv.querySelectorAll('button').forEach((b, i) => {
          (b as HTMLElement).style.cssText = this.toggleBtnStyle(
            (i === 0 && w === 'pistol') || (i === 1 && w === 'shotgun')
          );
        });
      });
      weaponDiv.appendChild(btn);
    });
    left.appendChild(weaponDiv);

    // ---- RIGHT COLUMN ----
    const right = C('div');

    // Stats block
    right.appendChild(this.buildSection('Stats (Rolled)'));

    // Reroll controls
    const rerollRow = C('div', 'display:flex; align-items:center; gap:10px; margin-bottom:10px;');
    const rerollBtn = C('button', `
      background:#2a1060; color:#b090ff; border:1px solid #5030a0;
      padding:5px 12px; border-radius:5px; cursor:pointer; font-family:monospace;
    `, '🎲 Reroll All') as HTMLButtonElement;
    rerollBtn.addEventListener('click', () => {
      if (this.rerollsLeft <= 0) return;
      this.rerollsLeft--;
      this.rollStats();
      this.refreshDerived();
      rerollBtn.disabled = this.rerollsLeft <= 0;
      if (this.rerollsLeft <= 0) rerollBtn.style.opacity = '0.4';
    });
    this.rerollText = C('span', 'color:#a080ff;') as HTMLElement;
    this.rerollText.textContent = String(this.rerollsLeft);
    rerollRow.appendChild(rerollBtn);
    rerollRow.appendChild(C('span', 'color:#5040a0;', 'Rerolls left:'));
    rerollRow.appendChild(this.rerollText);
    right.appendChild(rerollRow);

    // Free points display
    const fpRow = C('div', 'margin-bottom:12px; color:#a080ff;');
    fpRow.innerHTML = 'Free points: ';
    this.freePointsText = C('span', 'color:#c0e060; font-weight:bold;') as HTMLElement;
    this.freePointsText.textContent = String(this.freePoints);
    fpRow.appendChild(this.freePointsText);
    fpRow.appendChild(document.createTextNode(' / 10  (5 pts = +1 stat rank, 10 pts = new focus +10)'));
    right.appendChild(fpRow);

    // Stat rows
    const statGrid = C('div', `
      display: grid;
      grid-template-columns: 90px 40px 28px 28px;
      gap: 4px 6px;
      align-items: center;
      margin-bottom: 14px;
    `);

    for (const key of STAT_KEYS) {
      const label = C('span', 'color:#9080c0;', STAT_LABELS[key]);
      const valEl = C('span', 'color:#e0d0ff; font-weight:bold; text-align:right;');
      valEl.textContent = String(this.effectiveStat(key));
      this.statTexts[key] = valEl as HTMLElement;

      const plusBtn  = C('button', this.smallBtnStyle('#2a4020'), '+') as HTMLButtonElement;
      const minusBtn = C('button', this.smallBtnStyle('#3a1010'), '−') as HTMLButtonElement;

      plusBtn.addEventListener('click',  () => { this.upgradeStat(key);   this.refreshDerived(); });
      minusBtn.addEventListener('click', () => { this.downgradeStat(key); this.refreshDerived(); });

      statGrid.appendChild(label);
      statGrid.appendChild(valEl);
      statGrid.appendChild(plusBtn);
      statGrid.appendChild(minusBtn);
    }
    right.appendChild(statGrid);

    // Derived stats
    const es = this.effectiveStats();
    const derivedDiv = C('div', `
      display:grid; grid-template-columns:1fr 1fr;
      gap:6px; margin-bottom:14px;
      background:#1a0a3e; padding:10px; border-radius:6px;
    `);

    const hpLabel  = C('span', 'color:#ff8080;', 'HP (HEALTH)');
    this.hpText    = C('span', 'color:#ffb0b0; font-weight:bold; font-size:16px;');
    this.hpText.textContent = String(computeMaxHealth(es));

    const wildLabel = C('span', 'color:#80c0ff;', 'WILD');
    this.wildText   = C('span', 'color:#b0d8ff; font-weight:bold; font-size:16px;');
    this.wildText.textContent = String(computeMaxWild(es));

    derivedDiv.appendChild(hpLabel);
    derivedDiv.appendChild(wildLabel);
    derivedDiv.appendChild(this.hpText);
    derivedDiv.appendChild(this.wildText);
    right.appendChild(derivedDiv);

    // Extra focus (free points)
    right.appendChild(this.buildSection('Buy Extra Focus (+10) with Free Points'));
    const focusBuyRow = C('div', 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;');
    const focusBuySel = this.buildSelect(
      FOCUSES.map(f => ({ value: f, label: f })),
      () => {}
    );
    focusBuySel.style.flex = '1';
    const addFocusBtn = C('button', `
      background:#1a3060; color:#80c0ff; border:1px solid #304080;
      padding:6px 12px; border-radius:5px; cursor:pointer; font-family:monospace;
    `, '+ Add Focus (10 pts)') as HTMLButtonElement;
    addFocusBtn.addEventListener('click', () => {
      if (!this.canAddFocus()) {
        this.setStatus('Not enough free points.', '#ff8060');
        return;
      }
      const focusName = (focusBuySel as HTMLSelectElement).value;
      this.extraFocuses.push(focusName);
      this.freePoints -= COST_ADD_FOCUS;
      this.refreshDerived();
      const tag = C('span', `
        background:#1a2040; color:#80c0ff; border:1px solid #304080;
        padding:2px 8px; border-radius:10px; font-size:11px;
      `, focusName + ' +10');
      extraFocusList.appendChild(tag);
    });
    focusBuyRow.appendChild(focusBuySel);
    focusBuyRow.appendChild(addFocusBtn);
    right.appendChild(focusBuyRow);
    const extraFocusList = C('div', 'display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;');
    right.appendChild(extraFocusList);

    // ---- Assemble grid ----
    grid.appendChild(left);
    grid.appendChild(right);
    this.container.appendChild(grid);

    // ---- Gear summary ----
    const gearSection = C('div', `
      max-width: 960px; margin: 20px auto 0;
      background:#1a0a3e; padding:14px; border-radius:8px;
    `);
    gearSection.appendChild(this.buildSection('Starting Gear (fixed)'));
    gearSection.appendChild(C('p', 'color:#7060a0; font-size:12px; margin:4px 0 0;',
      FIXED_GEAR.join(' · ') + ' · <em>Weapon of choice</em>'
    ));
    this.container.appendChild(gearSection);

    // ---- Status + Save button ----
    const footer = C('div', `
      max-width: 960px; margin: 20px auto;
      display:flex; align-items:center; gap:16px; flex-wrap:wrap;
    `);
    this.statusText = C('span', 'color:#ff8060; flex:1;') as HTMLElement;
    const saveBtn = C('button', `
      background:#6030e0; color:white; border:none;
      padding:12px 32px; border-radius:6px; cursor:pointer;
      font-size:15px; font-family:monospace; font-weight:bold;
    `, '⬇️  Descend') as HTMLButtonElement;
    saveBtn.addEventListener('click', () => this.handleSave());
    footer.appendChild(this.statusText);
    footer.appendChild(saveBtn);
    this.container.appendChild(footer);

    document.body.appendChild(this.container);
  }

  // -------------------------------------------------------------------------
  // UI helpers
  // -------------------------------------------------------------------------

  private buildSection(label: string): HTMLElement {
    const el = document.createElement('p');
    el.style.cssText = 'color:#7060a0; margin:14px 0 4px; font-size:11px; text-transform:uppercase; letter-spacing:1px;';
    el.textContent = label;
    return el;
  }

  private buildSelect(
    options: { value: string; label: string }[],
    onChange: (v: string) => void,
    defaultIndex = 0,
  ): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.style.cssText = this.inputStyle();
    options.forEach((o, i) => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      if (i === defaultIndex) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }

  private inputStyle(): string {
    return `
      background:#1e1040; border:1px solid #5030a0; color:#e0d0ff;
      padding:8px 10px; font-size:13px; border-radius:5px;
      outline:none; width:100%; box-sizing:border-box;
      font-family:monospace; margin-bottom:4px;
    `;
  }

  private smallBtnStyle(bg: string): string {
    return `
      background:${bg}; color:#e0d0ff; border:1px solid #5030a0;
      width:24px; height:24px; border-radius:4px; cursor:pointer;
      font-size:14px; line-height:1; padding:0; font-family:monospace;
    `;
  }

  private toggleBtnStyle(active: boolean): string {
    return `
      background:${active ? '#6030e0' : '#1a0a3e'};
      color:${active ? '#fff' : '#b090ff'};
      border:1px solid #5030a0; padding:7px 14px;
      border-radius:5px; cursor:pointer; font-family:monospace;
    `;
  }

  private setStatus(msg: string, color = '#ff8060'): void {
    if (this.statusText) {
      this.statusText.textContent = msg;
      this.statusText.style.color = color;
    }
  }

  // -------------------------------------------------------------------------
  // Save handler
  // -------------------------------------------------------------------------

  private async handleSave(): Promise<void> {
    const name = this.nameInput?.value.trim();
    if (!name) {
      this.setStatus('Please enter a character name.');
      return;
    }

    this.setStatus('Saving…', '#a090ff');

    const es = this.effectiveStats();
    const maxHealth = computeMaxHealth(es);
    const maxWild   = computeMaxWild(es);

    // Build focuses list
    const focuses: SpecialFocus[] = [
      CONCEPT_FOCUS[this.selectedConcept],
      { name: this.selectedPrimaryFocus,   bonus: FOCUS_LEVELS.SEASONED     },
      { name: this.selectedSecondaryFocus, bonus: FOCUS_LEVELS.EXPERIENCED  },
      ...this.extraFocuses.map(f => ({ name: f, bonus: FOCUS_LEVELS.EXPERIENCED })),
    ];

    const gear = [
      ...FIXED_GEAR,
      this.selectedWeapon === 'pistol'
        ? 'Pistol (5 dmg, 10 shots, 2 clips)'
        : 'Sawed-Off Shotgun (20 dmg, 5 ammo, 20 shells)',
    ];

    const character: PlayerCharacter = {
      id:            this.userId,
      name,
      concept:       this.selectedConcept,
      background:    this.selectedBackground,
      motivation:    this.selectedMotivation,
      stats:         es,
      maxHealth,
      maxWild,
      currentHealth: maxHealth,
      currentWild:   maxWild,
      popularity:    10,
      resources:     10,
      focuses,
      gear,
    };

    await saveCharacter(character);
    this.setStatus('Character saved!', '#60e060');

    this.time.delayedCall(800, () => {
      this.cleanup();
      setTimeout(() => {
        // Return focus to the canvas so Phaser keyboard input works immediately
        const canvas = this.game.canvas;
        canvas.focus();
        this.scene.start('GameScene', { character });
      }, 50);
    });
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  private cleanup(): void {
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    // Belt-and-suspenders: remove any stray overlays with this z-index
    document.querySelectorAll<HTMLElement>('[data-subla-overlay]').forEach(el => el.remove());
  }

  shutdown(): void {
    this.cleanup();
  }

  destroy(): void {
    this.cleanup();
  }
}
