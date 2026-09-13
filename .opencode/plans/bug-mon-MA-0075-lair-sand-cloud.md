# Bug mon-MA-0075 — Adult Brass Dragon · "Unnamed lair actions 2" (sand cloud) — inert, no zone/condition producer

## Row
- Monster: Adult Brass Dragon · row: lair_actions[1] (label falls back to "Unnamed lair actions 2") · type: other · conditions: ["blinded"] · DC 15 CON zone, blinded 1 min, repeat saves end effect.

## Evidence
- `public/data/monsters.json` adult-brass-dragon `lair_actions[1]` = **plain string** (sand cloud 20-ft sphere, DC 15 CON, blinded 1 min, repeat saves) — no `name`, no structured `save_dc`/`save_type` automation metadata on this row (structured object exists only at `[0]` wind — MV-21 shape inconsistency, same as MA-0063).
- `MonsterLairAction` (MonsterCardBody.jsx:306) renders string branch via sanitized `<span>` only — no handler, no onClick path. Overlay row 11 = inert `DIV.mc-action`, cursor auto, 0 interactive children, no `<strong>` header. Control contrast: attack rows (Rend/Fire Breath/Sleep Breath/Spellcasting/Scorching Sands) carry interactive controls — lair rows never.
- Forced full pointer+mouse sequence ×2 + dblclick + `.click()` ×2: 0 modals, no save prompt, no roll.
- Zero-delta: change-data sha256 `61db9afd…` identical across post-forced-click fetches; cd keys = combatSummary/campaign/map/character/viewing flags only — no save-prompt/zone/effect keys. Sand/blinded text in cd = static statblock lore embedded at join.
- Grep-zero consumers: `lair_actions` referenced only in MonsterCardBody.jsx (display) + npcStatBlockUtils.js (null); no automation handler/router consumes lair_actions; targetEffectDefinitions.js has zero lair entries; no `lair`+`blinded|sand|zone` co-occurrence in src/server (non-test).
- Log: 2 entries (join + initiative roll); grep lair|sand|blinded|cloud = 0.

## Verdict
**FAIL** — inert lair row: no clickable affordance, no DC15 CON zone producer, no blinded/repeat-save automation. MV-21/24 fingerprint reproduced (identical to MA-0063 Adult Blue Dragon sand-cloud lair row).
