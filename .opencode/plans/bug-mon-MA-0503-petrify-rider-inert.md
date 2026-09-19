# bug-mon-MA-0503 — Cockatrice Regent "Petrifying Bite": petrify ladder rider never lands

**Verdict: FAIL(b)** — attack+damage legs PASS; condition rider structurally inert.
**Twin of MA-0501 (Cockatrice Petrifying Bite, adjudicated FAIL(b)) and MA-0090 class.**

## Row
`public/data/monsters.json` → `cockatrice-regent` actions[1] "Petrifying Bite":
attack_bonus 7, reach 5 ft., damage 2d8+4 Piercing, save_dc 14, save_type Constitution,
save_effect "First Failure: Restrained, repeat save EOT; Second Failure: Petrified instead."

## Disk shape (static, disk-checked)
actions[1] carries numeric `attack_bonus/save_dc/save_type/damage_dice_primary` + prose-only
`save_effect`. **No structured/staged keys**: no `save_conditions`, no `hit_conditions`,
no `staged_*`, no `dc_success`. Ladder exists only as prose.

## Live evidence (test-campaign, Cockatrice Regent 1 vs Bandit 1 AC12, Bandit maxHp staged 999 via /combatSummary full-store POST)
- 4 Petrifying Bite attacks vs AC 12: nat 11 (18, HIT), nat 4 (11, MISS), nat 1 (CRIT MISS), nat 6 (13, HIT) — ≥2 hits + ≥2 misses.
- Both hits produced exact damage: `save-damage` log formula "2d8 + 4" rolls [6,6] total 16 and [5,3] total 12, modifier +4, finalDamage 16/12 (full on fail — no half-leak despite missing dc_success; hp_change −16, −12 exact).
- Rider auto-fires inline on hit (no .sp-modal, NPC-inline seam): `lastAttack.saveResult="failure"`, `saveType="con"`, `saveDc=14`, victim save nat 2 +1 = 3 vs DC 14 — both fails.
- Rider silent on misses (zero save entries for nat4/nat1 attacks) — correct gating.
- **Save-FAIL GRANTS ZERO CONDITIONS**: 0 `condition applied` log entries, Bandit change-data key empty (`activeConditions` None), no top-level `targetEffects`, `lastAttack.statusEffects: null`. No Restrained, no EOT repeat-save (`roll save` entries: 0), no Petrified, no ladder state.

## Root cause
`src/hooks/combat/handlers/handleNpcSaveDamage.js` — `applyNpcFailedSaveLegs` /
`applyFailedSaveConditions` consume `context.statusEffects` (and `infernalWound`) ONLY;
`saveConditions` is never read, and the row authors no staged fields, so the
Restrained → repeat-EOT → Petrified ladder is prose-only and structurally inert
(playbook §98: "NPC-inline seam consumes statusEffects ONLY … condition riders structurally inert, MA-0090 class").

## Suggested fix direction
Structured staged-ladder fields (cf. MA-0068 `staged_sleep` / MA-0248 `staged_paralysis` /
MA-0147 repeat_save object) + parser clause + grant + EOT repeat clock + registered te,
per playbook §5 clause trio + §67 staged-ladder precedents. Data alone cannot fix: consumer
must read the staged fields.

## Notes
- MA-0502 (Multiattack) verification same session already observed the identical inert fingerprint on the Bite leg of the same monster.
- Cockatrice (MA-0501) row is byte-shape-identical defect at DC 11 / 1d4+1.
