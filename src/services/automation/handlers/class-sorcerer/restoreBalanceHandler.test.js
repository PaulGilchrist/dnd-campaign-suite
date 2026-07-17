// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './restoreBalanceHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn((abilities, ability) => {
        const ab = abilities?.find((a) => a.name === ability);
        return ab?.bonus ?? 0;
    }),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../../hooks/runtime/useRuntimeState.js'
);
const { addEntry } = await import('../../../ui/logService.js');
const { getAbilityModifier } = await import(
    '../../../shared/abilityLookup.js'
);

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        level: 10,
        proficiency: 4,
        abilities: [{ name: 'Charisma', bonus: 3 }],
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Restore Balance',
        automation: { type: 'restore_balance', range: '60_ft', ...automation },
    };
}

function setupUses(remaining) {
    getRuntimeValue.mockReturnValue(remaining);
}

describe('restoreBalanceHandler.handle', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('basic behavior', () => {
        it('returns popup confirming next d20 roll is without Advantage/Disadvantage', async () => {
            setupUses(3);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Restore Balance');
            expect(result.payload.description).toContain('next d20 roll');
            expect(result.payload.description).toContain('Advantage or Disadvantage');
        });

        it('uses max(1, chaMod) as default uses when runtime value is null', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(getAbilityModifier).toHaveBeenCalledWith(
                expect.any(Array),
                'CHA',
            );
        });

        it('uses max(1, chaMod) for usesMax when CHA modifier is negative', async () => {
            getAbilityModifier.mockReturnValue(-1);
            getRuntimeValue.mockReturnValue(null);

            await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
            );

            expect(getRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'restorebalanceUses',
            );
        });
    });

    describe('uses check', () => {
        it('returns popup when no uses remaining', async () => {
            setupUses(0);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain(
                'No uses remaining',
            );
            expect(result.payload.description).toContain(
                'Recharges on a Long Rest',
            );
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('usage decrement and logging', () => {
        it('decrements uses by 1 after applying', async () => {
            setupUses(3);

            await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'restorebalanceUses',
                2,
                campaignName,
            );
        });

        it('sets uses to 0 when only 1 use remains', async () => {
            setupUses(1);

            await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'restorebalanceUses',
                0,
                campaignName,
            );
        });

        it('logs an ability_use entry to the campaign log', async () => {
            setupUses(2);

            await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
            );

            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Restore Balance',
                description: expect.stringMatching(
                    /TestSorcerer.*next d20 roll.*Advantage.*Disadvantage/,
                ),
                timestamp: expect.any(Number),
            });
        });

        it('uses action name as feature name in the result payload', async () => {
            setupUses(1);

            const result = await handle(
                makeAction(),
                makePlayerStats(),
                campaignName,
            );

            expect(result.payload.name).toBe('Restore Balance');
        });
    });
});
// @cleaned-by-ai
