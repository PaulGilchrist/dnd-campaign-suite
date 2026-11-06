# Bug: Stroke of Luck turns a missed attack into a natural 20 but deals non-critical damage — popup prints "Natural 20!" while the damage lane rolls a single dice pool

## Summary
The Rogue lv20 class feature (and the app's own copy in classes.json) says "If you fail a D20 Test, you can turn the roll into a 20." Live, clicking the Stroke of Luck button on a MISS attack popup correctly converts the total and applies damage as a hit (and persists `hit:true, missConverted:true, convertedBy:'Stroke of Luck'` — the c9ae24fc7 conversion contract), and the popup itself announces **NATURAL 20!**. But the damage stage rolls the SINGLE dice pool (1d6+1, not 2×d6+1), the log carries a single-die damage roll, and the persisted `lastAttack` keeps `isCrit:false, isNatural20:false`. A d20 turned into a 20 on an attack roll is a natural 20 = critical hit (2024 crit rule keys on the die showing 20); the sibling boon correctly does NOT crit (it "hits" without becoming a 20), so the omission is stroke-specific. Observed live 2026-11-06 run DE on the same sheet lane where a genuine natural 20 two attacks later printed "CRITICAL HIT! — DAMAGE DICE DOUBLED" — clean control delta.

## Steps to reproduce
Starting state: `test-campaign`, dev pair (`CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` :80 + `npx vite --host` :5173), hand-rolled combat board via full-store POST `/api/campaigns/test-campaign/combatSummary` `{value:{creatures:[{name:'EvasiveFighter',type:'player',initiative:10,ac:18},{name:'War_Cleric',type:'player',initiative:5,ac:16},{name:'Disciplined_Monk',type:'player',initiative:12,ac:18}],round:1}}`.
1. A "Stroke of Luck" host needs a Rogue lv20: no fixture is one, so per the sanctioned pitfall-10 grant recipe, back up `public/campaigns/test-campaign/EvasiveFighter.json` (md5 `0df29ff32250d8baf51fa9e989def28c`), set `class.name='Rogue'`, `class.subclass.name='Arcane Trickster'`, `level=20`; reload + re-select test-campaign; open EvasiveFighter's sheet (renders "Rogue (arcane trickster), Level 20").
2. Arm the attacker row: scoped `PATCH /api/campaigns/test-campaign/combatSummary` `{value:{creatures:[{name:'EvasiveFighter',targetName:'War_Cleric'}]}}` (applied:1).
3. Click the Shortbow name cell (`div.left.clickable` containing "Shortbow"). Roll a MISS (d20 3 +7 = 10 vs AC 12 live) — the popup shows the ★ "Stroke of Luck" trigger button.
4. Click "Stroke of Luck". Popup re-renders: "d20 20 (Stroke of Luck) +7 / NATURAL 20! / ✓ HIT (27 vs AC 12) / Stroke of Luck: d20 → 20 + 7 = 27".
5. Click Done. Observe the damage roll and the log/change-data.
6. Control: keep pressing the same row until a genuine natural 20 — the popup prints "CRITICAL HIT! — DAMAGE DICE DOUBLED" and doubles the pool.

## Expected behavior
A D20 Test whose d20 is turned into a 20 on an attack roll is a natural 20 → critical hit: the damage stage doubles the dice pool (2d6+1 for Shortbow), and the persisted records honestly carry the crit (or an explicit converted-crit marker). At minimum the app must not print "Natural 20!" on the attack face while charging single-pool damage — every other surface that knows a crit happened prints the crit banner and doubles.

## Actual behavior
- Damage log row: `{"type":"roll","total":6,"rolls":[5],"finalDamage":6}` — single d6 (+1 mod), NOT doubled. Victim `hp_change` delta −6 on War_Cleric.
- Top-level `lastAttack` after conversion: `{hit:true, missConverted:true, convertedBy:"Stroke of Luck", d20:3, total:10, isCrit:false, isNatural20:false}` — the hit/missConverted/convertedBy trio is the accepted authored pattern (d20/total stay original by design per the persistConvertedAttackHit comment), but `isCrit/isNatural20:false` combined with single-pool damage means riders/consumers never see the crit the popup just announced.
- `ability_use` row is honest about the total rewrite ("d20 3 → 20 (total 10 → 27). Miss converted to a hit.") — the only dishonest pair is banner-vs-damage.
- The once-per-rest economy works (latch `strokeOfLuckUsed:true`; a later MISS popup offered no Stroke button — that leg PASSED).

## Likely location
Confident on the display seam, guessing on the fix point. `src/components/char-sheet/DiceRollResult.jsx`:
- :314-315 — the banner logic: "Critical Hit! — damage dice doubled" renders only for `isCritDamage || isCrit || isAutoCrit`; the stroke face falls into the :315 "Natural 20!" branch (`isD20 && displayRoll===20 && !isCrit`), a lane whose rendering tests (`DiceRollResult.rendering.test.jsx` :225-226) only pin CHECK/SAVE cases — the attack case was never authored.
- :1035 — `currentTotal = strokeResult !== null ? 20 + bonus + modifier : …` rewrites the TOTAL only; the Done dispatch carries no crit flag, so the damage roller (`damageFormula "1d6+1"`) never doubles.
- The stroke click handler (`handleStrokeOfLuck` in `CharSheet.handlers.js` :112-133) stamps the latch + conversion flags via `persistConvertedAttackHit` but nothing crit-side (correctly, for the boon twin at :96-110 — boon must stay non-crit).
Fix investigation: read the Done-dispatch payload builder around `DiceRollResult.jsx` :1020-1060 and the damage-roller branch that doubles on `isCrit` (same lane a genuine nat-20 uses), and thread a "converted to 20 on an attack roll" crit flag through it — gating on `rollType==='attack'` so check/save conversions and the Boon of Combat Prowess twin stay byte-unchanged.

## Suggested fix
When the stroke button is pressed on a popup with an attack outcome (`popupHtml.hit === false`, not the boon key), arm the popup's crit state (the same `isCrit`/`isCritDamage` channel a genuine natural 20 uses) so the banner, the doubled damage pool, and the persisted `lastAttack` (e.g. `isNatural20:true` or a `convertedNat20:true` marker beside `missConverted`) all agree. If the owner rules the converted 20 should NOT crit (an intentional divergence from RAW), then the attack face must instead suppress the "Natural 20!" banner and say e.g. "Stroke of Luck — hit (no critical)" — one of the two surfaces is lying either way. Extend `DiceRollResult.rendering.test.jsx` with the stroke-on-ATTACK case (currently only check/save nat-20 cases are pinned).

## Severity
Broken feature (scoped). The conversion/hit/economy legs work, but the core RAW outcome of the feature on an attack roll — "turn the roll into a 20" = critical hit — is silently dropped, under-dealing damage on every stroke-converted attack, while the UI simultaneously advertises the natural 20. Blast radius is the lv20 Rogue (and the once-per-rest face), so frequency is low; honesty-of-ledger precedent (§close-but-not-exact) still makes it a rules bug, not a UX note.
