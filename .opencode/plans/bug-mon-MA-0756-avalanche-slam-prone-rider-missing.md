# MA-0756 — Galeb Duhr / Avalanche Slam — FAIL(a)/DATA, two fields

**Verdict:** FAIL(a) — core attack exact, but BOTH hit riders prose-only on disk and structurally inert live.

## Disk (public/data/monsters.json, galeb-duhr actions[0]) — quoted
```json
{
  "name": "Avalanche Slam",
  "description": "Melee Attack Roll: +8, reach 5 ft. Hit: 12 (2d6 + 5) Bludgeoning damage. If the target is a Large or smaller creature and the galeb duhr moved 20+ feet straight toward it immediately before the hit, the target takes an extra 7 (2d6) Bludgeoning damage and has the <strong>Prone</strong> condition.",
  "attack_bonus": 8,
  "reach": "5 ft.",
  "damage_dice_primary": "2d6 + 5",
  "damage_type_primary": "Bludgeoning"
}
```
- NO `hit_conditions` authored → prone-on-hit never lands (§150: `buildHitConditionClause` reads `action.hit_conditions` ONLY, MonsterCardHelpers.js:562; consumer live handlePlainDamage.js:507 incl. Large-or-smaller gate) → **MA-0291/0361/0434 prone family, one-field fix `hit_conditions:["prone"]`**
- NO `conditional_damage` authored → ChargeBonusOffer never renders (§65 MA-0007: `buildChargeBonusOffer` gated on `action.conditional_damage`, MonsterCardHelpers.js:525-526; live twin MA-0485 Chimera Bite) → **FAIL(a)/DATA one-field §206 codified, fix `conditional_damage:{dice:"2d6",damage_type:"Bludgeoning",condition:...}`**. The "moved 20+ ft straight toward" movement precondition itself is gridless-unmodellable (§42) — advisory; the ABSENT offer/grant field is the adjudicable axis, NOT §70 advisory.

## Live proof (test-campaign, dev :5173 reused, header verified)
- EB joined exact td-text "Galeb Duhr"+"Bandit" → cs `Galeb Duhr 1`(idx1)/`Bandit 1`(idx0, §128 suffix); Bandit maxHp/currentHp 999 via full-store cs POST (§119/§181).
- Chip: single "+8" `.mc-dice-link` under `.mc-action` strong "Avalanche Slam." (§116 one-chip correct).
- 4 honest rolls vs AC12 (nat≥4 hits): 3 HITS + 1 MISS.
  - nat15+8=23✓ → damage "2d6 + 5" rolls[5,6] fd16, hp Δ−16 (999→983) exact
  - nat10+8=18✓ → rolls[3,6] fd14, Δ−14 (983→969) exact
  - nat16+8=24✓ → rolls[4,2] fd11, Δ−11 (969→958) exact
  - nat2+8=10✗ MISS → popup Done-less, backdrop dismiss, zero damage entry, zero hp_change
- Ledger: all damage entries formula "2d6 + 5" Bludgeoning, `|hpΔ|==finalDamage` exact ×3; fresh dice pools kill §77 cached-replay; attack entries carry targetAc:12, parryAcBonus:0, rangeReason:null (§197 gridless-lenient fingerprint).
- **Axis B live:** zero `condition applied` entries, victim activeConditions null, activeConditionMeta [], top-level targetEffects null, victim change-data keys [] — prone NEVER granted (3/3 hits).
- **Axis C live:** HIT stage-1 popup enumerated pre-Done every roll — buttons = [Done] only (2 checkboxes = cosmetic Advantage/Disadvantage toggles §92); ZERO ChargeBonusOffer / extra-damage chooser at any stage; no `conditional_damage_granted`/`declined` log anywhere.

## Axes summary
- (A) Core attack +8 / 2d6+5 Bludgeoning chip: EXACT — PASS component.
- (B) Prone-on-hit: FAIL(a)/DATA — missing authored `hit_conditions:["prone"]` (consumer live, zero grant).
- (C) Charge extra 2d6 rider: FAIL(a)/DATA §206 — missing authored `conditional_damage`; ChargeBonusOffer popup never appears; movement precheck itself gridless-advisory.

## Fix (DATA, two fields, MA-0010 + MA-0007 byte-shape twins)
1. `hit_conditions:["prone"]` (byte-twins Brown Bear Claw MA-0434 / Barlgura Thrash MA-0361 — Large-or-smaller gate lives in consumer).
2. `conditional_damage:{dice:"2d6",damage_type:"Bludgeoning",condition:"<charge/move clause text>"}` per MA-0007/MA-0485 template (offer rides HIT popup; chooser second-Done applies extra dice).
Stale-pin inversion check §213/§216: grep tests pinning galeb-duhr row inert before fix lands.

## Rig/registry note (Galeb Duhr + Bandit recipe placed)
Duhr STR20 CR6 → +8 sanity ✓; Bandit Medium/AC12/clean bludgeoning §75. Duhr EB join hp 123; victim maxHp999 needed ≥3-hit grind. "+8" chip NOT absorbed-first-click this session (fires first click 3/4, one re-click cycle observed on pop check).
