import { handle } from './superiorHunterDefenseHandler.js';
import * as runtimeState from '../../../hooks/useRuntimeState.js';
import * as logService from '../../ui/logService.js';
import * as damageUtils from '../../rules/combat/damageUtils.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'Test Ranger',
    level: 15,
    ...overrides,
});

const makeAction = (auto = {}) => ({
    name: 'Superior Hunter\'s Defense',
    automation: {
        type: 'superior_hunter_defense',
        casting_time: '1 reaction',
        ...auto,
    },
});

describe('superiorHunterDefenseHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns error popup when no combat context', async () => {
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No active combat');
        });

        it('returns error popup when no recent damage found', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent damage found');
        });

        it('returns error popup when damage event is stale', async () => {
            const staleTimestamp = Date.now() - 70000;
            runtimeState.getRuntimeValue
                .mockReturnValueOnce({
                    targetName: 'Test Ranger',
                    rawDamage: 10,
                    damageType: 'fire',
                    timestamp: staleTimestamp,
                });

            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent damage found');
        });

        it('applies resistance buff for the damage type on successful use', async () => {
            const freshTimestamp = Date.now();
            runtimeState.getRuntimeValue
                .mockReturnValueOnce({
                    targetName: 'Test Ranger',
                    rawDamage: 15,
                    damageType: 'fire',
                    timestamp: freshTimestamp,
                });
            runtimeState.getRuntimeValue
                .mockReturnValueOnce([]); // activeBuffs
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Resistance to fire damage');
            expect(result.payload.description).toContain('15 fire');

            // Verify buff was set
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Superior Hunter\'s Defense',
                        effect: 'damage_resistance',
                        duration: 'until_end_of_current_turn',
                        resistanceTypes: ['fire'],
                    }),
                ]),
                'test-campaign'
            );
        });

        it('applies resistance for cold damage type', async () => {
            const freshTimestamp = Date.now();
            runtimeState.getRuntimeValue
                .mockReturnValueOnce({
                    targetName: 'Test Ranger',
                    rawDamage: 8,
                    damageType: 'cold',
                    timestamp: freshTimestamp,
                });
            runtimeState.getRuntimeValue
                .mockReturnValueOnce([]);
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Orc' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Resistance to cold damage');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        resistanceTypes: ['cold'],
                    }),
                ]),
                'test-campaign'
            );
        });

        it('logs ability use entry', async () => {
            const freshTimestamp = Date.now();
            runtimeState.getRuntimeValue
                .mockReturnValueOnce({
                    targetName: 'Test Ranger',
                    rawDamage: 12,
                    damageType: 'lightning',
                    timestamp: freshTimestamp,
                });
            runtimeState.getRuntimeValue
                .mockReturnValueOnce([]);
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Dragon' }],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'Test Ranger',
                abilityName: 'Superior Hunter\'s Defense',
            }));
        });

        it('handles missing damageType defaults to untyped', async () => {
            const freshTimestamp = Date.now();
            runtimeState.getRuntimeValue
                .mockReturnValueOnce({
                    targetName: 'Test Ranger',
                    rawDamage: 5,
                    timestamp: freshTimestamp,
                });
            runtimeState.getRuntimeValue
                .mockReturnValueOnce([]);
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Skeleton' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('untyped');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        resistanceTypes: ['untyped'],
                    }),
                ]),
                'test-campaign'
            );
        });

        it('handles empty creatures list', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent damage found');
        });

        it('skips damage events targeting other creatures', async () => {
            const freshTimestamp = Date.now();
            runtimeState.getRuntimeValue
                .mockReturnValueOnce({
                    targetName: 'Other Character',
                    rawDamage: 20,
                    damageType: 'fire',
                    timestamp: freshTimestamp,
                });

            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent damage found');
        });

        it('prefers the most recent damage event across multiple attackers', async () => {
            const olderTimestamp = Date.now() - 10000;
            const newerTimestamp = Date.now();
            runtimeState.getRuntimeValue
                .mockReturnValueOnce({
                    targetName: 'Test Ranger',
                    rawDamage: 10,
                    damageType: 'cold',
                    timestamp: olderTimestamp,
                })
                .mockReturnValueOnce({
                    targetName: 'Test Ranger',
                    rawDamage: 25,
                    damageType: 'fire',
                    timestamp: newerTimestamp,
                });
            runtimeState.getRuntimeValue
                .mockReturnValueOnce([]);
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Goblin' },
                    { name: 'Orc' },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            // Should use the newer fire damage event
            expect(result.payload.description).toContain('fire damage');
            expect(result.payload.description).toContain('25 fire');
        });
    });
});
