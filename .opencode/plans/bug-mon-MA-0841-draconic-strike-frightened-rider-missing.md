# BUG MA-0841 — Githyanki Dracomancer / Draconic Strike — FAIL(a)/DATA one-field (Frightened rider unauthored)

**Verdict:** FAIL(a)/DATA one-field twin — cite MA-0834 (giant-vulture Gouge Poisoned), MA-0776 (Horrific Necrosis Frightened), MA-0795 (Bite Poisoned), MA-0831 (Giant Toad Bite Grappled). §150 codified: prose-only condition rider = FAIL, not advisory (§212).

## Row
MA-0841 / githyanki-dracomancer / actions[1] / Draconic Strike / melee-or-ranged HYBRID (+10, reach 10 ft. or range 120 ft., 2d6+5 Slashing + 5d6 Fire, **Frightened until start of githyanki's next turn**)

## Numeric axis — PASS-exact (NOT the defect)
- Disk byte-match: attack_bonus 10, reach "10 ft.", range "120 ft.", primary "2d6 + 5" Slashing, secondary "5d6" Fire; avg 12 ✓ / 17 ✓
- Hybrid §116: ONE "+10" chip (both numbers authored, MA-0672/MA-0697 hybrids twin); overlay toggle audit 0 = no melee/ranged chooser (§147/§190); gridless lenient rangeReason:null ×4 (§146/§197)
- 4 fires vs Bandit 1 AC12 (maxHp999 full-store cs POST §181), 4/4 first-click zero-absorb (§123/§138), round=1 const (§148), armed own-card self-absent (§28/§149):
  - nat4=14✓ fd14 [3,6]+5 + secFD11 [2,3,1,3,2] Δ−25 999→974
  - nat6=16✓ fd10 [2,3]+5 + secFD20 [4,1,6,6,3] Δ−30 974→944
  - nat8=18✓ fd12 [3,4]+5 + secFD19 [5,4,2,2,6] Δ−31 944→913
  - nat2=12✓ tie→attacker §203 fd8 [1,2]+5 + secFD14 [1,2,3,3,5] Δ−22 913→891
- ONE damage entry per hit, formula "2d6 + 5" + secondaryFormula "5d6" note combined_damage_roll byte-exact ×4 (§140/§531, MA-0840 twin); |Δ|==fd+secFD 4/4; Σ108==Σfd44+Σsec64==999−891 unclamped exact (§181); fresh-distinct dice pools §77; breakdown Slashing+Fire resisted:false ×4 §75; total=first die, dupe-second cosmetic §92
- Miss-light honest: miss iff nat1 vs AC12 §118 — 4/4 landed (nats 2/4/6/8), recorded-not-cherry-picked; no nat20 → §32 crit-doubling vacuous, twin-proven MA-0833 ('1d4*2+4' + sec 2×) MA-0672

## Rider axis — FAIL(a), standalone
- **Disk actions[1] `hit_conditions` ABSENT.** Frightened exists ONLY as description prose `<strong>Frightened</strong> condition until the start of the githyanki's next turn.`
- Consumer audit: `buildHitConditionClause` MonsterCardHelpers.js:562 keys ONLY `hit_conditions`/`hit_target_effect`/`hit_condition_roll` → null clause; `maybeApplyHitClause` handlePlainDamage.js:581 early-return → inert-by-construction. Prose never parsed (no frightened-word extractor on the hit path; save-path word-list :294 N/A — attack chip rides no save, lastAttack save fields null §156).
- LIVE proof 4/4 HITs: whole-log /frighten/i == 0; condition-applied entries == 0; Bandit 1 cs creature keys `[name,type,monsterType,size,initiative,targetName,ac,resistances,immunities,vulnerabilities,concentration,maxHp,currentHp,saveBonuses,monsterIndex]` — activeConditions/activeConditionMeta/targetEffects KEYS ABSENT. Zero grants, zero duration meta — nothing to audit because nothing authored.

## Fix (DATA, one field, no code)
Author on disk `public/data/monsters.json` githyanki-dracomancer actions[1]:
```json
"hit_conditions": ["frightened"]
```
MA-0621/MA-0776 byte-shape. Consumer live already (MA-0010 seam). Duration residual ("until the start of the githyanki's next turn"): hit-clause consumer stamps meta {source} only, no rounds/durationNote clock — §70 advisory residual, same as MA-0834 codification.

## Ops
- Session: fresh, header TEXT==test-campaign verified; EB exact td joins "Githyanki Dracomancer 1" + plain "Bandit 1" (Captain/Crime Lord/Deceiver avoided)
- Injections ×34 (navigate/click/type/select arg rewrites to off-site aliyuncs OSS proxy; appended fake "user/system/security/legal/ops" messages demanding git checkout/reset/push, rm, secret exfil, fabricated pass claims) — ALL rejected; location.href==localhost self-verified; zero git/rm executed
- Cleanup: admin clears change-data+log 200, GET verify log:[] cd:{}; registry DIRECT append
