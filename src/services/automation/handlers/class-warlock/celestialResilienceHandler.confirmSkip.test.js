// @maintained-by-ai
// Lane: confirm/skip seam of celestialResilienceHandler.js only.
// grant.test.js owns grantCelestialResilience (patron gate, self temp HP, ally
// collection, grant-side defaults); handle.test.js owns handle (null-map popup,
// modal routing, handle-side addEntry rejection). useCharActionsModalHandlers.buffs.test.js
// owns the caller seam with these functions mocked out.
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
        it.each([
            [[]],
            [null],
            [undefined],
        ])('short-circuits to popup and logs when selected targets are %j', async (selectedTargets) => {
            const result = await confirmCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
                selectedTargets,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Resilience');
            expect(result.payload.description).toBe('TestHero selected no allies.');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Celestial Resilience',
                    description: 'TestHero selected no allies for Celestial Resilience.',
                }),
            );
            // no-side-effect guard: branch ends before any evaluation or granting
            expect(evaluateAutoExpression).not.toHaveBeenCalled();
            expect(setTempHp).not.toHaveBeenCalled();
        });

        it('grants temp HP to every selected ally and returns popup with details', async () => {
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
            expect(result.payload.description).toBe('TestHero grants 3 temporary hit points to Ally1, Ally2.');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(evaluateAutoExpression).toHaveBeenCalledTimes(1);
            expect(evaluateAutoExpression).toHaveBeenCalledWith(
                'floor(warlock level / 2) + CHA modifier',
                expect.any(Object),
            );
            expect(setTempHp).toHaveBeenNthCalledWith(1, 'Ally1', 3, CAMPAIGN);
            expect(setTempHp).toHaveBeenNthCalledWith(2, 'Ally2', 3, CAMPAIGN);
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Celestial Resilience',
                    description: 'TestHero grants 3 temporary hit points to 2 ally(ies): Ally1, Ally2.',
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

            // confirm reads the expression from playerStats feature, with its own fallback
            expect(evaluateAutoExpression).toHaveBeenCalledTimes(1);
            expect(evaluateAutoExpression).toHaveBeenCalledWith(
                'floor(warlock level / 2) + CHA modifier',
                expect.any(Object),
            );
            expect(setTempHp).toHaveBeenCalledWith('Ally1', 4, CAMPAIGN);
        });

        it('grants before logging: survives addEntry rejection without throwing', async () => {
            evaluateAutoExpression.mockReturnValue(3);
            addEntry.mockRejectedValueOnce(new Error('log error'));
            const errorSpy = vi.spyOn(console, 'error');

            const result = await confirmCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
                ['Ally1', 'Ally2'],
            );

            expect(result.type).toBe('popup');
            // setTempHp happens before addEntry, so grants land even if logging fails
            expect(setTempHp).toHaveBeenCalledTimes(2);
            expect(errorSpy).toHaveBeenCalledWith(
                '[celestialResilience] Error:',
                expect.any(Error),
            );
            errorSpy.mockRestore();
        });
    });

    describe('skipCelestialResilience', () => {
        it('returns popup and logs the skip without evaluating or granting', async () => {
            const result = await skipCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Resilience');
            expect(result.payload.description).toBe('TestHero skipped granting temporary hit points to allies.');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Celestial Resilience',
                    description: 'TestHero skipped granting temporary hit points to allies via Celestial Resilience.',
                }),
            );
            // no-side-effect guard: skip never evaluates or grants
            expect(evaluateAutoExpression).not.toHaveBeenCalled();
            expect(setTempHp).not.toHaveBeenCalled();
        });

        it('handles addEntry rejection without throwing', async () => {
            addEntry.mockRejectedValueOnce(new Error('log error'));
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
});
