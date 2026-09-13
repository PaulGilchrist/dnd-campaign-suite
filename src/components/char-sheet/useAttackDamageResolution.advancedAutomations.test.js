// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
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

describe('useAttackDamageResolution - advanced automations', () => {
    const mockSetPopupHtml = vi.fn();
    const mockRollDamage = vi.fn();
    const mockBuildCtx = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
    const mockBuildCtxSync = vi.fn(() => Promise.resolve({ targetName: 'Goblin' }));
    const modalState = {};

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
            modalState,
            setModalState: vi.fn((updates) => {
                if (typeof updates === 'function') {
                    return updates(modalState);
                }
                Object.assign(modalState, updates);
            }),
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
    });

    function tick() {
        return new Promise((r) => setTimeout(r, 0));
    }

    describe('Potent Spellcasting (cantrip damage bonus)', () => {
        function makeCantripStats(overrides = {}) {
            return {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus',
                            trigger: 'weapon_attack_hit',
                            options: ['Potent Spellcasting (Cantrip)'],
                            name: 'Potent Spellcasting',
                            ...overrides,
                        },
                    ],
                    passives: [],
                },
                spellAbilities: {
                    spells: [
                        { name: 'Fire Bolt', level: 0 },
                    ],
                },
                ...overrides,
            };
        }

        it('adds Wisdom modifier to cantrip damage formula and total', async () => {
            const stats = makeCantripStats();
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Fire Bolt',
                damage: '1d10',
                damageType: 'Fire',
                weaponType: 'ranged',
                properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            const call = mockRollDamage.mock.calls[0][0];
            const formula = call.formula;
            const total = call.total;

            expect(formula).toContain('4 [Cantrip]');
            expect(total).toBe(9);
        });

        it('does not add cantrip damage bonus when feature is absent', async () => {
            const { resolveAttackDamage } = UseAttackDamageResolution();
            const attack = {
                name: 'Fire Bolt',
                damage: '1d10',
                damageType: 'Fire',
                weaponType: 'ranged',
                properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            const formula = mockRollDamage.mock.calls[0][0].formula;
            expect(formula).not.toContain('[Cantrip]');
        });

        it('does not add cantrip damage bonus when spellAbilities is missing', async () => {
            const stats = {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus',
                            trigger: 'weapon_attack_hit',
                            options: ['Potent Spellcasting (Cantrip)'],
                            name: 'Potent Spellcasting',
                        },
                    ],
                    passives: [],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Fire Bolt',
                damage: '1d10',
                damageType: 'Fire',
                weaponType: 'ranged',
                properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            const formula = mockRollDamage.mock.calls[0][0].formula;
            expect(formula).not.toContain('[Cantrip]');
        });

        it('skips cantrip damage bonus when Wisdom modifier is negative', async () => {
            const stats = {
                ...mockPlayerStats,
                abilities: [
                    { name: 'Strength', bonus: 3 },
                    { name: 'Dexterity', bonus: 2 },
                    { name: 'Wisdom', bonus: -2 },
                ],
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus',
                            trigger: 'weapon_attack_hit',
                            options: ['Potent Spellcasting (Cantrip)'],
                            name: 'Potent Spellcasting',
                        },
                    ],
                    passives: [],
                },
                spellAbilities: {
                    spells: [{ name: 'Fire Bolt', level: 0 }],
                },
            };
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Fire Bolt',
                damage: '1d10',
                damageType: 'Fire',
                weaponType: 'ranged',
                properties: [],
            };

            await resolveAttackDamage(attack);
            await tick();

            expect(mockRollDamage).toHaveBeenCalled();
            const formula = mockRollDamage.mock.calls[0][0].formula;
            expect(formula).not.toContain('[Cantrip]');
        });
    });
});
