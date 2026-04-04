import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { ENEMY_DEFS } from './EnemyDef';
import type { WorldMap } from '../world/WorldMap';

export interface EnemySpawn {
  enemyId: string;  // key in ENEMY_DEFS
  col:     number;
  row:     number;
}

export class EnemyManager {
  private scene:    Phaser.Scene;
  private worldMap: WorldMap;
  private enemies:  Enemy[] = [];
  private nextId =  0;

  constructor(scene: Phaser.Scene, worldMap: WorldMap) {
    this.scene    = scene;
    this.worldMap = worldMap;
  }

  /** Spawn enemies from a list of grid positions */
  spawnAll(spawns: EnemySpawn[]): void {
    for (const s of spawns) {
      const def = ENEMY_DEFS[s.enemyId];
      if (!def) { console.warn(`Unknown enemy: ${s.enemyId}`); continue; }
      const pos = this.worldMap.gridToScreen(s.col, s.row);
      const tH  = this.worldMap.renderer?.tileH ?? 128;
      const enemy = new Enemy(
        this.scene,
        this.worldMap,
        def,
        pos.x,
        pos.y + tH / 2,
        `enemy_${this.nextId++}`,
      );
      this.enemies.push(enemy);
    }
  }

  /** Add wall colliders for all enemy sprites */
  addWallColliders(wallGroup: Phaser.Physics.Arcade.StaticGroup): void {
    for (const e of this.enemies) {
      this.scene.physics.add.collider(e.sprite, wallGroup);
    }
  }

  /** Update all enemies each frame */
  update(
    delta: number,
    playerX: number,
    playerY: number,
    onPlayerDamage: (damage: number) => void,
  ): void {
    const walkable = this.worldMap.walkable;
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      enemy.update(delta, playerX, playerY, walkable, onPlayerDamage);
    }
    // Clean up dead enemies
    this.enemies = this.enemies.filter(e => e.isAlive);
  }

  /** Get the closest living enemy within range of a point */
  getEnemyInRange(x: number, y: number, rangePx: number): Enemy | null {
    let closest: Enemy | null = null;
    let closestDist = Infinity;
    for (const e of this.enemies) {
      if (!e.isAlive) continue;
      const dx = e.sprite.x - x;
      const dy = e.sprite.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= rangePx && d < closestDist) {
        closestDist = d;
        closest = e;
      }
    }
    return closest;
  }

  get count(): number { return this.enemies.filter(e => e.isAlive).length; }
}
