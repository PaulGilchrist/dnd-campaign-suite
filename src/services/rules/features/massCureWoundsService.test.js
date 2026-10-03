// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

vi.mock('../spells/postCastHealService.js', () => ({
    triggerPostCastSelfHeals: vi.fn(() => Promise.resolve(null)),
}));

const { rollExpression } = await import('../../dice/diceRoller.js');
const { getCombatContext } = await import('../../rules/combat/damageUtils.js');
const { applyHealingToTarget } = await import('../../rules/combat/applyHealing.js');
const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../ui/logService.js');
const { getDistanceFeet } = await import('../../rules/combat/rangeValidation.js');
const { triggerPostCastSelfHeals } = await import('../spells/postCastHealService.js');

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

function createCombatContext(players, creatures) {
    return { players, creatures };
}

function trigger(spellOverride, metaCtxOverride, statsOverride) {
    const spell = spellOverride !== undefined ? spellOverride : massCureWoundsSpell;
    const metaCtx = metaCtxOverride !== undefined ? metaCtxOverride : {};
    const stats = statsOverride !== undefined ? statsOverride : basePlayerStats;
    return triggerMassCureWounds(spell, metaCtx, stats, campaignName, mapName);
}

describe('massCureWoundsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerMassCureWounds', () => {
        describe('early returns and guard clauses', () => {
            it('returns null for non-Mass Cure Wounds spells', async () => {
                getCombatContext.mockResolvedValue(createCombatContext([], []));
                expect(await trigger({ name: 'Fire Bolt', level: 0 })).toBeNull();
                expect(rollExpression).not.toHaveBeenCalled();
            });

            it('returns null when spell has no heal_at_slot_level', async () => {
                expect(await trigger({ name: 'Mass Cure Wounds', level: 5 })).toBeNull();
                expect(rollExpression).not.toHaveBeenCalled();
            });

            it('returns null when heal_at_slot_level has no matching slot', async () => {
                const spell = { name: 'Mass Cure Wounds', level: 5, heal_at_slot_level: { 5: '5d8' } };
                expect(await trigger(spell, { slotLevel: 3 })).toBeNull();
                expect(rollExpression).not.toHaveBeenCalled();
            });
        });

        describe('slot level resolution', () => {
            it('uses slotLevel from metaCtx when provided', async () => {
                rollExpression.mockReturnValue({ total: 27, rolls: [15, 12] });
                getCombatContext.mockResolvedValue(createCombatContext([], [{ name: 'Goblin', maxHp: 7, currentHp: 3 }]));
                await trigger(massCureWoundsSpell, { slotLevel: 7 });
                expect(rollExpression).toHaveBeenCalledWith('7d8');
            });

            it('falls back to spell.level when metaCtx has no slotLevel', async () => {
                rollExpression.mockReturnValue({ total: 27, rolls: [15, 12] });
                getCombatContext.mockResolvedValue(createCombatContext([], [{ name: 'Goblin', maxHp: 7, currentHp: 3 }]));
                await trigger();
                expect(rollExpression).toHaveBeenCalledWith('5d8');
            });

            it('falls back to lower slot level expression when exact level not found', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue(createCombatContext([], [{ name: 'Goblin', maxHp: 7, currentHp: 3 }]));
                const spell = { name: 'Mass Cure Wounds', level: 5, heal_at_slot_level: { 3: '3d8', 5: '5d8', 7: '7d8' } };
                await trigger(spell, { slotLevel: 6 });
                expect(rollExpression).toHaveBeenCalledWith('5d8');
            });

            it('uses highest available slot level when slotLevel exceeds all defined', async () => {
                rollExpression.mockReturnValue({ total: 40, rolls: [8, 8, 8, 8, 8] });
                getCombatContext.mockResolvedValue(createCombatContext([], [{ name: 'Goblin', maxHp: 7, currentHp: 3 }]));
                const spell = { name: 'Mass Cure Wounds', level: 5, heal_at_slot_level: { 3: '3d8', 5: '5d8', 7: '7d8' } };
                await trigger(spell, { slotLevel: 9 });
                expect(rollExpression).toHaveBeenCalledWith('7d8');
            });
        });

        describe('spell casting modifier resolution', () => {
            const spellWithMod = {
                name: 'Mass Cure Wounds',
                level: 5,
                spellCastingAbility: 'Wisdom',
                heal_at_slot_level: { 5: '5d8+MOD' },
            };

            function createModifierTest(spell, stats) {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue(createCombatContext([], [{ name: 'Goblin', maxHp: 7, currentHp: 3 }]));
                return trigger(spell || spellWithMod, { slotLevel: 5 }, stats || basePlayerStats);
            }

            it('uses spellCastingAbility from spell object to lookup ability bonus', async () => {
                await createModifierTest();
                expect(rollExpression).toHaveBeenCalledWith('5d8+4');
            });

            it('uses negative ability bonus in expression', async () => {
                const spell = { name: 'Mass Cure Wounds', level: 5, spellCastingAbility: 'Intelligence', heal_at_slot_level: { 5: '5d8+MOD' } };
                const stats = { name: 'Cleric', abilities: [{ name: 'Intelligence', bonus: -3 }] };
                await createModifierTest(spell, stats);
                expect(rollExpression).toHaveBeenCalledWith('5d8+-3');
            });

            it('falls back to spellAbilities.modifier when ability lookup fails', async () => {
                const spell = { name: 'Mass Cure Wounds', level: 5, spellCastingAbility: 'Charisma', heal_at_slot_level: { 5: '5d8+MOD' } };
                await createModifierTest(spell, basePlayerStats);
                expect(rollExpression).toHaveBeenCalledWith('5d8+0');
            });
        });

        describe('target selection', () => {
            it('returns { noTargets: true } when no creatures in combat', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue(createCombatContext([], []));
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(result).toEqual({ noTargets: true });
            });

            it('includes caster in target list', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 5, gridY: 5 }, { name: 'Goblin', gridX: 6, gridY: 5 }, { name: 'Orc', gridX: 7, gridY: 5 }],
                    [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 3 }, { name: 'Orc', maxHp: 15, currentHp: 10 }],
                ));
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(result.targets).toHaveLength(3);
                expect(result.targets.map(t => t.targetName)).toContain('Cleric');
                expect(result.targets.map(t => t.targetName)).toContain('Goblin');
                expect(result.targets.map(t => t.targetName)).toContain('Orc');
            });

            it('limits targets to max 6', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 0, gridY: 0 }, ...Array.from({ length: 10 }, (_, i) => ({ name: `Creature ${i}`, gridX: i + 1, gridY: 0 }))],
                    Array.from({ length: 10 }, (_, i) => ({ name: `Creature ${i}`, maxHp: 20, currentHp: 10 })),
                ));
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(result.targets).toHaveLength(6);
            });

            it('includes all creatures regardless of distance', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 0, gridY: 0 }, { name: 'Close Goblin', gridX: 1, gridY: 0 }, { name: 'Far Orc', gridX: 12, gridY: 0 }],
                    [{ name: 'Close Goblin', maxHp: 7, currentHp: 3 }, { name: 'Far Orc', maxHp: 15, currentHp: 10 }],
                ));
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(result.targets.length).toBe(2);
                expect(result.targets.map(t => t.targetName)).toContain('Close Goblin');
                expect(result.targets.map(t => t.targetName)).toContain('Far Orc');
            });

            it('returns creatures in array order without distance sorting', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 0, gridY: 0 }, { name: 'Far Creature', gridX: 3, gridY: 0 }, { name: 'Near Creature', gridX: 1, gridY: 0 }, { name: 'Mid Creature', gridX: 2, gridY: 0 }],
                    [{ name: 'Far Creature', maxHp: 20, currentHp: 10 }, { name: 'Near Creature', maxHp: 20, currentHp: 10 }, { name: 'Mid Creature', maxHp: 20, currentHp: 10 }],
                ));
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(result.targets.map(t => t.targetName)).toEqual(['Far Creature', 'Near Creature', 'Mid Creature']);
            });

            it('includes all creatures regardless of grid position', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 5, gridY: 5 }],
                    [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 3 }],
                ));
                getCombatContext.mockImplementation(async () => ({
                    players: [{ name: 'Cleric', gridX: 5, gridY: 5 }],
                    creatures: [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 3 }],
                    placedItems: [{ name: 'Goblin', gridX: 6, gridY: 5 }],
                }));
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(result.targets).toHaveLength(2);
                expect(result.targets.map(t => t.targetName)).toContain('Cleric');
                expect(result.targets.map(t => t.targetName)).toContain('Goblin');
            });

            it('includes all creatures when caster has grid position', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 5, gridY: 5 }, { name: 'Goblin', gridX: 6, gridY: 5 }],
                    [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 3 }, { name: 'Ghost', maxHp: 10, currentHp: 5 }],
                ));
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(result.targets).toHaveLength(3);
                expect(result.targets.map(t => t.targetName)).toContain('Cleric');
                expect(result.targets.map(t => t.targetName)).toContain('Goblin');
                expect(result.targets.map(t => t.targetName)).toContain('Ghost');
            });

            it('takes first N creatures from the array', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue(createCombatContext([], [
                    { name: 'Cleric', maxHp: 50, currentHp: 20 },
                    { name: 'Goblin', maxHp: 7, currentHp: 3 },
                    { name: 'Orc', maxHp: 15, currentHp: 10 },
                    { name: 'Troll', maxHp: 25, currentHp: 15 },
                ]));
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(result.targets.length).toBe(4);
                expect(result.targets.map(t => t.targetName)).toEqual(['Cleric', 'Goblin', 'Orc', 'Troll']);
            });
        });

        describe('AoE resolution', () => {
            it('ignores AoE size and includes all creatures', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 0, gridY: 0 }, { name: 'Goblin', gridX: 1, gridY: 0 }],
                    [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 3 }],
                ));
                const spell = { ...massCureWoundsSpell, area_of_effect: { size: '20-foot-radius' } };
                const result = await trigger(spell, { slotLevel: 5 });
                expect(result.targets).toHaveLength(2);
            });

            it('includes all creatures regardless of area_of_effect', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 0, gridY: 0 }, { name: 'Goblin', gridX: 1, gridY: 0 }],
                    [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 3 }],
                ));
                const spell = { name: 'Mass Cure Wounds', level: 5, heal_at_slot_level: { 5: '5d8' } };
                const result = await trigger(spell, { slotLevel: 5 });
                expect(result.targets).toHaveLength(2);
            });
        });

        describe('healing application', () => {
            it('applies healing to each eligible target', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getRuntimeValue.mockReturnValue(5);
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 5, gridY: 5 }, { name: 'Goblin', gridX: 6, gridY: 5 }],
                    [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 3 }],
                ));
                getDistanceFeet.mockReturnValue(5);
                await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(applyHealingToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 2, campaignName);
            });

            it('caps healing at target maxHp', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getRuntimeValue.mockImplementation((name) => name === 'Goblin' ? 6 : null);
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 5, gridY: 5 }, { name: 'Goblin', gridX: 6, gridY: 5 }],
                    [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 6 }],
                ));
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
                const goblinResult = result.targets.find(t => t.targetName === 'Goblin');
                expect(goblinResult.healAmount).toBe(1);
            });

            it('does not apply healing when target is at full health', async () => {
                rollExpression.mockReturnValue({ total: 50, rolls: [10, 10, 10, 10, 10] });
                getRuntimeValue.mockImplementation((name) => name === 'Goblin' ? 7 : null);
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 5, gridY: 5 }, { name: 'Goblin', gridX: 6, gridY: 5 }],
                    [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 7 }],
                ));
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
                const goblinResult = result.targets.find(t => t.targetName === 'Goblin');
                expect(goblinResult.healAmount).toBe(0);
            });

            it('uses stored runtime HP when available', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getRuntimeValue.mockImplementation((name) => name === 'Goblin' ? 1 : null);
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 5, gridY: 5 }, { name: 'Goblin', gridX: 6, gridY: 5 }],
                    [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 5 }],
                ));
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
                const goblinResult = result.targets.find(t => t.targetName === 'Goblin');
                expect(goblinResult.healAmount).toBe(6);
            });
        });

        describe('logging and events', () => {
            it('posts log entries for each target that receives healing', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getRuntimeValue.mockImplementation((name) => name === 'Goblin' ? 5 : null);
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 5, gridY: 5 }, { name: 'Goblin', gridX: 6, gridY: 5 }],
                    [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 3 }],
                ));
                await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
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
                getRuntimeValue.mockImplementation((name) => name === 'Goblin' ? 5 : null);
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 5, gridY: 5 }, { name: 'Goblin', gridX: 6, gridY: 5 }],
                    [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 5 }],
                ));
                const eventHandler = vi.fn();
                window.addEventListener('combat-summary-updated', eventHandler);
                await trigger(massCureWoundsSpell, { slotLevel: 5 });
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
                getCombatContext.mockResolvedValue(createCombatContext(
                    [{ name: 'Cleric', gridX: 5, gridY: 5 }, { name: 'Goblin', gridX: 6, gridY: 5 }, { name: 'Orc', gridX: 7, gridY: 5 }],
                    [{ name: 'Cleric', maxHp: 50, currentHp: 20 }, { name: 'Goblin', maxHp: 7, currentHp: 5 }, { name: 'Orc', maxHp: 15, currentHp: 10 }],
                ));
                getDistanceFeet.mockReturnValue(5);
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
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
                getCombatContext.mockResolvedValue(createCombatContext([], [
                    { name: 'Goblin', maxHp: 7, currentHp: 1 },
                    { name: 'Orc', maxHp: 15, currentHp: 1 },
                    { name: 'Troll', maxHp: 25, currentHp: 1 },
                    { name: 'Ogre', maxHp: 30, currentHp: 1 },
                    { name: 'Yeti', maxHp: 40, currentHp: 1 },
                    { name: 'Giant', maxHp: 60, currentHp: 1 },
                ]));
                const result = await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(result.targets).toHaveLength(6);
                expect(result.totalHealed).toBeGreaterThan(0);
                expect(result.totalHealed).toBe(result.targets.reduce((sum, t) => sum + t.healAmount, 0));
            });
        });

        describe('CLA-038 blessed healer post-cast self-heal', () => {
            it('triggers post-cast self-heals after healing creatures other than caster', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getRuntimeValue.mockReturnValue(1);
                getCombatContext.mockResolvedValue(createCombatContext([], [
                    { name: 'Goblin', maxHp: 7, currentHp: 1 },
                ]));
                await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(triggerPostCastSelfHeals).toHaveBeenCalledWith(
                    massCureWoundsSpell,
                    { slotLevel: 5, targetNames: ['Goblin'] },
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
            });

            it('does not trigger post-cast self-heals when nothing was healed', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getRuntimeValue.mockReturnValue(7);
                getCombatContext.mockResolvedValue(createCombatContext([], [
                    { name: 'Goblin', maxHp: 7, currentHp: 7 },
                ]));
                await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(triggerPostCastSelfHeals).not.toHaveBeenCalled();
            });

            it('triggers when caster plus others are healed', async () => {
                rollExpression.mockReturnValue({ total: 20, rolls: [10, 10] });
                getRuntimeValue.mockReturnValue(1);
                getCombatContext.mockResolvedValue(createCombatContext([], [
                    { name: 'Cleric', maxHp: 50, currentHp: 1 },
                    { name: 'Goblin', maxHp: 7, currentHp: 1 },
                ]));
                await trigger(massCureWoundsSpell, { slotLevel: 5 });
                expect(triggerPostCastSelfHeals).toHaveBeenCalledWith(
                    massCureWoundsSpell,
                    { slotLevel: 5, targetNames: ['Cleric', 'Goblin'] },
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
            });
        });
    });
});
