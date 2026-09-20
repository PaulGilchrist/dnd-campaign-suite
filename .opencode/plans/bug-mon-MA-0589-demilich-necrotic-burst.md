# Bug MA-0589 — Demilich "Necrotic Burst" (actions[1], attack) — FAIL (range-band-inert, MA-0529/MA-0539 twin)

**Date:** 2026-09-19 · **Campaign:** test-campaign only · **Verdict:** **FAIL** (dual-mode range-band inert; §115/§146/§147 + MA-0529/MA-0539 precedent: dual-mode dice-identical rows still FAIL on range-band inertness — keys on band, not dice-swap)

## Row (disk truth, public/data/monsters.json Demilich actions[1], verbatim)
```json
{
  "name": "Necrotic Burst",
  "description": "Melee or Ranged Attack Roll: +11, reach 5 ft. or range 120 ft. <strong>Hit:</strong> 24 (7d6) Necrotic damage.",
  "attack_bonus": 11,
  "reach": "5 ft.",
  "range": "120 ft.",
  "damage_dice_primary": "7d6",
  "damage_type_primary": "Necrotic"
}
```
- attack_bonus 11 ✓, dice "7d6" ✓, type Necrotic ✓, reach "5 ft." + range "120 ft." ✓ — matches manifest MA-0589 (stableKey demilich|actions|1).
- **NO `damage_dice_ranged`, NO separate ranged fields, NO "N/M" range band** (MA-0436 template fields absent). Single dice + prose dual range. Dice-identical both modes ⇒ numeric core same; ranged half inert-by-construction (§147).

## Defect
The row demands "reach 5 ft. **or** range 120 ft." — the app never consults the 120 ft. half:
1. `resolveAttackRange` (MonsterCardModal.jsx:855, live line; playbook cites :734): **reach-first** — `action.reach` present ⇒ range = rangeToFeet("5 ft.") = **5**; authored `range:"120 ft."` unreachable code for this row.
2. `rangeToFeet` (rangeValidation.js): single-number regex `^(-?\d+…)\s*(feet|foot|ft\.?)?$` only; `parseRangedBand` (MonsterCardHelpers.js:708) regex `^(\d+)\s*\/\s*(\d+)$` ⇒ "120 ft." = **null band**; band-split grep-zero (`grep -rn "damage_dice_ranged|range_band|rangeBand" src/` hits only MA-0436/0529/0539 helper+test files; `melee_or_ranged|rangedFormula` grep-zero).
3. `buildRangedVariantOffer` → `rangedVariantRowArmed`: variant=null AND band=null ⇒ **null offer ⇒ no Melee/Ranged HIT-popup chooser** (§105 chooser arms ONLY w/ authored ranged fields — correctly absent here; live popup audit below).
4. `buildRangedBandAdvisory` (MA-0539 seam) requires `!action.reach` — Demilich HAS reach ⇒ advisory **null**; even the advisory-only seam cannot arm on this reach-bearing shape.
5. Live machine truth: every attack log + `lastAttack` carry **`rangeReason:null`, `range:null`** = band consulted-never-applied (§115).

## Live evidence (fresh, this session — EB join Demilich 1 + Bandit 1 AC12 + Knight 1 AC18, victims staged 999 via full-store /combatSummary POST {value}, armed on Demilich's OWN initiative-card target-select, round=1 const, active=Demilich 1, zero Next clicks)
### Fresh ledger (nat = first die §92; popup total = nat+11; 7d6 == finalDamage == |hpΔ|)
| # | vs | nat | to-hit | hit | 7d6 rolls | dmg | hpΔ |
|---|----|-----|--------|-----|-----------|-----|-----|
| 1 | Bandit AC12 | 10 | 21 | ✓ | 3,6,6,1,3,4,1 | 24 | 999→975 ✓ |
| 2 | Bandit AC12 | 3 | 14 | ✓ | 3,5,2,2,1,4,4 | 21 | 975→954 ✓ |
| 3 | Bandit AC12 | 2 | 13 | ✓ | 1,6,4,5,1,1,4 | 22 | 954→932 ✓ |
| 4 | Knight AC18 | 13 | 24 | ✓ | 5,2,2,6,1,6,4 | 26 | 999→973 ✓ |
| 5 | Knight AC18 | 6 | 17 | ✗ MISS | — | 0 | none ✓ |

- Log: 5 attack rolls / 4 damage entries / 4 hp_change — clicks 5 = rolls 5, zero absorbed (§138); MISS #5 popup "✗ MISS (17 vs AC 18)", no Done, zero damage entry, cs Knight stayed 973.
- AC12 boundary note (§118): vs Bandit AC12 miss structurally impossible (+11+nat1=12) — Knight AC18 supplied the boundary: nat≤6 miss / nat≥7 hit, both observed.
- AC12-vs+11 all-Bandit hits + Knight 24/17 straddle confirm resolver used authored AC, base (no buffs armed).
- damageType Necrotic on every entry; zero condition/targetEffect entries (disk has no hit_conditions §150); no crits rolled (nat 10/3/2/13/6 — crit seam byte-identical family, cited not probed §32); mode:normal dup-second-die cosmetic (§92).
- Corroboration (not evidence): checkpoint-mon-MA-0588.md — same chip, 4-hit exact ledger +11 vs AC12, 7d6==finalDamage==hpΔ 35/31/21/24, round-constancy.

### Chooser / band audit (stage-1 + stage-2 popups, live)
- `.popup-overlay` full query: `[role=switch]`=0, `[role=radiogroup]`=0, `[role=tablist]`=0, `input[type=radio]`=0, `select`=0; popup innerText `melee`=false `ranged`=false (§147 proof-of-no-mode-toggle). Controls: stage-1 "d20 +11 ✓ HIT / Done", stage-2 damage+applied line, buttons=[dice-roll-reroll-btn Done] then zero-button dismiss stage.
- `lastAttack`: `{rangeReason:null, range:null, mode:null}` post-miss.
- Gridless: 5ft vs 120ft observably identical (distanceFt=null ⇒ computeRangeEffect {mode:'normal'} lenient §42); no >120ft enforcement possible on gridless; on grid the row would resolve reach=5 (120 ft. half dead).

## Adjudication
Per playbook §115 ("Dual-mode dice-identical rows still FAIL on range-band inertness (MA-0529 keys on band not dice-swap); rangeReason:null = band consulted-never-applied") and registry MA-0529 ("FAIL-Dagger dual-mode ... no range field/consumer/toggle, overlay toggle audit zero, rangeReason:null") + MA-0539 twin ("FAIL flavor-b twin-of-MA-0529 range-band-inert ... advisory rangeReason so the attack log carries band truth"): **same fingerprint ⇒ same verdict class = FAIL.** Numbers are exact (4/4 applied hits exact, boundary miss clean) but the "range 120 ft." half of the row is inert: authored single-number range is structurally unreachable (reach-first + no band + no variant dice + no advisory seam).

## Fix guidance (data-first, no app changes required)
Author the MA-0436 template shape on the row: `range:"5/120"` + `damage_dice_ranged:"7d6"` (dice-identical arms chooser per MA-0529 ratchet — band keys the arming, not a dice swap) ⇒ HIT-popup stage-2 Melee/Ranged chooser + normalFt/longFt advisory on ranged-select log. App-side: rangeValidation band-split remains the structural gap (§146).

## Registry config
- MA-0589 stableKey `demilich|actions|1`, monster Demilich, actionIndex 1, actionType attack, verified: orchestrator-owned (subagent edits forbidden §1/§8).

## CLEANUP — COMPLETE
npc-remove ×3 (§108 confirm-override), admin clear-change-data + clear-log 200/200, curl-verified log==[] / combatSummary cleared; no src/public-data/manifest/git writes.
