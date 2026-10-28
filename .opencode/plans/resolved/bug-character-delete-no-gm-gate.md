# DELETE /api/campaigns/:campaign/:file (character + image unlink) has no GM gate — any LAN player can irreversibly delete any character while create is refuseUnlessGm-gated

## Summary
The character DELETE route in `server/routes/campaigns-character.js:186` executes for **any** client: it `fs.unlinkSync`s the character JSON, deletes the associated portrait image, strips its change-data key, and broadcasts `character-delete-` to every connected tab. Its create-sibling `POST /api/campaigns/:campaign` (:218-219) carries `refuseUnlessGm` — added deliberately in the `bug-player-view-can-create-characters` fix, with a file-header comment (:12-16) declaring "character creation is a GM-only write — network clients get a read-only" lane. The delete route, which is strictly **more destructive** than create, was left unguarded. The UI hides the Delete button from network clients (Sidebar.jsx `isLocalhost` render gate) — presentation, not authority. Same authority model as the campaign create/rename/delete trio fixed in `654b9ee2a`: every GM-only write route needs the server seam.

## Steps to reproduce
Disk-inert-first recipe (the destructive leg must ONLY be fired against a throwaway fixture inside **test-campaign**):
1. Start unlocked: `PORT=8081 node server.js` (main stack occupies :80/:5173 — never kill those), or probe the running instance; `GET /api/server-config` → `campaignLocked:false`.
2. `curl -s --max-time 5 -X DELETE http://<LAN-IP>:8081/api/campaigns/test-campaign/__NoSuch_Char__.json` → **404 `Character file not found`** — the route BODY executed for a network client (a gated route would answer 403 before the existence check). Control on the same socket: non-localhost `POST /api/campaigns/test-campaign` (create) → **403 `Access denied: GM-only feature`**.
3. Destructive leg (test-campaign only): API-create a minimal fixture character (must carry `inventory` arrays — playbook pitfall), then from the LAN host `DELETE …/test-campaign/<Fixture>.json` → **200 `Character deleted successfully`**, file unlinked, `character-delete-` SSE frame broadcast to all tabs — a network client irreversibly destroyed a character with no confirm and no snapshot.
4. Under dev:locked, deletes targeting `test-campaign` ALSO pass the CAMPAIGN_LOCK middleware (source param == locked name), so even the dev lock never masks this lane for the protected campaign itself.

## Expected behavior
Non-localhost clients receive 403 from character delete, exactly as character create already does (`refuseUnlessGm`, :19-23, logs `[campaigns-character] BLOCKED non-localhost …`), matching the GM-model comment at the top of the file and the campaign-trio guards from `654b9ee2a`.

## Actual behavior
Any LAN device can delete any character from any campaign (production included, when unlocked) with one unauthenticated `curl`; the wipe is silent, immediate, broadcast to every tab, and unrecoverable except via the Admin snapshot zip.

## Likely location
Confident (verified in current snapshot 2026-10-28):
- `server/routes/campaigns-character.js:186-215` — handler head goes straight to `fs` existence check; no `refuseUnlessGm` call. Guard machinery already in file: `isLocalhost` :17, `refuseUnlessGm` :19, used at :219 (create) only.
- Secondary (needs Paul's adjudication before touching): `PUT /api/campaigns/:campaign/:file` (:84, character file update / rename with image move) is also ungated — but the runtime-sync lane legitimately needs player writes to their OWN character, and it is unclear whether the `.json` PUT lane is used by player clients or only the GM edit flow. If players must keep it, consider gating to self-name writes only (`character.name` must equal the loaded file's name from disk); if it's GM-only like create, add `refuseUnlessGm`.

## Suggested fix
Add `if (!refuseUnlessGm(req, res)) return;` as the first line of the DELETE handler (mirror :219 byte-for-byte — do NOT invent a new helper). Adjudicate the PUT :84 lane separately (Secondary). Add supertest cases mirroring `server/routes/campaigns-admin-crud-localhost-guard.test.js`: non-localhost Host → 403 + file still on disk; localhost → delete still works. Check the sidebar Delete button's own client path still succeeds (it runs on localhost).

## Severity
**Data integrity risk (security)** — one unauthenticated LAN request irreversibly deletes a production character (file + portrait + change-data), the exact class fixed for campaigns in `654b9ee2a`; GM-only authority, exposed to every connected player.

## Resolution
**FIX: FIXED (2026-10-28 run S).**

**What was wrong:** `DELETE /api/campaigns/:campaign/:file` (character JSON + portrait unlink + change-data strip + `character-delete-` broadcast) ran its route body for ANY client, while its create-sibling POST carried `refuseUnlessGm`. Reproduced live pre-fix on a throwaway unlocked instance (`PORT=8081`): LAN-origin `DELETE …/test-campaign/__NoSuch_Char__.json` → **404** `Character file not found` (body executed; a gated route answers 403 existence-blind) vs control `POST` create on the same socket → 403.

**Files changed:**
- `server/routes/campaigns-character.js` — DELETE handler head now carries `if (!refuseUnlessGm(req, res)) return;` (byte-for-byte mirror of the create-POST guard, placed BEFORE the `fs.existsSync` existence check); file-header authority comment updated to declare create AND deletion GM-only; **PUT handler head carries the owner-adjudication comment**: the `.json` PUT lane is an INTENTIONAL non-GM write (players legitimately write their own character file through it) — no gate added, documented for auditability per Paul's decision "Keep open — document".
- `server/routes/campaigns-character-delete-localhost-guard.test.js` — NEW regression file (mirrors `campaigns-admin-crud-localhost-guard.test.js` / `campaigns-character-localhost-create.test.js` conventions): 3 foreign-Hosts × DELETE existing char → 403 + file/image/change-data untouched + no broadcast; existence-blind 403 on a missing file (403-before-404 ordering pin); localhost 127.0.0.1 DELETE → 200 + unlink + image + `removeChangeDataKey` + broadcast; localhost missing-file still 404; LAN GET read lane unchanged 200. 8/8 green.
- `server/routes/campaigns-character-localhost-create.test.js` — stale scope-pin comment/title ("GET/PUT/DELETE … stay reachable from network") corrected to read-lane-only (the test itself asserts only GET; behavior unchanged).

**Client-lane audit:** the only production caller of the character DELETE route is `campaignService.deleteCharacter` ← `useCharacterManagement.js:88` (sidebar/sheet Delete, localhost-GM-gated render) — no non-localhost client lane; automation/travel per-key DELETEs hit the change-data route (non-`.json` keys fall through this route's `next()`). No client breakage possible.

**Verification evidence:**
- Unit: new file 8/8; `server/routes` folder 70 files / 1242 tests green; full `npm run test:run` 2875 files / 31939 passed; `npm run lint` zero warnings.
- Live post-fix on throwaway :8081: LAN DELETE missing → 403; LAN DELETE of a real throwaway fixture → 403 + file byte-present; localhost create 201 → localhost DELETE 200 + file gone. Server log line `[campaigns-character] BLOCKED non-localhost DELETE … — GM-only` emitted.
- Main :80 restarted on new code: `campaignLocked:true` / `lockedCampaign:"test-campaign"`, LAN DELETE `__NoSuch_Char__.json` → 403, `/api/campaigns` listing OK.
- UI leg (:5173, test-campaign header verified every hop): sheet Delete of fixture `QA Uidel Gate` fired the NAMED confirm `Delete character "QA Uidel Gate"? This action is irreversible.` (verbatim), accept → file gone from disk, sidebar link live-removed, active sheet reassigned (AasimarTest); baseline 12 char files restored.
- Cleanup: all fixture chars deleted (disk-verified), throwaway :8081 killed, change-data `{}` + log `[]` GET-verified from closed-tab quiet, `git status public/campaigns` clean.
