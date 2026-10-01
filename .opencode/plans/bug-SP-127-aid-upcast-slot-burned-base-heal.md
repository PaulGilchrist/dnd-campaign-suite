# SP-127 Aid — Upcast consumes higher slot but applies base +5; spell log over-reports targets; casting_time data wrong

## Overview
Verification host: Divine_Cleric (lv17 2024 Life Domain Cleric), test-campaign, 2026-10-01 (Playwright MCP E2E).
Base-level Aid chain is LIVE-EXACT (multi-target chooser, 3-target cap, lv2 slot burn, +5 max AND +5 current HP on each chosen target, Aid buff + expiration + logs). But:
1. **Upcast defect**: casting from a 3rd-level slot burns the lv3 slot yet still applies only **+5** (canonical/data formula: **+10**), and the log stamps spellLevel 2.
2. **Spell-log targets over-reported**: the `spell` log entry lists ALL 14 combatants as `targets` regardless of the 1–3 actually chosen.
3. **Casting-time data mismatch**: app `public/data/2024/spells.json` Aid says `casting_time: "Action"`; canonical 2024 PHB Aid is **1 Bonus Action** (task trigger spec agrees). Sheet/popup render "Casting Time: Action".

## Expected (canonical, 2024)
"Choose up to three creatures within range. Each target's Hit Point maximum and current Hit Points increase by 5 for the duration. Higher-Level Slot: +5 for each slot level above 2." — i.e. lv3 slot = **+10** to max AND current HP; casting time = Bonus Action.
App's own data agrees on the math: `automation.hpMaxIncreaseExpression: "5 + ((spellSlotLevel - 2) * 5)"`, `heal_at_slot_level {2:5,3:10,...}`, and the SpellDetailPopup upcast radios display 5/10/15/… correctly.

## Actual (GET-proved, change-data after casts)
- Cast #1 (lv2 slot): Divine_Cleric.spell_slots_level_2 **3→2**; War_Cleric current 50→**55**, FeyRanger 80→**85**, ElderPaladin 200→**205**; `aidHpMaxIncrease:5` each; initiative card max display 59→**64**, 89→**94**, 224→**229**; activeBuffs `{name:Aid, effect:aid_hp_increase, duration:'8 hours', sourceCharacter:Divine_Cleric}`; pendingExpirations `remove_aid_buff` registered (caster-keyed, expiryRounds:Infinity — 8h modeled as never-expires, advisory).
- Cast #2 (**lv3 radio selected**, popup showed "10"): spell_slots_level_3 **3→2** (slot burned) but War_Cleric aidHpMaxIncrease 5→**10** (delta **+5**, not +10), current 55→**60** (+5). Log `spell` entry: `spellLevel:2`, `castingTime:"Action"`, `targets:[all 14 names]`, `targetName:"AasimarTest"` (an untargeted creature!).
- Both casts' spell log entries list all 14 combatants as targets while only the chosen targets received hp_change entries.
- 4th-target cap: chooser disables all remaining checkboxes at 3 ("Cast Aid (3)"; 4th checkbox click → element not enabled). PASS.

## Steps
1. test-campaign, GM. Divine_Cleric sheet → Spells → click **Aid** row (auto-prepared 2024 Cleric list; not on disk spells[] — see Notes) → popup shows upcast radios (lv2 checked, label "5"; lv3 "10").
2. Select **Level 3** radio → Cast Spell → target chooser opens ("Aid — Choose up to 3", all combatants) → tick 1 creature (War_Cleric) → **Cast Aid (1)**.
3. GET `/api/campaigns/test-campaign/change-data`: `Divine_Cleric.spell_slots_level_3` decremented; `War_Cleric.aidHpMaxIncrease` += 5 only; GET log: newest `spell` entry spellLevel:2.

## Likely Location
- `src/hooks/combat/useSimpleSpellHandlers.js:265` — aid spec `bodyOf` builds `{automation:{type:'aid',range,maxTargets}}` **without** `spellSlotLevel` (cf. deathWard/auraOfVitality specs :284-285 which pass `spellSlotLevel: p.spellLevel`; even those don't fold `pending.spell.upcastLevel`).
- `src/services/automation/handlers/healing/aidHandler.js:74` — `slotLevel = action.spellSlotLevel || spell.level || 2`; `pending.spell.upcastLevel` is never read, so `getAidHpMaxIncrease` resolves expression at slot 2 → 5.
- `src/hooks/combat/useConfirmableFlow.js:72` — spell log stamps `pending.spellLevel` (= base `spell.level`), never `upcastLevel`; and aid uses default `confirmTargets=allTargets` (`useSimpleSpellHandlers.js:324`) so log `targets` = full combat list (`:265` lacks the `confirmTargets:(d,p,sel)=>toArray(sel)` shape used by revivify/protectionFromEvilAndGood).
- DATA: `public/data/2024/spells.json` Aid `casting_time` should be "Bonus Action" (canonical 2024); app says "Action" (5e legacy value).

## Notes
- Task brief's "+6" at 2nd slot is itself off-canonical; app popup/formula agree on +5@lv2/+10@lv3. Actual (+5@lv3) fails both.
- Slot payment is correct (`prepareSpellCast` reads `pending.spell.upcastLevel` — only the apply/log leg loses it; `prepareSpellCast` returns `modifiedSpell` with folded level, but `useConfirmableFlow` discards it and reuses `pending.spell`).
- Cap enforcement is real (checkbox `disabled`), label counts "Cast Aid (n)", Skip present.
- No first-cast FT-087 burn: fresh admin-cleared runtime, first Aid cast worked with no `activeConditions` key seeded.
- Expiration registered under CASTER's pendingExpirations (4 entries incl. dup stack on recast); target-side pendingExpirations []; expiryRounds Infinity = buff survives combat until admin/rest (8h not round-modeled — accepted advisory).
- Reusable host: Divine_Cleric keeps Aid via wizard auto-assign display; disk spells[] unchanged (24, no Aid). Retest upcast here post-fix by re-selecting lv3 radio.
