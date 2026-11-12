# Bug: Generate Dungeon grid-size hint prints wrong dimensions & square count

## Summary
The Generate Dungeon Map modal's grid-size hint reads `{gridSize} ft × {gridSize} ft ({gridSize} squares)`.
For a `gridSize` of N the map is actually an N×N grid of 5 ft cells, i.e. **(5·N) ft × (5·N) ft** with **N² squares** — so the hint under-reports the real-world size by 5× and the square count by N×. The twin Generate Terrain modal computes its totals correctly, so this modal just forgot the math.

## Steps to reproduce
1. Run the app on localhost (GM features). In **test-campaign**, open the **Maps** view.
2. Ensure the map-type selector is **Indoor**, then click **`Generate Dungeon`** (aria-label `Generate Dungeon`).
3. In the "Generate Dungeon Map" modal, observe the hint directly under the *Grid Size* number input (default value 30).
   - Actual text: **`30 ft × 30 ft (30 squares)`**
4. Set Map Name to e.g. `QA Dungeon Gen`, set Grid Size to `20`, Seed to `42`, press **Generate**.
5. On disk (`public/campaigns/test-campaign/maps/qa-dungeon-gen.json`) inspect `gridSize` and the wall coordinate extent.
   - Result: `gridSize: 20`, walls span x∈[0,19], y∈[0,19] → a **20×20 = 400-cell** grid.

## Expected behavior
The hint should describe the map the generator actually produces. With the app's 5 ft-per-square convention (see ruler: `1 cell = 5 ft`, `2 cells = 10 ft` in `src/components/map/RulerOverlay.test.jsx`; CELL_SIZE=40 px/cell in `src/config/mapConfig.js`), a grid size of N is:
- **N·5 ft × N·5 ft** (a gridSize of 30 → `150 ft × 150 ft`), and
- **N×N squares** (a gridSize of 30 → `900 squares`).
Compare the sibling **Generate Terrain** hint which computes totals correctly: `60 hexes × 30 hexes (1800 hexes)` for gridSize 30 (see `GenerateTerrainModal.jsx`).

## Actual behavior
The hint prints `30 ft × 30 ft (30 squares)` for a 30×30 grid that is really 150 ft × 150 ft with 900 squares. Both the feet figures (uses the cell count as feet) and the square count (uses the side length instead of the area) are wrong. Shown in **both** generation modes (BSP and Room Adjacent — the JSX line is duplicated).

## Likely location
`src/components/maps-manager/GenerateDungeonModal.jsx` — the identical hint line occurs twice (≈ line 140 in the BSP branch and ≈ line 173 in the Room-Adjacent branch):
```jsx
{gridSize} ft &times; {gridSize} ft ({gridSize} squares)
```
Confident: the JSX is literally present and the hint is read live; the 5 ft/cell convention is pinned by the ruler tests and `SVG_SIZE = gridSize * CELL_SIZE` confirms gridSize is cells-per-side.

## Suggested fix
Compute the derived values in the JSX, mirroring the terrain modal. If the intended reading is feet-per-square (5 ft) and total squares (N²), change both occurrences to e.g.:
```jsx
{gridSize * 5} ft &times; {gridSize * 5} ft ({gridSize * gridSize} squares)
```
(or, if a compact label is preferred, `{gridSize} × {gridSize} squares ({gridSize * gridSize} total)`). Confirm the chosen unit with the owner — the key defect is that the raw cell count is printed as both "ft" and "squares" with no multiplication, contradicting the app's own ruler convention.

## Severity
Minor UX issue. The generator and the created map are correct; only the descriptive hint misinforms the user about map size/scale. Low-risk copy fix.

## Resolution
**FIXED 2026-11-12 (fix subagent).** Diagnosis confirmed: `GenerateDungeonModal.jsx` printed the raw per-side cell count as both feet and total squares in **both** mode branches, while the generator produces an N×N grid of 5 ft cells.

**What changed:**
- `src/components/maps-manager/GenerateDungeonModal.jsx` — both hint lines (BSP + Room-Adjacent branches) now read
  `{gridSize * FEET_PER_CELL} ft × {gridSize * FEET_PER_CELL} ft ({gridSize * gridSize} squares)`,
  importing the canonical `FEET_PER_CELL = 5` from `src/services/combat/movementBudget.js` (the only exported feet-per-cell constant; `mapConfig.js` holds only `CELL_SIZE = 40` px, and the map hook `useSelectMove.js` already imports `FEET_PER_CELL` from this module — same pattern). Mirrors the sibling `GenerateTerrainModal.jsx:75` inline-computed hint.
- `src/components/maps-manager/GenerateDungeonModal.test.jsx` — 2 new regression tests in the `rendering` suite: the default hint is exactly `150 ft × 150 ft (900 squares)` (grid 30), updates to `100 ft × 100 ft (400 squares)` on grid 20, and the corrected hint shows in Room-Adjacent mode too.

**Verification:**
- Live repro BEFORE fix (Playwright, localhost:5173, test-campaign → Maps → Indoor → Generate Dungeon): hint read `30 ft × 30 ft (30 squares)` at default grid 30 and `20 ft × 20 ft (20 squares)` at grid 20 in both BSP and Room-Adjacent branches; generated `qa-dungeon-gen.json` (name "QA Dungeon Gen", grid 20, seed 42) landed `{gridSize:20, seed:42, walls:256}` with wall coords spanning x∈[0,19], y∈[0,19] → genuinely 400 cells, hint wrong.
- Live re-verify AFTER fix: hint now reads `150 ft × 150 ft (900 squares)` (default) and `100 ft × 100 ft (400 squares)` at grid 20 in **both** modes. Sibling Generate Terrain hint sanity-checked unchanged: `60 hexes × 30 hexes (1800 hexes)`.
- Tests: `npx vitest run src/components/maps-manager/GenerateDungeonModal.test.jsx` → 32/32; whole folder `npx vitest run src/components/maps-manager` → 10 files / 146 tests passed; `npm run lint` → clean (zero warnings).
- Cleanup: sandbox map `qa-dungeon-gen` API-deleted (ghost 404, maps back to 4 owner fixtures); change-data + campaign log admin-cleared for test-campaign.

Dual-ruleset note: hint text is ruleset-agnostic (no 5e/2024 twin of this modal). Out of scope, untouched: the seed-validation and clamp-copy backlog items in the app-exploration Improvement backlog for these modals.

