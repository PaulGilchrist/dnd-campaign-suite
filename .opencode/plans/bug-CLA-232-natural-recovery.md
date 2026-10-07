# CLA-232 Natural Recovery — FAIL (E2E 2026-10-07, test-campaign, localhost:5173)

Host: Wild_Sage_Druid lv20, step-7 re-pointed Circle of the Moon → **Circle of the Land** via edit wizard UI, disk-verified (`class.subclass.name: "Circle of the Land"`), KEPT. Natural Recovery passive/row appears on sheet and in SR modal after re-point. Canonical quote (`public/data/2024/classes.json` Druid → Circle of the Land lv6):
> "You can cast one level 1+ prepared spell from Circle Spells without expending a spell slot, once per Long Rest. When you finish a Short Rest, you can recover expended spell slots with combined levels equal to or less than half your Druid level."
automation: `type: natural_recovery`, `trigger: short_rest`, `restore_expression: druid_level / 2`, `resourceKey: naturalRecoverySlots`, `uses_max: 1`, `restoreType: spell_slots`.

## Defect A — lv2 recovery selections lost on Apply (ledger mismatch)
Drain (real casts): Longstrider×2 + Cure Wounds×2 (lv1), Barkskin×2 (lv2), Call Lightning×1 (lv3) → GET change-data `spell_slots_level_1..3 = 0,1,2` (11 expended levels).
SR modal: budget shown **"Budget: 10 of 10 levels remaining"** (=floor(20/2)) ✓; ticked lv1×4 + lv2×2 (budget→"2 of 10"); lv3 `+` correctly `disabled` though Available 1 (budget 2 < 3 — 11th level blocked ✓).
Confirm → log `Natural Recovery: 4x level 1, 2x level 2`. GET ledger: `level_1: 0→4 ✓ (+4 numeric)`, but **`level_2: 1→1` ✗ (expected 3; claimed +2 silently dropped)**.
Suspected root cause: `applyNaturalRecoverySelections` (`src/components/char-sheet/ShortRestModal.jsx:45-55`) fires per-level `setRuntimeValue` in a loop; lv2 write lost (same-tick batch overwrite/echo race — cf. AGENTS.md skipSync caveat). Contrast: arcane path uses `setRuntimeBatch` (:41).

## Defect B — once-per-Short-Rest not enforced (uses_max:1)
Immediately re-opened SR modal (no LR between): **Natural Recovery section renders again, "Budget: 10 of 10 levels remaining"**, lv2 Available 2 and lv3 Available 1 re-offered, `+` live. GET: `naturalRecoverySlots: 10` unchanged — no producer anywhere decrements it (grep: only init `trackedResources.js:306`, LR reset `restRules-longRest.js:446`, modal read `ShortRestModal.jsx:218`). `naturalRecoveryAvailable = naturalRecoveryCur !== 0` (§CLA-245 gate) therefore never false; no refusal log entry either. Canonical recharge (`uses_max: 1`; feature text "When you finish a Short Rest, you can recover…") violated — infinite full-budget SR slot recovery possible.

## PASS legs
- LR full reset ✓: slots back to 4,3,3,3,3,2,2,1,1 (incl. the +2 lv2 lost by Defect A), `naturalRecoverySlots → null` re-armed; log `Wild_Sage_Druid takes a long rest. | Resources restored: All hit dice restored, All spell slots restored, Natural Recovery (spell slots)`.
- Control War_Cleric lv8 Trickery SR modal ✓: only "Resources Restored: Channel Divinity" — no Natural Recovery row, no slot recovery (differential correct).

## Cleanup (GET-verified)
Admin → Clear Change Data + Clear Campaign Log (test-campaign confirms) → `change-data = {}`, `log = []`. Subclass **Circle of the Land KEPT** on disk (registry).

## Repro
1. Land druid ≥lv6 with expended lv2 slots; SR → tick lv2 → Complete → GET ledger: lv2 unchanged.
2. Open SR again same cycle: full 10/10 budget re-offered, naturalRecoverySlots never decremented.
