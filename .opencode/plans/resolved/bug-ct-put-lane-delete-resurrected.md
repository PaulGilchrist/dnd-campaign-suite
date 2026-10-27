# `.ct-*` per-entity PUT lanes (NPCs, Sessions, Settlements) still resurrect a row deleted elsewhere

## Summary

Commit `48c8ca2d2` ("whole-array saves no longer revive rows deleted elsewhere") added a symmetric resurrection leg to `findConcurrentWrite`, but that function only runs on the **whole-array POST** path (Notes, and array-style lanes). The **per-entity PUT/upsert lanes** — NPCs (the primary `.ct-*` entity), Sessions, and Settlements — still silently re-create a row that another tab/session deleted: a stale echoed `updatedAt` on a row that is no longer on disk is treated as a brand-new *create* (HTTP 200) instead of a conflict, so the delete is undone with **zero feedback** to either session. This is the NPC-lane twin of the (now fixed for the array path) run-G resurrection bug.

## Steps to reproduce

All actions inside **test-campaign**. The two edits can be driven through the real UI (two tabs) or one tab + the API as the "other session"; the API form is deterministic and shown here.

1. Create a throwaway NPC (whole-array POST):
   `POST /api/campaigns/test-campaign/npcs` body `{ "npcs": [ ...current, { "name": "QA Resurrect", "race": "human", "classRole": "cultist", "notes": "doomed" } ] }` → 200.
2. `GET /api/campaigns/test-campaign/npcs` and capture the created row verbatim, including its numeric `updatedAt` stamp. This snapshot is what an open editor holds (call it tab A's stale copy).
3. Simulate another session deleting the NPC:
   `DELETE /api/campaigns/test-campaign/npcs/QA Resurrect` → 200. `GET` the list — the row is gone (`["Marta Copperkettle"]`).
4. Now save tab A's stale copy through the per-entity PUT (this is exactly what the NPCs editor "Save" posts — `saveNPC` → `PUT /npcs/:name`):
   `PUT /api/campaigns/test-campaign/npcs/QA Resurrect` body = the step‑2 snapshot (including the now-stale `updatedAt`).

Observed: **HTTP 200 `{ "success": true, "npc": { … "updatedAt": <new> } }`** and the NPC is back on disk (`GET` shows `QA Resurrect`, notes `"doomed"`).

Real-UI path: in two tabs, open the "QA Resurrect" NPC editor in tab A; delete that NPC from tab B; tab A's editor does **not** close (the delete SSE list broadcast is intentionally *skipped while a `.ct-*` editor is open* — `Npcs.jsx handleSSEEvent`, the `missedListBroadcast` guard added in `9cee7bfa2`), so tab A's Save fires the stale PUT above and silently revives the row.

## Expected behavior

The PUT should 409 with `{ conflict: true }` and the message `NPC "QA Resurrect" was created or deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.` — matching the whole-array lane's resurrection leg (`409 "…created or deleted…"`), which correctly refuses the identical scenario in the Notes lane (verified live in the same run). A row deleted elsewhere must not be resurrectable by a stale save.

## Actual behavior

HTTP **200** and the deleted NPC is fully restored. No conflict, no console error, no banner — the other session's delete is silently undone.

Confirmed live (test-campaign, 2026-10-27): created `QA Resurrect` (stamp 1793120992397) → DELETE (list `["Marta Copperkettle"]`) → stale `PUT /npcs/QA Resurrect` (echoing stamp 1793120992397) → **200 `{success:true, npc:{name:"QA Resurrect", notes:"doomed", updatedAt:1793120992403}}`**, `GET` list `["Marta Copperkettle","QA Resurrect"]`.

Control (proves the asymmetry, not a general miss): the identical "delete elsewhere then re-save the stale row" scenario through the Notes **whole-array POST** returns **409 `Faction/note "…" was created or deleted…` `conflict:true`** and disk stays inert (verified this run). Only the PUT lanes leak.

## Likely location

Confident. `server/routes/npcs.js` PUT handler (`existingIndex === -1 → npcs.push(stampedNpc)`), and the same shape in `server/routes/settlements.js` PUT (its comment even restricts it to the "modified" leg: *"a PUT to an unknown id-or-name is the route's upsert-create contract, not a stale-row signal"*) and `server/routes/sessions.js`. The shared discriminator `hasUpdateConflict(existing, incoming)` (`server/utils/jsonEntityCrud.js:48`) is null-safe (`existing && …`), so when `existing` is null (deleted elsewhere) it returns `false` and the stale create is allowed. `48c8ca2d2` only patched `findConcurrentWrite`, which is called by the array `POST` (jsonEntityCrud.js:160+), not by the per-entity PUT routes. The implementer noted this exact residual in `docs/test-setup-playbook.md` line 1189 ("per-entity PUT-upsert lanes … still recreate a row deleted elsewhere … One-line symmetric `existing===null && typeof incoming.updatedAt==='number' → 409` would close it").

## Suggested fix

In each per-entity PUT route, before `npcs.push(stampedNpc)` (i.e. in the `existingIndex === -1` branch), refuse when the incoming body echoes an `updatedAt` stamp the sender could only have read before the row was deleted — mirror the array lane's resurrection leg:

```js
// existingIndex === -1 (row absent from disk) but the sender echoed a stamp
// it could only have read while the row still existed -> a resurrection.
if (existingIndex === -1 && typeof updatedNpc.updatedAt === 'number') {
  return res.status(409).json(conflictErrorBody('NPC', decodedNpcName, 'created or deleted'));
}
```

A brand-new NPC (editor "New NPC" → POST per-entity, or a create whose body carries **no** `updatedAt` — the client never sets it, grep-confirmed) has `updatedAt === undefined`, so creates stay unaffected. Apply the same guard to `settlements.js` (using the resolved `existingIndex` from `resolveSettlementIndex`) and `sessions.js`. Consider extracting a shared `assertNoResurrection(existingIndex, incoming, noun, id)` helper in `jsonEntityCrud.js` so the array-POST and per-entity-PUT lanes can't drift apart again. Add a live two-tab NPC regression (open editor → delete elsewhere → save → assert 409, list refetches on close).

## Severity

**Data integrity risk.** A concurrent delete in the GM's primary entity lane (NPCs) is silently reversed by a second editor's save — the player/monster never actually leaves the campaign, and neither session is told. Same class as the array-lane bug that was deemed worth fixing in `48c8ca2d2`; leaving the PUT lanes unguarded defeats the intent of that fix and the "reload the list and re-apply" recovery guidance.

## Resolution

**FIXED (2026-10-27).** The diagnosis in this file was confirmed exactly: `hasUpdateConflict(existing, incoming)` is null-safe (`existing && …`), so a PUT whose row was deleted elsewhere (`existing === null`) fell straight through to the upsert-create leg and silently re-inserted it with a fresh stamp.

**What changed** (the array-POST and per-entity-PUT lanes now share ONE discriminator so they can never drift apart again):

- `server/utils/jsonEntityCrud.js` — extracted the exported `isResurrectionAttempt(existing, incoming, id)` predicate (row absent from disk + echoed numeric `updatedAt` + resolvable id); `findConcurrentWrite`'s resurrection leg now calls it (behavior-preserving refactor — the existing array-lane tests pin it); guard docstring updated to cover both lanes.
- `server/routes/npcs.js` — NPC PUT refuses with `409 conflictErrorBody('NPC', decodedNpcName, 'created or deleted')` when `isResurrectionAttempt(existingNpc, updatedNpc, …)`, placed after `hasUpdateConflict` and **before** `handleImageChange` so a rejected save is fully inert (no image side effects).
- `server/routes/sessions.js` — same guard (lowercase `session` noun matching the lane's existing casing; the case-inconsistency is a separate run-H backlog item).
- `server/routes/settlements.js` — same guard using the `resolveSettlementIndex`-resolved row (label prefers the body's display name); the stale comment claiming "only the 'modified' leg applies here" was removed. Genuine upsert-creates (client never sets `updatedAt`) keep flowing — proven live + unit-pinned.
- No dual-ruleset twin needed: this is the server CRUD layer, not a rules module. Factions/Quests/Notes have no per-entity PUT lanes (whole-array POST only); encounters/maps PUTs carry no `updatedAt` stamp contract.

**Regression tests** (all green):

- `server/routes/npcs.concurrent-save.test.js` — new `deleted-row resurrection guard` describe: exact repro (create → DELETE → stale-echo PUT → 409 verbatim copy + `conflict:true` + disk stays deleted + image ops zero), genuine unstamped create still 200, legacy un-stamped saves stay bootstrap-writable.
- `server/routes/sessions.concurrent-save.test.js` — NEW file mirroring the settlements harness: resurrection 409 (verbatim lowercase-`session` copy) + create unaffected + 'modified' leg intact.
- `server/routes/settlements.concurrent-save.test.js` — new resurrection describe: by-name and by-id stale PUTs both 409, disk inert; unstamped upsert-create still 200.
- `server/utils/jsonEntityCrud.resurrected-save.test.js` — `isResurrectionAttempt` truth-table describe locking the shared discriminator (and rejecting non-numeric stamps / null ids).
- Touched-lane run: `npx vitest run server/routes/{npcs,sessions,settlements}* server/utils/jsonEntityCrud*` → **17 files / 258 tests passed**. `npm run lint` → zero warnings.

**Live re-verification** (Playwright, test-campaign, real UI after API restart): created `QA Resurrect` via New-NPC form (PUT 200 — creates unaffected) → opened editor → `DELETE /npcs/QA Resurrect` as the other session (list `["Marta Copperkettle"]`) → editor Save → **409** `{ conflict: true, error: "NPC \"QA Resurrect\" was created or deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved." }` — verbatim Expected copy; modal + draft preserved; inline banner with the `Reload list` button; **disk stayed `["Marta Copperkettle"]`** (no resurrect, fully inert). Recovery leg: Reload list → modal closes, banner clears, list refetches to the true deleted state. Adjacent sanity: two legitimate back-to-back Marta saves (fresh stamp echoes) still 200; Marta notes baseline restored to `''`.

Residuals (pre-existing, out of scope): sessions/settlements 409 banners still lack the close-refetch `Reload list` machinery the NPC lane has (9cee7bfa2) — noted in the playbook conflict-banner row as a natural follow-up pair; the cross-lane conflict-noun casing inconsistency is the run-H backlog item.
