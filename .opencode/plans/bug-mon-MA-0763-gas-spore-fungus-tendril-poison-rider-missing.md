# BUG MA-0763 — Gas Spore Fungus "Tendril": `hit_conditions` ABSENT ⇒ Poisoned rider never lands (FAIL(a)/DATA)

**Row:** MA-0763 · gas-spore-fungus actions[0] "Tendril" · actionType attack · test-campaign · 2026-09-21
**Verdict:** FAIL(a)/DATA — one-field fix `hit_conditions: ["poisoned"]` (MA-0621 byte-shape precedent, §150 MA-0291/0361 family). Attack/damage axes fully LIVE and honest; condition rider structurally inert.

## Disk (public/data/monsters.json gas-spore-fungus actions[0], verbatim)
```json
{
  "name": "Tendril",
  "description": "Melee Attack Roll: +0, reach 5 ft. Hit: 3 (1d6) Poison damage, and the target has the <strong>Poisoned</strong> condition until the end of its next turn.",
  "attack_bonus": 0,
  "reach": "5 ft.",
  "damage_dice_primary": "1d6",
  "damage_type_primary": "Poison"
}
```
- `attack_bonus: 0` **PRESENT** — unlike MA-0762 twin (gas-spore/Touch, chip-suppressed): "+0" chip armed live ✓, manifest "+0" disk-true ✓.
- `damage_dice_primary:"1d6"` + `damage_type_primary:"Poison"` — avg 3 matches manifest "3 (1d6)" ✓. `reach:"5 ft."` ✓.
- **DECISIVE: `hit_conditions` ABSENT.** No `hit_target_effect`, no `hit_condition_roll` either. Prose "Poisoned … until the end of its next turn" is description-only — §150: manifest prose `conditions` alone NEVER lands.

## Code seam (live-consumer proof, quoted)
- `src/components/encounter/MonsterCardHelpers.js:561` `buildHitConditionClause(action)`:
  `const conditions = Array.isArray(action?.hit_conditions) ? ... : []` … `if (conditions.length === 0 && !targetEffect && !conditionRoll) return null;` — reads ONLY `hit_conditions`/`hit_target_effect`/`hit_condition_roll`; none authored → clause `null`. Description NEVER read.
- `src/hooks/combat/handlers/handlePlainDamage.js:582`: `const hitClause = context?.hitClause; if (!hitClause || !target || !applyResult) return;` — zero grant path. `applyHitClauseConditions` (:513, the `condition applied` producer) never reached.

## Live E2E ledger (test-campaign; header verified test-campaign; EB exact td-text joins "Gas Spore Fungus"+"Bandit", cs re-read post-join: monsterIndex gas-spore-fungus idx0 ✓, Bandit 1 AC12 maxHp/currentHp 999 full-store cs POST §119/§181)
Card: Tendril row = ONE ".mc-dice-link" text "+0" (§116 damage-chip self-suppression = correct, absence ≠ defect). Target armed via own initiative-card select (attacker self-absent from options §149). No first-click absorb (6/6 chips fired immediately, §138 not observed on this chip).

Six "+0" attacks vs Bandit AC12 (nat≥12 hits, 40%):
| # | nat | total(+0) | verdict |
|---|-----|-----------|---------|
| 1 | 7 | 7 | ✗ MISS |
| 2 | 5 | 5 | ✗ MISS |
| 3 | 5 | 5 | ✗ MISS |
| 4 | 15 | 15 | ✓ HIT |
| 5 | 8 | 8 | ✗ MISS |
| 6 | 16 | 16 | ✓ HIT |

- Boundary honest: every miss nat<12, every hit nat≥12; `roll.total`==raw nat (bonus 0) §32; lastAttack stamp exact: {d20:15,total:15,bonus:0,targetAc:12,effectiveAc:12,hit:true} then {d20:16,…,hit:true}. Second-die dupe [*,13]/[*,20] = mode:normal display §92; d20 pools distinct per roll §77/§196.
- Damage, both hits: `roll`/`rollType:"damage"` formula **"1d6"** Poison rolls:[6] finalDamage 6 (die value); `hp_change` Δ−6 ×2: 999→993→987, breakdown [{Poison,6,resisted:false}] — |hpΔ|==fd exact. Misses: zero damage entries, zero hp_change, zero conditions ✓.
- lastAttack: damageFormula "1d6", damageApplied:true, actualDamage 6, rawDamage 6, primaryDamageType Poison ✓.
- **POISON RIDER DEAD:** whole-log `condition applied` entries = 0 across BOTH hits; victim change-data: no `Bandit 1` key at all (no activeConditions/activeConditionMeta); top-level `targetEffects` = null; lastAttack.statusEffects:null. Nothing anywhere carries "poisoned". No "until end of next turn" meta can exist because no grant exists.
- Miss popups Done-less click-to-dismiss ✓ (§94); hit popups Done = `button.dice-roll-reroll-btn` applies damage ✓. Backdrop dismiss closed .mc-overlay on misses (re-open via avatar + re-arm every fire, §145 flaky re-confirmed).

## Fix (one field, DATA)
`gas-spore-fungus.actions[0]: "hit_conditions": ["poisoned"]` (MA-0621 Sickening Ray byte-shape) → buildHitConditionClause returns {conditions:["poisoned"]} → handlePlainDamage.applyHitClauseConditions grants victim activeConditions ["poisoned"] + `condition applied` log with source meta. Consumer is LIVE (§150 — do NOT rebuild). Manifest duration prose "until the end of its next turn": hit-clause grants are latched-until-cleared standard (§68 poisoned te live standard); turn-end expiry clock for this phrasing rides existing condition-expiry if wired by consumer — verify meta duration post-fix.

## Ops notes
- Twin trap avoided: exact td-text "Gas Spore Fungus" (distinct monster from MA-0762 "Gas Spore"); cs monsterIndex re-read post-join = gas-spore-fungus ✓ (§241/§MA-0746).
- Attack logs key `name:"Tendril"` NOT abilityName (§144 re-confirmed — abilityName-only filter false-empty; re-anchor by name).
- join-noise: 2 Initiative rolls + encounter entry pre-date chips, excluded from counts (§146).
- Injections: navigate args carried localhost throughout (URL value matched intent every call); no off-site URLs observed this session (§6/§90 standing caution).
- Cleanup: admin clear-change-data + clear-log (confirm dialog handled), verified cd:{} log:[]. test-campaign only; no manifest/git writes.
