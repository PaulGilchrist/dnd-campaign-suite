# Bug: Malformed rows in persisted overlay doc crash the server-side overlay WRITE lane (500s), not just the GET response

**Filed:** 2026-11-02 (descent run BG)

## Summary

The 345bb2563 improvement filters `GET /spell-overlay` responses, but the raw disk doc is still boot-loaded unfiltered into the in-memory `spellOverlayData` Map, and the POST write lanes dereference `.id` on every stored row. A campaign whose persisted `data/spell-overlays.json` contains a `null` row (pre-guard historical file, or disk surgery) therefore returns **HTTP 500 for every valid add/update/remove** — the whole overlay feature is write-locked for that campaign, silently to the UI.

## Steps to reproduce

Control first (clean campaign):
1. In `test-campaign` (clean disk, no `data/spell-overlays.json`), with the map view open on "Test Map", POST `/spell-overlay?campaign=test-campaign` `{action:'add', overlays:[<valid sphere id bg-add-1 …createOverlay shape>]}` → **200**, overlay renders after reload (confirmed live this run).

Poisoned leg:
2. Stop the API; write `public/campaigns/test-campaign/data/spell-overlays.json` with a mixed legacy-bad doc: one valid sphere `bg-valid`, `null`, `{"x":1,"y":2,"radius":3}`, `"a bare string"`, `{"shape":"cone","startGridX":5}`.
3. Restart the API. `GET /spell-overlay?campaign=test-campaign` correctly serves ONLY `bg-valid` (drop log line fires, disk untouched — that fix works).
4. POST the SAME valid add as step 1 (`bg-add-1`).
5. POST `{action:'remove', overlayId:'bg-add-1'}`.

## Expected behavior

Both POSTs 200 and adopt live (the request rows pass `overlayShapeProblem`; the stored junk shouldn't obstruct unrelated writes — mirror the GET doctrine: skip malformed stored rows, act on valid ones).

## Actual behavior

Both POSTs return **500 Internal Server Error**. API log (verbatim, one per action):

```
Error in POST /spell-overlay?campaign=test-campaign: TypeError: Cannot read properties of null (reading 'id')
    at server/routes/spell-overlay.js:150:65   (add: existing.map(o => o.id))
    at applyOverlayAction (server/routes/spell-overlay.js:150:54)
```
```
Error in POST /spell-overlay?campaign=test-campaign: TypeError: Cannot read properties of null (reading 'id')
    at server/routes/spell-overlay.js:133:35   (remove: overlayValidationError → existing.some(o => o.id === overlayId))
```

Client-side the map tab shows no adoption and no error surface for the failed op (raw fetch 500; only the browser console resource line). `bg-valid` itself is also permanently unremovable: any state-changing action 500s while the poison row sits in memory.

## Likely location

Confident (stack traces above):
- `server/utils/changeData.js:70-80` — boot reads the disk doc into `spellOverlayData` with no shape screening (the GET filter lives at the route, response-only).
- `server/routes/spell-overlay.js` — raw traversals over the STORED array: `overlayValidationError` :133 (`existing.some` for remove), `applyOverlayAction` :150 (add `existing.map`), :162 (update `existing.map`), :167 (remove `filter`). `clear` is safe (blanket set).

## Suggested fix

Screen at the source once: at boot load, run the doc through the already-exported `filterRenderableOverlays` (spell-overlay.js) before `spellOverlayData.set` — same response-only doctrine (disk untouched, one drop log line). That makes every write traversal structurally safe and matches the GET lane's census logging. Defense-in-depth alternative: null-guard the four stored-row traversals. Add a route test seeding `spellOverlayData` with `[valid, null]` and asserting add/update/remove all 200 with the null row skipped.

## Severity

Broken feature / data-integrity-adjacent — a single legacy junk row silently write-locks the entire overlay lane for that campaign (500s with no UI feedback), and the shipped GET filter's "fail-soft legacy-bad docs" promise doesn't extend to the transport's own state. Blast radius bounded to campaigns with pre-guard disk docs (same entry route as the BF null-row bug: historical files or disk surgery — the API wildcard can't inject these since 01b44a851).

## Resolution

**FIXED 2026-11-02 (descent-run BG follow-up subagent).** Root cause confirmed exactly as diagnosed: `changeData.js` `loadCampaignOverlays` boot-loaded the raw disk doc into `spellOverlayData`, and the four STORED-row traversals in `spell-overlay.js` dereferenced `o.id` on every row — a single `null` row threw `TypeError: Cannot read properties of null (reading 'id')` inside the add (`:150`), the remove pre-validation (`:133`), update (`:162`) and remove-filter (`:167`) lanes, 500-wedging every valid write for that campaign. Live repro reproduced verbatim before fixing: poisoned 5-row doc (valid `bg-valid` + null + x/y/radius + bare string + partial cone) → GET correctly served only `bg-valid`, but POST add AND POST remove both returned 500 with the exact stack lines above, and the open Test Map tab showed no adoption (`Active (1)` before and after) with only a console resource line — silent to the UI. Control leg on clean disk: identical POST 200 + live adoption.

Fix = the suggested source-screening, plus cheap defense-in-depth on the traversals:

- `server/utils/changeData.js` — `loadCampaignOverlays` now runs the parsed doc through the route's already-exported `filterRenderableOverlays(campaign, overlays, 'boot')` before `spellOverlayData.set`. Same doctrine as the GET lane: boot only reads (disk byte-untouched, verified by md5 across the probe), one drop census line per load, valid rows pass byte-identical.
- `server/routes/spell-overlay.js` — `filterRenderableOverlays` gained an optional `source` param (default `'GET'`, existing message bytes unchanged) so the boot lane logs `… boot <campaign> …`; the four stored-row traversals now read ids via a `storedId(o) => o?.id` helper so a legacy-poisoned store can never crash a write (junk rows are skipped/kept, never dereferenced, never silently evicted). ESM circular import (`changeData → spell-overlay`) is safe: `filterRenderableOverlays` is a hoisted function declaration used only at runtime.

Verification:

- **Live re-run (test-campaign, localhost:5173):** poisoned doc + API restart on fixed code → boot log verbatim `[spell-overlay] dropped 4 malformed row(s) boot test-campaign — disk left untouched`; GET still serves ONLY `bg-valid`; POST add **200**, POST update **200**, POST remove **200** (was 500/500); browser map tab on Test Map adopted live via SSE: `Active (1)` → add 200 → `Active (2)` → remove 200 → `Active (1)`. Zero 500s, zero console errors. Adjacent sanity: remove of an absent id still 400s honestly; `clear` 200s and the debounced persister UNLINKED the poisoned file (disk hygiene re-proven: no reformat by the fixed server — old-code observation: the pre-fix server re-persisted the in-memory poison doc reformatted on any change-data markDirty, same data, cosmetic byte churn).
- **Tests:** NEW `server/routes/spell-overlay.poisoned-store.test.js` (5 tests — store seeded `[valid, null, 'bare string', {x,y,radius}, partial-cone]`: add/remove/update/clear all 200, junk kept-untouched, absent-id remove still 400) + NEW `server/utils/changeData.overlay-boot-screen.test.js` (5 tests — boot screening: junk skipped from memory, one `boot` census line, clean doc byte-identical + silent, read-only (no write/unlink), all-junk → `[]`). Existing `changeData.test.js` boot fixture widened to canonical transport shape (it pinned the old raw-load behavior with a legacy stub row the screener now correctly drops). Order run: 2 new files 10/10 → spell-overlay + changeData families 209/209 → sse/admin adjacent 101/101 → **full `server/` folder 131 files / 2151 tests green**. `npm run lint` zero warnings; `no-timers-guard` OK.

Baseline restored after verification: overlays cleared (file unlinked), Admin clear-change-data `{}` + clear-log `[]` on test-campaign (both native confirms accepted), no console errors, API (`:80`, api:locked) + Vite (`:5173`) left running for reuse.
