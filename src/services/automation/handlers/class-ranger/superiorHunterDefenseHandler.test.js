import { handle } from './superiorHunterDefenseHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageRollback from '../../../../services/automation/common/damageRollback.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
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
        it('returns error popup when no last attack', async () => {
            damageRollback.findLastAttack.mockResolvedValue({ attackEvent: null, attackerName: null, targetName: null, primaryDamage: 0, secondaryDamage: 0, totalDamage: 0, damageTypes: [] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent attack found');
        });

        it('returns error popup when last attack did not target player', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', damageApplied: true, primaryDamage: 10 },
                attackerName: 'Goblin',
                targetName: 'Other',
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['fire'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('did not target you');
        });

        it('applies resistance buff for the damage type on successful use', async () => {
            runtimeState.getRuntimeValue.mockReturnValueOnce([]); // activeBuffs
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', damageApplied: true, primaryDamage: 15, targetName: 'Test Ranger' },
                attackerName: 'Goblin',
                targetName: 'Test Ranger',
                primaryDamage: 15,
                secondaryDamage: 0,
                totalDamage: 15,
                damageTypes: ['fire'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Resistance to fire damage');
            expect(result.payload.description).toContain('15 fire');

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
            runtimeState.getRuntimeValue.mockReturnValueOnce([]);
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'cold', primaryDamage: 8, targetName: 'Test Ranger' },
                attackerName: 'Orc',
                targetName: 'Test Ranger',
                primaryDamage: 8,
                secondaryDamage: 0,
                totalDamage: 8,
                damageTypes: ['cold'],
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
            runtimeState.getRuntimeValue.mockReturnValueOnce([]);
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'lightning', primaryDamage: 12, targetName: 'Test Ranger' },
                attackerName: 'Dragon',
                targetName: 'Test Ranger',
                primaryDamage: 12,
                secondaryDamage: 0,
                totalDamage: 12,
                damageTypes: ['lightning'],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'Test Ranger',
                abilityName: 'Superior Hunter\'s Defense',
            }));
        });

        it('handles missing damageType defaults to untyped', async () => {
            runtimeState.getRuntimeValue.mockReturnValueOnce([]);
            runtimeState.setRuntimeValue.mockResolvedValue(undefined);

            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { primaryDamage: 5, targetName: 'Test Ranger' },
                attackerName: 'Skeleton',
                targetName: 'Test Ranger',
                primaryDamage: 5,
                secondaryDamage: 0,
                totalDamage: 5,
                damageTypes: [],
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

        it('handles empty last attack event', async () => {
            damageRollback.findLastAttack.mockResolvedValue({ attackEvent: null, attackerName: null, targetName: null, primaryDamage: 0, secondaryDamage: 0, totalDamage: 0, damageTypes: [] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack found');
        });
    });
});
