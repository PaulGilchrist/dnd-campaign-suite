# Bug mon-MA-0085 — Adult Bronze Dragon · "Unnamed lair actions 1" · lair_actions · inert + severe data/text drift

## Verdict
**FAIL** — lair row fully inert (MV-24 fingerprint) AND numeric metadata misattributed across entries.

## Drift (data vs text)
`public/data/monsters.json` adult-bronze-dragon `lair_actions`:
- `[0]` description = fog cloud ("lasts until initiative count 20" — no save, no damage per rules), BUT carries `save_dc:15`, `save_type:"Constitution"`, `damage_dice_primary:"1d10"`, `damage_type_primary:"Thunder"`, `save_effect:"...1d10 Thunder... deafened until the end of its next turn."` — these are the **thunderclap** numbers, attached to the wrong entry. Severe drift confirmed.
- `[1]` = raw **string** (not object) holding the actual thunderclap text ("DC 15 Constitution... 20-foot radius... deafened"), incl. typo `1dlO`. No metadata of its own — numbers orphaned onto `[0]`.
- No `name` on `[0]` → renders "Unnamed lair actions 1" via `<strong>.</strong>` fallback.

## Inert (MV-24 fingerprint)
- `MonsterLairAction` (src/components/encounter/MonsterCardBody.jsx:306) renders sanitized description span only — no onClick, no ActionSaveRoll, no consumer of save_dc/save_type/damage dice anywhere (grep-zero for lair producers; targetEffectDefinitions.js has zero lair entries).
- E2E (test-campaign header ✓, joined: dragon init 14, HP 212): overlay lair row 1 = inert `DIV.mc-action`, cursor auto, 0 interactive children, no DC/dice link. Forced pointer+mouse + dblclick + `.click()` ×3 (two rounds): 0 modals, 0 DC-15 CON prompts.
- Zero-delta: change-data sha256 `6fe88597e0393b516f0d54edad58b1e1292eabe0e9580441d3e72d20afbfc052` identical before/after forced clicks. Log = 2 entries (joined + initiative roll); lair/fog/thunder/deafened/dc-15 hits = 0.

## Fix direction
Re-attribute DC15 CON 1d10 Thunder + deafened metadata to entry `[1]`, strip it from `[0]` (fog cloud = area effect, no save), convert `[1]` to object with name, fix `1dlO` typo; then wire a lair-action producer or keep inert by design (MV-21/24 family).
