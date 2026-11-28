// @maintained-by-ai 2026-11-28
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useAttackDamageResolution, { normalizeAutoDamage } from './useAttackDamageResolution.js';

// BASE LANE — only surface no sibling lane owns, verified against the real
// buildPipelineForAction chain: default no-op manual-click run (housekeeping +
// plain-damage seam bytes), the mapName buildCtx/buildCtxSync ternary,
// crit-doubling seam + popup clear, dice-fail halt, the two-weapon-fighting and
// runtime targetEffects damage_bonus riders END-TO-END into the rollDamage
// payload, and the Hunter's Prey horde-breaker latch write. Step-body branch
// matrices (TWF guards, targetEffects append/clear bytes, step conditions) are
// owned by attackRollDamageSteps-bonuses-basic.test.js (steps[7..9]); this lane
// proves only what step tests cannot see: the fold survives the real hook
// pipeline (housekeeping's isBonusActionAttack wiring + merged payload bytes).
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
// maneuveringAlly #305, mn015SaveDc #308. The six exported handlers are each
// exercised in its own lane (resolveAttackDamage here; optionSelect/skipManeuver/
// mn015SaveDc; resume lanes) — the old public-API key-set shape test was pruned
// as a redundant internals pin.

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

// Spell-flavoured autoDamage run through the real normalizer: every production
// caller feeds normalizeAutoDamage output, so this is the byte-exact shape a
// spell cast presents to resolveAttackDamage.
function spellShapedAttack() {
    const autoDamage = {
        name: 'Fire Bolt', formula: '2d10', damageType: 'fire',
        autoDamageSchool: 'evocation', attackType: 'Spell', targetName: 'Goblin',
    };
    return normalizeAutoDamage(autoDamage, false, makePlayerStats()).attack;
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

        // Mandatory housekeeping clears (attackRollHousekeeping.js:38-44) run on
        // EVERY attack-lane pass. fix#344(b) PROOF ARM — DISCHARGED-STALE (ledger
        // fix#337S housekeeping row): the step subscribes 'housekeeping:do' only on
        // the attack lane (attackRollHousekeeping.js:77, registered by
        // attackRollDamageSteps.js:9) while the spell lane subscribes 'spell:do'
        // (directSpellDamageSteps.js:109), and a chain with no matching subscriber
        // runs ZERO steps (actionPipeline.js:27-28). Skip-proof: buildNormalizedAttack
        // stamps weaponType UNCONDITIONALLY, so steps/index.js forces the attack lane
        // even for spell-flavoured autoDamage — the second case observes cleanup with
        // the spell lane's subscriber absent.
        it.each([
            {
                scenario: 'plain weapon attack clears every pending prompt key',
                attack: () => makeAttack(),
                context: undefined,
                laneByte: false,
            },
            {
                scenario: 'fix#344(b) spell-shaped autoDamage is forced onto the attack lane and clears every pending key',
                attack: spellShapedAttack,
                context: { hit: true, targetName: 'Goblin' },
                laneByte: true,
            },
        ])('$scenario', async ({ attack, context, laneByte }) => {
            const normalized = attack();
            if (laneByte) {
                // The non-skippable byte: attack-lane routing is unconditional post-normalize.
                expect(normalized.weaponType).toBeTruthy();
            }
            const { resolveAttackDamage } = useAttackDamageResolution(deps);

            await resolveAttackDamage(normalized, context);

            expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'pendingSuddenStrike', null, CAMPAIGN);
            expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'pendingSuddenStrikeTarget', null, CAMPAIGN);
            expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, 'stalkersFlurryChosenTarget', null, CAMPAIGN);
            expect(setRuntimeValue).toHaveBeenCalledWith(PLAYER, "_Stalker's_Flurry_option", null, CAMPAIGN);
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
                // DH crit-ledger-shape (2026-11-06): doubled sheet-lane groups log with the
                // monster-lane `*2` marker; roller still receives the plain formula (line above).
                formula: '1d8*2+3 [slashing]',
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

    describe('two-weapon fighting fold end-to-end', () => {
        // The guard arms (feature off, non-Light, missing abilityName, mod ≤ 0,
        // already-folded) are byte-owned by attackRollDamageSteps-bonuses-basic
        // t1–t3 with zero-writes pins. Only this seam can prove the two pipeline
        // wiring facts: housekeeping derives isBonusActionAttack from attack.type,
        // and the folded rider lands in the final rollDamage payload.
        beforeEach(() => {
            hasTwoWeaponFighting.mockReturnValue(true);
        });

        it.each([
            {
                scenario: 'a Light off-hand Bonus Action attack gets the STR mod appended exactly once',
                attack: { name: 'Handaxe', damage: '1d6', damageType: 'slashing', type: 'Bonus Action', properties: ['Light'], abilityName: 'Strength' },
                expected: { formula: '1d6 [slashing] + 3 [Strength]', total: 8, rolls: [5, 3] },
            },
            {
                scenario: 'a main-hand Light attack never folds the mod (isBonusActionAttack wiring)',
                attack: { name: 'Handaxe', damage: '1d6', damageType: 'slashing', properties: ['Light'], abilityName: 'Strength' },
                expected: { formula: '1d6 [slashing]', total: 5, rolls: [5] },
            },
        ])('$scenario', async ({ attack, expected }) => {
            const { resolveAttackDamage } = useAttackDamageResolution(deps);

            await resolveAttackDamage(makeAttack(attack));

            expect(deps.rollDamage).toHaveBeenCalledTimes(1);
            expect(deps.rollDamage).toHaveBeenCalledWith(expect.objectContaining(expected));
        });
    });

    describe("Hunter's Prey horde breaker latch", () => {
        // Sole writer-pin for '_Hunters_Prey_HordeBreaker_UsedRound' in the tree
        // (CharBonusActions.edgeCases only READS it to show/hide the row).
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
