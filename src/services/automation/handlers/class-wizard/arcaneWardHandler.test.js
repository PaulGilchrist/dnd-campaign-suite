import { handle, onArcaneWardRestore, onArcaneWardDestroy, onArcaneWardLevelUp, onAbjurationSpellCast, onArcaneWardBonusActionRestore } from './arcaneWardHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
}));

const mockPlayerStats = {
    name: 'TestWizard',
    rules: '2024',
    level: 5,
    abilities: [
        { name: 'Intelligence', bonus: 3 },
    ],
};

const mockPlayerStatsLevel10 = {
    name: 'TestWizard',
    rules: '2024',
    level: 10,
    abilities: [
        { name: 'Intelligence', bonus: 4 },
    ],
};

const mockCampaignName = 'test-campaign';

function mockWardActive(hp = 8, maxHp = 13) {
    getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'arcaneWardActive') return true;
        if (key === 'arcaneWardHp') return hp;
        if (key === 'arcaneWardMax') return maxHp;
        return undefined;
    });
}

function mockWardInactive() {
    getRuntimeValue.mockReturnValue(false);
}

function mockCombatContextNoDamage(targetName) {
    getCombatSummary.mockReturnValue({
        creatures: [
            { name: 'TestWizard', targetName: targetName },
            { name: targetName },
        ],
        activeCreatureName: 'TestWizard',
    });
    getTargetFromAttacker.mockReturnValue({ name: targetName });
    getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'arcaneWardActive') return true;
        if (key === 'arcaneWardHp') return 8;
        if (key === 'arcaneWardMax') return 13;
        if (player === targetName && key === 'projectedWardDamage') return { rawDamage: 0 };
        return undefined;
    });
}

function mockCombatContextNoTarget() {
    getCombatSummary.mockReturnValue({
        creatures: [
            { name: 'TestWizard' },
        ],
        activeCreatureName: 'TestWizard',
    });
    getTargetFromAttacker.mockReturnValue(null);
    getRuntimeValue.mockImplementation((player, key) => {
        if (key === 'arcaneWardActive') return true;
        if (key === 'arcaneWardHp') return 8;
        if (key === 'arcaneWardMax') return 13;
        return undefined;
    });
}

describe('arcaneWardHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        describe('ward not active', () => {
            it('should return info popup when ward is not active', async () => {
                mockWardInactive();

                const result = await handle(
                    { name: 'Arcane Ward', description: 'Create a magical ward...' },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toContain('not active');
                expect(result.payload.description).toContain('Cast an Abjuration spell');
            });
        });

        describe('bonus action modal', () => {
            it('should open modal to choose spell slot level when ward is active', async () => {
                mockWardActive();

                const result = await handle(
                    { name: 'Arcane Ward', description: 'Create a magical ward...', automation: { type: 'arcane_ward_bonus_action' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('arcaneWardRestore');
                expect(result.payload.action.name).toBe('Arcane Ward');
            });
        });

        describe('projected ward - no combat context', () => {
            it('should return info popup when no combat summary', async () => {
                mockWardActive(5, 13);
                getCombatSummary.mockReturnValue(null);

                const result = await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toContain('active');
                expect(result.payload.description).toContain('No combat context available');
            });
        });

        describe('projected ward - no target', () => {
            it('should return info popup when no target selected', async () => {
                mockCombatContextNoTarget();

                const result = await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toContain('No target selected');
            });
        });

        describe('projected ward - no damage', () => {
            it('should return info popup when no recent damage on target', async () => {
                mockCombatContextNoDamage('Goblin');

                const result = await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toContain('No recent damage detected');
                expect(result.payload.description).toContain('Goblin');
            });

            it('should return info popup when rawDamage is null', async () => {
                getRuntimeValue.mockImplementation((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 8;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return null;
                    return undefined;
                });
                getCombatSummary.mockReturnValue({
                    creatures: [{ name: 'TestWizard', targetName: 'Goblin' }, { name: 'Goblin' }],
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

                const result = await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toContain('No recent damage detected');
            });
        });

        describe('projected ward - full absorption', () => {
            it('should absorb all damage when ward has enough HP', async () => {
                mockWardActive(10, 15);
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: 'TestWizard', targetName: 'Goblin' },
                        { name: 'Goblin' },
                    ],
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                getRuntimeValue.mockImplementation((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 10;
                    if (key === 'arcaneWardMax') return 15;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 7 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return 5;
                    if (player === 'Goblin' && key === 'maxHitPoints') return 10;
                    return undefined;
                });

                const result = await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 10, mockCampaignName);
                expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 3, mockCampaignName);
                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toContain('absorbed 7');
                expect(result.payload.description).toContain('All damage absorbed');
            });

            it('should not restore target HP beyond max HP', async () => {
                mockWardActive(10, 15);
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: 'TestWizard', targetName: 'Goblin' },
                        { name: 'Goblin' },
                    ],
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                getRuntimeValue.mockImplementation((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 10;
                    if (key === 'arcaneWardMax') return 15;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 8 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return 9;
                    if (player === 'Goblin' && key === 'maxHitPoints') return 10;
                    return undefined;
                });

                await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 10, mockCampaignName);
                expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 2, mockCampaignName);
            });

            it('should not reduce ward HP when absorbed is 0', async () => {
                mockWardActive(0, 13);
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: 'TestWizard', targetName: 'Goblin' },
                        { name: 'Goblin' },
                    ],
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                getRuntimeValue.mockImplementation((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 0;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 5 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return 8;
                    if (player === 'Goblin' && key === 'maxHitPoints') return 10;
                    return undefined;
                });

                const result = await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(setRuntimeValue).not.toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', expect.any(Number), mockCampaignName);
                expect(result.payload.description).toContain('absorbed 0');
                expect(result.payload.description).toContain('5 remaining damage');
            });
        });

        describe('projected ward - partial absorption', () => {
            it('should absorb what ward can and let rest through', async () => {
                mockWardActive(5, 13);
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: 'TestWizard', targetName: 'Ogre' },
                        { name: 'Ogre' },
                    ],
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Ogre' });
                getRuntimeValue.mockImplementation((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 5;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Ogre' && key === 'projectedWardDamage') return { rawDamage: 12 };
                    if (player === 'Ogre' && key === 'currentHitPoints') return 8;
                    if (player === 'Ogre' && key === 'maxHitPoints') return 15;
                    return undefined;
                });

                const result = await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(setRuntimeValue).toHaveBeenCalledWith('Ogre', 'currentHitPoints', 13, mockCampaignName);
                expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 0, mockCampaignName);
                expect(result.payload.description).toContain('absorbed 5');
                expect(result.payload.description).toContain('7 remaining damage');
            });
        });

        describe('projected ward - ward depleted', () => {
            it('should set ward HP to 0 when fully consumed', async () => {
                mockWardActive(3, 13);
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: 'TestWizard', targetName: 'Goblin' },
                        { name: 'Goblin' },
                    ],
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                getRuntimeValue.mockImplementation((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 3;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 3 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return 6;
                    if (player === 'Goblin' && key === 'maxHitPoints') return 10;
                    return undefined;
                });

                const result = await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 0, mockCampaignName);
                expect(result.payload.description).toContain('0 HP');
                expect(result.payload.description).toContain('All damage absorbed');
            });
        });

        describe('projected ward - target HP null', () => {
            it('should skip target HP restoration when currentHitPoints is null', async () => {
                mockWardActive(5, 13);
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: 'TestWizard', targetName: 'Goblin' },
                        { name: 'Goblin' },
                    ],
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                getRuntimeValue.mockImplementation((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 5;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 4 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return null;
                    if (player === 'Goblin' && key === 'maxHitPoints') return 10;
                    return undefined;
                });

                const result = await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'currentHitPoints', expect.any(Number), mockCampaignName);
                expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 1, mockCampaignName);
                expect(result.payload.description).toContain('absorbed 4');
            });
        });

        describe('projected ward - ward max HP null', () => {
            it('should cap target HP when maxHitPoints is null', async () => {
                mockWardActive(5, 13);
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: 'TestWizard', targetName: 'Goblin' },
                        { name: 'Goblin' },
                    ],
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                getRuntimeValue.mockImplementation((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 5;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 4 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return 8;
                    if (player === 'Goblin' && key === 'maxHitPoints') return null;
                    return undefined;
                });

                await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                // When maxHitPoints is null, the fallback is targetHp + absorbed = 8 + 4 = 12
                expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 12, mockCampaignName);
            });
        });

        describe('logging', () => {
            it('should log ability_use entry', async () => {
                mockWardActive(5, 13);
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: 'TestWizard', targetName: 'Goblin' },
                        { name: 'Goblin' },
                    ],
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                getRuntimeValue.mockImplementation((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 5;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 5 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return 6;
                    if (player === 'Goblin' && key === 'maxHitPoints') return 10;
                    return undefined;
                });

                await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(addEntry).toHaveBeenCalledWith(
                    mockCampaignName,
                    expect.objectContaining({
                        type: 'ability_use',
                        characterName: 'TestWizard',
                        abilityName: 'Arcane Ward',
                    })
                );
            });

            it('should log ward_absorbed entry', async () => {
                mockWardActive(5, 13);
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: 'TestWizard', targetName: 'Goblin' },
                        { name: 'Goblin' },
                    ],
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                getRuntimeValue.mockImplementation((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 5;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 3 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return 6;
                    if (player === 'Goblin' && key === 'maxHitPoints') return 10;
                    return undefined;
                });

                await handle(
                    { name: 'Arcane Ward', description: '...', automation: { type: 'projected_ward' } },
                    mockPlayerStats,
                    mockCampaignName
                );

                expect(addEntry).toHaveBeenCalledWith(
                    mockCampaignName,
                    expect.objectContaining({
                        type: 'ward_absorbed',
                        targetName: 'Goblin',
                        damage: 3,
                        wizardName: 'TestWizard',
                        remainingWardHp: 2,
                    })
                );
            });
        });
    });

    describe('onArcaneWardRestore', () => {
        it('should restore ward HP using spell slot level', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                mockPlayerStats,
                2, // spell slot level
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                9, // 5 + (2*2) = 9
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored 4 HP');
        });

        it('should cap ward HP at max', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 12;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                mockPlayerStats,
                3, // spell slot level → 6 HP restore
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                13, // capped at max
                mockCampaignName
            );
        });

        it('should default to spell slot level 1 when invalid value provided', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                mockPlayerStats,
                'invalid',
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                7, // 5 + (1*2) = 7
                mockCampaignName
            );
        });

        it('should default to 0 when ward HP is not set', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return undefined;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                mockPlayerStats,
                1,
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                2, // 0 + (1*2) = 2
                mockCampaignName
            );
        });

        it('should log the ability use', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                mockPlayerStats,
                2,
                mockCampaignName
            );

            expect(addEntry).toHaveBeenCalledWith(
                mockCampaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestWizard',
                    abilityName: 'Arcane Ward',
                })
            );
        });
    });

    describe('onArcaneWardBonusActionRestore', () => {
        it('should find lowest available spell slot and restore ward HP', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                if (key === 'spell_slots_level_1') return 0;
                if (key === 'spell_slots_level_2') return 2;
                if (key === 'spell_slots_level_3') return 1;
                return undefined;
            });

            const result = await onArcaneWardBonusActionRestore(
                { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
                mockPlayerStats,
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                9, // 5 + (2*2) = 9, uses level 2 slot
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'spell_slots_level_2',
                1, // decremented from 2
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored 4 HP');
            expect(result.payload.description).toContain('level 2');
        });

        it('should use level 1 slot when it is the only one available', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                if (key === 'spell_slots_level_1') return 3;
                if (key === 'spell_slots_level_2') return 0;
                if (key === 'spell_slots_level_3') return 0;
                return undefined;
            });

            await onArcaneWardBonusActionRestore(
                { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
                mockPlayerStats,
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                7, // 5 + (1*2) = 7
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'spell_slots_level_1',
                2,
                mockCampaignName
            );
        });

        it('should return info popup when no spell slots available', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                for (let i = 1; i <= 9; i++) {
                    if (key === `spell_slots_level_${i}`) return 0;
                }
                return undefined;
            });

            const result = await onArcaneWardBonusActionRestore(
                { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No spell slots available');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should return info popup when ward is not active', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return false;
                if (key === 'spell_slots_level_1') return 3;
                return undefined;
            });

            const result = await onArcaneWardBonusActionRestore(
                { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not active');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should cap ward HP at max', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 12;
                if (key === 'arcaneWardMax') return 13;
                if (key === 'spell_slots_level_1') return 3;
                return undefined;
            });

            await onArcaneWardBonusActionRestore(
                { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
                mockPlayerStats,
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                13, // capped at max
                mockCampaignName
            );
        });

        it('should log the ability use', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                if (key === 'spell_slots_level_2') return 2;
                return undefined;
            });

            await onArcaneWardBonusActionRestore(
                { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
                mockPlayerStats,
                mockCampaignName
            );

            expect(addEntry).toHaveBeenCalledWith(
                mockCampaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestWizard',
                    abilityName: 'Arcane Ward',
                })
            );
        });
    });

    describe('onArcaneWardDestroy', () => {
        it('should destroy the ward', async () => {
            const result = await onArcaneWardDestroy(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardActive',
                false,
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                0,
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardMax',
                0,
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('destroyed');
            expect(result.payload.description).toContain('Long Rest');
        });
    });

    describe('onArcaneWardLevelUp', () => {
        it('should compute correct new max HP for level 5 wizard with INT 3', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 10;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                mockCampaignName
            );

            // Level 5: 2*5 + 3 = 13 (same as before)
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardMax',
                13,
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('13');
        });

        it('should scale current HP proportionally when max increased', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 10;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            // Simulate level up from level 5 (max=13) to level 6 with same INT (max=15)
            const level6Stats = {
                name: 'TestWizard',
                rules: '2024',
                level: 6,
                abilities: [{ name: 'Intelligence', bonus: 3 }],
            };

            await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                level6Stats,
                mockCampaignName
            );

            // ratio = 15/13, newHp = round(10 * 15/13) = round(11.54) = 12
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardMax',
                15,
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                12,
                mockCampaignName
            );
        });

        it('should not scale if max did not increase', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 10;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            // Same level, same max
            await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                mockCampaignName
            );

            // current stays at 10, max stays at 13
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardMax',
                13,
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                10,
                mockCampaignName
            );
        });

        it('should cap new HP at new max', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 12;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            // Level up from 5 (max=13) to 6 (max=15), current=12
            const level6Stats = {
                name: 'TestWizard',
                rules: '2024',
                level: 6,
                abilities: [{ name: 'Intelligence', bonus: 3 }],
            };

            // ratio = 15/13, newHp = round(12 * 15/13) = round(13.85) = 14
            await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                level6Stats,
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                14,
                mockCampaignName
            );
        });

        it('should return info when ward is not active', async () => {
            getRuntimeValue.mockReturnValue(false);

            const result = await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not active');
        });

        it('should handle missing Intelligence ability', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 10;
                return undefined;
            });

            const noIntStats = {
                name: 'TestWizard',
                rules: '2024',
                level: 5,
                abilities: [{ name: 'Strength', bonus: 2 }],
            };

            await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                noIntStats,
                mockCampaignName
            );

            // INT bonus = 0, max = 2*5 + 0 = 10
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardMax',
                10,
                mockCampaignName
            );
        });

        it('should handle undefined abilities array', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 10;
                return undefined;
            });

            const noAbilitiesStats = {
                name: 'TestWizard',
                rules: '2024',
                level: 5,
            };

            await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                noAbilitiesStats,
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardMax',
                10,
                mockCampaignName
            );
        });
    });

    describe('onAbjurationSpellCast', () => {
        it('should create new ward when not active', async () => {
            getRuntimeValue.mockReturnValue(false);

            const result = await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                'Shield',
                1, // spell slot level
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardActive',
                true,
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardMax',
                13, // 2*5 + 3
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                13,
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('created');
            expect(result.payload.description).toContain('Shield');
        });

        it('should include restore amount in description', async () => {
            getRuntimeValue.mockReturnValue(false);

            const result = await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                'Shield',
                2,
                mockCampaignName
            );

            expect(result.payload.description).toContain('Regains 4 HP');
        });

        it('should create ward with correct max HP for level 10 wizard', async () => {
            getRuntimeValue.mockReturnValue(false);

            await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                mockPlayerStatsLevel10,
                'Mage Armor',
                1,
                mockCampaignName
            );

            // Level 10: 2*10 + 4 = 24
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardMax',
                24,
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                24,
                mockCampaignName
            );
        });

        it('should log ward creation', async () => {
            getRuntimeValue.mockReturnValue(false);

            await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                'Shield',
                1,
                mockCampaignName
            );

            expect(addEntry).toHaveBeenCalledWith(
                mockCampaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestWizard',
                    abilityName: 'Arcane Ward',
                })
            );
        });

        it('should restore ward HP when already active', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 8;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                'Mage Armor',
                1,
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                10, // 8 + (1*2) = 10
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored 2 HP');
        });

        it('should restore more HP with higher spell slot level', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 8;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                'Mage Armor',
                3,
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                13, // 8 + (3*2) = 14, capped at 13
                mockCampaignName
            );
            expect(result.payload.description).toContain('restored 6 HP');
        });

        it('should cap restored HP at max when already active', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 12;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                'Mage Armor',
                3,
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                13, // capped at max
                mockCampaignName
            );
        });

        it('should log the restoration', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 8;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                'Shield',
                1,
                mockCampaignName
            );

            expect(addEntry).toHaveBeenCalledWith(
                mockCampaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestWizard',
                    description: expect.stringContaining('Shield'),
                })
            );
        });

        it('should default to spell slot level 1 when invalid', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 8;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                'Shield',
                'invalid',
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                10, // 8 + (1*2) = 10
                mockCampaignName
            );
        });
    });
});
