import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './celestialResilienceHandler.js';
import { CAMPAIGN, MAP, makeCelestialStats, makeAction } from './celestialResilienceHelpers.js';

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

// NOTE: useRuntimeState.js is NOT imported by the handler — no need to mock it.
// The original test file mocked it and called getRuntimeValue.mockReturnValue(0)
// in several tests, but these calls had no effect on the handler's behavior.

import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

describe('celestialResilienceHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isWithinRange.mockResolvedValue(true);
        rangeToFeet.mockReturnValue(60);
    });

    describe('handle', () => {
        describe('null map path', () => {
            it('returns popup with Magical Cunning guidance when mapName is null', async () => {
                const result = await handle(
                    makeAction(),
                    makeCelestialStats(),
                    CAMPAIGN,
                    null,
                );

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toContain('Magical Cunning');
                expect(result.payload.description).toContain('Short or Long Rest');
                expect(result.payload.name).toBe('Celestial Resilience');
                expect(result.payload.automation).toEqual(makeAction().automation);
            });
        });

        describe('grant failure path', () => {
            it('returns null when patron is not celestial', async () => {
                const result = await handle(
                    makeAction(),
                    makeCelestialStats({ class: { major: { name: 'Other Patron' } } }),
                    CAMPAIGN,
                    MAP,
                );

                expect(result).toBe(null);
            });

            it('returns null when Celestial Resilience feature is missing from specialActions', async () => {
                const result = await handle(
                    makeAction(),
                    makeCelestialStats({ specialActions: [] }),
                    CAMPAIGN,
                    MAP,
                );

                expect(result).toBe(null);
            });

            it.each([
                [0, 'zero'],
                [-3, 'negative'],
                ['not a number', 'non-number'],
            ])('returns null when self temp HP expression evaluates to %s (%s)', async (value) => {
                evaluateAutoExpression.mockReturnValue(value);

                const result = await handle(
                    makeAction(),
                    makeCelestialStats(),
                    CAMPAIGN,
                    MAP,
                );

                expect(result).toBe(null);
            });
        });

        describe('modal path', () => {
            it('returns modal with ally targets when allies are in range', async () => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(3);
                loadMapData.mockResolvedValue({
                    players: [
                        { name: 'TestHero', gridX: 0, gridY: 0 },
                        { name: 'Ally1', gridX: 1, gridY: 1, currentHp: 10, maxHp: 20 },
                    ],
                });
                isWithinRange.mockResolvedValue(true);

                const result = await handle(makeAction(), makeCelestialStats(), CAMPAIGN, MAP);

                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('celestialResilienceModal');
                expect(result.payload.creatureTargets).toHaveLength(1);
                expect(result.payload.creatureTargets[0].name).toBe('Ally1');
                expect(result.payload.allyTempHp).toBe(3);
                expect(result.payload.selfTempHp).toBe(5);
                expect(result.payload.maxTargets).toBe(5);
                expect(result.payload.action).toEqual(makeAction());
            });

            it('filters out the actor from ally candidates', async () => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(2);
                loadMapData.mockResolvedValue({
                    players: [
                        { name: 'TestHero', gridX: 0, gridY: 0 },
                        { name: 'TestHero', gridX: 5, gridY: 5 },
                        { name: 'Ally', gridX: 2, gridY: 2 },
                    ],
                });
                isWithinRange.mockResolvedValue(true);

                const result = await handle(makeAction(), makeCelestialStats(), CAMPAIGN, MAP);

                expect(result.type).toBe('modal');
                expect(result.payload.creatureTargets).toHaveLength(1);
                expect(result.payload.creatureTargets[0].name).toBe('Ally');
            });

            it('returns empty creatureTargets when all allies are out of range', async () => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(3);
                loadMapData.mockResolvedValue({
                    players: [
                        { name: 'TestHero', gridX: 0, gridY: 0 },
                        { name: 'DistantAlly', gridX: 100, gridY: 100 },
                    ],
                });
                isWithinRange.mockResolvedValue(false);

                const result = await handle(makeAction(), makeCelestialStats(), CAMPAIGN, MAP);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('No allies in range');
            });

            it.each([
                [0, 'zero'],
                ['invalid', 'non-number'],
            ])('returns popup when ally temp HP expression evaluates to %s (%s)', async (value) => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(value);

                const result = await handle(makeAction(), makeCelestialStats(), CAMPAIGN, MAP);

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('temporary hit points');
            });
        });

        describe('logging', () => {
            it('logs ability_use with custom action name', async () => {
                evaluateAutoExpression.mockReturnValue(7);

                const customAction = makeAction({ name: 'Custom Celestial Resilience' });

                await handle(customAction, makeCelestialStats(), CAMPAIGN, MAP);

                expect(addEntry).toHaveBeenCalledWith(
                    CAMPAIGN,
                    expect.objectContaining({
                        type: 'ability_use',
                        characterName: 'TestHero',
                        abilityName: 'Custom Celestial Resilience',
                        description: expect.stringContaining('7 temporary hit points'),
                    }),
                );
            });
        });

        describe('error handling', () => {
            it('handles addEntry rejection without throwing', async () => {
                evaluateAutoExpression
                    .mockReturnValueOnce(7)
                    .mockReturnValueOnce(0);
                addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
                const errorSpy = vi.spyOn(console, 'error');

                const result = await handle(makeAction(), makeCelestialStats(), CAMPAIGN, MAP);

                expect(result).not.toBe(null);
                expect(result.type).toBe('popup');
                expect(errorSpy).toHaveBeenCalledWith(
                    '[celestialResilience] Error:',
                    expect.any(Error),
                );
                errorSpy.mockRestore();
            });
        });
    });
});
