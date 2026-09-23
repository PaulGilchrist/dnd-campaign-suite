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
import { buildHitConditionClause, parseHitConditionRoll } from '../../../components/encounter/MonsterCardHelpers.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import monsters from '../../../../public/data/monsters.json';

const CHAOS_CLAW_ACTION = {
    name: 'Chaos Claw',
    attack_bonus: 8,
    reach: '10 ft.',
    damage_dice_primary: '1d10 + 4',
    damage_type_primary: 'Slashing',
    damage_dice_secondary: '2d10',
    damage_type_secondary: 'Necrotic',
    hit_condition_roll: { die: 4, conditions: ['charmed', 'frightened', 'poisoned', 'incapacitated'] },
};

const CANONICAL_RIDER_CONDITIONS = ['charmed', 'frightened', 'poisoned', 'incapacitated'];

const deps = {
    characterName: 'Gray Slaad 1',
    campaignName: 'test-campaign',
    characters: [
        { name: 'Gray Slaad 1', computedStats: { armorClass: 18 } },
        { name: 'Bandit 1', computedStats: { armorClass: 12 } },
    ],
    setPopupHtml: vi.fn(),
    logEntry: vi.fn(),
    pendingSaves: {},
};

function clawContext() {
    return {
        targetName: 'Bandit 1',
        damageType: 'Slashing',
        attackerName: 'Gray Slaad 1',
        hitClause: buildHitConditionClause(CHAOS_CLAW_ACTION),
    };
}

function clawDamageCall() {
    return {
        name: 'Chaos Claw', formula: '1d10 + 4', total: 9, rolls: [5], modifier: 4,
        context: clawContext(),
    };
}

async function hitWithRoll(n) {
    rollExpression.mockImplementation((formula) => (formula === '1d4' ? { total: n, rolls: [n], modifier: 0, formula } : null));
    const fn = createLogDamageAndShow(deps);
    await fn(clawDamageCall());
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    rollExpression.mockReturnValue(null);
    applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 2, damageReduced: false });
    loadCombatSummary.mockResolvedValue({
        creatures: [{ name: 'Bandit 1', type: 'player', size: 'Medium', ac: 12, currentHp: 11, maxHp: 11 }],
    });
});

describe('MA-0913 data-lock — Gray Slaad Chaos Claw hit_condition_roll', () => {
    it('authors the structured d4 rider on disk with canonical condition tokens', () => {
        const slaad = monsters.find(m => m.index === 'gray-slaad');
        const row = slaad.actions.find(a => a.name === 'Chaos Claw');
        expect(row.hit_condition_roll).toEqual({ die: 4, conditions: CANONICAL_RIDER_CONDITIONS });
        expect(row.hit_condition_roll.conditions).toHaveLength(row.hit_condition_roll.die);
    });

    it('matches the death-slaad Chaos Blade authored twin byte-shape', () => {
        const gray = monsters.find(m => m.index === 'gray-slaad').actions.find(a => a.name === 'Chaos Claw');
        const death = monsters.find(m => m.index === 'death-slaad').actions.find(a => a.name === 'Chaos Blade');
        expect(gray.hit_condition_roll).toEqual(death.hit_condition_roll);
    });

    it('leaves the damage rider byte-unchanged (+8 claw, 1d10+4 Slashing + 2d10 Necrotic)', () => {
        const row = monsters.find(m => m.index === 'gray-slaad').actions.find(a => a.name === 'Chaos Claw');
        expect(row.attack_bonus).toBe(8);
        expect(row.reach).toBe('10 ft.');
        expect(row.damage_dice_primary).toBe('1d10 + 4');
        expect(row.damage_type_primary).toBe('Slashing');
        expect(row.damage_dice_secondary).toBe('2d10');
        expect(row.damage_type_secondary).toBe('Necrotic');
    });
});

describe('MA-0913 buildHitConditionClause arms the gray-slaad d4 rider', () => {
    it('parses the disk row into a conditionRoll-bearing clause', () => {
        const row = monsters.find(m => m.index === 'gray-slaad').actions.find(a => a.name === 'Chaos Claw');
        expect(parseHitConditionRoll(row)).toEqual({ die: 4, conditions: CANONICAL_RIDER_CONDITIONS });
        expect(buildHitConditionClause(row)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Chaos Claw',
            targetEffect: null,
            conditionRoll: { die: 4, conditions: CANONICAL_RIDER_CONDITIONS },
        });
    });
});

describe('MA-0913 d4 rider grant on resolved hits', () => {
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
        await hitWithRoll(3);
        expect(rollExpression).toHaveBeenCalledWith('1d4');
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'roll',
            rollType: 'chaos-condition',
            characterName: 'Gray Slaad 1',
            targetName: 'Bandit 1',
            formula: '1d4',
            rolls: [3],
            total: 3,
            description: '1d4 → 3 → Poisoned',
        }));
    });

    it('grants the chosen standard condition with meta source and a condition-applied log', async () => {
        await hitWithRoll(2);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall[2].frightened).toMatchObject({ source: 'Gray Slaad 1' });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Frightened',
        }));
    });

    it('registers ONE anchor-expiry clock on the slaad (fires at its next turn start)', async () => {
        await hitWithRoll(1);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Gray Slaad 1',
            targetName: 'Bandit 1',
            effects: [{ type: 'condition', condition: 'charmed', source: 'Gray Slaad 1' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'Gray Slaad 1',
        });
    });
});
