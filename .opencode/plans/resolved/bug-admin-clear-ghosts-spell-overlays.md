# Admin "Clear Change Data" wipes server-side spell overlays without broadcasting — mounted map tabs ghost them forever

## Summary

`POST /admin/clear-change-data` deletes the campaign's in-memory `spellOverlayData` entry but publishes no
`spell-overlay-<campaign>` event (it only publishes the combatSummary null). Every mounted map editor keeps
rendering the cleared overlays indefinitely — stale circles/cones that no longer exist on the server, are
invisible to any fresh client, and still locally respond to move/rotate clicks (the resulting `update` POSTs
are silently dropped server-side because the id no longer exists).

## Steps to reproduce

1. In test-campaign, open the Battle Arena map editor in two tabs. Click `Spell` on tab A and place a cone
   (select shape Cone, drag inside the map canvas). Both tabs render it (`g.spell-overlay-group` ×1 each —
   the SSE add mirror works).
2. With BOTH map tabs still open, clear the change data: `POST /api/campaigns/test-campaign/admin/clear-change-data`
   (or Admin panel → Clear Change Data).
3. `GET /spell-overlay?campaign=test-campaign` → `{"overlays":[]}` (server truth: cleared).
4. Observe the two mounted tabs: each still shows `g.spell-overlay-group` count 1 (verified live: server 0,
   ghostA 1, ghostB 1, zero reloads). Clicking/dragging the ghost moves it locally; the debounced
   `POST /spell-overlay {action:'update'}` returns `ok:true` while the server-side `update` matches nothing
   (the overlay array is empty) — permanent client/server divergence until a view-switch or reload refetches [].
5. Worse seam: a GM who opens Initiative afresh sees NO `─── Overlays ───` options (mount-time
   `fetchSpellOverlays` returns []), while the map view still displays the zones.

## Expected behavior

The clear lanes that already reach `spellOverlayData` (`clear-change-data`, full reset, rollback —
campaigns-admin.js :207/:234/:278) should publish `{action:'clear'}` on `spell-overlay-<campaign>` exactly
like the in-editor Clear All button does (that one live-retires every mounted tab via the SSE clear event —
re-proven working this run), so mounted tabs retire ghost geometry immediately.

## Actual behavior

Server wipes the Map silently; mounted tabs never re-probe (the overlay hook only fetches on campaign
mount) and keep painting phantom AoE zones with no feedback of any kind (zero console, zero toast).

## Likely location

Confident: `server/routes/campaigns-admin.js` — the three `spellOverlayData.delete(campaign)` call sites
publish nothing about overlays (only `publish('change-…-combatSummary', null)`). Contrast
`server/routes/spell-overlay.js:56` which DOES `publish(\`spell-overlay-${campaign}\`, {action,…})`.
Client `src/components/map/hooks/useSpellOverlay.js:118-125` already handles the `clear` action — the fix
is server-side only.

## Suggested fix

At each admin wipe that deletes `spellOverlayData` for a campaign, add
`publish(\`spell-overlay-${campaign}\`, { action: 'clear' }, campaign)` (before/after the delete — client
just empties state; it is idempotent). One line per lane, mirrors the combatSummary null-publish the same
routes already do. A stricter variant would additionally reconcile mount-time fetches (adopt [] from the
server instead of the `loaded.length &&` merge-only guard in `useSpellOverlay.js:27`), but the publish fix
closes the live ghost.

## Severity

Data integrity risk — GM-visible AoE zones that don't exist server-side; targeting/AoE flows silently
disagree with the map. Mitigated by requiring an Admin clear mid-session with map tabs open.

## Resolution

FIXED 2026-10-30. Diagnosis confirmed exactly as filed: the three `spellOverlayData.delete(campaign)`
wipe sites in `server/routes/campaigns-admin.js` (campaign DELETE :207, clear-change-data :234,
full-reset :278 — note: "rollback" in the original write-up is actually the campaign-DELETE lane;
`admin/rollback` never touches `spellOverlayData`, which is in-memory-only and survives rollbacks by
construction) published nothing about overlays, while `spell-overlay.js:56` (in-editor Clear All and
every overlay op) publishes on `spell-overlay-<campaign>` for every action.

**Fix (server-side only, as predicted):** each wipe lane now also
`publish(`spell-overlay-${campaign}`, { action: 'clear' }, campaign)` — one line per lane, mirroring
the `change-…-combatSummary` null-publish the same routes already do. Client needed zero changes:
`useSpellOverlay.js` `handleSSEEvent` already consumes `action:'clear'` and empties state (idempotent,
equality-guarded — no SSE loop). The stricter mount-fetch reconciliation (`loaded.length &&` merge-only
guard) was left as-is; the publish closes the live ghost.

**Files changed:**
- `server/routes/campaigns-admin.js` — +3 publish lines (delete / clear-change-data / full-reset lanes)
- `server/routes/campaigns-admin-overlay-clear-broadcast.test.js` — NEW regression test pinning
  `publish('spell-overlay-test-campaign', { action: 'clear' }, 'test-campaign')` + memory-wipe on all
  three routes (harness mirrors `campaigns-admin-full-reset.test.js`)

**Verification:**
- Live repro BEFORE fix (two Battle Arena map-editor tabs, zero reloads): cone placed on A →
  `g.spell-overlay-group` 1/1 both tabs, server 1 → `POST admin/clear-change-data` → server
  `{"overlays":[]}` but ghostA 1, ghostB 1 (bug confirmed).
- Live re-verify AFTER fix (server restarted, tabs rebuilt fresh): same steps → after the admin clear
  both mounted tabs read `g.spell-overlay-group` **0** within one SSE beat, `__noReloadB` intact
  (zero reloads). Exact Expected behavior achieved.
- Adjacent sanity all re-proven live: overlay add (sphere click-placement) cross-tab mirrors; handle
  drag-move updates A (cx 300→380), server `startGridX 9/y 11`, and B live-mirrors; in-editor
  Clear All retires both tabs + server [].
- Tests: `npx vitest run server/routes/campaigns-admin-overlay-clear-broadcast.test.js` 3/3; full
  `server/routes` folder 77 files / 1278 tests pass; `src/components/map/hooks` + changeData +
  sseHandlers-overlay 19 files / 326 tests pass. `npm run lint` zero warnings.
- Cleanup: admin cleared change-data + log for test-campaign; `GET /spell-overlay?campaign=test-campaign`
  → `{"overlays":[]}`, change-data `{}`, log `[]`.
