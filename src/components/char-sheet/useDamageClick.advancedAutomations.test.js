// @improved-by-ai
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
    evaluateAutoExpression: vi.fn(() => 5),
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
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, evaluateAutoExpression, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';

const mockPlayerStats = {
    name: 'TestFighter',
    level: 5,
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
        { name: 'Wisdom', bonus: 4 },
    ],
    proficiency: 3,
    class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
    automation: { actions: [], passives: [] },
};

const mockCampaignName = 'test-campaign';
const defaultRollResult = { total: 5, rolls: [5], modifier: 0 };

describe('useDamageClick - advanced automations', () => {
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
        evaluateAutoExpression.mockReturnValue(5);
        getCombatContext.mockResolvedValue(null);
        getCurrentCombatRound.mockReturnValue(1);
        mockBuildCtx.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockBuildCtxSync.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockPendingDamageRef.current = null;
    });

    async function tick() {
        await new Promise(r => setTimeout(r, 0));
    }

    describe('natural 20 damage bonus', () => {
        it('applies natural_20_attack_roll damage bonus', async () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: '2d6', extraDamageType: 'force', name: 'Overwhelming Strike' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({
                playerStats: stats,
                popupHtml: { isCrit: true, isNatural20: true },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Overwhelming_Strike_usedRound', 1, 'test-campaign');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('2d6[force]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('does not apply natural 20 bonus if already used this round', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Overwhelming_Strike_usedRound') return 1;
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: '2d6', extraDamageType: 'force', name: 'Overwhelming Strike' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({
                playerStats: stats,
                popupHtml: { isCrit: true, isNatural20: true },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('uses increased_ability_score for extraDamageExpr', async () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus', trigger: 'natural_20_attack_roll',
                            extraDamageExpression: 'increased_ability_score',
                            extraDamageType: 'same_as_attack',
                            abilityIncreased: 'Strength',
                            name: 'Overwhelming Strike',
                        },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({
                playerStats: stats,
                popupHtml: { isCrit: true, isNatural20: true },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('3[Slashing]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('does not apply natural 20 bonus when isNatural20 is false', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: '2d6', extraDamageType: 'force', name: 'Overwhelming Strike' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({
                playerStats: stats,
                popupHtml: { isCrit: true, isNatural20: false },
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('does not apply natural 20 bonus when popupHtml is null', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: '2d6', extraDamageType: 'force', name: 'Overwhelming Strike' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({
                playerStats: stats,
                popupHtml: null,
            });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });
    });

    describe('Celestial Revelation', () => {
        it('applies Celestial Revelation extra damage from active transformation', async () => {
            getRuntimeValue.mockReturnValue(null);
            getActiveBuffs.mockReturnValue([
                { name: 'Necrotic Shroud' },
            ]);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        { type: 'attack_rider', damageExpression: '2d8', trigger: 'hit', name: 'Necrotic Shroud', oncePerTurn: true },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Necrotic_Shroud_usedRound', 1, 'test-campaign');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('2d8['),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('skips Celestial Revelation if used this round and oncePerTurn', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Necrotic_Shroud_usedRound') return 1;
                return null;
            });
            getActiveBuffs.mockReturnValue([
                { name: 'Necrotic Shroud' },
            ]);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        { type: 'attack_rider', damageExpression: '2d8', trigger: 'hit', name: 'Necrotic Shroud', oncePerTurn: true },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('skips Celestial Revelation when no active transformation buff', async () => {
            getActiveBuffs.mockReturnValue([]);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        { type: 'attack_rider', damageExpression: '2d8', trigger: 'hit', name: 'Necrotic Shroud', oncePerTurn: true },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('applies Celestial Revelation for Heavenly Wings transformation', async () => {
            getRuntimeValue.mockReturnValue(null);
            getActiveBuffs.mockReturnValue([
                { name: 'Heavenly Wings' },
            ]);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        { type: 'attack_rider', damageExpression: '2d8', trigger: 'hit', name: 'Heavenly Wings', oncePerTurn: true },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Heavenly_Wings_usedRound', 1, 'test-campaign');
        });
    });

    describe('cantrip damage bonus (Potent Spellcasting)', () => {
        it('adds Wisdom modifier to cantrip damage', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus', trigger: 'weapon_attack_hit',
                            options: ['Potent Spellcasting (Cantrip)'],
                            name: 'Potent Spellcasting',
                        },
                    ],
                    passives: [],
                },
                spellAbilities: {
                    spells: [
                        { name: 'Fire Bolt', level: 0 },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Fire Bolt', damage: '1d10', damageType: 'Fire',
                weaponType: 'ranged', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Fire Bolt',
                expect.stringContaining('4[Cantrip]'),
                9, expect.any(Array), 0, expect.any(Object)
            );
        });

        it('does not apply Potent Spellcasting to non-cantrips', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus', trigger: 'weapon_attack_hit',
                            options: ['Potent Spellcasting (Cantrip)'],
                            name: 'Potent Spellcasting',
                        },
                    ],
                    passives: [],
                },
                spellAbilities: {
                    spells: [
                        { name: 'Fire Bolt', level: 1 },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Fire Bolt', damage: '2d10', damageType: 'Fire',
                weaponType: 'ranged', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Fire Bolt',
                '2d10',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('does not apply Potent Spellcasting when Wisdom modifier is 0', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus', trigger: 'weapon_attack_hit',
                            options: ['Potent Spellcasting (Cantrip)'],
                            name: 'Potent Spellcasting',
                        },
                    ],
                    passives: [],
                },
                spellAbilities: {
                    spells: [
                        { name: 'Fire Bolt', level: 0 },
                    ],
                },
                abilities: [
                    { name: 'Strength', bonus: 3 },
                    { name: 'Dexterity', bonus: 2 },
                    { name: 'Wisdom', bonus: 0 },
                ],
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Fire Bolt', damage: '1d10', damageType: 'Fire',
                weaponType: 'ranged', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Fire Bolt',
                '1d10',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('grants temp HP when bonus.tempHpExpression is set', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus', trigger: 'weapon_attack_hit',
                            options: ['Potent Spellcasting (Cantrip)'],
                            name: 'Potent Spellcasting',
                            tempHpExpression: '5',
                        },
                    ],
                    passives: [],
                },
                spellAbilities: {
                    spells: [
                        { name: 'Fire Bolt', level: 0 },
                    ],
                },
            };
            evaluateAutoExpression.mockReturnValue(5);
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Fire Bolt', damage: '1d10', damageType: 'Fire',
                weaponType: 'ranged', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'tempHp', 5, 'test-campaign');
        });

        it('does not grant temp HP when evaluateAutoExpression returns NaN', async () => {
            evaluateAutoExpression.mockReturnValue(NaN);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus', trigger: 'weapon_attack_hit',
                            options: ['Potent Spellcasting (Cantrip)'],
                            name: 'Potent Spellcasting',
                            tempHpExpression: 'invalid',
                        },
                    ],
                    passives: [],
                },
                spellAbilities: {
                    spells: [
                        { name: 'Fire Bolt', level: 0 },
                    ],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Fire Bolt', damage: '1d10', damageType: 'Fire',
                weaponType: 'ranged', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'tempHp', expect.any(Number), 'test-campaign');
        });
    });
});
