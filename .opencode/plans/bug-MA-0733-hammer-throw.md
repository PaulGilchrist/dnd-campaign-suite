# Bug MA-0733 — Fire Giant "Hammer Throw": hit-clause Disadvantage rider never applied (unauthored hit_target_effect)

**Verdict: FAIL(a) / DATA one-field** (rider axis). Core attack+damage ledger PASS-exact (below).

## Canonical (disk `public/data/monsters.json` fire-giant actions[2], python-dump byte-verified)
"Ranged Attack Roll: +11, range 60/240 ft. Hit: 23 (3d10 + 7) Bludgeoning damage plus 4 (1d8) Fire damage, and the target is pushed up to 15 feet straight away from the giant and has Disadvantage on the next attack roll it makes before the end of its next turn."

Disk fields: `attack_bonus:11`, `range:"60/240 ft."`, `damage_dice_primary:"3d10 + 7"` Bludgeoning, `damage_dice_secondary:"1d8"` Fire, `save_effect` decoy (repeats both rider clauses). **NO `hit_conditions`, NO `hit_target_effect`.**

## Rider tail NOT prone — §150/MA-0691/0704 prone-framing N/A
Prose never says "falls prone"; zero prone claims. Rider = (1) push-15ft movement clause + (2) one-shot next-attack Disadvantage.

### Rider axis 2 (FAIL(a), DATA one-field — MA-0542/MA-0556/MA-0704 family)
Transport EXISTS and is LIVE, byte-twin precedent authored on the SAME rider wording:
- `buildHitConditionClause` (MonsterCardHelpers.js:560-562) passes ANY `action.hit_target_effect` string through onto the hit clause.
- Consumer live: `applyHitClauseTargetEffect` (handlePlainDamage.js:624, fired on hit :613) → `registerTargetEffect` + `addExpiration` anchor clock + `condition` applied log; generic over `getEffectDefinition`.
- Registered te: `disadvantage_next_attack` (targetEffectDefinitions.js:31, one-shot consumed-on-use — exact RAW fit for "the next attack roll it makes before the end of its next turn"); `disadvantage_attack_rolls` (:122, MA-0542 until-end-of-source-next-turn variant).
- Byte-twin LIVE: Cyclops Oracle Flash of Light (monsters.json:15630) `hit_target_effect:"disadvantage_attack_rolls"` authored on identical "Hit: … and the target has Disadvantage on attack rolls…" rider — MA-0542 fix shape; §185 codified: "producer=hit_target_effect ONLY … fix one field".
Fire Giant row unauthored ⇒ rider inert by construction. Live proof (×3 hits): Bandit 1 `targetEffects` null top-level, `activeConditions`/`activeConditionMeta` null, whole-log grep zero condition/te entries, `lastAttack.saveDc/saveType/dcSuccess` null ×3 (attack chip rides no save — MA-0551; save_effect never consulted, rg save_effect handlePlainDamage.js = 0 hits, MA-0704 grep re-confirmed).
Fix = one field: `"hit_target_effect": "disadvantage_next_attack"` (or MA-0542 byte-shape `disadvantage_attack_rolls` + accepted anchor-expiry residual; expiry-vs-RAW-end-of-turn = §70 residual either way).

### Rider axis 1 (ADVISORY, not FAIL — §101/§202/§203 codified)
"pushed up to 15 feet straight away" = movement clause: `parsePushFeetClause` is save-picker-only (§101 MA-0507); moveToken/setTokenPos grep-zero (§203 MA-0679: "no registered consumer SHOULD fire → advisory not FAIL(a)"). Live: zero push log ×3, token N/A gridless. MA-0731 orchestrator registry note pre-framed this row's push as advisory, "deep row MA-0733+ note only" — consistent.

## Range band (§146 dual-value, honest record)
`range:"60/240 ft."` authored; `resolveAttackRange` (MonsterCardModal.jsx:923) → `rangeToFeet` anchored `^N ft$` regex (rangeValidation.js:34) NO match on slash-band → null; band-split grep-zero. Live fingerprint ×3 attacks: `attackRange:null` + `rangeReason:null` = gridless-lenient consulted-and-passes (§115/§197). RAW long-range Disadvantage beyond 60 ft unmodeled = §70-class advisory; no grid tokens this session.

## Core ledger (PASS-grade, exact)
Bandit 1 AC12 resistances[] clean (§75); dual maxHp999 full-store cs POST (§119/§181); own-card selectOption armed Bandit 1 cs.targetName GET-verified (§28/§149 self-exclude). ONE +11 chip (§116); Multiattack header zero-affordance (§66); strong startsWith anchor (§180).
- ×3 attack: nat 13/12/2 (raw §33, dupe-second-die §92), bonus 11, vs targetAc 12, hit:true ×3; miss structurally unreachable nat1-floor 12 tie=attacker (§118/§203).
- ×3 damage: ONE entry/hit formula `3d10 + 7` Bludgeoning + secondaryFormula `1d8` Fire BYTE-EXACT, note combined_damage_roll (§140): [1,7,1]+7=16 + 6=22 (999→977); [3,9,1]+7=20 + 2=22 (→955); [4,6,2]+7=19 + 5=24 (→931); finalDamage+secondaryFinalDamage==|hp_change| EXACT, unclamped; breakdown resisted:false ×6.
- Fresh dice §77: 6 pools distinct, zero replay; stage-1 Done + stage-2 click-dismiss after Done preserved damage every roll (§29/§137-inverse); zero absorbed clicks.
- CRIT §32: nat20 0/3 (nats 13,12,2; P(no-crit)≈86%); dice-doubled/flat-undoubled crit formula twin-proven TODAY same chip under MA-0731 ("3d10*2+7 (2,10, 6)"=43 + secondaryTotal ×2).
- Console §158: 0 errors (12 warnings pre-existing).

## Cleanup
Card closed; admin clear-change-data + clear-log API 200/200 (§121); +15s/+12s GET quiet log[] cd{} cs-null; no resurrect. test-campaign header-verified all session; :5173 only; no manifest/git writes.
