// @improved-by-ai
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

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
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
const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { postLogEntry } = await import('../../shared/logPoster.js');
const { getDistanceFeet } = await import('../../rules/combat/rangeValidation.js');

describe('massCureWoundsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';

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
        describe('early returns and guard clauses', () => {
            it('returns null for non-Mass Cure Wounds spells', async () => {
                getCombatContext.mockResolvedValue({ players: [], creatures: [] });

                const result = await triggerMassCureWounds(
                    { name: 'Fire Bolt', level: 0 },
                    {},
                    basePlayerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(rollExpression).not.toHaveBeenCalled();
            });

            it('returns null when spell has no heal_at_slot_level', async () => {
                const spell = { name: 'Mass Cure Wounds', level: 5 };
                const result = await triggerMassCureWounds(
                    spell,
                    {},
                    basePlayerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(rollExpression).not.toHaveBeenCalled();
            });

            it('returns null when heal_at_slot_level has no matching slot', async () => {
                const spell = {
                    name: 'Mass Cure Wounds',
                    level: 5,
                    heal_at_slot_level: { 5: '5d8' },
                };

                const result = await triggerMassCureWounds(
                    spell,
                    { slotLevel: 3 },
                    basePlayerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(rollExpression).not.toHaveBeenCalled();
            });
        });

        describe('slot level resolution', () => {
            it('uses slotLevel from metaCtx when provided', async () => {
                rollExpression.mockReturnValue({ total: 27, rolls: [15, 12] });
                getCombatContext.mockResolvedValue({ players: [], creatures: [] });

                await triggerMassCureWounds(
                    massCureWoundsSpell,
                    { slotLevel: 7 },
                    basePlayerStats,
                    campaignName,
                    mapName,
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
                    mapName,
                );

                expect(rollExpression).toHaveBeenCalledWith('5d8');
            });

            it('falls back to lower slot level expression when exact level not found', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue({ players: [], creatures: [] });

                const spell = {
                    name: 'Mass Cure Wounds',
                    level: 5,
                    heal_at_slot_level: { 3: '3d8', 5: '5d8', 7: '7d8' },
                };

                await triggerMassCureWounds(
                    spell,
                    { slotLevel: 6 },
                    basePlayerStats,
                    campaignName,
                    mapName,
                );

                expect(rollExpression).toHaveBeenCalledWith('5d8');
            });

            it('uses highest available slot level when slotLevel exceeds all defined', async () => {
                rollExpression.mockReturnValue({ total: 40, rolls: [8, 8, 8, 8, 8] });
                getCombatContext.mockResolvedValue({ players: [], creatures: [] });

                const spell = {
                    name: 'Mass Cure Wounds',
                    level: 5,
                    heal_at_slot_level: { 3: '3d8', 5: '5d8', 7: '7d8' },
                };

                await triggerMassCureWounds(
                    spell,
                    { slotLevel: 9 },
                    basePlayerStats,
                    campaignName,
                    mapName,
                );

                expect(rollExpression).toHaveBeenCalledWith('7d8');
            });
        });

        describe('spell casting modifier resolution', () => {
            it('uses spellCastingAbility from spell object to lookup ability bonus', async () => {
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
                    mapName,
                );

                expect(rollExpression).toHaveBeenCalledWith('5d8+4');
            });

            it('uses negative ability bonus in expression', async () => {
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
                    abilities: [{ name: 'Intelligence', bonus: -3 }],
                };

                await triggerMassCureWounds(
                    spell,
                    { slotLevel: 5 },
                    stats,
                    campaignName,
                    mapName,
                );

                expect(rollExpression).toHaveBeenCalledWith('5d8+-3');
            });

            it('falls back to spellAbilities.modifier when ability lookup fails', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue({ players: [], creatures: [] });

                const spell = {
                    name: 'Mass Cure Wounds',
                    level: 5,
                    spellCastingAbility: 'Charisma',
                    heal_at_slot_level: { 5: '5d8+MOD' },
                };

                await triggerMassCureWounds(
                    spell,
                    { slotLevel: 5 },
                    basePlayerStats,
                    campaignName,
                    mapName,
                );

                expect(rollExpression).toHaveBeenCalledWith('5d8+0');
            });
        });

        describe('target selection', () => {
            it('returns { noTargets: true } when no creatures in combat', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue({ players: [], creatures: [] });

                const result = await triggerMassCureWounds(
                    massCureWoundsSpell,
                    { slotLevel: 5 },
                    basePlayerStats,
                    campaignName,
                    mapName,
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
                    mapName,
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
                    mapName,
                );

                expect(result.targets).toHaveLength(6);
            });

            it('filters creatures by AoE radius when caster has grid position', async () => {
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
                    mapName,
                );

                expect(result.targets.length).toBe(1);
                expect(result.targets[0].targetName).toBe('Close Goblin');
            });

            it('sorts targets by distance closest first', async () => {
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
                getDistanceFeet.mockImplementation((_caster, target) => {
                    if (target.gridX === 1) return 5;
                    if (target.gridX === 2) return 10;
                    return 15;
                });

                const result = await triggerMassCureWounds(
                    massCureWoundsSpell,
                    { slotLevel: 5 },
                    basePlayerStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets.map(t => t.targetName)).toEqual([
                    'Near Creature',
                    'Mid Creature',
                    'Far Creature',
                ]);
            });

            it('uses placedItems for grid position when creature not in players', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue({
                    players: [{ name: 'Cleric', gridX: 5, gridY: 5 }],
                    creatures: [
                        { name: 'Cleric', maxHp: 50, currentHp: 20 },
                        { name: 'Goblin', maxHp: 7, currentHp: 3 },
                    ],
                    placedItems: [{ name: 'Goblin', gridX: 6, gridY: 5 }],
                });
                getDistanceFeet.mockReturnValue(5);

                const result = await triggerMassCureWounds(
                    massCureWoundsSpell,
                    { slotLevel: 5 },
                    basePlayerStats,
                    campaignName,
                    mapName,
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
                    mapName,
                );

                expect(result.targets).toHaveLength(1);
                expect(result.targets[0].targetName).toBe('Goblin');
            });

            it('takes first N creatures without distance filtering when caster has no grid position', async () => {
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
                    mapName,
                );

                expect(result.targets.length).toBe(3);
                expect(result.targets.map(t => t.targetName)).toEqual(['Goblin', 'Orc', 'Troll']);
            });
        });

        describe('AoE resolution', () => {
            it('handles non-standard AoE size format', async () => {
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

                const result = await triggerMassCureWounds(
                    spell,
                    { slotLevel: 5 },
                    basePlayerStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets).toHaveLength(1);
            });

            it('defaults to 30-foot-radius when area_of_effect is missing', async () => {
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

                const result = await triggerMassCureWounds(
                    spell,
                    { slotLevel: 5 },
                    basePlayerStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets).toHaveLength(1);
            });
        });

        describe('healing application', () => {
            it('applies healing to each eligible target', async () => {
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
                    mapName,
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
                    mapName,
                );

                expect(result.targets[0].healAmount).toBe(1);
            });

            it('does not apply healing when target is at full health', async () => {
                rollExpression.mockReturnValue({ total: 50, rolls: [10, 10, 10, 10, 10] });
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
                    mapName,
                );

                expect(applyHealingToTarget).not.toHaveBeenCalled();
                expect(result.targets[0].healAmount).toBe(0);
            });

            it('uses stored runtime HP when available', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getRuntimeValue.mockReturnValue(1);
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

                const result = await triggerMassCureWounds(
                    massCureWoundsSpell,
                    { slotLevel: 5 },
                    basePlayerStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets[0].healAmount).toBe(6);
            });
        });

        describe('logging and events', () => {
            it('posts log entries for each target that receives healing', async () => {
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
                    mapName,
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
                    mapName,
                );

                expect(eventHandler).toHaveBeenCalled();

                window.removeEventListener('combat-summary-updated', eventHandler);
            });
        });

        describe('result structure', () => {
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
                    mapName,
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

            it('calculates totalHealed as sum of all individual heal amounts', async () => {
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
                    ],
                });

                const result = await triggerMassCureWounds(
                    massCureWoundsSpell,
                    { slotLevel: 5 },
                    basePlayerStats,
                    campaignName,
                    mapName,
                );

                expect(result.targets).toHaveLength(6);
                expect(result.totalHealed).toBeGreaterThan(0);
                expect(result.totalHealed).toBe(
                    result.targets.reduce((sum, t) => sum + t.healAmount, 0),
                );
            });
        });
    });
});
