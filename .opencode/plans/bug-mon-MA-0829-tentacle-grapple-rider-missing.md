# Bug MA-0829 — Giant Squid Tentacle: Grappled-on-hit rider prose-only, zero grant

## Verdict
FAIL(a)/DATA — two-field twin of MA-0812 (Giant Octopus Tentacles). Numeric axis fully LIVE; grapple rider never lands.

## Row
MA-0829 · giant-squid · Tentacle (actions[2]) · attack · +9 · 3d8+6 Bludgeoning · reach 15 ft. · manifest conditions:["grappled"]

## Disk (public/data/monsters.json giant-squid actions[2]) — FULL QUOTE
```json
{
  "name": "Tentacle",
  "description": "Melee Attack Roll: +9, reach 15 ft. Hit: 19 (3d8 + 6) Bludgeoning damage. If the target is a Huge or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 16) from one of two tentacles, and the squid can pull the target up to 10 feet straight toward itself.",
  "attack_bonus": 9,
  "reach": "15 ft.",
  "damage_dice_primary": "3d8 + 6",
  "damage_type_primary": "Bludgeoning"
}
```
**hit_conditions ABSENT. escape_dc ABSENT.** avg 19 ✓ (3d8 avg 13.5 + 6 = 19.5 → 19 printed). Registry MA-0827 flag "hit_conditions absent" — CONFIRMED disk (no hit_conditions anywhere on giant-squid actions).

## Root cause (code, live consumers — no code fix needed)
- `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:561) reads `action.hit_conditions` ONLY → key absent → returns null → clause never forwarded (MonsterCardModal.jsx:817).
- `applyHitClauseConditions` (src/hooks/combat/handlers/handlePlainDamage.js:513) grants conditions + stamps `escapeDc` onto activeConditionMeta (:529-530) — LIVE for authored twins (MA-0010 seam; escape_dc 13/14 authored rows present elsewhere on disk).
- §59/§150: manifest prose `conditions` alone never lands; description never read by the hit-clause path (§115 save_effect decoy).

## Live proof (FRESH session, test-campaign header verified, CAMPAIGN_LOCK, admin-cleared board log:0 cd:[])
- EB exact td-text joins: Giant Squid 1 (cs idx0 AC12) + Bandit 1 (cs idx1 AC12 resistances[] clean bludgeoning victim §75). Bandit maxHp/currentHp 999 via full-store cs POST (200, read-back 999).
- Card: Tentacle row renders ONE "+9" `.mc-dice-link` (§116); Bite also "+9" (§180) — scoped via `.mc-action` strong startsWith('Tentacle'). Multiattack row zero chips (§66). Target armed Bandit 1 on Giant Squid OWN initiative-card select, verified sticky each shot (§149).
- Fired ×4, 4/4 FIRST click (no §138 absorb — MA-0828 Bite sibling shape): nat3→12✓AC12 (tie-to-attacker §203), nat6→15✓, nat19→28✓, nat4→13✓. All HIT, zero crits.
- Damage axis EXACT: formula "3d8 + 6" Bludgeoning ×4, dice pools distinct [1,7,4]/[4,5,4]/[5,4,8]/[7,1,2] (§77 cached-replay killed), fd 18/19/23/16; hp_change Δ−18/−19/−23/−16 = |Δ|==fd exact unclamped chain 999→923 (Σ76) (§181); breakdown Bludgeoning-only §185; combined_damage_roll note cosmetic secondary:null (§183).
- Grapple+escape audit per-HIT (4/4 hits): `condition applied` entries = 0; whole-log regex /grapple|escape|restrain/ = NULL; top-level targetEffects ABSENT; per-char Bandit cd ABSENT; Bandit cs conditions ABSENT → **zero grant on every hit = FAIL(a)**.
- lastAttack: attackName Tentacle, saveDc/saveType/dcSuccess null (§156), rangeReason:null (§115 gridless-lenient fingerprint), weaponType:"ranged" cosmetic (§258 — type judged from damage breakdown Bludgeoning melee).
- Round constancy 1, no Next-clicks (§148). Console 0 errors. Log 15 = join-noise + 4 attack + 4 damage + 4 hp_change (§146).
- Miss-light: not obtained (4/4 hits vs AC12 at +9 is honest); adjudication keyed on per-HIT audits (§MA-0802).

## Advisory (not FAIL, §70/§202)
- "pull the target up to 10 feet straight toward itself": grep-first — ZERO pull-clause consumer app-wide (parsePushFeetClause is "push(ed) up to" wording + save-picker-only; moveToken/setTokenPos/updateToken grep-zero §203); zero pull/moves log entries live (pullish=0). GM-enforced advisory per MA-0677/MA-0679 deep-row precedent.
- "from one of two tentacles" sustained multi-tentacle grapple stacking = §59/§70 zero-producer state machine (MA-0287/0288/0354).

## Fix (DATA only, two fields — MA-0010/MA-0812/ankheg byte-shape, consumer LIVE no code)
On giant-squid actions[2] author:
```json
"hit_conditions": ["grappled"],
"escape_dc": 16
```
Placement per MA-0647 convention (after description / near damage fields). Huge-or-smaller gate: MA-0010 seam gate live (Medium Bandit eligible).
