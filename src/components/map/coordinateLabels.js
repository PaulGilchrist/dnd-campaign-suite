import { CELL_SIZE } from '../../config/mapConfig';

// Pure label seam for the coordinate legend (backlog 2026-11-21, rendered by
// CoordinateLegend.jsx): chess-board-style 0-based axis labels along the
// board's TOP edge (column numbers) and LEFT edge (row numbers), in the exact
// notation the user-facing copy cites — the LoS deny popup's "(5,10)" names
// the square under column label 5 and beside row label 10. Coordinates live
// in GRID units (same space as GridAndWalls/RulerOverlay), so the svg viewBox
// already carries them through every zoom/pan — no pixel offsets, no second
// transform to keep in sync. Top-left origin falls out of the math: value 0
// sits at x/y 0, matching the internal coordinate system.

// Baseline of the column digits, measured from the board's top edge — the
// glyph tops hug row 0's upper boundary (SVG <text> y is the baseline).
export const COL_LABEL_Y = 13;
// Left inset of the row digits inside column 0.
export const ROW_LABEL_X = 5;
// Half cap-height: shifts the row digit off its mathematical centre so it
// reads vertically centred in the cell.
export const ROW_LABEL_BASELINE = 4;

/** Every axis label for a gridSize × gridSize board. Columns run left→right
 *  0..gridSize-1 along the top edge; rows run top→bottom 0..gridSize-1 along
 *  the left edge. x/y are viewBox units and sit on the column/row CENTRE LINE
 *  — the alignment contract with the copy (the digit's visual baseline nudge
 *  is a render concern, see ROW_LABEL_BASELINE). */
export function buildCoordinateLabels(gridSize) {
    const labels = [];
    for (let col = 0; col < gridSize; col++) {
        labels.push({
            axis: 'col',
            value: col,
            x: col * CELL_SIZE + CELL_SIZE / 2,
            y: COL_LABEL_Y,
        });
    }
    for (let row = 0; row < gridSize; row++) {
        labels.push({
            axis: 'row',
            value: row,
            x: ROW_LABEL_X,
            y: row * CELL_SIZE + CELL_SIZE / 2,
        });
    }
    return labels;
}
