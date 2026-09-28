# BUG MA-1448 — Sea Hag "Death Glare": HP≤20 instakill clause inert (no `hp_threshold_kill` field) + dc_success half-default leak

## Overview
Sea Hag | actions[1] | Death Glare (`sea-hag|actions|1`) — save row DC 11 Wisdom, recharge 5-6, 3d8 Psychic. Live E2E 2026-09-27 in test-campaign (EB join Sea Hag 1 idx0 / Bandit 1 idx1, gridless). The save-shell, DC, damage and recharge economy are all exact, but the row's PRIMARY promised effect for the ≤20 HP victim — "drops to 0 Hit Points" — never happens: the engine's live HP-threshold-kill seam arms ONLY on a structured numeric `hp_threshold_kill` field, which this row does not author. Secondary axis: `dc_success` unauthored → engine default `half` leaks half damage on a save that RAW grants nothing on success.

## Expected (quoting description verbatim)
"Wisdom Saving Throw: DC 11, one Frightened creature the hag can see within 30 feet. Failure: If the target has 20 Hit Points or fewer, it drops to 0 Hit Points. Otherwise, the target takes 13 (3d8) Psychic damage."

- Failed save vs victim at ≤20 HP → target drops to 0 HP, no damage rolled.
- Failed save vs victim >20 HP → full 3d8 Psychic.
- Successful save → no effect, NO damage (RAW; success clause silent).

## Actual
- Cast #1, Bandit 1 at 11 HP (≤20): SAVE FAILURE (d20 3 + 0 vs DC 11) → **took 3d8 [2,1,1]=4 Psychic, HP 11 → 7, survived**. ZERO `hp_threshold_kill` log entry. Instakill clause inert.
- Cast #2, HP 999 (>20): FAILURE (nat10 +0) → 3d8 [2,4,7]=13, Δ−13, HP 999→986 — full-damage leg EXACT.
- Cast #3, HP 986: FAILURE (nat9 +0) → 3d8 [3,8,7]=18, Δ−18, HP 986→968 — full-damage leg EXACT.
- Recharge economy fully live: spend log at picker-open ("unavailable until a d6 5+"), same-round refire refused (`death_glare_refused`, popup "Not Recharged … Zero spend", chip class `mc-dice-link-spell-spent`), owner-turn-start recovery d6s recorded: 2, 2, 5, 2, 2, 3, 1, 6.
- Save success face not rolled within probe budget (nats 3/10/9 vs DC 11, bonus +0 inline §96; 8 recharge cycles walked). Half-leak adjudicated CODE-PROVEN: row has no `dc_success`, and `MonsterCardModal.jsx:1032` stamps `dcSuccess: action?.dc_success ?? 'half'` — MV-20 half-default leak; RAW here success pays NOTHING.

## Steps to reproduce
1. test-campaign → EB join "Sea Hag" + "Bandit" (Bandit maxHp 11 ≤20).
2. Bandit card Add→Frightened→Apply; arm Bandit 1 on Sea Hag own-card `[data-testid="target-select"]`.
3. Sea Hag card → Death Glare row → `DC 11 Wisdom` chip → save fails at low d20.
4. Observe: 3d8 damage applied, Bandit survives at HP>0; no `hp_threshold_kill` log entry anywhere.
5. Same-round chip re-click → `death_glare_refused` refusal (correct, recharge enforced).

## Likely Location
LAYER: **DATA field** (not code). The consumer seam is live and unit-tested — `src/hooks/combat/saveProcessing.js:1229-1285` (`hp_threshold_kill` log, drops to 0, no damage rolled; pinned by `saveProcessing.hp-threshold-kill.test.js`) — armed solely via `parseHpThresholdKillClause` (`src/components/encounter/MonsterCardHelpers.js:771`) which reads `Number(action?.hp_threshold_kill)` only; prose is never parsed (§37 clause-trio convention).
- Fix A (primary, one field): add `"hp_threshold_kill": 20` to sea-hag actions[1] (MA-0352 Banshee Deathly Wail byte-shape, threshold 25 twin).
- Fix B (secondary, one field): add `"dc_success": "none"` to the same row (MA-1334 Telekinetic Thrust / MA-0481 twin half-default fix; default `half` lives in `MonsterCardModal.jsx:1032` `?? 'half'`).
- Recharge (`monsterRecharge`), save DC/type, and damage transport need no changes.

## Notes
- "+0" cosmetic attack chip renders on this save row (attack_bonus 0); not pressed — save-row tested per ticket scope.
- Prose target-prerequisite "one Frightened creature" is ungated (no structured `target_prerequisite`, §209 family) — scenario arm only, noted.
- Frightened auto-removed on damage same-pass ("took damage", applyDamage house-rule §181) — re-applied between casts.
- §96 inline adjudicator stamp-ignore re-confirmed: victim bonus printed +0 (honest Bandit WIS +0, no rig needed).
- §77 cached-popup replay live: absorbed refire click replayed cast-#2 popup with zero log delta; flushed via overlay/Done before genuine cast #3 — no double-apply (log/hp chain single-entry per cast).
- Console: 0 errors. Campaign header verified `test-campaign` throughout; gridless lenient (range "" advisory).
