# Bug: LAN clients reaching the app through the Vite dev proxy bypass every hostname-based localhost guard (private notes leak)

### Summary
All server-side "GM-only" guards derive authority from `req.hostname === 'localhost'`. In dev, Vite proxies `/api`, `/subscribe`, `/spell-overlay` to Express with `changeOrigin: true`, which rewrites the Host header to `localhost` — so **any LAN client browsing `http://<lan-ip>:5173` is indistinguishable from the GM** at the server. Confirmed live: a private GM note is fully visible to a player tab on the LAN URL, and the new server-side authority backstop for initiative-hijack (`keyValidators.js` validateAuthority, c8c998531) is silently defeated in dev — differential proof: player-tab `POST /api/campaigns/test-campaign/activeCreatureName {value:'ElderPaladin'}` through the proxy → **HTTP 200 accepted**; the IDENTICAL POST direct to Express :80 with honest `Host: 100.92.171.80` → **HTTP 400 "only localhost (the GM) may change activeCreatureName while it is engaged"**. (Pointer restored afterwards.)

### Steps to reproduce
1. `npm run dev` (GM machine). From a player client (or second browser tab) open `http://100.92.171.80:5173` — the address Vite itself prints under "Network".
2. Select **test-campaign**. Client-side UI correctly strips GM nav (Encounters/Factions/NPCs/Quests/Settlements/Admin; Maps→Map) — the client sees the real hostname, the server does not.
3. GM: Notes → New Note → type `PRIVATE-SECRET-GM-ONLY-XYZ` in Description, tick **Private Note**, Save → disk shows `isPrivate: true`.
4. Player tab: refresh the Notes list → **the private note renders in full** (row `Edit note: PRIVATE-SECRET-GM-ONLY-XYZ`, verified live 2026-10-24).
5. Network differential (curl):
   - `curl http://100.92.171.80:5173/api/campaigns/test-campaign/notes` → **leaks both notes incl. isPrivate:true**.
   - `curl http://localhost/api/campaigns/test-campaign/notes -H 'Host: 100.92.171.80'` → `[]` (guard works when hostname is honest, i.e. prod :80).
   - Same proxy lane applies to every hostname-gated route (quests.js:4, notes.js:3, admin clear routes, validateAuthority keyValidators.js:128).

### Expected behavior
A client connecting from a non-localhost IP should never receive `isPrivate` notes nor pass authority gates, regardless of whether it arrives through the dev proxy.

### Actual behavior
Through Vite (`:5173`), Express sees Host `localhost` for every request, so all LAN clients get the full GM data plane: private note contents, (presumably) admin clears, and write authority on GM-owned keys.

### Likely location
- `vite.config.js:33-47` — `changeOrigin: true` on `/api`, `/subscribe`, `/spell-overlay`.
- `server/index/server.js` — no `app.set('trust proxy', ...)`.
- Every guard: `src/components/... isLocalhost(req)` copies (`server/routes/notes.js:3`, `quests.js:4`) and `server/validation/keyValidators.js:128` — all read `req.hostname`, never the forwarded client IP.
Confident about the mechanism (changeOrigin + hostname-only checks + the curl differential above).

### Suggested fix
Make Express honor the real client behind the proxy: `app.set('trust proxy', true)` (Vite already sets `X-Forwarded-For`) and change the guards to use `req.ip`/`req.ips[0]` instead of `req.hostname`; or drop `changeOrigin: true` (the server already accepts any Host for these routes) — verify SSE still connects. Whatever the choice, add a dev-only test that GETs /notes through :5173 with a LAN Host and asserts private notes are absent.

### Severity
Data integrity risk (GM secrets leak to players in every dev session where a player opens the LAN dev URL; same lane silently disables the turn-admin server backstop). In production (:80 served directly by Express) the guard works as designed.

## Resolution (2026-10-24)

**FIX: FIXED — Option A (honest-Host dev proxy).** The guess was exactly right: `vite.config.js` explicitly set `changeOrigin: true` on `/api`, `/subscribe`, `/spell-overlay`, so http-proxy rewrote every forwarded `Host:` to `localhost:80` and Express `req.hostname` was `localhost` for every LAN :5173 client, defeating all `isLocalhost(req)` guards. (Vite only auto-sets `changeOrigin:true` for string-shorthand proxy entries — object entries default to false — so the explicit `true` was the whole problem, not a framework default.)

**What changed:**
- `vite.config.js` — all three proxy lanes now `changeOrigin: false`, with a comment documenting WHY it must never be flipped back (Express does not virtual-host, so the real Host is safe to forward; guards read `req.hostname`).
- `server/routes/notes-localhost-guard.test.js` (NEW) — Host-forgery guard differential against the **real** `jsonEntityCrud` factory (only fs + campaignPaths mocked): LAN/proxy-honest Hosts incl. the exact dev URL form `192.168.0.239:5173` ⇒ private notes filtered from list + 403 on direct read; honest `localhost[:port]`/default Host ⇒ full GM visibility. Mirrors `campaigns-character-localhost-create.test.js`.
- `vite.config.test.js` (NEW, repo root) — pins the proxy contract: every `/api|/subscribe|/spell-overlay` lane targets :80 and `changeOrigin !== true`, so re-enabling the lie fails CI.
- `vitest.config.js` — `test.include` extended with `vite.config.test.js` (root-level files were outside the src/server-only include).

No server code changed; no `trust proxy` / `req.ip` refactor needed (Option B rejected: touches ~6 guard sites and is only needed if hostile clients must be defended against *at the socket level* — see residual).

**Verification (live, dev trio restarted for vite.config):**
- Pre-fix repro (Playwright, test-campaign only): LAN tab `http://100.92.171.80:5173` Notes rendered `PRIVATE-SECRET-GM-ONLY-XYZ` in full after the GM created it on localhost:5173 (disk `isPrivate:true`). Curl differential pre-fix: LAN :5173 leaked both private notes; `curl :80 -H 'Host: 100.92.171.80'` → `[]`.
- Post-fix: `curl http://100.92.171.80:5173/api/.../notes` and `http://192.168.0.239:5173/...` → `{"notes":[]}` (guard bites **through the proxy**); by-id GET → `403 Access denied: private note`; `curl :80 -H 'Host: <lan-ip>'` → `[]` (prod guard intact); `localhost:5173` GM API + GM tab both still show all private notes. LAN browser tab Notes: 0 rows, zero secret text (was 2 rows).
- SSE unchanged through proxy: server log `[SSE] Client connected ... campaign: test-campaign` ×2 (LAN + localhost tabs), and GM d20 roll on localhost:5173 live-mirrored into the LAN tab's Log with no reload. `/spell-overlay` lane parity confirmed (:5173 and :80 both 400 "campaign query param required").
- Tests: `vite.config.test.js` + `notes-localhost-guard.test.js` 21/21; full `server/routes/` 51 files/1063 tests green; `npm run lint` zero warnings.
- Cleanup: repro note deleted via localhost, change-data + campaign log cleared via admin routes; disk back to the pre-existing single note.

**Residual (owner's call, not in scope):** hostname-based guards remain spoofable by a *deliberately hostile* client that hand-forges `Host: localhost` straight to :5173 (browsers cannot do this; the leak vector — ordinary player browsing — is closed). Closing the hostile case needs Option B (`trust proxy` + `req.ip` socket-authority checks) and is the reason players should keep using :80.

