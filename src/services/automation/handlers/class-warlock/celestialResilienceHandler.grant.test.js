// @maintained-by-ai
// Lane: grantCelestialResilience in celestialResilienceHandler.js — canonical pins for the
// patron gate, feature/automation gates, self temp HP guard + setTempHp, ALLY_GRANT_SOURCES
// source gating, ally range collection (map players → combatSummary fallback), and grant-side
// default expressions/maxAllies/range. confirmSkip.test.js owns confirm/skip; handle.test.js
// owns handle (null-map popup, modal routing, addEntry rejection); restRules-* mock this
// function at the caller seam. Fully deterministic: every external seam is mocked.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { grantCelestialResilience } from './celestialResilienceHandler.js';
import { CAMPAIGN, MAP, makeCelestialStats } from './celestialResilienceHelpers.js';

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
    rangeToFeet: vi.fn().mockReturnValue(60),
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
import { loadMapData } from '../../../maps/mapsService.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { setTempHp } from '../buffs/tempHpService.js';

describe('celestialResilienceHandler - grantCelestialResilience', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isWithinRange.mockResolvedValue(true);
        rangeToFeet.mockReturnValue(60);
    });

    describe('grantCelestialResilience', () => {
        describe('celestial patron validation', () => {
            it('returns null when major class is not celestial patron', async () => {
                const result = await grantCelestialResilience(
                    makeCelestialStats({ class: { major: { name: 'Other Patron' } } }),
                    CAMPAIGN,
                    'magical_cunning',
                    MAP,
                );
                expect(result).toBe(null);
                expect(setTempHp).not.toHaveBeenCalled();
                expect(evaluateAutoExpression).not.toHaveBeenCalled();
            });

            it('recognizes subclass as celestial patron when major is different', async () => {
                evaluateAutoExpression.mockReturnValue(5);

                const result = await grantCelestialResilience(
                    makeCelestialStats({
                        class: { major: { name: 'Other Patron' }, subclass: { name: 'Celestial Patron' } },
                    }),
                    CAMPAIGN,
                    'magical_cunning',
                    MAP,
                );

                expect(result).not.toBe(null);
                expect(result.selfTempHp).toBe(5);
                expect(setTempHp).toHaveBeenCalledWith('TestHero', 5, CAMPAIGN);
            });
        });

        describe('feature validation', () => {
            it('returns null when Celestial Resilience feature is missing', async () => {
                const result = await grantCelestialResilience(
                    makeCelestialStats({ specialActions: [] }),
                    CAMPAIGN,
                    'magical_cunning',
                    MAP,
                );
                expect(result).toBe(null);
                expect(setTempHp).not.toHaveBeenCalled();
            });

            it.each([
                [null],
                [undefined],
            ])('returns null when feature automation is %j', async (automation) => {
                const result = await grantCelestialResilience(
                    makeCelestialStats({
                        specialActions: [{ name: 'Celestial Resilience', automation }],
                    }),
                    CAMPAIGN,
                    'magical_cunning',
                    MAP,
                );
                expect(result).toBe(null);
                expect(setTempHp).not.toHaveBeenCalled();
            });
        });

        describe('self temp HP evaluation', () => {
            it.each([
                [0, 'zero'],
                [-3, 'negative'],
                ['not a number', 'non-number'],
            ])('returns null when self temp HP expression evaluates to %s (%s)', async (value) => {
                evaluateAutoExpression.mockReturnValue(value);

                const result = await grantCelestialResilience(
                    makeCelestialStats(),
                    CAMPAIGN,
                    'magical_cunning',
                    MAP,
                );

                expect(result).toBe(null);
                expect(setTempHp).not.toHaveBeenCalled();
            });

            it('grants self temp HP and calls setTempHp when valid', async () => {
                evaluateAutoExpression.mockReturnValue(7);

                const result = await grantCelestialResilience(
                    makeCelestialStats(),
                    CAMPAIGN,
                    'magical_cunning',
                    MAP,
                );

                expect(result.selfTempHp).toBe(7);
                // full-string own-composition pin: grant owns this message
                expect(result.message).toBe('TestHero gains 7 temporary hit points from Celestial Resilience.');
                expect(setTempHp).toHaveBeenCalledWith('TestHero', 7, CAMPAIGN);
            });
        });

        describe('ally temp HP by source', () => {
            it('does not grant ally temp HP when source is not a rest/action type', async () => {
                evaluateAutoExpression.mockReturnValue(5);

                const result = await grantCelestialResilience(
                    makeCelestialStats(),
                    CAMPAIGN,
                    'other_source',
                    MAP,
                );

                expect(result.selfTempHp).toBe(5);
                expect(result.allyTempHp).toBeUndefined();
                expect(result.allies).toBeUndefined();
            });

            it.each([
                ['magical_cunning'],
                ['short_rest'],
                ['long_rest'],
            ])('grants ally temp HP when source is %s', async (source) => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(3);

                const result = await grantCelestialResilience(
                    makeCelestialStats(),
                    CAMPAIGN,
                    source,
                    MAP,
                );

                expect(result.selfTempHp).toBe(5);
                expect(result.allyTempHp).toBe(3);
            });

            it.each([
                [0, 'zero'],
                ['not a number', 'non-number'],
            ])('grants self only when ally temp HP expression evaluates to %s (%s)', async (value) => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(value);

                const result = await grantCelestialResilience(
                    makeCelestialStats(),
                    CAMPAIGN,
                    'magical_cunning',
                    MAP,
                );

                expect(result.selfTempHp).toBe(5);
                expect(result.allyTempHp).toBeUndefined();
                expect(result.maxAllies).toBeUndefined();
                expect(result.allies).toBeUndefined();
                // no-side-effect guard: attachAllyGrant returns before range collection
                expect(rangeToFeet).not.toHaveBeenCalled();
                expect(loadMapData).not.toHaveBeenCalled();
                expect(isWithinRange).not.toHaveBeenCalled();
            });
        });

        describe('ally collection', () => {
            it('collects allies in range and includes self temp HP', async () => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(3);
                loadMapData.mockResolvedValue({
                    players: [
                        { name: 'TestHero', gridX: 10, gridY: 10 },
                        { name: 'Ally1', gridX: 12, gridY: 12, currentHp: 10, maxHp: 20 },
                        { name: 'Ally2', gridX: 20, gridY: 20 },
                    ],
                });
                isWithinRange.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

                const result = await grantCelestialResilience(
                    makeCelestialStats(),
                    CAMPAIGN,
                    'magical_cunning',
                    MAP,
                );

                expect(result.selfTempHp).toBe(5);
                expect(result.allyTempHp).toBe(3);
                expect(result.maxAllies).toBe(5);
                expect(result.allies).toHaveLength(1);
                expect(result.allies[0].name).toBe('Ally1');
                expect(result.allies[0].type).toBe('player');
            });

            it('stores maxAllies without filtering allies array', async () => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(2);
                loadMapData.mockResolvedValue({
                    players: [
                        { name: 'TestHero', gridX: 0, gridY: 0 },
                        { name: 'Ally1', gridX: 1, gridY: 1 },
                        { name: 'Ally2', gridX: 2, gridY: 2 },
                        { name: 'Ally3', gridX: 3, gridY: 3 },
                    ],
                });
                isWithinRange.mockResolvedValue(true);

                const stats = makeCelestialStats({
                    specialActions: [
                        {
                            name: 'Celestial Resilience',
                            automation: {
                                tempHpExpression: '10',
                                allyTempHpExpression: '2',
                                maxAllies: 2,
                                range: '100_ft',
                            },
                        },
                    ],
                });

                const result = await grantCelestialResilience(stats, CAMPAIGN, 'magical_cunning', MAP);

                expect(result.maxAllies).toBe(2);
                expect(result.allies).toHaveLength(3);
            });

            it('returns empty allies when map data is null', async () => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(2);
                loadMapData.mockResolvedValue(null);

                const result = await grantCelestialResilience(
                    makeCelestialStats(),
                    CAMPAIGN,
                    'magical_cunning',
                    MAP,
                );

                expect(result.selfTempHp).toBe(5);
                expect(result.allyTempHp).toBe(2);
                expect(result.allies).toEqual([]);
            });

            it('uses allCreatures from combatSummary when mapPlayers is empty', async () => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(2);
                loadMapData.mockResolvedValue({ players: [] });
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: 'Ally1', type: 'player', currentHp: 10, maxHp: 20 },
                        { name: 'Ally2', type: 'npc', currentHp: 5, maxHp: 10 },
                    ],
                });
                isWithinRange.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

                const result = await grantCelestialResilience(
                    makeCelestialStats(),
                    CAMPAIGN,
                    'magical_cunning',
                    MAP,
                );

                expect(result.allyTempHp).toBe(2);
                expect(result.allies).toHaveLength(1);
                expect(result.allies[0].name).toBe('Ally1');
            });

            it('sets ally grant fields with empty allies when range does not resolve to feet', async () => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(3);
                rangeToFeet.mockReturnValueOnce(null);

                const result = await grantCelestialResilience(
                    makeCelestialStats(),
                    CAMPAIGN,
                    'magical_cunning',
                    MAP,
                );

                expect(result.selfTempHp).toBe(5);
                expect(result.allyTempHp).toBe(3);
                expect(result.maxAllies).toBe(5);
                expect(result.allies).toEqual([]);
                // range-less grant never consults map or combat summary
                expect(loadMapData).not.toHaveBeenCalled();
                expect(isWithinRange).not.toHaveBeenCalled();
            });
        });

        describe('default values', () => {
            it.each([
                ['tempHpExpression', 'warlock level + CHA modifier', 1],
                ['allyTempHpExpression', 'floor(warlock level / 2) + CHA modifier', 2],
            ])('uses default %s (%j) when automation field is missing', async (fieldName, expectedExpr, callNum) => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(4);

                const automationFields = {
                    tempHpExpression: '10',
                    allyTempHpExpression: '2',
                    maxAllies: 5,
                    range: '60_ft',
                };
                delete automationFields[fieldName];

                const stats = makeCelestialStats({
                    specialActions: [
                        {
                            name: 'Celestial Resilience',
                            automation: automationFields,
                        },
                    ],
                });

                await grantCelestialResilience(stats, CAMPAIGN, 'magical_cunning', MAP);

                expect(evaluateAutoExpression).toHaveBeenNthCalledWith(
                    callNum,
                    expectedExpr,
                    expect.any(Object),
                );
            });

            it('uses default maxAllies when missing', async () => {
                evaluateAutoExpression
                    .mockReturnValueOnce(5)
                    .mockReturnValueOnce(2);
                loadMapData.mockResolvedValue({ players: [] });

                const stats = makeCelestialStats({
                    specialActions: [
                        {
                            name: 'Celestial Resilience',
                            automation: {
                                tempHpExpression: '10',
                                allyTempHpExpression: '2',
                                range: '60_ft',
                            },
                        },
                    ],
                });

                const result = await grantCelestialResilience(stats, CAMPAIGN, 'magical_cunning', MAP);

                expect(result.maxAllies).toBe(5);
            });

            it('uses default range when missing', async () => {
                evaluateAutoExpression.mockReturnValue(5);

                const stats = makeCelestialStats({
                    specialActions: [
                        {
                            name: 'Celestial Resilience',
                            automation: {
                                tempHpExpression: '10',
                            },
                        },
                    ],
                });

                await grantCelestialResilience(stats, CAMPAIGN, 'magical_cunning', MAP);

                expect(rangeToFeet).toHaveBeenCalledWith('60_ft');
            });
        });
    });
});
