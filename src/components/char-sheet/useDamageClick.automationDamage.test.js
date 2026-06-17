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

describe('useDamageClick - automation damage bonuses', () => {
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

    describe('melee weapon hit damage bonus', () => {
        const meleeAttack = {
            name: 'Longsword', damage: '1d8+3', damageType: 'slashing',
            weaponType: 'melee', properties: [],
        };

        it('applies melee_weapon_hit damage bonus to melee attacks', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d4', damageType: 'radiant' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            await handleDamageClick(meleeAttack);
            await tick();
            expect(rollExpression).toHaveBeenCalledWith('1d4');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('1d4[radiant]'),
                10, expect.any(Array), 0, expect.any(Object)
            );
        });

        it('applies melee_weapon_hit damage bonus to unarmed attacks', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d4', damageType: 'radiant' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const unarmedAttack = { ...meleeAttack, weaponType: 'unarmed', name: 'Unarmed Strike', damage: '1d4' };
            await handleDamageClick(unarmedAttack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Unarmed Strike',
                expect.stringContaining('1d4[radiant]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('does not apply melee_weapon_hit bonus to ranged attacks', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d4', damageType: 'radiant' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const rangedAttack = { ...meleeAttack, weaponType: 'ranged' };
            await handleDamageClick(rangedAttack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });
    });

    describe('monk weapon / unarmed strike damage bonus', () => {
        it('applies monk weapon damage bonus with default fire damage type', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6', damageType: 'fire' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Unarmed Strike', damage: '1d6', damageType: 'bludgeoning',
                weaponType: 'unarmed', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(rollExpression).toHaveBeenCalledWith('1d6');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Unarmed Strike',
                expect.stringContaining('1d6[fire]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('uses Elemental Attunement choice for damage type', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Elemental_Attunement_option') return 'Cold';
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6', damageType: 'fire' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Unarmed Strike', damage: '1d6', damageType: 'bludgeoning',
                weaponType: 'unarmed', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Unarmed Strike',
                expect.stringContaining('1d6[cold]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });
    });

    describe('Great Weapon Master heavy weapon hit', () => {
        it('applies GWM damage bonus to heavy melee weapons', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d4', damageType: 'Force' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Greataxe',
                expect.stringContaining('1d4[Force]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('does not apply GWM bonus to non-heavy weapons', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d4', damageType: 'Force' },
                    ],
                    passives: [],
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

        it('uses same_as_weapon damage type fallback to attack.damageType', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d4', damageType: 'same_as_weapon' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Greataxe',
                expect.stringContaining('1d4[Slashing]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });
    });

    describe('Frenzy damage bonus', () => {
        it('applies Frenzy damage when reckless, raging, strength-based', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [
                    { effect: 'advantage_attacks_disadvantage_against' },
                    { damageBonusExpression: '2' },
                ];
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'reckless_attack_hit_while_raging', damageExpression: 'rage_damage', damageType: 'necrotic' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'], abilityName: 'Strength',
            };
            await handleDamageClick(attack);
            await tick();
            expect(rollExpression).toHaveBeenCalledWith('2');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_frenzyUsedRound', 1, 'test-campaign');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Greataxe',
                expect.stringContaining('2[necrotic]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('skips Frenzy when already used this round', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_frenzyUsedRound') return 1;
                if (key === 'activeBuffs') return [
                    { effect: 'advantage_attacks_disadvantage_against' },
                    { damageBonusExpression: '2' },
                ];
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'reckless_attack_hit_while_raging', damageExpression: 'rage_damage', damageType: 'necrotic' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'], abilityName: 'Strength',
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', '_frenzyUsedRound', 1, 'test-campaign');
        });

        it('skips Frenzy when not strength-based', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [
                    { effect: 'advantage_attacks_disadvantage_against' },
                    { damageBonusExpression: '2' },
                ];
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'reckless_attack_hit_while_raging', damageExpression: 'rage_damage', damageType: 'necrotic' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Rapier', damage: '1d8+3', damageType: 'Piercing',
                weaponType: 'melee', properties: [], abilityName: 'Dexterity',
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', '_frenzyUsedRound', expect.any(Number), 'test-campaign');
        });
    });

    describe('Divine Fury damage bonus', () => {
        it('applies Divine Fury when raging and first hit this round', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [
                    { damageBonusExpression: '2' },
                ];
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: 'barbarian_level / 2', damageType: 'radiant' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'],
            };
            await handleDamageClick(attack);
            await tick();
            expect(rollExpression).toHaveBeenCalledWith('2');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_divineFuryUsedRound', 1, 'test-campaign');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Greataxe',
                expect.stringContaining('2[radiant]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('shows Divine Fury choice modal when damage type includes " or "', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [
                    { damageBonusExpression: '2' },
                ];
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'first_hit_while_raging', damageExpression: 'barbarian_level / 2', damageType: 'radiant or necrotic' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockSetDivineFuryChoice).toHaveBeenCalledWith('radiant or necrotic');
            expect(mockPendingDamageRef.current).toEqual(expect.objectContaining({
                attack, bonusExpr: '2',
            }));
            expect(mockRollDamage).not.toHaveBeenCalled();
        });
    });

    describe('Brutal Strike attack rider', () => {
        it('applies attack_rider for strength_attack_hit_after_reckless', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'attack_rider', trigger: 'strength_attack_hit_after_reckless', damageExpression: '2d6', damageType: 'Force' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'],
            };
            await handleDamageClick(attack);
            await tick();
            expect(rollExpression).toHaveBeenCalledWith('2d6');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Greataxe',
                expect.stringContaining('2d6[Force]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });
    });

    describe('weapon_attack_hit damage bonus', () => {
        it('applies weapon_attack_hit damage bonus (Divine Strike)', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d8', damageType: 'radiant', name: 'Divine Strike' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Mace', damage: '1d6+2', damageType: 'Bludgeoning',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(rollExpression).toHaveBeenCalledWith('1d8');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Mace',
                expect.stringContaining('1d8[radiant]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('applies weapon_or_beast_form_attack_hit trigger', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'weapon_or_beast_form_attack_hit', damageExpression: '1d6', damageType: 'force', name: 'Primal Strike' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Quarterstaff', damage: '1d6+3', damageType: 'Bludgeoning',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Quarterstaff',
                expect.stringContaining('1d6[force]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('respects oncePerTurn and skips if already used this round', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Divine_Strike_usedRound') return 1;
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d8', damageType: 'radiant', oncePerTurn: true, name: 'Divine Strike' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Mace', damage: '1d6+2', damageType: 'Bludgeoning',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Mace',
                '1d6+2',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('deduplicates features using upgrades field (keeps base, skips upgraded)', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d8', damageType: 'radiant', name: 'Divine Strike (Improved)' },
                        { type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d6', damageType: 'radiant', name: 'Divine Strike', upgrades: 'Divine Strike (Improved)' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Mace', damage: '1d6+2', damageType: 'Bludgeoning',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            // upgrades field filters out the named upgrade, keeping the base version
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Mace',
                expect.stringContaining('1d6[radiant]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('shows damage type choice modal when type includes " or "', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d8', damageType: 'radiant or necrotic', name: 'Divine Strike' },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Mace', damage: '1d6+2', damageType: 'Bludgeoning',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockSetDamageTypeChoice).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Divine Strike — Damage Type',
                types: expect.arrayContaining(['radiant', 'necrotic']),
            }));
            expect(mockRollDamage).not.toHaveBeenCalled();
        });

        it('filters out non-strike options when feature has options', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus', trigger: 'weapon_attack_hit',
                            damageExpression: '1d8', damageType: 'radiant',
                            name: 'Primal Strike', options: ['Strike', 'Other Effect'],
                        },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Mace', damage: '1d6+2', damageType: 'Bludgeoning',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Mace',
                expect.stringContaining('1d8[radiant]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('applies oncePerTurn tracking when feature executes successfully', async () => {
            getRuntimeValue.mockReturnValue(null);
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'weapon_attack_hit', damageExpression: '1d6', damageType: 'radiant', name: 'Divine Strike', oncePerTurn: true },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Mace', damage: '1d6+2', damageType: 'Bludgeoning',
                weaponType: 'melee', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Divine_Strike_usedRound', 1, 'test-campaign');
        });

        it('handles uses_expression based recharge', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Dread_Ambush_uses') return 1;
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus', trigger: 'weapon_attack_hit',
                            damageExpression: '1d8', damageType: 'piercing',
                            name: 'Dread Ambush', uses_expression: 'wis_mod', recharge: 'long_rest',
                            usesMax: 4,
                        },
                    ],
                    passives: [],
                },
            };
            const { handleDamageClick } = UseDamageClick({ playerStats: stats });
            const attack = {
                name: 'Longbow', damage: '1d8+3', damageType: 'Piercing',
                weaponType: 'ranged', properties: [],
            };
            await handleDamageClick(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longbow',
                expect.stringContaining('1d8[piercing]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', '_Dread_Ambush_uses', 0, 'test-campaign');
        });
    });

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
            expect(rollExpression).toHaveBeenCalledWith('2d6');
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
            expect(rollExpression).toHaveBeenCalledWith('3');
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('3[Slashing]'),
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
            expect(rollExpression).toHaveBeenCalledWith('2d8');
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
    });
});
