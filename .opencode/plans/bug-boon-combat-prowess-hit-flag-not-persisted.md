# Bug: Boon of Combat Prowess converts miss→hit and deals damage, but persisted `lastAttack.hit` stays false — every "after you hit" rider is wrongly denied

## Summary
When a miss is converted to a hit via **Boon of Combat Prowess** (FT-007), the attack resolves as a hit for damage purposes (Done dispatches `dice-roll-done {hit:true}`, damage rolls, `hp_change` lands), but the campaign `lastAttack` record — written at roll time with `hit:false` — is **never updated**. Any downstream feature that gates on `lastAttack.hit` ("when you hit a creature…") then refuses, most visibly **Stunning Strike**: it answers "Last melee attack did not hit." on an attack that the UI declared ✓ HIT and that actually dealt damage.

## Steps to reproduce
Starting state: `test-campaign`, combat board with `Disciplined_Monk` (lv20 2024 Monk, Boon of Combat Prowess feat, Focus Points seeded) and `EvasiveFighter` (AC 18 sheet).
1. Open Disciplined_Monk's sheet; on the Actions table click the **Quarterstaff** row to attack EvasiveFighter.
2. If the popup shows ✗ MISS, click the "Boon of Combat Prowess" convert button → popup re-renders "✓ HIT (15 vs AC 18) — Boon of Combat Prowess: Miss converted to Hit"; click **Done** → damage stage rolls and applies (observed: 1d6+5=11, resistance-halved to 5, EF 30→25 + `hp_change` row + `ability_use` row "…Miss converted to Hit.").
3. With the monk's `targetName` still armed on EvasiveFighter, click the **Stunning Strike:** row on the sheet.
4. Observe the denial popup: "Stunning Strike / Last melee attack did not hit. / Done".
5. Machine truth: `GET /api/campaigns/test-campaign/change-data` → top-level `lastAttack` shows `attackerName:"Disciplined_Monk", hit:false` YET `damageApplied:true, actualDamage:5, d20Rolls:[4,20]`. The per-attacker `Disciplined_Monk.lastAttackRoll` twin also carries `hit:false`.
6. Control: land a NATURAL (non-converted) hit the same way → Stunning Strike proceeds normally (prompt queue / spend), proving the denial is boon-specific, not gate-wide.

## Expected behavior
Per RAW the converted attack IS a hit; since damage is applied as a hit, the persisted `campaign.lastAttack.hit` (and the attacker's `lastAttackRoll.hit` twin) must be flipped to `true` (ideally with a `convertedFromMiss` marker, mirroring the BI-defense lane which DOES write `la.effectiveAc/la.hit` back). "After you hit a creature" riders — Stunning Strike, Sneak Attack family, hit-condition riders, opportunity-attack riders — must see the hit.

## Actual behavior
- `handleMissToHit` (AttackResultPopup.jsx:59-64) only sets component-local `missToHitApplied`; `handleDone` (:45-57) dispatches `dice-roll-done {hit:true}` so the damage engine treats it as a hit.
- `handleBoonOfCombatProwess` (CharSheet.handlers.js:62-74) stamps the once-per-turn latch and logs the spend — it NEVER rewrites `campaign.lastAttack` or `<attacker>.lastAttackRoll`.
- Result: applied-as-hit damage + persisted `hit:false`. `gateStunningStrike` (useCharActionsAutomation.js) reads the stale flag and denies with "Last melee attack did not hit." (zero-spend denial works — FP untouched — but the legitimate feature is blocked).
- Note §6 doctrine ("converted MISS popups still print ✓ HIT — log `hit:false` decides") presumes the conversion is cosmetic. For Boon of Combat Prowess the conversion is REAL (damage applies), so keeping `hit:false` is not honest logging — it is a state split.

## Steps/rig notes
Observed live 2026-11-06 (run DA): attack row log `hit:false`, popup "✓ HIT (15 vs AC 18)", EF hp_change -5, then Stunning Strike denial with FP 20 unchanged and latch unstamped.

## Likely location
Confident (code read + live repro):
- `src/components/common/AttackResultPopup.jsx` — `handleMissToHit`/`handleDone` (conversion lives only in local state + the done event).
- `src/components/char-sheet/CharSheet.handlers.js` — `handleBoonOfCombatProwess` (log+latch, no lastAttack write). Compare `handleBiDefenseCombatSummary` (:119-138) which DOES mutate and persist `lastAttack`.
- Consumers of the stale flag: `gateStunningStrike` in `src/components/char-sheet/useCharActionsAutomation.js`, plus every `lastAttack.hit` rider reader (`grep -rn "lastAttack" src/services src/components | grep "\.hit"`).

## Suggested fix
In the conversion path (attack side of `handleStrokeOfLuck`/`handleBoonOfCombatProwess`, or where `missToHitApplied` is set with the persisted record still in hand), re-read `campaign.lastAttack`, set `hit:true` + a `missConverted:true` marker + `targetAc` unchanged, and write it back through the same lane `handleBiDefenseCombatSummary` uses (`storageService.set('campaign','lastAttack')` — one merged write, playbook §5: don't fire two un-awaited writes the same tick). Also refresh the per-attacker `lastAttackRoll.hit` twin. Alternatively flip the flag at `handleDone` when `actualHit && popupHtml.autoRerollForAttack` before dispatching damage. The Stroke-of-Luck sibling branch (featureKey 'strokeOfLuck', D20-test lane) needs the same audit if it converts attack rolls.

## Severity
Broken feature / data-integrity split. Damage applies as a hit while the machine-truth flag says miss; any hit-conditional rider silently denies after a legitimate converted hit (and the campaign log's attack row also mislabels the converted attack as a miss). Not a crash; scope = FT-007 holders (DMG boons) + any Stroke-of-Luck attack conversions.
