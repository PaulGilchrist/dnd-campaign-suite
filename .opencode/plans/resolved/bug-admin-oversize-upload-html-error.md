# Oversized campaign upload returns an HTML 500 with a stack trace; UI then reports a misleading "Campaign has been rolled back" parse error

## Summary
`POST /api/campaigns/:campaign/admin/upload` has a 100 MB multer limit, but a larger file fails with a plain **Express HTML error page** (`MulterError: File too large`, complete with absolute server filesystem paths + node_modules stack) instead of the JSON shape every other admin error uses. The client (`CampaignAdmin.jsx`) calls `await res.json()` before checking `res.ok`, so it throws on the HTML, and the user gets an alert saying **"Upload failed. Campaign has been rolled back to the previous state. Error: Unexpected token '<', "<!DOCTYPE "... is not valid JSON"** — a JSON-parse complaint plus a rollback claim for a rollback that never happened (the request died before any snapshot/clear ran, so nothing needed rolling back).

## Steps to reproduce
Proven live 2026-10-28 (run O), test-campaign, dev:locked:

1. `mkfile -n 101m /tmp/toobig.zip`
2. `curl -s -o resp.html -w "HTTP %{http_code}" -X POST -F "file=@/tmp/toobig.zip" http://localhost/api/campaigns/test-campaign/admin/upload`
   → `HTTP 500`, body = `<!DOCTYPE html>...MulterError: File too large<br> at abortWithCode (/Users/<user>/Source/dnd-campaign-suite/node_modules/multer/lib/make-middleware.js:107:22)...`
3. Count files in `public/campaigns/.snapshots/` before/after → unchanged (no safety snapshot; also no mutation — campaign data intact, GET /npcs verified).
4. UI angle (in-page fetch with a 101 MB File via the browser): response `status:500`, `content-type: text/html; charset=utf-8`; `res.json()` throws `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. In the real confirm-upload flow this lands in `handleUpload`'s catch → status line shows the parse error and an alert claims the campaign was rolled back.

## Expected behavior
- Server: 413 (or 400) with JSON `{ error: 'File too large (limit 100 MB)' }` — no stack trace or filesystem paths in any response body.
- Client: user sees "File too large" and NO false rollback claim (nothing was replaced).

## Actual behavior
- HTTP 500, `text/html`, leaked stack (`/Users/paulgilchrist/...` paths visible — localhost-only endpoint, but still needless disclosure).
- User-facing message is a raw JSON parse error + "Campaign has been rolled back to the previous state" (false: no snapshot, no clear, no restore ran).

## Likely location
Confident:
- `server/routes/campaigns-admin.js:16` — `multer(...).single('file')` middleware errors bypass the route's try/catch and hit the default Express error handler (no MulterError-specific handler; `asyncHandler` only wraps the body, not middleware errors).
- `src/components/campaign-admin/CampaignAdmin.jsx` `handleUpload` onConfirm (~line 405-420): `await res.json()` unguarded before the `res.ok` check; the catch branch hardcodes the "has been rolled back" text for ALL failures.

## Suggested fix
- Server: wrap the upload route to catch `err instanceof MulterError` (or add an error middleware after this router) → `res.status(413).json({ error: 'File too large (limit 100 MB)' })`. Also configure a production error handler that never emits stacks for `/api/`.
- Client: `const data = res.headers.get('content-type')?.includes('json') ? await res.json().catch(()=>({error:'Server returned a non-JSON error ('+res.status+')'})) : {error: await res.text()...}` and only claim rollback for responses that actually came from the route (i.e. after the snapshot step — the 500-with-JSON path).

## Severity
**Minor UX issue** (with a small info-disclosure smell) — no data is harmed: oversized uploads fail safely before any mutation; but the feedback is wrong on both ends and could panic a GM into thinking a restore just happened.

## Resolution
**FIXED 2026-10-28 (bugfix subagent run).** Root cause confirmed exactly as the "Likely location" predicted:

1. **Server** — `upload.single('file')` at `server/routes/campaigns-admin.js` passed `MulterError: File too large` to `next()` *before the route body ran*, so it bypassed the route's try/catch and hit Express's default HTML error handler (stack trace + absolute paths).
2. **Client** — `CampaignAdmin.jsx` `handleUpload` called `await res.json()` on the HTML body *before* the `res.ok` check; the throw landed in the catch that hardcoded the "Campaign has been rolled back" alert for ALL failures.

Reproduced live pre-fix (test-campaign, dev:locked): curl 101 MB sparse file → `HTTP 500, text/html` with MulterError stack; UI `setInputFiles` + confirm → native alert `Upload failed. Campaign has been rolled back to the previous state. … Unexpected token '<', "<!DOCTYPE "… is not valid JSON`; snapshot dir unchanged 11→11 and npcs intact (no snapshot/mutation — proving the rollback claim was false).

### Fix
- `server/routes/campaigns-admin.js`: new `uploadWithJsonErrors` wrapper around `upload.single('file')` (swapped into the route). `LIMIT_FILE_SIZE` → **413 JSON `{error:'File too large (limit 100 MB)'}`** (message derived from the limit constant); other `MulterError`s → 400 JSON with the static library message; non-Multer middleware failures → 400 JSON generic message (internals hidden); remote host keeps the 403 localhost gate. Error detail goes to `console.error` only — no stack/paths ever leave the server.
- `src/components/campaign-admin/CampaignAdmin.jsx`:
  - Up-front size pre-check (`file.size > 100 MB` → red status line, zero network) — also closes the run-O backlog item "No client-side size pre-check on upload".
  - Defensive parse in `onConfirm`: content-type check before `res.json()` (plus `.catch`), so non-JSON error pages become `"Server returned a non-JSON error response (HTTP n)"` instead of a thrown SyntaxError.
  - Rollback is claimed **only** for `status === 500 && isJson` (the route-body path that ran after the safety snapshot and self-restores). Pre-route rejections alert `"Upload failed before any campaign data was replaced."`; transport errors alert `"The request did not complete, so no changes were confirmed."` — no false restores anywhere.

### Files changed
- `server/routes/campaigns-admin.js`
- `src/components/campaign-admin/CampaignAdmin.jsx`
- `src/components/campaign-admin/CampaignAdmin.rollback-upload.test.jsx` (mock `jsonResponse` now carries status + content-type; failure-outcome table extended — see below)
- `server/routes/campaigns-admin-upload-oversize.test.js` (NEW)

### Regression tests
- **Server (new, 6 tests):** MulterError LIMIT_FILE_SIZE → 413 exact JSON shape + body asserted free of `MulterError|node_modules|<!DOCTYPE|at fn (|/Users/`; `LIMIT_UNEXPECTED_FILE` → 400 static message; non-Multer middleware error → 400 generic, secret path/boundary text not leaked; remote + oversize → 403; clean no-file pass-through → 400 `No file uploaded`; valid-file pass-through → 200 `Upload complete` + safety snapshot (the lane the sibling snapshots file notes it cannot exercise with mocked multer — solved by injecting `req._multerFile` in a pre-middleware).
- **Client (updated sibling file, 18 tests):** outcome table now locks: 500-JSON → rollback claim kept (with `status: 500` made explicit in the mock); 413 JSON → honest status + NO rollback claim; HTML-500 non-JSON → `"Server returned a non-JSON error response (HTTP 500)"` + NO rollback claim + no reload; network error → "no changes were confirmed" wording; plus the 101 MB pre-check test (status `File too large (limit 100 MB)`, no modal, zero POSTs, input cleared) via `Object.defineProperty(file,'size',…)`.

### Verification evidence
- Targeted: `campaigns-admin-upload-oversize.test.js` 6/6; `CampaignAdmin.rollback-upload.test.jsx` 18/18; both folders `server/routes` + `campaign-admin`: **76 files / 1283 tests passed**. `npm run lint`: zero warnings. Full suite `npm run test:run`: **2858 files / 31766 passed + 3 expected-fail, 0 failures**.
- Live re-verify post-fix (API restarted with `CAMPAIGN_LOCK=test-campaign`, lock confirmed via `/api/server-config`): curl 101 MB → **`HTTP 413, application/json`, body `{"error":"File too large (limit 100 MB)"}`**, grep 0 hits for stack/path patterns, snapshots 11→11. UI: picking the 101 MB file shows `.admin-status--error "File too large (limit 100 MB)"` with **no confirm modal and zero upload POSTs**. Sanity lane re-proven live: corrupt `.zip` still runs the full route body → safety snapshot created → extract-zip throws → server 500 JSON `{error,details}` → alert "Campaign has been rolled back…" **with details** (genuine post-snapshot rollback, behavior preserved) → disk intact (Marta present), snapshots back to 11 after prune. Post-run console: only my own deliberate 500 error line; after close 0 errors / 0 warnings.
- Cleanup: 101 MB + corrupt temp files deleted; `clear-change-data` + `clear-log` POSTed, GET-verified `{}` / `[]` from closed-tab quiet.

