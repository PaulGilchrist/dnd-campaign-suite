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

describe('useAttackDamageResolution - cantrip damage bonus', () => {
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

    describe('Potent Spellcasting (cantrip damage bonus)', () => {
        function makeCantripStats(overrides = {}) {
            return {
                ...mockPlayerStats,
                automation: {
                    actions: [
                        {
                            type: 'damage_bonus', trigger: 'weapon_attack_hit',
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

        it('adds Wisdom modifier to cantrip damage when ability is positive', async () => {
            const stats = makeCantripStats();
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Fire Bolt', damage: '1d10', damageType: 'Fire',
                weaponType: 'ranged', properties: [],
            };
            await resolveAttackDamage(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Fire Bolt',
                expect.stringContaining('4 [Cantrip]'),
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('does not add bonus when spell is not a cantrip (level > 0)', async () => {
            const stats = makeCantripStats({
                spellAbilities: {
                    spells: [
                        { name: 'Fire Bolt', level: 1 },
                    ],
                },
            });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Fire Bolt', damage: '2d10', damageType: 'Fire',
                weaponType: 'ranged', properties: [],
            };
            await resolveAttackDamage(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Fire Bolt',
                '2d10',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });

        it('does not add bonus when Wisdom modifier is 0 or negative', async () => {
            const stats = makeCantripStats({
                abilities: [
                    { name: 'Strength', bonus: 3 },
                    { name: 'Dexterity', bonus: 2 },
                    { name: 'Wisdom', bonus: -2 },
                ],
            });
            const { resolveAttackDamage } = UseAttackDamageResolution({ playerStats: stats });
            const attack = {
                name: 'Fire Bolt', damage: '1d10', damageType: 'Fire',
                weaponType: 'ranged', properties: [],
            };
            await resolveAttackDamage(attack);
            await tick();
            expect(mockRollDamage).toHaveBeenCalledWith(
                'Fire Bolt',
                '1d10',
                expect.any(Number), expect.any(Array), expect.any(Number), expect.any(Object)
            );
        });
    });
});
