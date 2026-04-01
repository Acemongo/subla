# Subterranean Los Angeles 🕳️

An isometric adventure/RPG set beneath the streets of Los Angeles. H.G. Wells meets suburban LA underground.

## Stack
- Phaser 3 + TypeScript + Vite
- Supabase (auth + persistent player state)
- Tiled (level editor)

## Setup

```bash
npm install
cp .env.example .env
# Fill in Supabase keys in .env
npm run dev
```

## Project Structure
```
src/
  scenes/       — Phaser scenes (Boot, Game, UI)
  config/       — Game config + Supabase client
  player/       — Player class, gear/inventory
  world/        — Tilemap loading and world management
  ui/           — HUD and gear panel
public/assets/  — Tilemaps, tilesets, sprites (add here)
```

## Controls
- **WASD** or **Arrow keys** — move

## Current State
- ✅ Kenney Miniature Dungeon isometric tileset rendering
- ✅ Multi-layer Tiled map support (level1 — dirt floors + chests)
- ✅ Player movement with isometric directional vectors
- ✅ Supabase auth (email/password, sign in/out, session persistence)
- ✅ Auto-save player position + gear every 10s
- ✅ Load saved state on login
- ✅ HUD with depth indicator, gear slot, sign out button

## Next Steps
- [ ] Implement gear selection/upgrade UI
- [ ] Add enemies / encounters
- [ ] Depth progression (descend through levels)
- [ ] More map content / second level
- [ ] Sound effects
