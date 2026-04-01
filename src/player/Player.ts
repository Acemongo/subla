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
// Kenney sprite dirs: 0=NW, 1=W, 2=SW, 3=S, 4=SE, 5=E, 6=NE, 7=N
function keysToDir(up: boolean, down: boolean, left: boolean, right: boolean): number {
  if (up    && !down  && !left  && !right) return 0; // NW
  if (right && !up    && !down  && !left)  return 6; // NE
  if (down  && !up    && !left  && !right) return 4; // SE
  if (left  && !up    && !down  && !right) return 2; // SW
  if (up    && right  && !down  && !left)  return 7; // N
  if (right && down   && !up    && !left)  return 5; // E
  if (down  && left   && !up    && !right) return 3; // S
  if (left  && up     && !down  && !right) return 1; // W
  return 0;
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
      this.currentDir = keysToDir(up, down, left, right);
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
