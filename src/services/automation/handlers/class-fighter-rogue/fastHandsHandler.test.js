// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);
const { getCombatContext } = await import(
    '../../../rules/combat/damageUtils.js'
);

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
    const baseOptions = [
        { name: 'Sleight of Hand', description: 'Make a Sleight of Hand check.' },
        { name: "Thieves' Tools", description: "Use thieves' tools." },
        { name: 'Use an Object', description: 'Use an object.' },
    ];

    const { automation: overrideAutomation, ...restOverrides } = overrides;

    const automation = {
        type: 'fast_hands',
        options: overrideAutomation?.options ?? baseOptions,
        ...overrideAutomation,
    };

    return {
        name: 'Fast Hands',
        automation,
        ...restOverrides,
    };
}

describe('fastHandsHandler', () => {
    describe('handle', () => {
        it('returns error popup when no options available', async () => {
            const result = await handle(
                makeAction({ automation: { options: [] } }),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fast Hands');
            expect(result.payload.description).toContain('no options available');
            expect(result.payload.automation).toEqual({ type: 'fast_hands', options: [] });
        });

        it('returns modal with options when options exist', async () => {
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bonusActionChoice');
            expect(result.payload.options).toHaveLength(3);
            expect(result.payload.action).toBe(action);

            const names = result.payload.options.map(o => o.name);
            expect(names).toContain('Sleight of Hand');
            expect(names).toContain("Thieves' Tools");
            expect(names).toContain('Use an Object');
        });

        it('returns once-per-turn error popup when already used this round', async () => {
            getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'TestRogue' });
            getRuntimeValue.mockReturnValue({ round: 3, activeCreature: 'TestRogue' });

            const action = makeAction({ automation: { oncePerTurn: true } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fast Hands');
            expect(result.payload.description).toContain('once per turn');
        });

        it('returns modal when oncePerTurn is true but not yet used this round', async () => {
            getCombatContext.mockResolvedValue({ round: 4, activeCreatureName: 'TestRogue' });
            getRuntimeValue.mockReturnValue({ round: 3, activeCreature: 'TestRogue' });

            const action = makeAction({ automation: { oncePerTurn: true } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bonusActionChoice');
        });

        it('skips oncePerTurn check when oncePerTurn is not set', async () => {
            getRuntimeValue.mockReturnValue({ round: 3, activeCreature: 'TestRogue' });

            const action = makeAction({ automation: { oncePerTurn: false } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bonusActionChoice');
        });
    });

    describe('applyFastHands', () => {
        it('handles Sleight of Hand option', async () => {
            const action = makeAction();
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fast Hands');
            expect(result.payload.description).toContain('Sleight of Hand selected');
            expect(result.payload.description).toContain('Sleight of Hand');
        });

        it('handles Thieves Tools option', async () => {
            const action = makeAction();
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', "Thieves' Tools");

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain("Thieves' Tools selected");
            expect(result.payload.description).toContain('pick a lock');
        });

        it('handles Use an Object option', async () => {
            const action = makeAction();
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Use an Object');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Use an Object selected');
            expect(result.payload.description).toContain('Utilize action');
        });

        it('returns error for unknown option not in list', async () => {
            const action = makeAction();
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Nonexistent');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fast Hands');
            expect(result.payload.description).toContain('Unknown option');
            expect(result.payload.description).toContain('Nonexistent');
        });

        it('tracks oncePerTurn usage by calling setRuntimeValue', async () => {
            getCombatContext.mockResolvedValue({ round: 7, activeCreatureName: 'TestRogue' });

            const action = makeAction({ automation: { oncePerTurn: true } });
            await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                '_FastHands_usedRound',
                { round: 7, activeCreature: 'TestRogue' },
                'test-campaign'
            );
        });

        it('does not call setRuntimeValue when oncePerTurn is false or not set', async () => {
            const actionFalse = makeAction({ automation: { oncePerTurn: false } });
            await applyFastHands(actionFalse, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(setRuntimeValue).not.toHaveBeenCalled();
            vi.clearAllMocks();

            const actionUndefined = makeAction({ automation: {} });
            await applyFastHands(actionUndefined, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('uses option description for custom option names', async () => {
            const action = makeAction({
                automation: {
                    type: 'fast_hands',
                    options: [{ name: 'Custom Option', description: 'A custom description.' }],
                },
            });
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Custom Option');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Custom Option selected');
            expect(result.payload.description).toContain('A custom description.');
        });

        it('preserves action name in payload for unknown option', async () => {
            const action = makeAction({ name: 'My Fast Hands' });
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Nonexistent');

            expect(result.payload.name).toBe('My Fast Hands');
            expect(result.payload.description).toContain('Unknown option: Nonexistent');
        });
    });
});
