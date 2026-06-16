import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 3),
}));

import { handle, applyFastHands } from './fastHandsHandler.js';

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestRogue',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Fast Hands',
        automation: {
            type: 'fast_hands',
            options: [
                { name: 'Sleight of Hand', description: 'Make a Sleight of Hand check.' },
                { name: 'Thieves\' Tools', description: 'Use thieves\' tools.' },
                { name: 'Use an Object', description: 'Use an object.' },
            ],
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('fastHandsHandler', () => {
    describe('handle', () => {
        it('returns error when no options available', async () => {
            const result = await handle(
                makeAction({ automation: { options: [] } }),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no options available');
        });

        it('returns modal with options', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bonusActionChoice');
            expect(result.payload.options).toHaveLength(3);
            expect(result.payload.action.name).toBe('Fast Hands');
        });

    });

    describe('applyFastHands', () => {
        it('handles Thieves Tools option', () => {
            const action = makeAction();
            const result = applyFastHands(action, makePlayerStats(), 'test-campaign', 'Thieves\' Tools');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Thieves\' Tools selected');
            expect(result.payload.description).toContain('pick a lock');
        });

        it('handles Use an Object option', () => {
            const action = makeAction();
            const result = applyFastHands(action, makePlayerStats(), 'test-campaign', 'Use an Object');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Use an Object selected');
            expect(result.payload.description).toContain('Utilize action');
        });

        it('returns error for unknown option not in list', () => {
            const action = makeAction();
            const result = applyFastHands(action, makePlayerStats(), 'test-campaign', 'Nonexistent');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Unknown option');
        });

        it('includes automation in payload', () => {
            const action = makeAction({ automation: { type: 'fast_hands', custom: true } });
            const result = applyFastHands(action, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(result.payload.automation).toEqual(action.automation);
        });
    });
});
