# Bug: Campaign log POST accepts arbitrary entry shapes — unknown `type` rows persist + broadcast but are silently unrenderable, and client can override the server `timestamp`

## Summary
`POST /api/campaigns/:campaign/log` blindly spreads the request body into a log entry (`{id, timestamp, ...entry}`), so a client-supplied `type` outside the renderer registry (e.g. `gm-note`) is persisted and SSE-broadcast, yet the Log view renders NOTHING for it (per-entry component lookup returns undefined). A client can also override `timestamp` (the spread comes after the server's `Date.now()`). The result is invisible ghost rows in the shared audit log.

## Steps to reproduce
1. In `test-campaign`, open the Log view in one tab (marker planted to prove zero reloads).
2. From any client, `POST /api/campaigns/test-campaign/log` with body `{"message":"RUNQ SSE PROBE NOTE","type":"gm-note"}` → 200, the entry is echoed back.
3. Observe the open Log view: no new row appears, no console error, no toast. (Control: a note posted through the composer UI — `type:"note"` — mirrored live on the second tab within ~1 s, zero reload.)
4. GET `/api/campaigns/test-campaign/log` → the entry IS stored (`{"id":"…","timestamp":…,"message":"RUNQ SSE PROBE NOTE","type":"gm-note"}`).
5. Hard-reload and reopen the Log view → still not rendered (4 stored rows, only 3 visible components; the GM-note is permanently invisible in-app).
6. (Code-read leg) POST `{"type":"note","message":"x","timestamp":1}` — the spread ordering means the client `timestamp:1` wins over the server `Date.now()`.

## Expected behavior
Either the API validates `type` against the known log-entry registry (400 on unknown types / rejects client-supplied `id`/`timestamp`), or the Log view renders unknown types with a generic fallback row. Shared audit-trail data that is written but unrenderable is the worst middle ground.

## Actual behavior
Ghost entry persisted + broadcast to every SSE subscriber, invisible in every surface, no error anywhere. Verified live: disk/GET shows `RUNQ SSE PROBE NOTE` (type `gm-note`) while both tabs and a post-reload view render nothing for it.

## Likely location
Confident, code-read matches live behavior:
- `server/routes/log.js:55-67` — `addEntry` spreads `...entry` AFTER `id`/`timestamp` (client can override both) with zero validation; POST route at :76 passes `req.body` straight through.
- `src/components/log/Log.jsx:25-46` — `ENTRY_COMPONENTS` whitelist (no fallback branch for unknown types; `const EntryComponent = ENTRY_COMPONENTS[entry.type]` at :52 renders nothing when undefined).

## Suggested fix
Minimal: in `addEntry`, force `id`/`timestamp` to server values (spread `entry` FIRST), and either 400 on unknown types or keep accepting but add a generic fallback renderer in Log.jsx for unregistered types (show type + JSON message excerpt) so nothing is silently invisible. Add a route test pinning timestamp-override rejection.

## Severity
Minor UX issue with a data-integrity edge — invisible log rows mislead anyone auditing the campaign log ("the note was posted, it's just not there"), and the client-controlled timestamp lets a writer forge entry ordering; no crash and the GM composer lane itself is healthy.

## Resolution
**FIXED.** Reproduced live first (both legs), exactly as described: `gm-note` POST → 200 + persisted + SSE-broadcast, invisible in a mounted Log view AND after reload (marker survived, zero reloads); `{"id":"FORGED-ID","timestamp":1}` POST → echo + live row rendered at Dec 31 1969 07:00:00 PM (client values won).

Root cause matched the "Likely location" (spread order in `addEntry`; no fallback branch in `LogEntryRenderer`). Code investigation widened the blast radius: legit SERVER-side producers already emit types missing from the client `ENTRY_COMPONENTS` registry (`enforcement_denied` from `campaigns-changedata.js:211`, `ai_director`/`ai_ruling` from `campaigns-ai.js`) — so those audit rows were ALREADY ghosting, which rules out strict 400-against-registry validation (would break them) and makes the generic-fallback renderer the correct leg.

Fix (client fallback renderer + server-controlled audit fields):
- `server/routes/log.js` — `addEntry` now spreads `entry` FIRST and forces `id: guid.create()` / `timestamp: Date.now()` after, so client-supplied id/timestamp can never forge identity or ordering. Verified safe: all internal callers (roll/change-data/ai) omit both fields; client producers pass only `Date.now()` (server value ~identical).
- `src/components/log/LogGenericEntry.jsx` (NEW) — `GenericEntry` fallback leaf: type label (`formatEntryTypeLabel`) + best human-readable text (`message` → `description` → `noteText` → JSON excerpt minus `id`), reusing note-row layout.
- `src/components/log/Log.jsx` — `LogEntryRenderer` falls back to `GenericEntry` for unregistered/absent types; ALSO fixed an adjacent latent crash the new test caught: `typeOptions` included `undefined` for type-less entries → `formatEntryTypeLabel(undefined)` threw in the filter bar; now `.filter(Boolean)` mirroring the sibling `characterOptions` pattern.
- `src/components/log/Log.css` — scoped `.log-generic` type-badge + text styles (mirrors `.log-note .log-note-text`).
- `src/components/log/LogEntryRendering.test.jsx` — the old lane pinned the buggy behavior ("unknown types render an honest blank wrapper"); rewritten to pin the generic-row routing.
- Tests: `server/routes/log.test.js` — the existing 808-line suite contained TWO pins of the buggy behavior ("allow entry to provide its own timestamp/id"); flipped to pin the fixed behavior (server values win) and added a cache+SSE-leg test (forged fields absent from stored entry and broadcast). `src/components/log/LogGeneric.test.jsx` (NEW) — leaf bytes: label, message/description/JSON-excerpt legs, type-less → Unknown.

Deliberately NOT done: server 400 on unknown types (would regress `enforcement_denied`/`ai_director`/`ai_ruling` + 200+ client automation producers; can't confidently enumerate all producer types) — fallback render satisfies the Expected "or" branch. Pre-fix stored rows keep their stale timestamps (no retroactive rewrite of audit data).

Verification:
- Vitest: `server/routes/log.test.js` 46/46 (43 pre-existing + flipped legacy pins + new cache/SSE leg), client log lane 8/8; combined touched-area run (`src/components/log` + `server/routes` + `logService` + `useLog`) 1597/1597 across 94 files. `npm run lint` zero warnings; `no-timers-guard` OK.
- Live re-run in test-campaign (API-only restart per playbook §LAN-probe recipe to load the server change; lock re-proven `campaignLocked:true/test-campaign` after — note: dev API is plain `node server.js`, no hot-reload, so server-route fixes REQUIRE this restart step): stored ghost now renders after reload as `Gm-note` generic row with its message; fresh `gm-note` POST mirrors LIVE into the mounted view as a readable generic row (zero reload, marker alive); fresh forged `{timestamp:1,id:'FORGED-AGAIN'}` POST renders at CURRENT time with a server UUID. Sanity: composer note still renders with text and mirrors live to a passive second tab; textarea clears.
- Cleanup: all tabs closed → admin clear-change-data + clear-log → GET-verified `{}` / `[]`.
