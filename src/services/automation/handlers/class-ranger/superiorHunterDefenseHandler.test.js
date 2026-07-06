// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './superiorHunterDefenseHandler.js';
import * as damageRollback from '../../common/damageRollback.js';

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

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');

function makePlayerStats(overrides = {}) {
    return {
        name: 'Test Ranger',
        level: 15,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: "Superior Hunter's Defense",
        automation: {
            type: 'superior_hunter_defense',
            casting_time: '1 reaction',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('superiorHunterDefenseHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns error popup when no last attack exists', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Defense");
            expect(result.payload.description).toContain('No recent attack found');
            expect(result.payload.description).toContain('can only be used after taking damage');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns error when last attack did not target the player', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', damageApplied: true, primaryDamage: 10 },
                attackerName: 'Goblin',
                targetName: 'Other Player',
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['fire'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Defense");
            expect(result.payload.description).toContain('did not target you');
            expect(result.payload.description).toContain('can only be used shortly after taking damage');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('applies resistance buff and returns success popup for targeted attack', async () => {
            getRuntimeValue.mockReturnValue([]);
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

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: "Superior Hunter's Defense",
                        effect: 'damage_resistance',
                        duration: 'until_end_of_current_turn',
                        resistanceTypes: ['fire'],
                    }),
                ]),
                'test-campaign'
            );

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'Test Ranger',
                abilityName: "Superior Hunter's Defense",
            }));
        });

        it('manages existing buffs correctly when adding the resistance buff', async () => {
            // Preserve existing buffs and replace existing Superior Hunter Defense
            const existingBuffs = [
                { name: 'Shield', effect: 'ac_bonus', resistanceTypes: [] },
                { name: "Superior Hunter's Defense", effect: 'damage_resistance', resistanceTypes: ['cold'] },
            ];
            getRuntimeValue.mockReturnValue(existingBuffs);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'acid', primaryDamage: 8, targetName: 'Test Ranger' },
                attackerName: 'Ooze',
                targetName: 'Test Ranger',
                primaryDamage: 8,
                secondaryDamage: 0,
                totalDamage: 8,
                damageTypes: ['acid'],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            const buffsArg = setRuntimeValue.mock.calls[0][2];

            // Shield preserved
            expect(buffsArg).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'Shield' }),
            ]));

            // Only one Superior Hunter Defense buff (replaced, not duplicated)
            const shdBuffs = buffsArg.filter(b => b.name === "Superior Hunter's Defense");
            expect(shdBuffs).toHaveLength(1);
            expect(shdBuffs[0].resistanceTypes).toEqual(['acid']);
        });

        it('defaults to untyped when attackEvent has no damageType', async () => {
            getRuntimeValue.mockReturnValue([]);
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
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ resistanceTypes: ['untyped'] }),
                ]),
                'test-campaign'
            );
        });

        it('uses totalDamage in the popup description', async () => {
            getRuntimeValue.mockReturnValue([]);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'lightning', primaryDamage: 10, targetName: 'Test Ranger' },
                attackerName: 'Storm Giant',
                targetName: 'Test Ranger',
                primaryDamage: 10,
                secondaryDamage: 5,
                totalDamage: 15,
                damageTypes: ['lightning'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('15 lightning');
        });

        it('handles null stored activeBuffs by treating as empty array', async () => {
            getRuntimeValue.mockReturnValue(null);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', primaryDamage: 7, targetName: 'Test Ranger' },
                attackerName: 'Fire Elemental',
                targetName: 'Test Ranger',
                primaryDamage: 7,
                secondaryDamage: 0,
                totalDamage: 7,
                damageTypes: ['fire'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ resistanceTypes: ['fire'] }),
                ]),
                'test-campaign'
            );
        });
    });
});
