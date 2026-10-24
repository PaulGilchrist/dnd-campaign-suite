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
