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

## Resolution
FIXED 2026-11-06 (bugfix descent).

**What was actually wrong** — the original diagnosis was correct: `handleBoonOfCombatProwess` (CharSheet.handlers.js) stamped the once-per-turn latch and logged the spend but never rewrote the persisted roll records, while `handleDone` (AttackResultPopup.jsx) dispatches `dice-roll-done {hit:true}` so damage applies as a hit. Homing Strikes has no such split because its bonus folds into `finalHit` BEFORE `processAttackAfterResult` stores — the conversion lanes here act AFTER the store, so they must write the record back. The Stroke-of-Luck sibling audit came back positive too: its attack face (`popupHtml.hit === false`, "Miss converted to a hit." log tail) applies damage as a hit via the same Done dispatch and had the identical stale-flag defect.

**Fix** — `src/components/char-sheet/CharSheet.handlers.js`:
- New `persistConvertedAttackHit(playerName, campaignName, popupHtml, convertedBy)` helper: guards on `popupHtml.hit === false` (so check/save D20 tests can never launder a stale record), then re-reads `campaign.lastAttack` and `<attacker>.lastAttackRoll`, and for records with `attackerName === playerName && hit === false` writes back one merged spread with `hit:true, missConverted:true, convertedBy`. d20/total/targetAc stay byte-honest (the marker explains the flag). Uses the canonical `setRuntimeValue` merged re-read/write lane (`handlePlainDamage`/`monsterJinx` lineage — `getRuntimeValue` mirror updates synchronously, and the campaign-bucket write POSTs the single property, so the later damage-merge read preserves `hit:true`). Not the BI-defense `storageService.set` lane — that only persists the combatSummary snapshot it is handed.
- `handleBoonOfCombatProwess`: calls the helper (after the awaited latch stamp — sequential same-bucket writes, playbook §5) → `convertedBy: 'Boon of Combat Prowess'`.
- `handleStrokeOfLuck`: made async, calls the helper → `convertedBy: 'Stroke of Luck'` (helper's hit-guard keeps check/save uses write-free).
- Dual ruleset: both lanes are ruleset-shared (single CharSheet.handlers.js) — 5e and 2024 covered by the one fix.

**Files changed:** `src/components/char-sheet/CharSheet.handlers.js` (fix), `src/components/char-sheet/CharSheet.handlers.miss-conversion.test.jsx` (new regression ledger, 7 tests).

**Verification:**
- New test: `npx vitest run CharSheet.handlers.miss-conversion.test.jsx` → 7/7 (flip both records + marker + honest d20 fields preserved, latch/log survive, SoL attack face flips, SoL check face writes nothing, foreign-attacker/already-hit records untouched).
- Touched folders: `npx vitest run src/components/char-sheet src/components/common` → 616 files / 5958 tests passed. `npm run lint` → zero warnings. `no-timers-guard` OK.
- Live re-repro (Playwright, test-campaign): Quarterstaff MISS (d20 3+11=14 vs AC 18) → Boon convert → popup "✓ HIT … Miss converted to Hit" and, at CONVERSION time (before Done), `GET change-data` showed `campaign.lastAttack {hit:true, missConverted:true, convertedBy:"Boon of Combat Prowess", d20:3, total:14, targetAc:18}` + `Disciplined_Monk.lastAttackRoll` twin flipped. Done → damage applied (11→5 HAM-reduced, hp_change) and the merge PRESERVED `hit:true` with `damageApplied:true, actualDamage:5`. Stunning Strike then ADMITTED: "Target EvasiveFighter must make a CON saving throw (DC 21)" popup + `.sp-overlay` prompt, FP 20→19, `_StunningStrike_usedRound {round:2}` stamped, prompt Dismiss drained clean (`save_dismissed` row, bucket evicted, zero console errors). Adjacent sanity: natural-hit path byte-unchanged (many Done-damaged hits ridden during the miss-hunt), boon round-latch re-arm honored (lockout observed at round 1, re-offered at round 2).
- Cleanup: Admin panel cleared change-data (`{}` GET-verified, stays empty after quiet) + campaign log (`[]`) for test-campaign; no character-file writes (`git status public/campaigns` clean).

**Known-accepted residual (out of scope here):** the historical campaign-log attack `roll` row still prints `hit:false` for the converted attack (rows are append-only; the `ability_use` "Miss converted to Hit" row is the honest companion). Machine-truth gating now reads the flipped record, which was the broken behavior.
