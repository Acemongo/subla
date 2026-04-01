import Phaser from 'phaser';

const SPEED = 200;

// Isometric movement vectors
// Up/W   → 315° NW → up-left on screen
// Down/S → 135° SE → down-right on screen
// Left/A → 225° SW → down-left on screen
// Right/D→  45° NE → up-right on screen
const ISO = {
  up:    { x: -1, y: -0.5 },
  down:  { x:  1, y:  0.5 },
  left:  { x: -1, y:  0.5 },
  right: { x:  1, y: -0.5 },
};

// Kenney sprite directions (confirmed by visual inspection):
// 0=NW, 1=W, 2=SW, 3=S, 4=SE, 5=E, 6=NE, 7=N
//
// In isometric space, WASD maps to screen-space diagonals:
//   W = north iso  → screen up-right   = NE sprite (6)
//   S = south iso  → screen down-left  = SW sprite (2)
//   A = west iso   → screen up-left    = NW sprite (0)
//   D = east iso   → screen down-right = SE sprite (4)
//   W+D            → screen right      = E sprite  (5)
//   W+A            → screen up         = N sprite  (7)
//   S+D            → screen down       = S sprite  (3)
//   S+A            → screen left       = W sprite  (1)
function velocityToDir(vx: number, vy: number): number {
  // atan2 returns angle from positive X axis, counterclockwise
  // We remap to clockwise from right (East)
  const angle = Math.atan2(vy, vx) * (180 / Math.PI);
  const a = (angle + 360) % 360;

  // 8 sectors of 45° each, starting from East (0°) going clockwise:
  // 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
  const sector = Math.round(a / 45) % 8;

  // Map sector → Kenney sprite direction index
  // Kenney: 0=NW, 1=W, 2=SW, 3=S, 4=SE, 5=E, 6=NE, 7=N
  // sector:  0=E→5, 1=SE→4, 2=S→3, 3=SW→2, 4=W→1, 5=NW→0, 6=N→7, 7=NE→6
  const sectorToDir = [5, 4, 3, 2, 1, 0, 7, 6];
  return sectorToDir[sector];
}

export class Player {
  public sprite: Phaser.Physics.Arcade.Image;
  private scene: Phaser.Scene;
  private currentDir = 0;
  private runFrame = 0;
  private frameTimer = 0;
  private readonly FRAME_RATE = 120; // ms per frame — tuned to match movement speed
  private moving = false;

  public gear: Record<string, string | null> = {
    helmet: null, suit: null, boots: null, tool: null, weapon: null,
  };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // Use physics image so we can set immovable collider bodies on walls
    this.sprite = scene.physics.add.image(x, y, 'char_idle_0');
    this.sprite.setOrigin(0.5, 0.85); // feet near bottom-center
    this.sprite.setScale(0.55);       // match dungeon tile scale
    this.sprite.setCollideWorldBounds(true);

    // Small physics body centered at feet
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(60, 40);
    body.setOffset(98, 420);
  }

  addWallCollider(wallGroup: Phaser.Physics.Arcade.StaticGroup): void {
    this.scene.physics.add.collider(this.sprite, wallGroup);
  }

  updateDepth(_offsetX: number, offsetY: number, tileH = 256): void {
    const halfH = tileH / 2;
    const feetY = this.sprite.y;
    const depth = (feetY - offsetY + tileH) / halfH + 0.5;
    this.sprite.setDepth(depth);
  }

  move(up: boolean, down: boolean, left: boolean, right: boolean, delta: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    let vx = 0, vy = 0;
    if (up)    { vx += ISO.up.x;    vy += ISO.up.y;    }
    if (down)  { vx += ISO.down.x;  vy += ISO.down.y;  }
    if (left)  { vx += ISO.left.x;  vy += ISO.left.y;  }
    if (right) { vx += ISO.right.x; vy += ISO.right.y; }

    const len = Math.sqrt(vx * vx + vy * vy);
    this.moving = len > 0;

    if (this.moving) {
      vx = (vx / len) * SPEED;
      vy = (vy / len) * SPEED;
      this.currentDir = velocityToDir(vx, vy);
    }

    body.setVelocity(vx, vy);
    this.updateAnimation(delta);
  }

  private updateAnimation(delta: number): void {
    if (!this.moving) {
      this.sprite.setTexture(`char_idle_${this.currentDir}`);
      this.runFrame = 0;
      this.frameTimer = 0;
      return;
    }

    this.frameTimer += delta;
    if (this.frameTimer >= this.FRAME_RATE) {
      this.frameTimer = 0;
      this.runFrame = (this.runFrame + 1) % 10;
    }

    this.sprite.setTexture(`char_run_${this.currentDir}_${this.runFrame}`);
  }
}
