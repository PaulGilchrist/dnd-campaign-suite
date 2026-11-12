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
