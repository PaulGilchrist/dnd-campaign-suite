# BUG MA-0633 — Dretch "Fetid Cloud" (actions[3], aoe-save DC 11 Constitution) — FAIL(a): 1/DAY USE LIMIT UNENFORCED

## Overview
Fetid Cloud authors `usage: {type: "per day", times: 1}` but the save-chip economy never reads the `usage` key — the action refires unlimited times, zero refusal, zero spend. The core save mechanics (radius picker, DC 11 CON, poisoned on fail) are live and exact; the limited-uses gate is display-only metadata — a real, expected FAIL per the trichotomy (display-only `uses`/`recharge` with no enforcement).

## Expected Behavior (row)
- description: "Any creature that starts its turn in that area must succeed on a DC 11 Constitution saving throw or be poisoned until the start of its next turn." — usable ONCE per day per disk `usage: {type:"per day", times:1}`.
- Second use must be refused with spend-gate (compare §61 recharge gate, §57 1/Day monsterSpellUses + `automation blocked` refusal for spell chips).

## Actual Behavior (live, test-campaign, round 1 constant)
- Fire #1: DC 11 CON picker (10-ft radius, advisory), both bandits save (nat14/nat11 pass) — 0 damage (correct, damageless row).
- Fire #2: Bandit 1 nat3 FAIL → Poisoned applied (`condition applied` + activeConditions `[poisoned]` + badge "Poisoned DC 11", source Dretch 1) ✓ mechanics exact.
- Fire #3 (SAME turn): re-fired ungated — Bandit 1 nat8 fail poisoned re-applied, Bandit 2 nat4+rig19 saved, NO refusal popup, NO `automation blocked`/`<slug>_refused`, zero spend on `usage`.
- 3 fires, same turn, zero refusals.

## Steps to Reproduce
1. test-campaign → EB join exact "Dretch" + Bandit qty2, stage 999, arm Bandit 1.
2. Open Dretch card → Fetid Cloud DC 11 chip → picker → confirm (fire #1).
3. Click the same chip again (fire #2), then a third time (fire #3): all resolve, no gate.

## Likely Location
- **DATA (shape mismatch)**: disk authors `usage:{type:"per day",times:1}`; consumer `abilitySaveMaxUses` reads only `maxUses`/`uses` fields (grep: no reader of `usage.type`/`usage.times` for save rows; §57 1/Day economy binds `monsterSpellUses` on SPELL chips only; §61 recharge economy requires `recharge` field). Non-standard field = cosmetic metadata (§114 fingerprint).
- Fix: author standard `uses:1` (+ a per-day reset consumer, §70 residual: no rest-rearm consumer app-wide — document) OR make the monster uses economy read `usage.*`.
- Secondary (documented, non-gating): zone "starts turn in area" trigger, 1-min duration, lightly obscured, spread corners, while-poisoned action-xor/no-reactions trio = zero consumers (§68 trio producers never fire; SaveAttackAoeModal.jsx:469 grants without `addExpiration` clock → badge persists past next turn-start, §84 residual).

## Notes
- Save legs exact: DC 11 enforced, fail→poisoned lands (§117 override live), success-clean proven with full-word cs saveBonuses rig (MA-0618 seam), zero damage both legs (damageless row, half-default moot).
- Sibling gated twins with live economy: MA-0618/MA-0603 (`recharge` authored → spend/refused/recovery d6 fully live) — Fetid Cloud's `usage` shape is the outlier that no consumer reads.
