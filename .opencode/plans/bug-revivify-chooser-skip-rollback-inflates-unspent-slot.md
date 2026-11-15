# Revivify corpse-chooser `Skip` refunds a slot that was never paid (and logs a cast row for a cast that never happened)

**Filed by:** e2e-improve run 2026-11-15 (surfaced while verifying improve `revivify-chooser-disabled-hint`; deliberately NOT fixed there — that improvement's acceptance criteria required the Skip lane to stay byte-unchanged).

## Summary
The Revivify target chooser opens **unpaid** (no slot consumed at arm — the slot is consumed at CONFIRM, inside `useConfirmableFlow`'s `gateSpellSlotAvailability`/`consumeSpellSlotWhenConfirmed` path, live-censused by the QA descent). Its `Skip` button nevertheless routes to `useConfirmableFlow.createSkipHandler`, which unconditionally **logs a `type:'spell'` cast row** and **calls `rollbackSpellSlot`** — a refund for a payment that never occurred. Net effect of one Skip on an unpaid Revivify chooser: one phantom cast row in the campaign log, plus one `level-3` slot credit, i.e. `spell_slots_level_3` drifts ABOVE the class max (an 8th-level caster's 3/3 becomes 4/3).

## Steps to reproduce
1. GM/dev tab on `test-campaign` with a lv8+ caster whose backpack holds `Diamond (300 gp)` and whose board carries a corpse (`currentHitPoints: 0`, `isDead: 1` seeded via full-store POST pre-select).
2. Record `spell_slots_level_3` in the caster's runtime bucket.
3. Press `Revivify` (Actions grid) → `Cast Spell` in the detail modal → the chooser opens. Fetch census from here should read ZERO writes (this is the unpaid-open proof — re-verify it holds before assuming).
4. Press `Skip`.

## Expected behavior
Skip on an UNPAID chooser dismisses with zero writes and zero log rows (the established §11 unpaid-lane law: "Skip on an unpaid chooser must not `rollbackSpellSlot`" — the HoH-picker `Cancel` and the heal-chooser refusals are the sibling precedent for zero-spend dismiss).

## Actual behavior
Skip emits two writes:
- `addEntry` `type:'spell'` cast row for a spell that was never cast (target field populated from `getTargets`), and
- `rollbackSpellSlot(... upcastLevel || spellLevel || 0)` → full-mirror POST writing `spell_slots_level_3` = max + 1 (observed `4` on a lv8 cleric with max `3`).

## Likely location
Confident: `src/hooks/combat/useConfirmableFlow.js:164-191` — `createSkipHandler` has no "was this pending actually paid?" guard; it refunds and logs unconditionally. The pay-at-confirm semantics live in the same file's confirm lane (and the refusal lane already learned this lesson: commit `82b66bdef` added `pending.castRefused` to suppress the cast row on refused+refunded confirms — the Skip lane has no equivalent pay-state flag).
Pre-existing unit pins ASSUME pay-at-arm and therefore enshrine the inflation for this lane: `src/hooks/combat/useSpellMetamagicFlow.skip.test.js:232/294`. Per the playbook's stale-pin-inversion rule, those pins are suspect if the fix introduces a paid-state gate.

## Suggested fix
Give `makePending`/the gate a `paid` (or `slotConsumed`) stamp set when the slot is actually consumed at confirm, and in `createSkipHandler` short-circuit: unpaid pending ⇒ dismiss only, no `addEntry`, no `rollbackSpellSlot`. Lane-scope the gate so already-correct pay-at-arm consumers (if any exist — audit them) keep their exact refund bytes. Add co-located pins: unpaid-Skip ⇒ zero writes/zero rows; paid-Skip (whatever lane pays at arm) ⇒ unchanged refund pair.

## Severity
Data-integrity: one Skip per cast silently grants unbounded extra spell slots (repeatable: open chooser → Skip → slot +1) and pollutes the campaign log with cast rows that never happened. No crash.
