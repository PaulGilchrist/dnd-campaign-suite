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

## Summary (resolution)

Completed the bidirectional tool-mode interlock in the indoor map editor: arming Spell now
disarms Ruler, arming Ruler now disarms Paint/Erase/Select (and vice versa at the toolbar),
plus a back-stop that refuses paint/erase/select dispatch on the canvas while the ruler is
armed. Verified live in test-campaign (both original repro faces now behave as Expected)
and pinned by 6 new vitest cases.

## Resolution

**Root cause — identical to the original diagnosis, plus one mirror path the bug file missed.**
Both faces reproduced live before any code change:
- Face (a): Ruler armed + measured (`20 ft (4 cells)`), clicked Spell → both buttons
  `active`, spell `aria-pressed="true"`, `.spell-overlay-controls` mounted; one canvas
  click added 0 `g.spell-overlay-group` and fired 0 POSTs (silent dead wand). CONFIRMED.
- Face (b): Paint armed, clicked Ruler → both stayed `active`; one canvas click placed a
  ruler point AND wrote wall `"3,3"` — API `walls:["3,3"]`, map md5 drifted
  94fcd0bf… → db876beb…. CONFIRMED. (Immediately erased via the Erase tool; md5 restored
  byte-identical 94fcd0bf… within one debounce cycle.)
- **Extra mirror path found during fix design:** Face (b)'s repro is Paint→Ruler, but the
  reverse order (Ruler armed → click Paint) dual-armed the same way, because the
  `TOGGLE_TOOLS` buttons in MapToolbar dispatch the raw `setTool` with no ruler clear.

**Files changed:**
- `src/components/map/MapToolbar.jsx`
  - `toggleSpellMode`: when arming from a ruler-armed state, also dispatches
    `setRulerMode(false)` (the prop is Map's `handleSetRulerMode`); conditional so a
    disarmed ruler gets no redundant write.
  - `TOGGLE_TOOLS` onClick: arming paint/erase/select from a ruler-armed state now also
    dispatches `setRulerMode(false)` (closes the mirror path above).
- `src/components/map/Map.jsx`
  - `handleSetRulerMode`: when `value` is true, also `setTool(TOOL_NONE)` alongside the
    existing `setSpellMode(null)` + `resetRuler()` (mirrors the spell-clear pattern).
  - `handleToolPanStart`: back-stop — while `rulerMode` is armed, the paint/erase/select
    dispatch lanes are skipped (pan still runs, so the measurement view stays draggable
    and the Map-tool-handlers:386 pin holds). A measurement gesture can no longer mutate
    the map document regardless of how tool+ruler got armed.
- `src/components/map/Map.tool-interlock.test.jsx` (NEW) — 6 regression cases: Spell-arm
  disarms ruler + wand arms in the same click; no redundant ruler write when already
  disarmed; Ruler-arm clears the Paint active byte and routes canvas pointerdown to pan,
  never grid-paint; toolbar mirror (Paint-arm dispatches ruler disarm) + back-stop lane;
  existing Ruler-clears-spell edge intact; paint-alone still paints (interlock ≠
  suppression).

`useSpellHandlers.js:43` (`if (rulerMode) return;`) was left in place as a pure defensive
gate — with the interlock it is unreachable from the UI. Dual-ruleset: N/A (map-editor UI).

**Verification:**
- Live re-run of the original repro steps in test-campaign (localhost :5173):
  - Face (a): Ruler armed + measured → clicked Spell → Ruler button inactive, `.ruler-hint`
    unmounted, Spell active/pressed with controls; canvas click → 1 `g.spell-overlay-group`
    + one `POST /spell-overlay?campaign=test-campaign`. wand is live again.
  - Face (b): Paint armed → clicked Ruler → Paint cleared (exactly one armed tool);
    single canvas click → ruler point placed, `walls:[]` on the API across the full
    debounce window, map file md5 byte-identical 94fcd0bf… throughout.
  - Sanity: ruler-alone still measures (`20 ft (4 cells)`), paint-alone paints (1
    `.wall-cell`) and erase removes (0), spell-alone places; overlay test data cleared via
    Clear All + named confirm (server overlays `[]`, no `data/spell-overlays.json` on disk).
- `npx vitest run src/components/map/Map.tool-interlock.test.jsx` — 6/6 pass.
- `npx vitest run src/components/map` — 65 files / 722 tests pass (zero regressions; all
  existing pins, incl. Map-tool-handlers and MapToolbar suites, unchanged and green).
- `npm run lint` — clean (zero warnings). `no-timers-guard` — OK.
- Final state: change-data `{}` + log `[]` GET-verified after Admin clears; battle-arena
  md5 94fcd0bfe9e4cf6e1118f736b920e7a2 (baseline); no stray overlays/walls/tools armed.

**Adjacent residual noted (NOT fixed, out of scope):** clicking Paint while the *wand* is
armed still dual-arms (spellMode is not cleared by the tool buttons — mirror of face (a)
with spell instead of ruler; a canvas click would place an overlay AND paint). Same bug
class, different tool pair; recommended for a follow-up ticket.

