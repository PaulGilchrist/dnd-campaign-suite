// @maintained-by-ai 2026-11-20
// Lane: map3dCensus — the pure per-origin census counts + header line behind
// the 3D scene-header chip (owner ruling 2026-11-20 "count only
// live-visible"). The counts must be derived from the SAME predicates the
// scene's build dispatch uses (map3dVisibility.js), so the header always
// mirrors getCensus() for the origin rendering: a culled (hidden/fogged)
// creature never masquerades as a live monster, ghosted memories surface as
// a separate `N last known` term, and the GM lane keeps the full doc counts
// (isLocalhost short-circuits every gate). Pluralization: 1 singular, 0/2+
// plural; the ghost term has no plural noun.
import { describe, it, expect } from 'vitest';
import { censusCounts, buildCensusLine } from './map3dCensus.js';

const monster = (over = {}) => ({
    id: 'm1', type: 'monster', name: 'Goblin', gridX: 1, gridY: 1, visible: true, ...over,
});

const data = (over = {}) => ({
    walls: new Set(),
    placedItems: [],
    players: [],
    fog: new Set(),
    isLocalhost: false,
    ghostCells: null,
    ...over,
});

describe('map3dCensus.censusCounts (per-origin live-visible counts)', () => {
    it('visitor: hidden and fog-culled creatures leave the live counts; visible ones stay', () => {
        const counts = censusCounts(data({
            placedItems: [
                monster({ id: 'm1' }),                                    // live
                monster({ id: 'm2', name: 'Hidden', visible: false }),    // hidden → culled
                monster({ id: 'm3', name: 'Fogged', gridX: 8, gridY: 2 }),// fog-culled
                { id: 'n1', type: 'npc', name: 'Orc', gridX: 2, gridY: 1, visible: true },
                { id: 'n2', type: 'npc', name: 'Fogged Orc', gridX: 8, gridY: 2, visible: true },
            ],
            fog: new Set(['8,2']),
        }));
        expect(counts.monsters).toBe(1);
        expect(counts.npcs).toBe(1);
        expect(counts.lastKnown).toBe(0); // memories need ghostCells, not presence
    });

    it('GM lane passes every gate: full doc counts regardless of visibility flags or fog', () => {
        const counts = censusCounts(data({
            isLocalhost: true,
            walls: new Set(['0,0', '5,5']),
            fog: new Set(['5,5']),
            placedItems: [
                monster(),
                monster({ id: 'm2', visible: false }),
                monster({ id: 'm3', gridX: 8, gridY: 2 }),
                { id: 'd1', type: 'secretDoor', name: 'Door', gridX: 4, gridY: 4, visible: true },
            ],
            players: [{ id: 'p1', name: 'Aria', gridX: 8, gridY: 2 }],
        }));
        expect(counts).toEqual({
            walls: 2, items: 1, players: 1, npcs: 0, monsters: 3, lastKnown: 0,
        });
    });

    it('all lanes mirror the build dispatch: fog-gated walls/players/props, visitor secret-door skip', () => {
        const counts = censusCounts(data({
            walls: new Set(['0,0', '5,5']),
            fog: new Set(['5,5', '6,1']),
            placedItems: [
                { id: 'b1', type: 'barrel', gridX: 3, gridY: 3, visible: true },
                { id: 'b2', type: 'barrel', gridX: 6, gridY: 1, visible: true }, // fog-culled
                { id: 'd1', type: 'secretDoor', gridX: 4, gridY: 4, visible: true }, // visitor skip
            ],
            players: [
                { id: 'p1', name: 'Aria', gridX: 1, gridY: 1 },
                { id: 'p2', name: 'Bram', gridX: 5, gridY: 5 }, // fogged cell
            ],
        }));
        expect(counts).toEqual({
            walls: 1, items: 1, players: 1, npcs: 0, monsters: 0, lastKnown: 0,
        });
    });

    it('last-known lane mirrors _buildLastKnownTokens: creature memory on a NOT-live-visible token only (upgrade law)', () => {
        const ghostCells = new Map([
            ['m1', { gridX: 2, gridY: 1 }], // current cell visible → truth owns it
            ['m3', { gridX: 2, gridY: 2 }], // fog-culled with memory → ghost
        ]);
        const counts = censusCounts(data({
            fog: new Set(['8,2']),
            placedItems: [monster({ id: 'm1' }), monster({ id: 'm3', gridX: 8, gridY: 2 })],
            ghostCells,
        }));
        expect(counts.monsters).toBe(1); // the visible one, never the ghost
        expect(counts.lastKnown).toBe(1);
    });

    it('missing inputs are inert', () => {
        expect(censusCounts(data({ walls: undefined, placedItems: undefined, players: undefined, fog: undefined })))
            .toEqual({ walls: 0, items: 0, players: 0, npcs: 0, monsters: 0, lastKnown: 0 });
    });
});

describe('map3dCensus.buildCensusLine (plural + ghost term)', () => {
    it('every term reads correct singular at 1, including the last-known term', () => {
        const line = buildCensusLine(data({
            walls: new Set(['0,0']),
            placedItems: [
                monster(),
                { id: 'b1', type: 'barrel', gridX: 3, gridY: 3, visible: true },
                { id: 'n1', type: 'npc', name: 'Orc', gridX: 2, gridY: 2, visible: true },
                monster({ id: 'm3', gridX: 8, gridY: 2 }),
            ],
            fog: new Set(['8,2']),
            players: [{ id: 'p1', name: 'Aria', gridX: 1, gridY: 2 }],
            ghostCells: new Map([['m3', { gridX: 2, gridY: 1 }]]),
        }));
        expect(line).toBe('1 wall · 1 item · 1 player · 1 npc · 1 monster · 1 last known');
    });

    it('all-zero census reads the single nothing-revealed face, same for every origin (GM on an empty map too)', () => {
        expect(buildCensusLine(data())).toBe('Nothing revealed yet');
        expect(buildCensusLine(data({ isLocalhost: true }))).toBe('Nothing revealed yet');
    });

    it('each count breaking zero on its own keeps the normal line (no nothing-revealed face)', () => {
        expect(buildCensusLine(data({ walls: new Set(['0,0']) })))
            .toBe('1 wall · 0 items · 0 players · 0 npcs · 0 monsters');
        expect(buildCensusLine(data({
            placedItems: [{ id: 'b1', type: 'barrel', gridX: 3, gridY: 3, visible: true }],
        }))).toBe('0 walls · 1 item · 0 players · 0 npcs · 0 monsters');
        expect(buildCensusLine(data({
            players: [{ id: 'p1', name: 'Aria', gridX: 1, gridY: 2 }],
        }))).toBe('0 walls · 0 items · 1 player · 0 npcs · 0 monsters');
        expect(buildCensusLine(data({
            placedItems: [{ id: 'n1', type: 'npc', name: 'Orc', gridX: 2, gridY: 1, visible: true }],
        }))).toBe('0 walls · 0 items · 0 players · 1 npc · 0 monsters');
        expect(buildCensusLine(data({ placedItems: [monster()] })))
            .toBe('0 walls · 0 items · 0 players · 0 npcs · 1 monster');
    });

    it('last-known-only renders the normal line with the ghost tail, never the nothing-revealed face', () => {
        const line = buildCensusLine(data({
            fog: new Set(['8,2']),
            placedItems: [monster({ id: 'm1', gridX: 8, gridY: 2 })],
            ghostCells: new Map([['m1', { gridX: 1, gridY: 1 }]]),
        }));
        expect(line).toBe('0 walls · 0 items · 0 players · 0 npcs · 0 monsters · 1 last known');
    });

    it('plural zeros survive beside a live term and the ghost term disappears at zero (GM line shape unchanged)', () => {
        expect(buildCensusLine(data({
            isLocalhost: true,
            placedItems: [monster(), monster({ id: 'm2' })],
        }))).toBe('0 walls · 0 items · 0 players · 0 npcs · 2 monsters');
    });

    it('two ghosts keep the same uncountable wording', () => {
        const line = buildCensusLine(data({
            fog: new Set(['8,2', '8,3']),
            placedItems: [
                monster({ id: 'm1', gridX: 8, gridY: 2 }),
                monster({ id: 'm2', gridX: 8, gridY: 3 }),
            ],
            ghostCells: new Map([['m1', { gridX: 1, gridY: 1 }], ['m2', { gridX: 1, gridY: 2 }]]),
        }));
        expect(line).toBe('0 walls · 0 items · 0 players · 0 npcs · 0 monsters · 2 last known');
    });
});
