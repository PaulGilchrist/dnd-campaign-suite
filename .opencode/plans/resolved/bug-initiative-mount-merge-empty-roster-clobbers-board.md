# bug-initiative-mount-merge-empty-roster-clobbers-board

## Summary

A second GM tab that opens the Initiative view before its character-roster
prop has settled (async rules-engine enrichment still in flight) POSTs a
mount-merge `combatSummary` built from an EMPTY roster. The merge
(`mergeCombatSummaryWithCharacters`) drops every `type:'player'` row not
present in `characters` and the effect unconditionally re-POSTs the whole
board, silently replacing the live multi-row board with only its non-player
rows. If no other GM tab with a settled roster is mounted on Initiative, the
clobber persists indefinitely (all player rows, their HP/initiative/arms, and
the `activeCreatureName` pointer are lost server-side).

## Steps to reproduce

1. In test-campaign, with a multi-row `combatSummary` on the server (any board
   with player rows — the App-select seed of 13 PCs, or a 14-row board with one
   NPC row), have Tab A sitting on a NON-Initiative view (e.g. the character
   sheet). (Verified variant: 13 PCs + `OP-Goblin` npc row,
   `activeCreatureName` = AasimarTest.)
2. Open a second localhost tab (new Playwright page / Ctrl+T), wait only for
   the campaign-selection buttons, click `test-campaign`, and click the
   `Initiative` sidebar button as soon as it renders (within ~0.5 s of
   selection, while "Loading party stats..." may still be on screen).
3. GET `/api/campaigns/test-campaign/change-data` and inspect
   `combatSummary.value.creatures`.

## Expected behavior

The second tab's mount-merge must not author a board until its roster has
settled (or must merge additively without evicting player rows it has not
actually seen). The 14-row board must survive; alternatively the write should
be rejected/stamped like the guarded lanes (`storage.set(..., { baseVersion })`).

## Actual behavior

- Reproduced 2/2 (2026-11-12 explore run OP). Attempt 1 (evaluate click
  ~57 ms after campaign click): the new tab POSTed
  `{"value":{"round":1,"creatures":[{"name":"OP-Goblin","type":"npc",...}]}}` —
  a 1-row board — and the server GET showed **rows:1**, names `[OP-Goblin]`,
  `activeCreatureName` key **ABSENT**. All 13 player rows (with rolled
  initiatives 20..8, targetName arms) were silently lost and stayed lost
  (Tab A was mounted on the char sheet, nothing healed it).
- Attempt 2 (TRUSTED `locator.click` 109 ms after campaign click — a normal
  human speed): the same 1-row clobber POST landed on the wire. Recovery to 14
  rows happened only because Tab A happened to be mounted on Initiative with a
  settled roster and its next full write re-merged the players back — with the
  players' initiative values reset to `''` (they re-entered as the minimal
  `newPlayerCreatures` skeleton, losing the GM-entered initiatives).
- The rules-engine enrichment for 13 lv20 characters takes hundreds of ms in
  dev, so the empty-roster window is easily hit; the "Loading party stats"
  overlay does not block the sidebar.

## Likely location

Confident (code read matches the observed POST byte-for-byte):
`src/components/initiative/Initiative.jsx` mount-merge effect (~line 774–824):
deps are `[campaignName, isLocalhost]` with `characters` read from the
first-render closure; on mount `mergeCombatSummaryWithCharacters(initialSummary, characters /* [] */, ...)`
filters out all player rows (line 245 of
`src/services/encounters/initiativeService.js`) and the effect then calls
`storage.set('combatSummary', merged, campaignName)` UNGUARDED (no
`baseVersion`, unlike `createCreatureHandlers.js:591`). Server side:
`/api/campaigns/:c/combatSummary` full POST is last-writer-wins and accepts it.
This is the SIBLING CLOBBER FACE already recorded in `docs/test-setup-playbook.md`
§52 as a harness pitfall — it is a real user-facing data-loss face, not just a
test hazard.

## Suggested fix

Guard the mount-merge authoring on roster readiness: in the effect, when
`initialSummary` EXISTS and has `type:'player'` rows but `characters` is empty
(roster not settled), do NOT POST — either skip the write and re-run when
`characters` becomes non-empty (add it to the deps, or a `while (characters
.length === 0 && playerRowsExist) return` guard), or merge additively (never
evict player rows). A cheap first check: compare `initialSummary.creatures
.filter(c => c.type==='player').length` against `characters.length` and skip
the POST when characters is 0 but the stored board has player rows. Also
consider stamping `baseVersion` on the mount POST (the guarded-set lane
already exists) so a stale mirror cannot silently win. Recovery note for
victims: view-switching (Log→Initiative) on a tab whose roster DID settle
re-merges the board but resets player initiative values to blank.

## Severity

Data integrity risk — a routine second-tab open can silently destroy live
initiative state (rows, HP ordering, arms, turn pointer) for the whole table;
no error, no toast, no log row.

## Resolution

FIXED 2026-11-12 (fix run). Root cause confirmed exactly as diagnosed in
"Likely location": the one-shot mount-merge effect in `Initiative.jsx`
(deps `[campaignName, isLocalhost]`) captured the first-render `characters`
prop, which is `[]` for the whole window between campaign-select and the
rules-engine enrichment resolving — even a 46 ms impatient click is far too
early; the pre-settling char-file fetch means the window starts BEFORE the
"Loading party stats" band even appears. The merge then evicted every
`type:'player'` row and the unguarded full-store POST replaced the live board.

**Fix (roster-settled deferral, first option in "Suggested fix"):** the mount
effect now skips authoring when the stored board has player rows but the
roster prop is still empty, and re-runs once the roster settles.

- `src/components/initiative/Initiative.jsx`:
  - New module-scope helper `mountMergeMustWaitForRoster(initialSummary,
    characters)` (next to the `isActiveEconomyRowGmDriven` precedent — the
    component sits at the eslint statement/complexity ceilings, so the raw
    guard could not stay inline without breaking zero-warning lint).
  - The mount-merge effect returns early (with a single
    `console.warn('[initiative] mount-merge deferred — character roster still loading')`
    marker for QA/harness witness) when the guard fires — it neither POSTs
    nor mirrors an evicted board locally (a locally-mirrored eviction would
    poison this tab's later full-store writes the same way).
  - The effect deps gain `characters.length === 0` — the roster-empty
    BOOLEAN, not the array identity: the merge re-runs exactly ONCE when the
    roster settles and never on later roster re-bakes (no write storm when
    two settled GM tabs stay mounted).
  - Boards with ZERO stored player rows are NOT gated (nothing to evict):
    pure monster/NPC arena boards and the zero-character Arena/Starter
    quick-create mount law (`bug-zero-creature-initiative-null-name`) are
    unchanged.
  - `baseVersion` stamping was deliberately NOT added (the bug file listed
    it as an alternative, not an addition): the mount already
    read-modify-writes from a FRESH `loadCombatSummary`, the guard closes the
    demonstrated hole, and a 409 in the mount lane would need re-apply
    machinery the spawn lane (`createCreatureHandlers.js` `spawnNpc`) carries
    but the mount does not need. No log row was added — the mount-merge is an
    idempotent adoption, not a gameplay event; the console.warn marker names
    every deferral.
- Dual-ruleset: N/A — this is the shared mount UI lane, not a
  5e/2024-split rules module.

**Regression test:** `src/components/initiative/Initiative.mount-merge-roster-
guard.test.jsx` (real `initiativeService`, un-mocked merge, mock block mirrored
from `Initiative.mount-active-creature.test.jsx`) — 4 cases: empty roster +
player-row board authors NOTHING (POST + local mirror both withheld); the
settled re-run POSTs the FULL board with initiatives/arms/pointer intact;
zero-player-row board merges immediately with an empty roster; settled mount
POSTs exactly once across a non-flipping re-render.

**Verification:**
1. Live repro BEFORE fix (test-campaign, curl-seeded 4-row board, dev pair
   CAMPAIGN_LOCK=test-campaign): Tab B clicked Initiative 48 ms after
   campaign-select → GET change-data showed `rows:1` (`BUG-Goblin` only),
   pointer gone, Tab A (char sheet) healed nothing. Reproduced as filed.
2. Live re-run AFTER fix, identical rig: Tab B clicked at 46 ms → the
   deferral warn fired, the settle re-merge POSTed the board additively:
   `rows:14` (4 seed rows + the 10 campaign PCs the mount merge normally
   adds), seed initiatives `20/15/8/12`, both `targetName` arms and nested
   `activeCreatureName: AasimarTest` byte-intact; Tab B DOM rendered 14
   cards with AasimarTest active. Console: 0 errors, exactly the 1 guard
   warning. Two-settled-tab idempotency face: navigating Tab A onto
   Initiative after Tab B settled kept `rows:14`, seed intact, no write storm.
3. `npx vitest run src/components/initiative src/services/encounters` →
   214 files / 2043 tests passed (incl. the pre-existing zero-creature-mount
   and mount-active-creature suites, unmodified).
4. `npm run lint` → 0 errors, 0 warnings.
5. Exit hygiene: both tabs closed, closed-tab two-pass admin clears →
   change-data `{}`, log `[]`, overlays `[]`; servers killed by port-PID;
   zero campaign-lock denials in the dev log; no fixture files touched
   (change-data rig only, `BUG-Goblin` lived only in the `combatSummary`
   bucket).

