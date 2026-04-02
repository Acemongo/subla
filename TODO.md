# subla TODO

## 🔴 Blocking

- [ ] **Run Supabase migration** — `player_characters` table doesn't exist yet.
  Without it, character save fails silently and `CharacterCheckScene` always routes to creation.
  SQL is ready at: `supabase/migrations/20260402_player_characters.sql`
  → Paste into [Supabase SQL editor](https://supabase.com/dashboard/project/tmqhtnxrchaxgklaukah/sql/new) and run.

## 🟡 In Progress

- [ ] **Character creation UI** — `CharacterCreateScene` currently auto-rolls everything.
  Player should be able to: pick concept, name their character, see rolled stats (with reroll option), choose skills, background, motivation.

## 🟢 Up Next

- [ ] Wire `character` data (passed via scene init) into `GameScene` and `UIScene`
- [ ] Display HP / WILD bars in `UIScene` from character sheet
- [ ] Enemy definitions — port Morlock, Man-Eating Vine, Diablo Marioneta, Animated Statue from reference doc into TypeScript
- [ ] Gear system — inventory management, item pickups, equip/unequip
- [ ] Combat system — roll formula (`STAT + Focus + d10%`), damage, stun vs lethal

## ✅ Done

- [x] Kenney dungeon tileset rendering (isometric)
- [x] Auth (Supabase email/password)
- [x] Player movement (isometric WASD)
- [x] Auto-save world state (position, gear) to Supabase
- [x] `PlayerCharacter` data structure (stats, skills, HP, WILD)
- [x] `PlayerState` — Supabase save/load for character sheet
- [x] `CharacterCheckScene` — boot flow checks for existing character
- [x] `CharacterCreateScene` — creates + saves new character on first login
- [x] Subterraliens reference doc extracted from source PDF
