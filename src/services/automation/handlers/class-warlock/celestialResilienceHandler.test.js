// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, grantCelestialResilience, confirmCelestialResilience, skipCelestialResilience } from './celestialResilienceHandler.js';

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

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

// ── Re-import mocks after mocking ──────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';
import { addEntry } from '../../../ui/logService.js';
import { loadMapData } from '../../../maps/mapsService.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

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
        isWithinRange.mockResolvedValue(true);
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

        it('uses Math.max when new temp HP is lower than existing', async () => {
            evaluateAutoExpression.mockReturnValue(3);
            getRuntimeValue.mockReturnValue(5);

            await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'tempHp',
                5,
                CAMPAIGN,
            );
        });

        it('uses new temp HP when higher than existing', async () => {
            evaluateAutoExpression.mockReturnValue(7);
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
                7,
                CAMPAIGN,
            );
        });

        it('does not grant ally temp HP data when source is not magical_cunning', async () => {
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

        it('returns ally temp HP data when source is magical_cunning', async () => {
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(3);
            getRuntimeValue.mockReturnValue(0);
            rangeToFeet.mockReturnValue(60);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestHero', gridX: 10, gridY: 10 },
                    { name: 'Ally1', gridX: 12, gridY: 12, currentHp: 10, maxHp: 20 },
                    { name: 'Ally2', gridX: 20, gridY: 20 },
                ],
            });
            getDistanceFeet.mockReturnValue(10);
            isWithinRange.mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false);

            const result = await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );

            expect(result.allyTempHp).toBe(3);
            expect(result.maxAllies).toBe(5);
            expect(result.allies).toHaveLength(1);
            expect(result.allies[0].name).toBe('Ally1');
        });

        it('collects all allies in range (maxAllies limits selection, not display)', async () => {
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

            expect(result.allies.length).toBe(6);
            expect(result.maxAllies).toBe(3);
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
            isWithinRange.mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false);

            const result = await grantCelestialResilience(
                makeCelestialStats(),
                CAMPAIGN,
                'magical_cunning',
                MAP,
            );

            expect(result.allies.map(a => a.name)).toContain('NearAlly');
            expect(result.allies.map(a => a.name)).not.toContain('FarAlly');
        });

        it('returns empty allies when map data is missing or no map name', async () => {
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

        it('does not grant ally temp HP data when ally expression is invalid', async () => {
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
    });

    describe('handle', () => {
        it('returns popup when mapName is null (special action click)', async () => {
            const result = await handle(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
                null,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Magical Cunning');
        });

        it('returns null when grantCelestialResilience returns null', async () => {
            const result = await handle(
                makeAction(),
                makeCelestialStats({ class: { major: { name: 'Other Patron' } } }),
                CAMPAIGN,
                MAP,
            );
            expect(result).toBe(null);
        });

        it('returns modal payload when allies are available for selection', async () => {
            evaluateAutoExpression
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(3);
            getRuntimeValue.mockReturnValue(0);
            rangeToFeet.mockReturnValue(60);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestHero', gridX: 0, gridY: 0 },
                    { name: 'Ally1', gridX: 1, gridY: 1, currentHp: 10, maxHp: 20 },
                ],
            });
            getDistanceFeet.mockReturnValue(10);

            const result = await handle(makeAction(), makeCelestialStats(), CAMPAIGN, MAP);

            expect(result).not.toBe(null);
            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('celestialResilienceModal');
            expect(result.payload.creatureTargets).toHaveLength(1);
            expect(result.payload.allyTempHp).toBe(3);
            expect(result.payload.selfTempHp).toBe(5);
            expect(result.payload.maxTargets).toBe(5);
        });

        it('returns popup when no allies are in range', async () => {
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
            isWithinRange.mockResolvedValue(false);

            const result = await handle(makeAction(), makeCelestialStats(), CAMPAIGN, MAP);

            expect(result).not.toBe(null);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No allies in range');
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

    describe('confirmCelestialResilience', () => {
        it('returns popup when no targets selected', async () => {
            const result = await confirmCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
                [],
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('selected no allies');
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    description: expect.stringContaining('selected no allies'),
                }),
            );
        });

        it('grants temp HP to selected allies', async () => {
            evaluateAutoExpression.mockReturnValue(3);
            getRuntimeValue.mockReturnValue(0);

            const result = await confirmCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
                ['Ally1', 'Ally2'],
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Ally1');
            expect(result.payload.description).toContain('Ally2');
            expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'tempHp', 3, CAMPAIGN);
            expect(setRuntimeValue).toHaveBeenCalledWith('Ally2', 'tempHp', 3, CAMPAIGN);
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    description: expect.stringContaining('grants 3 temporary hit points'),
                }),
            );
        });

        it('logs when single ally selected', async () => {
            evaluateAutoExpression.mockReturnValue(5);

            await confirmCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
                ['Ally1'],
            );

            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    description: expect.stringContaining('Ally1'),
                }),
            );
        });
    });

    describe('skipCelestialResilience', () => {
        it('logs skip and returns popup', async () => {
            const result = await skipCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('skipped granting');
            expect(addEntry).toHaveBeenCalledWith(
                CAMPAIGN,
                expect.objectContaining({
                    description: expect.stringContaining('skipped granting'),
                }),
            );
        });

        it('does not grant temp HP to any allies on skip', async () => {
            await skipCelestialResilience(
                makeAction(),
                makeCelestialStats(),
                CAMPAIGN,
            );

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                expect.any(String),
                'tempHp',
                expect.any(Number),
                CAMPAIGN,
            );
        });
    });
});
