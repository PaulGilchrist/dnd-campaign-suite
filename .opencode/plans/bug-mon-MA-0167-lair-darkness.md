# Bug MA-0167 — Ancient Black Dragon Lair Action "Unnamed lair actions 3" (darkness zone) is inert (raw-string data-shape gap)

## Overview
The Ancient Black Dragon's third lair action (save-less 15-ft magical darkness zone) renders as a static, non-clickable row on the monster card. Unlike its siblings MA-0165/MA-0166 (nameless dicts), `lair_actions[2]` is a **legacy raw string** — it hits the `typeof la === 'string'` static branch in `MonsterCardBody.jsx:340` BEFORE the `isLairRowClickable` name-gate (`monsterLairActions.js:26`) is even consulted. No `.mc-dice-link-lair` chip, no affordance, no onclick. The MA-0085/MA-0043 save-less zone seam (zone picker + `lair_darkness` te arm, zero save prompt) exists and is live for other monsters' structured rows, but this row's raw-string shape never reaches it. The zone/save engine is provably alive on this same card (control probe fired); the row itself is the unwired gap.

## Expected
Row (manifest MA-0167, stableKey `ancient-black-dragon|lair_actions|2`), actionName placeholder "Unnamed lair actions 3", actionType other, authored: NO save_dc/save_type/dice (save-less darkness zone).

Description (verbatim): "Magical darkness spreads from a point the dragon chooses within 60 feet of it, filling a 15-foot-radius sphere until the dragon dismisses it as an action, uses this lair action again, or dies. The darkness spreads around corners. A creature with darkvision can't see through this darkness, and nonmagical light can't illuminate it. If any of the effect's area overlaps with an area of light created by a spell of 2nd level or lower, the spell that created the light is dispelled."

monsters.json `ancient-black-dragon.lair_actions[2]` (as authored on disk): a **raw string** containing exactly the text above — no dict, no `name`, no `zone` block, no save/dice fields. Row-vs-text consistency: raw text matches manifest description verbatim; 15-foot radius / 60-foot origin range appear ONLY in prose (no structured fields).

Expected behavior (per MA-0085 save-less zone recipe + MA-0043 darkness default-noun shape): a structured row `{name, description, zone:{radius_ft:15, no_save:true, effect_key:"lair_darkness", noun:"darkness"}}` → `affordance:'zone'` (monsterLairActions.js:40, requires radius_ft AND no save_dc) → zone picker "15-foot darkness. No saving throw" (SaveAttackAoeModal.jsx:664) → te arm `lair_darkness` (registered, targetEffectDefinitions.js:824) + ability_use log, zero save prompt.

## Actual
Live DOM in the `.mc-overlay` renders the row inert (raw-string static branch — no `<strong>` name at all, just the description span):
```html
<div class="mc-action"><span>Magical darkness spreads from a point the dragon chooses within 60 feet of it, filling a 15-foot-radius sphere until the dragon dismisses it as an action, uses this lair action again, or dies. The darkness spreads around corners. A creature with darkvision can't see through this darkness, and nonmagical light can't illuminate it. If any of the effect's area overlaps wi…</span></div>
```
- `.mc-dice-link-lair` count on the whole card = **0** (no lair chip anywhere — rows [0]/[1] inert too, MA-0165/0166).
- Row and all children have **no onclick** handler (`hasOnclickAnywhere: false`; no `a/button/[role=button]/.mc-dice-link` descendants).
- Forced `el.click()` ×2 on the row and its `<span>`, plus trusted center mouse-clicks ×2: **zero** overlay (`[]` on `.sp-overlay/.popup-overlay/.popup/.mc-modal`), **zero** change-data delta (no `lair`/`darkness`/`saveResult-*` keys, `targetEffects` stays null, no `Ancient Black Dragon 1` lair store keys), **zero** new log lines (not even a `lair_action_refused` — the static branch has no handler at all; log held only the 2 join-noise entries at ts 1789441608980/998 predating the clicks).
- CONTROL on the SAME card — the live **DC 22 Dexterity** Breath save chip (`mc-dice-link-save-clickable`) — opened a real `.sp-overlay` picker ("90-ft Line (GM positions tokens; selection advisory) … Each must make a Dexterity saving throw (DC 22)"), spent `monsterRecharge {"Acid Breath":{recharged:false,threshold:5}}` at picker-open, and wrote an `ability_use` log (ts 1789441673698). The zone/save/card engine is provably alive; only the darkness lair row is inert.
- Grep: `lair_darkness` te exists in the registry ONLY as a definition (targetEffectDefinitions.js:824) — zero producers for this row (zone producer requires a structured named dict via `lairRowAffordance`, which raw strings never reach). Darkvision clauses: only race-rule sense display (race-rules/5e.js:100, 2024.js:166) — no darkness interaction. "nonmagical light can't illuminate" / "spell of 2nd level or lower … dispelled": zero consumers app-wide (sole echo is inside the te's own description text).

## Steps to Reproduce
1. localhost:5173 → select `test-campaign` (verify header = test-campaign, MV-18).
2. Encounters → search "Ancient Black Dragon" → tick → **Join Encounter**. Confirms cs idx 0 `Ancient Black Dragon 1` hp 367 ac 22 (join noise: 2 log entries encounter/roll).
3. Initiative → open the dragon card (`img.avatar-image[alt="Ancient Black Dragon 1"]`, scrollIntoView + fresh boundingRect first).
4. Lair Actions section → the darkness row: `<div class="mc-action"><span>…` (raw-string static render), no `.mc-dice-link-lair` chip, no onclick on row or children.
5. Forced `el.click()` ×2 (row + span) + trusted center clicks ×2: zero popup / zero log / zero change-data delta.
6. CONTROL: click the "DC 22 Dexterity" breath chip in the same card → real `.sp-overlay` picker + recharge spend + `ability_use` log. Skip.

## Likely Location
- **Data shape (primary):** `public/data/monsters.json` → `ancient-black-dragon.lair_actions[2]` is a **raw string** (legacy ~600-monster shape, regression-protected by design at `MonsterCardBody.jsx:334-352`). Fix = convert to the MA-0085 save-less zone dict: `{name:"Darkness", description:"<verbatim>", zone:{radius_ft:15, no_save:true, effect_key:"lair_darkness", noun:"darkness"}, duration:"until dismissed, used again, or dragon dies (advisory)"}` → `affordance:'zone'` + zone picker + te arm with ZERO code change (byte-mirror MA-0043/MA-0085 verified shapes).
- **Name-gate (mechanism):** `src/services/encounters/monsterLairActions.js:26` `isLairRowClickable` returns false for non-objects; `MonsterCardBody.jsx:340` routes raw strings to the static branch before affordance logic runs. MA-0118 fingerprint: raw-string lair entries never become clickable; fix is in the data, not the gate.

## Notes
- **MA-0085 zone fix template (verbatim reuse):** `{name, description, zone:{radius_ft, no_save:true, effect_key, noun}}` → affordance 'zone' (monsterLairActions.js:40) → SaveAttackAoeModal zoneOnly copy "…-foot ${noun}. No saving throw — the GM positions the origin" (:664) → te arm, no save roll (MA-0043 darkness is the byte-identical default-noun path). `lair_darkness` te already registered (Lair group, :824) from the MA-0043 fix — data-only fix lights this row up.
- **§7 gaps to enumerate (even post-fix):** no light-level/unseen model app-wide — "darkvision can't see through", "nonmagical light can't illuminate", and the 2nd-level-or-lower light-spell dispel clause have ZERO consumers and will remain GM-advisory prose even after the zone te lands (te description itself says "GM-enforced (no light-level model in this engine)"). Zone persistence/dismiss ("until the dragon dismisses it…") has no duration consumer (MA-0118: no lair-initiative-20 seam; te persists until cleared).
- **Name drift:** manifest actionName "Unnamed lair actions 3" is the generator placeholder for the missing name; naming the dict fixes display and clickability together (MV-24 stray-"." family — note raw strings render WITHOUT even the ".", unlike the nameless dicts of MA-0165/0166).
- Reference fingerprints: MA-0165/MA-0166 (same monster, lair[0]/[1] nameless-dict inert), MA-0118 (lair clickability data-shape dependent), MA-0085/MA-0043 (save-less zone picker + darkness te), MV-24 (lair renderer static branch).
