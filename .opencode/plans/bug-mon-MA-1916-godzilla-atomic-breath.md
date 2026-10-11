# MA-1916 — Godzilla "Atomic Breath (Recharge 5-6)" — Recharge unenforced (data)

## Title
Atomic Breath: recharge field unauthored → unlimited same-fight refire; save core (DC 27 DEX, 26d6 Radiant, floor-half on success) resolves exactly.

## Overview
Row MA-1916 (`godzilla|actions|4`), actionType `aoe-save`, verified E2E localhost/test-campaign 2026-10-11. Breath-twin pattern (MA-1843/MA-1859/MA-1898/MA-1907): all numbers exact, recharge gate absent — "Recharge 5-6" is name-text only; disk authors no `recharge` field; `rechargeUsageOf` (monsterRecharge.js) resolves null.

## Expected Behavior
Row description: "Dexterity Saving Throw: DC 27, each creature in a 120-foot-long, 10-foot-wide Line. Failure: 91 (26d6) Radiant damage. Success: Half damage."
Plus RAW: once used, requires a 5-6 recovery die before reuse.

## Actual Behavior
- Save core EXACT:
  - Picker opens "120-ft Line (GM positions tokens; selection advisory)" via description-token parse despite absent `range` (MA-1898/1907 twin).
  - FAIL legs (wb −30 seam clamp): EP nat5−22 = −17 < 27 → raw 104 fd 104 FULL (224→120); HW nat3−31 = −28 < 27 → raw 93 fd 93 FULL (103→10) — separate pools.
  - SUCCESS legs (wb +30): EP nat14+38 = 52 ≥ 27 → raw 95 fd 47 = floor(95/2) (→177); HW nat7+29 = 36 ≥ 27 → raw 100 fd 50 = floor(100/2) (→53).
  - 8/8 save-damage entries sdc:27 DEX Radiant-only; |hpΔ|==fd chains exact.
- RECHARGE FAIL(b): second press same fight reopened picker and fired; zero refusal popup/log-token, no `-spent` chip class, `ability_use` ×2, `monsterRecharge`/recharge keys grep-empty (top + per-char). Fix: one-field `recharge:"5-6"` (monsterRecharge.js consumer live, MA-1164 precedent).

## Steps to Reproduce
1. localhost → test-campaign → Godzilla in initiative; arm 2 victims.
2. Press "DC 27 Dexterity" chip (Atomic Breath row) → picker → confirm → full/half exact.
3. Press again immediately → picker reopens and fires again; no gate, no recovery die.

## Likely Location
`public/data/monsters.json` — one-field fix `recharge:"5-6"` on godzilla actions[4] (family fixes: MA-1843, MA-1859, MA-1898, MA-1907).

## Notes
- Leading Evasion chooser (HeroesFeastBard) auto-opens before each per-target PC prompt — mandatory Skip per target (MA-1898 pitfall); Radiant-clean victims used.
- Observed :80 mid-session runtime self-wipe (log/cs/cd empty, server 200) — rebuild via re-select + EB re-join + re-rig; stale `.sp-modal` Results popups survive a wipe and intercept chip presses — Close first.
- Top-up HP before the success leg or dead-clamp poisons half-leg adjudication.
