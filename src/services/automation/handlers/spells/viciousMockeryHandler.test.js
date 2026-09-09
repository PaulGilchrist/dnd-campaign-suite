// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './viciousMockeryHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestBard',
        level: 1,
        proficiency: 2,
        spellAbilities: { saveDc: 12, modifier: 1 },
        abilities: [{ name: 'Charisma', bonus: 1 }],
        automation: {},
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Vicious Mockery',
        automation: { type: 'vicious_mockery', targetName: 'Goblin' },
        ...overrides,
    };
}

describe('viciousMockeryHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('applies disadvantage_next_attack target effect', async () => {
        const result = await handle(makeAction(), makePlayerStats(), 'TestCampaign', 'TestMap');

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'disadvantage_next_attack',
                    source: 'TestBard',
                }),
            ]),
            'TestCampaign',
        );
    });

    it('logs the condition application for the failed-save effect (CLA-377 fail leg)', async () => {
        const { addEntry } = await import('../../../ui/logService.js');

        await handle(makeAction(), makePlayerStats(), 'test-campaign', 'TestMap');

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Goblin',
            condition: 'Disadvantage on next attack',
            reason: 'Vicious Mockery (failed save)',
        }));
    });

    it('returns popup with automation info', async () => {
        const result = await handle(makeAction(), makePlayerStats(), 'TestCampaign', 'TestMap');

        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Vicious Mockery');
        expect(result.payload.targetName).toBe('Goblin');
    });

    it('adds expiration for the disadvantage effect', async () => {
        const { addExpiration } = await import('../../../rules/effects/expirations.js');

        await handle(makeAction(), makePlayerStats(), 'TestCampaign', 'TestMap');

        expect(addExpiration).toHaveBeenCalledWith(
            'TestBard',
            'Goblin',
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'remove_target_effect',
                    effectKey: 'disadvantage_next_attack',
                    source: 'TestBard',
                }),
            ]),
            'TestCampaign',
            undefined,
            'TestBard',
        );
    });

    it('replaces an existing disadvantage_next_attack effect from the same source', async () => {
        const existingEffects = [
            { target: 'Goblin', effect: 'disadvantage_next_attack', source: 'TestBard' },
            { target: 'Goblin', effect: 'blinded', source: 'OtherCaster' },
        ];
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return existingEffects;
            return [];
        });

        await handle(makeAction(), makePlayerStats(), 'test-campaign', 'TestMap');

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'disadvantage_next_attack',
                    source: 'TestBard',
                }),
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'blinded',
                    source: 'OtherCaster',
                }),
            ]),
            'test-campaign',
        );

        const calledWith = setRuntimeValue.mock.calls[0];
        const effectsArray = calledWith[2];
        const replacedIndex = existingEffects.findIndex(
            te => te.target === 'Goblin' && te.effect === 'disadvantage_next_attack' && te.source === 'TestBard'
        );
        expect(effectsArray[replacedIndex]).toEqual({
            target: 'Goblin',
            source: 'TestBard',
            effect: 'disadvantage_next_attack',
        });
        expect(effectsArray.length).toBe(2);
    });

    it('handles missing automation on action by defaulting targetName to Unknown', async () => {
        const actionWithoutAutomation = { name: 'Vicious Mockery' };

        await handle(actionWithoutAutomation, makePlayerStats(), 'test-campaign', 'TestMap');

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Unknown',
                    effect: 'disadvantage_next_attack',
                    source: 'TestBard',
                }),
            ]),
            'test-campaign',
        );
    });

    it('handles null targetEffects from runtime store', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') return null;
            return [];
        });

        await handle(makeAction(), makePlayerStats(), 'test-campaign', 'TestMap');

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'disadvantage_next_attack',
                    source: 'TestBard',
                }),
            ]),
            'test-campaign',
        );
    });

    it('handles addEntry rejection without throwing', async () => {
        const { addEntry } = await import('../../../ui/logService.js');
        addEntry.mockRejectedValueOnce(new Error('Log write failed'));

        const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

        await expect(
            handle(makeAction(), makePlayerStats(), 'test-campaign', 'TestMap')
        ).resolves.toBeDefined();

        expect(consoleSpy).toHaveBeenCalledWith('[viciousMockery] Error:', expect.any(Error));

        consoleSpy.mockRestore();
    });
});
