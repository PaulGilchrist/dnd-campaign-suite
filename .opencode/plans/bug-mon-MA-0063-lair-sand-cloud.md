# Bug mon-MA-0063 — Adult Blue Dragon · "Unnamed lair actions 2" (sand cloud) — inert, no zone/condition producer

## Row
- Monster: Adult Blue Dragon · row: lair_actions[1] (label falls back to "Unnamed lair actions 2") · type: other · conditions: ["blinded"] · DC 15 CON zone, blinded 1 min, repeat saves end effect.

## Fingerprint (MV-21/24 reproduced)
- Data: lair_actions[1] is a plain string — no name/save_dc/save_type object even though the text declares DC 15 Constitution + blinded 1 minute + repeat saves. Compare lair_actions[0] which IS an object.
- Render: `MonsterLairAction` (src/components/encounter/MonsterCardBody.jsx:306) string branch → inert `div.mc-action` sanitized span. E2E in `.mc-overlay`: cursor auto, 0 interactive children (control: Rend/Lightning Breath/Spellcasting rows each expose 1+ interactive control).
- Forced interaction: full pointer+mouse event sequence, dblclick, `.click()` ×2 → 0 modals, no save prompt, no roll.
- Zero-delta: change-data sha256 `fee3648e39a8bd14bee2b0f9fbce704e19e72dee2467b12630882e11117b609f` (10,557 B) identical before/after forced clicks; no save-prompt/pipeline/zone keys in change-data; sand/blinded strings in change-data are static statblock lore embedded at join.
- Logging: campaign log 2 entries (join + initiative roll); grep lair|sand|blinded|cloud = 0 — automation never logs because it never fires.

## Consumer grep-zero
- No `lair`+`sand|zone|blinded` co-occurrence anywhere in src/server (non-test).
- `targetEffectDefinitions.js`: zero lair-derived effect entries — no zone/blinded repeat-save te exists.
- No automation handler in src/services/automation consumes `lair_actions` at runtime.
- "sand" matches are unrelated weather/randomEvent flavor text.

## Impact
Lair sand-cloud (blinded 1 min, DC 15 CON, repeat saves) has zero automation: GM clicking the row does nothing; no zone, no save prompt, no condition applied to tokens, no log.

## Cleanup done
Admin clear-change-data + clear-log POSTs (Host: localhost); browser closed. No manifest/playbook edits.

## Verdict: FAIL
