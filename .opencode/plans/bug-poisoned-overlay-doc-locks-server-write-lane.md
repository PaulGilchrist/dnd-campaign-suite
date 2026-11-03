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
