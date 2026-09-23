# BUG MA-0930 — Grick · Tentacles: size-gated on-hit Grappled NEVER applies — FAIL(a)/DATA

## Verdict
FAIL(a). Damage axis §140-exact both sides (natural hit + natural miss, 2/2 presses), but the
row's "If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12)"
rider is structurally inert: post-hit probe shows ZERO condition grant, ZERO meta, ZERO targetEffects,
ZERO condition-log. Fix = two-field DATA patch (precedent family MA-0909/MA-0877/MA-0812/MA-0801).

## Row (disk, public/data/monsters.json grick actions[2])
```json
{
 "name": "Tentacles",
 "description": "Melee Attack Roll: +4, reach 5 ft. Hit: 7 (1d10 + 2) Slashing damage. If the target is a Medium or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 12) from all four tentacles.",
 "attack_bonus": 4,
 "reach": "5 ft.",
 "damage_dice_primary": "1d10 + 2",
 "damage_type_primary": "Slashing"
}
```
- **hit_conditions ABSENT · escape_dc ABSENT · hit_target_effect ABSENT · hit_choice ABSENT**
- manifest MA-0930 (stableKey grick|actions|2): conditions:["grappled"] = annotation only (§153 — consumer never reads manifest/description); verified:"not verified" (orchestrator-owned, untouched).

## Consumer evidence (live-but-unarmed machinery)
- `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:597-605) reads ONLY
  `action.hit_conditions` / `action.escape_dc` / `action.hit_target_effect` / `parseHitConditionRoll(action)`.
  Disk row carries none of those keys (no hit_condition_roll dice clause either) → clause `null`.
- Armed at MonsterCardModal.jsx:817 (`hitClause: buildHitConditionClause(action)`) → forwarded to
  `applyHitClauseConditions` (src/hooks/combat/handlers/handlePlainDamage.js:513, size gates :503/:584) —
  never invoked because the clause is null. `description` is NEVER read (MA-0763/MA-0909 hardened).
- Precedents: MA-0801/MA-0812 authored rows arm grapple via hit_conditions+escape_dc; MA-0909
  graveyard-revenant Suffocate same fingerprint same session-week.

## LIVE ledger (test-campaign, :5173, 2026-09-23, 2/2 presses, budget ≤3)
- Rig: EB fresh joins (board was empty, log 0): Grick 1 (AC14, Medium) + Bandit 1 (live AC12 read first).
  Full-store cs POST (unwrap inner, POST {combatSummary:inner}, single-wrap GET-verified):
  Bandit 1 currentHp/maxHp 999, Grick 1 targetName='Bandit 1'. cs ships maxHp/currentHp only — no fabricated *HitPoints (§MA-0913#3).
- Tentacles row single "+4" chip (§116); anchor `.mc-overlay .mc-action:has(strong:text-matches("^Tentacles")) .mc-dice-link` (§MA-0928#2).
- | press | d20+4 | vs | result | ledger |
  |---|---|---|---|---|
  | 1 | nat 2 +4 = 6 | AC12 live | ✗ MISS | popup "✗ MISS (6 vs AC 12)"; log.attack.total:2 raw nat, rolls[2,8] 2nd cosmetic, targetAc/effectiveAc:12, hit:false, isAutoMiss:false, isCrit:false; zero damage/hp_change legs; HP 999 held; done-less stage-1, backdrop flush card survived |
  | 2 | nat 9 +4 = 13 | AC12 live | ✓ HIT | popup "✓ HIT (13 vs AC 12)"; log.attack.total:9 raw nat, rolls[9,19] cosmetic §MA-0880, effAc:12 hit:true isCrit:false (crit vacuous §32-if-else); real-pointer Done §MA-0869; damage formula "1d10 + 2" rolls[9] mod2 total 11 fd11 Slashing (avg 5.5+2→7 ticket ✓); hp_change Δ−11 999→988 breakdown Slashing:11; **fd == |hpΔ| §140-clean**; note combined_damage_roll cosmetic §188 |
- Both sides observed NATURALLY — no AC tampering needed.
- Console: 0 errors.

## GRAPPLE PROBE (post-hit, machine truth)
- change-data `Bandit 1`.activeConditions: ABSENT (null baseline)
- change-data `Bandit 1`.activeConditionMeta: ABSENT
- change-data top-level `targetEffects`: ABSENT
- whole-log grapple/condition grep: ZERO entries
⇒ RAW requires Grappled (escape DC 12) on every hit vs Medium-or-smaller (Bandit Medium ✓);
app grants nothing = FAIL(a) (§10 unenforced rider), NOT §70 advisory — the transport EXISTS
(hit_conditions channel + escape_dc field + size gates) and is simply unarmed.

## Fix (DATA, two fields — MA-0909/MA-0877 byte-shape)
Add to grick actions[2]:
```json
"hit_conditions": ["grappled"],
"escape_dc": 12
```
- Size gate: consumer gates Large-or-smaller (§MA-0909 notes isLargeOrSmallerTarget parses); RAW here is
  Medium-or-smaller — adjudicate gate fidelity at fix time (MA-0812 Medium-gate precedent).
- Residual (§70): sustained grapple state-machine (grabber-bound movement/escape action flow) remains
  zero-consumer advisory; escape_dc rides the grant meta.
- Stale-pin sweep §216/§219: any test pinning grick Tentacles `hit_conditions` undefined must invert same pass.

## Cleanup verified
admin-clear cd+log direct-fetch 200/200; quiet-recheck 15s cd `{}` log `[]`; single tab; dev :5173+:80 up;
href self-localhost every evaluate; manifest NEVER touched (re-read byte-match post-session); registry ADDITIVE only.
