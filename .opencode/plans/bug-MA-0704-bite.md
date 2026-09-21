# Bug MA-0704 — Ettercap "Bite": Poisoned-on-hit rider never applied (unauthored hit_conditions)

## Verdict: FAIL(a) / DATA one-field

## Canonical (public/data/monsters.json, Ettercap actions[1] Bite, python-dump verified)
- attack_bonus 4, reach "5 ft.", damage_dice_primary "1d6 + 2" Piercing, damage_dice_secondary "1d4" Poison.
- Prose: "Hit: 5 (1d6 + 2) Piercing plus 2 (1d4) Poison, and the target has the Poisoned condition until the start of the ettercap's next turn."
- Poisoned clause lives ONLY in `save_effect` prose field. **NO `hit_conditions` field authored.**

## Expected
- On a Bite hit, target gains Poisoned condition until start of the ettercap's next turn.

## Actual (live test-campaign, 2026-09-21)
- Bite ×2 hits (nat8+4=12✓ AC12 boundary tie; nat20 CRIT) + 1 honest miss (nat7+4=11✗):
  - Damage twin-shape EXACT: ONE `roll damage` per hit, note "combined_damage_roll", formula "1d6 + 2" + secondaryFormula "1d4" secondaryDamageType "Poison"; hpΔ exact unclamped (10=6+4; crit 12=6+6, dice-doubled flat-mod-not-doubled).
  - ZERO `condition` log entries whole-session; Bandit 1 change-data keys empty: activeConditions null, activeConditionMeta null; top-level targetEffects null. Poisoned NEVER lands.

## Grep evidence (own session)
- Consumer LIVE and transport EXISTS: `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:560) reads `action.hit_conditions` ONLY (:561); forwarded as hitClause (MonsterCardModal.jsx:747); consumed by `applyHitClauseConditions` (src/hooks/combat/handlers/handlePlainDamage.js:513, applied :600) → activeConditions + meta + `condition applied` log. Byte-shape proven live on twins: MA-0010/MA-0621 (dracolich Sickening Ray fixed via `hit_conditions:["poisoned"]`), MA-0691-family (§150).
- `save_effect` is NEVER consulted on the attack path: rg "save_effect" handlePlainDamage.js = 0 matches (exit 1); attack-roll options explicitly null saveDc/saveType/dcSuccess (MonsterCardModal.jsx:841-843, MA-0551) — attack chip rides no save, so the save_effect prose is a decoy field for this row (§115/§150 fingerprint).

## Twins
- MA-0703 (same chip, same day, multiattack pass): Poisoned rider status-noted deep to this ticket — same grep + live zero-condition proof.
- MA-0691 (Empyrean Sacred Weapon): same fingerprint converted FAIL(a)/DATA one-field (`hit_conditions:["stunned"]`).

## Fix (DATA, one field)
- Add `"hit_conditions": ["poisoned"]` to Ettercap Bite row. Transport + consumer + condition registration (poisoned) all live — no code change required.
- Secondary design-note (§70-class duration management): "until start of ettercap's next turn" auto-expiry rides existing `addExpiration(expireOnCreatureName=anchor)` seam (§38); adjudication for auto-expiry fidelity = separate duration-management note, not this row's gate.
