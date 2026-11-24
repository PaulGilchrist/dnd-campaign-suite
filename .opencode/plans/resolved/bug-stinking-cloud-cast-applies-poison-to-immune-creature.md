# Cast-time condition-AoE applies Poisoned to a poison-IMMUNE creature (zone turn-start lane correctly skips the same creature)

## Summary
Stinking Cloud cast from the sheet on FixtureLandDruid (2024 Circle of the Land Druid — the engine's own 2024 classes data carries "Immune to Poisoned condition" for this circle) prompts a CON save and, on a failed save, applies the Poisoned condition plus the stinking_cloud/no_action_and_bonus_action targetEffect rows. The zone turn-start recurring-save lane in the SAME engine skips that exact creature via `playerIsImmuneToCondition` (verified live as the differential in the same session) — the cast-time lane has no immunity gate at all.

## Steps to reproduce
1. In `test-campaign`, Initiative mounted; overlay armed as DivinationWizard's target (same rig as `bug-aoe-evasion-success-pays-half-damage`, though any Stinking Cloud cast works).
2. Open the DivinationWizard sheet, press `Stinking Cloud` → `Cast Spell`; in the picker deselect the auto-preselected FeyRanger and select `FixtureLandDruid` only; confirm `Cast Stinking Cloud (1)`.
3. A "Saving Throw Required — FixtureLandDruid must make a CON saving throw (DC 19)" prompt arms (expected: an immune creature is never put through the save). Roll Save — rolls 3 + 2 = 5 vs DC 19 → SAVE FAILURE. Done.
4. Read change-data: `FixtureLandDruid.activeConditions` and `targetEffects`; then press `Next →` until FixtureLandDruid's turn starts.

## Expected behavior
Poisoned cannot be applied to a creature with the Poisoned immunity (`playerIsImmuneToCondition`, `src/services/combat/automation/automationImmunities.js` — the same check chain `stinkingCloudHandler.js:90` runs at turn start with the real threaded PlayerStats from `8c314c468`). Either the picker/prompt should skip immune creatures the way the zone sweep does, or a failed save must land an honest immunity annotation with NO condition/te application.

## Actual behavior
- Save prompt mounted normally; on fail, log rows: `save_result :: FixtureLandDruid failed CON save (DC 19, rolled 3 +2 = 5)` and `save_result :: FixtureLandDruid failed CON save against Stinking Cloud and is Poisoned.`
- Disk/store truth right after: `FixtureLandDruid` bucket `activeConditions: ["poisoned"]` and targetEffects gained `FixtureLandDruid:stinking_cloud` + `FixtureLandDruid:no_action_and_bonus_action` — a rule-contradicting poisoned state on an immune creature.
- Differential control in the same session at the SAME DC/zone: FeyRanger (not immune) DID get the recurring turn-start `savePrompt-FeyRanger-<uuid>`; when FixtureLandDruid's turn started with his live stinking_cloud te row and the caster's `_stinkingCloud_DivinationWizard` tracking alive, NO prompt armed — the turn-start immunity gate (the `8c314c468` fix lane) fired correctly. So the two sibling lanes disagree about the same immunity, and the cast lane writes the illegal state.
- The turn-0 save also prompted at all — no honest "immune — no save" skip face.

## Likely location
Confident about the absence, guessing about the intended fix site:
- `grep playerIsImmuneToCondition` returns ZERO hits in `src/services/rules/spells/spellCastService/execution/savePath.js` and `src/components/char-sheet/modals/AOEConditionModal.jsx` — the cast-time condition-AoE application lane never consults the immunity registry the zone handlers (`src/services/automation/handlers/spells/stinkingCloudHandler.js:76-90` etc.), `conditionSaveService.js`, `saveProcessing.js`, `handleNpcSaveDamage.js`, `SetConditionModal.jsx` all use.
- The fail-apply step (write `activeConditions` + `stinking_cloud` te + `no_action_and_bonus_action` rider) is inside the AOEConditionModal/savePath fail branch.

## Suggested fix
Thread the same `resolveTargetStats`-style real PlayerStats into the cast-time condition application and gate on `playerIsImmuneToCondition({ conditionKey: 'poisoned', ... })` before arming prompts / applying conditions for condition-AoE casts (mirror `stinkingCloudHandler.js:90` semantics: honest skip, ledger/log annotation, no te rows). Decide with the owner whether immune creatures should be omitted from the picker entirely or prompted-then-refused with an "immune" copy. Add the CLA-119-style live e2e (immune fixture in-zone) pin so a mock-fed roster cannot mask the gate again.

## Severity
Data integrity risk — the engine stores a condition the ruleset says the creature can never have, and downstream riders (action/bonus-action block) enforce that illegal state for real turns.

## Resolution (fix run 2026-11-24)

**Outcome: FIXED.**

### What was actually wrong
The "Likely location" guess was half right: the cast-time condition lane had no immunity gate, but for Stinking Cloud that lane is **not** `savePath.js`/`AOEConditionModal.jsx` (both disk rows carry `automation: null`, and the sheet gate routes the spell by name long before `savePath` can arm the `aoeCondition` modal). The live cast lane is `spellGates.gateStinkingCloud` → `SIMPLE_SPELL_SPECS` `areaExecute` → `executeHandler` → **`stinkingCloudHandler.handle()`** (disk truth confirmed by the exact log copy `failed CON save against Stinking Cloud and is Poisoned.`, the `_stinkingCloud_<caster>` tracking stamp and both te rows — none of which AOEConditionModal writes). `handle()`'s per-target gate was `isPoisonImmune(target)`, which reads only the cs-row `weaknessesAndResistivities.immunities` — a monster-data field the minimal PC stub rows (`name/type/currentHp/maxHp`) never carry — so every PC walked past it while the turn-start sweep (same module, `stinkingCloudTargetImmune` → `playerIsImmuneToCondition`, the `8c314c468` lane) correctly skipped the Druid.

### Fix (mirror of the zone-sweep gate; owner-ambiguous picker question resolved toward the existing in-handler pattern)
`handle()` now gates each target through **the same `stinkingCloudTargetImmune` the turn-start sweep runs**: cs-row Poison DAMAGE immunity (monsters, byte-identical behavior) OR, for players, `playerIsImmuneToCondition({ conditionKey: 'poisoned', … })` against the roster-resolved PlayerStats (`computedStats || character`, the `resolveTargetStats`/`playerSleepImmunity` idiom). An immune creature is **never put through the save**: the existing honest skip fires (one `ability_use` row `“<T> is immune to Stinking Cloud (Poison immunity).”`, `N creature(s) immune.` tally, no prompt armed, no `activeConditions`/`activeConditionMeta`/te writes). This is the picker-then-refuse-without-the-prompt shape the handler already ran for poison-immune monsters — no new UI decision required; the zone still forms (tracking + concentration + expiration unchanged), immune creatures just skip every save in it, exactly like the sweep.

### Files changed
- `src/services/automation/handlers/spells/stinkingCloudHandler.js` — `handle()` takes the threaded `characters` 5th arg; per-target gate replaced with `stinkingCloudTargetImmune(…, resolveCastTargetStats(name, characters))`; module-local `resolveCastTargetStats` hoisted (complexity ceiling, §59 discriminator-hoist family); dead `isPoisonImmune` deleted; shared-gate doc note.
- `src/hooks/combat/useSpellMetamagicFlow/index.js` + `useSimpleSpellHandlers.js` — roster into the simple-handlers deps; `areaExecute` forwards it as `executeHandler`'s 5th arg (sleet/web share the call but ignore the arg; their behavior unchanged).
- `src/services/rules/spells/spellCastService/execution/index.js` + `triggerSpells.js` + `src/services/rules/features/stinkingCloudService.js` — the no-damage-chain lane forwards the roster inside `metaCtx.characters` (charmPerson transport precedent, keeps the 5-param service cap) → `executeHandler` 5th arg.
- `src/services/automation/handlers/spells/stinkingCloudHandler.cast-immunity.test.js` — NEW regression lock (7 tests): immune PC → no prompt/no condition/no te/no adjudication rows; `land_resistance` automation leg + bare-`immunities` leg + `computedStats || character` fallback; non-immune PC still prompted and still poisoned on fail; monster cs-row Poison-damage skip unchanged; unthreaded roster never fabricates immunity; mixed-list differential.
- Pins updated with the threading (wire-shape, not behavior): `spellCastService.noformula-utility.test.js` (Stinking row carries `chars` → expected metaCtx includes `characters`), `useSpellMetamagicFlow.complex-handlers.spells.test.js` (5-arg `executeHandler` pin for the roster row), `stinkingCloudService.test.js` (+2 transport pins: metaCtx.characters forwarded by identity; absent → `undefined`), `automation/index.webDispatch.test.js` (web-lane caller-liveness byte pin + 4-arg-call shape folded to the live 5-arg `areaExecute` call; full-suite run caught it, isolated re-probe + fold green).

### Verified
- **Live re-run of the repro (:5173, test-campaign, post-fix, fresh board):** Druid-only cast → **no save prompt armed** (was: “Saving Throw Required — CON DC 19”), log = cast row + `FixtureLandDruid is immune to Stinking Cloud (Poison immunity).`, disk change-data = Druid bucket ABSENT, `targetEffects` absent (pre-fix it was `activeConditions:['poisoned']` + both te rows — reproduced live pre-fix first).
- **Adjacent control, same session:** FeyRanger (not immune) cast → prompt armed normally, `Roll Save` → SAVE FAILURE → `activeConditions:['poisoned']` + meta dc/ability + `stinking_cloud` + `no_action_and_bonus_action` tes + full `save_result`/`condition` log pair. Zone lane (8c314c468) untouched.
- **Tests:** new file 7/7; touched areas `src/hooks/combat` + `src/services/rules` + `src/services/automation/handlers/spells` green (623 files / 5999 tests); `npm run lint` zero warnings; `no-timers-guard` OK; full-suite result recorded in the fix-return message.
- Dual-ruleset: BOTH lane dispatches (chooser + triggerSpells) and the single shared `stinking_cloud` handler are ruleset-agnostic; both disk rows carry `automation: null` and route through the same gate, and `playerIsImmuneToCondition` walks the 2024 `land_resistance` automation generically — no 2024 twin needs a separate change.
- Closeout: admin clear-change-data + clear-log (tab closed first), verified `{}` / `[]` / overlays `[]`; character-file aggregate pin `9c851a53…` and `FixtureLandDruid.json` `e4f00d7c…` byte-exact.

### Follow-up noted (not done — out of scope)
`useAreaEffectHandlers.js` still exports a dead `handleStinkingCloudConfirm` twin (shadowed by the SIMPLE_SPELL_SPECS handler; `useSpellMetamagicFlow/index.js` destructures only Globe/Forcecage/Antimagic from that factory) — a `handleConfusionConfirm`/`handleSleetStormConfirm` twin of the same era is likewise orphaned. Candidate dead-code sweep, not touched here. The AOEConditionModal generic condition-AoE lane’s (spells WITHOUT dedicated handlers, e.g. none of the zone four) cast-time application still has no immunity gate — sibling defect class if the owner wants a follow-up bug.
