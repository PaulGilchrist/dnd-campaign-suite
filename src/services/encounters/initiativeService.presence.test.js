// @maintained-by-ai
// Split-party presence at the initiativeService seam: navigation skips away
// rows (incl. the away-active seam + degenerate board), isPreviousDisabled
// compares against the first PRESENT creature, and the mount merge preserves
// `away` while parking those rows at the back. Base navigation bytes stay in
// initiativeService.test.js; only the away-aware deltas are pinned here.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../dice/diceRoller.js', () => ({ rollD20: vi.fn() }));
vi.mock('../ui/dataLoader.js', () => ({ loadMonsters: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

import {
    getNextCreatureName,
    getPreviousCreatureName,
    isPreviousDisabled,
    mergeCombatSummaryWithCharacters,
} from './initiativeService.js';

// Board: Ann(20) · Bob(15) · Cy(10, AWAY) · Goblin(5) — sort order as stored.
const board = () => ({
    round: 1,
    creatures: [
        { name: 'Ann', type: 'player', initiative: '20' },
        { name: 'Bob', type: 'player', initiative: '15' },
        { name: 'Cy', type: 'player', initiative: '', away: true },
        { name: 'Goblin', type: 'npc', initiative: '5' },
    ],
});

describe('getNextCreatureName skips away rows', () => {
    it('steps over the away row mid-board', () => {
        expect(getNextCreatureName(board(), 'Bob')).toEqual({ newActiveName: 'Goblin', roundIncrement: false });
    });
    it('wraps on PRESENT rows only (away tail does not stall the round)', () => {
        expect(getNextCreatureName(board(), 'Goblin')).toEqual({ newActiveName: 'Ann', roundIncrement: true });
    });
    it('active creature itself away → nearest present AFTER it, no round increment', () => {
        expect(getNextCreatureName(board(), 'Cy')).toEqual({ newActiveName: 'Goblin', roundIncrement: false });
        // Away row with nobody present after it → first present, still no increment.
        const only = { round: 1, creatures: [{ name: 'Ann', type: 'player', initiative: '1' }, { name: 'Bo', type: 'player', initiative: '2', away: true }] };
        expect(getNextCreatureName(only, 'Bo')).toEqual({ newActiveName: 'Ann', roundIncrement: false });
    });
    it('degenerate board (nobody present) falls back to the legacy full walk', () => {
        const gone = { round: 2, creatures: [
            { name: 'Ann', type: 'player', initiative: '', away: true },
            { name: 'Bo', type: 'player', initiative: '', away: true },
        ] };
        expect(getNextCreatureName(gone, 'Ann')).toEqual({ newActiveName: 'Bo', roundIncrement: false });
        expect(getNextCreatureName(gone, 'Bo')).toEqual({ newActiveName: 'Ann', roundIncrement: true });
    });
});

describe('getPreviousCreatureName skips away rows', () => {
    it('steps back over the away row', () => {
        expect(getPreviousCreatureName(board(), 'Goblin')).toEqual({ newActiveName: 'Bob', roundDecrement: false });
    });
    it('back-walk from the first present decrements the round', () => {
        expect(getPreviousCreatureName(board(), 'Ann')).toEqual({ newActiveName: 'Goblin', roundDecrement: true });
    });
    it('active away → nearest present BEFORE it, no round decrement', () => {
        expect(getPreviousCreatureName(board(), 'Cy')).toEqual({ newActiveName: 'Bob', roundDecrement: false });
    });
});

describe('isPreviousDisabled with an away head', () => {
    it('compares against the first PRESENT creature', () => {
        const awayHead = { round: 1, creatures: [
            { name: 'Ann', type: 'player', initiative: '', away: true },
            { name: 'Bob', type: 'player', initiative: '15' },
        ] };
        expect(isPreviousDisabled(awayHead, 'Bob')).toBe(true);
        expect(isPreviousDisabled(awayHead, 'Ann')).toBe(false);
    });
});

describe('mergeCombatSummaryWithCharacters preserves presence', () => {
    const getName = n => n;
    it('keeps away===true across the mount merge and parks it at the back', () => {
        const merged = mergeCombatSummaryWithCharacters(board(), [{ name: 'Ann' }, { name: 'Bob' }, { name: 'Cy' }], getName);
        expect(merged.creatures.find(c => c.name === 'Cy').away).toBe(true);
        expect(merged.creatures.map(c => c.name)).toEqual(['Ann', 'Bob', 'Goblin', 'Cy']);
    });
    it('a freshly merged-in player defaults to present (no away key)', () => {
        const merged = mergeCombatSummaryWithCharacters(
            { round: 1, creatures: [{ name: 'Ann', type: 'player', initiative: '5' }] },
            [{ name: 'Ann' }, { name: 'Newbie' }],
            getName
        );
        expect(merged.creatures.find(c => c.name === 'Newbie').away).toBeUndefined();
    });
});
