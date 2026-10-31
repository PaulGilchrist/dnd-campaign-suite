// @maintained-by-ai
// AI Dress overlay-preview helpers (backlog ai-dress-belongs-in-map-view):
// proposed ops → cell-anchored markers the map view paints over its own grid.
import { describe, it, expect } from 'vitest';
import {
    buildDressMarkers,
    squareDressGeometry,
    hexDressGeometry,
    indoorDressMarkers,
    hexDressMarkers,
} from './dressPreview.js';
import { hexToPixel } from './hexMapUtils.js';
import { CELL_SIZE } from '../../config/mapConfig.js';
import { HEX_SIZE } from '../../config/outdoorConfig.js';

const DOC = {
    placedItems: [{ id: 'torch-0-2-4', type: 'torch', gridX: 2, gridY: 4 }],
    items: [{ id: 'npc-1', name: 'Goblin', type: 'monster', gridX: 3, gridY: 4 }],
    pois: [{ id: 'poi-0', label: 'Arch', q: 5, r: 6 }],
};

describe('buildDressMarkers', () => {
    it('anchors add ops at their cell with the server preview label idiom', () => {
        const [m] = buildDressMarkers(
            [{ op: 'add', target: 'item', item: { type: 'chest' }, gridX: 12, gridY: 8 }],
            DOC,
        );
        expect(m).toMatchObject({ kind: 'add', x: 12, y: 8, label: 'add chest at 12,8', valid: true });
    });

    it('resolves remove ops to the CURRENT document row cell + plain-English label', () => {
        const [m] = buildDressMarkers([{ op: 'remove', target: 'token', id: 'npc-1' }], DOC);
        expect(m).toMatchObject({ kind: 'remove', x: 3, y: 4, label: 'remove Goblin at 3,4', valid: true });
    });

    it('resolves hex POI rows through q,r addressing', () => {
        const [m] = buildDressMarkers([{ op: 'remove', target: 'poi', id: 'poi-0' }], DOC);
        expect(m).toMatchObject({ kind: 'remove', x: 5, y: 6, label: 'remove Arch at 5,6' });
    });

    it('emits a source + destination pair for move ops', () => {
        const markers = buildDressMarkers(
            [{ op: 'move', target: 'item', id: 'torch-0-2-4', gridX: 9, gridY: 6 }],
            DOC,
        );
        expect(markers).toHaveLength(2);
        expect(markers[0]).toMatchObject({ kind: 'move-from', x: 2, y: 4, label: '' });
        expect(markers[1]).toMatchObject({ kind: 'add', x: 9, y: 6, label: 'move torch → 9,6' });
    });

    it('flags unresolvable ids with coords null + invalid (modal preview stays honest)', () => {
        const [m] = buildDressMarkers([{ op: 'remove', target: 'item', id: 'ghost' }], DOC);
        expect(m).toMatchObject({ kind: 'remove', x: null, y: null, valid: false });
        expect(m.label).toMatch(/ghost/);
    });

    it('flags off-grid adds via isInside but keeps the cell for a loud ✕-less warning', () => {
        const [m] = buildDressMarkers(
            [{ op: 'add', target: 'item', item: { type: 'chest' }, gridX: 99, gridY: 2 }],
            DOC,
            { isInside: (x, y) => x < 30 && y < 30 },
        );
        expect(m).toMatchObject({ kind: 'add', x: 99, y: 2, valid: false });
    });

    it('adds without a cell (schema-incomplete) degrade to coord-less invalid markers', () => {
        const [m] = buildDressMarkers([{ op: 'add', target: 'poi', poi: { name: 'Arch' } }], DOC);
        expect(m).toMatchObject({ kind: 'add', x: null, y: null, valid: false, label: 'add Arch (no cell)' });
    });
});

describe('dress geometry', () => {
    it('square geometry centres cells through the caller\'s grid math and outlines a CELL_SIZE box', () => {
        const g = squareDressGeometry(x => x * CELL_SIZE + CELL_SIZE / 2, y => y * CELL_SIZE + CELL_SIZE / 2);
        expect(g.cellCenter(3, 4)).toEqual({ x: 140, y: 180 });
        expect(g.cellPath({ x: 140, y: 180 })).toBe('M120,160h40v40h-40Z');
    });

    it('hex geometry maps q,r through hexToPixel and outlines the hex path', () => {
        const g = hexDressGeometry();
        expect(g.cellCenter(2, 1)).toEqual(hexToPixel(2, 1, HEX_SIZE));
        expect(g.cellPath(g.cellCenter(2, 1))).toMatch(/^M/);
    });
});

describe('per-surface wrappers', () => {
    const ops = [{ op: 'add', target: 'item', item: { type: 'chest' }, gridX: 5, gridY: 6 }];

    it('indoor: null ops / unloaded document → null; fold placedItems into the doc lanes', () => {
        expect(indoorDressMarkers(null, { gridSize: 10 }, [], 10)).toBeNull();
        expect(indoorDressMarkers(ops, null, [], 10)).toBeNull();
        const markers = indoorDressMarkers(ops, { gridSize: 10, items: [], pois: [] }, [], 10);
        expect(markers[0]).toMatchObject({ x: 5, y: 6, valid: true });
    });

    it('indoor: off-grid adds flag invalid against gridSize', () => {
        const [m] = indoorDressMarkers(
            [{ op: 'add', target: 'item', item: { type: 'chest' }, gridX: 30, gridY: 1 }],
            { gridSize: 30 }, [], 30,
        );
        expect(m.valid).toBe(false);
    });

    it('hex: only cells that exist in terrain are valid; POI lane resolves removes', () => {
        const terrain = { '5,6': 'forest' };
        const [remove] = hexDressMarkers([{ op: 'remove', target: 'poi', id: 'poi-0' }], { pois: DOC.pois, terrain });
        expect(remove).toMatchObject({ kind: 'remove', x: 5, y: 6, valid: true });
        const [add] = hexDressMarkers(
            [{ op: 'add', target: 'poi', poi: { name: 'Ruins' }, gridX: 9, gridY: 9 }],
            { pois: [], terrain },
        );
        expect(add).toMatchObject({ kind: 'add', x: 9, y: 9, valid: false });
    });
});
