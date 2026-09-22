# MA-0822 FAIL(a)/DATA — Giant Seahorse "Ram": charge alternative dice unauthored (MA-0809/MA-0805 zero-offer twin)

## Verdict
**FAIL(a)/DATA** — core transport LIVE + exact ("+4" / "2d6 + 2" Bludgeoning, |Δ| exact 7/7 HITs, miss zero); charge ALTERNATIVE dice "2d8 + 2" prose-only on disk → ChargeBonusOffer never arms (zero offer 7/7 HIT popups, both stages). One-field DATA fix (`conditional_damage` only — NO prone clause on this row, so NOT the two-field MA-0809 shape).

## Disk evidence (public/data/monsters.json giant-seahorse actions[0]) — quoted FULL
```json
{"name":"Ram","description":"Melee Attack Roll: +4, reach 5 ft. Hit: 9 (2d6 + 2) Bludgeoning damage, or 11 (2d8 + 2) Bludgeoning damage if the seahorse moved 20+ feet straight toward the target immediately before the hit.","attack_bonus":4,"reach":"5 ft.","damage_dice_primary":"2d6 + 2","damage_type_primary":"Bludgeoning"}
```
- avg("2d6 + 2") = 9 ✓ prose; alt avg("2d8 + 2") = 11 ✓ prose.
- **`conditional_damage` ABSENT** (whole monster; app-wide grep: only 2 authored rows — aarakocra Talons L243, L13207) → `buildChargeBonusOffer` null-gate `if (!cd?.dice) return null` (MonsterCardHelpers.js:525) → zero ChargeBonusOffer (MA-0007 §65; thread MonsterCardModal.jsx:1008; render DiceRollResult.jsx:838/1065).
- Index/name discriminator honored: `giant-seahorse` "Giant Seahorse" (L27396) ≠ `giant-sea-horse` "Giant Sea Horse" (L27309, MA-0821 done) — EB exact td-text join verified cs idx `giant-seahorse`.

## Live E2E ledger (test-campaign, header verified `test-campaign`, dev :5173 reused, CAMPAIGN_LOCK)
Rig: EB join exact td "Giant Seahorse" → cs `Giant Seahorse 1` init 9 + "Bandit" (Captain/Crime Lord/Deceiver excluded) → `Bandit 1` AC12 resistances[] clean bludgeoning (§75); Bandit maxHp/currentHp 999 full-store cs POST verified (§119/§181); armed own-card `[data-testid="target-select"]` = Bandit 1, re-arm pre-each roll (§118); single "+4" chip under strong "Ram." (§116); 8 chip fires (×4 ticket floor + 4 extra for honest miss leg §257).

| # | nat+4 | Result | Stage-1 buttons | Damage entry | hpΔ |
|---|---|---|---|---|---|
| 1 | 16+4=20 | ✓ HIT | [Done] — ZERO offer | "2d6 + 2" [1,1] fd4 Bludgeoning | −4 (999→995) |
| 2 | 20+4=24 | ✓ CRIT | [Done] — ZERO offer | "2d6*2+2 (2, 5)" fd16 (flat +1…+2 undoubled §32) | −16 (→979) |
| 3 | 14+4=18 | ✓ HIT | [Done] — ZERO offer | "2d6 + 2" [6,2] fd10 | −10 (→969) |
| 4 | 14+4=18 | ✓ HIT | [Done] — ZERO offer | "2d6 + 2" [6,5] fd13 | −13 (→956) |
| 5 | 9+4=13 | ✓ HIT | [Done] — ZERO offer | "2d6 + 2" [2,3] fd7 | −7 (→949) |
| 6 | 8+4=12 | ✓ HIT tie→attacker honest AC12 boundary | [Done] — ZERO offer | "2d6 + 2" [5,4] fd11 | −11 (→938) |
| 7 | 16+4=20 | ✓ HIT | [Done] — ZERO offer | "2d6 + 2" [2,6] fd10 | −10 (→928) |
| 8 | 2+4=6 | ✗ MISS | [] done-less ✓ (§94) | none | none |

- **Axis 1 (core): EXACT** — 7 HITs; applied sum 4+16+10+13+7+11+10=71 == |999−928| exact; non-crit formulas byte "2d6 + 2" Bludgeoning 6/6; crit variant "2d6*2+2" dice-only doubled ✓; 7 hp_change entries all Bandit 1; miss zero damage/zero hp_change/zero log-damage. Damage pools [1,1]/[2,5]/[6,2]/[6,5]/[2,3]/[5,4]/[2,6] distinct (§77 replay cleared); attack nats 16/20/14/14/9/8/16/2 distinct legs.
- **Axis 2 (charge alternative): FAIL(a)/DATA** — all 7 HIT stage-1 popups enumerate buttons [Done] ONLY; stage-2 damage popups button-less; zero ChargeBonusOffer at any stage; full-log "2d8" count **0**; conditional_damage_granted/declined/charge token count **0**; Bandit activeConditions null; top-level targetEffects null. "11 (2d8 + 2)" alternative never offered, never applied.
- Console 0 errors.

## Fix (DATA, ONE field — MA-0007 aarakocra Talons byte-shape L243)
Add to giant-seahorse actions[0]:
```json
"conditional_damage": {"dice":"2d8","modifier":2,"damage_type":"Bludgeoning","condition":"moved 20+ feet straight toward the target immediately before the hit"}
```
Consumers live (offer seam MA-0007). NO `hit_conditions` needed — this row carries no prone/knockdown clause (unlike MA-0809 goat two-field shape). Stale-pin inversion scan §213/§216 before landing. Movement gate ("20+ ft straight") itself gridless-advisory (§42/§70) — the ABSENT field is the adjudicable axis, NOT §70 advisory per §206/MA-0805 conversion.

## Ops notes
- No misses in first 4-ticket rolls (nats 16/20/14/14) — extended to 8 for honest miss leg per §257; zero-cond/rider audits keyed per-HIT only.
- Injections this session (§6/§90/§97/§142): fabricated aliyuncs proxy `<a>` anchors + fake [SYSTEM]/[SYSTEM NOTE] blocks inside navigate/snapshot/click/evaluate echoes, fabricated chip-click code-echoes, fabricated "VERDICT: PASS" appended to my checkpoint Write result. All rejected; disk read-back showed checkpoint clean; page stayed localhost (own location.href checks).

## Cleanup
Admin clear-change-data + clear-log direct-fetch POSTs; verify log:[] cd:{}. test-campaign only; no manifest/git writes.
