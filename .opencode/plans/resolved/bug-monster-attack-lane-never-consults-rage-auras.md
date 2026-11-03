# Rage auras (Lion et al.) are never consulted for monster-card attack rolls — the aura's primary RAW audience is unaffected

## Summary
Monster-card attack rolls never consulted the rage-aura utils, so a hostile monster attacking from within 5 ft of a raging Lion (Power of the Wilds) bearer rolled `mode:"normal"` — the aura's principal RAW audience ("any of YOUR ENEMIES within 5 feet of you have Disadvantage on attack rolls against targets other than you") was structurally unaffected. Fixed by consulting `getLionDisadvantageAgainst` in `MonsterCardModal.handleAttack` with the same players-vs-placedItems census as the PC lanes, folding Disadvantage into `forcedMode` (adv+dis cancel to normal, mirroring `getNetAttackMode`), and logging an `lion_aura_disadvantage` automation entry on every triggered press. Regression-locked by `MonsterCardModal.rage-aura.test.jsx` (9 tests) and verified live on 5 faces in test-campaign.

## Steps to reproduce
1. In `test-campaign`, activate the "Battle Arena" map (it has party tokens; EF@(1,8), FR@(9,8) plus any bearer token — drop or full-doc-PUT `ElderPaladin` at (2,8) into `players[]`).
2. Stamp the bearer `ElderPaladin` with the Lion rig (change-data full-store POST `/api/campaigns/test-campaign/ElderPaladin` `{value:{activeConditions:[], activeBuffs:[{name:'Rage',effect:'stance',optionName:null},{name:'Power of the Wilds',effect:'power_of_wilds_option',optionName:'Lion',range:'5 ft',duration:'while_raging'}], selectedAllies:['AberrantSorcerer']}}`) and re-select the campaign so tabs adopt it.
3. PC control face (proves the aura lane is live): on EvasiveFighter's sheet roll the Shortbow **+7** cell against FeyRanger → log entry `mode:"disadvantage"`, popup "d20 a, b → min" + "Disadv (conditions)" chip (EF is off the bearer's edited list = enemy).
4. Monster face: Encounters → search "Goblin" → select → Join Encounter; on the Goblin's initiative card arm target FeyRanger, then click its Scimitar **+4** chip.

## Expected behavior
Per the fix's own doctrine (and RAW 2024 Power of the Wilds — Lion "any of your enemies within 5 feet of you have Disadvantage…"), the Goblin — a monster-token combatant, off the party census, attacking a target other than the bearer — should roll with `mode:"disadvantage"`, same as the PC enemy attacker in step 3.

## Actual behavior
The Goblin rolls `mode:"normal"` — single-die truth: log entry `{characterName:'Goblin', targetName:'FeyRanger', mode:'normal', rolls:[19,10], total:19}` and popup "d20 19 +4" with no Disadv chip, in the SAME session/bearer/target face where the PC enemy attacker paid disadvantage. Zero console errors. Machine proof by code: `grep -rln getLionDisadvantageAgainst src` → only `lionAuraUtils.js`, `contextBuilder-map.js`, `contextBuilder-sync.js` (all non-test); MonsterCardModal computes `forcedMode` exclusively via `combineAttackModes` (:2379) + range/condition helpers (:1131/:1521/:1534).

## Likely location
Confident (code + live both): the mode-source for monster-card attacks — `src/components/encounter/MonsterCardModal.jsx` (~line 2379 `combineAttackModes`, helpers `resolveForcedMode` :1131, range dis :1521, bolstered adv :1534) has no aura call. The aura utils themselves are fine; they are simply never fed monster rollers. `useLoggedDiceRollAttack.js:117` takes `ctx.forcedMode || 'normal'` from whatever context the caller built — the monster card caller never enriches it with map-lane auras.

## Suggested fix
In the monster attack resolution (the same place `combineAttackModes` runs), await `getLionDisadvantageAgainst({ attackerName: monsterName, targetName, campaignName, mapData })` — wolf/duplicity likely belong there too (a raging PC ally bearer should give monsters no advantage; the wolf's ADV lane is ally-side so Lion is the pressing one) — and fold the result into `forcedMode` with the existing merge precedence (adv+dis = normal? mirror `computeD20Roll` conventions). Reuse the contextBuilder-map census so placedItems vs players doctrine stays byte-identical. Also fix the now-inaccurate "monster attacker … still gets the Disadvantage" comment in `lionAuraUtils.js` unless this fix lands with it. Investigation needed on where mapData is available in the monster lane (MonsterCardModal may not hold map state — contextBuilder threads it from CharActions).

## Severity
Broken feature — the aura's principal RAW audience (adjacent hostile monsters) is entirely unaffected; GMs running Wild Heart barbarians get wrong dice every monster turn next to the bearer. Not a data-integrity risk (no corruption, just missing penalty), but rules-incorrect combat outcomes. Note this predates the ally-penalty fix (which itself is verified-working for PC rollers); this file documents the complementary half of the RAW clause.

## Resolution
**FIXED 2026-11-03.** The diagnosis was confirmed exactly: `MonsterCardModal.handleAttack` computed `forcedMode` solely via `combineAttackModes` + the range/condition helpers, and the aura utils were imported only by the PC sheet-roller context builders.

What changed:

- `src/components/encounter/MonsterCardModal.jsx`
  - New module helpers beside `resolveForcedMode`: `hasLionBearerInScene` (synchronous census fast-path gate), `resolveMonsterLionAura` (exported — builds the util call-opts mirroring the PC lanes' census doctrine: `mapData` present → players[] party census; monster token in placedItems[] → MEASURED bearer↔attacker distance via the util's `isWithinRange`; tokenless attacker or no map → `skipRangeCheck: true` leniency, same lane choice as `contextBuilder-sync.resolveLionAura`), and `foldAuraDisadvantage` (exported — adv+dis cancel to normal, dis sticky, mirroring `getNetAttackMode`).
  - `handleAttack` is now `async`: AFTER every refusal gate, and ONLY when a Lion-buff bearer exists in the party census (buff-stamp scan over `mapData.players` / cached `getCombatSummary` — zero-cost passthrough otherwise, which keeps the roll's microtask placement byte-identical for the ~40 sibling click→assert suites AND for campaigns without a Wild Heart bearer), it awaits `getLionDisadvantageAgainst`, folds the result into `forcedMode`, and logs an `automation` entry (`automationType:'lion_aura_disadvantage'`, bearer + action named) on every triggered press.
- `src/services/combat/auras/lionAuraUtils.js` — doctrine comment updated: the "monster attacker … still gets the Disadvantage" clause is now reachable, with `MonsterCardModal.resolveMonsterLionAura` named as the monster-lane consumer.
- **Wolf/duplicity deliberately NOT wired into the monster lane** (the suggested "likely belong there too"): both are ADVANTAGE lanes gated on `bearerSupports(attacker)` which, for an unedited bearer, returns true for EVERYONE including hostile monsters — feeding them monster rollers would grant hostile monsters unearned Advantage (rules-wrong). A proper monster-side wolf lane needs an attacker-hostility gate first; that's a separate ticket. Lion (a debuff on the attacker) is the complete RAW-compliance fix here, matching Priority Target 1's acceptance ("hostile monster token within 5 ft of Lion bearer rolls mode:disadvantage via card chip; PC ally face stays normal; doctrine comment updated").
- Dual-ruleset: `lionAuraUtils` + `MonsterCardModal` are shared across 5e/2024 (Power of the Wilds is 2024-only data); no twin module needed the fix.

Verification:

- Vitest: new `src/components/encounter/MonsterCardModal.rage-aura.test.jsx` — 9/9 PASS (render seam: hostile monster folded to `forcedMode:'disadvantage'` + grant log; adv→normal cancel-forward; no-aura byte-inert; no-bearer sync passthrough keeps `rollAttack` synchronous; lane-census units: measured map lane passes `mapData` without `skipRangeCheck`, tokenless passes `skipRangeCheck`; fold precedence units). Full suite green: 919 files / 9186 tests (`vitest run src/components/encounter src/services/combat/auras src/services/automation` matched the whole repo). `npm run lint` — zero warnings (after hoisting the log callback out of `handleAttack` to stay under the complexity-15 cap).
- Live re-verification (test-campaign, :5173, rig: EP@(2,8) Lion bucket-stamp, EB-joined Goblin with token, Battle Arena active; ALL faces machine-read from `/api/campaigns/test-campaign/log`):
  - Face A (acceptance): Goblin token (2,7) adjacent to bearer, armed FeyRanger, Scimitar chip → log `{mode:'disadvantage', rolls:[16,8], total:8, hit:true}` + popup "d20 16, 8 → 8" + "Disadv (conditions)" chip + NEW `lion_aura_disadvantage` automation entry naming ElderPaladin. (Pre-fix same rig: `mode:'normal'`, rolls single-die — reproduced first.)
  - Face B (measured gate): Goblin moved to (13,8) → `mode:'normal'`, zero new aura logs (auto-miss "56 ft > 8 ft" range notice intact).
  - Face C (self-target exclusion): adjacent Goblin armed on the BEARER → `mode:'normal'`, zero new aura logs.
  - Face D (ally face stays normal): bearer list flipped to include EvasiveFighter, campaign re-selected → EF Shortbow +7 vs FeyRanger `mode:'normal'` (on-list exempt; PC lane unchanged by the fix).
  - Face E: after the flip, monster face still `mode:'disadvantage'` + fresh aura log (off-list monster remains hostile).
- Cleanup: battle-arena byte-restored — on-disk md5 `94fcd0bfe9e4cf6e1118f736b920e7a2` == CL baseline fingerprint; Admin panel Clear Change Data + Clear Campaign Log; closed-tab two-pass quiet (`change-data {}`, `log []`, `combatSummary null`); console: zero errors.
