// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, evaluateAutoExpression, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';

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

const modalState = {};
const mockSetModalState = vi.fn((updates) => {
    if (typeof updates === 'function') {
        return updates(modalState);
    }
    Object.assign(modalState, updates);
});

const mockPendingDamageRef = { current: null };
const mockSetPendingDamage = vi.fn();
const mockRollDamage = vi.fn();
const mockBuildCtx = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
const mockBuildCtxSync = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));

function UseAttackDamageResolution(overrides = {}) {
    const deps = {
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        mapName: null,
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollDamage: mockRollDamage,
        buildCtx: mockBuildCtx,
        buildCtxSync: mockBuildCtxSync,
        modalState,
        setModalState: mockSetModalState,
        pendingDamage: mockPendingDamageRef.current,
        setPendingDamage: mockSetPendingDamage,
        resumeRef: mockPendingDamageRef,
        ...overrides,
    };
    return useAttackDamageResolution(deps);
}

function tick() {
    return new Promise((r) => setTimeout(r, 0));
}

function resetModalState() {
    Object.keys(modalState).forEach((k) => delete modalState[k]);
    mockSetModalState.mockClear();
}

describe('useAttackDamageResolution - automation damage bonuses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
        evaluateAutoExpression.mockReturnValue(5);
        resetModalState();
        mockPendingDamageRef.current = null;
    });

    afterEach(() => {
        resetModalState();
    });

    describe('monk weapon / unarmed strike damage bonus', () => {
        it('applies monk weapon damage bonus with fire type by default', async () => {
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

            expect(mockSetModalState).not.toHaveBeenCalledWith(
                expect.objectContaining({ damageTypeChoice: expect.anything() })
            );
            expect(mockRollDamage).toHaveBeenCalledWith(
                { name: 'Unarmed Strike', formula: expect.stringContaining('1d6 [fire]'), total: expect.any(Number), rolls: expect.any(Array), modifier: expect.any(Number), context: expect.any(Object) },
            );
        });

        it('applies monk weapon damage bonus with elemental attunement type when set', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
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
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Unarmed Strike', damage: '1d6', damageType: 'bludgeoning',
                weaponType: 'unarmed', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                { name: 'Unarmed Strike', formula: expect.stringContaining('1d6 [cold]'), total: expect.any(Number), rolls: expect.any(Array), modifier: expect.any(Number), context: expect.any(Object) },
            );
        });

        it('does not apply monk weapon bonus when no matching automation action exists', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = {
                name: 'Unarmed Strike', damage: '1d6', damageType: 'bludgeoning',
                weaponType: 'unarmed', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            const formula = mockRollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('1d6');
            expect(formula).not.toContain('[fire]');
        });
    });

    describe('Great Weapon Master heavy weapon hit', () => {
        it('applies GWM damage bonus with explicit force type', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d4', damageType: 'Force' },
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
                { name: 'Greataxe', formula: expect.stringContaining('1d4 [force]'), total: expect.any(Number), rolls: expect.any(Array), modifier: expect.any(Number), context: expect.any(Object) },
            );
        });

        it('applies GWM damage bonus with weapon damage type when bonusDamageType is same_as_weapon', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d4', damageType: 'same_as_weapon' },
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
                { name: 'Greataxe', formula: expect.stringContaining('1d4 [slashing]'), total: expect.any(Number), rolls: expect.any(Array), modifier: expect.any(Number), context: expect.any(Object) },
            );
        });

        it('does not apply GWM bonus when weapon is not heavy', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_heavy_weapon_hit', damageExpression: '1d4', damageType: 'Force' },
                    ],
                    passives: [],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            const formula = mockRollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('1d8+3');
            expect(formula).not.toContain('1d4 [force]');
        });
    });

    describe('Frenzy damage bonus', () => {
        function makeFrenzyStats(overrides = {}) {
            return {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'reckless_attack_hit_while_raging', damageExpression: 'rage_damage', damageType: 'necrotic' },
                    ],
                    passives: [],
                },
                ...overrides,
            };
        }

        it('applies Frenzy damage when reckless, raging, and strength-based', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'activeBuffs') return [
                    { effect: 'advantage_attacks_advantage_against' },
                    { damageBonusExpression: '2' },
                ];
                return null;
            });
            const stats = makeFrenzyStats();
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'], abilityName: 'Strength',
            };

            await resolveAttackDamage(attack, { hit: true });
            await tick();

            expect(mockRollDamage).toHaveBeenCalledWith(
                { name: 'Greataxe', formula: expect.stringContaining('2 [necrotic]'), total: expect.any(Number), rolls: expect.any(Array), modifier: expect.any(Number), context: expect.any(Object) },
            );
        });

        it.each([
            { scenario: 'skips when already used this round', _frenzyUsedRound: 1, expectDamage: false },
            { scenario: 're-enables when round changes', _frenzyUsedRound: 1, expectDamage: true, round: 2 },
            { scenario: 'skips when rage buff is missing', _frenzyUsedRound: null, expectDamage: false, buffs: [] },
        ])('Frenzy: $scenario', async ({ _frenzyUsedRound, expectDamage, round, buffs }) => {
            if (round) getCurrentCombatRound.mockReturnValue(round);
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === '_frenzyUsedRound') return _frenzyUsedRound;
                if (key === 'activeBuffs') return buffs ?? [
                    { effect: 'advantage_attacks_advantage_against' },
                    { damageBonusExpression: '2' },
                ];
                return null;
            });
            const stats = makeFrenzyStats();
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Greataxe', damage: '1d12+3', damageType: 'Slashing',
                weaponType: 'melee', properties: ['Heavy'], abilityName: 'Strength',
            };

            await resolveAttackDamage(attack, { hit: true });
            await tick();

            const rollDamageCalls = mockRollDamage.mock.calls.map(c => c[0]);
            const formula = rollDamageCalls.length > 0 ? rollDamageCalls[0].formula : '';
            if (expectDamage) {
                expect(formula).toContain('2 [necrotic]');
            } else {
                expect(formula).not.toContain('2 [necrotic]');
            }
        });
    });

    describe('empty automation', () => {
        it('does not crash when automation actions array is empty or missing', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: { actions: [], passives: [] },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Longsword', damage: '1d8+3', damageType: 'Slashing',
                weaponType: 'melee', properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();

            setRuntimeValue.mockClear();
            const statsNoAutomation = {
                ...mockPlayerStats,
                automation: undefined,
            };
            const { resolveAttackDamage: resolveAttackDamage2 } = UseAttackDamageResolution({ playerStats: statsNoAutomation });

            await resolveAttackDamage2(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalledTimes(2);
        });
    });
});
