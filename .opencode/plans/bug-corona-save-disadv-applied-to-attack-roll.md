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
