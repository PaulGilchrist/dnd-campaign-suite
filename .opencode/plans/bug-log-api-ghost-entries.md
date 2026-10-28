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
