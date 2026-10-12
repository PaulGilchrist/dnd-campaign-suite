# bug-mon-MA-1920-godzilla-nuclear-pulse-poison-not-granted

**Row:** MA-1920 `godzilla|legendary_actions|3` — "Nuclear Pulse (Costs 2 Actions)" (legendary numeric save child)
**Verdict:** FAIL(b)/DATA — Poisoned condition rider never granted on failed save. One-field fix.

## Defect
Disk `public/data/monsters.json` godzilla `legendary_actions[3]` authors **NO `save_effect` field**. The Poisoned rider + "for 1 minute" duration live only in `description`. The save lane word-scans `save_effect` ONLY (§346; legendary save route `resolveLegendaryRowMechanic` → `handleSaveRoll(action, formula, extractConditionsFromSaveEffect(action.save_effect))` MonsterCardModal.jsx:754 — `extractConditionsFromSaveEffect(undefined)` → `[]`). Zero producers read conditions from description (MA-1855 Dread Word / MV-31 / MA-0090 family precedent).

**Live machine proof (test-campaign :5173, 2026-10-11):** FAIL face (ElderPaladin, wb:-30, save total -8 < DC 25, saveResult success:false) → **zero `condition applied` log entries app-wide, `activeConditions:[]`, `activeConditionMeta:{}`**. The manifest `conditions:["poisoned"]` label is disk-unsupported (disk is truth §383).

## Fix (DATA, one field)
Author `save_effect` byte-carrying the canonical condition word + duration, e.g.
`"save_effect": "On a failed save the target also has the Poisoned condition for 1 minute."`
- Canonical word "Poisoned" → extractConditionsFromSaveEffect → [poisoned] (§346).
- Clock: save-lane grant rides ONE addExpiration; "for 1 minute" → rounds:10 (§37).
- Do NOT put dice+"damage" wording into save_effect beyond the rider clause risk — this row's damage pool is already primary (MA-1867 §536 composite disarm applies only to attack_bonus composites; this row has no attack_bonus, DC chip renders clickable — live confirmed).

## What PASSES (all other axes verified live)
- DC 25 Constitution enforced: prompt "CONSTITUTION … DC 25", save_result dc:25, victim roll/save dc:25.
- FAIL face: raw 16d6=56, finalDamage 56 FULL, damageType Radiant-only, hp_change −56 (224→168 unclamped), resisted 0 (victim radiant-clean disk MA-1916).
- SUCCESS face (wb:+30 flip): nat18+40=58 ≥25 → raw 16d6=53, finalDamage 26 == floor(53/2) EXACT (dc_success absent → default half §335, prompt copy "Half damage on successful save"); success zero condition grant (RAW-correct, vacuous-true while channel dead).
- **Cost floor ENFORCED (MA-1883 lane live for this row):** press spends **2** ("spends 2 legendary uses … 1 of 3 left", monsterLegendaryUses used 0→2 twice across boundaries); at legal fresh boundary with 1 left → refusal popup + `insufficient-cost: costs 2, 1 left` log, zero spend, zero roll. MA-1839 spends-1 residual SUPERSEDED — no cost residual on this row.
- Legendary economy: boundary latch `turn` refusal, regain at 2:Godzilla 1 turn-start used→0 "regains all expended legendary action uses … 3 available", counter chain (3→1→refuse→regain 3→1) exact.
- Save-chip self-suppresses Expend (§204); chip "DC 25 Constitution" rides header gate spend-then-save.
- Console 0 errors; pc prompt lane wb folds (saveBonus:40, bonusDetail "+30 [Warding Bond]").

## Advisory residuals (not defects)
- "each creature within 30 ft." — no range field + no shape token → breathAoeShape null → picker NEVER opens; inline single-target adjudication vs armed target (§211/MA-1843/MA-1859 accepted degradation family).
- Poisoned "for 1 minute" clock unverifiable until save_effect authored (condition never granted today).

## Cleanup
admin clear-change-data + clear-log 200 → cd {} log [] quiet 15s. No manifest/registry writes.
