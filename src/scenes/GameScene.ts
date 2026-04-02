import Phaser from 'phaser';
import { Player } from '../player/Player';
import { WorldMap } from '../world/WorldMap';
import { savePlayerState, loadPlayerState, getCurrentUserId } from '../player/PlayerState';

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
  private userId: string | null = null;


  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.worldMap = new WorldMap(this);
    this.worldMap.createFromTiledJSON('level1');

    // Default spawn: center of map
    const spawnCenter = this.worldMap.gridToScreen(
      Math.floor(this.worldMap.mapCols / 2),
      Math.floor(this.worldMap.mapRows / 2)
    );

    // Spawn at default position immediately — async load will reposition if needed
    this.player = new Player(this, spawnCenter.x, spawnCenter.y);
    this.player.addWallCollider(this.worldMap.wallGroup);

    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(1);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.scene.launch('UIScene');

    // Ensure canvas is focusable and has focus for keyboard input
    const canvas = this.game.canvas;
    canvas.setAttribute('tabindex', '0');
    canvas.focus();

    // Reset all keys when canvas loses focus to prevent sticky keys
    canvas.addEventListener('blur', () => {
      this.input.keyboard?.resetKeys();
    });

    this.add
      .text(16, 16, '🗺 Subterranean Los Angeles', {
        fontSize: '18px',
        color: '#c0a0ff',
        backgroundColor: '#00000066',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0);

    this.add
      .text(16, 46, 'v0.1.0', {
        fontSize: '11px',
        color: '#8870cc',
        backgroundColor: '#00000066',
        padding: { x: 8, y: 3 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    // Async: load saved position in background, reposition if found
    this.loadSavedState();
  }

  private async loadSavedState(): Promise<void> {
    this.userId = await getCurrentUserId();
    if (!this.userId) return;

    const saved = await loadPlayerState(this.userId);
    if (saved && this.player) {
      this.player.sprite.setPosition(saved.x, saved.y);
      if (saved.gear) this.player.gear = saved.gear;
    }
  }

  update(_time: number, delta: number): void {
    if (!this.cursors || !this.player) return;

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
      gear: this.player.gear,
    });
  }
}
