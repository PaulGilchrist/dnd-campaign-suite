import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, confirmMistyWanderer } from './mistyWandererHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockImplementation(async () => {}),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { evaluateAutoExpression } = await import('../../../combat/automation/automationExpressions.js');
const { addEntry } = await import('../../../ui/logService.js');

function makeAction(overrides = {}) {
    return {
        name: 'Misty Wanderer',
        description: 'Cast Misty Step without spell slot.',
        automation: {
            type: 'misty_wanderer',
            uses_expression: 'WIS modifier_min_1',
            recharge: 'long_rest',
            range: '5_ft',
            casting_time: '1 bonus action',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'Test Character',
        abilities: [
            { name: 'Strength', bonus: 0 },
            { name: 'Dexterity', bonus: 0 },
            { name: 'Constitution', bonus: 0 },
            { name: 'Intelligence', bonus: 0 },
            { name: 'Wisdom', bonus: 3 },
            { name: 'Charisma', bonus: 0 },
        ],
        ...overrides,
    };
}

describe('mistyWandererHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        evaluateAutoExpression.mockReturnValue(3);
    });

    describe('handle', () => {
        it('returns modal with payload when free casts are available', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('mistyWanderer');
            expect(result.payload.usesMax).toBe(3);
            expect(result.payload.action).toBeDefined();
            expect(result.payload.playerStats).toBeDefined();
            expect(result.payload.campaignName).toBe('campaign');
        });

        it('returns info popup when no free casts remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Misty Wanderer');
            expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');
            expect(result.payload.automation).toBeDefined();
        });

        it('falls back to usesMax of 1 when expression evaluation returns falsy', async () => {
            evaluateAutoExpression.mockReturnValue(null);
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.payload.usesMax).toBe(1);
        });

        it('evaluates custom uses_expression from automation config', async () => {
            evaluateAutoExpression.mockReturnValue(5);
            getRuntimeValue.mockReturnValue(5);

            const customAction = makeAction({ automation: { uses_expression: 'WIS modifier' } });

            const result = await handle(customAction, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.usesMax).toBe(5);
            expect(evaluateAutoExpression).toHaveBeenCalledWith('WIS modifier', expect.any(Object));
        });
    });

    describe('confirmMistyWanderer', () => {
        it('decrements counter and returns success popup without ally', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', false, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Misty_Wanderer_freeCastCount',
                2,
                'campaign',
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Misty Wanderer');
            expect(result.payload.description).toBe('Misty Wanderer: Cast Misty Step (2 remaining).');
            expect(result.payload.triggerMistyStep).toBe(true);
            expect(result.payload.automation).toBeDefined();
        });

        it('decrements from various starting values and reports correctly', async () => {
            const testCases = [
                { start: 3, expected: 2, desc: '2 remaining' },
                { start: 1, expected: 0, desc: '0 remaining' },
            ];

            for (const tc of testCases) {
                vi.clearAllMocks();
                getRuntimeValue.mockReturnValue(tc.start);

                const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', false, null);

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'Test Character',
                    '_Misty_Wanderer_freeCastCount',
                    tc.expected,
                    'campaign',
                );
                expect(result.payload.description).toBe(`Misty Wanderer: Cast Misty Step (${tc.desc}).`);
                expect(result.payload.triggerMistyStep).toBe(true);
            }
        });

        it('includes ally description when bringing an ally', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', true, 'Ally Name');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Character',
                '_Misty_Wanderer_freeCastCount',
                2,
                'campaign',
            );
            expect(result.payload.description).toBe(
                'Misty Wanderer: Cast Misty Step (2 remaining). Brought Ally Name to an unoccupied space within 5 feet of your destination.',
            );
        });

        it('omits ally text when bringAlly is true but allyName is null', async () => {
            getRuntimeValue.mockReturnValue(3);

            const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', true, null);

            expect(result.payload.description).toBe('Misty Wanderer: Cast Misty Step (2 remaining).');
            expect(result.payload.description).not.toContain('Brought');
        });

        it('returns info popup when no free casts remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', false, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No free casts remaining. Finish a Long Rest to regain them.');
            expect(result.payload.triggerMistyStep).toBeUndefined();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('uses custom feature name in the output', async () => {
            getRuntimeValue.mockReturnValue(2);

            const customAction = makeAction({ name: 'Custom Feature' });

            const result = await confirmMistyWanderer(customAction, makePlayerStats(), 'campaign', false, null);

            expect(result.payload.name).toBe('Custom Feature');
            expect(result.payload.description).toBe('Custom Feature: Cast Misty Step (1 remaining).');
        });

        // CLA-229: confirm must log consumption + teleport text, and carry the
        // bringAlly clause in the campaign log.
        it('logs ability_use with teleport text and pool consumption (CLA-229)', async () => {
            getRuntimeValue.mockReturnValue(3);

            await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', false, null);

            expect(addEntry).toHaveBeenCalledTimes(1);
            const [campaign, entry] = addEntry.mock.calls[0];
            expect(campaign).toBe('campaign');
            expect(entry.type).toBe('ability_use');
            expect(entry.characterName).toBe('Test Character');
            expect(entry.abilityName).toBe('Misty Wanderer');
            expect(entry.description).toContain('Misty Step for free');
            expect(entry.description).toContain('no spell slot consumed');
            expect(entry.description).toContain('teleporting up to 30 feet');
            expect(entry.description).toContain('2 of 3 free casts remaining');
            expect(entry.freeCastsRemaining).toBe(2);
            expect(entry.broughtAlly).toBeNull();
        });

        it('logs the bringAlly clause when a companion is brought (CLA-229)', async () => {
            getRuntimeValue.mockReturnValue(3);

            await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', true, 'HexWarlock');

            const [campaign, entry] = addEntry.mock.calls[0];
            expect(campaign).toBe('campaign');
            expect(entry.description).toContain('Brought HexWarlock to an unoccupied space within 5 feet');
            expect(entry.broughtAlly).toBe('HexWarlock');
        });

        it('does not log or consume when no free casts remain (CLA-229)', async () => {
            getRuntimeValue.mockReturnValue(0);

            await confirmMistyWanderer(makeAction(), makePlayerStats(), 'campaign', true, 'HexWarlock');

            expect(addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });
});
