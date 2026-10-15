// @maintained-by-ai
// Lane: handle() in celestialResilienceHandler.js — null-map popup, modal routing (result.allies →
// creatureTargets payload), popup composition ('No allies in range' suffix and self-only fallback),
// ability_use logging, and the addEntry rejection catch. Grant-side canonical gates (patron,
// feature/automation, self/ally temp HP guards, range collection, actor filtering) are pinned in
// celestialResilienceHandler.grant.test.js; confirm/skip seam is owned by
// celestialResilienceHandler.confirmSkip.test.js. Fully deterministic: every external seam is mocked.
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
    rangeToFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(() => Promise.resolve()),
}));

import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { setTempHp } from '../buffs/tempHpService.js';

describe('celestialResilienceHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isWithinRange.mockResolvedValue(true);
        rangeToFeet.mockReturnValue(60);
    });

    describe('null map path', () => {
        it('returns popup with Magical Cunning guidance when mapName is null', async () => {
            const action = makeAction();
            const result = await handle(action, makeCelestialStats(), CAMPAIGN, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Resilience');
            // full-string own-composition pin: handle owns this guidance text
            expect(result.payload.description).toBe(
                'TestHero gains temporary hit points from Celestial Resilience when using Magical Cunning or finishing a Short or Long Rest.'
            );
            expect(result.payload.automation).toEqual(action.automation);
            // guidance lane never grants or consults the map
            expect(setTempHp).not.toHaveBeenCalled();
            expect(loadMapData).not.toHaveBeenCalled();
        });
    });

    describe('modal routing', () => {
        it('returns modal with in-range ally targets and maps grant fields into payload', async () => {
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(3);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestHero', gridX: 0, gridY: 0 },
                    { name: 'Ally1', gridX: 1, gridY: 1, currentHp: 10, maxHp: 20 },
                ],
            });

            const action = makeAction();
            const result = await handle(action, makeCelestialStats(), CAMPAIGN, MAP);

            // self grant still lands through handle before the modal opens
            expect(setTempHp).toHaveBeenCalledWith('TestHero', 5, CAMPAIGN);
            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('celestialResilienceModal');
            expect(result.payload.creatureTargets).toHaveLength(1);
            expect(result.payload.creatureTargets[0].name).toBe('Ally1');
            expect(result.payload.allyTempHp).toBe(3);
            expect(result.payload.selfTempHp).toBe(5);
            expect(result.payload.maxTargets).toBe(5);
            expect(result.payload.action).toEqual(action);
        });
    });

    describe('popup composition', () => {
        it('appends no-allies-in-range note to the grant message when no ally is in range', async () => {
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
            // full-string own-composition pin: handle owns message + suffix concat
            expect(result.payload.description).toBe(
                'TestHero gains 5 temporary hit points from Celestial Resilience. No allies in range to gain 3 temporary hit points.'
            );
        });

        it.each([
            [0, 'zero'],
            ['invalid', 'non-number'],
        ])('falls back to self-only popup when ally temp HP expression evaluates to %s (%s)', async (value) => {
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(value);

            const result = await handle(makeAction(), makeCelestialStats(), CAMPAIGN, MAP);

            expect(result.type).toBe('popup');
            // self-only shape: plain grant message, no allies suffix, no modal
            expect(result.payload.description).toBe(
                'TestHero gains 5 temporary hit points from Celestial Resilience.'
            );
        });
    });

    describe('logging', () => {
        it('logs ability_use with custom action name', async () => {
            evaluateAutoExpression.mockReturnValue(7);
            loadMapData.mockResolvedValue({ players: [] });

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
