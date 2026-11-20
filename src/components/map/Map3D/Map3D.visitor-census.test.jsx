// @maintained-by-ai
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Map3D from './Map3D.jsx';

// Visitor census line lane (owner ruling 2026-11-20 "count only live-visible"):
// the header chip used to read RAW doc counts, so a visitor watched the culled
// scene say "1 monsters" for a token the build dispatch never rendered. Map3D
// is a pure consumer of map3dCensus (shared with the scene's predicates) —
// the derivation itself is pinned in ./map3dCensus.test.js; this file pins the
// component wiring: per-origin rendering of the line, the ghost term, and the
// LIVE update seam (the memo rebuilds on the same reactive inputs as the
// scene — fog flip / memory change repaint the chip without a remount).
// The scene is mocked; three.js is never loaded here.

const buildMapMock = vi.fn();

vi.mock('./map3dScene.js', () => ({
    Map3DScene: class {
        init() { return Promise.resolve(); }
        buildMap(data) { buildMapMock(data); }
        setToggles() {}
        updateSpellOverlays() {}
        topDown() {}
        dispose() {}
    },
}));

const mapData = (over = {}) => ({
    displayName: 'Visitor Map',
    gridSize: 10,
    walls: new Set(['0,0', '5,5']),
    players: [{ id: 'p1', name: 'Aria', gridX: 1, gridY: 2 }],
    bgFill: '#1a1a1a',
    ...over,
});

// m1 live & seen, m2 hidden (visible:false), m3 fog-culled at (8,2).
const placedItems = [
    { id: 'm1', type: 'monster', name: 'Goblin 1', gridX: 1, gridY: 1, visible: true },
    { id: 'm2', type: 'monster', name: 'Goblin 2', gridX: 1, gridY: 3, visible: false },
    { id: 'm3', type: 'monster', name: 'Goblin 3', gridX: 8, gridY: 2, visible: true },
    { id: 'n1', type: 'npc', name: 'Orc', gridX: 2, gridY: 1, visible: true },
];

const fog = new Set(['5,5', '8,2']);

const visitorProps = (over = {}) => ({
    campaignName: 'test-campaign',
    mapData: mapData(),
    placedItems,
    characters: [],
    isLocalhost: false,
    fog,
    npcImages: {},
    ghostCells: null,
    onExit: vi.fn(),
    ...over,
});

const chipText = () => document.querySelector('.map3d-counts').textContent;

const renderVisitor = (over = {}) => {
    const props = visitorProps(over);
    return { ...render(<Map3D {...props} />), props };
};

describe('Map3D visitor census line (count only live-visible)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('visitor excludes hidden and fog-culled monsters from the live counts; GM keeps the full doc counts', () => {
        const visitor = renderVisitor();
        // 3 monster rows in the doc → only m1 is live-rendered; the fogged
        // wall cell 5,5 is culled too (same mirror law on every lane).
        expect(visitor.container.querySelector('.map3d-counts').textContent)
            .toBe('1 wall · 0 items · 1 player · 1 npc · 1 monster');
        visitor.unmount();

        const gm = render(<Map3D {...visitorProps({ isLocalhost: true })} />);
        expect(gm.container.querySelector('.map3d-counts').textContent)
            .toBe('2 walls · 0 items · 1 player · 1 npc · 3 monsters');
    });

    it('ghost face: a last-seen memory surfaces as `N last known` and never counts as a live monster', () => {
        renderVisitor({ ghostCells: new Map([['m3', { gridX: 2, gridY: 2 }]]) });
        expect(chipText()).toBe('1 wall · 0 items · 1 player · 1 npc · 1 monster · 1 last known');
    });

    it('live-updates with no remount when fog flips or the ghost memory lands/changes', async () => {
        const { props, rerender } = renderVisitor();
        expect(chipText()).toBe('1 wall · 0 items · 1 player · 1 npc · 1 monster');

        // GM opens a new area (SSE-revealed fog shrinks the visitor's set):
        // m3 re-reveals as a live monster, the fogged wall returns.
        await act(async () => { rerender(<Map3D {...props} fog={new Set(['5,5'])} />); });
        expect(chipText()).toBe('1 wall · 0 items · 1 player · 1 npc · 2 monsters');

        // Fog swallows m3 again while the Last-Seen lane holds a memory.
        await act(async () => {
            rerender(<Map3D {...props} fog={fog} ghostCells={new Map([['m3', { gridX: 2, gridY: 2 }]])} />);
        });
        expect(chipText()).toBe('1 wall · 0 items · 1 player · 1 npc · 1 monster · 1 last known');

        // Toggle OFF (ghostCells null) drops the memory term (byte-cull parity).
        await act(async () => { rerender(<Map3D {...props} ghostCells={null} />); });
        expect(chipText()).toBe('1 wall · 0 items · 1 player · 1 npc · 1 monster');
    });

    it('a token whose current cell is visible never double-counts: the memory upgrades to live (truth owns it)', () => {
        renderVisitor({ ghostCells: new Map([['m1', { gridX: 4, gridY: 4 }]]) });
        expect(chipText()).toBe('1 wall · 0 items · 1 player · 1 npc · 1 monster');
        expect(chipText()).not.toMatch(/last known/);
    });
});
