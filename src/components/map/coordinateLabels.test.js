// @maintained-by-ai 2026-11-21
import { describe, it, expect } from 'vitest';
import { buildCoordinateLabels, ROW_LABEL_BASELINE } from './coordinateLabels.js';
import { CELL_SIZE } from '../../config/mapConfig';

// Lane: coordinate legend pure seam (backlog 2026-11-21). The board renders
// NO axis labels while the LoS-deny/cover/dress copy cites raw 0-based cells
// like "(5,10)" — this legend makes them resolvable. Pinned here: the label
// seam's 0-based top-left-origin geometry (the alignment contract between
// label "5"/"10" and the square the copy names (5,10)) and grid-unit
// placement (labels ride the svg viewBox transform, so zoom/pan can never
// desync them). Render gating → CoordinateLegend.test.jsx; toolbar wiring →
// MapToolbar.test.jsx.

describe('buildCoordinateLabels', () => {
    it('emits one label per column and per row, 0-based, top-left origin', () => {
        const labels = buildCoordinateLabels(30);
        expect(labels).toHaveLength(60);
        const cols = labels.filter(l => l.axis === 'col');
        const rows = labels.filter(l => l.axis === 'row');
        expect(cols.map(l => l.value)).toEqual(Array.from({ length: 30 }, (_, i) => i));
        expect(rows.map(l => l.value)).toEqual(Array.from({ length: 30 }, (_, i) => i));
        // Origin legible at the top-left: the two 0 labels sit in the first
        // cell (near x=0 and y=0), never at the bottom/right.
        expect(cols[0].x).toBeLessThan(CELL_SIZE);
        expect(rows[0].y).toBeLessThan(CELL_SIZE);
    });

    it('aligns each label with its column/row centre in grid units', () => {
        const labels = buildCoordinateLabels(30);
        const col5 = labels.find(l => l.axis === 'col' && l.value === 5);
        const row10 = labels.find(l => l.axis === 'row' && l.value === 10);
        // The copy-cited square (5,10) sits UNDER column label 5 (same x
        // centre as the cell) and BESIDE row label 10 (same y centre).
        expect(col5.x).toBe(5 * CELL_SIZE + CELL_SIZE / 2);
        expect(row10.y).toBe(10 * CELL_SIZE + CELL_SIZE / 2);
        // Column labels hug the TOP edge; row labels hug the LEFT edge.
        expect(col5.y).toBeLessThan(CELL_SIZE);
        expect(row10.x).toBeLessThan(CELL_SIZE);
    });

    it('scales with gridSize', () => {
        const labels = buildCoordinateLabels(4);
        expect(labels).toHaveLength(8);
        expect(labels.filter(l => l.axis === 'col').map(l => l.value)).toEqual([0, 1, 2, 3]);
        expect(labels.filter(l => l.axis === 'row').map(l => l.value)).toEqual([0, 1, 2, 3]);
    });

    it('the row baseline nudge is a render concern, sub-cell and positive', () => {
        expect(ROW_LABEL_BASELINE).toBeGreaterThan(0);
        expect(ROW_LABEL_BASELINE).toBeLessThan(CELL_SIZE / 2);
    });
});
