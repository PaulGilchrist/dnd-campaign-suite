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
