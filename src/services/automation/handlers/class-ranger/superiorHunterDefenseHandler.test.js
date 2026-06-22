import { handle } from './superiorHunterDefenseHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../../../services/automation/common/damageRollback.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findRollsByCreature: vi.fn(),
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
            damageRollback.findRollsByCreature.mockResolvedValue({
                'Goblin': { attackEvent: { targetName: 'Other', rawDamage: 10, timestamp: Date.now() }, abilityEvent: null, saveEvent: null },
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent damage found');
        });

        it('returns error popup when damage event is stale', async () => {
            const staleTimestamp = Date.now() - 70000;
            damageRollback.findRollsByCreature.mockResolvedValue({
                'Goblin': { attackEvent: { targetName: 'Test Ranger', rawDamage: 10, damageType: 'fire', timestamp: staleTimestamp }, abilityEvent: null, saveEvent: null },
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
            damageRollback.findRollsByCreature.mockResolvedValue({
                'Goblin': { attackEvent: { targetName: 'Test Ranger', rawDamage: 15, damageType: 'fire', timestamp: freshTimestamp }, abilityEvent: null, saveEvent: null },
            });
            runtimeState.getRuntimeValue
                .mockReturnValueOnce({ targetName: 'Test Ranger', rawDamage: 15, damageType: 'fire', timestamp: freshTimestamp })
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
            damageRollback.findRollsByCreature.mockResolvedValue({
                'Orc': { attackEvent: { targetName: 'Test Ranger', rawDamage: 8, damageType: 'cold', timestamp: freshTimestamp }, abilityEvent: null, saveEvent: null },
            });
            runtimeState.getRuntimeValue
                .mockReturnValueOnce({ targetName: 'Test Ranger', rawDamage: 8, damageType: 'cold', timestamp: freshTimestamp })
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
            damageRollback.findRollsByCreature.mockResolvedValue({
                'Dragon': { attackEvent: { targetName: 'Test Ranger', rawDamage: 12, damageType: 'lightning', timestamp: freshTimestamp }, abilityEvent: null, saveEvent: null },
            });
            runtimeState.getRuntimeValue
                .mockReturnValueOnce({ targetName: 'Test Ranger', rawDamage: 12, damageType: 'lightning', timestamp: freshTimestamp })
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
            damageRollback.findRollsByCreature.mockResolvedValue({
                'Skeleton': { attackEvent: { targetName: 'Test Ranger', rawDamage: 5, timestamp: freshTimestamp }, abilityEvent: null, saveEvent: null },
            });
            runtimeState.getRuntimeValue
                .mockReturnValueOnce({ targetName: 'Test Ranger', rawDamage: 5, timestamp: freshTimestamp })
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
            damageRollback.findRollsByCreature.mockResolvedValue({});

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent damage found');
        });

        it('skips damage events targeting other creatures', async () => {
            const freshTimestamp = Date.now();
            damageRollback.findRollsByCreature.mockResolvedValue({
                'Goblin': { attackEvent: { targetName: 'Other Character', rawDamage: 20, damageType: 'fire', timestamp: freshTimestamp }, abilityEvent: null, saveEvent: null },
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
            damageRollback.findRollsByCreature.mockResolvedValue({
                'Goblin': { attackEvent: { targetName: 'Test Ranger', rawDamage: 10, damageType: 'cold', timestamp: olderTimestamp }, abilityEvent: null, saveEvent: null },
                'Orc': { attackEvent: { targetName: 'Test Ranger', rawDamage: 25, damageType: 'fire', timestamp: newerTimestamp }, abilityEvent: null, saveEvent: null },
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
