# bug-ct-editor-concurrent-save-silently-drops-other-tabs-edits

## Summary
Two tabs open on the same campaign edit the same `.ct-*` entity (e.g. an NPC). Tab B saves its field; Tab A — whose form was populated BEFORE B's save — then saves, and B's persisted edit is silently overwritten. There is no conflict detection, no freshness refresh of the open editor, and no feedback in either tab. Because the underlying save lane (`server/utils/jsonEntityCrud.js`) POSTs the ENTIRE entity array, a stale tab can also drop entities another tab created after the stale tab's list was fetched.

## Steps to reproduce
1. In `test-campaign`, create/rely on an NPC (e.g. "Marta Copperkettle") via NPCs page.
2. Tab A: NPCs page → select Marta → type `TAB-A-EDIT-DESC` into "Additional notes…" (do NOT save).
3. Tab B (new browser tab, same campaign): NPCs page → select Marta (form loads with notes empty) → type `TAB-B-EDIT-NOTES` into the same field → click Save (`.ct-btn-primary`). Verify persisted: `GET /api/campaigns/test-campaign/npcs` → notes == `TAB-B-EDIT-NOTES`.
4. Back to Tab A (never reloaded — verified via a planted `window.__tab='A'` marker): additionally type `TAB-A-EDIT-APPEARANCE` into "Physical description…", then click Save.
5. `GET /api/campaigns/test-campaign/npcs` (cache: reload).

## Expected behavior
Either B's saved edit survives (merge/per-field write), or at least one tab shows a conflict/stale-data warning ("this NPC was modified elsewhere — reload before saving").

## Actual behavior
Disk shows `notes: "TAB-A-EDIT-DESC"`, `appearance: "TAB-A-EDIT-APPEARANCE"`. B's persisted notes are gone. No toast, no error, no console message, no SSE-driven refresh of A's open editor fields (A's editor still showed its own stale content when B's save landed — the `npcs-list-<campaign>` broadcast updates the LIST but the open editor form is never re-based). Proven live 2026-10-27 with the exact values above.

## Likely location
- `server/utils/jsonEntityCrud.js` POST `/api/campaigns/:campaign/[entityName]` — "overwrite entire array" semantics (writeFileSync of the client-sent array, no version/ETag/updatedAt guard). Shared factory → same exposure for every consumer: npcs, factions, quests, settlements, sessions, notes (whatever uses createJsonEntityRouter).
- Client editors (e.g. `src/components/npcs/`) build the save payload from their mount-time snapshot and POST the whole list; the live-broadcast subscription updates the list pane but not the open form, and does not mark it dirty/stale.
Confidence: high on the server lane (read the route); medium on exactly which client component composes the whole-array payload (did not read the NPC client save call, but disk effect matches whole-array overwrite semantics).

## Suggested fix
Cheapest honest mitigation: refuse blind overwrites. Add an `updatedAt`/rev stamp per entity (or per file) returned by GET and required in the save; on mismatch return 409 and have the editor surface "changed elsewhere — reload". Alternative lane: switch saves to per-entity PUT (`/npcs/:id` exists for GET/DELETE already) so only the touched entity is written, and re-base any open editor whose entity is touched by an SSE `action:'replaced'`/`'updated'` broadcast when the form is not dirty. A full per-field merge is NOT needed — just don't let one tab's save rewrite rows it never read.

## Severity
Data integrity risk — a confirmed silent loss of already-persisted user data on any `.ct-*` entity lane when two tabs/GM sessions overlap. Uncommon in single-tab use, but campaigns are multi-session by design (SSE sync exists precisely for that), and there is zero feedback when it bites.
