# Bug: Defense BI prompt lane (`sendBardicInspirationDefensePrompt` + modal defense face) has no production producer — orphaned twin implementation

## Summary
Bardic Inspiration has TWO defense implementations. The live one is the inline `Bardic Inspiration - Defense (dN)` button inside the attack-result surfaces (`AttackResultPopup` / `DiceRollResult`), fed by `hitResolution.js applyBardicInspirationDefense` context flags — this was re-lived healthy this run. The second one — the shared-table lane: `sendBardicInspirationDefensePrompt()` writing the top-level `<target>-biPrompt` key that `BardicInspirationReactionModal` renders as the "Combat Inspiration - Defense" modal — has **zero production call sites**. `grep -rn "sendBardicInspirationDefensePrompt(" src` matches only its own definition and test. The modal's entire defense branch, the campaignKeys `-biPrompt` defense routing ("defense → target" per `bardicInspirationPromptUtils.js`'s own doc), and the defense half of the `5bf8c89a3` eviction fix are reachable ONLY via a manual/API seed.

## Steps to reproduce
1. In `test-campaign`, grant Bardic Inspiration the honest way: HeroesFeastBard sheet → `Bardic Inspiration:` row → chooser → Select EvasiveFighter → `Grant Inspiration`. Verify the bucket: `bardicInspirationDie:"12"`, `bardicInspirationGrantedBy:"HeroesFeastBard"`, `bardicInspirationUses:{current:1,max:1}` (one honest `ability_use` log row).
2. Note the grant writes NO `bardicInspirationCombatOptions` (the Lv20 fixture bard lacks `hasCombatOptions`), so seed it as any option-bearing grant would: full-store `POST /api/campaigns/test-campaign/EvasiveFighter` keeping existing keys plus `bardicInspirationCombatOptions: '["defense_add_to_ac","offense_add_to_damage"]'`.
3. Encounter Builder → Join Goblin → arm it on EvasiveFighter → open its stat modal → roll Scimitar until a staged HIT face → press `Done` to commit.
4. Watch for the shared defense prompt: `GET /api/campaigns/test-campaign/change-data` — check for an `EvasiveFighter-biPrompt` key.

## Expected behavior
Per `bardicInspirationPromptUtils.js` (rewritten by `5bf8c89a3`): "Combat Inspiration adjudication prompts ride the `<name>-biPrompt` top-level change-data key … (`name` is the reacting creature: defense → target, offense → attacker)". A hit against an option-armed BI holder should surface the defense adjudication on the shared lane (the defender's own tab can answer).

## Actual behavior
The committed real attack produced NOTHING on the key lane: no `EvasiveFighter-biPrompt` key ever appeared, no modal mounted, no `POST .../biPrompt` request fired (live-verified this run, attack 20 vs AC 18 committed with the full gate armed). Meanwhile the SAME hit's popup face correctly rendered the inline `Bardic Inspiration - Defense (d12)` button (rolls 1d12→2 → "AC 20 (Attack still hits)", honest `ability_use` row, resources consumed die/uses/options → null/0/null, hp_change delta -2 after Heavy Armor Master 8→2). The defense adjudication therefore only exists on the ROLLER's screen — a defender on another tab/LAN client never sees it — and the modal's defense branch is dead code per the repo's own dead-code/single-source-of-truth rules. (Corollary: the defense half of the `bug-bi-prompt-skip-never-evicts-server-key` fix was only ever exercisable via synthetic seeds.)

## Likely location
Confident (grep-verified): `src/services/combat/prompts/bardicInspirationPromptUtils.js` `sendBardicInspirationDefensePrompt` (zero callers); the wiring seam should live next to the offense twin (`src/services/combat/steps/attackRollRiders.js:178` calls `sendBardicInspirationOffensePrompt`) or in `src/hooks/combat/hitResolution.js` `applyBardicInspirationDefense` (lines 58-67) which already computes exactly the payload the util wants (target, attacker, attackRoll, bonus, effectiveAc, dieSize) but only sets popup context flags.

## Suggested fix
Owner decision needed between two honest shapes:
(a) Wire the producer: in `applyBardicInspirationDefense` (or the monster-attack commit path) call `sendBardicInspirationDefensePrompt` so the defender tab can answer, and dedup with the popup-inline button so the same reaction can't be spent twice (the modal Skip/Use already evicts via `5bf8c89a3`); or
(b) Delete the orphan: remove `sendBardicInspirationDefensePrompt`, the modal's `mode === 'defense'` branch/description, and narrow the campaignKeys comment — the popup-inline lane stays the single source of truth. Do NOT keep both lanes with one unreachable.

## Severity
Minor UX issue (dead-code / dual-implementation defect): the user-visible defense feature works on the roller's popup, so nothing visibly breaks today; but it violates the one-canonical-shape policy, gives future fixes a phantom lane to "verify" against (this run's fix-verify rode it via synthetic seed), and silently promises a defender-side shared prompt that can never fire.
