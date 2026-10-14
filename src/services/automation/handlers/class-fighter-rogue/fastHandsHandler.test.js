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
        it('returns error popup when no options available (empty array or undefined)', async () => {
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

        it('returns once-per-turn error when already used this turn', async () => {
            getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'TestRogue' });
            getRuntimeValue.mockReturnValue({ round: 3, activeCreature: 'TestRogue' });

            const action = makeAction({ automation: { oncePerTurn: true } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fast Hands');
            expect(result.payload.description).toContain('once per turn');
        });

        it('returns modal when oncePerTurn round has advanced past stored round', async () => {
            getCombatContext.mockResolvedValue({ round: 4, activeCreatureName: 'TestRogue' });
            getRuntimeValue.mockReturnValue({ round: 3, activeCreature: 'TestRogue' });

            const action = makeAction({ automation: { oncePerTurn: true } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bonusActionChoice');
        });

        it('returns once-per-turn error when creature differs from stored', async () => {
            getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'OtherCreature' });
            getRuntimeValue.mockReturnValue({ round: 3, activeCreature: 'TestRogue' });

            const action = makeAction({ automation: { oncePerTurn: true } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('once per turn');
        });

        it('returns modal when oncePerTurn is false or undefined', async () => {
            getRuntimeValue.mockReturnValue({ round: 3, activeCreature: 'TestRogue' });

            const action = makeAction({ automation: { oncePerTurn: false } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bonusActionChoice');
        });
    });

    describe('applyFastHands', () => {
        it.each([
            ['Sleight of Hand', 'Sleight of Hand selected', 'Sleight of Hand'],
            ["Thieves' Tools", "Thieves' Tools selected", "pick a lock"],
            ['Use an Object', 'Use an Object selected', 'Utilize action'],
        ])('handles %s option', async (optionName, selectedText, descriptionFragment) => {
            const action = makeAction();
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', optionName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fast Hands');
            expect(result.payload.description).toContain(selectedText);
            expect(result.payload.description).toContain(descriptionFragment);
            expect(result.payload.automation).toBeDefined();
        });

        it('returns error for unknown option', async () => {
            const action = makeAction();
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Nonexistent');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fast Hands');
            expect(result.payload.description).toContain('Unknown option');
            expect(result.payload.description).toContain('Nonexistent');
            expect(result.payload.automation).toBeDefined();
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

        it('does not call setRuntimeValue when oncePerTurn is false', async () => {
            const action = makeAction({ automation: { oncePerTurn: false } });
            await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('calls addEntry with correct parameters', async () => {
            const { addEntry } = await import('../../../ui/logService.js');

            const action = makeAction();
            await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestRogue',
                abilityName: 'Fast Hands',
                description: 'Sleight of Hand selected',
            });
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
            expect(result.payload.automation).toBeDefined();
        });

        it('preserves action name in payload for unknown option', async () => {
            const action = makeAction({ name: 'My Fast Hands' });
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Nonexistent');

            expect(result.payload.name).toBe('My Fast Hands');
            expect(result.payload.description).toContain('Unknown option: Nonexistent');
            expect(result.payload.automation).toBeDefined();
        });
    });
});
