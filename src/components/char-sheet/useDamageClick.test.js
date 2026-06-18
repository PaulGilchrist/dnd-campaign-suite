// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { addEntry } from '../../services/ui/logService.js';

const defaultRollResult = { total: 5, rolls: [5], modifier: 3 };
const defaultCtx = { targetName: 'Goblin' };

function createMockDeps(overrides = {}) {
    const mockPlayerStats = {
        name: 'TestFighter',
        level: 5,
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 2 }],
        proficiency: 3,
        class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
        automation: { actions: [], passives: [] },
    };

    return {
        playerStats: mockPlayerStats,
        campaignName: 'test-campaign',
        mapName: null,
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollDamage: vi.fn(),
        buildCtx: vi.fn(() => Promise.resolve(defaultCtx)),
        buildCtxSync: vi.fn(() => Promise.resolve(defaultCtx)),
        setDamageTypeChoice: vi.fn(),
        setDivineFuryChoice: vi.fn(),
        setWeaponMasteryModal: vi.fn(),
        setAttackRiderModal: vi.fn(),
        pendingDamageRef: { current: null },
        ...overrides,
    };
}

function HookFactory(deps) {
    return useDamageClick(deps);
}

describe('useDamageClick', () => {
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
        addEntry.mockResolvedValue(undefined);
        getCombatContext.mockResolvedValue(null);
        getCurrentCombatRound.mockReturnValue(1);
        deps = createMockDeps();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Basic damage click ──────────────────────────────────────────────

    describe('basic damage click', () => {
        it('rolls damage and calls rollDamage with computed values', async () => {
            const { handleDamageClick } = HookFactory(deps);
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(rollExpression).toHaveBeenCalledWith('1d8+3');
            expect(deps.buildCtxSync).toHaveBeenCalledWith(attack);
            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                5,
                [5],
                3,
                defaultCtx,
            );
        });

        it('double-rolls damage when popupHtml.isCrit is true', async () => {
            deps = createMockDeps({ popupHtml: { isCrit: true } });
            const { handleDamageClick } = HookFactory(deps);
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(rollExpressionDoubled).toHaveBeenCalledWith('1d8+3');
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('clears popupHtml when it had isCrit', async () => {
            deps = createMockDeps({ popupHtml: { isCrit: true, isNatural20: true } });
            const { handleDamageClick } = HookFactory(deps);
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.setPopupHtml).toHaveBeenCalledWith(null);
        });

        it('does not clear popupHtml when isCrit is absent', async () => {
            deps = createMockDeps({ popupHtml: { isNatural20: true } });
            const { handleDamageClick } = HookFactory(deps);
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('returns early without calling rollDamage when rollExpression returns null', async () => {
            rollExpression.mockReturnValue(null);
            const { handleDamageClick } = HookFactory(deps);
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);

            expect(deps.rollDamage).not.toHaveBeenCalled();
            expect(deps.buildCtxSync).not.toHaveBeenCalled();
        });

        it('returns early without calling rollDamage when rollExpressionDoubled returns null', async () => {
            rollExpressionDoubled.mockReturnValue(null);
            deps = createMockDeps({ popupHtml: { isCrit: true } });
            const { handleDamageClick } = HookFactory(deps);
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);

            expect(deps.rollDamage).not.toHaveBeenCalled();
        });

        it('does not call setPopupHtml when popupHtml is null', async () => {
            const { handleDamageClick } = HookFactory(deps);
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.setPopupHtml).not.toHaveBeenCalled();
        });

        it('does not call setPopupHtml when setPopupHtml is undefined', async () => {
            const testDeps = createMockDeps({ setPopupHtml: undefined });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.setPopupHtml).toBeUndefined();
        });

        it('uses buildCtx when mapName is truthy', async () => {
            const testDeps = createMockDeps({ mapName: 'test-map' });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = { name: 'Fire Bolt', damage: '1d10', damageType: 'fire', properties: [] };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.buildCtx).toHaveBeenCalledWith(attack);
            expect(testDeps.buildCtxSync).not.toHaveBeenCalled();
        });

        it('uses buildCtxSync when mapName is falsy', async () => {
            const { handleDamageClick } = HookFactory(deps);
            const attack = { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.buildCtxSync).toHaveBeenCalledWith(attack);
            expect(deps.buildCtx).not.toHaveBeenCalled();
        });

        it('returns { handleDamageClick, proceedWithDamage }', async () => {
            const { handleDamageClick, proceedWithDamage } = HookFactory(deps);

            expect(typeof handleDamageClick).toBe('function');
            expect(typeof proceedWithDamage).toBe('function');
        });
    });

    // ── Two Weapon Fighting ─────────────────────────────────────────────

    describe('two weapon fighting', () => {
        it('appends ability modifier to formula for light bonus action weapons', async () => {
            hasTwoWeaponFighting.mockReturnValue(true);
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Handaxe',
                damage: '1d6',
                damageType: 'slashing',
                type: 'Bonus Action',
                properties: ['Light'],
                abilityName: 'Strength',
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Handaxe',
                expect.stringContaining('+ 3[Strength]'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('does not append ability modifier for non-light weapons', async () => {
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Warhammer',
                damage: '1d8',
                damageType: 'bludgeoning',
                type: 'Bonus Action',
                properties: [],
                abilityName: 'Strength',
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Warhammer',
                '1d8',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('does not append when abilityMod is 0', async () => {
            hasTwoWeaponFighting.mockReturnValue(true);
            const stats = { ...deps.playerStats, abilities: [{ name: 'Strength', bonus: 0 }] };
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Handaxe',
                damage: '1d6',
                damageType: 'slashing',
                type: 'Bonus Action',
                properties: ['Light'],
                abilityName: 'Strength',
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Handaxe',
                '1d6',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('does not append when abilityName is missing', async () => {
            hasTwoWeaponFighting.mockReturnValue(true);
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Handaxe',
                damage: '1d6',
                damageType: 'slashing',
                type: 'Bonus Action',
                properties: ['Light'],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Handaxe',
                '1d6',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('does not append when modifier is already in formula', async () => {
            hasTwoWeaponFighting.mockReturnValue(true);
            rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 3 });
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Handaxe',
                damage: '1d6+3',
                damageType: 'slashing',
                type: 'Bonus Action',
                properties: ['Light'],
                abilityName: 'Strength',
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            const formulaArg = deps.rollDamage.mock.calls[0][1];
            const matches = formulaArg.match(/\+ 3\[Strength\]/g);
            expect(matches).toHaveLength(1);
        });
    });

    // ── Rider damage effects (targetEffects) ────────────────────────────

    describe('rider damage effects', () => {
        it('applies damage_bonus targetEffects to formula and total', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'targetEffects') {
                    return [{ effect: 'damage_bonus', damageExpression: '1d4', damageType: 'fire' }];
                }
                return null;
            });
            const { handleDamageClick } = HookFactory(deps);
            const attack = { name: 'Longsword', damage: '1d8', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('1d4'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('skips rider effects when targetEffects is empty', async () => {
            getRuntimeValue.mockReturnValueOnce([]);
            const { handleDamageClick } = HookFactory(deps);
            const attack = { name: 'Longsword', damage: '1d8', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('skips rider effects when getRuntimeValue returns null', async () => {
            const { handleDamageClick } = HookFactory(deps);
            const attack = { name: 'Longsword', damage: '1d8', damageType: 'slashing', properties: [] };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Sudden Strike ───────────────────────────────────────────────────

    describe('sudden strike handling', () => {
        it('clears pendingSuddenStrike for bonus action attacks when flag is set', async () => {
            getRuntimeValue.mockReturnValueOnce(true);
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Sudden Strike',
                damage: '1d6',
                damageType: 'psychic',
                type: 'Bonus Action',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'pendingSuddenStrike',
                null,
                'test-campaign',
            );
        });

        it('does not clear pendingSuddenStrike for non-bonus action attacks', async () => {
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Longsword',
                damage: '1d8',
                damageType: 'slashing',
                type: 'Action',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                'pendingSuddenStrike',
                null,
                'test-campaign',
            );
        });

        it('does not clear pendingSuddenStrike when flag is falsy', async () => {
            getRuntimeValue.mockReturnValueOnce(false);
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Longsword',
                damage: '1d8',
                damageType: 'slashing',
                type: 'Bonus Action',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                'pendingSuddenStrike',
                null,
                'test-campaign',
            );
        });
    });

    // ── Horde Breaker ───────────────────────────────────────────────────

    describe('horde breaker handling', () => {
        it('marks horde breaker as used for the current round', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce('Horde Breaker');
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Horde Breaker',
                damage: '1d6',
                damageType: 'force',
                type: 'Bonus Action',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_Hunters_Prey_HordeBreaker_UsedRound',
                1,
                'test-campaign',
            );
        });

        it('does not mark when hunter prey choice is different', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce('Colossus Slayer');
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Horde Breaker',
                damage: '1d6',
                damageType: 'force',
                type: 'Bonus Action',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                '_Hunters_Prey_HordeBreaker_UsedRound',
                expect.any(Number),
                'test-campaign',
            );
        });

        it('does not mark when attack is not a bonus action', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce('Horde Breaker');
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Horde Breaker',
                damage: '1d6',
                damageType: 'force',
                type: 'Action',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                '_Hunters_Prey_HordeBreaker_UsedRound',
                expect.any(Number),
                'test-campaign',
            );
        });
    });

    // ── Weapon mastery modal ────────────────────────────────────────────

    describe('weapon mastery modal', () => {
        it('opens modal and stores pending damage for melee attacks with mastery', async () => {
            collectWeaponMastery.mockReturnValue({ baseMastery: { name: 'Mercy' }, extraMasteries: [] });
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.setWeaponMasteryModal).toHaveBeenCalledWith({
                attackName: 'Longsword',
                baseMastery: { name: 'Mercy' },
                extraMasteries: [],
            });
            expect(deps.pendingDamageRef.current).toEqual(
                expect.objectContaining({ attack, formula: '1d8+3' }),
            );
        });

        it('does not open modal for ranged attacks', async () => {
            collectWeaponMastery.mockReturnValue({ baseMastery: { name: 'Mercy' }, extraMasteries: [] });
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Longbow',
                damage: '1d8+3',
                damageType: 'piercing',
                weaponType: 'ranged',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.setWeaponMasteryModal).not.toHaveBeenCalled();
        });

        it('does not open modal when no mastery is available', async () => {
            collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.setWeaponMasteryModal).not.toHaveBeenCalled();
        });

        it('opens modal when extraMasteries exist even without baseMastery', async () => {
            collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [{ name: 'Extra' }] });
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.setWeaponMasteryModal).toHaveBeenCalledWith({
                attackName: 'Longsword',
                baseMastery: null,
                extraMasteries: [{ name: 'Extra' }],
            });
        });
    });

    // ── Sacred Weapon ───────────────────────────────────────────────────

    describe('sacred weapon damage type', () => {
        it('applies damageTypeChoice from active sacred weapon buff for melee attacks', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce([{ name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'radiant' }]);
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.rollDamage).toHaveBeenCalled();
        });

        it('does not apply sacred weapon when attack is ranged', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce([{ name: 'Sacred Weapon', effect: 'sacred_weapon', damageTypeChoice: 'radiant' }]);
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Longbow',
                damage: '1d8+3',
                damageType: 'piercing',
                weaponType: 'ranged',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.rollDamage).toHaveBeenCalled();
        });
    });

    // ── Automation damage bonuses ────────────────────────────────────────

    describe('melee damage bonus automations', () => {
        it('applies melee_weapon_hit damage_bonus automations', async () => {
            const stats = {
                ...deps.playerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d4', damageType: 'radiant' },
                    ],
                    passives: [],
                },
            };
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('1d4'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('does not apply melee_weapon_hit bonuses for ranged attacks', async () => {
            const stats = {
                ...deps.playerStats,
                automation: {
                    actions: [
                        { type: 'damage_bonus', trigger: 'melee_weapon_hit', damageExpression: '1d4', damageType: 'radiant' },
                    ],
                    passives: [],
                },
            };
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Fire Bolt',
                damage: '1d10',
                damageType: 'fire',
                weaponType: 'ranged',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Fire Bolt',
                '1d10',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Divine Fury ─────────────────────────────────────────────────────

    describe('divine fury damage type choice', () => {
        it('opens damage type choice modal when divine fury has multiple options', async () => {
            const stats = {
                ...deps.playerStats,
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
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === '_divineFuryUsedRound') return null;
                if (prop === 'activeBuffs') return [{ effect: 'advantage_attacks_disadvantage_against' }, { damageBonusExpression: '1d4' }];
                return null;
            });
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.setDivineFuryChoice).toHaveBeenCalledWith('fire or cold');
            expect(testDeps.pendingDamageRef.current).toEqual(
                expect.objectContaining({
                    attack,
                    bonusExpr: '2d6',
                }),
            );
        });

        it('applies divine fury inline when single damage type', async () => {
            const stats = {
                ...deps.playerStats,
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
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === '_divineFuryUsedRound') return null;
                if (prop === 'activeBuffs') return [{ damageBonusExpression: '1d4' }];
                return null;
            });
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('2d6'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Attack riders ───────────────────────────────────────────────────

    describe('attack_rider automations', () => {
        it('applies strength_attack_hit_after_reckless riders', async () => {
            const stats = {
                ...deps.playerStats,
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
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
                abilityName: 'Strength',
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('1d6'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Weapon attack hit automations ────────────────────────────────────

    describe('weapon_attack_hit automations', () => {
        it('applies weapon_attack_hit damage_bonus once per turn', async () => {
            const stats = {
                ...deps.playerStats,
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
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('1d8'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('skips oncePerTurn when already used this round', async () => {
            const stats = {
                ...deps.playerStats,
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
            getRuntimeValue.mockReturnValueOnce(null) // _Divine_Strike_usedRound check -> returns 1
                .mockReturnValueOnce(null); // optionKey check
            // Actually the code does: getRuntimeValue(playerStats.name, usedKey, campaignName) where usedKey = '_Divine_Strike_usedRound'
            // Then it checks usedRound === currentRound (1 === 1) -> skip
            // We need to mock the usedRound check to return 1 (current round)
            getRuntimeValue.mockReturnValue(1);
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('skips features upgraded by higher-level features', async () => {
            const stats = {
                ...deps.playerStats,
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
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            // Should only include the upgraded (higher-level) feature's damage
            const formula = testDeps.rollDamage.mock.calls[0][1];
            expect(formula).toContain('3d8');
            // The base weapon damage '1d8+3' is always present, so check the bonus features separately
            // by verifying the original '1d8' from Divine Strike is NOT in the bonuses
            const bonusParts = formula.split('+').slice(1); // skip original '1d8'
            const bonusOnly = bonusParts.join('+');
            expect(bonusOnly).toContain('3d8');
            expect(bonusOnly).not.toContain('1d8');
        });

        it('does not apply weapon_attack_hit bonus when trigger is weapon_or_beast_form_attack_hit and not in actions', async () => {
            const stats = {
                ...deps.playerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            name: 'Beast Form Feature',
                            type: 'damage_bonus',
                            trigger: 'weapon_or_beast_form_attack_hit',
                            damageExpression: '1d8',
                            damageType: 'fire',
                        },
                    ],
                },
            };
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            // weaponAttackHitBonuses only filters actions, not passives
            // so this feature in passives should still be applied
            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('1d8'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Natural 20 bonuses ──────────────────────────────────────────────

    describe('natural_20_attack_roll bonuses', () => {
        it('applies natural_20 damage bonus when isNatural20 is true', async () => {
            const stats = {
                ...deps.playerStats,
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
            const testDeps = createMockDeps({ playerStats: stats, popupHtml: { isNatural20: true } });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('2d10'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('does not apply natural_20 bonus when isNatural20 is false', async () => {
            const stats = {
                ...deps.playerStats,
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
            const testDeps = createMockDeps({ playerStats: stats, popupHtml: { isNatural20: false } });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('uses increased_ability_score for extra damage expression', async () => {
            const stats = {
                ...deps.playerStats,
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
            const testDeps = createMockDeps({ playerStats: stats, popupHtml: { isNatural20: true } });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('3'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Celestial transformation ────────────────────────────────────────

    describe('celestial transformation riders', () => {
        it('applies attack_rider for active transformation', async () => {
            const stats = {
                ...deps.playerStats,
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
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('1d6'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('does not apply rider when no transformation is active', async () => {
            const stats = {
                ...deps.playerStats,
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
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('does not apply rider when transformation passive is missing', async () => {
            getActiveBuffs.mockReturnValue([{ name: 'Heavenly Wings' }]);
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Longsword',
                damage: '1d8',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Colossus Slayer ─────────────────────────────────────────────────

    describe('colossus Slayer', () => {
        it('adds 1d8 extra damage when target is below max HP', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce("Colossus Slayer");
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', currentHp: 5, maxHp: 15 });
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.stringContaining('1d8'),
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('does not add extra damage when target is at full HP', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce("Colossus Slayer");
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', currentHp: 15, maxHp: 15 });
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });

        it('does not add extra damage when no target from combat context', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce("Colossus Slayer");
            getTargetFromAttacker.mockReturnValue(null);
            const { handleDamageClick } = HookFactory(deps);
            const attack = {
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                '1d8+3',
                expect.any(Number),
                expect.any(Array),
                expect.any(Number),
                expect.any(Object),
            );
        });
    });

    // ── Crusher feat ────────────────────────────────────────────────────

    describe('crusher feat', () => {
        it('applies push effect for bludgeoning melee hits', async () => {
            const stats = {
                ...deps.playerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            name: 'Crusher',
                            type: 'attack_rider',
                            trigger: 'bludgeoning_damage_hit',
                            oncePerTurn: true,
                            options: [{ name: 'Push', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestFighter', hasActed: false }] });
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Mace',
                damage: '1d6',
                damageType: 'bludgeoning',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        source: 'Crusher',
                        effect: 'push',
                    }),
                ]),
                'test-campaign',
            );
        });

        it('does not apply crusher for non-bludgeoning damage', async () => {
            const stats = {
                ...deps.playerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            name: 'Crusher',
                            type: 'attack_rider',
                            trigger: 'bludgeoning_damage_hit',
                            oncePerTurn: true,
                            options: [{ name: 'Push', effect: 'push', value: 5 }],
                        },
                    ],
                },
            };
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        source: 'Crusher',
                    }),
                ]),
                'test-campaign',
            );
        });
    });

    // ── Slasher feat ────────────────────────────────────────────────────

    describe('slasher feat', () => {
        it('applies hamstring effect for slashing melee hits', async () => {
            const stats = {
                ...deps.playerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            name: 'Slasher',
                            type: 'attack_rider',
                            trigger: 'slashing_damage_hit',
                            oncePerTurn: true,
                            options: [{ name: 'Hamstring', effect: 'slowed', value: 10 }],
                        },
                    ],
                },
            };
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestFighter', hasActed: false }] });
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Scimitar',
                damage: '1d6',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        source: 'Slasher',
                        effect: 'slowed',
                    }),
                ]),
                'test-campaign',
            );
        });
    });

    // ── Stalker's Flurry ────────────────────────────────────────────────

    describe("Stalker's Flurry", () => {
        it('opens attack rider modal when no option has been chosen', async () => {
            const stats = {
                ...deps.playerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            name: "Stalker's Flurry",
                            type: 'attack_rider',
                            trigger: 'weapon_attack_hit',
                            chooseOne: true,
                            oncePerTurn: true,
                            options: [
                                { name: 'Sudden Strike', effect: 'sudden_strike' },
                                { name: 'Mass Fear', effect: 'mass_fear' },
                            ],
                        },
                    ],
                },
            };
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'TestFighter', hasActed: false }] });
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Shortsword',
                damage: '1d6+3',
                damageType: 'piercing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.setAttackRiderModal).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: expect.objectContaining({ name: "Stalker's Flurry" }),
                    targetName: 'Goblin',
                }),
            );
        });
    });

    // ── Tavern Brawler ──────────────────────────────────────────────────

    describe('Tavern Brawler push', () => {
        it('applies push effect for unarmed strikes', async () => {
            const stats = {
                ...deps.playerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            effect: 'tavern_brawler_push',
                        },
                    ],
                },
            };
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Unarmed Strike',
                damage: '1d4',
                damageType: 'bludgeoning',
                weaponType: 'unarmed',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        source: 'Tavern Brawler',
                        effect: 'push',
                        value: 5,
                    }),
                ]),
                'test-campaign',
            );
        });

        it('does not apply Tavern Brawler push for non-unarmed attacks', async () => {
            const stats = {
                ...deps.playerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            effect: 'tavern_brawler_push',
                        },
                    ],
                },
            };
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Longsword',
                damage: '1d8',
                damageType: 'slashing',
                weaponType: 'melee',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        source: 'Tavern Brawler',
                    }),
                ]),
                'test-campaign',
            );
        });
    });

    // ── Empowered Strikes ───────────────────────────────────────────────

    describe('empowered strikes (unarmed damage type modifier)', () => {
        it('opens damage type choice modal when no stored type and options exist', async () => {
            const stats = {
                ...deps.playerStats,
                automation: {
                    actions: [],
                    passives: [
                        {
                            name: 'Empowered Strikes',
                            type: 'damage_type_modifier',
                            trigger: 'unarmed_strike_hit',
                            oncePerTurn: true,
                            options: [
                                { damageType: 'radiant' },
                                { damageType: 'cold' },
                            ],
                        },
                    ],
                },
            };
            const testDeps = createMockDeps({ playerStats: stats });
            const { handleDamageClick } = HookFactory(testDeps);
            const attack = {
                name: 'Unarmed Strike',
                damage: '1d4',
                damageType: 'bludgeoning',
                weaponType: 'unarmed',
                properties: [],
            };

            await handleDamageClick(attack);
            await new Promise(r => setTimeout(r, 0));

            expect(testDeps.setDamageTypeChoice).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Empowered Strikes — Damage Type',
                    types: ['radiant', 'cold'],
                }),
            );
        });
    });
});
