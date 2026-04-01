#!/usr/bin/env node
/**
 * generate-map.js — AI-powered map generator for subla
 *
 * Usage:
 *   node tools/generate-map.js --input ./ref.jpg --output ./public/assets/tilemaps/level2.json
 *   node tools/generate-map.js --input ./ref.jpg --output ./out.json --width 30 --height 25 --preview
 *   node tools/generate-map.js --input ./ref.jpg --output ./out.json --tileset ./tools/kenney-manifest.json
 *
 * Requires: ANTHROPIC_API_KEY env var (or --api-key)
 */

import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CLI args ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    input: null,
    output: null,
    width: 20,
    height: 20,
    tileset: path.join(__dirname, 'kenney-manifest.json'),
    apiKey: process.env.ANTHROPIC_API_KEY || null,
    preview: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':    opts.input    = args[++i]; break;
      case '--output':   opts.output   = args[++i]; break;
      case '--width':    opts.width    = parseInt(args[++i]); break;
      case '--height':   opts.height   = parseInt(args[++i]); break;
      case '--tileset': {
        const v = args[++i];
        // Allow shorthand aliases
        if (v === 'roads' || v === 'road')   opts.tileset = path.join(__dirname, 'roads-manifest.json');
        else if (v === 'dungeon')            opts.tileset = path.join(__dirname, 'kenney-manifest.json');
        else                                 opts.tileset = v;
        break;
      }
      case '--api-key':  opts.apiKey   = args[++i]; break;
      case '--preview':  opts.preview  = true; break;
      case '--verbose':  opts.verbose  = true; break;
      case '--help':
        console.log(`
Usage: node tools/generate-map.js [options]

Options:
  --input <path>      Input image (jpg, png, gif, webp) [required]
  --output <path>     Output Tiled JSON map file [required]
  --width <n>         Map width in tiles (default: 20)
  --height <n>        Map height in tiles (default: 20)
  --tileset <path>    Tileset manifest JSON (default: kenney-manifest.json)
  --api-key <key>     Anthropic API key (or set ANTHROPIC_API_KEY)
  --preview           Save a color-coded PNG preview alongside the output
  --verbose           Print ASCII grid to console
  --help              Show this help
`);
        process.exit(0);
    }
  }

  if (!opts.input)  { console.error('Error: --input is required'); process.exit(1); }
  if (!opts.output) { console.error('Error: --output is required'); process.exit(1); }
  if (!opts.apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set. Use --api-key or set the env var.');
    process.exit(1);
  }

  return opts;
}

// ─── Image prep — auto-resize to fit Claude's 5MB limit ──────────────────────

async function prepareImage(inputPath) {
  const MAX_BYTES = 4 * 1024 * 1024; // 4MB target (safe margin under 5MB)
  const MAX_DIM = 1200;

  const info = await sharp(inputPath).metadata();
  const fileSize = fs.statSync(inputPath).size;

  let pipeline = sharp(inputPath);

  // Resize if too large in pixels
  if (info.width > MAX_DIM || info.height > MAX_DIM) {
    pipeline = pipeline.resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true });
  }

  // Convert to JPEG for compression if still too big or if PNG
  const needsCompress = fileSize > MAX_BYTES || info.format === 'png';
  if (needsCompress) {
    pipeline = pipeline.jpeg({ quality: 85 });
  }

  const buf = await pipeline.toBuffer({ resolveWithObject: true });

  // If still too big, reduce quality further
  if (buf.info.size > MAX_BYTES) {
    const buf2 = await sharp(inputPath)
      .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 65 })
      .toBuffer();
    return { buffer: buf2, mediaType: 'image/jpeg' };
  }

  const mediaType = needsCompress ? 'image/jpeg' : `image/${info.format}`;
  return { buffer: buf.data, mediaType };
}

// ─── Primitives ──────────────────────────────────────────────────────────────

const VALID_PRIMITIVES = [
  'floor', 'ground', 'path', 'stair', 'wall', 'water', 'tree', 'plant', 'structure', 'void'
];

// ─── Vision API ──────────────────────────────────────────────────────────────

async function analyzeImage(imageBuffer, mediaType, width, height, apiKey, verbose) {
  const client = new Anthropic({ apiKey });
  const base64 = imageBuffer.toString('base64');

  const prompt = `You are analyzing an image to generate a tile map for a top-down adventure game.

Divide the image into a grid of exactly ${width} columns × ${height} rows.
Classify each cell using ONLY these primitives:

- floor     → indoor floor, stone, pavement, hard surface
- ground    → open outdoor ground, grass, dirt, sand, field
- path      → roads, paths, trails, corridors, walkways
- stair     → stairs, steps, ramps, elevation changes
- wall      → walls, fences, cliffs, solid barriers
- water     → water, rivers, lakes, pools
- tree      → trees, large vegetation, forest
- plant     → bushes, shrubs, small plants
- structure → buildings, large structures, bridges, rooftops
- void      → outside the playable area, sky, empty space

Rules:
- Traversable (player can walk): floor, ground, path, stair, water
- Blocking: wall, tree, plant, structure, void
- When ambiguous — if a human could walk there, use floor/ground/path

Return ONLY a JSON object, no prose, no markdown fences:
{
  "grid": [
    ["prim","prim",...],
    ...
  ],
  "notes": "one line description of what you saw"
}

The grid must have exactly ${height} rows and exactly ${width} columns per row.`;

  if (verbose) console.log(`[vision] Sending ${width}×${height} grid request to Claude...`);

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: prompt }
      ]
    }]
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  if (verbose) console.log('[vision] Raw response:\n', raw.slice(0, 500) + '...');

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Vision API did not return valid JSON:\n' + raw);

  return JSON.parse(jsonMatch[0]);
}

// ─── Grid validation ──────────────────────────────────────────────────────────

function validateGrid(grid, width, height) {
  const cleaned = [];
  for (let r = 0; r < height; r++) {
    const row = grid[r] || [];
    const cleanRow = [];
    for (let c = 0; c < width; c++) {
      const cell = (row[c] || 'void').toLowerCase().trim();
      cleanRow.push(VALID_PRIMITIVES.includes(cell) ? cell : 'void');
    }
    cleaned.push(cleanRow);
  }
  return cleaned;
}

// ─── Wall auto-refinement ─────────────────────────────────────────────────────

function refineWalls(grid, height, width) {
  const isWall = (r, c) => {
    if (r < 0 || r >= height || c < 0 || c >= width) return true;
    return ['wall', 'structure'].includes(grid[r][c]);
  };

  const out = grid.map(row => [...row]);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] !== 'wall') continue;

      const n = isWall(r-1, c), s = isWall(r+1, c);
      const e = isWall(r, c+1), w = isWall(r, c-1);
      const openN = !n, openS = !s, openE = !e, openW = !w;

      if (openN && openW && !openS && !openE) { out[r][c] = 'corner_nw'; continue; }
      if (openN && openE && !openS && !openW) { out[r][c] = 'corner_ne'; continue; }
      if (openS && openW && !openN && !openE) { out[r][c] = 'corner_sw'; continue; }
      if (openS && openE && !openN && !openW) { out[r][c] = 'corner_se'; continue; }
      if (openW)  { out[r][c] = 'wall_w'; continue; }
      if (openE)  { out[r][c] = 'wall_e'; continue; }
      if (openN)  { out[r][c] = 'wall_n'; continue; }
      if (openS)  { out[r][c] = 'wall_s'; continue; }
      out[r][c] = 'wall_w';
    }
  }
  return out;
}

// ─── Preview PNG ──────────────────────────────────────────────────────────────

const PREVIEW_COLORS = {
  floor:      [180, 160, 120],
  ground:     [100, 160,  80],
  path:       [210, 190, 140],
  stair:      [200, 150,  80],
  wall_w:     [ 80,  80,  80],
  wall_n:     [ 80,  80,  80],
  wall_e:     [ 80,  80,  80],
  wall_s:     [ 80,  80,  80],
  wall:       [ 80,  80,  80],
  corner_nw:  [ 60,  60,  60],
  corner_ne:  [ 60,  60,  60],
  corner_sw:  [ 60,  60,  60],
  corner_se:  [ 60,  60,  60],
  water:      [ 60, 120, 200],
  tree:       [ 30, 100,  40],
  plant:      [ 60, 140,  60],
  structure:  [120, 100, 100],
  void:       [ 20,  20,  30],
};

async function savePreview(grid, width, height, outputPath) {
  const CELL = 16; // pixels per cell
  const imgWidth = width * CELL;
  const imgHeight = height * CELL;

  const pixels = Buffer.alloc(imgWidth * imgHeight * 3);

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const prim = grid[r][c] || 'void';
      const [R, G, B] = PREVIEW_COLORS[prim] || [255, 0, 255];
      for (let py = 0; py < CELL; py++) {
        for (let px = 0; px < CELL; px++) {
          const i = ((r * CELL + py) * imgWidth + (c * CELL + px)) * 3;
          // Add 1px border
          const border = px === 0 || py === 0;
          pixels[i]   = border ? Math.max(0, R - 30) : R;
          pixels[i+1] = border ? Math.max(0, G - 30) : G;
          pixels[i+2] = border ? Math.max(0, B - 30) : B;
        }
      }
    }
  }

  const previewPath = outputPath.replace(/\.json$/, '-preview.png');
  await sharp(pixels, { raw: { width: imgWidth, height: imgHeight, channels: 3 } })
    .png()
    .toFile(previewPath);

  return previewPath;
}

// ─── Tiled JSON builder ───────────────────────────────────────────────────────

function buildTiledJSON(grid, width, height, manifest) {
  const prims = manifest.primitives;

  const data = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const prim = grid[r][c];
      const entry = prims[prim];
      // id in manifest is 0-based; Tiled GID is firstgid(1) + id
      data.push(entry && entry.id !== null ? entry.id + 1 : 0);
    }
  }

  const tsjPath = path.resolve(__dirname, '..', manifest.tilesetSource.replace('../', ''));
  const tsj = JSON.parse(fs.readFileSync(tsjPath, 'utf8'));

  return {
    height, width,
    infinite: false,
    orientation: 'isometric',
    renderorder: 'right-down',
    tileheight: tsj.tileheight,
    tilewidth: tsj.tilewidth,
    type: 'map',
    version: '1.10',
    tiledversion: '1.12.1',
    nextlayerid: 2,
    nextobjectid: 1,
    layers: [{
      id: 1,
      name: 'base',
      type: 'tilelayer',
      width, height,
      x: 0, y: 0,
      opacity: 1,
      visible: true,
      data,
    }],
    tilesets: [{ firstgid: 1, ...tsj }]
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  const manifestPath = path.resolve(opts.tileset);
  if (!fs.existsSync(manifestPath)) {
    console.error(`Tileset manifest not found: ${manifestPath}`); process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`✓ Tileset manifest: ${manifest.name}`);

  const inputPath = path.resolve(opts.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`Input image not found: ${inputPath}`); process.exit(1);
  }
  console.log(`✓ Input:  ${inputPath}`);
  console.log(`✓ Output: ${path.resolve(opts.output)}`);
  console.log(`✓ Size:   ${opts.width}×${opts.height} tiles`);
  console.log('');

  // Auto-resize/compress image
  process.stdout.write('Preparing image... ');
  const { buffer, mediaType } = await prepareImage(inputPath);
  console.log(`${(buffer.length / 1024).toFixed(0)}KB (${mediaType})`);

  // Analyze with Claude
  console.log('Analyzing with Claude vision...');
  const result = await analyzeImage(buffer, mediaType, opts.width, opts.height, opts.apiKey, opts.verbose);
  console.log(`✓ Analysis complete`);
  if (result.notes) console.log(`  "${result.notes}"`);

  // Validate + refine
  let grid = validateGrid(result.grid, opts.width, opts.height);
  grid = refineWalls(grid, opts.height, opts.width);

  // ASCII preview
  if (opts.verbose) {
    const sym = { floor:'·', ground:'·', path:'─', stair:'S', wall_w:'█', wall_n:'▀', wall_e:'▐', wall_s:'▄', corner_nw:'┌', corner_ne:'┐', corner_sw:'└', corner_se:'┘', water:'~', tree:'T', plant:'p', structure:'▪', void:' ' };
    console.log('\nGrid:');
    grid.forEach(row => console.log(row.map(c => sym[c] || '?').join('')));
  }

  // Stats
  const counts = {};
  grid.flat().forEach(p => { counts[p] = (counts[p] || 0) + 1; });
  console.log('\nTile distribution:');
  Object.entries(counts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    const pct = ((v / (opts.width * opts.height)) * 100).toFixed(1);
    console.log(`  ${k.padEnd(14)} ${String(v).padStart(4)}  (${pct}%)`);
  });

  // Write Tiled JSON
  const tiledMap = buildTiledJSON(grid, opts.width, opts.height, manifest);
  const outPath = path.resolve(opts.output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(tiledMap, null, 2));
  console.log(`\n✅ Map written to: ${outPath}`);

  // Write preview PNG
  if (opts.preview) {
    const previewPath = await savePreview(grid, opts.width, opts.height, outPath);
    console.log(`🖼  Preview:  ${previewPath}`);
  }

  console.log(`\nOpen in Tiled to review and edit, then load in game.`);
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
