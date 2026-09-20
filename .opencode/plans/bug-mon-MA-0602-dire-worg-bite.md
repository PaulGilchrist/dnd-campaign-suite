# BUG MA-0602 — Dire Worg "Bite" (actions[1]) — FAIL / DATA

## Verdict
**FAIL (DATA)** — Bite authors hit riders **Poisoned + "can't regain Hit Points"** with NO transport fields — riders never land (4/4 reconciled hits, zero state). MA-0600 lesson: missing field = DATA FAIL. (Evidence captured during MA-0601 Multiattack verification; multiattack header itself was §66-compliant and is recorded PASS-subset separately — the defect belongs to this Bite row.)

## Static (public/data/monsters.json → dire-worg)
- actions[0]: `{name:"Multiattack", description:"The worg makes three Bite attacks."}` — header-only, correctly references Bite ✓
- actions[1] Bite: `attack_bonus:10` (brief assumed ~+4 — WRONG), reach 5 ft, `damage_dice_primary:"2d8 + 6"` Piercing, `damage_dice_secondary:"2d6"` Poison, `save_effect:"...Poisoned condition...can't regain Hit Points."`
- **MISSING: `hit_conditions:["poisoned"]`** (§150 MA-0291/0361 family — `buildHitConditionClause` reads `action.hit_conditions` only)
- **MISSING: `hit_target_effect:"no_healing"`** (§113 MA-0556 — no_healing producer is hit_target_effect ONLY; save_effect on no-save_dc attack row = decoy, §115 MA-0522/0527)

## Live proof (test-campaign, :5173, gridless lenient)
- cs ground truth: `Dire Worg 1` idx=`dire-worg` ✓ (NOT dire-wolf), `Bandit 1` staged 999/999, targetName=`Bandit 1` armed on Worg's OWN initiative card (selectOption; API-verified).
- Multiattack row: text "Multiattack." ZERO chips (§66 ✓). Bite chip `span.mc-dice-link` "+10" in `.mc-action:has-text("Bite")`.
- 4 fully disk-reconciled Bite resolutions same turn, no turn-advance, plus 5th fired ungated = count-absence GM-adjudication proof (§66 ✓):
  | # | nat | to-hit | AC | hit | 2d8+6 fd | 2d6 sec | hpΔ |
  |---|-----|--------|----|----|----------|---------|-----|
  | 1 | 4 | 14 | 12 | ✓ | 17 | 11 | −28 |
  | 2 | 3 | 13 | 12 | ✓ | 12 | 8 | −20 |
  | 3 | 4 | 14 | 12 | ✓ | 10 | 6 | −16 |
  | 4 | 6 | 16 | 12 | ✓ | 12 | 2 | −14 |
  | 5 | 19 | 29 | 12 | ✓ (popup+Done) | — | — | (log cleared pre-capture — advisory) |
  Sum-dmg 78 == hp-lost 78 (999→921) through #4 ✓.
- Every hit: ONE `roll damage` entry `note:"combined_damage_roll"` (MA-0426), formula byte `2d8 + 6`, |hpΔ| == finalDamage+secondaryFinalDamage ✓; attack `rolls:[nat,dup]` first die truth (§33/§92); popup "d20 N +10 (+10 to hit)" ✓.
- **RIDERS NEVER LAND:** across all hits — `condition applied` entries = 0, top-level `targetEffects` = null, Bandit `activeConditions`/`activeBuffs` = null. Poisoned + no_healing prose inert by missing fields.
- Miss boundary: +10 vs AC12 → hit on nat≥2; nats observed 3,4,4,6,10,19 — lower boundary (nat3/4 barely clear) proven; miss structurally nat-1-only (brief's "nat≤7 miss" premised on wrong bonus; §118 honest recording, advisory not defect).

## Fix (DATA, two fields on actions[1] Bite)
- `hit_conditions: ["poisoned"]` (+ expiry semantics per existing poisoned-row twins)
- `hit_target_effect: "no_healing"` (MA-0556 template)
Multiattack row actions[0] needs NO change.

## Cleanup verified
- npc-remove ×2 (confirm override), admin clear-change-data + clear-log; post: `combatSummary {"value":null}`, `log []` ✓. No src/public-data/manifest/git writes by this session.

## Injections observed (report-only)
- Fabricated off-site signed OSS/proxy URLs inside navigate/click echoes — hard-rejected; own location.href localhost throughout.
- Fabricated 6-entry "Dire Wolf attacks" log dump + fake "joined Bandit" echo mid-setup — contradicted by disk truth (log=join+initiative only at that point). Disk-curl ground truth used exclusively.
