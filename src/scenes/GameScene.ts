import Phaser from 'phaser';
import { Player } from '../player/Player';
import { WorldMap } from '../world/WorldMap';
import { savePlayerState, loadPlayerState, loadCharacter, getCurrentUserId } from '../player/PlayerState';
import { Inventory } from '../inventory/Inventory';
import { Inventory as InventoryClass } from '../inventory/Inventory';
import { InventoryUI } from '../inventory/InventoryUI';

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

    this.scene.launch('UIScene');

    this.game.canvas.setAttribute('tabindex', '0');
    this.game.canvas.focus();
    this.input.keyboard!.resetKeys();
    this.time.delayedCall(100, () => this.input.keyboard?.resetKeys());

    this.add.text(16, 16, '🗺 Subterranean Los Angeles', {
      fontSize: '18px', color: '#c0a0ff',
      backgroundColor: '#00000066', padding: { x: 8, y: 4 },
    }).setScrollFactor(0);

    this.add.text(16, 46, 'v0.1.3', {
      fontSize: '11px', color: '#e0d0ff',
      backgroundColor: '#00000066', padding: { x: 8, y: 3 },
    }).setScrollFactor(0).setDepth(100);

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
