# Bug CLA-325 — Spell Thief (Arcane Trickster lv17): negate, caster-block, spell-castability and trigger-gate clauses inert

## Overview
Spell Thief (2024 Rogue / Arcane Trickster lv17) is wired end-to-end as a manual Reactions-row click that forces an INT save on `lastAttack.attackerName` and, on a failed save, writes stolen/blocked runtime keys with logs and a working once-per-Long-Rest economy. However, three of its six canonical clauses are unenforced ("claimed but inert"): the triggering spell is never actually negated (damage lands before the reaction and is never rolled back), the casting creature is never blocked from recasting the stolen spell, and the "prepared for 8 hours" stolen spell renders as an uncastable display-only row. The `spell_cast` trigger is also not modeled — the row is offered unconditionally, and the only automatic `spell_cast` consumer targets the PC caster themselves.

## Expected Behavior (manifest verbatim)
"Immediately after a creature casts a spell targeting you or including you in its area, take Reaction to force Intelligence save (your spell save DC). On failed save, negate spell and steal knowledge of spell (level 1+, of a level you can cast). For 8 hours you have the spell prepared. Creature can't cast it until 8 hours pass. Once per Long Rest."

(app-data wording is identical: `public/data/2024/classes.json` Rogue → majors[0] Arcane Trickster → features[4], automation {type:spell_thief, saveType:INT, saveDc:ability, saveAbility:INT, trigger:spell_cast, oncePerLongRest:true, casting_time:'1 reaction'}. Spell Thief is 2024-only — absent from `public/data/classes.json`.)

## Actual (clause-by-clause, live-proven 2026-09-06)
- LIVE + EXACT (b) INT save vs rogue spell DC: row click → "Saving Throw Required — Gazer 1 must make a INT saving throw. DC 14" (8 + INT +0 + PB +6, verified); `save_result` logs "rolled 17 +-4 = 13" (fail), "8 +-4 = 4" (fail), tie "18 +-4 = 14" treated as success (RAW-correct).
- LIVE + EXACT (f) Once-per-Long-Rest: `spellthiefUses` 1→0; 2nd click → popup "Spell Thief has no uses remaining. Recharges after a Long Rest." with zero log/save delta; Long Rest resets 0→1 and nulls all block/stolen keys incl. caster-side `_spellThiefCasterBlock` (restRules-longRest.js:184-218; verified after ~12s debounce).
- LIVE + EXACT logs + resources: `ability_use` + `roll` entries on both branches; use spent even on caster save-success (reaction taken = spend, RAW-OK).
- DEAD (c) "negate spell": DECISIVE probe — enemy Frost Ray hit AasimarTest for damage (DEX save fail 1+8=9 vs DC12, HP 122→116 via hp_change), then Spell Thief taken, Gazer failed INT save (13 vs DC 14), log claims "Spell negated." — HP stayed 116→116. No rollback/negation consumer exists: handler (spellThiefHandler.js:113-124) only writes keys + log; grep `spellThiefBlocked` outside handler/restRules = ZERO consumers. Reaction can only be taken after the monster pipeline already resolved damage.
- DEAD (e) "Creature can't cast it until 8 hours pass": block keys written (`spellThiefBlocked_Gazer 1_3. Frost Ray:true`, Gazer-side `_spellThiefCasterBlock`), yet CONTROL PROBE: blocked Gazer recast "3. Frost Ray" 4 consecutive times at the same rogue — fresh prompts + 4 fresh `save_result` log lines (23/17/25/15 vs DC 12), no refusal anywhere. Sole consumers: `spellCalc2024.js:480` filters the key out of PC spell lists (monsters never run spellCalc) and `postCastRiderService.js:217` calls `isBlockedBySpellThief(self, self, …)` — self-vs-self only. `hasStolenSpell` = zero consumers outside the handler.
- DEAD/COSMETIC (d) "have the spell prepared for 8 hours": stolen spell injected prepared:'Always' (`spellCalc2024.js:490`) and the row appears after reload ("3. Frost Ray … Utility"), but the injected entry is `{name, prepared}` only — no level/school/damage — row click opens NO SpellDetailPopup → the stolen spell cannot be cast, castable at no level, and its name ("3. Frost Ray") doesn't exist in spells.json anyway.
- NOT ENFORCED (a) trigger gate: the Reactions row is listed unconditionally (`automationRouter.js:498` → `result.reactions.push(info)`; CharReactions.jsx:78-83 adds every `automation.reactions` entry with no `spell_cast` gate). No `spell_cast` event producer for enemy/monster casts exists. The only auto-consumer `triggerSpellThief` (`spellCastService/execution/index.js:627`, `postCastRiderService.js:212-263`) fires only when a PC casts a slot spell and builds `casterName: playerStats.name` — i.e. the thief forcing THEMSELVES to save against their own DC.

## Steps to Reproduce
1. AasimarTest = Arcane Trickster lv17 (2024; INT 11/+0 → spell DC 14). Reactions section shows "Spell Thief:" row at all times, even outside combat trigger context.
2. EB → search "Gazer" → tick → Join Encounter; initiative card target-select = AasimarTest.
3. Gazer avatar → `.mc-overlay` → `.mc-dice-link` idx 11 ("3. Frost Ray", 3d6 DEX DC12) → Roll Save on AasimarTest prompt; repeat until SAVE FAILURE (raw ≤3 vs +8; occurred at cast #4/attempt #6) → damage lands, HP drops.
4. AasimarTest sheet → click "Spell Thief:" → INT DC14 prompt on Gazer 1 → Roll Save (INT −4 fails <18) → Done → log "Spell negated… steals 3. Frost Ray for 8 hours" but HP unchanged (no rollback).
5. Control: re-open Gazer card, click same ray again (×4) — recasts resolve normally despite active block keys.
6. Reload AasimarTest sheet → stolen "3. Frost Ray" row present but click = nothing (uncastable).
7. Click "Spell Thief:" again (uses=0) → "no uses remaining" popup; Long Rest → uses=1, all keys cleared.

## Likely Location
- `src/services/automation/handlers/class-fighter-rogue/spellThiefHandler.js` — writes keys/logs only; needs a negation/damage-rollback leg or the negation clause should be removed from expectations.
- `src/services/rules/spells/spellCastService/execution/index.js:627` + `src/services/rules/spells/postCastRiderService.js:212-263` — auto-trigger wired PC-self only (`casterName: playerStats.name`); no enemy-cast `spell_cast` producer; gate `isBlockedBySpellThief(name, name, …)` self-check meaningless.
- `src/services/rules/core/spellCalc2024.js:480-502` — block filter runs on PC lists only; stolen-spell injection lacks spell data → uncastable row.
- `src/components/char-sheet/CharReactions.jsx:78-83` + `src/services/combat/automation/automationRouter.js:498` — row listed ungated (no `spell_cast` trigger state).
- Manifest handler/router/infoBuilder paths (`src/services/combat/automation/handlers/classFeatureHandler.js`, `routers/classFeatureRouter.js`, `infoBuilders/classFeatureInfoBuilder.js`) DO NOT EXIST — stale/fictitious.
- Data nit: stolen spell name captured as monster action label "3. Frost Ray" (lastAttack.attackName), not a spells.json entry.

## Notes
- Live clauses: reaction click, INT save vs rogue spell DC (exact incl. tie=success), logs, uses accounting, once-per-LR gate + LR re-arm + full key reset.
- Dead clauses: negate (no rollback, decisive HP 116→116 after "negated"), caster 8h block (4 successful recasts by blocked caster + zero monster-path consumer), stolen-spell castability (display-only injected row), spell_cast trigger gating (row always offered; auto-path is self-targeting misfire).
- Per verdict policy (unenforced trigger/gates/claims = FAIL), filing FAIL.

## Fix options

Run 2026-09-07. THREE of four dead clauses FIXED cleanly on top of existing verified
patterns; one clause (e) requires new monster-path infrastructure with zero precedent →
left as options below. Verdict SKIPPED (partial: core negation/castability/trigger now
enforced; monster recast-block not enforced).

### FIXED this run (live-proven on test-campaign)
- (c) NEGATE — clean fix available, DONE. On failed INT save the handler now calls the
  verified Counterspell consumer `rollbackSpellEffects(attackEvent, …)`
  (damageRollback.js:250, same retroactive-negation model as Shield
  shieldHandler.js:36 / Illusory Self / Glorious Defense — engine never intercepts
  pre-damage, it rolls back). Live: ray damage −4 → popup "4 HP restored" → runtime HP
  139→143, log `ability_use` "Spell Thief negated 'Frost Ray' — 4 HP restored…".
- (a) TRIGGER GATE — clean fix available, DONE. Reaction-row click now gated in
  spellThiefHandler.js against lastAttack (Counterspell gate + CLA-315 Slow Fall refusal
  pattern): requires combat, spell-origin (`rollType==='spell-save' ||
  isSpellDamage===true || saveType+saveDc` — monster-card save attacks stamp
  isSpellDamage per CLA-324), caster ≠ thief, thief targeted (targetName or
  affectedTargets), caster in cs. Refusals spend nothing and log
  `automationType:'spell_thief_refused'`. Live: ray cast at DivinationWizard then row
  click → "the most recent spell did not target you", uses=1 retained, refusal logged.
  - Auto-path self-misfire in `triggerSpellThief` (postCastRiderService.js) REMOVED —
    it ran in the caster's own cast context (thief saving vs own DC, stealing from
    self); now an inert documented stub; manual Reactions row is the sole driver.
- (d) STOLEN-SPELL CASTABILITY — clean fix available, DONE. spellCalc2024.js injection
  now mirrors the verified Improved Illusions full-detail pattern
  (`{...spellDetail, prepared:'Always'}`) after normalizing monster-card labels
  ("3. Frost Ray" → "Frost Ray"); block-filter normalizes too (legacy numbered keys).
  Live: resolvable stolen name "Ray of Frost" renders with full popup details and an
  ENABLED "Cast Spell" button (castable); unresolvable monster-only labels ("Frost Ray"
  has no spells.json entry) stay a display-only row with explicit console.error (no
  silent fallback). Caster-side keys now store the normalized name, so the PC-path
  spellCalc block filter (spellCalc2024.js) actually matches.
- Regression tests: spellThiefHandler.test.js (gate refusals incl. spend-nothing,
  rollback call/no-call, label normalization), spellCalc2024-automation.test.js
  (full-data injection, label normalization, display-only+console.error, block filter),
  postCastRiderService.test.js (self-misfire inert). `npm run lint` clean; full
  `npm run test:run` 31396 passed / 0 failed.

### (e) CASTER 8-HOUR BLOCK ON MONSTER PATH — requires new pipeline (NOT done)
- Facts: enforcement would need a click-time block check inside the EB monster-card
  pipeline (MonsterCardBody/MonsterAction/saveProcessing) — grep shows ZERO block-key
  consumers there today; playbook concurs ("blocked-caster keys have NO monster-path
  consumer … grep before assuming"). Silence/CLA-315 gates are PC-cast-path only;
  PC-block (spellCalc row filtering) IS enforced and was improved (normalized match).
- Option 1 (small new seam, mirrors nothing existing): on monster-card save/attack
  click, read `getRuntimeValue(monsterName,'_spellThiefCasterBlock')`, match the
  normalized action label, refuse with popup + `automation blocked` log (mirrors the
  SP-106 Silence V-gate refusal *shape*, but at a new location — first-ever monster-card
  block consumer; GM bypass via card remains). Trade-off: invents the seam; any other
  feature would later reuse it, so design it generic (e.g. `blockedActions`), not
  Spell-Thief-specific.
- Option 2 (accept model): treat monster recast-block as GM-remembered (row shows
  "cannot cast for 8h" log as advisory), like other display-only monster facts
  (resistances/senses precedents, CLA-336). Cheapest; keeps the engine honest about
  what it enforces.
- Option 3: prevent row-click steals from monster-only-label spells ("level 1+, of a
  level you can cast" gate needs level data on lastAttack stamps — monster stamps carry
  none), tightening RAW exposure of (e) instead of enforcing it. Needs a level stamp on
  monster save-attacks (small CLA-324-style caller flag).
