import Phaser from 'phaser';
import type { EnemyDef, EnemyState } from './EnemyDef';
import { findPath } from '../world/Pathfinder';
import type { WorldMap } from '../world/WorldMap';

const WAYPOINT_DIST = 20;

export class Enemy {
  public sprite:   Phaser.Physics.Arcade.Image;
  public hp:       number;
  public maxHp:    number;
  public state:    EnemyState = 'idle';
  public def:      EnemyDef;
  public id:       string; // unique instance id

  private scene:   Phaser.Scene;
  private worldMap: WorldMap;
  private waypoints: { x: number; y: number }[] = [];
  private pathTimer  = 0;
  private readonly PATH_INTERVAL = 800; // re-path every 800ms
  private attackTimer = 0;

  // HP bar graphics
  private hpBarBg:   Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;

  // Current dir for animation
  private runFrame  = 0;
  private frameTimer = 0;
  private readonly FRAME_RATE = 120;
  private currentDir = 3; // S-facing by default

  constructor(
    scene: Phaser.Scene,
    worldMap: WorldMap,
    def: EnemyDef,
    x: number, y: number,
    instanceId: string,
  ) {
    this.scene    = scene;
    this.worldMap = worldMap;
    this.def      = def;
    this.id       = instanceId;
    this.hp       = def.hp;
    this.maxHp    = def.hp;

    // Sprite — use Male_3 (south-facing idle) tinted to enemy color
    this.sprite = scene.physics.add.image(x, y, `char_idle_3`);
    this.sprite.setOrigin(0.5, 0.85);
    this.sprite.setScale(def.scale);
    this.sprite.setTint(def.tint);
    this.sprite.setCollideWorldBounds(true);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(100, 60);
    body.setOffset(78, 410);

    // HP bar (2 stacked rectangles above sprite)
    this.hpBarBg   = scene.add.rectangle(x, y - 60, 50, 6, 0x440000).setDepth(9999);
    this.hpBarFill = scene.add.rectangle(x, y - 60, 50, 6, 0xff4444).setDepth(9999);
  }

  // ---------------------------------------------------------------------------
  // Update — called every frame from EnemyManager
  // ---------------------------------------------------------------------------

  update(
    delta: number,
    playerX: number, playerY: number,
    walkable: boolean[][],
    onAttackPlayer: (damage: number) => void,
  ): void {
    if (this.hp <= 0) return;

    const dist = this.distanceTo(playerX, playerY);
    const tileDist = dist / ((this.worldMap.renderer?.tileW ?? 256) * 0.5);

    // State transitions
    switch (this.state) {
      case 'idle':
        if (tileDist <= this.def.detectionRadius) {
          this.state = 'aware';
        }
        break;
      case 'aware':
        this.state = this.def.canMove ? 'pursue' : 'attack';
        break;
      case 'pursue':
        if (tileDist > this.def.detectionRadius * 1.5) {
          this.state = 'idle'; // lost player
          this.waypoints = [];
        } else if (tileDist <= this.def.attackRange) {
          this.state = 'attack';
          this.waypoints = [];
        } else {
          this.pursuePlayer(delta, playerX, playerY, walkable);
        }
        break;
      case 'attack':
        if (tileDist > this.def.attackRange * 1.5) {
          this.state = this.def.canMove ? 'pursue' : 'idle';
        } else {
          this.attackTimer += delta;
          if (this.attackTimer >= this.def.attackCooldown) {
            this.attackTimer = 0;
            onAttackPlayer(this.def.attackDamage);
          }
        }
        break;
    }

    this.updateAnimation(delta);
    this.updateHpBar();
    this.updateDepth();
  }

  // ---------------------------------------------------------------------------
  // Pathfinding pursuit
  // ---------------------------------------------------------------------------

  private pursuePlayer(
    delta: number,
    playerX: number, playerY: number,
    walkable: boolean[][],
  ): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    // Advance along existing path
    if (this.waypoints.length > 0) {
      const target = this.waypoints[0];
      const dx = target.x - this.sprite.x;
      const dy = target.y - this.sprite.y;
      const d  = Math.sqrt(dx * dx + dy * dy);

      if (d <= WAYPOINT_DIST) {
        this.waypoints.shift();
      } else {
        const vx = (dx / d) * this.def.speed;
        const vy = (dy / d) * this.def.speed;
        body.setVelocity(vx, vy);
        this.currentDir = this.velocityToDir(vx, vy);
        return;
      }
    }

    // Re-path periodically
    this.pathTimer += delta;
    if (this.pathTimer >= this.PATH_INTERVAL || this.waypoints.length === 0) {
      this.pathTimer = 0;
      this.repath(playerX, playerY, walkable);
    }

    if (this.waypoints.length === 0) {
      body.setVelocity(0, 0);
    }
  }

  private repath(playerX: number, playerY: number, walkable: boolean[][]): void {
    const from = this.worldMap.screenToGrid(this.sprite.x, this.sprite.y);
    const to   = this.worldMap.screenToGrid(playerX, playerY);
    if (!from || !to) return;

    const path = findPath(walkable, from, to);
    if (!path || path.length === 0) return;

    const tH = this.worldMap.renderer?.tileH ?? 128;
    this.waypoints = path.map(p => {
      const s = this.worldMap.gridToScreen(p.col, p.row);
      return { x: s.x, y: s.y + tH / 2 };
    });
  }

  // ---------------------------------------------------------------------------
  // Animation
  // ---------------------------------------------------------------------------

  private updateAnimation(delta: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const moving = this.state === 'pursue' &&
      (Math.abs(body.velocity.x) > 5 || Math.abs(body.velocity.y) > 5);

    if (!moving) {
      this.sprite.setTexture(`char_idle_${this.currentDir}`);
      this.runFrame = 0;
      return;
    }

    this.frameTimer += delta;
    if (this.frameTimer >= this.FRAME_RATE) {
      this.frameTimer = 0;
      this.runFrame = (this.runFrame + 1) % 10;
    }
    this.sprite.setTexture(`char_run_${this.currentDir}_${this.runFrame}`);
    this.sprite.setTint(this.def.tint);
  }

  private velocityToDir(vx: number, vy: number): number {
    const dots = {
      up:    vx * -1 + vy * -0.5,
      down:  vx *  1 + vy *  0.5,
      left:  vx * -1 + vy *  0.5,
      right: vx *  1 + vy * -0.5,
    };
    const t = 0.1;
    const up    = dots.up    > t;
    const down  = dots.down  > t;
    const left  = dots.left  > t;
    const right = dots.right > t;
    if (up    && !down  && !left  && !right) return 6;
    if (right && !up    && !down  && !left)  return 0;
    if (down  && !up    && !left  && !right) return 2;
    if (left  && !up    && !down  && !right) return 4;
    if (up    && right)                      return 7;
    if (right && down)                       return 1;
    if (down  && left)                       return 3;
    if (left  && up)                         return 5;
    return 3;
  }

  // ---------------------------------------------------------------------------
  // HP bar & depth
  // ---------------------------------------------------------------------------

  private updateHpBar(): void {
    const sx = this.sprite.x;
    const sy = this.sprite.y - 70;
    const pct = Math.max(0, this.hp / this.maxHp);
    const W = 50;

    this.hpBarBg.setPosition(sx, sy);
    this.hpBarFill.setPosition(sx - (W * (1 - pct)) / 2, sy);
    this.hpBarFill.setSize(W * pct, 6);
  }

  private updateDepth(): void {
    const tH = this.worldMap.renderer?.tileH ?? 128;
    const offsetY = this.worldMap.offsetY;
    const isoSum = (this.sprite.y - offsetY + tH) / (tH / 2);
    this.sprite.setDepth(isoSum * 100 + 50);
  }

  // ---------------------------------------------------------------------------
  // Damage & death
  // ---------------------------------------------------------------------------

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    // Flash white briefly
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(120, () => {
      if (this.hp > 0) this.sprite.setTint(this.def.tint);
    });
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleX: 0,
      scaleY: 0,
      duration: 300,
      onComplete: () => this.destroy(),
    });
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
  }

  destroy(): void {
    this.sprite.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private distanceTo(x: number, y: number): number {
    const dx = this.sprite.x - x;
    const dy = this.sprite.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  get isAlive(): boolean { return this.hp > 0; }
}
