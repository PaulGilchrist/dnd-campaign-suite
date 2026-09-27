# BUG MA-1378 — Rakshasa "Cursed Touch": cursed-on-hit rider inert (unauthored structured key)

**Verdict:** FAIL(b)/DATA — core attack axis LIVE and exact; the "it is cursed" rider is prose-only, zero structured producer arms it. §MA-1344/§MA-1357/§MA-1368 ungated-condition-rider family.

## Row
`public/data/monsters.json` rakshasa actions[1] "Cursed Touch" (stableKey rakshasa|actions|1):
attack_bonus:10, reach "5 ft.", damage_dice_primary "2d6 + 5" Slashing, damage_dice_secondary "3d12" Necrotic, save_dc:0/save_type:"" decoy.
Description carries "If the target is a creature, it is cursed. While cursed, the target gains no benefit from finishing a Short or Long Rest."
Disk riders ABSENT: `hit_conditions`, `hit_target_effect`, `hit_condition_roll`, `hit_choice`, `escape_dc`, `save_margin`. Manifest `conditions:["cursed"]` is prose-derived, not disk-true (§196/§758).

## Live evidence (test-campaign, 2026-09-26, dev :5173, header verified, console 0 errors)
Board: EB join Rakshasa 1 (idx0 AC17 HP221 disk-exact) + Initiative +NPC Bandit AC12 currentHp TRUSTED-fill 999; own-card target-select val=Bandit, cs armed=Bandit; row anchor `strong.startsWith('Cursed Touch')` (spurious +10 Multiattack header chip §440 never pressed).
- 34 presses → 33 attack entries (31 HIT / 2 MISS), damage:attack 1:1, press-to-log 1:1 (native el.click route 0 absorb; first real-press ghost NOPOPUP reads were flush-lag §821, log canonical).
- To-hit flips honest: AC12 nats 3,6,7,8,9,10,12,13,14,15,17,18,19 all hit; AC-rig 19 (§887/§491 preserved targetName in same full cs POST) produced real misses nat1→11✗ and nat4→14✗ with ZERO damage/hp_change entries; restored AC12.
- Every non-crit hit: ONE damage entry formula "2d6 + 5" Slashing + secondaryFormula "3d12" Necrotic, byte-exact vs disk; breakdown [{Slashing,resisted:false},{Necrotic,resisted:false}]; rolls[d]+5==fd, st==sfd.
- CRIT nat20→30: popup "CRITICAL HIT! — DAMAGE DICE DOUBLED"; log formula "2d6*2+5 (6, 2)" fd21=(6+2)*2+5 flat +5 undoubled §32/§473; secondary st=sfd=30=2x(single 3d12 sum 15) doubled §533; Δ84→33 exact.
- Ledger: Σfd 348 + Σsfd 618 = 966 == chain 999→33 unclamped exact.
- RIDER ZERO (exact record): after 31 hits, victim change-data store key `Bandit` KEY ABSENT (§443 strictest proof) — no activeConditions, no activeConditionMeta, no badge; TOP-level `targetEffects` KEY ABSENT; zero `condition applied` entries whole-log (condEntries 0); no "cursed" state anywhere. No-rest meta ("gains no benefit from finishing a Short or Long Rest") present in NO data structure anywhere.
- Save axis: zero save affordance honest — `Number(save_dc)>0` gate MA-1071 renders no DC chip; pendingSavePrompts KEY ABSENT; saveEntries 0; lastAttack.saveDc/saveType null on attack chip (§117 decoy honest).

## Grep census (machine proof)
- `targetEffectDefinitions.js` "curs" grep rc=1 — NO cursed te registered (te channel cannot express it today).
- monsters.json: no row authors hit_conditions/hit_target_effect with curse (rc=1) — ZERO armed hit-lane curse twins app-wide. Save-lane prose twins exist (arch-hag Crackling Wave MA-0303, slaad eggs, sphinx riddle, werebears) — different lane, never reachable from an attack chip (§153/§449: description NEVER read on hit path).
- `buildHitConditionClause` MonsterCardHelpers.js:673-686 reads ONLY hit_conditions/hit_target_effect/hit_condition_roll (+hit_choice suppression) → clause null for this row → `maybeApplyHitClause` handlePlainDamage.js:613 early-return.
- `applyHitClauseConditions` handlePlainDamage.js:543: NO word whitelist — writes activeConditions verbatim → a DATA-only `hit_conditions:["cursed"]` fix GRANTS "Cursed" (tracked condition: conditionUtils.js:6 picker list, MonsterCardHelpers.js:52 CONDITIONS, monsterIrvUtils.js:7, effectDescriptions 'Cursed'; readers removeCurseHandler/greaterRestorationHandler already consume it).
- restRules*.js "curs" grep rc=1 — NO rest-block consumer ("no benefit from Short/Long Rest") app-wide = §70/§87 second axis (a recurring/meta te would need an explicit consumer; nearest twin: hexblade-pattern producers absent).

## Fix (data-first, one-field primary axis)
1. `hit_conditions: ["cursed"]` on rakshasa actions[1] (MA-0621/MA-1368 byte-shape, place after damage_type_secondary). Grants "Cursed" activeCondition + meta {source:attacker} + badge; duration "until dispelled" = GM-enforced §70 residual. App-registry "Cursed" semantics (disadv attack/ability, effectDescriptions) ≠ rakshasa RAW rest-block — honest partial coverage.
2. Rest-block clause: §70-class unbuilt (no te, no consumer, restRules grep-zero) — advisory residual, cite MA-1196 (mummy prose-curse) + §6 prose-clause family; do NOT rebuild without ticket (§70).
Do NOT touch MA-1377 multiattack row; spurious header chip §440 stays cosmetic.
