import Phaser from 'phaser';

// Default tile size constants — Kenney dungeon tiles
export const TILE_W = 256;
export const TILE_H = 128;

// Convert grid (col, row) to screen (x, y) using given tile dimensions
export function isoToScreen(
  col: number,
  row: number,
  tileW = TILE_W,
  tileH = TILE_H
): { x: number; y: number } {
  return {
    x: (col - row) * (tileW / 2),
    y: (col + row) * (tileH / 2),
  };
}

export interface TileDef {
  key: string;    // Phaser texture key
  solid?: boolean; // blocks movement
}

export class IsoRenderer {
  private scene: Phaser.Scene;
  private sprites: Phaser.GameObjects.Image[] = [];
  public tileW: number;
  public tileH: number; // height of the diamond face only (not full image)

  constructor(scene: Phaser.Scene, tileW = TILE_W, tileH = TILE_H) {
    this.scene = scene;
    this.tileW = tileW;
    this.tileH = tileH;
  }

  renderMap(map: (TileDef | null)[][], offsetX = 0, offsetY = 0): void {
    const rows = map.length;
    const cols = map[0].length;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tile = map[row][col];
        if (!tile) continue;

        const { x, y } = isoToScreen(col, row, this.tileW, this.tileH);
        const img = this.scene.add.image(x + offsetX, y + offsetY, tile.key);
        img.setOrigin(0.5, 1); // anchor bottom-center
        // Depth: iso painter's order — higher row+col = drawn later (on top)
        // Multiply row to ensure strict ordering across diagonals
        img.setDepth((row + col) * 100 + col);
        this.sprites.push(img);
      }
    }
  }

  getMapPixelSize(cols: number, rows: number): { width: number; height: number } {
    return {
      width: (cols + rows) * (this.tileW / 2),
      height: (cols + rows) * (this.tileH / 2),
    };
  }

  destroy(): void {
    this.sprites.forEach(s => s.destroy());
    this.sprites = [];
  }
}
