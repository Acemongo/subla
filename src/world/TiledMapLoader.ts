import type { TileDef } from './IsoRenderer';

interface TiledTile {
  id: number;
  image: string;
  imagewidth: number;
  imageheight: number;
}

interface TiledTileset {
  firstgid: number;
  name: string;
  tilecount: number;
  tiles: TiledTile[];
}

interface TiledLayer {
  name: string;
  type: string;
  data: number[];
  width: number;
  height: number;
}

interface TiledMap {
  width: number;
  height: number;
  tilesets: TiledTileset[];
  layers: TiledLayer[];
}

export interface LoadedMap {
  grid: (TileDef | null)[][];
  width: number;
  height: number;
  tileW: number;   // tile diamond width in pixels
  tileH: number;   // tile diamond height in pixels (half of tileW for 2:1 iso)
  textureKeys: string[];
  tileImages: Map<string, string>;
}

export function parseTiledMap(mapData: TiledMap): LoadedMap {
  const tileset = mapData.tilesets[0];
  const firstgid = tileset.firstgid;

  // Build GID → texture key + image path map
  const gidToKey = new Map<number, string>();
  const tileImages = new Map<string, string>();

  for (const tile of tileset.tiles) {
    const gid = tile.id + firstgid;
    // e.g. "../tilesets/kenney_miniature_dungeon/Isometric/dirtTiles_W.png"
    // → key: "dirtTiles_W"
    // → path: "assets/tilesets/kenney_miniature_dungeon/Isometric/dirtTiles_W.png"
    const filename = tile.image.split('/').pop()!;
    const key = filename.replace('.png', '');
    // Normalize path: strip leading ../ and resolve to assets/
    const imagePath = tile.image.replace(/^(\.\.\/)+/, 'assets/');
    gidToKey.set(gid, key);
    tileImages.set(key, imagePath);
  }

  const tileLayers = mapData.layers.filter(l => l.type === 'tilelayer');
  if (!tileLayers.length) throw new Error('No tile layer found in map');

  const { width, height } = mapData;

  // Build a merged grid — later layers draw on top of earlier ones
  const grid: (TileDef | null)[][] = Array.from({ length: height }, () =>
    new Array(width).fill(null)
  );

  for (const layer of tileLayers) {
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const gid = layer.data[row * width + col];
        if (!gid || gid === 0) continue;
        const key = gidToKey.get(gid);
        if (key) {
          const solid = /wall|stoneWall|stone_W|stoneColumn|structure|^lot[NESW]/i.test(key);
          grid[row][col] = { key, solid };
        }
      }
    }
  }

  const textureKeys = Array.from(tileImages.keys());
  // tileW/tileH from the tileset definition — these are the grid spacing values
  const tileW = (tileset as unknown as Record<string, number>)['tilewidth'] ?? 256;
  const tileH = Math.round(tileW / 2); // enforce 2:1 iso ratio for grid spacing
  return { grid, width, height, tileW, tileH, textureKeys, tileImages };
}
