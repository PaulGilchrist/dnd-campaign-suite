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

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getAbilityLongName: vi.fn(),
        getName: vi.fn((name) => name),
        guid: vi.fn(() => 'test-prompt-id-12345'),
    },
    DEBUG_FORCE_CRIT: false,
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../services/automation/common/buffToggle.js';
import { collectWeaponMastery, hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';
import { parseMagicItemName } from '../../services/rules/core/attackCalc.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';

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
const mockRollDamage = vi.fn();

const modalState = {};
const mockSetModalState = vi.fn((updates) => {
    if (typeof updates === 'function') {
        return updates(modalState);
    }
    Object.assign(modalState, updates);
});

function resetModalState() {
    Object.keys(modalState).forEach((key) => delete modalState[key]);
}

function makeAttack(overrides = {}) {
    return {
        name: 'Longsword',
        damage: '1d8+5',
        damageType: 'Slashing',
        weaponType: 'melee',
        properties: [],
        ...overrides,
    };
}

function createCombatContext(playerName = 'TestFighter', targetName = 'Goblin') {
    return {
        creatures: [
            { name: playerName, type: 'player' },
            { name: targetName, type: 'npc' },
        ],
    };
}

function UseAttackDamageResolution(overrides = {}) {
    const deps = {
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        mapName: null,
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollDamage: mockRollDamage,
        buildCtx: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        buildCtxSync: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        modalState,
        setModalState: mockSetModalState,
        pendingDamageRef: { current: null },
        ...overrides,
    };
    return useAttackDamageResolution(deps);
}

function tick() {
    return new Promise((r) => setTimeout(r, 0));
}

describe('useAttackDamageResolution - feats', () => {
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
        resetModalState();
    });

    afterEach(() => {
        resetModalState();
    });

    describe('Charger feat', () => {
        it('does not apply charge effect targetEffects during pipeline execution', async () => {
            getCombatContext.mockResolvedValue(createCombatContext());
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider',
                            trigger: 'melee_hit_after_10ft_charge',
                            chooseOne: true,
                            name: 'Charge Attack',
                            options: [{ name: 'Push 10 ft', effect: 'push', value: 10 }],
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = makeAttack();

            await resolveAttackDamage(attack);
            await tick();

            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            for (const call of targetEffectCalls) {
                const effects = call[2];
                expect(effects).not.toContainEqual(
                    expect.objectContaining({
                        source: 'Charge Attack',
                        effect: 'push',
                    })
                );
            }
            expect(mockRollDamage).toHaveBeenCalled();
        });
    });

    describe('Shield Master (2024 ruleset)', () => {
        it('shows shield bash modal on failed STR save with shield equipped', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'lastAttack') {
                    return {
                        hit: true,
                        attackerName: 'TestFighter',
                        weaponType: 'melee',
                        targetName: 'Goblin',
                    };
                }
                return null;
            });

            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider',
                            trigger: 'melee_hit_with_shield_equipped',
                            name: 'Shield Bash',
                            options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = makeAttack();

            const resolvePromise = resolveAttackDamage(attack);
            await new Promise((r) => setTimeout(r, 10));

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: {
                    promptId: 'test-prompt-id-12345',
                    targetName: 'Goblin',
                    success: false,
                    roll: 5,
                    total: 8,
                    saveBonus: 3,
                },
            }));

            await resolvePromise;
            await tick();

            expect(sendSavePrompt).toHaveBeenCalled();
            expect(modalState.shieldBashModal).toBeDefined();
        });

        it('skips Shield Bash when lastAttack attacker is not the player', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'lastAttack') {
                    return {
                        hit: true,
                        attackerName: 'Goblin',
                        weaponType: 'melee',
                        targetName: 'TestFighter',
                    };
                }
                return null;
            });

            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [
                        {
                            type: 'attack_rider',
                            trigger: 'melee_hit_with_shield_equipped',
                            name: 'Shield Bash',
                            options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = makeAttack();

            await resolveAttackDamage(attack);
            await tick();

            expect(modalState.shieldBashModal).toBeUndefined();
        });

        it('skips Shield Bash when lastAttack weaponType is not melee', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'lastAttack') {
                    return {
                        hit: true,
                        attackerName: 'TestFighter',
                        weaponType: 'ranged',
                        targetName: 'Goblin',
                    };
                }
                return null;
            });

            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [
                        {
                            type: 'attack_rider',
                            trigger: 'melee_hit_with_shield_equipped',
                            name: 'Shield Bash',
                            options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = makeAttack();

            await resolveAttackDamage(attack);
            await tick();

            expect(modalState.shieldBashModal).toBeUndefined();
        });

        it('skips Shield Bash when no shield is equipped', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'lastAttack') {
                    return {
                        hit: true,
                        attackerName: 'TestFighter',
                        weaponType: 'melee',
                        targetName: 'Goblin',
                    };
                }
                return null;
            });

            const stats = {
                ...mockPlayerStats,
                inventory: { equipped: [] },
                equipment: [],
                automation: {
                    passives: [
                        {
                            type: 'attack_rider',
                            trigger: 'melee_hit_with_shield_equipped',
                            name: 'Shield Bash',
                            options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = makeAttack();

            await resolveAttackDamage(attack);
            await tick();

            expect(modalState.shieldBashModal).toBeUndefined();
        });

        it('handles 2024 Shield Master with push_or_prone effect and save parameters', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'lastAttack') {
                    return {
                        hit: true,
                        attackerName: 'TestFighter',
                        weaponType: 'melee',
                        targetName: 'Goblin',
                    };
                }
                return null;
            });

            const stats = {
                ...mockPlayerStats,
                automation: {
                    passives: [
                        {
                            type: 'attack_rider',
                            effect: 'push_or_prone',
                            oncePerTurn: true,
                            name: 'Shield Bash',
                            automation: {
                                saveType: 'STR',
                                saveDc: 'ability',
                                saveAbility: 'STR',
                            },
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = makeAttack();

            const resolvePromise = resolveAttackDamage(attack);
            await new Promise((r) => setTimeout(r, 10));

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: {
                    promptId: 'test-prompt-id-12345',
                    targetName: 'Goblin',
                    success: false,
                    roll: 5,
                    total: 8,
                    saveBonus: 3,
                },
            }));

            await resolvePromise;
            await tick();

            expect(sendSavePrompt).toHaveBeenCalled();
            expect(modalState.shieldBashModal).toBeDefined();
        });
    });

    describe('Crusher feat', () => {
        it('applies Crusher push on bludgeoning hit with oncePerTurn tracking', async () => {
            getCombatContext.mockResolvedValue(createCombatContext());
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider',
                            trigger: 'bludgeoning_damage_hit',
                            oncePerTurn: true,
                            name: 'Crusher',
                            options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                        },
                        {
                            type: 'conditional_advantage',
                            trigger: 'critical_hit_bludgeoning',
                            name: 'Crusher Enhanced Critical',
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = makeAttack({
                name: 'Warhammer',
                damage: '1d8+5',
                damageType: 'Bludgeoning',
            });

            await resolveAttackDamage(attack);
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        source: 'Crusher',
                        effect: 'push',
                        value: 5,
                    }),
                ]),
                'test-campaign',
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_Crusher_usedRound',
                1,
                'test-campaign',
            );
        });

        it('applies Crusher Enhanced Critical on bludgeoning crit', async () => {
            getCombatContext.mockResolvedValue(createCombatContext());
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'conditional_advantage',
                            trigger: 'critical_hit_bludgeoning',
                            name: 'Crusher Enhanced Critical',
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { isCrit: true },
            });
            const attack = makeAttack({
                name: 'Warhammer',
                damage: '1d8+5',
                damageType: 'Bludgeoning',
            });

            await resolveAttackDamage(attack);
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        effect: 'crusher_enhanced_critical',
                    }),
                ]),
                'test-campaign',
            );
        });

        it('does not apply Crusher push when already used this turn', async () => {
            getCombatContext.mockResolvedValue(createCombatContext());
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === '_Crusher_usedRound') return 1;
                return null;
            });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'attack_rider',
                            trigger: 'bludgeoning_damage_hit',
                            oncePerTurn: true,
                            name: 'Crusher',
                            options: [{ name: 'Push 5 ft', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = makeAttack({
                name: 'Warhammer',
                damage: '1d8+5',
                damageType: 'Bludgeoning',
            });

            await resolveAttackDamage(attack);
            await tick();

            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            for (const call of targetEffectCalls) {
                const effects = call[2];
                expect(effects).not.toContainEqual(
                    expect.objectContaining({
                        source: 'Crusher',
                        effect: 'push',
                    })
                );
            }
        });
    });

    describe('Slasher feat', () => {
        it('applies Slasher Enhanced Critical on slashing crit', async () => {
            getCombatContext.mockResolvedValue(createCombatContext());
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'conditional_advantage',
                            trigger: 'critical_hit_slashing',
                            name: 'Slasher Enhanced Critical',
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { isCrit: true },
            });
            const attack = makeAttack({
                name: 'Longsword',
                damage: '1d8+5',
                damageType: 'Slashing',
            });

            await resolveAttackDamage(attack);
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        effect: 'slasher_enhanced_critical',
                    }),
                ]),
                'test-campaign',
            );
        });

        it('does not apply Slasher Enhanced Critical on non-crit', async () => {
            getCombatContext.mockResolvedValue(createCombatContext());
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'conditional_advantage',
                            trigger: 'critical_hit_slashing',
                            name: 'Slasher Enhanced Critical',
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { isCrit: false },
            });
            const attack = makeAttack({
                name: 'Longsword',
                damage: '1d8+5',
                damageType: 'Slashing',
            });

            await resolveAttackDamage(attack);
            await tick();

            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            for (const call of targetEffectCalls) {
                const effects = call[2];
                expect(effects).not.toContainEqual(
                    expect.objectContaining({
                        effect: 'slasher_enhanced_critical',
                    })
                );
            }
        });
    });

    describe('Piercer feat', () => {
        it('applies Piercer extra damage die on crit', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'damage_bonus',
                            trigger: 'critical_hit_piercing',
                            diceType: 'weapon_die',
                            name: 'Piercer Critical',
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { isCrit: true },
            });
            const attack = makeAttack({
                name: 'Rapier',
                damage: '1d8+5',
                damageType: 'Piercing',
            });

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            const call = mockRollDamage.mock.calls[0][0];
            const formula = call.formula;
            expect(formula).toContain('plus 1d8');
            expect(formula).toContain('[Enhanced Critical]');
        });

        it('does not apply Piercer damage on non-crit', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'damage_bonus',
                            trigger: 'critical_hit_piercing',
                            diceType: 'weapon_die',
                            name: 'Piercer Critical',
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({
                playerStats: stats,
                popupHtml: { isCrit: false },
            });
            const attack = makeAttack({
                name: 'Rapier',
                damage: '1d8+5',
                damageType: 'Piercing',
            });

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            const call = mockRollDamage.mock.calls[0][0];
            const formula = call.formula;
            expect(formula).not.toContain('[Enhanced Critical]');
        });
    });

    describe('Savage Attacker', () => {
        it('does not auto-apply damage reroll in pipeline when passive exists', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            type: 'passive_rule',
                            effect: 'reroll_damage_once_per_turn',
                            name: 'Savage Attacker',
                        },
                    ],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = makeAttack({
                name: 'Greataxe',
                damage: '1d12+5',
                damageType: 'Slashing',
                properties: ['Heavy'],
            });

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
        });
    });

    describe('Tavern Brawler', () => {
        it('applies Tavern Brawler push on unarmed strike hit', async () => {
            getCombatContext.mockResolvedValue(createCombatContext());
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [{ effect: 'tavern_brawler_push' }],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = makeAttack({
                name: 'Unarmed Strike',
                damage: '1d4',
                damageType: 'Bludgeoning',
                weaponType: 'unarmed',
            });

            await resolveAttackDamage(attack);
            await tick();

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        source: 'Tavern Brawler',
                        effect: 'push',
                        value: 5,
                    }),
                ]),
                'test-campaign',
            );
        });

        it('does not apply Tavern Brawler push on non-unarmed strike', async () => {
            getCombatContext.mockResolvedValue(createCombatContext());
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [],
                    passives: [{ effect: 'tavern_brawler_push' }],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = makeAttack({
                name: 'Shortsword',
                damage: '1d6+2',
                damageType: 'Piercing',
                weaponType: 'melee',
            });

            await resolveAttackDamage(attack);
            await tick();

            const targetEffectCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            for (const call of targetEffectCalls) {
                const effects = call[2];
                expect(effects).not.toContainEqual(
                    expect.objectContaining({
                        source: 'Tavern Brawler',
                        effect: 'push',
                    })
                );
            }
        });
    });
});
