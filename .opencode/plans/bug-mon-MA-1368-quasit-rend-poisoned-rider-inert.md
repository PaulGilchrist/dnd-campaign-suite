# bug-mon-MA-1368 — Quasit Rend: Poisoned-on-hit rider inert-unauthored (FAIL(b)/DATA)

## Row
MA-1368 / quasit|actions|0 / Quasit "Rend" (+5, reach 5 ft., 1d4 + 3 Slashing).

## Expected (disk description, byte)
"Melee Attack Roll: +5, reach 5 ft. Hit: 5 (1d4 + 3) Slashing damage, and the target has the <strong>Poisoned</strong> condition until the start of the quasit's next turn."

## Actual (live, 15 rolls, 7 hits)
Poisoned rider NEVER lands: zero `condition applied` log entries (condEntries=0 across 15-entry session), victim `Bandit 1` change-data `activeConditions` absent (poisoned:false), `activeConditionMeta` absent, no top-level condition/poison keys. Rider applies on zero of 7 hits; it cannot fire on misses either (no affordance exists at all) — pure inert-unauthored, not misapplied.

## Root cause (DATA, code live-unarmed)
Row ships ONLY [name, description, attack_bonus, save_dc, save_type, save_effect, range, reach, recharge, damage_dice_primary, damage_type_primary]. All rider keys grep-zero on the row: `hit_conditions`, `hit_target_effect`, `hit_condition_roll`, `escape_dc`, `save_margin`, `hit_choice`, `conditional_damage`, `target_prerequisite`.
- `buildHitConditionClause` — src/components/encounter/MonsterCardHelpers.js:673-686 — reads ONLY `action.hit_conditions` / `hit_target_effect` / `parseHitConditionRoll(hit_condition_roll)` / `escape_dc`; description NEVER read → returns null at :678.
- `maybeApplyHitClause` — src/hooks/combat/handlers/handlePlainDamage.js:611-613 — early-return on null clause.
- `applyHitClauseConditions` — :543 — consumer live (grants condition + meta {dc, ability, source} + condition-applied log); unarmed here.

Framing: §MA-1344/§MA-1357 family + §774 precedent — ungated discrete-condition rider unauthored = FAIL(b)/DATA (not §70 advisory; no movement gate involved, fix fully reachable). Manifest `conditions:["poisoned"]` is prose-derived, not disk-true (§153/§758/§495: raw `action.conditions` has ZERO attack-path consumers).

## Fix shape (one-field, zero code)
`"hit_conditions": ["poisoned"]` on quasit actions[0] (MA-0621 dracolich Sickening-Ray byte-shape). Duration "until the start of the quasit's next turn" is handled by the consumer's meta/expiration clock (§MA-1344 note: two-field shape only when escape_dc is needed; poisoned needs none). Live twin proof: MA-0621 fixed PASS via exactly this one field.

## Evidence ledger (test-campaign, 2026-09-26, dev :5173)
- Rig: Quasit 1 (idx quasit, cs1) + Bandit 1 (idx bandit, cs0, AC12 clean slashing, maxHp/currentHp 999 full-cs POST); own-card target-select armed Bandit 1 (self-exclusion confirms own card §449).
- 15 chip clicks (`Rend > +5` single chip §116), 15 attack entries 1:1, zero absorb.
- To-hit exact: every entry total=nat, bonus:+5, effectiveAc:12; HIT iff nat+5≥12 (nat8/8/17/16/19/11/19 hit; nat4/5/4/3/2/4/4/3 miss). Boundary nat7/nat6 (total 12/11) unrolled — self-consistent observed split (§771 honest note).
- Damage: 7 entries == 7 hits 1:1; formula "1d4 + 3" byte-exact all, type Slashing all; rolls[d]+3==total==finalDamage (5,4,4,4,5,4,5); Σfd 31 == Σ|hpΔ| 31; chain 999→968 unclamped.
- Crit: nat20 unrolled in 15 (~5%/roll) — dice-only doubling seam same precedent MA-0433/MA-1331.
- Rider axis: per-hit victim change-data audit — activeConditions/activeConditionMeta ABSENT after every one of the 7 hits; zero condition-applied log; zero-delta confirmed.
- Save decoy honest (§117): save_dc:0/save_type:"" → zero save affordance; saveEntries=0, lastAttack.saveDc/saveType null, pendingSavePrompts absent, all session.
- Console: 0 errors.

## Scope/cleanup
test-campaign only; admin-clear change-data + log after, verified empty; registry "Quasit" appended.
