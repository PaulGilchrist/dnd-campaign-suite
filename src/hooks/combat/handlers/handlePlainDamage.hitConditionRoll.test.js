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
    characterName: 'Death Slaad 1',
    campaignName: 'test-campaign',
    characters: [
        { name: 'Death Slaad 1', computedStats: { armorClass: 18 } },
        { name: 'Knight 1', computedStats: { armorClass: 18 } },
    ],
    setPopupHtml: vi.fn(),
    logEntry: vi.fn(),
    pendingSaves: {},
};

function chaosContext() {
    return {
        targetName: 'Knight 1',
        damageType: 'Slashing',
        attackerName: 'Death Slaad 1',
        hitClause: buildHitConditionClause(CHAOS_BLADE_ACTION),
    };
}

function chaosDamageCall() {
    return {
        name: 'Chaos Blade', formula: '1d12 + 5', total: 7, rolls: [2], modifier: 5,
        context: chaosContext(),
    };
}

async function hitWithRoll(n) {
    rollExpression.mockImplementation((formula) => (formula === '1d4' ? { total: n, rolls: [n], modifier: 0, formula } : null));
    const fn = createLogDamageAndShow(deps);
    await fn(chaosDamageCall());
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    rollExpression.mockReturnValue(null);
    applyDamageToTarget.mockReturnValue({ finalDamage: 19, newHp: 33, damageReduced: false });
    loadCombatSummary.mockResolvedValue({
        creatures: [{ name: 'Knight 1', type: 'player', size: 'Medium', ac: 18, currentHp: 52, maxHp: 52 }],
    });
});

describe('MA-0575 data-lock — Death Slaad Chaos Blade hit_condition_roll', () => {
    it('authors the structured d4 rider on disk with canonical condition tokens', () => {
        const slaad = monsters.find(m => m.index === 'death-slaad');
        const row = slaad.actions.find(a => a.name === 'Chaos Blade');
        expect(row.hit_condition_roll).toEqual({ die: 4, conditions: CANONICAL_RIDER_CONDITIONS });
        expect(row.hit_condition_roll.conditions).toHaveLength(row.hit_condition_roll.die);
    });

    it('leaves every other monster row without hit_condition_roll (byte-inert)', () => {
        const authored = monsters.filter(m => (m.actions || []).some(a => a.hit_condition_roll));
        expect(authored.map(m => m.name)).toEqual(['Death Slaad']);
    });
});

describe('MA-0575 buildHitConditionClause consumes hit_condition_roll', () => {
    it('builds a conditionRoll-bearing clause from the structured rider', () => {
        expect(buildHitConditionClause(CHAOS_BLADE_ACTION)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Chaos Blade',
            targetEffect: null,
            conditionRoll: { die: 4, conditions: CANONICAL_RIDER_CONDITIONS },
        });
    });

    it('is byte-inert outside authored rows (no conditionRoll key)', () => {
        expect(buildHitConditionClause({ name: 'Bite', attack_bonus: 5, hit_conditions: ['prone'] })).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Bite',
            targetEffect: null,
        });
        expect(buildHitConditionClause({ name: 'Slam', attack_bonus: 5 })).toBeNull();
        expect(buildHitConditionClause({ name: 'Bad', hit_condition_roll: { die: 4 } })).toBeNull();
        expect(buildHitConditionClause({ name: 'Bad', hit_condition_roll: { die: 4, conditions: [] } })).toBeNull();
    });
});

describe('MA-0575 d4 rider grant on resolved hits', () => {
    it.each([
        [1, 'charmed'],
        [2, 'frightened'],
        [3, 'poisoned'],
        [4, 'incapacitated'],
    ])('maps 1d4 → %i to %s', async (n, expected) => {
        await hitWithRoll(n);
        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual([expected]);
    });

    it('rolls the authored die via the rollExpression seam and logs it transparently', async () => {
        await hitWithRoll(2);
        expect(rollExpression).toHaveBeenCalledWith('1d4');
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'roll',
            rollType: 'chaos-condition',
            characterName: 'Death Slaad 1',
            targetName: 'Knight 1',
            formula: '1d4',
            rolls: [2],
            total: 2,
            description: '1d4 → 2 → Frightened',
        }));
    });

    it('grants the chosen standard condition with meta source and a condition-applied log', async () => {
        await hitWithRoll(4);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall[2].incapacitated).toMatchObject({ source: 'Death Slaad 1' });
        expect(metaCall[2].incapacitated.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Knight 1',
            condition: 'Incapacitated',
        }));
    });

    it('registers ONE anchor-expiry clock on the slaad (fires at its next turn start)', async () => {
        await hitWithRoll(1);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Death Slaad 1',
            targetName: 'Knight 1',
            effects: [{ type: 'condition', condition: 'charmed', source: 'Death Slaad 1' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'Death Slaad 1',
        });
    });

    it('MA-0553 anchor-collision: no second expiration write races the rider clock', async () => {
        await hitWithRoll(3);
        const expirationCalls = addExpiration.mock.calls.filter(c => (c[0]?.targetName || '') === 'Knight 1');
        expect(expirationCalls).toHaveLength(1);
    });

    it('grants nothing when the roll seam fails (no fabricated fallback)', async () => {
        rollExpression.mockReturnValue(null);
        const fn = createLogDamageAndShow(deps);
        await fn(chaosDamageCall());
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Knight 1', 'activeConditions', expect.anything(), 'test-campaign');
        expect(addExpiration).not.toHaveBeenCalled();
    });
});

describe('MA-0575 gates', () => {
    it('miss-zero: unresolved hit rolls no d4 and writes nothing', async () => {
        applyDamageToTarget.mockReturnValue(null);
        const fn = createLogDamageAndShow(deps);
        await fn(chaosDamageCall());
        expect(rollExpression).not.toHaveBeenCalledWith('1d4');
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Knight 1', 'activeConditions', expect.anything(), 'test-campaign');
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('size gate intact: Huge targets take no rider', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Knight 1', type: 'player', size: 'Huge', ac: 18, currentHp: 52, maxHp: 52 }],
        });
        await hitWithRoll(2);
        expect(rollExpression).not.toHaveBeenCalledWith('1d4');
        expect(setRuntimeValue).not.toHaveBeenCalledWith('Knight 1', 'activeConditions', expect.anything(), 'test-campaign');
        expect(addExpiration).not.toHaveBeenCalled();
    });
});
