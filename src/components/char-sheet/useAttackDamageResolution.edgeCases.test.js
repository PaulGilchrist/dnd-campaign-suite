// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

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
import { getCurrentCombatRound, loadCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';

const defaultRollResult = { total: 5, rolls: [5], modifier: 0 };

const mockPlayerStats = {
    name: 'TestFighter',
    level: 5,
    abilities: [
        { name: 'Strength', bonus: 3 },
        { name: 'Dexterity', bonus: 2 },
    ],
    proficiency: 3,
    class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
    automation: { actions: [], passives: [] },
};

const mockCampaignName = 'test-campaign';

const mockSetPopupHtml = vi.fn();
const mockRollDamage = vi.fn();
const mockBuildCtx = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
const mockBuildCtxSync = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
const mockSetDamageTypeChoice = vi.fn();
const mockSetDivineFuryChoice = vi.fn();
const mockSetWeaponMasteryModal = vi.fn();
const mockSetAttackRiderModal = vi.fn();
const mockPendingDamageRef = { current: null };

function UseAttackDamageResolution(overrides = {}) {
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
        return useAttackDamageResolution(deps);
}

function tick() {
    return new Promise((r) => setTimeout(r, 0));
}

describe('useAttackDamageResolution - edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue(defaultRollResult);
        rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 6 });
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
        getCombatContext.mockResolvedValue(null);
        getCurrentCombatRound.mockReturnValue(1);
        mockBuildCtx.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockBuildCtxSync.mockReturnValue(Promise.resolve({ targetName: 'Goblin' }));
        mockPendingDamageRef.current = null;
    });

    // ── proceedWithDamage behavior ──────────────────────────────────────

    describe('proceedWithDamage behavior', () => {
        it('calls rollDamage when buildCtxSync resolves normally', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
        });

        it('calls buildCtx when mapName is truthy', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({ mapName: 'test-map' });
            const attack = { name: 'Fire Bolt', damage: '1d10', damageType: 'fire', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockBuildCtx).toHaveBeenCalledWith(attack);
            expect(mockBuildCtxSync).not.toHaveBeenCalled();
        });

        it('calls buildCtxSync when mapName is null', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution({ mapName: null });
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockBuildCtxSync).toHaveBeenCalledWith(attack);
            expect(mockBuildCtx).not.toHaveBeenCalled();
        });
    });

    // ── Enhanced Unarmed Strike push option ─────────────────────────────

    describe('Enhanced Unarmed Strike push option', () => {
        it('shows modal when stored option is non-damage_bonus effect', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Enhanced_Unarmed_Strike_selectedOption') return 'Push';
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
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Unarmed Strike', damage: '1d6+5', damageType: 'Bludgeoning', weaponType: 'unarmed', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            // Push option doesn't have damage_bonus, so falls through to modal
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Enhanced Unarmed Strike — Enhanced Unarmed Strike',
                }),
            );
        });
    });

    // ── Piercer reroll edge cases ───────────────────────────────────────

    describe('Piercer reroll edge cases', () => {
        it('applies Piercer reroll multiple times when rerollCount > 1', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            rollExpression.mockReturnValue({ total: 5, rolls: [1, 1, 3], modifier: 0 });
            const floorSpy = vi.spyOn(Math, 'floor')
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(6);

            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'piercing_damage_hit',
                            oncePerTurn: true, name: 'Piercer', rerollCount: 2,
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Rapier', damage: '3d4+5', damageType: 'Piercing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Piercer_usedRound', 1, 'test-campaign');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                expect.stringContaining('[Piercer Reroll]'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
            floorSpy.mockRestore();
        });

        it('does not apply Piercer when rolls array is empty', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            rollExpression.mockReturnValue({ total: 0, rolls: [], modifier: 0 });

            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'piercing_damage_hit',
                            oncePerTurn: true, name: 'Piercer', rerollCount: 2,
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Rapier', damage: '3d4+5', damageType: 'Piercing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Rapier',
                '3d4+5',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Savage Attacker edge cases ──────────────────────────────────────

    describe('Savage Attacker edge cases', () => {
        it('does not reroll when numDice does not match rolls.length', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        { type: 'passive_rule', effect: 'reroll_damage_once_per_turn', name: 'Savage Attacker' },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Greataxe', damage: '1d12+5', damageType: 'Slashing', weaponType: 'melee', properties: ['Heavy'] };

            await resolveAttackDamage(attack);
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Savage_Attacker_usedRound', 1, 'test-campaign');
        });

        it('does not reroll when damage expression is missing', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        { type: 'passive_rule', effect: 'reroll_damage_once_per_turn', name: 'Savage Attacker' },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Longsword', damageType: 'Slashing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', '_Savage_Attacker_usedRound', expect.any(Number), 'test-campaign');
        });
    });

    // ── Tavern Brawler edge cases ───────────────────────────────────────

    describe('Tavern Brawler edge cases', () => {
        it('does not reroll ones when damage expression is missing', async () => {
            rollExpression.mockReturnValue({ total: 0, rolls: [], modifier: 0 });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [{ effect: 'tavern_brawler_reroll_ones' }],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Unarmed Strike', damageType: 'Bludgeoning', weaponType: 'unarmed', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Unarmed Strike',
                expect.not.stringContaining('[Tavern Brawler]'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Piercer Enhanced Critical edge cases ────────────────────────────

    describe('Piercer Enhanced Critical edge cases', () => {
        it('does not apply Piercer crit bonus when weaponDieType is not weapon_die', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        { type: 'damage_bonus', trigger: 'critical_hit_piercing', diceType: 'fixed', name: 'Piercer Critical' },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats, popupHtml: { isCrit: true } });
            const attack = { name: 'Rapier', damage: '1d8+5', damageType: 'Piercing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            const formula = mockRollDamage.mock.calls[0][1];
            expect(formula).not.toContain('+ 1 [Piercing]');
        });

        it('does not apply Piercer crit bonus when die match fails', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        { type: 'damage_bonus', trigger: 'critical_hit_piercing', diceType: 'weapon_die', name: 'Piercer Critical' },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats, popupHtml: { isCrit: true } });
            const attack = { name: 'Rapier', damage: '', damageType: 'Piercing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            const formula = mockRollDamage.mock.calls[0][1];
            expect(formula).not.toContain('+ 1 [Piercing]');
        });
    });

    // ── Cantrip Potent Spellcasting edge cases ──────────────────────────

    describe('Cantrip Potent Spellcasting edge cases', () => {
        it('clamps Wisdom modifier to minimum 0', async () => {
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
                    spells: [{ name: 'Fire Bolt', level: 0 }],
                },
                abilities: [
                    { name: 'Strength', bonus: 3 },
                    { name: 'Dexterity', bonus: 2 },
                    { name: 'Wisdom', bonus: -2 },
                ],
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Fire Bolt', damage: '1d10', damageType: 'Fire', weaponType: 'ranged', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Fire Bolt',
                '1d10',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Divine Fury edge cases ──────────────────────────────────────────

    describe('Divine Fury edge cases', () => {
        it('handles barbarian_level / 2 expression with odd level', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [{ damageBonusExpression: '2' }];
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                level: 5,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: 'barbarian_level / 2', damageType: 'radiant' },
                    ],
                    passives: [],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing', weaponType: 'melee', properties: ['Heavy'] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Greataxe',
                expect.stringContaining('2 [radiant]'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Natural 20 edge cases ───────────────────────────────────────────

    describe('Natural 20 edge cases', () => {
        it('uses attack.damageType when extraDamageType is same_as_attack and attack has damageType', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: '2d6', extraDamageType: 'same_as_attack', name: 'Overwhelming Strike' },
                    ],
                    passives: [],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats, popupHtml: { isNatural20: true } });
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'Slashing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('2d6 [Slashing]'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('uses empty string for extraDamageType when attack has no damageType and extraDamageType is same_as_attack', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: '2d6', extraDamageType: 'same_as_attack', name: 'Overwhelming Strike' },
                    ],
                    passives: [],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats, popupHtml: { isNatural20: true } });
            const attack = { name: 'Longsword', damage: '1d8+3', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('2d6 ['),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('does not apply extra damage when extraDamageExpr is empty string', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'natural_20_attack_roll', extraDamageExpression: '', extraDamageType: 'force', name: 'Overwhelming Strike' },
                    ],
                    passives: [],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats, popupHtml: { isNatural20: true } });
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'Slashing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Sacred Weapon edge cases ────────────────────────────────────────

    describe('Sacred Weapon edge cases', () => {
        it('does not change damage type when no sacred weapon buff in activeBuffs', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce([]);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [{ name: 'Sacred Weapon', effect: 'sacred_weapon' }],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Longsword', damage: '1d8+5', damageType: 'Slashing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(attack.damageType).toBe('Slashing');
        });

        it('does not change damage type when sacred weapon buff has no damageTypeChoice', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce([{ name: 'Sacred Weapon', effect: 'sacred_weapon' }]);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [{ name: 'Sacred Weapon', effect: 'sacred_weapon' }],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Longsword', damage: '1d8+5', damageType: 'Slashing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(attack.damageType).toBe('Slashing');
        });
    });

    // ── Empowered Strikes edge cases ────────────────────────────────────

    describe('Empowered Strikes edge cases', () => {
        it('clears stored damage type after applying it', async () => {
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
                            name: 'Empowered Strikes', oncePerTurn: true,
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Unarmed Strike', damage: '1d6+5', damageType: 'Bludgeoning', weaponType: 'unarmed', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'empoweredStrikesDamageType', null, 'test-campaign');
        });

        it('breaks after first successful damage type application', async () => {
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
                            name: 'Empowered Strikes', oncePerTurn: true,
                        },
                        {
                            type: 'damage_type_modifier', trigger: 'unarmed_strike_hit',
                            name: 'Another Modifier', oncePerTurn: true,
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Unarmed Strike', damage: '1d6+5', damageType: 'Bludgeoning', weaponType: 'unarmed', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(attack.damageType).toBe('Force');
        });
    });

    // ── Stalker's Flurry oncePerTurn without saved option ───────────────

    describe("Stalker's Flurry oncePerTurn without saved option", () => {
        it('shows modal but does not track usedRound when no option saved', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player' },
                    { name: 'Bugbear', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Bugbear' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'weapon_attack_hit',
                            name: "Stalker's Flurry", chooseOne: true, oncePerTurn: true,
                            options: [
                                { name: 'Sudden Strike', effect: 'sudden_strike' },
                                { name: 'Mass Fear', effect: 'mass_fear' },
                            ],
                        },
                    ],
                },
            };
            const { resolveAttackDamage: hdc } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Shortsword', damage: '1d6+3', damageType: 'Piercing', weaponType: 'melee', properties: [] };

            await hdc(attack);
            await tick();

            expect(mockSetAttackRiderModal).toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                "_Stalker's_Flurry_usedRound",
                expect.any(Number),
                'test-campaign',
            );
        });
    });

    // ── Crusher feat - no target ────────────────────────────────────────

    describe('Crusher feat when no target', () => {
        it('does not apply Crusher push when no target found', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestFighter', type: 'player' }],
            });
            getTargetFromAttacker.mockReturnValue(null);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'bludgeoning_damage_hit',
                            oncePerTurn: true, name: 'Crusher',
                            options: [{ name: 'Push', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Mace', damage: '1d6+5', damageType: 'Bludgeoning', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.anything(),
                'test-campaign',
            );
        });
    });

    // ── Slasher feat - no target ────────────────────────────────────────

    describe('Slasher feat when no target', () => {
        it('does not apply Slasher hamstring when no target found', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestFighter', type: 'player' }],
            });
            getTargetFromAttacker.mockReturnValue(null);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'slashing_damage_hit',
                            oncePerTurn: true, name: 'Slasher',
                            options: [{ name: 'Hamstring', effect: 'speed_reduction', value: 10 }],
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Longsword', damage: '1d8+5', damageType: 'Slashing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.anything(),
                'test-campaign',
            );
        });
    });

    // ── Charger feat - no target ────────────────────────────────────────

    describe('Charger feat when no target', () => {
        it('does not apply Charger when no target found', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestFighter', type: 'player' }],
            });
            getTargetFromAttacker.mockReturnValue(null);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'melee_hit_after_10ft_charge',
                            chooseOne: true, name: 'Charge Attack',
                            options: [{ name: 'Push', effect: 'push', value: 10 }],
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Longsword', damage: '1d8+5', damageType: 'Slashing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                '_Charge_Attack_usedRound',
                expect.any(Number),
                'test-campaign',
            );
        });
    });

    // ── Shield Master - no target ───────────────────────────────────────

    describe('Shield Master when no target', () => {
        it('does not apply Shield Bash when no target found', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestFighter', type: 'player' }],
            });
            getTargetFromAttacker.mockReturnValue(null);
            const stats = {
                ...mockPlayerStats,
                inventory: { equipped: ['Shield'] },
                equipment: [{ name: 'Shield', equipment_category: 'Shield' }],
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider', trigger: 'melee_hit_with_shield_equipped',
                            name: 'Shield Bash',
                            options: [{ name: 'Push', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Longsword', damage: '1d8+5', damageType: 'Slashing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                '_Shield_Bash_usedRound',
                expect.any(Number),
                'test-campaign',
            );
        });
    });

    // ── Tavern Brawler push - no combat context ─────────────────────────

    describe('Tavern Brawler push when no combat context', () => {
        it('still marks push as used even without combat context', async () => {
            getCombatContext.mockResolvedValue(null);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [{ effect: 'tavern_brawler_push' }],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Unarmed Strike', damage: '1d4', damageType: 'Bludgeoning', weaponType: 'unarmed', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Tavern_Brawler_Push_UsedRound', 1, 'test-campaign');
            expect(mockRollDamage).toHaveBeenCalled();
        });
    });

    // ── Eldritch Strike - no target ─────────────────────────────────────

    describe('Eldritch Strike when no target', () => {
        it('does not apply target effect when no target found', async () => {
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'TestFighter', type: 'player' }],
            });
            getTargetFromAttacker.mockReturnValue(null);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'attack_rider', trigger: 'weapon_attack_hit',
                            name: 'Eldritch Strike',
                            options: [{ name: 'Impose Disadvantage', effect: 'impose_disadvantage' }],
                        },
                    ],
                    passives: [],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = { name: 'Rapier', damage: '1d8+5', damageType: 'Piercing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.anything(),
                'test-campaign',
            );
        });
    });

    // ── Colossus Slayer - no combat context ─────────────────────────────

    describe('Colossus Slayer without combat context', () => {
        it('does not add extra damage when no combat context', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce("Colossus Slayer");
            getCombatContext.mockResolvedValue(null);
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(rollExpression).not.toHaveBeenCalledWith('1d8');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Superior Hunter's Prey - no combat summary ──────────────────────

    describe("Superior Hunter's Prey without combat summary", () => {
        it('does not spread damage when combat summary is null', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === "_Hunter's_Prey_choice") return 'Colossus Slayer';
                return null;
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'TestFighter', type: 'player', concentration: { spell: "Hunter's Mark" } },
                    { name: 'Goblin', type: 'npc' },
                    { name: 'Orc', type: 'npc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            loadCombatSummary.mockResolvedValue(null);
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', weaponType: 'melee', properties: [] };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
        });
    });

    // ── Two Weapon Fighting - no abilityName ────────────────────────────

    describe('Two Weapon Fighting edge cases', () => {
        it('does not append modifier when abilityName does not match any ability', async () => {
            hasTwoWeaponFighting.mockReturnValue(true);
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = {
                name: 'Handaxe',
                damage: '1d6',
                damageType: 'slashing',
                type: 'Bonus Action',
                properties: ['Light'],
                abilityName: 'Charisma',
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                'Handaxe',
                '1d6',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });
});
