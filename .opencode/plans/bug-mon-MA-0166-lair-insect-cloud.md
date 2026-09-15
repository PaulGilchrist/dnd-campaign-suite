# Bug MA-0166 — Ancient Black Dragon Lair Action "Swarming Insect Cloud" is inert (nameless-dict data-shape gap)

## Overview
The Ancient Black Dragon's second lair action (swarming-insect cloud: 20-ft sphere, DC 15 CON, 3d6 Piercing, half on success) renders as a static, non-clickable row on the monster card. The authored `lair_actions[1]` dict carries correct `save_dc` (15), `save_type` (Constitution), `damage_dice_primary` (3d6), and `damage_type_primary` (Piercing), but **lacks a `name`** key. `isLairRowClickable` short-circuits false on the missing name, so the row never becomes a `.mc-dice-link-lair` chip — no zone picker, no save prompt, no damage, no log on click. The save engine is provably alive on this same card (DC 22 Dexterity breath control opened a real picker), so the row itself is the unwired gap. Byte-mirrors MA-0165 (lair_actions[0] on this same monster, same nameless-dict fingerprint).

## Expected
Row (manifest MA-0166, stableKey `ancient-black-dragon|lair_actions|1`), actionName placeholder "Unnamed lair actions 2", actionType other, saveDc 15, saveType Constitution, damageDicePrimary 3d6 Piercing.

Description (verbatim): "A cloud of swarming insects fills a 20-foot-radius sphere centered on a point the dragon chooses within 120 feet of it. The cloud spreads around corners and remains until the dragon dismisses it as an action, uses this lair action again, or dies. The cloud is lightly obscured. Any creature in the cloudwhen it appears must make on a DC 15 Constitution saving throw, taking 10 (3d6) piercing damage on a failed save, or half as much damage on a successful one. A creature that ends its turn in the cloud takes 10 (3d6) piercing damage."

Note the authored-text typo **"cloudwhen"** ("Any creature in the cloudwhen it appears") = data drift vs the Adult Black Dragon's corrected text ("cloud when"). 10 (3d6) is row-vs-text consistent with damage_dice_primary 3d6.

monsters.json `ancient-black-dragon.lair_actions[1]` (as authored on disk, verbatim keys):
```json
{
  "description": "A cloud of swarming insects fills a 20-foot-radius sphere centered on a point the dragon chooses within 120 feet of it. The cloud spreads around corners and remains until the dragon dismisses it as an action, uses this lair action again, or dies. The cloud is lightly obscured. Any creature in the cloudwhen it appears must make on a DC 15 Constitution saving throw, taking 10 (3d6) piercing damage on a failed save, or half as much damage on a successful one. A creature that ends its turn in the cloud takes 10 (3d6) piercing damage.",
  "save_dc": 15,
  "save_type": "Constitution",
  "damage_dice_primary": "3d6",
  "damage_type_primary": "Piercing"
}
```
Note: the dict has **no `name`**, no `dc_success`, no `save_effect`, and no `zone` block.

Expected behavior (per MA-0024/MA-0075/MA-0084 lair recipes): a structured lair row renders a `.mc-dice-link-lair` chip; clicking routes through `resolveLairRow` → save affordance → SaveAttackAoeModal **Radius picker** ("20-foot radius", MA-0084 sphere detection) → per-target DC 15 **Constitution** saves → failed save = full 3d6 Piercing (hp_change), success = exactly half (floor) → zone-arm `lair_insect_cloud` te + logs.

## Actual
Live DOM in the `.mc-overlay` renders the row inert, with the empty-name token (stray "." from the missing name):
```html
<div class="mc-action"><strong>.</strong> <span>A cloud of swarming insects fills a 20-foot-radius sphere centered on a point the dragon chooses within 120 feet of it. The cloud spreads around corners and remains until the dragon dismisses it as an action, uses this lair action again, or dies. The cloud is lightly obscured. Any creature in the cloudwhen it appears must make on a DC 15 Constitution…</span></div>
```
- `.mc-dice-link-lair` count on the whole card = **0**.
- Row and all children have **no `onclick`** handler.
- Forced `el.click()` ×2 on the row, its `<span>`, and its `<strong>`, plus a trusted center mouse-click: **zero** popup (`[]`), **zero** change-data delta (no `saveResult-*`, no lair/insect keys, dragon `currentHp` 367 untouched, no `targetEffects`/`activeConditions`), **zero** new log lines (only pre-existing join + initiative-roll entries remain).
- CONTROL on the SAME card — the live **DC 22 Dexterity** breath save chip (`mc-dice-link-save-clickable`) — opened a real `.sp-overlay` picker ("Each must make a Dexterity saving throw (DC 22)… 15d8 Acid"), spent `monsterRecharge {"Acid Breath":{recharged:false,threshold:5}}` at picker-open, and wrote an `ability_use` log. The save/card engine is provably alive; only the lair row is inert.

## Steps to Reproduce
1. localhost:5173 → select `test-campaign` (verify header = test-campaign, MV-18).
2. Encounters → check "Ancient Black Dragon" → **Join Encounter**. Confirms cs idx 0 `Ancient Black Dragon 1` hp 367 ac 22.
3. Initiative → arm the dragon card `[data-testid="target-select"]` to ElderPaladin (verify server `combatSummary.creatures[0].targetName` lands).
4. Open the dragon card (`img.avatar-image[alt="Ancient Black Dragon 1"]`, scrollIntoView first).
5. Lair Actions section → the insect-cloud row: `<strong>.</strong>` (empty name), no `.mc-dice-link-lair` chip, no onclick on row or children.
6. Forced `el.click()` ×2 (row + span + strong) + trusted center click: zero popup / zero log / zero change-data delta.
7. CONTROL: click the "DC 22 Dexterity" breath chip in the same card → real `.sp-overlay` picker + `ability_use` log + recharge spend appear. Skip/cancel the picker.

## Likely Location
- **Data shape (primary):** `public/data/monsters.json` → `ancient-black-dragon.lair_actions[1]` is a **nameless** dict. Fix = author `name:"Insect Cloud"` + `dc_success:"half"` + `save_effect` + `zone:{radius_ft:20, repeat_turn_end:true}` + `duration` — the Adult Black Dragon sibling row is already fixed in exactly this shape (MA-0042/MA-0075 byte-mirror template): `{name:"Insect Cloud", save_dc:15, save_type:"Constitution", damage_dice_primary:"3d6", damage_type_primary:"Piercing", dc_success:"half", save_effect:"Failure: 10 (3d6) piercing damage. Success: Half damage.", zone:{radius_ft:20, repeat_turn_end:true}, duration:"until dismissed or used again (advisory)", description:"…"}`. Also fix the "cloudwhen" typo in the Ancient description while touching the row.
- **Name-gate (mechanism):** `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable` returns false when `!row.name`; `MonsterCardBody.jsx:340` then renders the static inert `div.mc-action` branch (no chip). MA-0118 fingerprint: nameless dicts never become clickable; fix is in the data, not the gate.

## Notes
- **`lair_insect_cloud` te already registered** (`src/services/combat/conditions/targetEffectDefinitions.js:833`, "Insect Cloud (Lair)", Lair group) from the Adult Black Dragon fix — once the Ancient dict is named + zoned, the existing producer chain (MA-0075 zone-cloud shape + MA-0084 radius picker) lights this row up with zero code change.
- **Turn-end recurring damage (§7):** "A creature that ends its turn in the cloud takes 10 (3d6) piercing damage" has **no consumer app-wide** — no turn-end zone-damage consumer exists (MA-0118/MV-24 grep facts; the registered te description itself states "GM-enforced (no turn-end zone-damage consumer exists)"). `zone.repeat_turn_end:true` on the adult row is advisory-only. Same for zone persistence/dismiss ("remains until the dragon dismisses it…") and lightly-obscured (no light-level model, §7). Even post-fix, only the instantaneous DC 15 CON save + full/half 3d6 Piercing + te arm are enforceable.
- **Name drift:** manifest actionName "Unnamed lair actions 2" is the generator placeholder emitted precisely because the dict lacks `name` — naming the dict fixes display and clickability together.
- Reference fingerprints: MA-0165 (same monster, lair[0], same fingerprint), MA-0118 (lair clickability data-shape dependent), MA-0075/MA-0084 (zone-cloud + radius picker recipes), MA-0042 (Adult Black Dragon Insect Cloud data fix), MV-24 (renderer stray "." on missing name).
