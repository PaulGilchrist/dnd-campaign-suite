// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);
const { getCurrentCombatRound } = await import(
    '../../../../services/encounters/combatData.js'
);

import { handle, applyFastHands } from './fastHandsHandler.js';
import * as logService from '../../../ui/logService.js';

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
        });

        it('returns modal with available options list', async () => {
            const action = makeAction();
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            const names = result.payload.options.map(o => o.name);
            expect(names).toContain('Sleight of Hand');
            expect(names).toContain("Thieves' Tools");
            expect(names).toContain('Use an Object');
        });

        it('returns once-per-turn error popup when already used this round', async () => {
            getCurrentCombatRound.mockReturnValue(3);
            getRuntimeValue.mockReturnValue(3);

            const action = makeAction({ automation: { oncePerTurn: true } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fast Hands');
            expect(result.payload.description).toContain('once per turn');
            expect(result.payload.automation.oncePerTurn).toBe(true);
            expect(result.payload.automation.type).toBe('fast_hands');
            expect(result.payload.automation.options).toHaveLength(3);
        });

        it('returns modal when oncePerTurn is true but not yet used this round', async () => {
            getCurrentCombatRound.mockReturnValue(3);
            getRuntimeValue.mockReturnValue(2);

            const action = makeAction({ automation: { oncePerTurn: true } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bonusActionChoice');
        });

        it('skips oncePerTurn check when oncePerTurn is not set', async () => {
            getCurrentCombatRound.mockReturnValue(3);
            getRuntimeValue.mockReturnValue(3);

            const action = makeAction({ automation: { oncePerTurn: false } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bonusActionChoice');
        });

        it('calls getCurrentCombatRound and getRuntimeValue for oncePerTurn check', async () => {
            getCurrentCombatRound.mockReturnValue(5);
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { oncePerTurn: true } });
            await handle(action, makePlayerStats(), 'test-campaign');

            expect(getCurrentCombatRound).toHaveBeenCalledOnce();
            expect(getRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                '_FastHands_usedRound',
                'test-campaign'
            );
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
            expect(result.payload.description).toContain("pick a lock");
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

        it('includes automation in payload', async () => {
            const action = makeAction({ automation: { type: 'fast_hands', custom: true } });
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(result.payload.automation).toEqual(action.automation);
        });

        it('tracks oncePerTurn usage by calling setRuntimeValue', async () => {
            getCurrentCombatRound.mockReturnValue(7);

            const action = makeAction({ automation: { oncePerTurn: true } });
            await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestRogue',
                '_FastHands_usedRound',
                7,
                'test-campaign',
                true
            );
        });

        it('does not call setRuntimeValue when oncePerTurn is false', async () => {
            const action = makeAction({ automation: { oncePerTurn: false } });
            await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not call setRuntimeValue when oncePerTurn is not set', async () => {
            const action = makeAction({ automation: {} });
            await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

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

// ── applyFastHands: campaign logging ────────────────────────────

describe('applyFastHands — campaign logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('logs campaign entry when Sleight of Hand is selected', () => {
        const action = makeAction();
        const ps = makePlayerStats();

        applyFastHands(action, ps, 'test-campaign', 'Sleight of Hand');

        expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Fast Hands',
            description: 'Sleight of Hand selected',
        });
    });

    it('logs campaign entry when Thieves\' Tools is selected', () => {
        const action = makeAction();
        const ps = makePlayerStats();

        applyFastHands(action, ps, 'test-campaign', "Thieves' Tools");

        expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Fast Hands',
            description: "Thieves' Tools selected",
        });
    });

    it('logs campaign entry when Use an Object is selected', () => {
        const action = makeAction();
        const ps = makePlayerStats();

        applyFastHands(action, ps, 'test-campaign', 'Use an Object');

        expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'ability_use',
            characterName: ps.name,
            abilityName: 'Fast Hands',
            description: 'Use an Object selected',
        });
    });
});
