# Bug: Clear's latch-eviction reports "3 evicted" but the most-recently-stamped latch RESURRECTS — the Shield Bash rider still silently drops in the new combat's round 1

## Summary
Fix `cbbc48b83` evicts `_*_usedRound`/`_*_skippedRound` stamps at the Clear seam, but it writes one null per key as three separate whole-bucket POSTs; arrival can interleave so a body that still carries the freshest stamp lands last and revives it. Live: the `new_combat_latch_reset` audit row says **3** latches evicted, yet the store keeps `_Shield_Bash_usedRound={round:1}`. A fresh combat's round 1 then **silently drops the Shield Bash rider** (no prompt, no chooser, no refusal row) — exactly the face the fix was supposed to kill — while the successfully-evicted Charge chooser re-arms on the same commit.

## Steps to reproduce
Start: test-campaign, Initiative board with a live EB-joined Goblin, EvasiveFighter (feat holder: Charge + Shield Bash, Glaive), zero latches, round 1. (EvasiveFighter already carries the Shield Bash rider on every melee HIT via `feat-shield-bash`.)

1. Arm EvasiveFighter's initiative-card Target select on `Goblin`. On the sheet press the `Glaive` attack row → HIT → `Done`.
2. The Charge Attack chooser (`.sp-overlay`) mounts — press **Cancel** (weapon damage still lands synchronously; this latches `_Charge_Attack_skippedRound={round:1}`).
3. The `Saving Throw Required … Source: Shield Bash` prompt arms → **Roll Save** → save fails (DC 17 vs STR −1) → `Done` → the Push/Prone chooser mounts → tick `Push Goblin` → **Apply Effect**. GET change-data: `EvasiveFighter` bucket now holds `_attackActionTakenRound=1`, `_Charge_Attack_skippedRound={round:1}`, `_Shield_Bash_usedRound={round:1}` (all three written within the last ~30 s).
4. Click **Clear Initiative Board** → `Yes, Clear Board`.
5. GET `/api/campaigns/test-campaign/change-data` (re-check after 10 s): `EvasiveFighter._attackActionTakenRound` and `_Charge_Attack_skippedRound` are `null`, but **`_Shield_Bash_usedRound` is STILL `{round:1,"activeCreature":"EvasiveFighter"}`**. The log shows the single `automation/new_combat_latch_reset` row claiming "3 once-per-turn latches … evicted".
6. EB-join a fresh Goblin (new combat, round 1), re-arm EF on it, press `Glaive` until HIT → `Done`.
7. Observe: damage lands, the **Charge chooser re-arms** (its eviction landed) — but the Shield Bash save prompt **never mounts**. No popup, no chooser, no refusal row; the rider is silently dropped.
8. CONTROL (same board, same round): scoped `PATCH /api/campaigns/test-campaign/EvasiveFighter {"value":{"_Shield_Bash_usedRound":null}}` (200) → press until the next HIT → `Done` → the `Saving Throw Required … Source: Shield Bash` prompt mounts within ~2 s. The resurrected stamp is the sole cause.

## Expected behavior
Post-Clear every `/round$/i` latch key of every closing-board creature is null (as the audit row claims), and the new combat's round-1 HIT re-arms the full rider chain (Charge chooser AND Shield Bash prompt) — per the fix's own stated probe ("post-Clear GET shows stamps null … new-combat round-1 HIT re-arms Charge chooser AND Shield Bash prompt").

## Actual behavior
Eviction count (3) reflects intent, not landed state; `_Shield_Bash_usedRound` — the LAST key written before Clear — survives every time this sequencing occurs (observed 1/1 full-chain repro, plus the fix-verify run's own board had only the two older keys and survived untouched). The drop is silent: no prompt, no chooser, no log row, zero feedback (same MA-0286-style silent rider drop as the original filed bug).

## Likely location
`src/services/automation/common/oncePerTurn.js::clearCombatLatches` — per-key `setRuntimeValue(creatureName, key, null)` loop. `setRuntimeValue` POSTs the writing tab's WHOLE bucket mirror (playbook §54b/§58, "replace" semantics); the three sequential bodies are (1) {aA:null, Charge:stamp, SB:stamp}, (2) {aA:null, Charge:null, SB:stamp}, (3) all-null. With no ordering guarantee between same-origin POSTs, body (2) can land after body (3) — the observed final state matches body (2) byte-for-byte. Confident in the mechanism class (whole-bucket replace race); guessing only on which pair swapped.

Related (code-confirmed, NOT reproduced live this session — same family, other seam): `loadEncounterToInitiative` (`src/services/encounters/encounterToInitiative.js`, sole production caller `autoStartEncounterFromEvent` = enforcement-ON travel-event auto-encounter Accept) ALSO writes a replacement `{round:1, creatures}` board without calling `clearCombatLatches`. Worse, suppression in `checkOncePerTurn[WithSkip]` is `!(currentRound > storedRound)`, so after ANY round reset to 1 a surviving stamp of ANY round (not just `{round:1}`) suppresses round-1 riders. Live-ride recipe: stamp a latch mid-combat (steps 1–3), arm `enforcement {mode:'on',autoEncounters:true}` + POST a combat `travel-pendingEvent` on a mounted HexMap tab, Accept → board replaced round 1 → latches untouched (GET) → round-1 HIT drops the rider.

## Suggested fix
1. In `clearCombatLatches`, collapse the per-creature eviction into ONE write per creature: collect the matching keys and send a single scoped `PATCH /:campaign/<name> {"value":{k1:null,k2:null,…}}` (the merge lane is proven working — it was the successful CONTROL in step 8) or a single whole-bucket POST whose body has all nulls at once. One body ⇒ no self-interleave.
2. Belt-and-braces: audit-row copy should report what LANDED (or the lane GET-verifies after settling and re-sweeps survivors), so "N evicted" never over-claims.
3. Consider stamping a per-combat epoch (the Clear `lastCombatResult.stamp` already exists) into latches and comparing `stamp.combatId === currentCombatId` instead of bare round numbers — kills the whole round-alias family including the Load-seam face above.
4. If CLA-100 ("Join/Load is not a board-wide seam") is meant to keep Load evict-free, that is at least debatable given Load REPLACES the board, resets round and clears pending OAs — decide with the owner; meanwhile the fix's coverage claim ("the eviction therefore lives AT the board-wipe Clear seam") undersells reachable seams.

## Severity
Broken feature — the shipped fix's headline probe fails under the exact real combat sequencing that produces stamps (full rider chain immediately before Clear), and the failure mode is the silent rider drop the owner already ruled a bug. The misleading audit row also makes the board LOOK clean from the log, hiding the defect.

## Live witnesses (run MA, 2026-11-18, HEAD dbba35c3e)
- Post-Clear GET (immediately and +8 s): `_attackActionTakenRound:null`, `_Charge_Attack_skippedRound:null`, `_Shield_Bash_usedRound:{round:1,activeCreature:"EvasiveFighter"}`.
- Log row: `Combat board cleared: 3 once-per-turn latches from the previous combat evicted.`
- New-combat round-1 HIT (Goblin join, d20 16 → 25 vs AC 15): damage row + `hp_change` honest, Charge chooser mounted, NO `.sp-overlay` prompt (`promptMounted:false`), zero refusal rows.
- Control: PATCH `_Shield_Bash_usedRound:null` (200) → next HIT (d20 11 → 20) → prompt mounted within 1.7 s ("Saving Throw Required… DC 17 … Source: Shield Bash").
