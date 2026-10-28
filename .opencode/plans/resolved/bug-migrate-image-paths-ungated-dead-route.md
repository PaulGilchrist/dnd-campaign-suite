# POST /api/campaigns/migrate-image-paths bulk-rewrites EVERY campaign's files with no host gate and no caller

## Summary
`server/routes/campaigns-admin.js:51` defines `POST /api/campaigns/migrate-image-paths`, which walks `public/campaigns/` and **write-rewrites every character JSON and `data/npcs.json` in every campaign** (5 campaigns on this machine, 4 of them production) to convert legacy absolute `imagePath` fields to relative. Like the campaign create/rename/delete trio fixed in `654b9ee2a`, it lacks the `isLocalhost` 403 guard that all nine other admin lanes in the same file carry. Worse: **no client in the repo ever calls it** (grep of `src/` and `public/` is zero) — it is a dead one-time migration endpoint whose auth bypass is pure attack surface. Under dev:locked it happens to be blocked (the middleware resolves first-segment target `migrate-image-paths` ≠ locked name → 403), which is exactly how this gap stayed hidden in day-to-day dev — same masking pattern as the trio.

## Steps to reproduce
Disk-inert probe recipe (mirrors run-P authority probing — nothing must actually migrate; verify `git status public/` stays clean and byte-diff one file before/after):
1. Start the app unlocked: `PORT=8081 node server.js` (or stop the lock; `GET /api/server-config` → `campaignLocked:false`).
2. From the LAN host: `curl -s --max-time 5 -X POST http://<LAN-IP>:8081/api/campaigns/migrate-image-paths` → **200 `{"message":"Migration complete. Migrated N imagePath fields."}`** — the route BODY executed for a network client, rewriting files across ALL campaigns including production. (If N=0 because data is already migrated, the 200 + route execution is still the proof; the write path is live whenever any legacy value exists.)
3. Control on the same socket: `POST …/test-campaign/admin/clear-change-data` → **403 `Only available on localhost`** — the gate exists in this exact file (:46) and is simply absent here.
4. Contrast with `CAMPAIGN_LOCK` set (dev:locked): the middleware (server.js :38-47) resolves the first path segment after `/api/campaigns` as the target → `migrate-image-paths` ≠ locked name → 403 `Campaign locked… denied`. So under lock the route is masked by a check that was never designed for it; the real host gate is simply missing.

## Expected behavior
Non-localhost clients receive 403 from this route, exactly as every sibling admin lane (`clear-change-data` :250ish, snapshot, rollback, upload, download, full-reset, upload-inspect, and now create/rename/delete). Preferably the dead endpoint is removed entirely (see Suggested fix).

## Actual behavior
Any LAN device can trigger a recursive multi-campaign file rewrite with one unauthenticated POST. Practical blast radius today is limited (the transform is idempotent and only rewrites values containing `campaigns/`), but it is a GM-only bulk-write exposed to every connected player, and it corrupts the changeData ~10s-debounce view by editing campaign files on disk behind the server's back.

## Likely location
Confident (verified in current snapshot 2026-10-28):
- `server/routes/campaigns-admin.js:51` — handler head has no `isLocalhost(req)` guard; `isLocalhost` is defined at :46 in the same file.
- Zero callers: `grep -rn "migrate-image-paths" src/ public/` → empty. `grep server/` hits only the route definition itself (no test references either).

## Suggested fix
Decision for Paul first — two acceptable resolutions:
1. **Delete the endpoint** (recommended): it is a completed one-time migration with no consumer; removing it also removes the auth hole. Check `docs/` for any runbook that references it before deleting.
2. Keep + gate: add `if (!isLocalhost(req)) return res.status(403).json({ error: 'Only available on localhost' });` at the head, byte-identical to the sibling guard added to create/rename/delete in `654b9ee2a`, and pin it with a supertest case mirroring `server/routes/campaigns-admin-crud-localhost-guard.test.js` (non-localhost Host → 403 + zero file writes; localhost → behavior unchanged).

## Severity
**Security (authority gap) / dead code** — unauthenticated cross-campaign bulk write reachable from any LAN device when unlocked; under lock it is only accidentally masked by the CAMPAIGN_LOCK first-segment check, not by any designed gate. Low practical data risk today (idempotent narrow transform), high principle-of-least-authority violation, zero legitimate callers.

## Resolution (2026-10-28 — FIXED, endpoint deleted)

**Owner decision:** Paul chose option 1 — delete the endpoint (completed one-time migration, zero callers; removal also removes the auth hole).

### Dead-code verification (grep evidence)
`grep -rn "migrate-image-paths" src/ public/ docs/ server/` before the fix:
- `src/` + `public/`: **zero** — no client callers.
- `docs/`: two hits, both GAP REPORTS not runbooks (safe to delete): `docs/test-setup-playbook.md:1420` ("UNGATED ROUTES still open … need owner adjudication") and `docs/architecture.md:278` (security-gaps drift list). Neither depends on the route existing; both updated in this pass.
- `server/`: the route itself + `server/routes/campaigns-admin-migrate.test.js` — **correction to this file's claim "no test references either"**: a 10-case unit file existed, testing ONLY the deleted endpoint. Isolated-router supertest mounts were the one place the foreign-Host 200 gap actually reproduced.

### Step-2 live repro nuance (route was ALSO shadowed full-stack)
On a throwaway unlocked instance (`PORT=8081`, LAN origin `192.168.0.239`):
- LAN `POST /api/campaigns/migrate-image-paths` → **403 `Access denied: GM-only feature`** (NOT the 200 this file predicted): `campaigns-character.js:278` `POST /api/campaigns/:campaign` (character-create, `refuseUnlessGm`) is mounted at server.js **:164**, BEFORE `campaignsAdmin` (:181), so it captures `migrate-image-paths` as `:campaign`. Log line proves attribution: `[campaigns-character] BLOCKED non-localhost POST /api/campaigns/migrate-image-paths — GM-only`.
- localhost same POST → `campaigns-character.js:282` (400/500 char-create body), never a `Migration complete` message (grep count 0 in both instance logs).
- Locked `:80`: same POST → 403 `Campaign locked… denied` (middleware mask, as documented).
So the practical LAN bulk-write hole was doubly masked in the full-stack server; the authority gap was real only in isolated router mounts — and the route was dead in every configuration. Deletion verdict unchanged.

### Changes
- `server/routes/campaigns-admin.js` — deleted the route handler (:50–98), replaced with a 4-line tombstone comment. Helper hygiene: the handler composed its own `process.cwd()` paths and used no private helpers — nothing else became dead (`renameImagePathsIn*`/`isCharacterJsonFile` belong to the rename/upload lanes and remain).
- `server/routes/campaigns-admin-migrate.test.js` — rewritten in place (appropriately-named existing file; no file deletion) into the regression pin, mirroring `campaigns-admin-crud-localhost-guard.test.js` conventions: localhost POST → **404** + zero fs activity; foreign-Host POST → **404** (was the 200-body-executed gap in isolated mounts); sibling `clear-change-data` LAN → 403 unchanged; sibling localhost snapshots → 200 unchanged.
- `docs/test-setup-playbook.md` :1420 + `docs/architecture.md` :278/:289 — surgical updates marking the route deleted (and "admin migrate" path-composition reference corrected to the still-true admin clear/reset lanes).

### Verification
- Tests: pin file 4/4 green → `server/routes` folder **71 files / 1242 tests passed** → full `npm run test:run` green (see run report) → `npm run lint` zero warnings.
- Live post-fix: throwaway (new code, unlocked): localhost migrate POST → 400 shadow (not Migration), LAN → 403 GM-only shadow, localhost snapshots 200, LAN clear 403; locked `:80`: snapshots 200 + log 200 + `campaignLocked:true`, Vite :5173 200; throwaway killed, `lsof -ti :8081` empty.
- Disk-inert: all 92 campaign JSONs byte-identical (md5 ladder before/after), `git status public/campaigns` clean, zero `Migration complete` log lines across both instances; no campaign data was ever migrated/rewritten by this session.
