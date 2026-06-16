import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './inspiringSmiteHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    resolveDiceExpression: vi.fn((expr, stats) => '2d8 + ' + stats.level),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 18 })),
}));

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn((v) => parseInt(v) || 30),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { resolveDiceExpression } = await import('../../../combat/automation/automationService.js');
const { rollExpression } = await import('../../../dice/diceRoller.js');
const { loadMapData } = await import('../../../maps/mapsService.js');
const { getDistanceFeet, rangeToFeet } = await import('../../../rules/combat/rangeValidation.js');
const { addEntry } = await import('../../../ui/logService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestPaladin',
        level: 8,
        class: {
            class_levels: [{ level: 8, channel_divinity: 2 }],
            ...overrides.class,
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Inspiring Smite',
        automation: {
            type: 'inspiring_smite',
            range: '30 ft',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('inspiringSmiteHandler', () => {
    describe('channel divinity charge checks', () => {
        it('returns error when no channel divinity charges remaining', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No Channel Divinity charges remaining');
        });

        it('proceeds when 1 charge available', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('roll');
        });

        it('defaults to max charges when no stored value', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('roll');
            expect(result.payload.description).not.toContain('No Channel Divinity charges remaining');
        });

    });

    describe('temp HP calculation', () => {
        it('returns error when temp HP calculation fails', async () => {
            getRuntimeValue.mockReturnValue(null);
            rollExpression.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Could not calculate temp HP');
        });

        it('returns error when temp HP is zero or negative', async () => {
            getRuntimeValue.mockReturnValue(null);
            rollExpression.mockReturnValue({ total: 0 });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Could not calculate temp HP');
        });
    });

    describe('target finding', () => {
        it('finds targets within range on map', async () => {
            getRuntimeValue.mockReturnValue(2);
            rollExpression.mockReturnValue({ total: 15 });
            resolveDiceExpression.mockReturnValue('2d8 + 8');
            getDistanceFeet.mockReturnValue(25);
            rangeToFeet.mockReturnValue(30);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestPaladin', gridX: 1, gridY: 1 },
                    { name: 'Ally1', gridX: 2, gridY: 2 },
                    { name: 'Ally2', gridX: 10, gridY: 10 },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(loadMapData).toHaveBeenCalledWith('test-campaign', 'test-map');
            expect(result.type).toBe('roll');
            expect(result.payload.name).toBe('Inspiring Smite');
            expect(result.payload.tempHp).toBe(15);
        });

        it('caps targets at 10', async () => {
            getRuntimeValue.mockReturnValue(2);
            rollExpression.mockReturnValue({ total: 10 });
            resolveDiceExpression.mockReturnValue('2d8 + 8');
            getDistanceFeet.mockReturnValue(10);
            rangeToFeet.mockReturnValue(30);

            const manyPlayers = [{ name: 'TestPaladin', gridX: 1, gridY: 1 }];
            for (let i = 0; i < 15; i++) {
                manyPlayers.push({ name: `Ally${i}`, gridX: 2, gridY: 2 });
            }
            loadMapData.mockResolvedValue({ players: manyPlayers });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.targets.length).toBeLessThanOrEqual(10);
        });

        it('skips attacker in target list', async () => {
            getRuntimeValue.mockReturnValue(2);
            rollExpression.mockReturnValue({ total: 10 });
            resolveDiceExpression.mockReturnValue('2d8 + 8');
            getDistanceFeet.mockReturnValue(10);
            rangeToFeet.mockReturnValue(30);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestPaladin', gridX: 1, gridY: 1 },
                    { name: 'Ally1', gridX: 2, gridY: 2 },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.targets).not.toContain('TestPaladin');
        });

        it('handles missing mapName gracefully', async () => {
            getRuntimeValue.mockReturnValue(2);
            rollExpression.mockReturnValue({ total: 10 });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.targets).toEqual([]);
            expect(result.payload.description).toContain('no targets in range');
        });

        it('handles attacker not found on map', async () => {
            getRuntimeValue.mockReturnValue(2);
            rollExpression.mockReturnValue({ total: 10 });
            resolveDiceExpression.mockReturnValue('2d8 + 8');
            loadMapData.mockResolvedValue({ players: [{ name: 'OtherPlayer', gridX: 1, gridY: 1 }] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.targets).toEqual([]);
        });

        it('excludes targets beyond range', async () => {
            getRuntimeValue.mockReturnValue(2);
            rollExpression.mockReturnValue({ total: 10 });
            resolveDiceExpression.mockReturnValue('2d8 + 8');
            getDistanceFeet.mockReturnValue(40);
            rangeToFeet.mockReturnValue(30);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestPaladin', gridX: 1, gridY: 1 },
                    { name: 'Ally1', gridX: 8, gridY: 8 },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.payload.targets).toEqual([]);
        });
    });

    describe('execution', () => {
        it('distributes temp HP to targets', async () => {
            getRuntimeValue.mockReturnValue(2);
            rollExpression.mockReturnValue({ total: 12 });
            resolveDiceExpression.mockReturnValue('2d8 + 8');
            getDistanceFeet.mockReturnValue(10);
            rangeToFeet.mockReturnValue(30);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestPaladin', gridX: 1, gridY: 1 },
                    { name: 'Ally1', gridX: 2, gridY: 2 },
                    { name: 'Ally2', gridX: 3, gridY: 3 },
                ],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(setRuntimeValue).toHaveBeenCalledWith('Ally1', 'tempHp', 12, 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('Ally2', 'tempHp', 12, 'test-campaign');
        });

        it('expend channel divinity charge', async () => {
            getRuntimeValue.mockReturnValue(2);
            rollExpression.mockReturnValue({ total: 10 });
            resolveDiceExpression.mockReturnValue('2d8 + 8');
            getDistanceFeet.mockReturnValue(10);
            rangeToFeet.mockReturnValue(30);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestPaladin', gridX: 1, gridY: 1 },
                ],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(setRuntimeValue).toHaveBeenCalledWith('TestPaladin', 'channelDivinityCharges', 1, 'test-campaign');
        });

        it('logs the ability use', async () => {
            getRuntimeValue.mockReturnValue(2);
            rollExpression.mockReturnValue({ total: 10 });
            resolveDiceExpression.mockReturnValue('2d8 + 8');
            getDistanceFeet.mockReturnValue(10);
            rangeToFeet.mockReturnValue(30);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestPaladin', gridX: 1, gridY: 1 },
                ],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestPaladin',
                abilityName: 'Inspiring Smite',
            }));
        });

        it('returns roll result with correct payload', async () => {
            getRuntimeValue.mockReturnValue(2);
            rollExpression.mockReturnValue({ total: 14 });
            resolveDiceExpression.mockReturnValue('2d8 + 8');
            getDistanceFeet.mockReturnValue(10);
            rangeToFeet.mockReturnValue(30);
            loadMapData.mockResolvedValue({
                players: [
                    { name: 'TestPaladin', gridX: 1, gridY: 1 },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.type).toBe('roll');
            expect(result.payload.roll).toBe('2d8 + 8');
            expect(result.payload.result).toBe(14);
            expect(result.payload.name).toBe('Inspiring Smite');
            expect(result.payload.tempHp).toBe(14);
        });

        it('uses default range when not specified', async () => {
            getRuntimeValue.mockReturnValue(2);
            rollExpression.mockReturnValue({ total: 10 });
            resolveDiceExpression.mockReturnValue('2d8 + 8');
            getDistanceFeet.mockReturnValue(10);
            rangeToFeet.mockReturnValue(30);
            loadMapData.mockResolvedValue({
                players: [{ name: 'TestPaladin', gridX: 1, gridY: 1 }],
            });

            await handle(makeAction({ automation: {} }), makePlayerStats(), 'test-campaign', 'test-map');

            expect(rangeToFeet).toHaveBeenCalledWith('30 ft');
        });
    });
});
