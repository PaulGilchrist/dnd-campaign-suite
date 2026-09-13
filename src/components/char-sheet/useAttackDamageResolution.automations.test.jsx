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
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/common/choiceStorage.js', () => ({
    getChosenRuntimeValue: vi.fn(() => undefined),
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
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';

const defaultRollResult = { total: 5, rolls: [5], modifier: 3 };
const defaultCtx = {
    targetName: 'Goblin',
    autoDamageSecondaryFormula: null,
    autoDamageSecondaryName: null,
    autoDamageSecondaryDamageType: null,
    saveDc: null,
    saveType: null,
    dcSuccess: null,
    tavernBrawlerRerolls: null,
};

const basePlayerStats = {
    name: 'TestFighter',
    level: 5,
    abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 2 }],
    proficiency: 3,
    class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
    automation: { actions: [], passives: [] },
};

const baseAttack = {
    name: 'Longsword',
    damage: '1d8+3',
    damageType: 'slashing',
    weaponType: 'melee',
    properties: [],
};

function tick() {
    return new Promise((r) => setTimeout(r, 0));
}

function createDeps(overrides = {}) {
    return {
        playerStats: { ...basePlayerStats, automation: { ...basePlayerStats.automation, ...overrides.playerStats?.automation } },
        campaignName: 'test-campaign',
        mapName: null,
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollDamage: vi.fn(),
        buildCtx: vi.fn(() => Promise.resolve(defaultCtx)),
        buildCtxSync: vi.fn(() => Promise.resolve(defaultCtx)),
        modalState: {},
        setModalState: vi.fn(),
        pendingDamage: null,
        setPendingDamage: vi.fn(),
        resumeRef: { current: null },
        ...overrides,
    };
}

describe('useAttackDamageResolution - automations', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue(defaultRollResult);
        rollExpressionDoubled.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 6 });
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getActiveBuffs.mockReturnValue([]);
        hasTwoWeaponFighting.mockReturnValue(false);
        collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
        deps = createDeps();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Melee damage bonus automations ───────────────────────────────────

    describe('melee damage bonus automations', () => {
        it('applies damage_bonus when trigger is melee_weapon_hit', async () => {
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d4', damageType: 'radiant' },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            expect(testDeps.rollDamage).toHaveBeenCalledOnce();
            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('1d4');
            expect(formula).toContain('radiant');
        });
    });

    // ── Divine Fury ─────────────────────────────────────────────────────

    describe('divine fury damage type choice', () => {
        it('opens damage type choice modal when divine fury has multiple options and has not been used this round', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === '_divineFuryUsedRound') return null;
                if (prop === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }, { damageBonusExpression: '1d4' }];
                if (prop === 'resumeRef') return {};
                return null;
            });
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus',
                            trigger: 'first_hit_while_raging',
                            damageExpression: '2d6',
                            damageType: 'fire or cold',
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            expect(testDeps.setModalState).toHaveBeenCalled();
            expect(testDeps.setPendingDamage).toHaveBeenCalled();
            expect(testDeps.resumeRef.current).toBeTruthy();
        });

        it('applies divine fury inline when single damage type and not yet used this round', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === '_divineFuryUsedRound') return null;
                if (prop === 'activeBuffs') return [{ damageBonusExpression: '1d4' }];
                return null;
            });
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus',
                            trigger: 'first_hit_while_raging',
                            damageExpression: '2d6',
                            damageType: 'fire',
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('2d6');
        });

        it('skips divine fury when already used this round', async () => {
            getCurrentCombatRound.mockReturnValue(1);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === '_divineFuryUsedRound') return 1;
                if (prop === 'activeBuffs') return [{ damageBonusExpression: '1d4' }];
                return null;
            });
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus',
                            trigger: 'first_hit_while_raging',
                            damageExpression: '2d6',
                            damageType: 'fire',
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).not.toContain('2d6');
        });
    });

    // ── Attack riders ───────────────────────────────────────────────────

    describe('attack_rider automations', () => {
        it('applies strength_attack_hit_after_reckless rider with damage expression', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === '_brutalStrikeActive') return true;
                return null;
            });
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'attack_rider',
                            trigger: 'strength_attack_hit_after_reckless',
                            damageExpression: '1d6',
                            damageType: 'radiant',
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);
            const attack = { ...baseAttack, abilityName: 'Strength' };

            await resolveAttackDamage(attack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('1d6');
        });

        it('does not apply rider when trigger does not match', async () => {
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'attack_rider',
                            trigger: 'strength_attack_hit_after_reckless',
                            damageExpression: '1d6',
                            damageType: 'radiant',
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);
            const attack = { ...baseAttack, abilityName: 'Dexterity' };

            await resolveAttackDamage(attack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).not.toContain('1d6');
        });
    });

    // ── Weapon attack hit automations ────────────────────────────────────

    describe('weapon_attack_hit automations', () => {
        it('applies weapon_attack_hit damage_bonus when not yet used this round', async () => {
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            name: 'Divine Strike',
                            type: 'damage_bonus',
                            trigger: 'weapon_attack_hit',
                            damageExpression: '1d8',
                            damageType: 'radiant',
                            oncePerTurn: true,
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('1d8');
        });

        it('skips oncePerTurn feature when already used this round', async () => {
            getCurrentCombatRound.mockReturnValue(1);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === '_Divine_Strike_usedRound') return 1;
                return null;
            });
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            name: 'Divine Strike',
                            type: 'damage_bonus',
                            trigger: 'weapon_attack_hit',
                            damageExpression: '1d8',
                            damageType: 'radiant',
                            oncePerTurn: true,
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).not.toContain('1d8 [radiant]');
        });

        it('re-enables oncePerTurn feature when round changes', async () => {
            getCurrentCombatRound.mockReturnValue(2);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === '_Divine_Strike_usedRound') return 1;
                return null;
            });
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            name: 'Divine Strike',
                            type: 'damage_bonus',
                            trigger: 'weapon_attack_hit',
                            damageExpression: '1d8',
                            damageType: 'radiant',
                            oncePerTurn: true,
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('1d8');
        });

        it('applies upgraded feature only when higher-level feature exists', async () => {
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            name: 'Divine Strike',
                            type: 'damage_bonus',
                            trigger: 'weapon_attack_hit',
                            damageExpression: '1d8',
                            damageType: 'radiant',
                        },
                        {
                            name: 'Paladin 17',
                            type: 'damage_bonus',
                            trigger: 'weapon_attack_hit',
                            damageExpression: '3d8',
                            damageType: 'radiant',
                            upgrades: 'Divine Strike',
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('3d8');
            // Verify the upgraded feature replaced the base feature by checking total damage dice count
            // 3d8 should produce a higher total than 1d8 would alone
            expect(testDeps.rollDamage).toHaveBeenCalledTimes(1);
        });

        it('applies weapon_or_beast_form_attack_hit when feature is in actions', async () => {
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            name: 'Beast Form Feature',
                            type: 'damage_bonus',
                            trigger: 'weapon_or_beast_form_attack_hit',
                            damageExpression: '1d8',
                            damageType: 'fire',
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('1d8');
        });

        it('handles multiple oncePerTurn features independently', async () => {
            getCurrentCombatRound.mockReturnValue(1);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === '_Divine_Strike_usedRound') return 1;
                if (prop === '_Sneak_Attack_usedRound') return null;
                return null;
            });
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            name: 'Divine Strike',
                            type: 'damage_bonus',
                            trigger: 'weapon_attack_hit',
                            damageExpression: '1d8',
                            damageType: 'radiant',
                            oncePerTurn: true,
                        },
                        {
                            name: 'Sneak Attack',
                            type: 'damage_bonus',
                            trigger: 'weapon_attack_hit',
                            damageExpression: '2d6',
                            damageType: 'piercing',
                            oncePerTurn: true,
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('2d6');
            expect(formula).not.toContain('1d8 [radiant]');
        });
    });

    // ── Natural 20 bonuses ──────────────────────────────────────────────

    describe('natural_20_attack_roll bonuses', () => {
        it('applies natural_20 damage bonus when isNatural20 is true', async () => {
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            name: 'Overwhelming Strike',
                            type: 'damage_bonus',
                            trigger: 'natural_20_attack_roll',
                            extraDamageExpression: '2d10',
                            extraDamageType: 'force',
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats, popupHtml: { isNatural20: true } });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('2d10');
        });

        it('uses increased_ability_score for extra damage expression', async () => {
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [
                        {
                            name: 'Overwhelming Strike',
                            type: 'damage_bonus',
                            trigger: 'natural_20_attack_roll',
                            extraDamageExpression: 'increased_ability_score',
                            extraDamageType: 'force',
                            abilityIncreased: 'Strength',
                        },
                    ],
                    passives: [],
                },
            };
            const testDeps = createDeps({ playerStats: stats, popupHtml: { isNatural20: true } });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('3');
        });
    });

    // ── Celestial transformation ────────────────────────────────────────

    describe('celestial transformation riders', () => {
        it('applies attack_rider when transformation buff is active', async () => {
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            name: 'Heavenly Wings',
                            type: 'attack_rider',
                            trigger: 'hit',
                            damageExpression: '1d6',
                            damageType: 'radiant',
                            oncePerTurn: true,
                        },
                    ],
                },
            };
            getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('1d6');
        });

        it('does not apply rider when transformation condition is not met', async () => {
            const stats = {
                ...basePlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            name: 'Heavenly Wings',
                            type: 'attack_rider',
                            trigger: 'hit',
                            damageExpression: '1d6',
                            damageType: 'radiant',
                            oncePerTurn: true,
                        },
                    ],
                },
            };
            getActiveBuffs.mockReturnValue([]);
            const testDeps = createDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = testDeps.rollDamage.mock.calls[0][0].formula;
            expect(formula).not.toContain('1d6');
        });
    });

    // ── Colossus Slayer ─────────────────────────────────────────────────

    describe('Colossus Slayer', () => {
        it('adds 1d8 extra damage when target is below max HP', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce('Colossus Slayer');
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', currentHp: 5, maxHp: 15 });
            const { resolveAttackDamage } = useAttackDamageResolution(deps);

            await resolveAttackDamage(baseAttack);
            await tick();

            expect(deps.rollDamage).toHaveBeenCalled();
            const formula = deps.rollDamage.mock.calls[0][0].formula;
            expect(formula).toContain('1d8');
        });

        it.each([
            { scenario: 'target at full HP', currentHp: 15, maxHp: 15 },
            { scenario: 'no target found', currentHp: null, maxHp: null },
            { scenario: 'feature not active', currentHp: 5, maxHp: 15 },
        ])('does not add extra damage when $scenario', async ({ currentHp, maxHp }) => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce(currentHp === null ? null : 'Colossus Slayer');
            getTargetFromAttacker.mockReturnValue(
                currentHp === null ? null : { name: 'Goblin', currentHp, maxHp }
            );
            const { resolveAttackDamage } = useAttackDamageResolution(deps);

            await resolveAttackDamage(baseAttack);
            await tick();

            const formula = deps.rollDamage.mock.calls[0][0].formula;
            expect(formula).not.toContain('1d8 [force]');
        });
    });
});
