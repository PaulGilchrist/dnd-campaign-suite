# Victim's own sheet-lane initiative re-roll FIRES the rider clock but the seam's stale full-store writes resurrect the conditions (log claims removal while state keeps them)

## Summary

Second real defect found while live-verifying `bug-save-margin-rider-clock-ignores-authored-duration` (owner must-prove lane: "a new initiative roll must clear conditions"). The clear machinery genuinely runs at the victim's own sheet-initiative re-roll — `processInitiativeRoll` → `clearAllExpirationEffects(victim)` → `clearIncomingExpirations` fires the target's rider clock: the entry is trimmed from the attacker's `pendingExpirations` and both `condition removed` rows ("Poisoned/Paralyzed ends (10-round clock expired)") log — **but the victim's `activeConditions` end up back at the pre-strip value**, because the same seam issues several UN-AWAITED full-store POSTs of the victim's bucket (`clearSelfBuffs` and the `clearMyOutgoingExpirations` empty-list stamp both snapshot the bucket BEFORE the condition strip lands) and a stale snapshot wins the last-write race (MA-0809 / playbook §5 write-batching family). Net live face: honest `condition removed` rows + honest queue trim, dishonest final state — conditions persist indefinitely (their clock is gone).

## Steps to reproduce

1. test-campaign, EB-join a Thri-Kreen; victim = a PC whose `activeBuffs` carry `{effect:'warding_bond', saveBonus:-25}` (bucket POSTed BEFORE campaign-select so the loaded mirror adopts it).
2. Thri-Kreen Bite save chip vs the victim, Roll Save → guaranteed deep fail → `activeConditions ['poisoned','paralyzed']` + clock `expiryRounds:10` in `Thri-Kreen.pendingExpirations`.
3. Open the victim's sheet, click the `Initiative:` chip → roll → Done.
4. GET change-data: the Thri-Kreen clock row for the victim is GONE and two `condition removed` rows exist, yet the victim bucket still shows `['poisoned','paralyzed']` (and `activeConditionMeta` keeps both keys). Reproduced 2/2 on 2026-11-10 (AberrantSorcerer, polls at ~12 s/~17 s/~22 s all show the resurrected pair).

## Expected behavior

Same seam as the Short Rest lane (which is clean — the rest applies `activeConditions:[]` in one atomic merged batch, playbook §5 bullet "Rider-condition seam-clear lane truth"): after a new initiative roll the victim's rider conditions must be GONE in settled state, with matching removed rows.

## Likely location

`src/services/rules/effects/clearAllExpirationEffects.js` — `clearSelfBuffs` (:12), `clearMyOutgoingExpirations` (:41) and the incoming-strip write inside `clearExpirationEffects` are separate un-awaited per-key `setRuntimeValue` calls, each POSTing a full snapshot of the victim's bucket; the pre-strip snapshots can land last (same-endpoint reorder law, §124/MA-0809). Fix direction candidates: merged single `setRuntimeObject` per affected store, or read-after-write ordering (await the strip before the sibling stamps), or route the whole seam through the rest-lane batch idiom.

## Sibling lane note (NOT a defect, by design-of-code)

A board-wide new initiative roll from EB Join does NOT sweep these clocks at all: `loadEncounterToInitiative` sweeps only combat-scoped `until:'combat'` entries (zones-enforcement-gated) and the `initiative-rolled` listener clears only `dominated`-type entries + ladders — finite-round rider clocks and their conditions persist across EB re-rolls. Live-confirmed 2026-11-10 (Bandit grant survived a Drow-join initiative re-roll). Recorded in the playbook; an owner ruling is owed on whether EB Join should also run the per-creature expiration sweep.

## Resolution

**FIXED 2026-11-10 (fix run).** The seam's victim-bucket write race is eliminated by the sibling idioms the codebase already proves (Short-Rest strip-first batch + Aura-of-Life single merged `setRuntimeObject`); no new write primitive was invented.

### Files changed

- `src/services/rules/effects/clearAllExpirationEffects.js` — clock sweeps (`clearMyOutgoingExpirations` + `clearIncomingExpirations`) now run FIRST so every snapshot of the victim's own bucket issued afterwards already carries the stripped conditions (previously `clearSelfBuffs` issued ~12 full-store REPLACE snapshots with the pre-strip `activeConditions`, any of which could win the same-endpoint last-write race). `clearSelfBuffs` became pure compute (`buildSelfBuffClearUpdates`) and all own-bucket changes (8-hour-preserved buffs, cover/majesty/sanctuary flags, emptied outgoing-queue stamp) now ride ONE merged `setRuntimeObject` as the bucket's FINAL write.
- `src/services/rules/effects/clearExpirationEffects.js` — the logged clock strip (`removeConditionWithExpiryLog`) no longer fires the two-call `removeConditionEverywhere` per condition; it strips the WHOLE fired entry's condition family in one atomic `setRuntimeObject` (union of its `condition`/`charmed`/`dominated`/`speed_zero` legs — a Thri-Kreen twin clock used to POST a mid-sequence snapshot still carrying `paralyzed`) AND now purges the stripped conditions' `activeConditionMeta` rows in the same write (canonical `removeCondition` hygiene, conditionSaveService — the meta rows previously survived every clock expiry, live-witnessed on the clean-rest settle too). One `condition removed` row per actually-stripped condition is preserved.
- Callers audited, scope unchanged: `initiativeProcessing.js` (sheet lane — the bug seam), `restRules-shortRest.js:517` / `restRules-longRest.js:546/:673` (both run the seam AFTER their atomic batches → strips now dirty-check no-ops, byte-clean). EB-Join `sweepNewCombatClocks` untouched (owner ruling pending, per Sibling lane note above).

### Evidence

- Red→green live (test-campaign): pre-fix, capture showed 11 pre-strip pair-carrying POSTs issued before the strip; the recorded `page.route` stale-snapshot-hold harness forced the resurrection 1/1 (settled `['poisoned','paralyzed']` + trimmed queue + honest removed rows, stable across two +12 s poll passes). Post-fix final re-run on the fixed bundle (fresh session, full repro): the seam window issued 35 victim POSTs with ZERO carrying any `activeConditions` content (pre-fix fingerprint gone from the wire), settled `activeConditions []` / `activeConditionMeta {}` / clock trimmed across two +12 s poll passes, exactly two removed rows with "10-round clock expired" copy; the reorder harness holds nothing the seam issued.
- Sanity faces live: deep-fail grant (warding_bond −25 dial) still lands the pair + clock 2/2; a NON-seam condition stamp (frightened) persists after the re-roll; Short Rest face still clean (`activeConditions []` + `activeConditionMeta {}` + `short_rest` row).
- Tests: new `src/services/rules/effects/clearAllExpirationEffects.write-race.test.js` (6 tests — snapshot-issue-order harness replicating setRuntimeValue's at-call-time full-store POST semantics; pins: no victim-bucket snapshot ever carries the pre-strip pair, per-entry strip is ONE atomic write, exactly one merged self write, full-reverse arrival permutation still settles condition-free, attacker trim single-write, second run idempotent). Stale pins inverted same-pass in `clearAllExpirationEffects_additional/_rest_cleanup`, `clearExpirationEffects/_condition-expiry-log/_additional_types`, `expireStaleEffects`, `applyDamage.dominateRepeat` (mock-surface: partial `useRuntimeState` mocks needed `setRuntimeObject` — its absence surfaced as 2 unhandled rejections, "all tests passed / EXIT 1"). Folder `src/services/rules/effects` 55 files green; full suite 3187 files / 34479 tests, EXIT 0; `npm run lint` zero warnings; `npm run guard:no-timers` OK.

Out of scope (unchanged, owner ruling pending): whether EB-Join board-wide re-rolls should sweep finite-round clocks — see Sibling lane note.
