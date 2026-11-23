# bug-visitor-map-token-menu-phantom-authoring

## Summary
A LAN-visitor tab can right-click ANY token on the indoor battle-map board and get the full authoring context menu ("Remove from Map", "Light: bright→dim→none"), including the named `Remove "<name>" from the map?` confirm dialog. Pressing the rows applies a persistent LOCAL-only edit — the visitor's veil relights, tokens vanish from their board — while every write is silently dropped by the non-GM `flushSave` guard: zero network request, zero 403, zero feedback, and the phantom survives until some unrelated SSE echo to the same doc silently rolls it back.

## Steps to reproduce
Start from: dev pair running on localhost; `test-campaign` has an active indoor map. (Rig used: sandbox map `xy2-veil` created via `POST /api/campaigns/test-campaign/maps` + doc PUT with `lighting:true` and two `players[]` tokens `AasimarTest` (5,5) and `FixtureFighter5e` (12,12), then `PUT .../activate`.)

1. Tab A (GM): open the active map at `http://localhost:5173` — the lighting veil renders (`light-cell-*` tiers).
2. Tab B (visitor): fresh browser context (`isolatedContext:'lan'`), goto `http://<en0-ip>:5173`, select `test-campaign`, click the `Map` sidebar header. The board live-adopts the active map (2 tokens).
3. Right-click a token circle in Tab B → the context menu opens: `Remove from Map` / `Light: bright` / ✕.
4. Click `Light: bright` repeatedly in Tab B: the label cycles bright → dim → none → bright and the local veil recomputes (dark cells 48 → 99 → back to 48). Observe the network: NO request is ever issued for `/maps/...` during the presses. `GET /api/campaigns/test-campaign/maps/xy2-veil` keeps both `players[].light` absent.
5. Click `Remove from Map` in Tab B → the in-app `Remove from Map — Remove "AasimarTest" from the map?` dialog (`.modal-shell-overlay`) appears. Press `Yes, Remove`.
6. The token disappears from Tab B's board (1 card left). Tab A still shows 2 tokens; the server doc still has both players. Console in Tab B stays clean — no error, no notice.
7. Control (GM): right-click the far token in Tab A, press Light → label sticks at `Light: dim` and within ~2 s the server doc persists `light:"dim"`; the visitor tab adopts the echo live (veil recomputes dark 48→159) AND its phantom local rows silently revert to the doc bytes.

## Expected behavior
Visitor-origin tabs get read-only map chrome (WW-era principle already applied to Initiative target selects and the character sheet): either the authoring rows (Remove/Light/rename) are hidden/disabled for non-GM origins, or pressing one shows honest feedback ("map editing is GM-only"). A full named-confirm ceremony whose effect evaporates on the next unrelated echo misrepresents shared state.

## Actual behavior
Steps 3–5: menu, cycling, confirm dialog and local removal ALL render for the visitor; zero PUTs fire (client-side `flushSave` early-return), the server is never touched, GM tabs never change, console is silent. The only "recovery" is a later SSE echo clobbering the phantom — indistinguishable from a glitch to the player.

## Likely location
Confident on the drop lane, guessing on where the gate belongs:
- `src/components/map/hooks/useMapLoader.js` `flushSave()` — non-localhost early-return (intentional, keep it: it's the bug-player-clients-clobber-fog-reset defense).
- Ungated openers: `src/components/map/Players.jsx` token `onContextMenu` (no `isLocalhost` check) → `src/components/map/PlayerContextMenu.jsx` (component doesn't even receive `isLocalhost`); same pattern in `src/components/map/PlacedItems.jsx` `onContext` and `src/components/map/IndoorPoiLayer.jsx` `handlePoiContextMenu` (not individually ridden — the player lane is the proved face).
- `handleCyclePlayerLight` / `handleRemovePlayer` in `src/components/map/hooks/usePlacedItems.js` + `Map.jsx` write local `mapData` before the save chokepoint decides to drop.

## Suggested fix
Thread `isLocalhost` into the three context-menu renderers and render a read-only face for visitors (e.g. drop `Remove from Map` and `Light` rows entirely — mirroring the WW Initiative fix where foreign PC cards got plain `[data-testid=target-readonly]` spans instead of live selects). The alternative — optimistic-write + rollback toast on refusal — is the heavier pattern; hiding rows matches the app's existing visitor doctrine. Keep the server 403 + flushSave drop as defense-in-depth regardless.

## Severity
Minor UX issue tipping into data-trust risk — nothing corrupts the server (the guard is honest), but a player-visible control performs a full confirm ceremony for a write that silently never happened, teaching players that map state they "edited" is unreliable.
