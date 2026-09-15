# Bug MA-0165 — Ancient Black Dragon Lair Action "Grasping Tide" is inert (nameless-dict data-shape gap)

## Overview
The Ancient Black Dragon's first lair action (the "grasping tide" water-pull + prone) renders as a static, non-clickable row on the monster card. Although the authored `lair_actions[0]` dict carries the correct `save_dc` (15) and `save_type` (Strength), it **lacks a `name`** key. `isLairRowClickable` short-circuits false on the missing name, so the row never becomes a `.mc-dice-link-lair` chip and no save prompt, condition, or log is ever produced on click. The save engine itself is alive on this same card (control probe fired), so the row itself is the unwired gap.

## Expected
Row (manifest MA-0165, stableKey `ancient-black-dragon|lair_actions|0`), actionName placeholder "Unnamed lair actions 1", actionType other, saveDc 15, saveType Strength, conditions [prone].

Description (verbatim): "Pools of water that the dragon can see within 120 feet of it surge outward in a grasping tide. Any creature on the ground within 20 feet of such a pool must succeed on a DC 15 Strength saving throw or be pulled up to 20 feet into the water and knocked prone."

monsters.json `ancient-black-dragon.lair_actions[0]` (as authored on disk, verbatim keys):
```json
{
  "description": "Pools of water that the dragon can see within 120 feet of it surge outward in a grasping tide. Any creature on the ground within 20 feet of such a pool must succeed on a DC 15 Strength saving throw or be pulled up to 20 feet into the water and knocked prone.",
  "save_dc": 15,
  "save_type": "Strength"
}
```
Note: the dict has **no `name`**, no `dc_success`, and no `save_effect`.

Expected behavior (per MA-0024/MA-0074 lair recipe): a structured lair row should render a `.mc-dice-link-lair` chip and, when the dragon is active with a target armed, clicking it routes through `resolveLairRow` → `handleSaveRoll` and enforces a DC 15 **Strength** save, applying **prone** on a failed save (and nothing on a successful save).

## Actual
Live DOM in the `.mc-overlay` renders the row inert, with an empty name token (the stray "." from the missing name):
```html
<div class="mc-action"><strong>.</strong> <span>Pools of water that the dragon can see within 120 feet of it surge outward in a grasping tide. Any creature on the ground within 20 feet of such a pool must succeed on a DC 15 Strength saving throw or be pulled up to 20 feet into the water and knocked prone.</span></div>
```
- `.mc-dice-link-lair` count on the card = **0**.
- The row element and all its children have **no `onclick`** handler.
- Forced `el.click()` ×2 on the row, its `<span>`, and its `<strong>`, plus a trusted center mouse-click: **zero** popup (`[]`), **zero** change-data delta (no `saveResult-*`, no lair key, no `activeConditions`/`targetEffects`), **zero** new log lines.
- CONTROL on the SAME card — the live **DC 22 Dexterity** Breath save chip (`mc-dice-link-save-clickable`) — opened a real `.sp-overlay` picker ("…Each must make a Dexterity saving throw (DC 22)") and wrote an `ability_use` log ("Ancient Black Dragon 1 uses Acid Breath (Recharge 5-6)"). The save/card engine is provably alive; only the lair row is inert.

## Steps to Reproduce
1. localhost:5173 → select `test-campaign` (verify header = test-campaign).
2. Encounters → search "Ancient Black Dragon" → tick → **Join Encounter** (only path into initiative). Confirms cs idx 0 `Ancient Black Dragon 1` hp 367 ac 22.
3. Initiative → arm the dragon card's `[data-testid="target-select"]` to a PC (e.g. ElderPaladin). Verify server `combatSummary.creatures[0].targetName` lands.
4. Open the dragon card (`img.avatar-image[alt="Ancient Black Dragon 1"]`).
5. Locate the "Lair Actions" section → the grasping-tide row. Observe `<strong>.</strong>` (empty name) and no `.mc-dice-link-lair` chip; it has no onclick.
6. Click the row (synthetic ×2 + trusted). Observe zero popup / zero log / zero change-data delta.
7. CONTROL: click the DC 22 Dexterity Breath save chip in the same card → real save picker + `ability_use` log appear.

## Likely Location
- **Data shape (primary):** `public/data/monsters.json` → `ancient-black-dragon.lair_actions[0]` is a **nameless** dict. Fix = author `name` (e.g. "Grasping Tide") + `dc_success:"none"` + `save_effect:"prone"` (condition word required for the MA-0017 damageless-save leg). Mirrors the verified MA-0074 nameless→named STR-save data-only fix.
- **Name-gate (mechanism):** `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable` returns false when `!row.name`; `MonsterCardBody.jsx:340` then renders the static inert `div.mc-action` branch (no chip). The MA-0118 fingerprint: nameless dicts never become clickable; the fix is in the data, not the gate.

## Notes
- **Pull / water clauses (§7 advisory):** "pulled up to 20 feet" and "into the water" have no grid/pull consumer app-wide (no lair-initiative-20 seam, no pull-te for water terrain). Even after fixing name+save_effect so the DC 15 STR save + prone land, the pull distance and "into the water" clauses remain GM-adjudicated prose. Prone is the only mechanically enforceable clause here.
- **Name drift / authored-data gap:** manifest row is named "Unnamed lair actions 1" — a generator placeholder emitted precisely because the dict has no `name`. This is the authored-data gap that also causes the inert render; naming the dict fixes both the display and the clickability.
- **dc_success semantics:** the row's canonical success = no condition. Once named, author `dc_success:"none"` so the half-damage boilerplate is suppressed and success applies nothing.
- Reference fingerprints: MA-0118 (lair clickability is data-shape dependent), MA-0092/MA-0095/MA-0096/MA-0097 (missing name/uses → inert), MA-0074 (nameless-drifting lair row → named STR save, data-only fix), MV-24 (MonsterLairAction renderer name fallback ".").
