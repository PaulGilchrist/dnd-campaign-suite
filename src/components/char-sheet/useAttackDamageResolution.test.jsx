// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/common/choiceStorage.js', () => ({
    getChosenRuntimeValue: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasTwoWeaponFighting: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { hasTwoWeaponFighting } from '../../services/combat/automation/automationService.js';

const defaultRollResult = { total: 5, rolls: [5], modifier: 3 };
const doubleRollResult = { total: 10, rolls: [5, 5], modifier: 6 };

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
        buildCtx: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        buildCtxSync: vi.fn(() => Promise.resolve({ targetName: 'Goblin' })),
        setModalState: vi.fn(),
        setPendingDamage: vi.fn(),
        resumeRef: { current: null },
        ...overrides,
    };
}

function makeAttack(overrides = {}) {
    return { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', properties: [], ...overrides };
}

describe('useAttackDamageResolution', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue(defaultRollResult);
        rollExpressionDoubled.mockReturnValue(doubleRollResult);
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        hasTwoWeaponFighting.mockReturnValue(false);
        getCurrentCombatRound.mockReturnValue(1);
        deps = createMockDeps();
    });

    describe('return value', () => {
        it('returns resolveAttackDamage and proceedWithDamage functions', () => {
            const { resolveAttackDamage, proceedWithDamage } = useAttackDamageResolution(deps);

            expect(typeof resolveAttackDamage).toBe('function');
            expect(typeof proceedWithDamage).toBe('function');
        });
    });

    describe('basic damage click', () => {
        it('rolls damage and calls rollDamage with correct parameters', async () => {
            const { resolveAttackDamage } = useAttackDamageResolution(deps);
            const attack = makeAttack();

            await resolveAttackDamage(attack);

            expect(rollExpression).toHaveBeenCalledWith('1d8+3 [slashing]');
            expect(deps.buildCtxSync).toHaveBeenCalledWith(attack, { consumeAttackTe: false });
            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.any(String),
                5,
                [5],
                3,
                expect.any(Object),
            );
        });

        it('double-rolls damage when isCrit is true', async () => {
            deps = createMockDeps({ popupHtml: { isCrit: true } });
            const { resolveAttackDamage } = useAttackDamageResolution(deps);
            const attack = makeAttack();

            await resolveAttackDamage(attack);

            expect(rollExpressionDoubled).toHaveBeenCalledWith('1d8+3 [slashing]');
            expect(rollExpression).not.toHaveBeenCalled();
            expect(deps.rollDamage).toHaveBeenCalledWith(
                'Longsword',
                expect.any(String),
                10,
                [5, 5],
                6,
                expect.any(Object),
            );
        });

        it('clears popupHtml on critical hit', async () => {
            deps = createMockDeps({ popupHtml: { isCrit: true, isNatural20: true } });
            const { resolveAttackDamage } = useAttackDamageResolution(deps);
            const attack = makeAttack();

            await resolveAttackDamage(attack);

            expect(deps.setPopupHtml).toHaveBeenCalledWith(null);
        });

        it('returns early when dice roll returns null', async () => {
            rollExpression.mockReturnValue(null);
            const { resolveAttackDamage } = useAttackDamageResolution(deps);
            const attack = makeAttack();

            await resolveAttackDamage(attack);

            expect(deps.rollDamage).not.toHaveBeenCalled();
            expect(deps.buildCtxSync).not.toHaveBeenCalled();
        });

        it('uses buildCtx when mapName is truthy', async () => {
            const testDeps = createMockDeps({ mapName: 'test-map' });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);
            const attack = makeAttack({ name: 'Fire Bolt', damage: '1d10', damageType: 'fire' });

            await resolveAttackDamage(attack);

            expect(testDeps.buildCtx).toHaveBeenCalledWith(attack, { consumeAttackTe: false });
            expect(testDeps.buildCtxSync).not.toHaveBeenCalled();
        });
    });

    describe('two weapon fighting modifier', () => {
        it.each([
            { scenario: 'appends modifier', attack: { name: 'Handaxe', damage: '1d6', damageType: 'slashing', type: 'Bonus Action', properties: ['Light'], abilityName: 'Strength' }, expected: /\+ 3 \[Strength\]/ },
            { scenario: 'no modifier for non-light', attack: { name: 'Warhammer', damage: '1d8', damageType: 'bludgeoning', type: 'Bonus Action', properties: [], abilityName: 'Strength' }, expected: null },
            { scenario: 'no modifier when abilityName missing', attack: { name: 'Handaxe', damage: '1d6', damageType: 'slashing', type: 'Bonus Action', properties: ['Light'] }, expected: null },
        ])('TWF: $scenario', async ({ attack, expected }) => {
            hasTwoWeaponFighting.mockReturnValue(true);
            const { resolveAttackDamage } = useAttackDamageResolution(deps);
            await resolveAttackDamage(makeAttack(attack));
            const formula = deps.rollDamage.mock.calls[0][1];
            if (expected) {
                expect(formula).toMatch(expected);
            } else {
                expect(formula).not.toMatch(/\+ \d+ \[Strength\]/);
            }
        });

        it('does not append when ability modifier is zero', async () => {
            hasTwoWeaponFighting.mockReturnValue(true);
            const stats = { ...deps.playerStats, abilities: [{ name: 'Strength', bonus: 0 }] };
            const testDeps = createMockDeps({ playerStats: stats });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);
            const attack = makeAttack({ name: 'Handaxe', damage: '1d6', damageType: 'slashing', type: 'Bonus Action', properties: ['Light'], abilityName: 'Strength' });
            await resolveAttackDamage(attack);
            const formula = testDeps.rollDamage.mock.calls[0][1];
            expect(formula).not.toMatch(/\+ 0 \[Strength\]/);
        });

        it('does not duplicate modifier already in formula', async () => {
            hasTwoWeaponFighting.mockReturnValue(true);
            const { resolveAttackDamage } = useAttackDamageResolution(deps);
            const attack = makeAttack({ name: 'Handaxe', damage: '1d6+3', damageType: 'slashing', type: 'Bonus Action', properties: ['Light'], abilityName: 'Strength' });
            await resolveAttackDamage(attack);
            const formula = deps.rollDamage.mock.calls[0][1];
            const matches = formula.match(/\+ 3 \[Strength\]/g);
            expect(matches).toHaveLength(1);
        });
    });

    describe('rider damage effects', () => {
        it('applies damage_bonus targetEffects to formula and total', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (prop === 'targetEffects') {
                    return [{ effect: 'damage_bonus', damageExpression: '1d4', damageType: 'fire' }];
                }
                return null;
            });
            const { resolveAttackDamage } = useAttackDamageResolution(deps);
            const attack = makeAttack({ damage: '1d8' });

            await resolveAttackDamage(attack);

            const formula = deps.rollDamage.mock.calls[0][1];
            expect(formula).toContain('1d4');
            expect(deps.rollDamage.mock.calls[0][2]).toBeGreaterThan(5);
        });

        it('skips rider effects when targetEffects is absent', async () => {
            const { resolveAttackDamage } = useAttackDamageResolution(deps);
            const attack = makeAttack({ damage: '1d8' });

            await resolveAttackDamage(attack);

            const formula = deps.rollDamage.mock.calls[0][1];
            expect(formula).toBe('1d8 [slashing]');
            expect(deps.rollDamage.mock.calls[0][2]).toBe(5);
        });
    });

    describe('sudden strike handling', () => {
        it('clears pendingSuddenStrike for all attacks', async () => {
            const { resolveAttackDamage } = useAttackDamageResolution(deps);
            const attack = makeAttack({
                name: 'Sudden Strike',
                damage: '1d6',
                damageType: 'psychic',
                type: 'Bonus Action',
            });

            await resolveAttackDamage(attack);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                'pendingSuddenStrike',
                null,
                'test-campaign',
            );
        });
    });

    describe('horde breaker handling', () => {
        it('marks horde breaker as used for the current round', async () => {
            getRuntimeValue.mockReturnValueOnce("Horde Breaker");
            const { resolveAttackDamage } = useAttackDamageResolution(deps);
            const attack = makeAttack({
                name: 'Horde Breaker',
                damage: '1d6',
                damageType: 'force',
                type: 'Bonus Action',
            });

            await resolveAttackDamage(attack);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter',
                '_Hunters_Prey_HordeBreaker_UsedRound',
                1,
                'test-campaign',
            );
        });

        it('does not mark when hunter prey choice is different', async () => {
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce('Colossus Slayer');
            const { resolveAttackDamage } = useAttackDamageResolution(deps);
            const attack = makeAttack({
                name: 'Horde Breaker',
                damage: '1d6',
                damageType: 'force',
                type: 'Bonus Action',
            });

            await resolveAttackDamage(attack);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestFighter',
                '_Hunters_Prey_HordeBreaker_UsedRound',
                expect.any(Number),
                'test-campaign',
            );
        });
    });

    describe('weapon mastery modal', () => {
        it('does not open weapon mastery modal when no mastery is available', async () => {
            const { resolveAttackDamage } = useAttackDamageResolution(deps);
            const attack = makeAttack({
                name: 'Longsword',
                damage: '1d8+3',
                damageType: 'slashing',
                weaponType: 'melee',
            });

            await resolveAttackDamage(attack);

            expect(deps.setModalState).not.toHaveBeenCalledWith(
                expect.objectContaining({ weaponMasteryModal: expect.anything() }),
            );
        });
    });
});
