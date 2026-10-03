# BUG CLA-048 — Celestial Revelation: extra-damage rider INERT (FAIL(b))

**Verdict:** FAIL(b) — once-per-turn +Proficiency-Bonus extra damage (Radiant/Necrotic) never lands on any hit.
**Host:** AasimarTest (test-campaign), lv20 2024 Rogue (Arcane Trickster), race Aasimar, PB +6. 2024 Aasimar has NO subrace — option is chosen each transform; no wizard edit was needed.
**Date:** 2026-10-03. No disk/character edits made; runtime+log admin-cleared after run.

## Manifest vs real chain (manifest stale)
- Data: `public/data/2024/races.json` Aasimar traits:
  - traits[4] `Celestial Revelation` automation `{type:'celestial_revelation', options:['Heavenly Wings','Inner Radiance','Necrotic Shroud'], chooseOne:true, recharge:'long_rest', casting_time:'1 bonus action', minLevel:3}`
  - traits[5] `Heavenly Wings` automation `[temp_buff fly_speed_equals_walk_speed 1_minute, attack_rider {damageExpression:'proficiency_bonus', damageType:'Radiant', trigger:'hit', oncePerTurn:true}]`
  - traits[6] `Inner Radiance` automation `damage_aura` ONLY — **no attack_rider in data** though feature text grants a Radiant rider (data gap).
  - traits[7] `Necrotic Shroud` `[save_attack CHA→frightened emanation_10_ft, attack_rider {damageExpression:'proficiency_bonus', damageType:'Necrotic', oncePerTurn:true}]`
- Activation: `automation/index.js:494 celestial_revelation → celestialRevelationHandler.js handle()` (level + `_celestialRevelationUses` gate) → modal `celestialRevelation` (`CelestialRevelationModal.jsx` radios, names verbatim) → `confirmCelestialRevelation()` (latch consume, `_celestialRevelationOption` stamp, toggleBuff, addExpiration, per-option dispatch).
- Rider consumer: `src/services/combat/steps/attackRollBonuses.js:424 buildCelestialRevelationStep()` wired at `attackRollDamageSteps.js:23` (subscribe `n20:applied`, emit `celestial:applied`; downstream `attackRollPostDamage.js:17`). NOT `classFeatureHandler.js` (manifest stale — handler lives in `handlers/class-sorcerer/`).

## Root cause (live + static)
`buildCelestialRevelationStep` calls `rollExpression(rider.damageExpression)` directly on the raw token `'proficiency_bonus'`:
- `src/services/dice/diceRoller.js rollExpression → parseExpression` only accepts `NdM`/constants → `rollExpression('proficiency_bonus') === null`.
- Handler then hits `if (r) {...}` → false → silently returns `{ data: {} }`: no formula append, no `_Heavenly_Wings_usedRound` stamp, no log. Rider dead on EVERY hit.
- The proper resolver EXISTS: `src/services/combat/automation/automationExpressions.js:144` (`resolveDiceExpression` maps `/proficiency_bonus/g → v.prof`) — this step never calls it (CLA-016 `rollExpression('rogue_level')=null` inert family). Sibling step `buildNatural20BonusesStep` resolves first (`resolveNatural20Expression`), the celestial step does not.
- Live proof of rider presence at failure time: fiber probe of `playerStats.automation.passives` contained `{name:'Heavenly Wings', damageExpression:'proficiency_bonus', damageType:'Radiant', oncePerTurn:true, trigger:'hit'}` and activeBuffs contained the Heavenly Wings buff — guards were satisfiable; only the roll resolution failed.

## Live evidence (test-campaign, :5173)
- Leg A PASS: Bonus Actions row `Celestial Revelation:` → chooser modal lists 3 radios verbatim ("Heavenly Wings / Inner Radiance / Necrotic Shroud"), helper line "Extra damage: Proficiency Bonus (6) of Radiant type per turn". Transform → sheet Speed becomes `30 ft., fly 30 ft.` + badge "Heavenly Wings Active"; change-data: `_celestialRevelationUses: 0`, `_celestialRevelationOption:'Heavenly Wings'`, `activeBuffs[{name:'Heavenly Wings', effect:'fly_speed_equals_walk_speed', duration:'1_minute'}]`.
- Refusal gate PASS: row re-click → popup "Celestial Revelation has been used and cannot be used again until a Long Rest."
- **Leg B FAIL (decisive):** Shortsword attack vs EB-joined Bandit 1 (AC12, HP 11→0): attack log `d20 19 +8 = 27 vs AC 12` ✓ HIT; damage log formula **`"1d6+2 [piercing] + 10d6 [Sneak Attack]"` total 48**, hp_change `damageBreakdown:[{damageType:'Piercing', amount:48, resisted:false}]`. **No `+ proficiency_bonus [radiant]` / +6 Radiant term anywhere; `_Heavenly_Wings_usedRound` never stamped (GET: None).** Expected: `(1d6 + 2) + 6 radiant` rider term.
- Leg C vacuous: rider never applies, so "once per turn" trivially holds (latch stamp also never written).
- Leg D structurally absent: grep-zero celestial consumer outside the attack pipeline (`attackRollBonuses.js`, its tests, `attackRollPostDamage.js` subscriber) — spell damage lane ("...with an attack **or a spell**") has no consumer at all. Host's Mind Sliver row would show it.
- Leg E PASS: Long Rest → `_celestialRevelationUses: None` (re-arm via LONG_REST_RESOURCES restRules-constants.js:125), buffs + pendingExpirations purged.
- **Leg E2 RAW deviation:** Short Rest RE-ARMS the once-per-LR latch — `_celestialRevelationUses` is listed in **SHORT_REST_RESOURCES (restRules-constants.js:81)**; live Complete Short Rest flipped latch `0 → None` and the chooser re-opened (second transform same day post-SR). races.json declares `recharge:'long_rest'` only. (Side note: the same SR purged the Heavenly Wings buff — correct-by-accident for a 1-minute buff, but by rest, not by clock.)
- Leg F gap (CLA-033 expiryRounds:null family): activation logs comment "1 minute = 10 rounds" but calls `addExpiration` with no `rounds` → clock entry captured live: `{target:'AasimarTest', effects:[{type:'remove_active_buff', buffName:'Heavenly Wings'}], appliedRound:1, expiryRounds:null}` → Infinity; buff survived >1 min, removal only via rest. No "end transformation early" affordance observed.
- Cosmetic/log hygiene: activation produced TWO `ability_use "Heavenly Wings used"` entries (confirmCelestialRevelation addEntry + attackRiderHandler.logRiderUse) and result popup concatenated the misleading ready-line: "Heavenly Wings has been used and cannot be used again until a Long Rest.. Heavenly Wings ready. The next eligible attack will apply it." (zero-damage affordance lie).
- Noise (not celestial): first-hit flow additionally surfaced a Devious Strikes chooser (auto-offered without Sneak Attack trigger proof — Cunning Strike lane, out of scope) and a stale CON DC16 save prompt for Bandit 1 in the queue; Dismiss/Cancelling them did not change the celestial outcome (rider terms absent regardless).

## Fix recipe
`buildCelestialRevelationStep` (attackRollBonuses.js): resolve before rolling —
`const expr = resolveDiceExpression(rider.damageExpression, ctx.playerStats /*, ... */)` (or numeric fold of `ctx.playerStats.proficiency`) then `rollExpression(expr)`; append `+ <resolved> [radiant|necrotic]`. Optionally stamp latch only when r is truthy (already so). Also: remove `_celestialRevelationUses` from SHORT_REST_RESOURCES (restRules-constants.js:81); add `attack_rider` Radiant block to races.json Inner Radiance automation (+ handler parity in TRANSFORMATION_EFFECTS dispatch); pass `rounds:10` to addExpiration for the 1-minute clock; dedupe the double ability_use log. Spell-origin leg needs a consumer seam in the spell-damage pipeline (or downgrade wording).

## Cleanup
Admin Clear Change Data + Clear Campaign Log (native confirms captured, test-campaign named verbatim; API-empty GETs: log=[], change-data=[]). Bandit removed with cs. No wizard/disk edits. Host AasimarTest ready, untransformed, latch fresh.
