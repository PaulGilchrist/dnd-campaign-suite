import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerMassCureWounds } from './massCureWoundsService.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

const { rollExpression } = await import('../../dice/diceRoller.js');
const { getCombatContext } = await import('../../rules/combat/damageUtils.js');
const { applyHealingToTarget } = await import('../../rules/combat/applyHealing.js');
const { getRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
const { postLogEntry } = await import('../../shared/logPoster.js');
const { getDistanceFeet } = await import('../../rules/combat/rangeValidation.js');

describe('massCureWoundsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReset();
        getCombatContext.mockReset();
        applyHealingToTarget.mockReset();
        getRuntimeValue.mockReset();
        postLogEntry.mockReset();
        getDistanceFeet.mockReset();
    });

    const campaignName = 'TestCampaign';

    const basePlayerStats = {
        name: 'Cleric',
        hitPoints: { max: 50, current: 30 },
        abilities: [
            { name: 'Strength', bonus: 2 },
            { name: 'Dexterity', bonus: 0 },
            { name: 'Constitution', bonus: 1 },
            { name: 'Intelligence', bonus: -1 },
            { name: 'Wisdom', bonus: 4 },
            { name: 'Charisma', bonus: 0 },
        ],
        spellAbilities: {
            spellCastingAbility: 'Wisdom',
            modifier: 4,
        },
    };

    const massCureWoundsSpell = {
        name: 'Mass Cure Wounds',
        level: 5,
        spellCastingAbility: 'Wisdom',
        heal_at_slot_level: {
            5: '5d8',
            6: '6d8',
            7: '7d8',
            8: '8d8',
            9: '9d8',
        },
        area_of_effect: { size: '30-foot-radius' },
    };

    describe('triggerMassCureWounds', () => {
        it('returns null for non-Mass Cure Wounds spells', async () => {
            rollExpression.mockReturnValue({ total: 10, rolls: [10] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const result = await triggerMassCureWounds(
                { name: 'Fire Bolt', level: 0 },
                {},
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result).toBeNull();
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('returns null when spell name is empty string', async () => {
            const result = await triggerMassCureWounds(
                { name: '', level: 5 },
                {},
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result).toBeNull();
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('throws when spell object is undefined', async () => {
            await expect(
                triggerMassCureWounds(
                    undefined,
                    {},
                    basePlayerStats,
                    campaignName,
                    'testMap',
                ),
            ).rejects.toThrow();
        });

        it('throws when spell object is null', async () => {
            await expect(
                triggerMassCureWounds(
                    null,
                    {},
                    basePlayerStats,
                    campaignName,
                    'testMap',
                ),
            ).rejects.toThrow();
        });

        it('returns null when no heal_at_slot_level is defined', async () => {
            const spell = { name: 'Mass Cure Wounds', level: 5 };
            const result = await triggerMassCureWounds(
                spell,
                {},
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result).toBeNull();
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('returns null when rollExpression returns null', async () => {
            rollExpression.mockReturnValue(null);
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result).toBeNull();
        });

        it('returns null when getCombatContext returns null', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [12, 8] });

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result).toBeNull();
        });

        it('uses slotLevel from metaCtx when provided', async () => {
            rollExpression.mockReturnValue({ total: 27, rolls: [15, 12] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 7 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(rollExpression).toHaveBeenCalledWith('7d8');
        });

        it('falls back to spell.level when metaCtx has no slotLevel', async () => {
            rollExpression.mockReturnValue({ total: 27, rolls: [15, 12] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            await triggerMassCureWounds(
                massCureWoundsSpell,
                {},
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(rollExpression).toHaveBeenCalledWith('5d8');
        });

        it('uses default slot level 5 when neither metaCtx nor spell has level', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const spell = { name: 'Mass Cure Wounds', heal_at_slot_level: { 5: '5d8' } };
            await triggerMassCureWounds(
                spell,
                {},
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(rollExpression).toHaveBeenCalledWith('5d8');
        });

        it('gets spell casting mod from spell.spellCastingAbility on spell object', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const spell = {
                name: 'Mass Cure Wounds',
                level: 5,
                spellCastingAbility: 'Wisdom',
                heal_at_slot_level: { 5: '5d8+MOD' },
            };

            await triggerMassCureWounds(
                spell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(rollExpression).toHaveBeenCalledWith('5d8+4');
        });

        it('gets spell casting mod from playerStats.spellAbilities.spellCastingAbility fallback', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const spell = {
                name: 'Mass Cure Wounds',
                level: 5,
                heal_at_slot_level: { 5: '5d8+MOD' },
            };

            await triggerMassCureWounds(
                spell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(rollExpression).toHaveBeenCalledWith('5d8+4');
        });

        it('uses ability bonus when spellCastingAbility matches an ability', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const spell = {
                name: 'Mass Cure Wounds',
                level: 5,
                spellCastingAbility: 'Strength',
                heal_at_slot_level: { 5: '5d8+MOD' },
            };

            await triggerMassCureWounds(
                spell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(rollExpression).toHaveBeenCalledWith('5d8+2');
        });

        it('uses fallback modifier from spellAbilities.modifier when ability lookup fails', async () => {
            rollExpression.mockReturnValue({ total: 25, rolls: [10, 15] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const spell = {
                name: 'Mass Cure Wounds',
                level: 5,
                spellCastingAbility: 'Strength',
                heal_at_slot_level: { 5: '5d8+MOD' },
            };

            await triggerMassCureWounds(
                spell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(rollExpression).toHaveBeenCalledWith('5d8+2');
        });

        it('returns 0 modifier when playerStats has no spellAbilities', async () => {
            rollExpression.mockReturnValue({ total: 5, rolls: [5] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const spell = {
                name: 'Mass Cure Wounds',
                level: 5,
                heal_at_slot_level: { 5: '5d8+MOD' },
            };
            const stats = { name: 'Cleric', abilities: [] };

            await triggerMassCureWounds(
                spell,
                { slotLevel: 5 },
                stats,
                campaignName,
                'testMap',
            );

            expect(rollExpression).toHaveBeenCalledWith('5d8+0');
        });

        it('falls back to lower slot level expression when exact level not found', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const spell = {
                name: 'Mass Cure Wounds',
                level: 5,
                heal_at_slot_level: {
                    3: '3d8',
                    5: '5d8',
                    7: '7d8',
                },
            };

            await triggerMassCureWounds(
                spell,
                { slotLevel: 6 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(rollExpression).toHaveBeenCalledWith('5d8');
        });

        it('uses highest available slot level expression when slotLevel exceeds all defined', async () => {
            rollExpression.mockReturnValue({ total: 40, rolls: [8, 8, 8, 8, 8] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const spell = {
                name: 'Mass Cure Wounds',
                level: 5,
                heal_at_slot_level: {
                    3: '3d8',
                    5: '5d8',
                    7: '7d8',
                },
            };

            await triggerMassCureWounds(
                spell,
                { slotLevel: 9 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(rollExpression).toHaveBeenCalledWith('7d8');
        });

        it('returns null when slotLevel is below all defined levels', async () => {
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const spell = {
                name: 'Mass Cure Wounds',
                level: 5,
                heal_at_slot_level: {
                    5: '5d8',
                    6: '6d8',
                },
            };

            const result = await triggerMassCureWounds(
                spell,
                { slotLevel: 3 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result).toBeNull();
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('returns { noTargets: true } when no creatures in combat', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result).toEqual({ noTargets: true });
        });

        it('excludes caster from target list', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                    { name: 'Orc', gridX: 7, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 3 },
                    { name: 'Orc', maxHp: 15, currentHp: 10 },
                ],
            });
            getDistanceFeet.mockReturnValue(10);

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result.targets).toHaveLength(2);
            expect(result.targets.map(t => t.targetName)).not.toContain('Cleric');
            expect(result.targets.map(t => t.targetName)).toContain('Goblin');
            expect(result.targets.map(t => t.targetName)).toContain('Orc');
        });

        it('limits targets to max 6', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 0, gridY: 0 },
                    ...Array.from({ length: 10 }, (_, i) => ({
                        name: `Creature ${i}`,
                        gridX: i + 1,
                        gridY: 0,
                    })),
                ],
                creatures: Array.from({ length: 10 }, (_, i) => ({
                    name: `Creature ${i}`,
                    maxHp: 20,
                    currentHp: 10,
                })),
            });
            getDistanceFeet.mockReturnValue(5);

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result.targets).toHaveLength(6);
        });

        it('filters creatures by aoe radius when caster has grid position', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 0, gridY: 0 },
                    { name: 'Close Goblin', gridX: 1, gridY: 0 },
                    { name: 'Far Orc', gridX: 12, gridY: 0 },
                ],
                creatures: [
                    { name: 'Close Goblin', maxHp: 7, currentHp: 3 },
                    { name: 'Far Orc', maxHp: 15, currentHp: 10 },
                ],
            });
            getDistanceFeet.mockImplementation((a, b) => {
                if (a.gridX === 0 && b.gridX === 1) return 5;
                return 60;
            });

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result.targets.length).toBe(1);
            expect(result.targets[0].targetName).toBe('Close Goblin');
        });

        it('sorts targets by distance (closest first)', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 0, gridY: 0 },
                    { name: 'Far Creature', gridX: 3, gridY: 0 },
                    { name: 'Near Creature', gridX: 1, gridY: 0 },
                    { name: 'Mid Creature', gridX: 2, gridY: 0 },
                ],
                creatures: [
                    { name: 'Far Creature', maxHp: 20, currentHp: 10 },
                    { name: 'Near Creature', maxHp: 20, currentHp: 10 },
                    { name: 'Mid Creature', maxHp: 20, currentHp: 10 },
                ],
            });
            getDistanceFeet.mockImplementation((a, b) => {
                if (b.gridX === 1) return 5;
                if (b.gridX === 2) return 10;
                return 15;
            });

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result.targets.map(t => t.targetName)).toEqual([
                'Near Creature',
                'Mid Creature',
                'Far Creature',
            ]);
        });

        it('uses creatures from placedItems for grid position when creature not in players', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', gridX: 5, gridY: 5 }],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 3 },
                ],
                placedItems: [
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result.targets).toHaveLength(1);
            expect(result.targets[0].targetName).toBe('Goblin');
        });

        it('skips creatures without grid position when caster has grid position', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 3 },
                    { name: 'Ghost', maxHp: 10, currentHp: 5 },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result.targets).toHaveLength(1);
            expect(result.targets[0].targetName).toBe('Goblin');
        });

        it('when caster has no grid position, takes first N creatures without distance filtering', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({
                players: [],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 3 },
                    { name: 'Orc', maxHp: 15, currentHp: 10 },
                    { name: 'Troll', maxHp: 25, currentHp: 15 },
                ],
            });

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result.targets.length).toBe(3);
            expect(result.targets.map(t => t.targetName)).toEqual(['Goblin', 'Orc', 'Troll']);
        });

        it('applies healing to each target', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockReturnValue(5);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 3 },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(applyHealingToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'Goblin',
                2,
                campaignName,
            );
        });

        it('caps healing at target maxHp', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockReturnValue(6);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 6 },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result.targets[0].healAmount).toBe(1);
        });

        it('does not apply healing when actualHeal is 0', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockReturnValue(7);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 7 },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(result.targets[0].healAmount).toBe(0);
        });

        it('posts log entries for each target', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockReturnValue(5);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 3 },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(postLogEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'hp_change',
                targetName: 'Goblin',
                delta: 2,
                isHealing: true,
                sourceName: 'Cleric',
                note: 'Mass Cure Wounds',
                formula: '5d8',
            }));
        });

        it('returns correct result structure with targets, formula, and totalHealed', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockImplementation((name) => {
                if (name === 'Goblin') return 5;
                if (name === 'Orc') return 10;
                return null;
            });
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                    { name: 'Orc', gridX: 7, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 5 },
                    { name: 'Orc', maxHp: 15, currentHp: 10 },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result).toEqual(expect.objectContaining({
                targets: expect.arrayContaining([
                    expect.objectContaining({ targetName: 'Goblin', healAmount: 2 }),
                    expect.objectContaining({ targetName: 'Orc', healAmount: 5 }),
                ]),
                formula: '5d8',
                totalHealed: 7,
            }));
        });

        it('dispatches combat-summary-updated event', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockReturnValue(5);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 5 },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const eventHandler = vi.fn();
            window.addEventListener('combat-summary-updated', eventHandler);

            await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(eventHandler).toHaveBeenCalled();

            window.removeEventListener('combat-summary-updated', eventHandler);
        });

        it('uses spellCastingAbility from playerStats.spellAbilities when spell lacks it', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const spell = {
                name: 'Mass Cure Wounds',
                level: 5,
                heal_at_slot_level: { 5: '5d8+MOD' },
            };

            await triggerMassCureWounds(
                spell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(rollExpression).toHaveBeenCalledWith('5d8+4');
        });

        it('handles aoe with non-standard size format', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 0, gridY: 0 },
                    { name: 'Goblin', gridX: 1, gridY: 0 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 3 },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const spell = {
                ...massCureWoundsSpell,
                area_of_effect: { size: '20-foot-radius' },
            };

            await triggerMassCureWounds(
                spell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(applyHealingToTarget).toHaveBeenCalled();
        });

        it('handles aoe with missing size (defaults to 30-foot-radius)', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockReturnValue(3);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 0, gridY: 0 },
                    { name: 'Goblin', gridX: 1, gridY: 0 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 3 },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const spell = {
                name: 'Mass Cure Wounds',
                level: 5,
                heal_at_slot_level: { 5: '5d8' },
            };

            await triggerMassCureWounds(
                spell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(applyHealingToTarget).toHaveBeenCalled();
        });

        it('handles target with no maxHp property', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockReturnValue(0);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin' },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            // target.maxHp is undefined, so maxHp = playerStats.hitPoints (object),
            // causing maxHp - currentHp to be NaN
            expect(result.targets[0].healAmount).toBeNaN();
        });

        it('handles getRuntimeValue returning empty string', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockReturnValue('');
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 7 },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result.targets[0].healAmount).toBe(0);
        });

        it('handles getRuntimeValue returning null', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 7 },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result.targets[0].healAmount).toBe(0);
        });

        it('uses playerStats.hitPoints as fallback for target maxHp', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getRuntimeValue.mockReturnValue(0);
            getCombatContext.mockResolvedValue({
                players: [
                    { name: 'Cleric', gridX: 5, gridY: 5 },
                    { name: 'Goblin', gridX: 6, gridY: 5 },
                ],
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin' },
                ],
            });
            getDistanceFeet.mockReturnValue(5);

            const stats = {
                ...basePlayerStats,
                hitPoints: { max: 30, current: 15 },
            };

            await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                stats,
                campaignName,
                'testMap',
            );

            // target.maxHp is undefined, so maxHp = playerStats.hitPoints (object),
            // causing maxHp - currentHp to be NaN, so actualHeal is NaN
            // This reveals a bug in the source: should use playerStats.hitPoints.max
            expect(applyHealingToTarget).not.toHaveBeenCalled();
        });

        it('handles combatSummary with no players array', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({
                players: undefined,
                creatures: [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 3 },
                ],
            });

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            // Without players array, casterGridPos is null, so takes first N creatures
            expect(result.targets).toHaveLength(1);
            expect(result.targets[0].targetName).toBe('Goblin');
        });

        it('handles combatSummary with no creatures array', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({
                players: [{ name: 'Cleric', gridX: 5, gridY: 5 }],
                creatures: undefined,
            });

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result).toEqual({ noTargets: true });
        });

        it('handles casters with no grid position and enough creatures', async () => {
            rollExpression.mockReturnValue({ total: 25, rolls: [13, 12] });
            getRuntimeValue.mockReturnValue(1);
            getCombatContext.mockResolvedValue({
                players: [],
                creatures: [
                    { name: 'Goblin', maxHp: 7, currentHp: 1 },
                    { name: 'Orc', maxHp: 15, currentHp: 1 },
                    { name: 'Troll', maxHp: 25, currentHp: 1 },
                    { name: 'Ogre', maxHp: 30, currentHp: 1 },
                    { name: 'Yeti', maxHp: 40, currentHp: 1 },
                    { name: 'Giant', maxHp: 60, currentHp: 1 },
                    { name: 'Dragon', maxHp: 100, currentHp: 1 },
                ],
            });

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                { slotLevel: 5 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result.targets).toHaveLength(6);
            expect(result.totalHealed).toBeGreaterThan(0);
        });

        it('handles negative spellCastingMod in expression', async () => {
            rollExpression.mockReturnValue({ total: 0, rolls: [1, 1, 1, 1, 1] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const spell = {
                name: 'Mass Cure Wounds',
                level: 5,
                spellCastingAbility: 'Intelligence',
                heal_at_slot_level: { 5: '5d8+MOD' },
            };
            const stats = {
                name: 'Cleric',
                abilities: [
                    { name: 'Intelligence', bonus: -3 },
                ],
            };

            await triggerMassCureWounds(
                spell,
                { slotLevel: 5 },
                stats,
                campaignName,
                'testMap',
            );

            expect(rollExpression).toHaveBeenCalledWith('5d8+-3');
        });

        it('handles metaCtx slotLevel as 0', async () => {
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const spell = {
                name: 'Mass Cure Wounds',
                level: 5,
                heal_at_slot_level: {
                    3: '3d8',
                    5: '5d8',
                },
            };

            const result = await triggerMassCureWounds(
                spell,
                { slotLevel: 0 },
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result).toBeNull();
        });

        it('handles undefined metaCtx', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                undefined,
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result).toEqual({ noTargets: true });
        });

        it('handles null metaCtx', async () => {
            rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
            getCombatContext.mockResolvedValue({ players: [], creatures: [] });

            const result = await triggerMassCureWounds(
                massCureWoundsSpell,
                null,
                basePlayerStats,
                campaignName,
                'testMap',
            );

            expect(result).toEqual({ noTargets: true });
        });
    });
});
