# BUG MA-1688 — Water Elemental Slam: Prone-on-hit rider never granted (FAIL(a)/DATA)

- **Row:** MA-1688 `water-elemental|actions|1` — Slam, +7, reach 5 ft., "2d8 + 4" Bludgeoning
- **Verdict:** FAIL(a)/DATA — numeric axis LIVE, condition rider zero-state on hits
- **Date:** 2026-09-30, dev:locked :5173, test-campaign ONLY, all work localhost (header "test-campaign" + location.href self-verified every step; no off-site tabs opened)

## STEP 1 STATIC (disk truth, own read)
`public/data/monsters.json` water-elemental actions[1]:
- keys = `['name', 'description', 'attack_bonus', 'reach', 'damage_dice_primary', 'damage_type_primary']`
- attack_bonus **7**, damage_dice_primary **"2d8 + 4"**, damage_type_primary **"Bludgeoning"**, reach **"5 ft."**, description byte-identical to manifest — all byte-match TRUE.
- **hit_conditions ABSENT** — quoted above; no `conditions` key either. Manifest `conditions:["prone"]` is prose-extracted and has ZERO attack-path consumer (buildHitConditionClause MonsterCardHelpers.js:850 → hitClauseAutoGrantConditions :827 reads `action.hit_conditions` ONLY; §153/§495/§449/§1086 family).
- Rider is UNGATED-hit ("If the target is a Medium or smaller creature, it has the Prone condition." — size gate only, NO movement clause unlike MA-1677 warhorse-skeleton Hooves) → fixable via live MA-0756/MA-0775/MA-1116/MA-1534 hit_conditions lane. Prose-only + unauthored + zero-grant on hits → FAIL(a)/DATA per family MA-1344/1389/1400/0763.
- No 2024 twin. avg sanity floor(2d8)+4 = 13 = prose "13 (2d8 + 4)" ✓.

## LIVE LEDGER (5 real-pointer presses §442, press-to-log 1:1, console 0 errors)
| # | nat | total | vs AC | hit | formula | dice | fd | hp chain |
|---|-----|-------|-------|-----|---------|------|----|----------|
| 1 | 6 | 13 | 12 | ✓ | 2d8 + 4 | [1,1] | 6 | 999→993 |
| 2 | 18 | 25 | 12 | ✓ | 2d8 + 4 | [2,2] | 8 | 993→985 |
| 3 | 15 | 22 | 12 | ✓ | 2d8 + 4 | [7,3] | 14 | 985→971 |
| 4 | 13 | 20 | 12 | ✓ | 2d8 + 4 | — | 11 | 971→960 |
| 5 | 1 | 8 | 12 | ✗ honest nat1 | (no damage entry) | — | — | held 960 |

- Formula "2d8 + 4" Bludgeoning byte-exact 4/4 hits; `finalDamage` == Σdice+4 == `|hpΔ|` every entry; Σfd 39 == Σ|hpΔ| 39, UNCLAMPED at maxHp 999 (§181); `damageBreakdown.resisted:false` (Bandit resistances:[] rig §75).
- lastAttack nat1 face: hit:false, isNatural1:true, `saveDc/saveType/dcSuccess:null` — zero save affordance (none authored); chip census = ONE "+7" `.mc-dice-link` on Slam row (§116); Multiattack header zero links (§440); toggles 0.
- Crit face (nat20, flat +4 undoubled §32) starved in 5-press budget — honest straddle (§MA-1632), do not chase; seam proven family-wide.
- Rig: EB exact-td join Water Elemental(ac14 hp114 disk-exact)+Bandit → ONE full-store /combatSummary POST (§491): Bandit ac12, HP×4 999, resistances:[]; WE targetName:"Bandit 1" same body; selectOption own-card arm (§699), server tn confirmed.

## ZERO-PRONE MACHINE PROOF (§1116 ladder, every hit)
1. Victim change-data store KEY ABSENT all session: `'Bandit 1'` keys `[]` — never appears in change-data (`activeConditions`/`activeConditionMeta` never created) — STRICTEST zero-grant proof.
2. Whole-log `type:*condition*` entries: **0**.
3. Whole-log "prone" (case-insensitive, all serialized entries): **0 occurrences**.
Consumer live-but-unarmed: applyHitClauseConditions handlePlainDamage.js:553 gated by buildHitConditionClause clause, which is null without `hit_conditions`.

## FIX (DATA, one field)
Add `"hit_conditions":["prone"]` to water-elemental actions[1] — MA-0775 ghast Claw one-field byte-shape (MA-1116/MA-1534 prone twins; grants + `type:condition` log + `meta{source}` live; damage row otherwise byte-unchanged MA-0322 lineage).
- **Anchor caution:** 38 "Slam" rows app-wide — anchor on water-elemental-unique bytes (this description tail "Medium or smaller creature, it has the Prone condition." + "2d8 + 4" + following unique row "Whelm"), assert raw.count==1 (§22/§1021/§1161 family).
- No stale-pin inversion needed: grep-zero water-elemental mentions in src tests (§216 clean).

## ADVISORY (§70, do not build in this ticket)
- Size-gate gap: consumer `isLargeOrSmallerTarget` handlePlainDamage.js:537/:543 ADMITS Large vs RAW "Medium or smaller" — naive authoring over-applies on Large victims; no size-cap field on hit_conditions lane (§1141/§1116 residual). Bandit (Medium) victim clean either way.
- Prone expiry/stand-up movement cost: no token-move consumer (§70 persistent-prone standard).

## CLEANUP
Popups+card closed (own DOM audit, localhost) → TAB CLOSED FIRST (§15) → POST admin/clear-change-data 200 + admin/clear-log 200 (§MA-1661 admin/; no-confirm scripted path §970) → verified log [] / cd {} / cs {"value":null}. Board QUIET.
