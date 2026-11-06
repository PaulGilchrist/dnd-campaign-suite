# Bug: Divine Spark with no armed target silently self-targets; Harm branch damages the caster

## Summary
When the caster's `targetName` is unarmed (null) on the combat board, clicking Divine Spark does not ask for/pick a real target — `divineSparkHandler.js` falls back to `playerStats.name`, so the modal opens with "Channel divine energy at **War_Cleric**" (self) and spending a Channel Divinity charge. Clicking Harm then makes the caster force a CON save against his own spell DC and take the damage. The disk feature (public/data/2024/classes.json, Cleric lv2 "Divine Spark") explicitly requires "another creature you can see within 30 feet **of yourself**" — self is not a legal target for either branch.

## Steps to reproduce
1. In `test-campaign`, with a combat board containing War_Cleric, clear his armed target: scoped PATCH `/api/campaigns/test-campaign/combatSummary` `{"value":{"creatures":[{"name":"War_Cleric","targetName":null}]}}` (or set target-select to empty on his Initiative card).
2. Ensure runtime `channelDivinityCharges` > 0 on War_Cleric.
3. Open the War_Cleric sheet → click the **Divine Spark** row (`b.clickable`).
4. Observe the modal header line and the charge counter.
5. Select Radiant and click **Harm**; Roll Save + Done on the queued prompt.

## Expected behavior
With no target selected the feature should refuse (popup like "No target selected") and NOT spend a Channel Divinity charge, or at minimum require choosing a creature other than self. Self is never a legal target per the authored rules text.

## Actual behavior
- Modal opens with "Divine Spark — Channel divine energy at **War_Cleric**." (self). No popup asking for a target, no warning.
- A Channel Divinity charge is spent at row-click regardless (runtime `channelDivinityCharges` decremented, `ability_use` log "Divine Spark activated — targeting War_Cleric.").
- Harm proceeds: prompt "War_Cleric must make a CON saving throw. DC 15 … Source: Divine Spark"; failed save dealt **7 Radiant damage to the caster** (verified live via the modal result view + hp_change).
- (Corona interaction is self-consistent — `getCoronaSaveDisadvantage` skips `player.name === targetName` — which incidentally proves the self-target value flows through the whole harm lane.)

## Likely location
Confident: `src/services/automation/handlers/class-cleric-paladin/divineSparkHandler.js:44` — `const targetName = targetInfo?.target?.name || playerStats.name;` (self-target fallback when `resolveTarget` finds nothing). Same pattern exists at `src/services/automation/handlers/combat/saveOnlyHandler.js:29` (grep census: only these two handlers use `|| playerStats.name` after `resolveTarget`) — worth auditing whether that feature's rules text also requires another creature. Compare other Channel Divinity handlers: Sacred Weapon legitimately targets self; Divine Spark is the "other creature" feature. The handler returns `type:'modal'` before any target validity check, and the modal has no target picker — it just trusts `payload.targetName`.

## Suggested fix
In `divineSparkHandler.handle`, when `resolveTarget` yields no target, return an `automation_info` popup refusal ("No target selected — Divine Spark requires another creature within 30 feet.") **before** the `setRuntimeValue` charge spend (move the spend below the target resolution, or refund on refusal). If a self-target ever should remain possible as a GM convenience, at minimum the modal must label it clearly and Harm should refuse self ("You can't target yourself with Divine Spark"). Check sibling Channel Divinity handlers for the same `|| playerStats.name` fallback pattern (grep `playerStats.name;` in class-cleric-paladin handlers).

## Severity
Minor UX issue with a data-integrity edge: a mis-click silently spends a scarce resource and can damage your own character with no confirmation. Not a crash; rules-wrong outcome is reproducible but easily noticed at the table.
