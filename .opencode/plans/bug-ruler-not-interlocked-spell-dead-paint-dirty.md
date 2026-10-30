# Ruler tool is not interlocked with Spell/Paint — arming Spell while Ruler is active silently kills placement; a Ruler click with Paint still armed draws walls into the map file

## Summary

The indoor map editor's Ruler toggle and the Spell toggle / paint tools do not mutually
disarm each other (the interlock is only wired one direction). Consequences, both proven
live: (a) with Ruler armed, clicking Spell arms the wand UI (button active,
`aria-pressed="true"`, controls panel mounted) but **every canvas click is silently
swallowed** — no overlay is placed, no feedback, while the ruler consumes the same click;
(b) with Paint armed, clicking Ruler leaves **both tools armed** and a single canvas click
**both sets a ruler point AND paints a wall edge that persists to the map file**. Face (b)
corrupted a real map document during testing — the map's md5 drifted and had to be
byte-restored.

## Steps to reproduce

Face (a) — dead Spell wand:
1. In test-campaign, open Maps → Open "Battle Arena" (localhost, GM).
2. Click `button[aria-label="Ruler"]` — hint `Click two points to measure distance` appears.
3. Click two cells on the canvas to take a measurement (label `20 ft (4 cells)` shows).
4. WITHOUT disarming Ruler, click `button[aria-label="Spell"]`.
   - Observe: BOTH toolbar buttons carry class `active`, spell `aria-pressed="true"`,
     `.spell-overlay-controls` panel is mounted, and the previous ruler line stays on screen.
5. Click an empty area of the grid canvas.
   - Expected: a sphere overlay is placed (it is the armed tool with an armed UI).
   - Actual: **nothing** — `g.spell-overlay-group` count stays 0 additions, zero POST to
     `/spell-overlay`; meanwhile the ruler treats the click as a restart (measurement label
     clears). No toast, no console error — the wand is silently inert.
   - Also reproducible on the LAN player origin (http://<lan-ip>:5173): both dual-armed,
     canvas click adds 0 overlays — players have no other toolbar affordance to escape.

Face (b) — ruler click paints walls (data integrity):
1. Same map editor. Click `button[aria-label="Paint"]` (button gains `active`).
2. Click `button[aria-label="Ruler"]` — Paint STAYS active (both buttons `active`).
3. One single left-click on a grid cell.
4. Observe: a ruler point appears AND a wall segment is committed —
   `PUT /api/campaigns/test-campaign/maps/battle-arena` fires (debounced), and
   `GET /api/campaigns/test-campaign/maps/battle-arena` shows the cell key added to
   `walls[]`.
5. Confirm with file md5: `public/campaigns/test-campaign/maps/battle-arena.json` changes.
   (During this test, four subsequent *ruler measurement* clicks — made believing only the
   ruler was armed — all landed as `walls` entries `["3,3","3,7","2,10","8,10"]` in the
   map file before being byte-restored.)

## Expected behavior

Map tools are exclusive house-pattern: arming any tool disarms the conflicting ones (the
way `toggleSpellMode` already clears `tool`, and HexMapToolbar travel arms exclusively).
- Arming Spell should disarm Ruler (and vice versa: `handleSetRulerMode` already clears
  spellMode, so the reverse edge exists).
- Arming Ruler should disarm Paint/Erase/Select; a measurement gesture must never mutate
  the map file.

## Actual behavior

Face (a): Spell is visually armed but functionally dead — `handleSpellPointerDown` early
returns via its internal guard `if (rulerMode) return;` (useSpellHandlers.js:43) while
`rulerMode` is never cleared by `MapToolbar.toggleSpellMode`. The ruler consumes the same
pointerdown chain, so the user sees the wand panel, clicks, and gets zero result with zero
feedback (classic silent no-op).

Face (b): `handleSetRulerMode` (Map.jsx:445-451) clears `spellMode` but NOT `tool`, and the
svg pointerdown chain dispatches `handleGridPointerDown` (paint) unconditionally
(`handleToolPanStart`, Map.jsx:402-407 — no `rulerMode` check). One gesture = wall write +
ruler point. The wall persists to disk through the map autosave lane.

## Likely location

Confident (source-read + live):
- `src/components/map/MapToolbar.jsx:42-54` — `toggleSpellMode` clears `tool` but never
  clears `rulerMode`.
- `src/components/map/Map.jsx:445-451` — `handleSetRulerMode` clears `spellMode` but never
  `setTool('none')`.
- `src/components/map/hooks/useSpellHandlers.js:43` — the silent `if (rulerMode) return;`
  gate that makes face (a) inert instead of erroring.
- `src/components/map/Map.jsx:402-407` (`handleToolPanStart`) — paint/erase/select dispatch
  with no `rulerMode` guard (the back-stop lane).

## Suggested fix

Complete the bidirectional interlock at the toolbar/handler level (primary), optionally add
defensive gates (back-stop):
1. `MapToolbar.jsx` `toggleSpellMode`: when arming, also call `setRulerMode(false)` (pass
   the setter down; Map.jsx already exposes `handleSetRulerMode`).
2. `Map.jsx` `handleSetRulerMode`: when `value` is true, also `setTool('none')` alongside
   the existing `setSpellMode(null)` + `resetRuler()`.
3. Back-stop: in `handleToolPanStart`, skip the paint/erase/select dispatch while
   `rulerMode` is armed.
Pin with component tests mirroring the existing Map-tool handler suite
(`Map-tool-handlers.test.jsx`): dual-arm attempts must end with exactly one armed tool.

## Severity

Data integrity risk — face (b) silently writes wall geometry into the campaign's map file
during what the user believes is a read-only measurement gesture (observed corrupting
battle-arena.json; md5 drifted 94fcd0bf… → 0ecc8607… before byte-restore). Face (a) is a
GM- and player-reachable inert-tool silent failure; combined they justify more than a
minor-UX rating.
