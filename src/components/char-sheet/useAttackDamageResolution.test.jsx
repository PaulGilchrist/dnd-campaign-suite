// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution from './useAttackDamageResolution.js';

// BASE LANE — only surface no sibling lane owns, verified against the real
// buildPipelineForAction chain: public API shape, default no-op manual-click
// run (housekeeping + plain-damage seam bytes), the mapName buildCtx/buildCtxSync
// ternary, crit-doubling seam + popup clear, dice-fail halt, two-weapon-fighting
// fold, runtime targetEffects damage_bonus rider, and Hunter's Prey horde-breaker
// latches. TWF (hasTwoWeaponFighting) and the runtime damage_bonus targetEffects
// step are exercised byte-exactly nowhere else in the cluster.
// Owned elsewhere: normalizeAutoDamage.test.js (#283 normalizer canon),
// advancedAutomations #298, automationDamage #299, automations #300 (automation
// action riders — distinct from the runtime targetEffects rider here),
// classFeatures #301 (feature dispatch, pendingSuddenStrike ARM; the null CLEAR
// from attackRollHousekeeping is pinned here because no lane asserts it),
// ctxOverrides #302 (override-vs-derived table), feats #304 (mastery gating —
// the old base "no mastery modal" negative never reached collectWeaponMastery
// and was vacuous), maneuvers/mn014 #306/#307 (die math), pausedStates #311,
// optionSelect #310, tacticalMaster #316, resume lanes #303/#312/#314,
// standalone #315, opportunity-transport #309, skipManeuver #313,
// maneuveringAlly #305, mn015SaveDc #308.

// Mock audit vs. this seam's live transitive graph:
// - diceRoller: rollExpression + rollExpressionDoubled — both invoked (rollBaseDamage).
// - combatData: getCurrentCombatRound — horde-breaker latch reads it.
// - useRuntimeState: read/written by housekeeping, targetEffects, superiority steps.
// - choiceStorage: getChosenRuntimeValue — applyElementalAffinity reads it every roll.
// - automationService: hasTwoWeaponFighting — TWF legs. evaluateAutoExpression is
//   NOT accessed here (only maneuver handlers use it; maneuvers/mn014 lanes own it).
// - logService: addEntry kept as network isolation for transitive post-damage logs;
//   never asserted on this seam.
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

const CAMPAIGN = 'test-campaign';
const PLAYER = 'TestFighter';

// Keyed dice mocks: every die rolls 5 (non-crit) / 5+5 (crit). All expected
// formulas/totals below are exact pins derived from these, never expect.any.
const plainRoll = { total: 5, rolls: [5], modifier: 3 };
const critRoll = { total: 10, rolls: [5, 5], modifier: 6 };

function makePlayerStats(overrides = {}) {
    return {
        name: PLAYER,
        level: 5,
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 2 }],
        proficiency: 3,
        class: { name: 'Barbarian', class_levels: [{ level: 5, rage_damage: 2 }] },
        automation: { actions: [], passives: [] },
        ...overrides,
    };
}

function createMockDeps(overrides = {}) {
    return {
        playerStats: makePlayerStats(),
        campaignName: CAMPAIGN,
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

// Exact merged ctx the hook hands rollDamage on a manual click with no
// overrides — the mergeDamagePipelineCtx null-shape (attackRollPostDamage:338
// passes critLabels: undefined, so no crit keys appear).
const BASE_DAMAGE_CTX = {
    targetName: 'Goblin',
    autoDamageSecondaryFormula: null,
    autoDamageSecondaryName: null,
    autoDamageSecondaryDamageType: null,
    saveDc: null,
    saveType: null,
    dcSuccess: null,
    tavernBrawlerRerolls: null,
};

const latchWrites = (key) => setRuntimeValue.mock.calls.filter((c) => c[1] === key);

describe('useAttackDamageResolution — base hook seam', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        rollExpression.mockReturnValue(plainRoll);
        rollExpressionDoubled.mockReturnValue(critRoll);
        getRuntimeValue.mockReturnValue(null);
        getCurrentCombatRound.mockReturnValue(1);
        hasTwoWeaponFighting.mockReturnValue(false);
        deps = createMockDeps();
    });

    it('exposes the exact public API: the six handlers, nothing less', () => {
        const api = useAttackDamageResolution(deps);

        expect(Object.keys(api).sort()).toEqual([
            'handleAttackRiderManeuverSkip',
            'handleAttackRiderManeuverUse',
            'handleAttackRiderOptionSelect',
            'proceedWithDamage',
            'resolveAttackDamage',
            'resumeAttackPipeline',
        ].sort());
    });

    describe('resolveAttackDamage over the real pipeline', () => {
        it.each([
            {
                scenario: 'mapName null → buildCtxSync rebuild',
                mapName: null,
                expectCalled: 'buildCtxSync',
            },
            {
                scenario: 'mapName truthy → buildCtx rebuild',
                mapName: 'test-map',
                expectCalled: 'buildCtx',
            },
        ])('$scenario with byte-exact rollDamage payload', async ({ mapName, expectCalled }) => {
            const testDeps = createMockDeps({ mapName });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);
            const attack = makeAttack();

            await resolveAttackDamage(attack);

            expect(rollExpression).toHaveBeenCalledWith('1d8+3 [slashing]');
            expect(rollExpressionDoubled).not.toHaveBeenCalled();
            expect(testDeps[expectCalled]).toHaveBeenCalledWith(attack, { consumeAttackTe: false });
            expect(testDeps[expectCalled === 'buildCtx' ? 'buildCtxSync' : 'buildCtx']).not.toHaveBeenCalled();
            expect(testDeps.rollDamage).toHaveBeenCalledTimes(1);
            expect(testDeps.rollDamage).toHaveBeenCalledWith({
                name: 'Longsword',
                formula: '1d8+3 [slashing]',
                total: 5,
                rolls: [5],
                modifier: 3,
                context: BASE_DAMAGE_CTX,
            });
        });

        it('runs housekeeping on every attack: pendingSuddenStrike keys clear to null', async () => {
            const { resolveAttackDamage } = useAttackDamageResolution(deps);

            await resolveAttackDamage(makeAttack());

            expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'pendingSuddenStrike', null, CAMPAIGN);
            expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'pendingSuddenStrikeTarget', null, CAMPAIGN);
        });

        it('critical popup doubles the dice and clears the popup before damage lands', async () => {
            const critDeps = createMockDeps({ popupHtml: { isCrit: true, isNatural20: true } });
            const { resolveAttackDamage } = useAttackDamageResolution(critDeps);

            await resolveAttackDamage(makeAttack());

            expect(rollExpressionDoubled).toHaveBeenCalledWith('1d8+3 [slashing]');
            expect(rollExpression).not.toHaveBeenCalled();
            expect(critDeps.setPopupHtml).toHaveBeenCalledWith(null);
            expect(critDeps.rollDamage).toHaveBeenCalledWith({
                name: 'Longsword',
                formula: '1d8+3 [slashing]',
                total: 10,
                rolls: [5, 5],
                modifier: 6,
                context: BASE_DAMAGE_CTX,
            });
        });

        it('halts the chain when the damage roll returns null — no rebuild, no rollDamage', async () => {
            rollExpression.mockReturnValue(null);
            const { resolveAttackDamage } = useAttackDamageResolution(deps);

            await resolveAttackDamage(makeAttack());

            expect(deps.buildCtxSync).not.toHaveBeenCalled();
            expect(deps.rollDamage).not.toHaveBeenCalled();
        });

        it('appends the runtime damage_bonus targetEffect once and writes the remaining list back empty', async () => {
            getRuntimeValue.mockImplementation((_name, key) =>
                key === 'targetEffects' ? [{ effect: 'damage_bonus', damageExpression: '1d4', damageType: 'fire' }] : null
            );
            const { resolveAttackDamage } = useAttackDamageResolution(deps);

            await resolveAttackDamage(makeAttack({ damage: '1d8' }));

            expect(deps.rollDamage).toHaveBeenCalledWith(expect.objectContaining({
                formula: '1d8 [slashing] + 1d4 [fire]',
                total: 10,
                rolls: [5, 5],
            }));
            expect(latchWrites('targetEffects')).toEqual([['campaign', 'targetEffects', [], CAMPAIGN]]);
        });
    });

    describe('two-weapon fighting fold', () => {
        beforeEach(() => {
            hasTwoWeaponFighting.mockReturnValue(true);
        });

        it.each([
            {
                scenario: 'appends STR mod for a Light off-hand bonus attack',
                attack: { name: 'Handaxe', damage: '1d6', damageType: 'slashing', type: 'Bonus Action', properties: ['Light'], abilityName: 'Strength' },
                expected: { formula: '1d6 [slashing] + 3 [Strength]', total: 8, rolls: [5, 3] },
            },
            {
                scenario: 'appends exactly once when the mod is already in the base formula',
                attack: { name: 'Handaxe', damage: '1d6+3', damageType: 'slashing', type: 'Bonus Action', properties: ['Light'], abilityName: 'Strength' },
                expected: { formula: '1d6+3 [slashing] + 3 [Strength]', total: 8, rolls: [5, 3] },
            },
            {
                scenario: 'no append for a non-Light bonus attack',
                attack: { name: 'Warhammer', damage: '1d8', damageType: 'bludgeoning', type: 'Bonus Action', properties: [], abilityName: 'Strength' },
                expected: { formula: '1d8 [bludgeoning]', total: 5, rolls: [5] },
            },
            {
                scenario: 'no append when abilityName is missing',
                attack: { name: 'Handaxe', damage: '1d6', damageType: 'slashing', type: 'Bonus Action', properties: ['Light'] },
                expected: { formula: '1d6 [slashing]', total: 5, rolls: [5] },
            },
            {
                scenario: 'no append when the ability modifier is zero',
                attack: { name: 'Handaxe', damage: '1d6', damageType: 'slashing', type: 'Bonus Action', properties: ['Light'], abilityName: 'Strength' },
                stats: makePlayerStats({ abilities: [{ name: 'Strength', bonus: 0 }] }),
                expected: { formula: '1d6 [slashing]', total: 5, rolls: [5] },
            },
        ])('$scenario', async ({ attack, stats, expected }) => {
            const testDeps = createMockDeps({ playerStats: stats || makePlayerStats() });
            const { resolveAttackDamage } = useAttackDamageResolution(testDeps);

            await resolveAttackDamage(makeAttack(attack));

            expect(testDeps.rollDamage).toHaveBeenCalledTimes(1);
            expect(testDeps.rollDamage).toHaveBeenCalledWith(expect.objectContaining(expected));
        });
    });

    describe("Hunter's Prey horde breaker latch", () => {
        const hordeBreaker = { name: 'Horde Breaker', damage: '1d6', damageType: 'force', type: 'Bonus Action' };

        it.each([
            { choice: 'Horde Breaker', expectLatch: true },
            { choice: 'Colossus Slayer', expectLatch: false },
        ])('choice $choice → latch $expectLatch', async ({ choice, expectLatch }) => {
            getRuntimeValue.mockImplementation((_name, key) =>
                key === "_Hunter's_Prey_choice" ? choice : null
            );
            const { resolveAttackDamage } = useAttackDamageResolution(deps);

            await resolveAttackDamage(makeAttack(hordeBreaker));

            expect(latchWrites('_Hunters_Prey_HordeBreaker_UsedRound')).toEqual(
                expectLatch ? [[PLAYER, '_Hunters_Prey_HordeBreaker_UsedRound', 1, CAMPAIGN]] : []
            );
        });
    });
});
