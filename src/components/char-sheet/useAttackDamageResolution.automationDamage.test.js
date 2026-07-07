// @cleaned-by-ai
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
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
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

describe('useAttackDamageResolution - automation damage bonuses', () => {
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

    describe('monk weapon / unarmed strike damage bonus', () => {
        it.each`
            elemOption       | expectedType
            ${null}          | ${'fire'}
            ${'Cold'}        | ${'cold'}
        `('applies monk weapon damage bonus with $expectedType damage type$elemOption (via Elemental Attunement: $elemOption)', async ({ elemOption, expectedType }) => {
            if (elemOption) {
                getRuntimeValue.mockImplementation((name, key) => {
                    if (key === '_Elemental_Attunement_option') return elemOption;
                    return null;
                });
            }
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'monk_weapon_or_unarmed_hit', damageExpression: '1d6', damageType: 'fire' },
                    ],
                    passives: [],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Unarmed Strike', damage: '1d6', damageType: 'bludgeoning',
                weaponType: 'unarmed', properties: [],
            };
            await resolveAttackDamage(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Unarmed Strike',
                expect.stringContaining(`1d6 [${expectedType}]`),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });
    });

    describe('Great Weapon Master heavy weapon hit', () => {
        it.each`
            bonusDamageType  | expectedType
            ${'Force'}       | ${'Force'}
            ${'same_as_weapon'} | ${'Slashing'}
        `('applies GWM damage bonus with $expectedType damage type ($bonusDamageType config)', async ({ bonusDamageType, expectedType }) => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d4', damageType: bonusDamageType },
                    ],
                    passives: [],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'],
            };
            await resolveAttackDamage(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Greataxe',
                expect.stringContaining(`1d4 [${expectedType}]`),
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
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'], abilityName: 'Strength',
            };
            await resolveAttackDamage(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Greataxe',
                expect.stringContaining('2 [necrotic]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('skips Frenzy damage when already used this round', async () => {
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
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'], abilityName: 'Strength',
            };
            await resolveAttackDamage(attack);
            await tick();
            expect(mockRollDamage).not.toHaveBeenCalledWith(
                'Greataxe',
                expect.stringContaining('2 [necrotic]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

    });
});
