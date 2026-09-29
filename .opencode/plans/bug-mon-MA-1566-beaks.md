# BUG MA-1566 — Swarm of Ravens "Beaks": Bloodied 1d4 prose variant inert (no conditional_damage authored)

**Verdict: FAIL(a)/DATA** — base attack LIVE exact (+4 / 1d6 + 2 Piercing, hit+miss confirmed); bloodied "2 (1d4) Piercing" variant never fires (confirmed live, zero delta, zero chrome). Row matches expectation; defect is the missing structured variant in the data.
**Row:** Swarm of Ravens (`swarm-of-ravens`) / Beaks / attack, +4, reach 5 ft., 1d6 + 2 Piercing — description promises "2 (1d4) Piercing damage if the swarm is Bloodied." NO `conditional_damage` field authored in `public/data/monsters.json`.
**Date:** 2026-09-29 · E2E via Playwright on localhost:5173, test-campaign ONLY

## What failed

- **FAIL — bloodied variant inert.** Swarm pressed down to **5/11** (≤ half 5.5 → Bloodied per prose), attacked Bandit (AC 12): roll **d20 8 +4 = 12 → HIT**, damage popup rendered **"1d6 + 2: 5 +2" → 7 Piercing** (Bandit 11 → 4). Same base formula as healthy state — the prose's **"2 (1d4)"** variant never engaged. Popup chrome shows base dice only; `lastAttack` payload on the bloodied hit carries `damageFormula:"1d6 + 2"`, `rolls:[5]`, `primaryDamage:7`, and **zero** conditional/variant/bloodied keys (`secondaryFormula:null`, `secondaryDamage:null`). Campaign log `conditional=0`: 3 `damage` entries for Beaks, every one `formula:"1d6 + 2"`; 0 mentions of `1d4`/`conditional` anywhere in the run.

## PASS evidence (base lineage LIVE exact — confirms expectation)

- **EB exact:** searched "Swarm of Ravens" (CR 0.25) + "Bandit" (CR 0.125), Join Encounter → initiative: Bandit 1 (init 16), Swarm of Ravens 1 (init 10). Swarm Target set to Bandit 1 (AC 12). First card click absorbed (§138).
- **Healthy hits — base dice exact:**
  - d20 **12** +4 = **16 vs AC 12 HIT** → `1d6 + 2: 6 +2` = **8 Piercing** → Bandit 11 → 3 (log `damage` rolls:[6] total:8; `hp_change` delta:-8).
  - d20 **11** +4 = **15 vs AC 12 HIT** → `1d6 + 2: 4 +2` = **6 Piercing** → Bandit 11 → 5 (log rolls:[4] total:6; delta:-6).
- **Healthy miss (d20 ≤ 7 band):** d20 **3** +4 = **7 vs AC 12 ✗ MISS** — no damage popup, no `damage`/`hp_change` log entry after it; Bandit untouched. (Log `attack` entry: `rolls:[3,14], total:3, bonus:4`.)
- **Static match:** row == `public/data/monsters.json` `swarm-of-ravens` Beaks (`attack_bonus:4`, `damage_dice_primary:"1d6 + 2"`, `damage_type_primary:"Piercing"`, prose-only; swarm HP 11, half = 5.5).

## Root cause (static)

- **Variant never authored:** Beaks row carries only `attack_bonus`, `reach`, `damage_dice_primary`, `damage_type_primary`. The Bloodied clause lives solely in prose. No engine seam reads it, so healthy and bloodied hits roll identically.
- **Fix (prose verbatim):** add to the `swarm-of-ravens` Beaks row: `conditional_damage: { dice: "1d4", damage_type: "Piercing", condition: "Bloodied" }` — variant drops the +2 modifier, matching prose "2 (1d4)".

## Cleanup performed

Admin (test-campaign): Clear Change Data + Clear Campaign Log (both confirms accepted); initiative cleared via tracker "Clear". Verified: `GET /api/campaigns/test-campaign/log` → 0 entries; `change-data` → 0 keys, no `lastAttack`, no `combatSummary`.
