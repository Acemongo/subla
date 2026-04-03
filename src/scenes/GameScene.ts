import Phaser from 'phaser';
import { Player } from '../player/Player';
import { WorldMap } from '../world/WorldMap';
import { savePlayerState, loadPlayerState, loadCharacter, getCurrentUserId } from '../player/PlayerState';
import { Inventory } from '../inventory/Inventory';
import { Inventory as InventoryClass } from '../inventory/Inventory';
import { InventoryUI } from '../inventory/InventoryUI';
import { findPath } from '../world/Pathfinder';

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

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.worldMap = new WorldMap(this);
    this.worldMap.createFromTiledJSON('level1');

    const spawnCenter = this.worldMap.gridToScreen(
      Math.floor(this.worldMap.mapCols / 2),
      Math.floor(this.worldMap.mapRows / 2)
    );

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
    this.iKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I);

    // Click/tap to navigate
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.inventoryUI.isVisible()) return;
      this.handleClickNavigation(pointer);
    });

    this.scene.launch('UIScene');

    this.game.canvas.setAttribute('tabindex', '0');
    this.game.canvas.focus();
    this.input.keyboard!.resetKeys();
    this.time.delayedCall(100, () => this.input.keyboard?.resetKeys());

    const { width } = this.cameras.main;
    this.add.text(width / 2, 16, '🗺 Subterranean Los Angeles', {
      fontSize: '18px', color: '#c0a0ff',
      backgroundColor: '#00000066', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000);

    this.add.text(width / 2, 46, 'v0.1.3', {
      fontSize: '11px', color: '#e0d0ff',
      backgroundColor: '#00000066', padding: { x: 8, y: 3 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000);

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
      if (this.player) this.player.sprite.setPosition(saved.x, saved.y);
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
  }

  private pathDebugGraphics?: Phaser.GameObjects.Graphics;

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

    // Clear previous debug drawing
    this.pathDebugGraphics?.destroy();
    this.pathDebugGraphics = this.add.graphics().setDepth(500);
    const g = this.pathDebugGraphics;

    // Draw target tile diamond outline (yellow)
    const target = this.worldMap.gridToScreen(gridPos.col, gridPos.row);
    const tW = this.worldMap.renderer?.tileW ?? 256;
    const tH = this.worldMap.renderer?.tileH ?? 128;
    g.lineStyle(3, 0xffff00, 1);
    g.beginPath();
    g.moveTo(target.x + tW / 2, target.y);          // right
    g.lineTo(target.x + tW,     target.y + tH / 2); // bottom
    g.lineTo(target.x + tW / 2, target.y + tH);     // left
    g.lineTo(target.x,          target.y + tH / 2); // top
    g.closePath();
    g.strokePath();

    if (!path || path.length === 0) {
      // No path — draw red X on target
      g.lineStyle(3, 0xff0000, 1);
      g.lineBetween(target.x, target.y, target.x + tW, target.y + tH);
      g.lineBetween(target.x + tW, target.y, target.x, target.y + tH);
      this.player.clearPath();
      return;
    }

    // Draw path dots + connecting lines (cyan)
    g.lineStyle(2, 0x00ffff, 0.8);
    const waypoints = path.map(p => {
      const s = this.worldMap.gridToScreen(p.col, p.row);
      // Center of tile diamond
      return { x: s.x + tW / 2, y: s.y + tH / 2 };
    });

    // Line from player to first waypoint
    g.lineBetween(this.player.sprite.x, this.player.sprite.y, waypoints[0].x, waypoints[0].y);
    for (let i = 0; i < waypoints.length - 1; i++) {
      g.lineBetween(waypoints[i].x, waypoints[i].y, waypoints[i+1].x, waypoints[i+1].y);
    }

    // Dots at each waypoint
    g.fillStyle(0x00ffff, 1);
    for (const wp of waypoints) {
      g.fillCircle(wp.x, wp.y, 6);
    }

    // Set path using tile centers as waypoints
    this.player.setPath(waypoints);

    // Auto-clear debug after 5s
    this.time.delayedCall(5000, () => {
      this.pathDebugGraphics?.destroy();
      this.pathDebugGraphics = undefined;
    });
  }

  async persistPlayerState(): Promise<void> {
    if (!this.userId || !this.player) return;
    await savePlayerState({
      user_id: this.userId,
      x: Math.round(this.player.sprite.x),
      y: Math.round(this.player.sprite.y),
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
