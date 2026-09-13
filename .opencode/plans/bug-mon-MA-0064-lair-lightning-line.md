# Bug mon-MA-0064 — Adult Blue Dragon · Unnamed lair actions 3 · lair_actions · other · DC15 DEX lightning line, 3d6

**Verdict: FAIL** — MV-21/24 fingerprint (inert lair row).

## Data
- `public/data/monsters.json` Adult Blue Dragon `lair_actions[2]` = plain STRING:
  "Lightning arcs, forming a 5-foot-wide line … DC 15 Dexterity saving throw or take 10 (3d6) lightning damage."
- No object wrapper, no `name`, no `save_dc`/`damage_dice_primary`/automation metadata.

## Render path
- `MonsterLairAction` (src/components/encounter/MonsterCardBody.jsx:306) string branch → sanitized `<span>` inside inert `DIV.mc-action`. No onClick, no handler.

## Zero consumers
- Grep src/server (non-test): all "lair" automation hits are `clairvoyant` substring false positives; only real refs are display-only `getLairActions`/render in MonsterCardBody.jsx and `lair_actions: null` in npcStatBlockUtils.js:80.
- `targetEffectDefinitions.js`: zero lair/lightning-line entries. No handler produces the DC15 DEX line zone or 3d6 lightning damage.

## E2E (test-campaign, header ✓ MV-18)
- Encounters → tick Adult Blue Dragon (1 monster, 15,000 XP) → Join → tracker card 212 hp init 2 → avatar click → `.mc-overlay` open.
- Lair row = overlay `.mc-action` index 11 ("Lightning arcs…"): cursor auto, 0 interactive children, no `<strong>` (string branch). Control contrast: Rend/Lightning Breath/Spellcasting rows each carry 1 interactive control.
- Forced full pointer+mouse sequence + dblclick + `.click()` ×2, run twice: 0 modals, 0 dialogs, no save prompt, no roll, overlay untouched.
- change-data sha256 `9dcf14b9db5f49d0874bc6409927b46494680fe9b83762539e177bef5a88c47d` (10,540 B) identical across both forced passes; keys = combatSummary/campaign/map/character/viewing flags only — no save-prompt/zone/effect keys.
- Log: 2 entries (join + initiative roll); grep lair|arcs|lightning line = 0.

## Cleanup
- Admin clear-change-data + clear-log POSTs (Host: localhost). Browser closed.
