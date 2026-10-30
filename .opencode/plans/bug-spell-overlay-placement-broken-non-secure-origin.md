# Spell overlay placement is dead for LAN players — crypto.randomUUID unavailable on non-secure origins

## Summary
The Spell overlay tool is intentionally exposed to non-localhost (LAN) players — the player map toolbar deliberately keeps `Spell`/`Ruler` while stripping GM tools. But placing an overlay crashes on `crypto.randomUUID is not a function`, which only exists in secure contexts (HTTPS or localhost). The feature is therefore 100% broken for players in exactly the environment players use it, silently (no toast, no drawn shape, no POST).

## Steps to reproduce
Control (works):
1. Boot dev:locked (`npm run dev:locked`, Vite :5173 + Express :80, CAMPAIGN_LOCK=test-campaign).
2. On the GM machine open `http://localhost:5173`, select **test-campaign**, Maps → Open "Battle Arena", click `button[aria-label="Spell"]`, pick a shape, click the map canvas → overlay places and mirrors to other tabs. ✔

Bug (player tab):
3. From the same machine, open `http://100.92.171.80:5173` (LAN/Tailscale IP — any non-localhost http origin).
4. Select test-campaign. Sidebar shows the player chrome (no Encounters/Factions/NPCs/Quests/Sessions/Settlements/Admin/Music; "Maps" → "Map").
5. In the GM tab click `Activate "Battle Arena"` in the Maps list — the player tab auto-enters the map editor ("Waiting for the GM to open a map…" resolves without a reload). Toolbar shows `Spell`, `Ruler`, `View map in 3D` (no Paint/Erase — by design).
6. Click `Spell` → the `.spell-overlay-controls` panel arms fine → pick Sphere (default) → click the map canvas.

## Expected behavior
The overlay is placed, POSTed to `/spell-overlay?campaign=test-campaign`, rendered locally, and mirrored to the GM tabs (the transport has no GM-gate and deliberately serves players; the toolbar canon is "players keep Spell").

## Actual behavior
Nothing renders, nothing is POSTed (`GET /spell-overlay?campaign=test-campaign` still `{"overlays":[]}`), zero user feedback. Console shows one uncaught error per canvas click:

```
TypeError: crypto.randomUUID is not a function
    at createOverlay (http://100.92.171.80:5173/src/models/SpellOverlay.js:54:13)
    at http://100.92.171.80:5173/src/components/map/hooks/useSpellHandlers.js:81:16
    at onPointerDown (http://100.92.171.80:5173/src/components/map/Map.jsx:669:8)
```

Verified live 2026-10-30 (explore run AL): identical rig on localhost places cylinders/cubes/lines/lines-with-angle all session; the same click on the LAN-origin tab always throws. `window.isSecureContext === false` on `http://100.92.171.80:5173`.

## Likely location
Confident: `src/models/SpellOverlay.js` `createOverlay()` — `id: crypto.randomUUID()` (line ~58 in current source). `crypto.randomUUID` is only defined in secure contexts; on `http://<LAN-IP>` it is undefined. The crash fires inside the map's `onPointerDown` dispatch (useSpellHandlers.js → Map.jsx), so every shape's placement dies at the id step before any fetch.

Related same-pitfall sites found by grep (not all player-reachable, list for the fix sweep):
- `src/components/party-inventory/PartyInventory.jsx:617` (`handleSaveItem` — GM add lane; Inventory IS on the player sidebar but the save lane is server-GM-gated)
- `src/services/campaign/inventoryService.js:27` (runs on any client only for id-less items — rare shape)
- `src/services/ai/applyWorldProposal.js:30`, `src/components/quests/Quests.jsx:313`, `src/components/notes/Notes.jsx:288`, `src/components/factions/Factions.jsx:138` (GM-localhost-gated views)
- Precedent for the guard already exists in-repo: `src/services/combat/concentration/concentrationService.js:115` uses `crypto.randomUUID ? crypto.randomUUID() : \`${Date.now()}-${Math.random()}\``.

## Suggested fix
Give `createOverlay` a secure-context-safe id — reuse the concentrationService idiom or a tiny shared helper (e.g. in `src/services/ui/utils.js`; note its own comment warns `guid()` must not identify NPCs/characters — overlay ids are ephemeral zone ids so a fallback UUID is fine there). Sweep the sibling `crypto.randomUUID()` call sites above with the same helper, keeping the guard local where reachability is doubtful. Optionally add an eslint rule (`eslint-plugin-unicorn` `prefer-…` or a custom no-bare-randomUUID) so future writers get warned.

## Severity
Broken feature — the one AoE tool deliberately granted to network players cannot ever succeed for them; silent-failure face (no feedback beyond console) compounds it.
