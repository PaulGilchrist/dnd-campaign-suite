# MA-1907 — Garuda "Whirlwind Flight (Recharge 5-6)" — Recharge unenforced (data)

## Title
Whirlwind Flight: recharge field unauthored → unlimited same-fight refire; save core (DC, damage, half-on-success) resolves exactly.

## Overview
Row MA-1907 (`garuda|actions|4`), actionType `aoe-save`, verified E2E localhost/test-campaign 2026-10-11. MA-1843/MA-1859/MA-1898 breath-twin pattern: everything works except the recharge gate — "Recharge 5-6" is name-text only; disk authors no `recharge` field, `rechargeUsageOf` gate null.

## Expected Behavior
Row description: "Strength Saving Throw: DC 23, each creature within a 60-ft. radius in the air. Failure: 55 (10d10) Bludgeoning damage. Success: Half damage."
Plus RAW: usable once, then a 5-6 recovery die needed.

## Actual Behavior
- Save core EXACT (picker "60-ft Radius" opened via description-token parse despite absent `range` — MA-1898 twin live):
  - FAIL (wb −30): EP total −3 vs 23 → raw 61 fd61 (224→163); HW −29 → raw 72 fd72 (103→31).
  - SUCCESS (wb +30): EP 53≥23 → raw 62 fd31=floor(62/2) (224→193); HW 31 → raw 53 fd26=floor(53/2) (103→77).
  - All 8 damage entries sdc:23/Strength/Bludgeoning-only; |Δhp|==fd ×4.
- RECHARGE FAIL(b): second press same fight reopened picker and fired; zero refusal popup/log-token, no `-spent` chip class, `ability_use` ×2, recharge state keys grep-empty (top + per-char). Fix: `"recharge":"5-6"` (MA-1164 consumers live).
- "in the air" clause inert (no airborne prerequisite authored/read) — advisory gap note.

## Steps to Reproduce
1. localhost → test-campaign → Garuda in initiative; arm victims.
2. Press "DC 23 Strength" chip (Whirlwind Flight row) → picker → confirm → full/half resolves exactly.
3. Press again immediately → picker reopens, fires again — no gate, no recovery die.

## Likely Location
`public/data/monsters.json` — one-field fix `recharge:"5-6"` on garuda actions[4] (family fix: MA-1843 apep, MA-1859 behemoth, MA-1898 garmr).

## Notes
- wb magnitude clamps at PC prompt seam (−30 folds as −20; +30 folds full).
- New pitfall: sp-modal picker batched checkbox clicks can check-then-revert; click one target + verify.
