// @cleaned-by-ai
import {
    handle,
    onArcaneWardRestore,
    onArcaneWardDestroy,
    onArcaneWardLevelUp,
    onAbjurationSpellCast,
    onArcaneWardBonusActionRestore,
} from './arcaneWardHandler.js';
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

const campaignName = 'test-campaign';

function makeWizardStats(name, level, intBonus) {
    return {
        name,
        rules: '2024',
        level,
        abilities: [{ name: 'Intelligence', bonus: intBonus }],
    };
}

function setWardMocks(getRuntimeValueImpl) {
    getRuntimeValue.mockImplementation(getRuntimeValueImpl);
}

function setCombatMocks(targetName, projectedDamage, currentHp, maxHp) {
    getCombatSummary.mockReturnValue({
        creatures: [
            { name: 'TestWizard', targetName },
            { name: targetName },
        ],
        activeCreatureName: 'TestWizard',
    });
    getTargetFromAttacker.mockReturnValue({ name: targetName });
    setWardMocks((player, key) => {
        if (key === 'arcaneWardActive') return true;
        if (key === 'arcaneWardHp') return 8;
        if (key === 'arcaneWardMax') return 13;
        if (player === targetName && key === 'projectedWardDamage') return projectedDamage;
        if (player === targetName && key === 'currentHitPoints') return currentHp;
        if (player === targetName && key === 'maxHitPoints') return maxHp;
        return undefined;
    });
}

describe('arcaneWardHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        describe('ward not active', () => {
            it('returns info popup directing user to cast an Abjuration spell', async () => {
                setWardMocks((player, key) => {
                    if (key === 'arcaneWardActive') return false;
                    return undefined;
                });

                const result = await handle(
                    { name: 'Arcane Ward', description: 'Create a magical ward...' },
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                expect(result).toEqual({
                    type: 'popup',
                    payload: expect.objectContaining({
                        type: 'automation_info',
                        name: 'Arcane Ward',
                        description: expect.stringContaining('not active'),
                    }),
                });
            });
        });

        describe('bonus action automation type', () => {
            it('returns modal to choose spell slot level', async () => {
                setWardMocks((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    return undefined;
                });

                const result = await handle(
                    { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                expect(result).toEqual({
                    type: 'modal',
                    modalName: 'arcaneWardRestore',
                    payload: { action: expect.objectContaining({ name: 'Arcane Ward' }) },
                });
            });
        });

        describe('projected ward - no combat context', () => {
            it('returns info popup when there is no combat summary', async () => {
                getCombatSummary.mockReturnValue(null);
                setWardMocks((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 5;
                    if (key === 'arcaneWardMax') return 13;
                    return undefined;
                });

                const result = await handle(
                    { name: 'Arcane Ward', automation: { type: 'projected_ward' } },
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                expect(result.payload.description).toContain('Arcane Ward is active');
                expect(result.payload.description).toContain('No combat context available');
            });
        });

        describe('projected ward - no target', () => {
            it('returns info popup when no target is selected', async () => {
                getCombatSummary.mockReturnValue({
                    creatures: [{ name: 'TestWizard' }],
                    activeCreatureName: 'TestWizard',
                });
                getTargetFromAttacker.mockReturnValue(null);
                setWardMocks((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 8;
                    if (key === 'arcaneWardMax') return 13;
                    return undefined;
                });

                const result = await handle(
                    { name: 'Arcane Ward', automation: { type: 'projected_ward' } },
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                expect(result.payload.description).toContain('No target selected');
            });
        });

        describe('projected ward - no damage', () => {
            it('returns info when projectedWardDamage is undefined or zero', async () => {
                setCombatMocks('Goblin', undefined, 5, 10);

                let result = await handle(
                    { name: 'Arcane Ward', automation: { type: 'projected_ward' } },
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                expect(result.payload.description).toContain('No recent damage detected');

                getCombatSummary.mockReturnValue({
                    creatures: [{ name: 'TestWizard', targetName: 'Goblin' }, { name: 'Goblin' }],
                    activeCreatureName: 'TestWizard',
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                setWardMocks((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 8;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 0 };
                    return undefined;
                });

                result = await handle(
                    { name: 'Arcane Ward', automation: { type: 'projected_ward' } },
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                expect(result.payload.description).toContain('No recent damage detected');
            });
        });

        describe('projected ward - full absorption', () => {
            it('absorbs all damage and restores target HP to max', async () => {
                setCombatMocks('Goblin', { rawDamage: 7 }, 5, 10);
                setWardMocks((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 10;
                    if (key === 'arcaneWardMax') return 15;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 7 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return 5;
                    if (player === 'Goblin' && key === 'maxHitPoints') return 10;
                    return undefined;
                });

                const result = await handle(
                    { name: 'Arcane Ward', automation: { type: 'projected_ward' } },
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 10, campaignName);
                expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 3, campaignName);
                expect(result.payload.description).toContain('All damage absorbed');
                expect(result.payload.description).toContain('absorbed 7');
            });

            it('caps target HP at maxHitPoints when restoration would exceed it', async () => {
                getCombatSummary.mockReturnValue({
                    creatures: [{ name: 'TestWizard', targetName: 'Goblin' }, { name: 'Goblin' }],
                    activeCreatureName: 'TestWizard',
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                setWardMocks((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 10;
                    if (key === 'arcaneWardMax') return 15;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 8 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return 9;
                    if (player === 'Goblin' && key === 'maxHitPoints') return 10;
                    return undefined;
                });

                await handle(
                    { name: 'Arcane Ward', automation: { type: 'projected_ward' } },
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 10, campaignName);
                expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 2, campaignName);
            });
        });

        describe('projected ward - partial absorption', () => {
            it('absorbs what ward has and lets the rest through', async () => {
                getCombatSummary.mockReturnValue({
                    creatures: [{ name: 'TestWizard', targetName: 'Ogre' }, { name: 'Ogre' }],
                    activeCreatureName: 'TestWizard',
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Ogre' });
                setWardMocks((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 5;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Ogre' && key === 'projectedWardDamage') return { rawDamage: 12 };
                    if (player === 'Ogre' && key === 'currentHitPoints') return 8;
                    if (player === 'Ogre' && key === 'maxHitPoints') return 15;
                    return undefined;
                });

                const result = await handle(
                    { name: 'Arcane Ward', automation: { type: 'projected_ward' } },
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                expect(setRuntimeValue).toHaveBeenCalledWith('Ogre', 'currentHitPoints', 13, campaignName);
                expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 0, campaignName);
                expect(result.payload.description).toContain('absorbed 5');
                expect(result.payload.description).toContain('7 remaining damage');
            });
        });

        describe('projected ward - null target HP', () => {
            it('skips target HP restoration when currentHitPoints is null', async () => {
                getCombatSummary.mockReturnValue({
                    creatures: [{ name: 'TestWizard', targetName: 'Goblin' }, { name: 'Goblin' }],
                    activeCreatureName: 'TestWizard',
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                setWardMocks((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 5;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 4 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return null;
                    if (player === 'Goblin' && key === 'maxHitPoints') return 10;
                    return undefined;
                });

                await handle(
                    { name: 'Arcane Ward', automation: { type: 'projected_ward' } },
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'currentHitPoints', expect.any(Number), campaignName);
                expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 1, campaignName);
            });
        });

        describe('projected ward - null maxHitPoints', () => {
            it('caps target HP at currentHitPoints + absorbed when maxHitPoints is null', async () => {
                getCombatSummary.mockReturnValue({
                    creatures: [{ name: 'TestWizard', targetName: 'Goblin' }, { name: 'Goblin' }],
                    activeCreatureName: 'TestWizard',
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                setWardMocks((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 5;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 4 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return 8;
                    if (player === 'Goblin' && key === 'maxHitPoints') return null;
                    return undefined;
                });

                await handle(
                    { name: 'Arcane Ward', automation: { type: 'projected_ward' } },
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                // maxHitPoints is null, fallback is targetHp + absorbed = 8 + 4 = 12
                expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 12, campaignName);
            });
        });

        describe('projected ward - logging', () => {
            it('logs ability_use and ward_absorbed entries', async () => {
                getCombatSummary.mockReturnValue({
                    creatures: [{ name: 'TestWizard', targetName: 'Goblin' }, { name: 'Goblin' }],
                    activeCreatureName: 'TestWizard',
                });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
                setWardMocks((player, key) => {
                    if (key === 'arcaneWardActive') return true;
                    if (key === 'arcaneWardHp') return 5;
                    if (key === 'arcaneWardMax') return 13;
                    if (player === 'Goblin' && key === 'projectedWardDamage') return { rawDamage: 3 };
                    if (player === 'Goblin' && key === 'currentHitPoints') return 6;
                    if (player === 'Goblin' && key === 'maxHitPoints') return 10;
                    return undefined;
                });

                await handle(
                    { name: 'Arcane Ward', automation: { type: 'projected_ward' } },
                    makeWizardStats('TestWizard', 5, 3),
                    campaignName,
                );

                expect(addEntry).toHaveBeenCalledWith(
                    campaignName,
                    expect.objectContaining({
                        type: 'ability_use',
                        characterName: 'TestWizard',
                        abilityName: 'Arcane Ward',
                    }),
                );
                expect(addEntry).toHaveBeenCalledWith(
                    campaignName,
                    expect.objectContaining({
                        type: 'ward_absorbed',
                        targetName: 'Goblin',
                        damage: 3,
                        wizardName: 'TestWizard',
                        remainingWardHp: 2,
                    }),
                );
            });
        });
    });

    describe('onArcaneWardRestore', () => {
        it('restores ward HP based on spell slot level', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                makeWizardStats('TestWizard', 5, 3),
                2,
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 9, campaignName);
            expect(result.payload.description).toContain('restored 4 HP');
        });

        it('caps ward HP at max when restoration would exceed it', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 12;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                makeWizardStats('TestWizard', 5, 3),
                3,
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 13, campaignName);
        });

        it('defaults to spell slot level 1 when value is invalid', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                makeWizardStats('TestWizard', 5, 3),
                'invalid',
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 7, campaignName);
        });

        it('defaults to 0 when ward HP is not set', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return undefined;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                makeWizardStats('TestWizard', 5, 3),
                1,
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 2, campaignName);
        });
    });

    describe('onArcaneWardBonusActionRestore', () => {
        it('uses the lowest available spell slot to restore ward HP', async () => {
            setWardMocks((player, key) => {
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
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 9, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_2', 1, campaignName);
            expect(result.payload.description).toContain('restored 4 HP');
            expect(result.payload.description).toContain('level 2');
        });

        it('falls back to level 1 when it is the only slot available', async () => {
            setWardMocks((player, key) => {
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
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 7, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'spell_slots_level_1', 2, campaignName);
        });

        it('returns info popup when no spell slots are available', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                if (key.startsWith('spell_slots_level_')) return 0;
                return undefined;
            });

            const result = await onArcaneWardBonusActionRestore(
                { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No spell slots available');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns info popup when ward is not active', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return false;
                if (key === 'spell_slots_level_1') return 3;
                return undefined;
            });

            const result = await onArcaneWardBonusActionRestore(
                { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not active');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('caps ward HP at max when restoration would exceed it', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 12;
                if (key === 'arcaneWardMax') return 13;
                if (key === 'spell_slots_level_1') return 3;
                return undefined;
            });

            await onArcaneWardBonusActionRestore(
                { name: 'Arcane Ward', automation: { type: 'arcane_ward_bonus_action' } },
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 13, campaignName);
        });
    });

    describe('onArcaneWardDestroy', () => {
        it('sets ward active to false, HP and max to 0', async () => {
            const result = await onArcaneWardDestroy(
                { name: 'Arcane Ward' },
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                1,
                'TestWizard',
                'arcaneWardActive',
                false,
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                2,
                'TestWizard',
                'arcaneWardHp',
                0,
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                3,
                'TestWizard',
                'arcaneWardMax',
                0,
                campaignName,
            );
            expect(result.payload.description).toContain('destroyed');
            expect(result.payload.description).toContain('Long Rest');
        });
    });

    describe('onArcaneWardLevelUp', () => {
        it('computes correct max HP: 2 × level + INT modifier', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 10;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            // 2*5 + 3 = 13
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 13, campaignName);
        });

        it('scales current HP proportionally when max increases', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 10;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const level6Stats = makeWizardStats('TestWizard', 6, 3);

            await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                level6Stats,
                campaignName,
            );

            // prevMax=13, newMax=15, ratio=15/13, newHp=round(10*15/13)=round(11.54)=12
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 15, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 12, campaignName);
        });

        it('does not change current HP when max did not increase', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 10;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 13, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 10, campaignName);
        });

        it('caps scaled HP at new max', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 12;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const level6Stats = makeWizardStats('TestWizard', 6, 3);

            await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                level6Stats,
                campaignName,
            );

            // ratio=15/13, newHp=round(12*15/13)=round(13.85)=14, capped at 15
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 14, campaignName);
        });

        it('returns info popup when ward is not active', async () => {
            setWardMocks(() => false);

            const result = await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                makeWizardStats('TestWizard', 5, 3),
                campaignName,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not active');
        });

        it('handles missing or undefined Intelligence ability by using 0 modifier', async () => {
            setWardMocks((player, key) => {
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
                campaignName,
            );

            // 2*5 + 0 = 10
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 10, campaignName);
        });
    });

    describe('onAbjurationSpellCast', () => {
        it('creates a new ward when one is not active', async () => {
            setWardMocks(() => false);

            const result = await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                makeWizardStats('TestWizard', 5, 3),
                'Shield',
                1,
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                1,
                'TestWizard',
                'arcaneWardActive',
                true,
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                2,
                'TestWizard',
                'arcaneWardMax',
                13,
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenNthCalledWith(
                3,
                'TestWizard',
                'arcaneWardHp',
                13,
                campaignName,
            );
            expect(result.payload.description).toContain('created');
            expect(result.payload.description).toContain('Shield');
        });

        it('creates ward with correct max HP for different wizard levels', async () => {
            setWardMocks(() => false);

            const level10Stats = makeWizardStats('TestWizard', 10, 4);

            await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                level10Stats,
                'Mage Armor',
                1,
                campaignName,
            );

            // 2*10 + 4 = 24
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardMax', 24, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 24, campaignName);
        });

        it('restores ward HP when ward is already active', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 8;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                makeWizardStats('TestWizard', 5, 3),
                'Mage Armor',
                1,
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 10, campaignName);
            expect(result.payload.description).toContain('restored 2 HP');
        });

        it('restores more HP with a higher spell slot level', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 8;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                makeWizardStats('TestWizard', 5, 3),
                'Mage Armor',
                3,
                campaignName,
            );

            // 8 + (3*2) = 14, capped at 13
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 13, campaignName);
            expect(result.payload.description).toContain('restored 6 HP');
        });

        it('caps restored HP at max when already active', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 12;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                makeWizardStats('TestWizard', 5, 3),
                'Mage Armor',
                3,
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 13, campaignName);
        });

        it('defaults to spell slot level 1 when value is invalid', async () => {
            setWardMocks((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 8;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                makeWizardStats('TestWizard', 5, 3),
                'Shield',
                'invalid',
                campaignName,
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'arcaneWardHp', 10, campaignName);
        });
    });
});
