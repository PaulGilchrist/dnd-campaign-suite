// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
    getActiveTargetEffect: vi.fn(() => null),
    getEffectDefinition: vi.fn((key) => ({ effect: key, label: key, group: 'Defensive' })),
}));

vi.mock('../../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import { buildHitConditionClause } from '../../../components/encounter/MonsterCardHelpers.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import monsters from '../../../../public/data/monsters.json';

const ATTACKER = 'Death Slaad 1';
const TARGET = 'Knight 1';

const CHAOS_BLADE_ACTION = {
    name: 'Chaos Blade',
    attack_bonus: 9,
    reach: '10 ft.',
    damage_dice_primary: '1d12 + 5',
    damage_type_primary: 'Slashing',
    damage_dice_secondary: '3d6',
    damage_type_secondary: 'Necrotic',
    hit_condition_roll: { die: 4, conditions: ['charmed', 'frightened', 'poisoned', 'incapacitated'] },
};

const CANONICAL_RIDER_CONDITIONS = ['charmed', 'frightened', 'poisoned', 'incapacitated'];

const deps = {
    characterName: ATTACKER,
    campaignName: 'test-campaign',
    characters: [
        { name: ATTACKER, computedStats: { armorClass: 18 } },
        { name: TARGET, computedStats: { armorClass: 18 } },
    ],
    setPopupHtml: vi.fn(),
    logEntry: vi.fn(),
    pendingSaves: {},
};

function chaosDamageCall() {
    return {
        name: 'Chaos Blade', formula: '1d12 + 5', total: 7, rolls: [2], modifier: 5,
        context: {
            targetName: TARGET,
            damageType: 'Slashing',
            attackerName: ATTACKER,
            hitClause: buildHitConditionClause(CHAOS_BLADE_ACTION),
        },
    };
}

// One resolved-hit roll through the lane; n=null fails the d4 seam (no grant).
async function hitWithRoll(n) {
    rollExpression.mockImplementation((formula) => (formula === '1d4' && n != null ? { total: n, rolls: [n], modifier: 0, formula } : null));
    await createLogDamageAndShow(deps)(chaosDamageCall());
}

function runtimeWrite(key) {
    return setRuntimeValue.mock.calls.find(c => c[1] === key);
}

function logs(pred) {
    return deps.logEntry.mock.calls.map(c => c[0]).filter(pred);
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    rollExpression.mockReturnValue(null);
    applyDamageToTarget.mockReturnValue({ finalDamage: 19, newHp: 33, damageReduced: false });
    loadCombatSummary.mockResolvedValue({
        creatures: [{ name: TARGET, type: 'player', size: 'Medium', ac: 18, currentHp: 52, maxHp: 52 }],
    });
});

describe('MA-0575 data-lock — Death Slaad Chaos Blade hit_condition_roll', () => {
    it('authors the canonical d4 rider on disk; only the Gray Slaad twin shares the key', () => {
        const row = monsters.find(m => m.index === 'death-slaad').actions.find(a => a.name === 'Chaos Blade');
        expect(row.hit_condition_roll).toEqual({ die: 4, conditions: CANONICAL_RIDER_CONDITIONS });
        expect(row.hit_condition_roll.conditions).toHaveLength(row.hit_condition_roll.die);
        // MA-0913: Gray Slaad Chaos Claw authors the identical d4 rider twin.
        const authored = monsters.filter(m => (m.actions || []).some(a => a.hit_condition_roll));
        expect(authored.map(m => m.name)).toEqual(['Death Slaad', 'Gray Slaad']);
    });
});

describe('MA-0575 buildHitConditionClause consumes hit_condition_roll', () => {
    it('arms a conditionRoll-bearing clause; malformed riders stay byte-inert', () => {
        expect(buildHitConditionClause(CHAOS_BLADE_ACTION)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Chaos Blade',
            targetEffect: null,
            conditionRoll: { die: 4, conditions: CANONICAL_RIDER_CONDITIONS },
        });
        expect(buildHitConditionClause({ name: 'Bad', hit_condition_roll: { die: 4 } })).toBeNull();
        expect(buildHitConditionClause({ name: 'Bad', hit_condition_roll: { die: 4, conditions: [] } })).toBeNull();
    });
});

describe('MA-0575 d4 rider grant on resolved hits', () => {
    it.each([
        [1, 'charmed', 'Charmed'],
        [2, 'frightened', 'Frightened'],
        [3, 'poisoned', 'Poisoned'],
        [4, 'incapacitated', 'Incapacitated'],
    ])('maps 1d4 → %i to %s, rolling the authored die via the seam and logging it transparently', async (n, condition, label) => {
        await hitWithRoll(n);
        expect(rollExpression).toHaveBeenCalledWith('1d4');
        expect(runtimeWrite('activeConditions')?.[2]).toEqual([condition]);
        expect(logs(e => e.rollType === 'chaos-condition')).toContainEqual(expect.objectContaining({
            type: 'roll',
            characterName: ATTACKER,
            targetName: TARGET,
            formula: '1d4',
            rolls: [n],
            total: n,
            description: `1d4 → ${n} → ${label}`,
        }));
    });

    it('grants with meta source, pinned next-turn reason, and ONE anchor clock (MA-0553)', async () => {
        await hitWithRoll(1);
        const metaCall = runtimeWrite('activeConditionMeta');
        expect(metaCall[2].charmed).toMatchObject({ source: ATTACKER });
        expect(metaCall[2].charmed.dc).toBeUndefined();
        expect(logs(e => e.type === 'condition' && e.action === 'applied')).toContainEqual(expect.objectContaining({
            characterName: TARGET,
            condition: 'Charmed',
            reason: "Chaos Blade — 1d4 rolled 1 → Charmed; until the start of Death Slaad 1's next turn",
        }));
        // MA-0016 single-clock rule: exactly one expiry anchored on the slaad.
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: ATTACKER,
            targetName: TARGET,
            effects: [{ type: 'condition', condition: 'charmed', source: ATTACKER }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: ATTACKER,
        });
    });

    it('grants nothing when the roll seam fails (no fabricated fallback)', async () => {
        await hitWithRoll(null);
        expect(runtimeWrite('activeConditions')).toBeUndefined();
        expect(addExpiration).not.toHaveBeenCalled();
    });
});

describe('MA-0575 gates', () => {
    it('miss-zero: unresolved hit rolls no d4 and writes nothing', async () => {
        applyDamageToTarget.mockReturnValue(null);
        await hitWithRoll(2);
        expect(rollExpression).not.toHaveBeenCalledWith('1d4');
        expect(runtimeWrite('activeConditions')).toBeUndefined();
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('size gate intact: Huge targets take no rider', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: TARGET, type: 'player', size: 'Huge', ac: 18, currentHp: 52, maxHp: 52 }],
        });
        await hitWithRoll(2);
        expect(rollExpression).not.toHaveBeenCalledWith('1d4');
        expect(runtimeWrite('activeConditions')).toBeUndefined();
        expect(addExpiration).not.toHaveBeenCalled();
    });
});
