import { describe, it, expect, vi, beforeEach } from 'vitest';
import useDamageClick from './useDamageClick.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    collectWeaponMastery: vi.fn(),
    evaluateAutoExpression: vi.fn(),
    hasTwoWeaponFighting: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';
import { parseMagicItemName } from '../../services/rules/core/attackCalc.js';

const mockPlayerStats = {
    name: 'TestFighter',
    level: 20,
    abilities: [
        { name: 'Strength', bonus: 5 },
        { name: 'Dexterity', bonus: 2 },
    ],
    proficiency: 6,
    class: { name: 'Fighter', class_levels: [{ level: 20, rage_damage: 2 }] },
    automation: { actions: [], passives: [] },
    inventory: { equipped: ['Shield'] },
    equipment: [{ name: 'Shield', equipment_category: 'Shield' }],
};

const mockCampaignName = 'test-campaign';
const defaultRollResult = { total: 5, rolls: [5], modifier: 0 };

describe('useDamageClick - feats', () => {
    const mockSetPopupHtml = vi.fn();
    const mockRollDamage = vi.fn();
    const mockBuildCtx = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
    const mockBuildCtxSync = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
    const mockSetDamageTypeChoice = vi.fn();
    const mockSetDivineFuryChoice = vi.fn();
    const mockSetWeaponMasteryModal = vi.fn();
    const mockSetAttackRiderModal = vi.fn();
    const mockPendingDamageRef = { current: null };

    function UseDamageClick(overrides = {}) {
        const deps = {
            playerStats: mockPlayerStats,
            campaignName: mockCampaignName,
            mapName: null,
            popupHtml: null,
            setPopupHtml: mockSetPopupHtml,
            rollDamage: mockRollDamage,
            buildCtx: mockBuildCtx,
            buildCtxSync: mockBuildCtxSync,
            setDamageTypeChoice: mockSetDamageTypeChoice,
            setDivineFuryChoice: mockSetDivineFuryChoice,
            setWeaponMasteryModal: mockSetWeaponMasteryModal,
            setAttackRiderModal: mockSetAttackRiderModal,
            pendingDamageRef: mockPendingDamageRef,
            ...overrides,
        };
        return useDamageClick(deps);
    }

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue(defaultRollResult);
        rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
        getCombatContext.mockResolvedValue(null);
        getTargetFromAttacker.mockReturnValue(null);
        getCurrentCombatRound.mockReturnValue(1);
        parseMagicItemName.mockImplementation((name) => ({ baseName: name }));
        mockBuildCtx.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockBuildCtxSync.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockPendingDamageRef.current = null;
    });

    async function tick() {
        await new Promise(r => setTimeout(r, 0));
    }

    describe('Charger feat', () => {
        it('applies Charger attack rider effect on melee hit after charge', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'melee_hit_after_10ft_charge',
                            chooseOne: true, name: 'Charge Attack',
                            options: [{ name: 'Push 10 ft', effect: 'push', value: 10 }],
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+5', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    source: 'Charge Attack',
                    effect: 'push',
                    value: 10,
                }),
            ]), 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Charge_Attack_usedRound', 1, 'test-campaign');
        });
    });

    describe('Shield Master', () => {
        it('applies Shield Bash rider effect when shield is equipped', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'melee_hit_with_shield_equipped',
                            name: 'Shield Bash',
                            options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+5', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    source: 'Shield Bash',
                    effect: 'push',
                }),
            ]), 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Shield_Bash_usedRound', 1, 'test-campaign');
        });

        it('skips Shield Bash when no shield is equipped', async () => {
            const stats = {
                ...mockPlayerStats,
                inventory: { equipped: [] },
                equipment: [],
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'melee_hit_with_shield_equipped',
                            name: 'Shield Bash',
                            options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+5', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.anything(), 'test-campaign');
        });

        it('handles magic shield item name via parseMagicItemName', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            parseMagicItemName.mockImplementation((_name) => ({ baseName: 'Shield+1' }));
            const stats = {
                ...mockPlayerStats,
                inventory: { equipped: ['Shield+1'] },
                equipment: [{ name: 'Shield+1', equipment_category: 'Shield' }],
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'melee_hit_with_shield_equipped',
                            name: 'Shield Bash',
                            options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+5', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            // parseMagicItemName parses 'Shield+1' → { baseName: 'Shield+1' }, then equipment category check uses 'Shield+1'
            expect(mockRollDamage).toHaveBeenCalled();
        });
    });

    describe('Crusher feat', () => {
        it('applies Crusher push on bludgeoning hit', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'bludgeoning_damage_hit',
                            oncePerTurn: true, name: 'Crusher',
                            options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                        },
                        { type: 'conditional_advantage', trigger: 'critical_hit_bludgeoning', name: 'Crusher Enhanced Critical' },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Warhammer', damage: '1d8+5', damageType: 'Bludgeoning',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    source: 'Crusher',
                    effect: 'push',
                }),
            ]), 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Crusher_usedRound', 1, 'test-campaign');
        });

        it('does not apply Crusher push for non-bludgeoning damage', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'bludgeoning_damage_hit',
                            oncePerTurn: true, name: 'Crusher',
                            options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+5', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.anything(), 'test-campaign');
        });

        it('applies Crusher Enhanced Critical on bludgeoning crit', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        { type: 'conditional_advantage', trigger: 'critical_hit_bludgeoning', name: 'Crusher Enhanced Critical' },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({
                playerStats: stats,
                popupHtml: { isCrit: true },
            });
            const attack = {
                name: 'Warhammer', damage: '1d8+5', damageType: 'Bludgeoning',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'crusher_enhanced_critical',
                }),
            ]), 'test-campaign');
        });
    });

    describe('Slasher feat', () => {
        it('applies Slasher hamstring speed reduction on slashing hit', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'slashing_damage_hit',
                            oncePerTurn: true, name: 'Slasher',
                            options: [{ name: 'Reduce Speed', effect: 'speed_reduction', value: 10 }],
                        },
                        { type: 'conditional_advantage', trigger: 'critical_hit_slashing', name: 'Slasher Enhanced Critical' },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+5', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    source: 'Slasher',
                    effect: 'speed_reduction',
                    value: 10,
                }),
            ]), 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Slasher_usedRound', 1, 'test-campaign');
        });

        it('does not apply Slasher hamstring for non-slashing damage', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'slashing_damage_hit',
                            oncePerTurn: true, name: 'Slasher',
                            options: [{ name: 'Reduce Speed', effect: 'speed_reduction', value: 10 }],
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.anything(), 'test-campaign');
        });

        it('applies Slasher Enhanced Critical on slashing crit', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        { type: 'conditional_advantage', trigger: 'critical_hit_slashing', name: 'Slasher Enhanced Critical' },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({
                playerStats: stats,
                popupHtml: { isCrit: true },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+5', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    effect: 'disadvantage_next_attack',
                }),
            ]), 'test-campaign');
        });
    });

    describe('Piercer feat', () => {
        it('applies Piercer reroll on piercing hit', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'piercing_damage_hit',
                            oncePerTurn: true, name: 'Piercer',
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            // Piercer reroll appends [Piercer Reroll] to formula
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Piercer_usedRound', 1, 'test-campaign');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                expect.stringContaining('[Piercer Reroll]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('does not apply Piercer reroll for non-piercing damage', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'piercing_damage_hit',
                            oncePerTurn: true, name: 'Piercer',
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+5', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+5',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('applies Piercer extra damage die on crit', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        { type: 'damage_bonus', trigger: 'critical_hit_piercing', diceType: 'weapon_die', name: 'Piercer Critical' },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({
                playerStats: stats,
                popupHtml: { isCrit: true },
            });
            const attack = {
                name: 'Rapier', damage: '1d8+5', damageType: 'Piercing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            // Piercer crit adds one extra weapon die
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                expect.stringContaining('+ 1[Piercing]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });
    });

    describe('Savage Attacker', () => {
        it('rerolls damage when savage attacker passives exist', async () => {
            getRuntimeValue.mockReturnValue(null);
            Math.floor = vi.fn()
                .mockReturnValueOnce(8) // first die
                .mockReturnValueOnce(3) // first total = 8
                .mockReturnValueOnce(4) // second die, total = 4 < 8, keep original
                .mockReturnValueOnce(6) // irrelevant
                .mockReturnValueOnce(9);

            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        { type: 'passive_rule', effect: 'reroll_damage_once_per_turn', name: 'Savage Attacker' },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+5', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Savage_Attacker_usedRound', 1, 'test-campaign');
            expect(mockRollDamage).toHaveBeenCalled();
        });
    });

    describe('Tavern Brawler', () => {
        it('rerolls ones on unarmed strike damage dice', async () => {
            rollExpression.mockReturnValue({ total: 1, rolls: [1], modifier: 0 });
            Math.floor = vi.fn()
                .mockReturnValueOnce(5) // reroll the 1 → 5
                .mockReturnValueOnce(3); // for random elsewhere

            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [{ effect: 'tavern_brawler_reroll_ones' }],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Unarmed Strike', damage: '1d4', damageType: 'Bludgeoning',
                weaponType: 'unarmed', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Unarmed Strike',
                expect.stringContaining('[Tavern Brawler]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('applies Tavern Brawler push on unarmed strike hit', async () => {
            getRuntimeValue.mockReturnValue(null);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [{ effect: 'tavern_brawler_push' }],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Unarmed Strike', damage: '1d4', damageType: 'Bludgeoning',
                weaponType: 'unarmed', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('test-campaign', 'targetEffects', expect.arrayContaining([
                expect.objectContaining({
                    target: 'Goblin',
                    source: 'Tavern Brawler',
                    effect: 'push',
                    value: 5,
                }),
            ]), 'test-campaign');
        });
    });

    describe('Sacred Weapon', () => {
        it('updates attack damage type from sacred weapon buff', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [
                    { name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'radiant' },
                ];
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [{ name: 'Sacred Weapon', effect: 'sacred_weapon' }],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+5', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(attack.damageType).toBe('radiant');
            expect(mockRollDamage).toHaveBeenCalled();
        });
    });

    describe('Unarmed strike damage type modifiers', () => {
        it('applies stored damage type modifier for unarmed strike', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'empoweredStrikesDamageType') return 'Force';
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'damage_type_modifier', trigger: 'unarmed_strike_hit',
                            name: 'Empowered Strikes',
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Unarmed Strike', damage: '1d6+5', damageType: 'Bludgeoning',
                weaponType: 'unarmed', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(attack.damageType).toBe('Force');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'empoweredStrikesDamageType', null, 'test-campaign');
            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('shows damage type choice modal when modifier has options', async () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'damage_type_modifier', trigger: 'unarmed_strike_hit',
                            name: 'Empowered Strikes',
                            options: [{ damageType: 'Force' }, { damageType: 'Radiant' }],
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Unarmed Strike', damage: '1d6+5', damageType: 'Bludgeoning',
                weaponType: 'unarmed', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Empowered Strikes — Damage Type',
                types: ['Force', 'Radiant'],
            }));
            expect(mockRollDamage).not.toHaveBeenCalled();
        });

        it('applies stored unarmed attack rider option', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Enhanced_Unarmed_Strike_selectedOption') return 'Knock Prone';
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'unarmed_strike_hit',
                            chooseOne: true, name: 'Enhanced Unarmed Strike',
                            options: [
                                { name: 'Knock Prone', effect: 'damage_bonus', damageExpression: '1d4', damageType: 'bludgeoning' },
                                { name: 'Push', effect: 'push', value: 5 },
                            ],
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Unarmed Strike', damage: '1d6+5', damageType: 'Bludgeoning',
                weaponType: 'unarmed', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(rollExpression).toHaveBeenCalledWith('1d4');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Unarmed Strike',
                expect.stringContaining('1d4[bludgeoning]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('shows damage type choice modal when no stored unarmed attack rider option', async () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'unarmed_strike_hit',
                            chooseOne: true, name: 'Enhanced Unarmed Strike',
                            options: [
                                { name: 'Knock Prone', effect: 'damage_bonus', damageExpression: '1d4', damageType: 'bludgeoning' },
                                { name: 'Push', effect: 'push', value: 5 },
                            ],
                        },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Unarmed Strike', damage: '1d6+5', damageType: 'Bludgeoning',
                weaponType: 'unarmed', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Enhanced Unarmed Strike — Enhanced Unarmed Strike',
            }));
            expect(mockRollDamage).not.toHaveBeenCalled();
        });
    });
});
