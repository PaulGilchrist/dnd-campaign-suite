import { describe, it, expect, vi, beforeEach } from 'vitest';

import { confirmCelestialResilience, skipCelestialResilience } from './celestialResilienceHandler.js';
import { CAMPAIGN, makeCelestialStats, makeAction } from './celestialResilienceHelpers.js';

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(() => Promise.resolve()),
}));

import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';
import { setTempHp } from '../buffs/tempHpService.js';

describe('celestialResilienceHandler - confirmCelestialResilience / skipCelestialResilience', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('confirmCelestialResilience', () => {
        it('returns popup and logs when no targets selected', async () => {
            const result = await confirmCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
                [],
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Resilience');
            expect(result.payload.description).toContain('selected no allies');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Celestial Resilience',
                    description: expect.stringContaining('selected no allies'),
                }),
            );
            expect(setTempHp).not.toHaveBeenCalled();
        });

        it('grants temp HP to all selected allies and returns popup with details', async () => {
            evaluateAutoExpression.mockReturnValue(3);

            const result = await confirmCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
                ['Ally1', 'Ally2'],
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Resilience');
            expect(result.payload.description).toContain('Ally1');
            expect(result.payload.description).toContain('Ally2');
            expect(result.payload.description).toContain('3 temporary hit points');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(setTempHp).toHaveBeenNthCalledWith(1, 'Ally1', 3, CAMPAIGN);
            expect(setTempHp).toHaveBeenNthCalledWith(2, 'Ally2', 3, CAMPAIGN);
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Celestial Resilience',
                    description: expect.stringContaining('grants 3 temporary hit points'),
                }),
            );
        });

        it('grants temp HP to a single ally', async () => {
            evaluateAutoExpression.mockReturnValue(5);

            const result = await confirmCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
                ['Ally1'],
            );

            expect(result.type).toBe('popup');
            expect(setTempHp).toHaveBeenCalledWith('Ally1', 5, CAMPAIGN);
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    characterName: 'TestHero',
                    abilityName: 'Celestial Resilience',
                }),
            );
        });

        it.each([
            [null, 'null automation'],
            [undefined, 'missing automation'],
        ])('uses default ally temp HP expression when automation is %s (%s)', async (automationValue) => {
            evaluateAutoExpression.mockReturnValue(4);

            const stats = makeCelestialStats({
                specialActions: [
                    {
                        name: 'Celestial Resilience',
                        automation: automationValue,
                    },
                ],
            });

            await confirmCelestialResilience(
                makeAction(),
                stats,
                CAMPAIGN,
                ['Ally1'],
            );

            expect(evaluateAutoExpression).toHaveBeenCalledWith(
                'floor(warlock level / 2) + CHA modifier',
                expect.any(Object),
            );
            expect(setTempHp).toHaveBeenCalledWith('Ally1', 4, CAMPAIGN);
        });
    });

    describe('skipCelestialResilience', () => {
        it('returns popup and logs when skip is called', async () => {
            const result = await skipCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Resilience');
            expect(result.payload.description).toContain('skipped granting');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Celestial Resilience',
                    description: expect.stringContaining('skipped granting'),
                }),
            );
        });

        it('handles addEntry rejection without throwing', async () => {
            addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
            const errorSpy = vi.spyOn(console, 'error');

            const result = await skipCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
            );

            expect(result.type).toBe('popup');
            expect(errorSpy).toHaveBeenCalledWith(
                '[celestialResilience] Error:',
                expect.any(Error),
            );
            errorSpy.mockRestore();
        });
    });

    describe('confirmCelestialResilience - error handling', () => {
        it('handles addEntry rejection when granting to allies without throwing', async () => {
            evaluateAutoExpression.mockReturnValue(3);
            addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
            const errorSpy = vi.spyOn(console, 'error');

            const result = await confirmCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
                ['Ally1', 'Ally2'],
            );

            expect(result.type).toBe('popup');
            // setTempHp should still be called even if logging fails
            expect(setTempHp).toHaveBeenCalledTimes(2);
            expect(errorSpy).toHaveBeenCalledWith(
                '[celestialResilience] Error:',
                expect.any(Error),
            );
            errorSpy.mockRestore();
        });
    });
});
