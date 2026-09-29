# Bug — MA-1577 Tarrasque · Frightful Presence (aoe-save, DC 17 Wisdom, frightened)

## Overview
Tarrasque "Frightful Presence" is a half-implementation. The DC 17 Wisdom save
and the frightened-on-fail grant work honestly in the live EB flow, but the
authored **repeat-save-at-end-of-turn** and **24-hour success immunity** mechanics
are prose-only in the data row and are never armed at runtime. The combat
service machinery for both exists, but it forks only on structured row objects
(`repeat_save:{...}` / `success_immunity:{...}`) which this row lacks.

## Expected (manifest quote)
> "Each creature ofthe tarrasque's choice within 120 feet of it and aware of it must
> succeed on a DC 17 Wisdom saving throw or become frightened for 1 minute. A creature
> can repeat the saving throw at the end of each of its turns, with disadvantage if the
> tarrasque is within line of sight, ending the effect on itself on a success. If a
> creature's saving throw is successful or the effect ends for it, the creature is immune
> to the tarrasque's Frightful Presence for the next 24 hours."

## Actual (live E2E, test-campaign, localhost:5173)
- **PASS (partial):** chip "DC 17 Wisdom" renders, AoE picker honest ("Each must make a
  Wisdom saving throw (DC 17)"); failed save (Bandit 1, rolled 7) granted **Frightened**
  badge + `condition applied` log ("Bandit 1 failed the Wisdom save (DC 17) in Tarrasque 1's
  Frightful Presence — Frightened 1 minute…").
- **FAIL (a) — no EOT repeat-save:** initiative advanced through ≥2 full rounds past
  Bandit 1's turn end (round 2 → 3). Campaign log grep: **zero** repeat-save entries
  (`succeed|repeat` → no matches). Frightened badge persisted across reload with no
  save opportunity ever offered; the grant's own log text promises "repeats the save at
  the end of each of its turns" but nothing arms it.
- **FAIL (b) — no 24h success immunity:** forced SUCCESS face (Divine_Cleric,
  SAVE SUCCESS "Total: 18 vs DC 17, d20 (9)+9") → zero frightened applied (no
  `condition applied` entry for Divine_Cleric) **and zero immunity target-effect**
  ("immune|immunity" across full log → 0 matches). No immunity te exists to block
  re-targeting; the same Frightful Presence could be re-pressed on the same creature
  indefinitely.
- Cosmetic twin: PC save prompt and results popup carry wrong-verb copy —
  "Half damage on successful save" / "Divine_Cleric: Saved — takes no damage (rolled 9)"
  on a condition-only, no-damage save (and "Source: Tarrasque" without instance name).

## Steps
1. localhost:5173 → `test-campaign` → Encounters (EB) → search-add exactly "Tarrasque" + "Bandit" → Join Encounter.
2. Open Tarrasque card (avatar first click absorbed; second click opens) → press "DC 17 Wisdom" chip.
3. Select Bandit in AoE picker → confirm → auto-roll 7 → FAILED → Frightened badge + `condition applied` log. ✅ honest.
4. Press Next through ≥2 rounds past Bandit 1's turn end → log grep: no EOT repeat-save entries; badge never drops. ❌
5. Re-press chip on a high-WIS PC, roll SAVE SUCCESS (18 vs DC 17) → no frightened, but also no immunity te. ❌
6. Cleanup: Admin → Clear Change Data + Clear Campaign Log; Clear initiative. ✅

## Likely Location
`public/data/monsters.json` tarrasque Frightful Presence row — data lane: prose-only
`save_effect`, missing machine-readable `repeat_save` / `success_immunity` objects. The
service seams that arm both mechanics already exist and read exclusively those structured
objects (`src/hooks/combat/saveProcessing.js:632` comment + fork, `:716`
`parseSuccessImmunity({ success_immunity: context.successImmunity })`). Fix is authoring
the structured keys on the row (no new machinery needed).

## Notes
- Grant log recites the repeat/immunity prose ("…repeats the save at the end of each of
  its turns…") without arming it — misleading copy.
- Cosmetic twins to fix alongside: "Half damage on successful save" + "Saved — takes no
  damage" wording on this condition-only save; earlier DC-Unknown popup twin pattern of
  the same save-result chrome family.
- Multi-instance campaign noise (Tarrasque/Bandit dupes from repeated joins) cleared via
  Admin panel; only `test-campaign` touched.

VERIFIED: FAIL
