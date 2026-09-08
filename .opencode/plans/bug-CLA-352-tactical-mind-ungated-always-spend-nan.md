# bug CLA-352 Tactical Mind — FAIL (2026-09-08, EvasiveFighter lv18 Fighter/Battle Master 2024, test-campaign)

Expected (manifest + classes.json lv2 text): offer ONLY on failed ability checks; expend 1 Second Wind use, roll 1d10 add to check; if check still fails the use is NOT expended.

## FAIL 1 — no failed-check gate (trigger violation)
DiceRollResult.jsx:500 gate is `tacticalMind && !tacticalUsed && (rollType==='check'||rollType==='skill')` — no `d20TestFailed` (sibling Stroke of Luck gate at :460 shows the correct pattern). conditionEffectsInternal.js:258 sets `tacticalMind=true` unconditionally for the passive. LIVE: INT check nat 19 +3 = **22 clear success** still rendered offer "Tactical Mind (+1d10)".

## FAIL 2 — spend always, outcome-blind (reverse-gate absent)
CharSheet.handlers.js:320 handleTacticalMind decrements secondWindUses immediately, no DC/success comparison anywhere (sheet check payloads carry no dc/success field — popup cannot even know the outcome). LIVE: accepted offer on the nat-19=22 SUCCESS consumed uses 3→2 with log "+2 to Intelligence (d20 19 + 3 = 22 → 24)". Therefore "still fails → not expended" can never hold; conversely near-DC totals (10→17 tested) spend regardless of GM DC.

## FAIL 3 — popup total NaN
DiceRollResult.handlers.js:38 `finalRoll + bonus + modifier` — `modifier` undefined on sheet ability checks → popup renders "Tactical Mind: +7 → NaN" and "Tactical Mind: +2 → NaN" (React console error "Received NaN for children attribute"). Expected "new total shown vs DC" unusable.

## FAIL 4 — uses exhaustion leak
CharSheet.handlers.js:325-328 (and tacticalMindHandler.js:33-36): `currentUses<=0` silently refills to maxUses (4) then spends; refusal-at-zero unreachable via popup.

## PASS subset (keep)
- Die is exactly 1d10 (button label "(+1d10)", log d10Roll 7/2 in range).
- Log math exact and ability_use present ("used Tactical Mind: +N to <Check> (d20 X + b = T → T+N)").
- Offer correctly ABSENT on saving throws (STR save nat 20: no button; gate limits rollType).
- Offer hidden after accept (tacticalUsed once per popup).

## Fix recipe
Gate offer on `d20TestFailed` in DiceRollResult (mirrors CLA-339 fix shape); popup needs a GM-enters-DC prompt (or accept-no-spend model documented); spend only when boostedTotal ≥ DC else refund/never decrement; remove the <=0→max refill leak.

## Controls
SUCCESS-control: offer appeared (defect 1). SAVE-control: absent (pass). Cleanup: Admin clear change-data + log, server left running.
