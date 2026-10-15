// @maintained-by-ai
// Deterministic contract tests for the Fast Hands bonus-action handler:
// popup/modal shapes, exact '_FastHands_usedRound' latch delegation through
// the oncePerTurn seam (latch internals are pinned in oncePerTurn.test.js —
// here we pin only the handler seam), option-description composition, the
// ability_use log contract, and addEntry-failure resilience. Pure
// data-in/data-out over mocked seams — no timers, no DOM, no app churn.
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

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

import { handle, applyFastHands } from './fastHandsHandler.js';

beforeEach(() => {
    vi.clearAllMocks();
    // Order-independent defaults: latch unset, round 1 on the mirror.
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: 'TestRogue' });
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
        it('returns error popup when options are empty or missing', async () => {
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

            // Raw action without an options key exercises the `auto.options || []` guard.
            const missingResult = await handle(
                { name: 'Fast Hands', automation: { type: 'fast_hands' } },
                makePlayerStats(),
                'test-campaign'
            );

            expect(missingResult.type).toBe('popup');
            expect(missingResult.payload.description).toContain('no options available');
            expect(missingResult.payload.automation).toEqual({ type: 'fast_hands' });
        });

        it.each([
            ['omitted', {}],
            ['false', { oncePerTurn: false }],
        ])('returns modal and skips the latch check when oncePerTurn is %s', async (_label, automationOverride) => {
            const action = makeAction({ automation: automationOverride });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bonusActionChoice');
            expect(result.payload.action).toBe(action);
            expect(result.payload.options).toHaveLength(3);

            const names = result.payload.options.map(o => o.name);
            expect(names).toContain('Sleight of Hand');
            expect(names).toContain("Thieves' Tools");
            expect(names).toContain('Use an Object');

            // Falsy oncePerTurn must never consult the once-per-turn latch.
            expect(getCombatContext).not.toHaveBeenCalled();
            expect(getRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns once-per-turn popup when the latch was set this round', async () => {
            getCombatContext.mockResolvedValue({ round: 3, activeCreatureName: 'TestRogue' });
            getRuntimeValue.mockReturnValue({ round: 3, activeCreature: 'TestRogue' });

            const action = makeAction({ automation: { oncePerTurn: true } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(getRuntimeValue).toHaveBeenCalledWith('TestRogue', '_FastHands_usedRound');
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
    });

    describe('applyFastHands', () => {
        it.each([
            ['Sleight of Hand', 'Sleight of Hand selected', 'Dexterity (Sleight of Hand) check'],
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
            expect(result.payload.automation).toEqual(action.automation);
        });

        it('returns error for unknown option', async () => {
            const action = makeAction();
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Nonexistent');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Fast Hands');
            expect(result.payload.description).toContain('Unknown option: Nonexistent');
            expect(result.payload.automation).toEqual(action.automation);
        });

        it('uses option description and preserves custom action name for custom options', async () => {
            const action = makeAction({
                name: 'My Fast Hands',
                automation: {
                    type: 'fast_hands',
                    options: [{ name: 'Custom Option', description: 'A custom description.' }],
                },
            });
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Custom Option');

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('My Fast Hands');
            expect(result.payload.description).toContain('Custom Option selected');
            expect(result.payload.description).toContain('My Fast Hands: A custom description.');
            expect(result.payload.automation).toEqual(action.automation);
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
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result.payload.description).toContain('Sleight of Hand selected');
        });

        it('calls addEntry with correct parameters', async () => {
            const action = makeAction();
            await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestRogue',
                abilityName: 'Fast Hands',
                description: 'Sleight of Hand selected',
            });
        });

        it('still returns the selection popup when the log call fails', async () => {
            addEntry.mockRejectedValueOnce(new Error('log down'));
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const action = makeAction();
            const result = await applyFastHands(action, makePlayerStats(), 'test-campaign', 'Sleight of Hand');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Sleight of Hand selected');
            expect(errorSpy).toHaveBeenCalled();

            errorSpy.mockRestore();
        });
    });
});
