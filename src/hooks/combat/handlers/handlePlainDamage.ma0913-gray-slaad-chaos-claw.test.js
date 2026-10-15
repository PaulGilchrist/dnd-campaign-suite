// @maintained-by-ai: 2026-10-14
// MA-0913 Gray Slaad Chaos Claw: disk data-lock + disk→runtime wiring of the
// d4 rider. Runtime mechanics (face mapping, meta source, anchor clock, gates)
// are lane-generic and covered by handlePlainDamage.hitConditionRoll.test.js.
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

const ATTACKER = 'Gray Slaad 1';
const TARGET = 'Bandit 1';

const CANONICAL_RIDER_CONDITIONS = ['charmed', 'frightened', 'poisoned', 'incapacitated'];

const diskRow = () => monsters.find(m => m.index === 'gray-slaad').actions.find(a => a.name === 'Chaos Claw');

const deps = {
    characterName: ATTACKER,
    campaignName: 'test-campaign',
    characters: [
        { name: ATTACKER, computedStats: { armorClass: 18 } },
        { name: TARGET, computedStats: { armorClass: 12 } },
    ],
    setPopupHtml: vi.fn(),
    logEntry: vi.fn(),
    pendingSaves: {},
};

function runtimeWrite(key) {
    return setRuntimeValue.mock.calls.find(c => c[1] === key);
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    rollExpression.mockReturnValue(null);
    applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 2, damageReduced: false });
    loadCombatSummary.mockResolvedValue({
        creatures: [{ name: TARGET, type: 'player', size: 'Medium', ac: 12, currentHp: 11, maxHp: 11 }],
    });
});

describe('MA-0913 data-lock — Gray Slaad Chaos Claw on disk', () => {
    it('authors the canonical d4 rider twin plus the RAW damage bytes (+8, 1d10+4 Slashing + 2d10 Necrotic)', () => {
        const row = diskRow();
        expect(row.attack_bonus).toBe(8);
        expect(row.reach).toBe('10 ft.');
        expect(row.damage_dice_primary).toBe('1d10 + 4');
        expect(row.damage_type_primary).toBe('Slashing');
        expect(row.damage_dice_secondary).toBe('2d10');
        expect(row.damage_type_secondary).toBe('Necrotic');
        expect(row.hit_condition_roll).toEqual({ die: 4, conditions: CANONICAL_RIDER_CONDITIONS });
        expect(row.hit_condition_roll.conditions).toHaveLength(row.hit_condition_roll.die);
        // Identical d4 rider twin to the Death Slaad Chaos Blade (MA-0575).
        const death = monsters.find(m => m.index === 'death-slaad').actions.find(a => a.name === 'Chaos Blade');
        expect(row.hit_condition_roll).toEqual(death.hit_condition_roll);
    });
});

describe('MA-0913 disk row arms the d4 rider end-to-end', () => {
    it('builds a conditionRoll clause from the disk row and grants the rolled condition on a resolved hit', async () => {
        const hitClause = buildHitConditionClause(diskRow());
        expect(hitClause).toMatchObject({
            conditions: [],
            escapeDc: null,
            attackName: 'Chaos Claw',
            conditionRoll: { die: 4, conditions: CANONICAL_RIDER_CONDITIONS },
        });

        rollExpression.mockImplementation((formula) => (formula === '1d4' ? { total: 3, rolls: [3], modifier: 0, formula } : null));
        await createLogDamageAndShow(deps)({
            name: 'Chaos Claw', formula: '1d10 + 4', total: 9, rolls: [5], modifier: 4,
            context: { targetName: TARGET, damageType: 'Slashing', attackerName: ATTACKER, hitClause },
        });

        expect(rollExpression).toHaveBeenCalledWith('1d4');
        expect(runtimeWrite('activeConditions')?.[2]).toEqual(['poisoned']);
        expect(runtimeWrite('activeConditionMeta')?.[2].poisoned).toMatchObject({ source: ATTACKER });

        const logs = deps.logEntry.mock.calls.map(c => c[0]);
        expect(logs).toContainEqual(expect.objectContaining({
            type: 'roll',
            rollType: 'chaos-condition',
            characterName: ATTACKER,
            targetName: TARGET,
            formula: '1d4',
            rolls: [3],
            total: 3,
            description: '1d4 → 3 → Poisoned',
        }));
        expect(logs).toContainEqual(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: TARGET,
            condition: 'Poisoned',
            reason: "Chaos Claw — 1d4 rolled 3 → Poisoned; until the start of Gray Slaad 1's next turn",
        }));

        // MA-0016 single-clock rule: exactly one expiry anchored on the slaad.
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: ATTACKER,
            targetName: TARGET,
            effects: [{ type: 'condition', condition: 'poisoned', source: ATTACKER }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: ATTACKER,
        });
    });
});
