// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, grantCelestialResilience } from './celestialResilienceHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

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

// ── Re-import mocks after mocking ──────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';

// ── Helpers ────────────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';

function makeCelestialStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        class: { major: { name: 'Celestial Patron' }, subclass: { name: 'Celestial Patron' } },
        specialActions: [
            {
                name: 'Celestial Resilience',
                automation: {
                    tempHpExpression: 'warlock level + CHA modifier',
                    allyTempHpExpression: 'floor(warlock level / 2) + CHA modifier',
                    maxAllies: 5,
                    range: '60_ft',
                },
            },
        ],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Celestial Resilience',
        description: 'Gain temporary hit points.',
        automation: {
            type: 'celestial_resilience',
            tempHpExpression: 'warlock level + CHA modifier',
            allyTempHpExpression: 'floor(warlock level / 2) + CHA modifier',
            maxAllies: 5,
            range: '60_ft',
        },
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('celestialResilienceHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('grantCelestialResilience', () => {
        it('returns null when player is not a celestial patron', async () => {
            const result = await grantCelestialResilience(
                makeCelestialStats({ class: { major: { name: 'Other Patron' } } }),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );
            expect(result).toBe(null);
            expect(evaluateAutoExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('recognizes subclass as celestial patron', async () => {
            evaluateAutoExpression.mockReturnValue(5);
            getRuntimeValue.mockReturnValue(0);

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
        });

        it('returns null when Celestial Resilience feature is missing or has no automation', async () => {
            // missing feature entirely
            let result = await grantCelestialResilience(
                makeCelestialStats({ specialActions: [] }),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );
            expect(result).toBe(null);

            // feature exists but automation is null
            result = await grantCelestialResilience(
                makeCelestialStats({ specialActions: [{ name: 'Celestial Resilience', automation: null }] }),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );
            expect(result).toBe(null);

            // feature exists but automation is undefined
            result = await grantCelestialResilience(
                makeCelestialStats({ specialActions: [{ name: 'Celestial Resilience' }] }),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );
            expect(result).toBe(null);
        });

        it('returns null when self temp HP expression evaluates to invalid value', async () => {
            evaluateAutoExpression.mockReturnValue(0);

            const result = await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );

            expect(result).toBe(null);
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('grants self temp HP and returns result when valid', async () => {
            evaluateAutoExpression.mockReturnValue(7);
            getRuntimeValue.mockReturnValue(0);

            const result = await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );

            expect(result).not.toBe(null);
            expect(result.selfTempHp).toBe(7);
            expect(result.message).toContain('7 temporary hit points');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'tempHp',
                7,
                CAMPAIGN,
            );
        });

        it('adds new temp HP to existing temp HP', async () => {
            evaluateAutoExpression.mockReturnValue(5);
            getRuntimeValue.mockReturnValue(3);

            await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'tempHp',
                8,
                CAMPAIGN,
            );
        });

        it('does not grant ally temp HP when source is not magical_cunning', async () => {
            evaluateAutoExpression.mockReturnValue(5);
            getRuntimeValue.mockReturnValue(0);

            const result = await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'other_source',
                MAP,
            );

            expect(result).not.toBe(null);
            expect(result.selfTempHp).toBe(5);
            expect(result.allyTempHp).toBeUndefined();
        });

        it('grants ally temp HP when source is magical_cunning', async () => {
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(3);
            getRuntimeValue.mockReturnValue(0);
            rangeToFeet.mockReturnValue(60);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestHero', gridX: 10, gridY: 10 },
                    { name: 'Ally1', gridX: 12, gridY: 12 },
                    { name: 'Ally2', gridX: 20, gridY: 20 },
                ],
            });
            getDistanceFeet.mockReturnValue(10);

            const result = await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );

            expect(result.allyTempHp).toBe(3);
            expect(result.maxAllies).toBe(5);
            expect(result.allies).toContain('Ally1');
            expect(result.allyMessage).toContain('Ally1');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'tempHp',
                3,
                CAMPAIGN,
            );
        });

        it('limits ally count to maxAllies', async () => {
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(2);
            getRuntimeValue.mockReturnValue(0);
            rangeToFeet.mockReturnValue(100);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestHero', gridX: 0, gridY: 0 },
                    { name: 'Ally1', gridX: 1, gridY: 1 },
                    { name: 'Ally2', gridX: 2, gridY: 2 },
                    { name: 'Ally3', gridX: 3, gridY: 3 },
                    { name: 'Ally4', gridX: 4, gridY: 4 },
                    { name: 'Ally5', gridX: 5, gridY: 5 },
                    { name: 'Ally6', gridX: 6, gridY: 6 },
                ],
            });
            getDistanceFeet.mockReturnValue(10);

            const stats = makeCelestialStats({
                specialActions: [
                    {
                        name: 'Celestial Resilience',
                        automation: {
                            tempHpExpression: '10',
                            allyTempHpExpression: '2',
                            maxAllies: 3,
                            range: '100_ft',
                        },
                    },
                ],
            });

            const result = await grantCelestialResilience(stats, CAMPAIGN, 'magical_cunning', MAP);

            expect(result.allies.length).toBe(3);
            expect(result.allies).toEqual(['Ally1', 'Ally2', 'Ally3']);
        });

        it('filters allies by range', async () => {
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(2);
            getRuntimeValue.mockReturnValue(0);
            rangeToFeet.mockReturnValue(20);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestHero', gridX: 0, gridY: 0 },
                    { name: 'NearAlly', gridX: 2, gridY: 2 },
                    { name: 'FarAlly', gridX: 10, gridY: 10 },
                ],
            });
            getDistanceFeet.mockImplementation((a, b) => {
                const dx = b.gridX - a.gridX;
                const dy = b.gridY - a.gridY;
                return Math.sqrt(dx * dx + dy * dy) * 5;
            });

            const result = await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );

            expect(result.allies).toContain('NearAlly');
            expect(result.allies).not.toContain('FarAlly');
        });

        it('returns empty allies when map data is missing or no allies in range', async () => {
            // missing map data
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(2);
            getRuntimeValue.mockReturnValue(0);
            loadMapData.mockResolvedValue(null);

            let result = await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );

            expect(result.allyTempHp).toBe(2);
            expect(result.allies).toEqual([]);

            // no map name
            vi.clearAllMocks();
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(2);
            getRuntimeValue.mockReturnValue(0);

            result = await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'magical_cunning',
                null,
            );

            expect(result.allyTempHp).toBe(2);
            expect(result.allies).toEqual([]);
        });

        it('does not grant ally temp HP when ally expression is invalid', async () => {
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(0);
            getRuntimeValue.mockReturnValue(0);

            const result = await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );

            expect(result.selfTempHp).toBe(5);
            expect(result.allyTempHp).toBeUndefined();
            expect(result.allies).toBeUndefined();
        });

        it('uses default expressions when automation fields are missing', async () => {
            evaluateAutoExpression.mockReturnValueOnce(5);
            getRuntimeValue.mockReturnValue(0);

            const stats = makeCelestialStats({
                specialActions: [
                    {
                        name: 'Celestial Resilience',
                        automation: {
                            tempHpExpression: '10',
                            maxAllies: 5,
                            range: '60_ft',
                        },
                    },
                ],
            });

            await grantCelestialResilience(stats, CAMPAIGN, 'magical_cunning', MAP);

            expect(evaluateAutoExpression).toHaveBeenCalledWith(
                'floor(warlock level / 2) + CHA modifier',
                expect.any(Object),
            );
        });

        it('uses default maxAllies when missing', async () => {
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(2);
            getRuntimeValue.mockReturnValue(0);
            rangeToFeet.mockReturnValue(60);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestHero', gridX: 0, gridY: 0 },
                    { name: 'Ally1', gridX: 1, gridY: 1 },
                ],
            });
            getDistanceFeet.mockReturnValue(10);

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

        it('shows "may gain" message when no allies are in range', async () => {
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(3);
            getRuntimeValue.mockReturnValue(0);
            rangeToFeet.mockReturnValue(10);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestHero', gridX: 0, gridY: 0 },
                    { name: 'DistantAlly', gridX: 50, gridY: 50 },
                ],
            });
            getDistanceFeet.mockReturnValue(100);

            const result = await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );

            expect(result.allyMessage).toContain('may gain');
            expect(result.allies).toEqual([]);
        });
    });

    describe('handle', () => {
        it('returns null when grantCelestialResilience returns null', async () => {
            const result = await handle(
                makeAction(),
                makeCelestialStats({ class: { major: { name: 'Other Patron' } } }),
                CAMPAIGN,
                MAP,
            );
            expect(result).toBe(null);
        });

        it('returns popup with automation info on success', async () => {
            evaluateAutoExpression.mockReturnValue(7);
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makeCelestialStats(), CAMPAIGN, MAP);

            expect(result).not.toBe(null);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Resilience');
            expect(result.payload.description).toContain('7 temporary hit points');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('logs ability use on success', async () => {
            evaluateAutoExpression.mockReturnValue(7);
            getRuntimeValue.mockReturnValue(0);

            await handle(makeAction(), makeCelestialStats(), CAMPAIGN, MAP);

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Celestial Resilience',
                    description: expect.stringContaining('7 temporary hit points'),
                }),
            );
        });

        it('includes ally message in popup description when allies granted', async () => {
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(3);
            getRuntimeValue.mockReturnValue(0);
            rangeToFeet.mockReturnValue(60);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestHero', gridX: 0, gridY: 0 },
                    { name: 'Ally1', gridX: 1, gridY: 1 },
                ],
            });
            getDistanceFeet.mockReturnValue(10);

            const result = await handle(makeAction(), makeCelestialStats(), CAMPAIGN, MAP);

            expect(result.payload.description).toContain('temporary hit points');
            expect(result.payload.description).toContain('Ally1');
        });

        it('uses custom action name in log entry', async () => {
            evaluateAutoExpression.mockReturnValue(7);
            getRuntimeValue.mockReturnValue(0);

            const action = {
                name: 'Custom Celestial Resilience',
                automation: makeAction().automation,
            };

            await handle(action, makeCelestialStats(), CAMPAIGN, MAP);

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    abilityName: 'Custom Celestial Resilience',
                }),
            );
        });
    });
});
