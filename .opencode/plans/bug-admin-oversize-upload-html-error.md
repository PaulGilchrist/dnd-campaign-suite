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
