// @maintained-by-ai
// CLA-360 second-turn rows at the mount-merge seam: the Thief's-Reflexes
// "(Second Turn)" transport row is type:'player' by design but its name is
// suffixed, so the ghost-player name filter must exempt it (bug-initiative-
// remount-drops-second-turn-row: re-mounting Initiative silently evicted the
// row while the once-per-combat use stayed spent). Hygiene face: an orphaned
// row whose holderName is no longer a campaign character still drops. Base
// merge contract bytes stay in initiativeService.test.js.
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

// Verbatim shape pushed by thiefsReflexesService.maybeGrantThiefsReflexesSecondTurn.
const secondTurnByte = (holder, init) => ({
    name: `${holder} (Second Turn)`,
    type: 'player',
    initiative: String(init),
    targetName: null,
    concentration: null,
    secondTurn: true,
    holderName: holder,
});

describe('mergeCombatSummaryWithCharacters keeps second-turn rows', () => {
    it('survives the remount merge and keeps its init-desc slot', () => {
        const board = {
            round: 1,
            creatures: [
                { name: 'Ann', type: 'player', initiative: '20' },
                secondTurnByte('Ann', 10),
            ],
        };
        const merged = mergeCombatSummaryWithCharacters(board, [{ name: 'Ann' }], getName);
        const row = merged.creatures.find(c => c.name === 'Ann (Second Turn)');
        expect(row).toBeDefined();
        expect(row).toMatchObject({
            type: 'player',
            initiative: '10',
            secondTurn: true,
            holderName: 'Ann',
        });
        expect(merged.creatures.map(c => c.name)).toEqual(['Ann', 'Ann (Second Turn)']);
    });

    it('is not polluted by the monster-default leg (no phantom HP/saveBonuses, targetName kept)', () => {
        const board = {
            round: 1,
            creatures: [secondTurnByte('Ann', 10)],
        };
        const merged = mergeCombatSummaryWithCharacters(board, [{ name: 'Ann' }], getName);
        expect(merged.creatures[0]).toEqual(secondTurnByte('Ann', 10));
    });

    it('still appends a campaign character missing from the board alongside the row', () => {
        const board = {
            round: 1,
            creatures: [secondTurnByte('Ann', 6)],
        };
        const merged = mergeCombatSummaryWithCharacters(board, [{ name: 'Ann' }, { name: 'Zoe' }], getName);
        expect(merged.creatures.some(c => c.name === 'Ann (Second Turn)')).toBe(true);
        expect(merged.creatures.find(c => c.name === 'Zoe')).toMatchObject({ type: 'player', initiative: '' });
    });

    it('hygiene: drops a second-turn row whose holder is no longer a campaign character', () => {
        const board = {
            round: 1,
            creatures: [
                { name: 'Bob', type: 'player', initiative: '12' },
                secondTurnByte('Ghostly', 2),
            ],
        };
        const merged = mergeCombatSummaryWithCharacters(board, [{ name: 'Bob' }], getName);
        expect(merged.creatures.map(c => c.name)).toEqual(['Bob']);
    });

    it('genuine ghost player rows (no secondTurn flag) are still evicted', () => {
        const board = {
            round: 1,
            creatures: [
                { name: 'Ann', type: 'player', initiative: '20' },
                secondTurnByte('Ann', 10),
                { name: 'OldPlayer', type: 'player', initiative: '8' },
            ],
        };
        const merged = mergeCombatSummaryWithCharacters(board, [{ name: 'Ann' }], getName);
        expect(merged.creatures.map(c => c.name)).toEqual(['Ann', 'Ann (Second Turn)']);
    });
});
