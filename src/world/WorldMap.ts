import Phaser from 'phaser';
import type { TileDef } from './IsoRenderer';
import { IsoRenderer, TILE_H, isoToScreen } from './IsoRenderer';

import { parseTiledMap } from './TiledMapLoader';
import type { LoadedMap } from './TiledMapLoader';

export class WorldMap {
  private scene: Phaser.Scene;
  public renderer?: IsoRenderer;
  public mapCols: number = 15;
  public mapRows: number = 13;
  public offsetX: number = 0;
  public offsetY: number = 0;
  public wallGroup!: Phaser.Physics.Arcade.StaticGroup;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.wallGroup = scene.physics.add.staticGroup();
  }

  // Load from a Tiled JSON map (preloaded via BootScene as 'mapKey')
  createFromTiledJSON(mapKey: string): void {
    const raw = this.scene.cache.json.get(mapKey);
    if (!raw) {
      console.error(`Map '${mapKey}' not found in cache — falling back to placeholder`);
      this.createPlaceholderWorld();
      return;
    }

    // Resolve any external tileset sources from cache
    for (let i = 0; i < (raw.tilesets ?? []).length; i++) {
      const ts = raw.tilesets[i];
      if (ts.source) {
        // Try cache key based on filename without extension
        const cacheKey = ts.source.replace(/\.tsj$/, '').split('/').pop() + '-tsj';
        const tsData = this.scene.cache.json.get(cacheKey);
        if (tsData) {
          raw.tilesets[i] = { ...tsData, firstgid: ts.firstgid };
        } else {
          console.warn(`Tileset '${ts.source}' not in cache (key: ${cacheKey})`);
        }
      }
    }

    let loaded: LoadedMap;
    try {
      loaded = parseTiledMap(raw);
    } catch (e) {
      console.error('Failed to parse Tiled map:', e);
      this.createPlaceholderWorld();
      return;
    }

    this.mapCols = loaded.width;
    this.mapRows = loaded.height;
    this.renderer = new IsoRenderer(this.scene, loaded.tileW, loaded.tileH);

    const size = this.renderer.getMapPixelSize(this.mapCols, this.mapRows);
    this.offsetX = size.width / 2;
    this.offsetY = loaded.tileH * 2;

    this.renderer.renderMap(loaded.grid, this.offsetX, this.offsetY);

    // Build wall collision bodies for solid tiles.
    // IsoRenderer anchors all tile sprites at bottom-center (origin 0.5, 1).
    // isoToScreen returns the top-left of the iso diamond in grid space.
    // The rendered sprite bottom = y + offsetY (where the diamond base sits).
    // We place colliders at the diamond base center, sized to the diamond footprint.
    const tileW = loaded.tileW;
    const tileH = loaded.tileH;
    const bodyW = tileW * 0.85;  // slightly inside the diamond width
    const bodyH = tileH * 0.55;  // iso diamond height

    for (let row = 0; row < loaded.height; row++) {
      for (let col = 0; col < loaded.width; col++) {
        const tile = loaded.grid[row][col];
        // Block walls AND empty/void tiles (null = no tile = void)
        if (tile !== null && !tile.solid) continue;
        const { x, y } = isoToScreen(col, row, tileW, tileH);
        const wx = x + this.offsetX;
        // Diamond base is at bottom of image (origin 1) = y + offsetY
        // Center the body on the diamond: shift up by half the diamond height
        const wy = y + this.offsetY - tileH * 0.25;
        const body = this.scene.add.rectangle(wx, wy, bodyW, bodyH, 0xff0000, 0);
        this.scene.physics.add.existing(body, true);
        this.wallGroup.add(body);
      }
    }

    this.scene.physics.world.setBounds(0, 0, size.width + this.offsetX, size.height + this.offsetY * 2);
    this.scene.cameras.main.setBounds(0, 0, size.width + this.offsetX, size.height + this.offsetY * 2);
  }

  // Legacy: load from hardcoded grid
  createFromGrid(grid: (TileDef | null)[][]): void {
    this.mapCols = grid[0].length;
    this.mapRows = grid.length;
    this.renderer = new IsoRenderer(this.scene);

    const size = this.renderer.getMapPixelSize(this.mapCols, this.mapRows);
    this.offsetX = size.width / 2;
    this.offsetY = TILE_H * 2;

    this.renderer.renderMap(grid, this.offsetX, this.offsetY);

    this.scene.physics.world.setBounds(0, 0, size.width + this.offsetX, size.height + this.offsetY * 2);
    this.scene.cameras.main.setBounds(0, 0, size.width + this.offsetX, size.height + this.offsetY * 2);
  }

  gridToScreen(col: number, row: number): { x: number; y: number } {
    const tileW = this.renderer?.tileW ?? 256;
    const tileH = this.renderer?.tileH ?? TILE_H;
    const iso = isoToScreen(col, row, tileW, tileH);
    return {
      x: iso.x + this.offsetX,
      y: iso.y + this.offsetY - tileH,
    };
  }

  createPlaceholderWorld(): void {
    const cols = 40;
    const rows = 30;
    const tileW = 64;
    const tileH = 64;
    const colors = [0x1a0a3e, 0x220d4a, 0x180838, 0x2a1050];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * tileW;
        const y = row * tileH;
        const color = colors[(row + col) % colors.length];
        const tile = this.scene.add.rectangle(x + tileW / 2, y + tileH / 2, tileW - 1, tileH - 1, color);
        tile.setDepth(-1);
        if (Math.random() < 0.05) {
          this.scene.add.circle(x + tileW / 2, y + tileH / 2, 10, 0x554466).setDepth(0);
        }
      }
    }

    this.scene.physics.world.setBounds(0, 0, cols * tileW, rows * tileH);
    this.scene.cameras.main.setBounds(0, 0, cols * tileW, rows * tileH);
  }
}
