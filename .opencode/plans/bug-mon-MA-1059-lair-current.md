# BUG MA-1059 — Kraken "Unnamed lair actions 1" (strong current) — prose-only, no affordance

**Verdict:** FAIL(b)-DATA/UI — text renders, no mechanic affordance. Twin MA-1016 lane.

## Data shape (disk, `public/data/monsters.json`, Kraken `lair_actions[0]`)
Raw **string**, not object: no `name`, no `save_dc`, no `save_type`, no structured fields.
DC 23 Strength save exists **prose-only** inside the description text.

## Live evidence (test-campaign, :5173, header verified "test-campaign")
- Kraken 1 in initiative; card opened fresh via portrait click.
- Text renders verbatim in "Lair Actions" section (`mc-section`):
  `"A strong current moves through the kraken's lair. Each creature within 60 feet of the kraken must suc­ ceed on a DC 23 Strength saving throw or be pushed up to 60 feet away from the kraken. On a success, the creature is pushed 10 feet away from the kraken."`
- Rendered row HTML: `<div class="mc-action"><span>…</span></div>` — plain span, **no** `.mc-dice-link`, **no** `role="button"`, **no** chip.
- **Zero-press evidence:** no affordance existed to press. Log delta 0 (500→500 entries). Console errors 0. change-data delta = only `combat-ui-viewingMonster*` card-open UI cache keys (no mechanic writes).

## Code gate (cites)
- `src/services/encounters/monsterLairActions.js:25-26` — `isLairRowClickable`: `typeof row !== 'object' || !row.name` → false for raw-string rows.
- `src/components/encounter/MonsterCardBody.jsx:340-352` — `MonsterLairAction`: `typeof la === 'string' || !isLairRowClickable(la)` short-circuits to static prose span; interactive branch (chip + `handleLairRow`) unreachable for string rows.

## Fix direction (lane-consistent with MA-1016)
Structure the row on disk: `{name, description, save_type: "Strength", save_dc: 23, save_effect: "Failure: pushed up to 60 ft away… Success: pushed 10 ft away…"}` (push mechanics gridless-advisory). Manifest NOT edited (per task rules).

## Rig state
Kraken card closed (Escape), overlays clean, rig cond-clean, no clears.
