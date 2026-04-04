import Phaser from 'phaser';
import { Player } from '../player/Player';
import { WorldMap } from '../world/WorldMap';
import { savePlayerState, loadPlayerState, loadCharacter, getCurrentUserId } from '../player/PlayerState';
import { Inventory } from '../inventory/Inventory';
import { Inventory as InventoryClass } from '../inventory/Inventory';
import { InventoryUI } from '../inventory/InventoryUI';
import { findPath } from '../world/Pathfinder';
import { EnemyManager } from '../enemies/EnemyManager';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private worldMap!: WorldMap;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private iKey!: Phaser.Input.Keyboard.Key;
  private userId: string | null = null;

  // Character vitals
  public currentHp   = 30;
  public maxHp       = 30;
  public currentWild = 24;
  public maxWild     = 24;

  // Inventory
  public inventory!: InventoryClass;
  private inventoryUI!: InventoryUI;
  private lastClickTime = 0;

  // Enemies
  private enemyManager!: EnemyManager;

  // Combat keys
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private qKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;

  // Combat cooldown (ms)
  private meleeCooldown  = 0;
  private rangedCooldown = 0;
  private readonly MELEE_COOLDOWN  = 800;
  private readonly RANGED_COOLDOWN = 1200;
  private readonly MELEE_RANGE_PX  = 220; // ~1 tile + buffer (iso adjacent = ~181px)

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.worldMap = new WorldMap(this);
    this.worldMap.createFromTiledJSON('level1');

    // Spawn at center open floor area (col=8, row=6 confirmed walkable)
    const spawnCenter = this.worldMap.gridToScreen(8, 6);

    this.player = new Player(this, spawnCenter.x, spawnCenter.y);
    this.player.addWallCollider(this.worldMap.wallGroup);

    // Inventory setup — onChange refreshes the UI
    this.inventory = new Inventory(() => {
      this.inventoryUI?.refresh();
      (this.scene.get('UIScene') as any)?.refreshHud?.();
    });

    this.inventoryUI = new InventoryUI(
      this.inventory,
      (id) => this.handleUseConsumable(id),
    );

    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(1);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.iKey     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.qKey     = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    // Spawn enemies
    this.enemyManager = new EnemyManager(this, this.worldMap);
    this.enemyManager.spawnAll([
      { enemyId: 'morlock', col: 4,  row: 4  },
      { enemyId: 'morlock', col: 15, row: 4  },
      { enemyId: 'morlock', col: 4,  row: 11 },
    ]);
    this.enemyManager.addWallColliders(this.worldMap.wallGroup);

    // Double-click/tap to navigate (single click reserved for inspect/interact)
    this.input.on('pointermove', () => { /* keep pointer active */ });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.inventoryUI.isVisible()) return;
      if (pointer.downTime - (this.lastClickTime ?? 0) < 400) {
        // Double click
        this.handleClickNavigation(pointer);
        this.lastClickTime = 0;
      } else {
        // Single click — store time, handle interact later
        this.lastClickTime = pointer.downTime;
      }
    });

    this.scene.launch('UIScene');

    this.game.canvas.setAttribute('tabindex', '0');
    this.game.canvas.focus();
    this.input.keyboard!.resetKeys();
    this.time.delayedCall(100, () => this.input.keyboard?.resetKeys());

    this.loadSavedState();
  }

  private async loadSavedState(): Promise<void> {
    this.userId = await getCurrentUserId();
    if (!this.userId) return;

    // Load character vitals
    const char = await loadCharacter(this.userId);
    if (char) {
      this.maxHp       = char.maxHealth;
      this.currentHp   = char.currentHealth;
      this.maxWild     = char.maxWild;
      this.currentWild = char.currentWild;
    }

    // Load world state + inventory
    const saved = await loadPlayerState(this.userId);
    if (saved) {
      // Restore saved position if it exists
      if (this.player && saved.grid_col != null && saved.grid_row != null) {
        // Restore from reliable grid coordinates
        const pos = this.worldMap.gridToScreen(saved.grid_col, saved.grid_row);

        this.player.sprite.setPosition(pos.x, pos.y);
        (this.player.sprite.body as Phaser.Physics.Arcade.Body).reset(pos.x, pos.y);
        this.cameras.main.centerOn(pos.x, pos.y);
      }
      if (saved.current_health != null) this.currentHp   = saved.current_health;
      if (saved.current_wild   != null) this.currentWild = saved.current_wild;

      if (saved.inventory) {
        this.inventory.load(saved.inventory);
      } else {
        // First time — build starter inventory based on character's chosen weapon
        const weaponId = (char?.gear ?? []).find(g => g.includes('Shotgun'))
          ? 'shotgun'
          : (char?.gear ?? []).find(g => g.includes('Pistol'))
          ? 'pistol'
          : 'climbing_axe';
        this.inventory.load(Inventory.buildStarter(
          weaponId as 'pistol' | 'shotgun' | 'climbing_axe'
        ));
      }
    } else {
      // Brand new player — give starter gear
      this.inventory.load(Inventory.buildStarter('climbing_axe'));
    }

    (this.scene.get('UIScene') as any)?.refreshHud?.();
  }

  private handleUseConsumable(id: string): void {
    const result = this.inventory.useConsumable(
      id, this.currentHp, this.maxHp, this.currentWild, this.maxWild,
    );
    if (result) {
      this.currentHp   = result.newHp;
      this.currentWild = result.newWild;
      (this.scene.get('UIScene') as any)?.refreshHud?.();
    }
  }

  update(_time: number, delta: number): void {
    if (!this.cursors || !this.player) return;

    // Toggle inventory with I key
    if (Phaser.Input.Keyboard.JustDown(this.iKey)) {
      this.inventoryUI.toggle();
    }

    // Block movement while inventory is open
    if (this.inventoryUI.isVisible()) {
      (this.player.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return;
    }

    const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
    const down  = this.cursors.down.isDown  || this.wasd.down.isDown;
    const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;

    this.player.move(up, down, left, right, delta);
    this.player.updateDepth(this.worldMap.offsetX, this.worldMap.offsetY, this.worldMap.renderer?.tileH);

    // Update enemies
    this.enemyManager.update(delta, this.player.sprite.x, this.player.sprite.y, (dmg) => {
      this.currentHp = Math.max(0, this.currentHp - dmg);
      (this.scene.get('UIScene') as any)?.refreshHud?.();
      if (this.currentHp <= 0) this.onPlayerDeath();
    });

    // Combat cooldowns
    if (this.meleeCooldown  > 0) this.meleeCooldown  -= delta;
    if (this.rangedCooldown > 0) this.rangedCooldown -= delta;

    // Melee attack — Space
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && this.meleeCooldown <= 0) {
      this.doMeleeAttack();
    }

    // Ranged attack — Q or Enter
    if ((Phaser.Input.Keyboard.JustDown(this.qKey) ||
         Phaser.Input.Keyboard.JustDown(this.enterKey)) && this.rangedCooldown <= 0) {
      this.doRangedAttack();
    }
  }



  private doMeleeAttack(): void {
    const weapon = this.inventory.equipped.weapon;
    const dmg = weapon ? (weapon.stats.attack ?? 2) : 2; // fists = 2 dmg
    const enemy = this.enemyManager.getEnemyInRange(
      this.player.sprite.x, this.player.sprite.y, this.MELEE_RANGE_PX
    );
    if (enemy) {
      enemy.takeDamage(dmg);
      if (weapon) this.inventory.degradeWeapon();
      this.showFloatingText(`-${dmg}`, enemy.sprite.x, enemy.sprite.y - 80, '#ff4444');
    } else {
      this.showFloatingText('Miss!', this.player.sprite.x, this.player.sprite.y - 80, '#888888');
    }
    this.meleeCooldown = this.MELEE_COOLDOWN;
  }

  private doRangedAttack(): void {
    const weapon = this.inventory.equipped.weapon;
    if (!weapon?.ammoType) {
      this.showFloatingText('No ranged weapon!', this.player.sprite.x, this.player.sprite.y - 80, '#888888');
      return;
    }
    if (!this.inventory.hasAmmo()) {
      this.showFloatingText('Out of ammo!', this.player.sprite.x, this.player.sprite.y - 80, '#ff8800');
      return;
    }

    const dmg = weapon.stats.attack ?? 5;
    // Find closest enemy within ranged range (~5 tiles)
    const rangeGpx = (this.worldMap.renderer?.tileW ?? 256) * 2.5;
    const enemy = this.enemyManager.getEnemyInRange(
      this.player.sprite.x, this.player.sprite.y, rangeGpx
    );

    if (enemy) {
      this.inventory.consumeAmmo();
      this.inventory.degradeWeapon();
      this.fireProjectile(
        this.player.sprite.x, this.player.sprite.y,
        enemy.sprite.x, enemy.sprite.y,
        () => {
          enemy.takeDamage(dmg);
          this.showFloatingText(`-${dmg}`, enemy.sprite.x, enemy.sprite.y - 80, '#ff8800');
        }
      );
    } else {
      this.showFloatingText('No target!', this.player.sprite.x, this.player.sprite.y - 80, '#888888');
    }
    this.rangedCooldown = this.RANGED_COOLDOWN;
  }

  private fireProjectile(
    fromX: number, fromY: number,
    toX: number, toY: number,
    onHit: () => void,
  ): void {
    const bullet = this.add.circle(fromX, fromY, 6, 0xffcc00).setDepth(5000);
    this.tweens.add({
      targets: bullet,
      x: toX, y: toY,
      duration: 200,
      ease: 'Linear',
      onComplete: () => {
        bullet.destroy();
        onHit();
      },
    });
  }

  private showFloatingText(text: string, x: number, y: number, color: string): void {
    const t = this.add.text(x, y, text, {
      fontSize: '16px', color, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6000);
    this.tweens.add({
      targets: t,
      y: y - 50, alpha: 0,
      duration: 800,
      onComplete: () => t.destroy(),
    });
  }

  private onPlayerDeath(): void {
    // For now just show a message — death/respawn system TBD
    this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      '💀 You died.\nRefresh to respawn.',
      { fontSize: '24px', color: '#ff4444', align: 'center',
        backgroundColor: '#000000aa', padding: { x: 20, y: 12 } }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(9999);
  }

  private handleClickNavigation(pointer: Phaser.Input.Pointer): void {
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;

    const gridPos = this.worldMap.screenToGrid(worldX, worldY);
    if (!gridPos) return;

    const playerGrid = this.worldMap.screenToGrid(
      this.player.sprite.x,
      this.player.sprite.y,
    );
    if (!playerGrid) return;

    const path = findPath(this.worldMap.walkable, playerGrid, gridPos);

    if (!path || path.length === 0) {
      this.player.clearPath();
      return;
    }

    const tH = this.worldMap.renderer?.tileH ?? 128;
    const waypoints = path.map(p => {
      const s = this.worldMap.gridToScreen(p.col, p.row);
      return { x: s.x, y: s.y + tH / 2 };
    });

    this.player.setPath(waypoints);
  }

  async persistPlayerState(): Promise<void> {
    if (!this.userId || !this.player) return;
    const grid = this.worldMap.screenToGrid(this.player.sprite.x, this.player.sprite.y);

    await savePlayerState({
      user_id: this.userId,
      x: Math.round(this.player.sprite.x),
      y: Math.round(this.player.sprite.y),
      grid_col: grid?.col ?? 8,
      grid_row: grid?.row ?? 6,
      depth: 0,
      gear: {},
      inventory: this.inventory.toSaveData(),
      current_health: this.currentHp,
      current_wild:   this.currentWild,
    });
  }

  shutdown(): void {
    this.inventoryUI?.destroy();
  }
}
