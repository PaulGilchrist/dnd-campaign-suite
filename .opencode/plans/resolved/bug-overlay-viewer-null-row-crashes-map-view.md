# Bug: Overlay viewer fail-soft crashes on `null` rows — whole map view hits the ErrorBoundary

**Filed:** 2026-11-02 (descent run BF, throwaway `qa-arena`)

## Summary

The d3e1658c9 improvement promised "fail-soft legacy-bad docs in viewers", and it works for object/string junk rows — but a `null` row inside the persisted overlay doc still crashes the load-merge lane in `useSpellOverlay.js` (`n.id` on null) BEFORE any filter runs, taking the entire indoor map view down to the ErrorBoundary.

## Steps to reproduce

1. Throwaway campaign per owner ruling (`qa-arena`): quick-create via "New Arena Battle", cancel the zero-character wizard.
2. Stop the API server; overwrite `public/campaigns/qa-arena/data/spell-overlays.json` with a legacy-bad doc mixing one valid sphere with junk classes:
   ```json
   [ {valid sphere id bf-valid}, {"x":1,"y":2,"radius":3}, "a bare string", null, {"shape":"cone","startGridX":5} ]
   ```
   (This simulates pre-guard-era disk residue; the wildcard key backdoor that could write such shapes was closed by 01b44a851, so disk surgery is the injection route today.)
3. Restart the API. `GET /spell-overlay?campaign=qa-arena` honestly serves all 5 rows.
4. In the browser (localhost), Maps → Open "The Sparring Hall" (indoor).

## Expected behavior

Every junk class is skipped with a console warning; the valid sphere renders; the map view stays mounted (the control below proves this is the shipped design).

## Actual behavior

The map view renders the ErrorBoundary: "This view ran into an error and could not be displayed." Console error (verbatim):

```
TypeError: Cannot read properties of null (reading 'id')
    at .../src/components/map/hooks/useSpellOverlay.js:38:61
    at Array.filter
```

`g.spell-overlay-group` count 0 — even the VALID sphere never renders; the whole view is dead until the doc is fixed.

**Control (same rig, null row REMOVED — junk object + bare string only):** map mounts, 1 group + 1 circle render, and the renderer logs exactly the honest skips:
`SpellOverlayRenderer: skipping malformed overlay {"x":1,"y":2,"radius":3}` / `… "a bare string"`. So the defect is specific to `null` (and by symmetry `undefined`) rows.

## Likely location

Confident on the seam: `src/components/map/hooks/useSpellOverlay.js` — the initial-load merge (~source lines 41-45) does `new Set(prev.map(o => o.id))` + `loaded.filter(n => !existingIds.has(n.id))` with no null guard; a null row dereferences `.id` inside the state-updater, which React surfaces as an uncaught render-phase error → ErrorBoundary. The SSE `add` merge (~lines 149-151, `newOverlays.filter(n => …n.id)`) carries the identical hazard. The downstream defenses (`SpellOverlayRenderer` skip log, `SpellOverlayControls.jsx:108 visibleOverlays = overlays.filter(isValidOverlay)`) never get reached because the crash happens earlier, at merge time.

## Suggested fix

Filter incoming rows through the shared model validator BEFORE the id-dedupe, at both merge lanes:
`const safe = loaded.filter(r => r && typeof r === 'object' && isValidOverlay(r));` (or at minimum `r != null`), and skip the merge entirely when `safe.length === 0`. Same treatment for the SSE add-event `newOverlays`. The renderer skip can stay as defense-in-depth; the hook must never hand a null to `.id`. A unit test seeding `fetchSpellOverlays` → `[valid, null, junk]` asserting the valid sphere renders and no throw would pin it (reuse the `spell-overlay-shape-guard` fixture family).

## Severity

Minor-to-moderate UX / robustness gap — bounded blast radius (post-01b44a851, malformed docs can only enter via disk surgery or pre-guard historical files), but when present it bricks the whole map view for every client of that campaign until manual repair, and it contradicts the shipped "fail-soft legacy-bad docs" claim.

## Resolution

**FIXED 2026-11-02 (fix run).** Root cause confirmed exactly as diagnosed: the merge lanes in `src/components/map/hooks/useSpellOverlay.js` dereferenced `.id` on every incoming row BEFORE any filter ran, so a `null` row from the persisted doc threw inside the state-updater (render phase) → ErrorBoundary, and even the valid sphere never rendered. The SSE `update` lane (`newOverlays.find(n => n.id === o.id)`) carried the same hazard as `add`.

**Design note (why not the suggested `isValidOverlay` filter):** the shipped lane ownership — pinned by the verbatim-adoption test in `useSpellOverlay.test.js` — is that the HOOK merges every non-null row verbatim and the RENDERER/Controls own the junk fail-soft skip (the repro's "control" leg confirms: junk object + bare string reach the renderer and produce the honest `SpellOverlayRenderer: skipping malformed overlay` logs). Filtering to `isValidOverlay` in the hook would have broken that contract AND silenced the control-leg skip logs. Minimal correct fix: drop ONLY `null`/`undefined` rows at merge time, with a console skip log so the null class is also "skipped with a console warning" per the Expected.

Changes:
- `src/components/map/hooks/useSpellOverlay.js` — new `skipNullRows(rows, lane)` helper (filter + honest `useSpellOverlay: skipping N null overlay row(s) (<lane>)` console.error) applied at BOTH merge lanes: initial-load (`fetchSpellOverlays` result) and SSE payload (via new `parseOverlayEvent` helper so the add/update cases share one guard — extraction also keeps `handleSSEEvent` under the complexity-15 lint cap). Non-array payloads unchanged; all-null payloads skip the merge entirely.
- `src/components/map/hooks/useSpellOverlay.null-row.test.js` — NEW regression test (3 cases): mixed valid/junk/null doc merges with nulls dropped + skip log; all-null doc writes nothing; SSE add/update lanes drop nulls without throwing and still apply valid companions, with the exact skip-log census.

Live verification (test-campaign; throwaway `qa-arena` no longer exists, disk-swap re-derived here on the indoor `test-map`, servers `npm run dev:locked`):
- Repro pre-fix: seeded the exact 5-row doc → Maps → Open "Test Map" → ErrorBoundary "This view ran into an error and could not be displayed.", `g.spell-overlay-group` = 0, console verbatim `TypeError: Cannot read properties of null (reading 'id')` in `Array.filter` inside useSpellOverlay → ErrorBoundary.
- Re-verify post-fix (same doc, no server restart — Vite HMR): map mounts, 1 group + 1 circle render (r=160 = radiusFt 20 ✓), panel "Active (1)", and ALL four junk classes skipped with console warnings: `useSpellOverlay: skipping 1 null overlay row(s) (load)` (new) + the three pre-existing `SpellOverlayRenderer: skipping malformed overlay …` rows. Expected behavior exact.
- Adjacent sanity: `clear`→200, valid `add`→200 adopted live by the open tab via SSE (1 group, "Active (1)"), `remove`→200 board empties — normal lanes byte-healthy under the new guard.
- Tests: `npx vitest run src/components/map/hooks/` 18 files/257 pass (incl. new file); `npx vitest run src/components/map/ src/services/maps/ server/` 207 files/3060 pass; `npm run lint` zero warnings. (Dual-ruleset: N/A — viewer hook, not rules code. Campaign-log: overlays never log there by design — transport-only.)
- Cleanup: poisoned disk doc removed (debounce re-deleted it after `clear`; file absent = baseline), Admin cleared change-data (`{}`) + log (`[]`), GET verified `{overlays:[]}`/`{}`/`[]`.

**NEW sibling defect found live (OUT OF SCOPE here, needs owner triage — server lane):** the same null-deref exists in `server/routes/spell-overlay.js` `applyOverlayAction` — with a null row in the in-memory doc, `existing.map(o => o.id)` (add, :126) / `updatedIds` + `existing.map` (update, :137-138) / `existing.filter(o => o.id !== …)` (remove, :143) throw on an otherwise-VALID POST → honest-looking `500 Error in POST /spell-overlay` (reproduced live: valid add 500'd over the seeded doc; `clear` survives — it never derefs). The viewer fix unbricks the map view (and Clear All still repairs the board), but writes stay poisoned until then. Complements the existing BF backlog bullet "filter at the transport source (server) as defense-in-depth". Not fixed in this run to keep the filed viewer ticket minimal + server proof needs an API restart + its own regression test.

