// @maintained-by-ai
// FW 2026-11-09 improve: the mount merge used to return only {round, creatures}, silently
// DISCARDING a seeded/baked combatSummary.activeCreatureName — the GM mount POST then
// wiped the pointer from the server mirror and the fresh board's "active" card contradicted
// both the mirror and the seeder's intent. Law pinned here: mergeCombatSummaryWithCharacters
// preserves the pointer when it names a row that SURVIVED the merge (a (Second Turn) twin
// counts via its own synthetic name while its holder keeps the row) and drops it when the
// named row was evicted. Mount-side preference lives in Initiative.mount-active-creature.test.jsx.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../dice/diceRoller.js', () => ({ rollD20: vi.fn() }));
vi.mock('../ui/dataLoader.js', () => ({ loadMonsters: vi.fn(() => Promise.resolve([])) }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    getAllStoreKeys: vi.fn(() => []),
}));

import { mergeCombatSummaryWithCharacters } from './initiativeService.js';

const getName = n => n;

const playerByte = (name, init) => ({
    name,
    type: 'player',
    initiative: String(init),
    targetName: null,
    concentration: null,
});

// Verbatim shape pushed by thiefsReflexesService.maybeGrantThiefsReflexesSecondTurn.
const secondTurnByte = (holder, init) => ({
    ...playerByte(`${holder} (Second Turn)`, init),
    secondTurn: true,
    holderName: holder,
});

describe('mergeCombatSummaryWithCharacters activeCreatureName pointer', () => {
    it('preserves a pointer naming a row that survives the merge', () => {
        const board = {
            round: 2,
            activeCreatureName: 'Bob',
            creatures: [
                playerByte('Ann', 20),
                playerByte('Bob', 10),
            ],
        };
        const merged = mergeCombatSummaryWithCharacters(board, [{ name: 'Ann' }, { name: 'Bob' }], getName);
        expect(merged.activeCreatureName).toBe('Bob');
        expect(merged.creatures.map(c => c.name)).toEqual(['Ann', 'Bob']);
    });

    it('preserves a pointer naming a surviving (Second Turn) twin row (kept via holderName)', () => {
        const board = {
            round: 1,
            activeCreatureName: 'Ann (Second Turn)',
            creatures: [
                playerByte('Ann', 20),
                secondTurnByte('Ann', 10),
            ],
        };
        const merged = mergeCombatSummaryWithCharacters(board, [{ name: 'Ann' }], getName);
        expect(merged.creatures.some(c => c.name === 'Ann (Second Turn)')).toBe(true);
        expect(merged.activeCreatureName).toBe('Ann (Second Turn)');
    });

    it('drops the pointer when the named row was evicted by the merge (ghost player)', () => {
        const board = {
            round: 1,
            activeCreatureName: 'OldPlayer',
            creatures: [
                playerByte('Ann', 20),
                playerByte('OldPlayer', 8),
            ],
        };
        const merged = mergeCombatSummaryWithCharacters(board, [{ name: 'Ann' }], getName);
        expect(merged.creatures.map(c => c.name)).toEqual(['Ann']);
        expect(merged.activeCreatureName).toBeUndefined();
    });

    it('drops the pointer naming an orphaned second-turn twin (holder no longer a character)', () => {
        const board = {
            round: 1,
            activeCreatureName: 'Ghostly (Second Turn)',
            creatures: [
                playerByte('Bob', 12),
                secondTurnByte('Ghostly', 2),
            ],
        };
        const merged = mergeCombatSummaryWithCharacters(board, [{ name: 'Bob' }], getName);
        expect(merged.creatures.map(c => c.name)).toEqual(['Bob']);
        expect(merged.activeCreatureName).toBeUndefined();
    });

    it('adds no pointer field to a board that never carried one (fallback stays mount-side)', () => {
        const board = {
            round: 1,
            creatures: [playerByte('Ann', 20)],
        };
        const merged = mergeCombatSummaryWithCharacters(board, [{ name: 'Ann' }], getName);
        expect('activeCreatureName' in merged).toBe(false);
    });

    it('no-creatures branch keeps its original {round, creatures} bytes', () => {
        expect(mergeCombatSummaryWithCharacters(undefined, [{ name: 'Ann' }], getName)).toEqual({
            round: 1,
            creatures: [playerByte('Ann', '')],
        });
    });
});
