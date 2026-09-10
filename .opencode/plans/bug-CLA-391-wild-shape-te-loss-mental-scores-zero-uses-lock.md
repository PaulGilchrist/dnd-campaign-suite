# bug-CLA-391-wild-shape-te-loss-mental-scores-zero-uses-lock.md

## Title
CLA-391 Wild Shape (Druid, 2024): campaign `wild_shape` te write lost on every re-activation (Long-Rest cleanup never runs), form stat-block view does not retain INT/WIS/CHA, and at 0 uses the feature cannot be manually dismissed; blocked spellcasts silently burn slots.

## Overview
CLA-391 Wild Shape was verified live end-to-end on Wild_Sage_Druid (lv20 Druid, Circle of the Stars, rules=2024, test-campaign). The trigger/chooser/economy core is LIVE and numeric-exact vs app data: bonus-action `b.clickable "Wild Shape:"` row → `buffHandler.js` uses-gate → `wild_shape_select` → `PolymorphSelectionModal` (CR ≤ 1, fly allowed, beast-only, 72 rows) → `activateWildShape` spends `wildShapeUses` (4→3→2→1→0 across runs), grants `tempHp` = druid level (20), writes `activeBuffs` shape_shift (`blocksSpellcasting:true`), cs `beastName/beastIndex/wildShapeSource`, logs `ability_use` activation/deactivation, refusal popup at 0, Short/Long Rest re-arm uses (null→max 4), toggle-OFF ends the form (te/buff/THP/cs-marks cleared) — all curl-confirmed. However three canonical clauses are broken with live signatures, so the row cannot PASS.

## Expected (canonical quote, manifest CLA-391 / classes.json lv2 feature text)
"Your game statistics are replaced by the Beast's stat block, but you retain your creature type, Hit Points, Hit Point Dice, Intelligence/Wisdom/Charisma scores, class features, languages, and feats. No Spellcasting."
"You stay in that form for a number of hours equal to half your Druid level or until you use Wild Shape again, have the Incapacitated condition, or die."

## Actual (live evidence, self-issued curl/evaluate only)
1. **te persistence lost on every activation after the first.** First-ever activation persisted `targetEffects:[{effect:'wild_shape',…}]`; every later activation in every later session server-side `targetEffects` stayed `[]` while buff/THP/uses/cs-marks wrote fine (4 reproduced cases). Root cause fingerprint = playbook 44d: `wildShapeCreatureBuilder.js:111-118` does `getRuntimeValue('campaign','targetEffects')` then `push` IN PLACE and passes the SAME array to `setRuntimeValue`; `useRuntimeState.js valuesEqual` returns true on `a===b` → POST skipped once the store holds a hydrated array.
   - Downstream: Long Rest ends Wild Shape **te-driven** (`restRules-longRest.js:306-321`) → with te empty LR cleanup NEVER runs. Live: after the sheet Long Rest, change-data kept `combatSummary.creatures[Wild_Sage_Druid].beastName:'Rat'` (+ initiative card titled "Rat") while tempHp/buffs correctly cleared.
2. **INT/WIS/CHA NOT retained in the form stat block.** Clicking the shifted druid's initiative avatar renders the merged beast block with the BEAST's mental scores: Rat INT 2 (−4), WIS 10 (+0), CHA 4 (−3). Druid's actual scores are INT 9 / WIS 16 / CHA 9 (disk baseScore+backgroundIncrease). `createNpcClickHandler.js:52-58` reads `abilities.find(a=>a.name===…)?.score`, but raw character ability entries carry `baseScore` (+featIncrease/backgroundIncrease), never `score`; `computedStats` is absent from the characters passed in. Languages DID merge (`Common, Druidic`) — proving the druid lookup succeeded and only the ability `.score` read is dead. STR 2 / DEX 11 / CON 9 / AC 10 / speed walk-climb 20 ft replaced correctly and `Hit Points 143` retained (HP pool ✓). The viewer block also prints type "Tiny Beast" (canonical: retain Humanoid type — the clone keeps the beast's type).
3. **0-uses lock: cannot dismiss the form.** `buffHandler.js:143-156` checks `currentWS <= 0` and refuses BEFORE `toggleBuff`, so at uses=0 the OFF branch is unreachable. Live: at `uses:0` with `buffs:['shape_shift']` + `tempHp:20`, clicking the Wild Shape row returned popup "Wild Shape: No Wild Shape uses remaining." and buff/THP persisted (escape hatch only via Short Rest, see #4).
4. **Short Rest collateral.** `restRules-shortRest.js:244-248` filters activeBuffs to only 'Mage Armor' — short rest silently strips the shape_shift buff while `tempHp:20` and cs Rat marks SURVIVE (live post-SR: `buffs:[]`, `tempHp:20`, `cs:['Rat']`). SR also restores uses to FULL (null→4) where canonical restores 1 (app-model divergence, `SHORT_REST_RESOURCES`).
5. **Blocked spellcasting is silent + burns the slot.** While shifted, Entangle: Cast Spell → slot `spell_slots_level_1` 4→3, ZERO new log lines, ZERO popup; cantrip Guidance likewise zero delta (control cast after OFF produced its normal spell log). Consumer exists (`execution/index.js:51` bare `return`, `spellResolution.js:32` `blockedByBuffs`) but no refusal popup/log — AGENTS.md logging gap + §4 convention says refusals must log (`*_refused` shape).
6. **Duration / known-forms / incapacitated clauses record-only.** Duration stored as `half_druid_level_hours` with NO expiration registrant (no clock); the display formatting is additionally WRONG — `CharClassFeatures.jsx:154-158` computes `floor(wild_shape_uses/2)` ("2 hours" at lv20) instead of half of Druid level (10 hours). `beast_known_forms` (8 at lv20) is display-only ("Beast Forms Known: 8" on sheet); the chooser lists ALL 72 CR≤1 beasts with no known-form selection/replace-on-LR. No Incapacitated/death end-form consumer (grep zero in class-druid + expire/clearExpiration + turn-end seams).

## Steps
1. Dev server (:5173), select test-campaign, open Wild_Sage_Druid (lv20 2024 Druid, Circle of the Stars).
2. Click `b.clickable "Wild Shape:"` → chooser "Choose a beast form (CR 1 or lower)", Movement "walk, swim, or fly" → pick Rat → Wild Shape. Verify uses 4→3, tempHp 20, buff shape_shift (first time also te).
3. Toggle OFF, then re-activate → server `targetEffects` stays `[]` (curl `/api/campaigns/test-campaign/change-data`).
4. Continue until uses=0 with buff active → click the row again → refusal popup, buff/tempHp never clear.
5. Long Rest → `wildShapeUses:null` re-armed, but `combatSummary…beastName:'Rat'` persists (te-driven cleanup skipped).
6. Initiative page → click shifted druid avatar → block shows Rat INT 2/WIS 10/CHA 4 vs druid disk 9/16/9.
7. While shifted cast Entangle → lv1 slot −1, no log, no popup.

## Likely Location
- `src/services/automation/handlers/class-druid/wildShapeCreatureBuilder.js:111-118` (in-place te push → `useRuntimeState.js:7 valuesEqual` `a===b` skip; fix = new-array spread per 44d recipe).
- `src/services/automation/handlers/buffs/buffHandler.js:143-198` (uses-0 gate placed before toggleBuff — gate only the ON leg; allow OFF cleanup regardless of uses).
- `src/components/initiative/createNpcClickHandler.js:52-58` (`.score` vs raw `baseScore`+increases; use computed score or fallback baseScore+increases).
- `src/services/rules/effects/restRules-shortRest.js:244-248` (shape_shift buff stripped on SR without THP/cs-mark cleanup; canonical SR restores 1 use, not full).
- `src/services/rules/spells/spellCastService/execution/index.js:51` + `spellResolution.js:32` (silent block; add popup + `*_refused`/automation block log).
- `src/components/char-sheet/char-summary/CharClassFeatures.jsx:154-158` (duration formula uses uses/2, not level/2).

## Notes
- Manifest paths (classFeatureHandler/Router/InfoBuilder) are fictitious (playbook §1); real chain: CharBonusActions `b.clickable` → `useCharActionsAutomation` → `automation/index.js temp_buff→handleBuff` (buffHandler.js:143) → `wild_shape_select` popup → `CharSheet.modals.jsx:43` → `PolymorphSelectionModal` → `CharSheet.jsx:40 handleWildShapeConfirm` → `activateWildShape`.
- App-data divergences judged as such, not counted as bugs by themselves: lv20 max uses 4 (`wild_shape:4` lv17-20, canonical "twice" is lv2-5), fly at lv8+, CR cap via `beast_max_cr`.
- Form attacks never surface in the initiative card (SP-103 precedent) — "stats replaced" is thus proven only through the viewer block + viewer defects above; no combat pipeline consumer exists for beast attacks.
- Cleanup done: Admin clear change-data (`{}`) + log (`[]`) verified via curl; dev servers killed (ports 000).
