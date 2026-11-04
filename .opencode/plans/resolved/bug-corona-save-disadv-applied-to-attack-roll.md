# BUG — Corona of Light save-Disadvantage is applied to the attacker's ATTACK ROLL (wrong axis, wrong attacker, non-spell triggers)

## Summary
Corona of Light (Light Domain Cleric lv17, `effect: sunlight_aura`) grants "Disadvantage on **saving throws** against **your** spells that deal Fire or Radiant damage" to designated enemies. Both PC roller lanes instead apply it as Disadvantage on the **attack roll of whoever attacks the designated enemy**, for any attack whose damage type matches the buff list — including non-spell weapon attacks by the bearer's allies. The legitimate save-lane consumer (`handleNpcSaveDamage.js:110`) also exists and is awaited, so the attack-lane application is pure misplacement (rules-inverted extra penalty).

## Steps to reproduce
(test-campaign, dev pair `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` + `npx vite --host`, driven 2026-11-04 run CQ)

1. Enter test-campaign, ensure NO active map (`__map__` absent — reset ritual per playbook: close tabs, `DELETE /api/campaigns/test-campaign/__map__`, restart API so no tab re-mirrors).
2. EB-join Winged Kobold (AC15 hp10) so the 13-PC party seeds onto the tracker.
3. Stamp the bearer bucket with ONE full-store POST (bucket-replace law):
   `POST /api/campaigns/test-campaign/ElderPaladin` `{"value":{"activeBuffs":[{"effect":"sunlight_aura","name":"Corona of Light","enemiesDisadvantageSaves":["Piercing"],"distance":"60 ft"}]}}`
   (No `coronaOfLightEnemies` key = lenient-everyone list; "Piercing" chosen to match EvasiveFighter's Shortbow so the damage-type gate passes.)
4. On Initiative, arm EvasiveFighter's own row `[data-testid="target-select"]` (idx 8) → Winged Kobold. Open the EF sheet, consume the Studied-Attacks one-shot with a throwaway press (first press prints `Adv (conditions)` — expected, flush both popup stages).
5. Press Shortbow `+7` again → popup shows `d20 11, 16 → 11 +7` + chip `Disadv (Corona of Light — sunlight aura of ElderPaladin — proximity unmeasured (gridless) — GM-enforced)`; log row `mode:"disadvantage"`, `advantageReason` = the chip string. (Press #3: `d20 18, 13 → 13`, same chip.)
6. CONTROL A (damage-type gate on the ATTACK): re-stamp the same buff with `enemiesDisadvantageSaves:["Radiant"]`, wait ~3 s, press Shortbow again → single die, `mode:"normal"`, zero chips. Proves step 5's disadvantage keyed on the SHORTBOW'S OWN damage type carried into the attack roll — a saving throw was never rolled anywhere in this flow.
7. CONTROL B (duplicity twin on the same lane works as designed) — not required for this bug; included for rigor: with `{effect:'create_illusion', isImprovedDuplicity:true}` + `invokeDuplicityAdvantageTargets:["EvasiveFighter"]` the EF press prints `Adv (Improved Duplicity)`, and swapping the grant to `["FeyRanger"]` returns normal mode.

## Expected behavior
Per the class text (2024 classes.json, Light Domain lv17; also the CLA-063 bug file the fix shipped with): the disadvantage belongs on the designated enemy's SAVING THROW against the BEARER'S Fire/Radiant SPELLS. A piercing shortbow attack by ElderPaladin's party-mate EvasiveFighter must roll normally regardless of any corona stamp; a fire spell ATTACK by an ally should likewise not self-penalize.

## Actual behavior
- Any PC attacking a corona-listed creature with an attack whose `attack.damageType` normalizes into the buff's `enemiesDisadvantageSaves` pays Disadvantage on the ATTACK ROLL (chip + `mode:"disadvantage"` + log `advantageReason`, both presses measured above).
- The penalty ignores WHO attacks (ally of bearer pays) and whether the attack is a spell at all.
- Simultaneously the correct save consumer is wired in `handleNpcSaveDamage.js:110` (awaited), so a listed enemy already pays save-disadvantage on the bearer's Fire/Radiant save-spells — the attack-lane application is an EXTRA, unbuilt-by-RAW penalty, not the sole carrier.

## Likely location
(confident — both call sites read live-verified copy)
- `src/services/automation/contextBuilder-sync.js:609` — `resolveCoronaAura(targetName, campaignName, attack.damageType)` sits inside `resolveAttackModeResolvers` (ordered forced-mode resolvers for the PC ATTACK roll), reason string built at :453-468.
- `src/components/../src/services/automation/contextBuilder-map.js:196-204` — `accumulateAuraCounts` adds `mapDis++` from `getCoronaSaveDisadvantage` on the map-active ATTACK lane too.
- History: `resolveCoronaAura` predates CLA-063 (1257e3037 only added the `await` + expiry clock); the CLA-063 bug file's own repro is a SAVE lane (save-damage rolls), so the attack-lane entry's intent is dubious, not documented anywhere found in `.opencode/plans/`.

## Suggested fix
Remove/relocate the attack-lane applications: drop resolver #10 from `resolveAttackModeResolvers` and the `mapDis++` corona block from `contextBuilder-map.js` accumulateAuraCounts, and keep the save-lane consumers (`handleNpcSaveDamage.js:110`, aoeService). If an attack-lane aura is wanted for the lion/wolf family, corona is not its analogue. Also consider gating the util on `sourceCharacter === caster` (bearer's spells only) and on the effect being a SPELL at the save-lane call sites — currently any fire/radiant weapon damage from any creature matches. Sweep `contextBuilder-sync.wolf-aura.test.js`-style pins for a removed corona attack-lane row.

## Severity
Broken feature / rules correctness — an invisible stat tax penalizes the bearer's OWN allies on every matching attack roll against designated enemies (double jeopardy vs the correctly-wired save lane). Not data corruption, but every affected roll adjudicates wrong.

## Resolution
**FIXED (2026-11-04, fix run).** The original diagnosis was confirmed exactly: both call sites read live before any code was touched.

### Live repro (pre-fix, test-campaign on the dev pair with `CAMPAIGN_LOCK`)
Gridless rig (empty change-data, `__map__` absent), EB-joined Winged Kobold, ElderPaladin bucket stamped via ONE full-store POST with `{effect:'sunlight_aura', enemiesDisadvantageSaves:['Piercing'], distance:'60 ft'}`, EvasiveFighter (the bearer's party-mate) armed at the kobold and its Shortbow pressed → popup printed `d20 11, 14 → 11 +7` + chip `Disadv (Corona of Light — sunlight aura of ElderPaladin — proximity unmeasured (gridless) — GM-enforced)`; log row `mode:"disadvantage"` with that exact `advantageReason`. CONTROL A re-verified too: re-stamp `['Radiant']` → single die, `mode:"normal"`, zero chips — the gate keyed off the SHORTBOW'S OWN damageType on the attack roll; no saving throw was ever rolled in the flow.

### What was actually wrong
The "Likely location" was correct, nothing more was needed:
1. `contextBuilder-sync.js` — `resolveCoronaAura` sat as resolver #10 in `resolveAttackModeResolvers` (the PC gridless ATTACK-roll forced-mode chain). Removed the resolver row, the function, and the now-unused `getCoronaSaveDisadvantage` import (the `attack` param of `resolveAttackModeResolvers` became dead — dropped too).
2. `contextBuilder-map.js` — `accumulateAuraCounts` counted corona into `mapDis` on the map-active ATTACK lane. Removed the `coronaOpts`/`mapDis++` block and the import, leaving a NOTE comment naming the correct save-lane homes so the attack-lane entry is never re-added by analogy with the lion/wolf twins.

Save-lane consumers untouched: `handleNpcSaveDamage.js:110`, `handlePlayerSaveDamage.js:107`, `aoeService.js` (sync twin), `DivineSparkModal.jsx`. The suggested extra save-lane gates (`sourceCharacter === caster`, SPELL-only origin) were deliberately NOT added — that would change adjudication the bug never measured live (exploration doc PT4: the true save-lane face has never been live-proven end-to-end) and RAW's designator is the bearer's `coronaOfLightEnemies` list, which stays the gate.

### Files changed
- `src/services/automation/contextBuilder-sync.js` — removed attack-lane corona resolver + helper + import.
- `src/services/automation/contextBuilder-map.js` — removed mapDis corona block + import (NOTE comment added).
- `src/services/automation/contextBuilder-sync.wolf-aura.test.js` — swept the two attack-lane pins: the "corona gridless face" test deleted; the "corona twin" measure test replaced with a NEVER-consulted pin; "all four sync aura resolvers" is now three + `expect(getCoronaSaveDisadvantage).not.toHaveBeenCalled()`.
- `src/services/automation/contextBuilder-map.test.js` — new pin: corona never counted into mapDis on the map attack lane.
- `src/services/automation/contextBuilder-sync.corona-attack-lane.test.js` — NEW regression suite (4 tests): matching weapon damageType, ally fire SPELL attack, active-map lenient leak, and no-target face — all assert the util is never consulted and `forcedMode`/`advantageReason` stay undefined.

### Verification
- `npx vitest run src/services/automation/contextBuilder-sync.corona-attack-lane.test.js` → 4/4 pass.
- `npx vitest run src/services/automation/` → 520 files / 7061 tests pass; `src/services/combat/auras/ + src/hooks/combat/handlers/` → 61 files / 663 pass (save-lane pins incl. `handleNpcSaveDamage.test.js` "corona aura grants disadvantage" intact).
- Full `npx vitest run` → 3057 files / 33503 passed | 3 expected fail, EXIT=0. `npm run lint` → zero warnings. `node .opencode/plans/no-timers-guard.mjs` → OK.
- **Live re-verify (post-fix, same rig):** corona re-stamped `['Piercing']`, EvasiveFighter pressed Shortbow at the kobold → single die `d20 12 +7`, ZERO chips, log row `mode:"normal"`, `advantageReason` absent.
- **Save-lane sanity (the correct axis, live):** corona re-stamped `['Fire','Radiant']`; War_Cleric cast Sacred Flame (Radiant DEX save) at the designated kobold → victim save resolved `(d20 3 + 3) [Disadvantage]`, `✗ SAVE FAILURE (6 vs DC 15)` + full 2d8 damage — `handleNpcSaveDamage.js` still applies save-disadvantage.
- Adjacent aura sanity: wolf/lion/duplicity resolver pins all green (gridless + measured faces).

Test-campaign restored to baseline at exit: change-data `{}`, log `[]`, combatSummary null (closed-tab admin clears, two-pass verified); dev pair left running.

