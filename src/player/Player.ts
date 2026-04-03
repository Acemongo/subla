import Phaser from 'phaser';

const SPEED = 200;
const WAYPOINT_REACH_DIST = 20; // pixels — how close counts as "arrived"

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
// Sprite indices confirmed by visual inspection:
// Male_0 = up-left (315°)   Male_1 = left (270°)
// Male_2 = down-left (225°) Male_3 = down (180°)
// Male_4 = down-right (135°)Male_5 = right (90°)
// Male_6 = up-right (45°)   Male_7 = up (0°)
//
// Key → heading → sprite (confirmed by visual inspection on localhost):
//   Up(W)    = up-right  = Male_6
//   Right(D) = up-left   = Male_0
//   Down(S)  = down-left = Male_2
//   Left(A)  = down-right= Male_4
//   W+D      = up        = Male_7
//   D+S      = left      = Male_1
//   S+A      = down      = Male_3
//   A+W      = right     = Male_5
/** Convert screen-space velocity to Kenney sprite direction index.
 *  Uses the same mapping as keysToDir by converting velocity → iso keys. */
function velocityToDir(vx: number, vy: number): number {
  // ISO movement vectors (same as const ISO above):
  // up:    vx=-1, vy=-0.5  → dir 6
  // down:  vx=+1, vy=+0.5  → dir 2
  // left:  vx=-1, vy=+0.5  → dir 4
  // right: vx=+1, vy=-0.5  → dir 0
  // Use dot products against each iso axis to determine dominant direction
  const dots = {
    up:    vx * -1 + vy * -0.5,
    down:  vx *  1 + vy *  0.5,
    left:  vx * -1 + vy *  0.5,
    right: vx *  1 + vy * -0.5,
  };
  const threshold = 0.1;
  const up    = dots.up    > threshold;
  const down  = dots.down  > threshold;
  const left  = dots.left  > threshold;
  const right = dots.right > threshold;
  return keysToDir(up, down, left, right);
}

function keysToDir(up: boolean, down: boolean, left: boolean, right: boolean): number {
  if (up    && !down  && !left  && !right) return 6;
  if (right && !up    && !down  && !left)  return 0;
  if (down  && !up    && !left  && !right) return 2;
  if (left  && !up    && !down  && !right) return 4;
  if (up    && right)                      return 7;
  if (right && down)                       return 1;
  if (down  && left)                       return 3;
  if (left  && up)                         return 5;
  return 0;
}

export class Player {
  public sprite: Phaser.Physics.Arcade.Image;
  private scene: Phaser.Scene;
  public currentDir = 0;
  private runFrame = 0;
  private frameTimer = 0;
  private readonly FRAME_RATE = 120;
  private moving = false;

  // Path following
  private waypoints: { x: number; y: number }[] = [];
  public onPathComplete?: () => void;

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

    // Physics body at feet — sized to match the iso tile footprint
    // Sprite is 256x512 at scale 0.55. Origin (0.5, 0.85) means feet are near bottom.
    // Body is in unscaled sprite coords: center horizontally, place near feet.
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(100, 60);   // wide enough to feel solid, thin vertical for iso
    body.setOffset(78, 410); // center x=(256-100)/2=78, y near feet
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

  /** Set a new path (screen-space waypoints). Cancels any current path. */
  setPath(waypoints: { x: number; y: number }[]): void {
    this.waypoints = [...waypoints];
  }

  /** Cancel current path navigation */
  clearPath(): void {
    this.waypoints = [];
  }

  get isFollowingPath(): boolean {
    return this.waypoints.length > 0;
  }

  move(up: boolean, down: boolean, left: boolean, right: boolean, delta: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const hasKeys = up || down || left || right;

    // Keyboard input cancels path navigation
    if (hasKeys) this.waypoints = [];

    // Path following — takes over if no keyboard input
    if (!hasKeys && this.waypoints.length > 0) {
      const target = this.waypoints[0];
      const dx = target.x - this.sprite.x;
      const dy = target.y - this.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= WAYPOINT_REACH_DIST) {
        this.waypoints.shift();
        if (this.waypoints.length === 0) {
          body.setVelocity(0, 0);
          this.moving = false;
          this.updateAnimation(delta);
          this.onPathComplete?.();
          return;
        }
      } else {
        const vx = (dx / dist) * SPEED;
        const vy = (dy / dist) * SPEED;
        body.setVelocity(vx, vy);
        this.moving = true;
        this.currentDir = velocityToDir(vx, vy);
        this.updateAnimation(delta);
        return;
      }
    }

    // Keyboard movement
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
