# Bug: visitor (LAN) client drains the GM-authority pendingSaveListenerPrompts bucket

## Summary
When the GM resolves a `createSaveListener` save prompt, the "drain-to-evict" prune of the campaign-level `pendingSaveListenerPrompts` bucket runs on EVERY client via the logged-dice-roll handler lane — including read-only LAN visitors. The visitor's tab then issues `DELETE /api/campaigns/:c/pendingSaveListenerPrompts`, which the server correctly 403s ("Access denied: GM-only feature"), producing a console error on every visitor device per adjudicated save and a forbidden write attempt against a GM-authority key. The server guard holds (no data damage), but the client lane has no ownership gate — the same class of defect just fixed for turn-start automation in 5049bfad1 (`bug-turn-start-automation-double-fires-with-second-client`).

## Steps to reproduce
1. Dev pair: `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' node server.js` (:80) + `npx vite --host` (:5173).
2. Tab A (GM): `http://localhost:5173` → select **test-campaign** → Initiative.
3. Tab B (visitor): `browser_tabs {action:'new', isolatedContext:'lan', url:'http://192.168.0.44:5173'}` → select test-campaign → Initiative.
4. On Tab A seed a cheap repeat-save carrier (playbook §81 mini-recipe):
   - `POST /api/campaigns/test-campaign/ElderPaladin {"value":{"activeConditions":["Poisoned"]}}`
   - `POST /api/campaigns/test-campaign/targetEffects {"value":[{"target":"ElderPaladin","source":"QA Test Effect","effect":"thri_kreen_bite_poison","dc":15,"saveType":"con","repeatSave":{"saveType":"con","dc":15,"condition":"Poisoned"}}]}`
   - `POST /api/campaigns/test-campaign/combatSummary {"value":{ round:1, activeCreatureName:"ElderPaladin", creatures:[EvasiveFighter i20, FeyRanger i15, ElderPaladin i10] }}` + `POST /activeCreatureName "ElderPaladin"` (POST AFTER both Initiative pages have settled — §72).
5. On Tab A click `Next →` until the CON save prompt opens, press **Roll Save**, then **Done**.
6. Inspect Tab B: `browser_network_requests {static:false}` filtered to `pendingSaveListenerPrompts`, plus console (level `error`).

## Expected behavior
Only the GM (localhost) client prunes/evicts the shared `pendingSaveListenerPrompts` bucket. The visitor tab mirrors the drain via SSE and issues **zero** writes — matching the visitor-tab network law pinned by 5049bfad1 (baseline = exactly one by-design `POST /__campaign__` on mount).

## Actual behavior
Tab B fires `DELETE http://192.168.0.44:5173/api/campaigns/test-campaign/pendingSaveListenerPrompts` → **403 Forbidden** with body `{"error":"Access denied: GM-only feature"}` (confirmed ×2 this session — one per save resolution). Tab B's console shows `Failed to load resource: the server responded with a status of 403 (Forbidden) .../pendingSaveListenerPrompts:0`. No state corruption: the block comes from the GM guard on the character-DELETE route (route-order accident), and the GM's own DELETE from Tab A succeeded (200).

**Second face (NOT blocked — landed 200):** in the same resolution window, Tab B also issued a FULL-STORE `POST /api/campaigns/test-campaign/ElderPaladin` with body `{"value":{"activeConditions":["Poisoned"],"pendingExpirations":[]}}` — a write against the victim's character bucket stamped from the VISITOR's mirrored state (it appended `pendingExpirations:[]` to a bucket whose pre-resolution truth it had cached). Character-bucket POSTs are visitor-writable by design (delegated monster cards), so this one SUCCEEDS. Under the documented runtime-write law (full-store snapshot per POST, racing copies lose keys) a visitor mirror re-POST during resolution can clobber the GM's concurrent bucket writes (e.g. the GM's own condition/expiration strip) with the visitor's stale snapshot. Observed outcome was benign (final GET showed te/conditions correctly drained), but the race window is real.

## Likely location
- `src/hooks/combat/useLoggedDiceRollEventHandlers.js` → `syncListenerPromptFilters` (module-scope function, ~line 31): filters `pendingSaveListenerPrompts` and calls `setSavePromptBucket(...)` with **no isLocalhost/GM ownership guard anywhere in the file** (grep-verified). The logged-dice-roll event fires on all clients that adopt the resolved save via SSE.
- Server side (why it 403s instead of silently landing): `server/routes/campaigns-character.js:268` `router.delete('/api/campaigns/:campaign/:file')` calls `refuseUnlessGm` BEFORE `next()`-ing on non-`.json` files, and campaigns-character is mounted before `campaigns-changedata.js` — so LAN DELETEs to change-data keys are structurally blocked. Note the change-data DELETE route itself (`campaigns-changedata.js:496`) has NO GM guard — the containment depends on that route ordering.
- Confidence: high on the client lane (file grep + repro ×2); medium on attributing the 403 to route ordering (response body copy matches `refuseUnlessGm`; not proven by reading server.js mount order live).

## Suggested fix
Thread the GM/localhost ownership flag into the dice-roll handler lane and early-return in `syncListenerPromptFilters` for non-GM clients — the same idiom as `createSseEventHandler({ isLocalhost })` in 5049bfad1. Visitors keep the mirror read (the GM's successful DELETE publishes the `change-...-pendingSaveListenerPrompts` null echo that already self-heals every tab). Start by checking how the host (Initiative.jsx / SaveAttackAoeModal) already knows `isLocalhost` and pass it down, or read a shared localhost flag; add a two-tab regression test asserting the visitor performs zero writes when a listener prompt resolves on the GM client. Secondary hardening (optional): add an explicit GM guard to the change-data DELETE route rather than relying on campaigns-character route ordering.

## Severity
Minor UX issue / latent data-integrity risk. The 403 lane is noise-only (server fail-closed), but the second face — a SUCCEEDING full-store visitor POST to a character bucket stamped from a stale mirror during GM-side resolution — can race-clobber GM writes under the documented snapshot law. Observed benign this session; the unguarded lane is the same class 5049bfad1 closed for turn-start.
