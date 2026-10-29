# Encounter Generator "All" environments preset silently excludes the Planar environment

## Summary
The Encounter Generator modal's environment selector has no way to include `planar` monsters: its 7 group chips (Arctic/Temperate/Wetlands/Desert/Underground/Aquatic/Urban) never list `planar`, and the default "All" preset enumerates only 11 of the game's 12 environment values. Any monster whose `environments` array is planar-only is therefore unreachable from generated encounters, and the "N monsters available" census under-reports the joinable bestiary (shows 633 while the main EB table serves 636 rows, of which 634 are environment-tagged).

## Steps to reproduce
1. In test-campaign, open the Encounters view (Encounter Builder).
2. Search `Tiamat` in the monster search (`input[aria-label="Search monsters"]`) — a row exists with environment tag **Planar** (CR 30). Clear the search.
3. Click toolbar `Generate encounter`.
4. Read the census line: `633 monsters available` with the default `All` preset active.
5. Inspect the ENVIRONMENTS chips: `All | Dungeon | Wilderness` presets + groups `ARCTIC (arctic, mountain)`, `TEMPERATE (forest, grassland, hill)`, `WETLANDS (swamp, coastal)`, `DESERT (desert)`, `UNDERGROUND (underdark)`, `AQUATIC (underwater)`, `URBAN (urban)`. No chip anywhere contains `planar`.
6. (Data confirmation) `public/data/monsters.json` has 636 monsters; exactly 2 carry no `environments` field (Monkey Clone, Otherworldly Steed) and exactly 1 is planar-ONLY (Tiamat, `environments:["planar"]`). 636 − 2 − 1 = **633** = the modal's census, machine-proving planar-only monsters are filtered out.

## Expected behavior
"All" means all environments the app models — `planar` is a first-class environment (the EB table has its own 13-chip ENVIRONMENT filter that **does** include a `Planar` chip, and Tiamat's row renders the Planar tag). The generator's All preset and at least one group chip (a Planar/Cosmological group, or folded into an existing group) should include `planar`, making planar-only monsters eligible for generation; census would read 634.

## Actual behavior
The generator's default count is 633; planar-only monsters can never appear in any suggestion regardless of chip combination (no user-reachable selection includes `planar`). The main EB table finds Tiamat normally, so the monster is joinable but generator-invisible. No error or hint anywhere.

## Likely location
Confident: `src/components/encounter/EncounterGeneratorModal.jsx`
- Line 16: the `All` preset `environments:` array lists 11 values, missing `'planar'`.
- Lines 5–12: `ENVIRONMENT_GROUPS` has no group containing `'planar'`.
- Line 108: `availableCount` filter (and the same selected-envs set the suggestion generator consumes downstream) does `m.environments.some(e => selected.includes(e))`, so planar-only rows fail every selection.

## Suggested fix
Add `'planar'` to the `All` preset array (one-token fix) and give it a selectable home: either a new group chip (e.g. `PLANAR  planar`) in `ENVIRONMENT_GROUPS` or fold `planar` into an appropriate existing group (Underground is wrong thematically; a standalone Planar group is cleanest). Check the suggestion generator (`encounterGenerator` service) doesn't hardcode the same 7-group list, and update `EncounterGeneratorModal.test.jsx` census pins (they assert exact "N monsters available" numbers).

## Severity
Minor UX issue / data-coverage gap — no crash or data loss, but an "All"-labelled control silently under-covers the bestiary and one authored monster (Tiamat, an endgame boss with a dedicated 155k-XP stat block) is permanently un-generatable. Close-but-not-exact per house verdict policy.

## Resolution
FIXED — the black-box diagnosis was confirmed exactly. Root cause in `src/components/encounter/EncounterGeneratorModal.jsx`:
- `ENVIRONMENT_GROUPS` had 7 groups / 11 environments with no home for `'planar'`. This list is ALSO the source of the modal's default `selectedEnvs` (`flatMap` at :82), so even the out-of-the-box census missed planar-only monsters.
- The `All` quick pick (`QUICK_PICKS`, :16) hardcoded the same 11 values.

The suggestion service (`src/services/encounters/encounterGenerator.js`) does NOT hardcode the group list — it filters purely on the `environments` array it receives (:88-90), so no service change was needed. Ground truth per `public/data/monsters.json`: 636 monsters, 12 distinct environment values incl. `planar`, 2 with no `environments` (Monkey Clone, Otherworldly Steed), exactly 1 planar-ONLY (Tiamat) → 636−2−1 = 633 pre-fix, 634 post-fix.

**Changes:**
- `src/components/encounter/EncounterGeneratorModal.jsx` — added `{ label: 'Planar', environments: ['planar'] }` to `ENVIRONMENT_GROUPS` (standalone group, per the bug file's cleanest-option; also folds into the default selection via the existing flatMap) and added `'planar'` to the `All` quick-pick array.
- `src/components/encounter/EncounterGeneratorModal.planar.test.jsx` — NEW regression test (3 cases): opens with a checked `planar` chip and counts a Tiamat-shaped planar-only monster in the census; the `All` quick pick keeps planar selected and passes `'planar'` in the generator payload; unselecting planar alone drops the planar-only monster and excludes it from the payload.

**Not needed:** `EncounterGeneratorModal.test.jsx` census pins assert against small non-planar mock monsters (3/0/1), so all still pass unchanged — no pin updates required.

**Verified:**
- Live re-run of repro steps in test-campaign (Playwright, Vite :5173): Generate modal census now reads **`634 monsters available`**, an **`PLANAR (planar)`** group chip exists (8th group, 12 checkboxes, checked by default), Tiamat row still renders its Planar tag in the EB table. Sanity: unchecking planar drops census to 633; `All` quick pick restores 634 with planar checked; `Generate` produces 3 suggestions (Medium/Easy/Easy); modal × close works.
- `npx vitest run src/components/encounter/EncounterGeneratorModal.planar.test.jsx` → 3/3 pass.
- `npx vitest run src/components/encounter src/services/encounters` → 472 files / 3019 tests, all pass.
- `npm run lint` → clean, zero warnings.
- Cleanup: test-campaign change-data cleared (`{}`) and log cleared (`[]`) via admin API after verification.
