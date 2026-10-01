// @improved-by-ai
// MA-1723 grant leg: Winter Wolf "Bite" prone rider. One-field DATA fix
// hit_conditions:["prone"] (MA-1534 Boulder / MA-1541 Thunderbolt lane) arms
// buildHitConditionClause → handlePlainDamage.maybeApplyHitClause → applyHitClauseConditions
// (:554): prone lands on the victim's activeConditions + meta.source + a condition-applied
// log on every resolved hit. Consumer size gate is the family-wide Large-or-smaller
// (§1116/MA-0553 ladder): the Medium Bandit victim passes byte-identical to MA-1534
// Boulder; Huge is refused; Large over-apply is the recorded house caveat. The
// "Large or smaller" prose gate rides the same lane (MA-1723 as-written: Medium passes).
// No escape DC, no expiry clock on the pure hit_conditions lane (MA-1541).
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
    getEffectDefinition: vi.fn((key) => ({ effect: key, label: '', group: '' })),
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

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import { buildHitConditionClause } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const BITE = monsters.find((m) => m.index === 'winter-wolf').actions.find((a) => a.name === 'Bite');

describe('MA-1723 Winter Wolf Bite prone grant leg', () => {
    const deps = {
        characterName: 'Winter Wolf 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Winter Wolf 1', computedStats: { armorClass: 13 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 12, newHp: 987, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'player', size: 'Medium or Small', ac: 12, currentHp: 11, maxHp: 11 }],
        });
    });

    function hitContext(extra = {}) {
        return {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Winter Wolf 1',
            hitClause: buildHitConditionClause(BITE),
            ...extra,
        };
    }

    it('grants Prone to the Large-or-smaller victim on a resolved hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '2d6 + 4', total: 12, rolls: [2, 6], modifier: 4, context: hitContext() });

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Bandit 1',
            'activeConditions',
            expect.arrayContaining(['prone']),
            'test-campaign'
        );
    });

    it('stamps the wolf into activeConditionMeta source with no escape DC', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '2d6 + 4', total: 12, rolls: [2, 6], modifier: 4, context: hitContext() });

        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2].prone.source).toBe('Winter Wolf 1');
        expect(metaCall[2].prone.dc).toBeUndefined();
    });

    it('logs a condition-applied entry naming the action', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '2d6 + 4', total: 12, rolls: [2, 6], modifier: 4, context: hitContext() });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Prone',
            reason: 'Bite (escape DC —)',
        }));
    });

    it('does not duplicate Prone already active on the target', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'Bandit 1' && prop === 'activeConditions') return ['prone'];
            return null;
        });
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '2d6 + 4', total: 12, rolls: [2, 6], modifier: 4, context: hitContext() });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall[2].filter(c => String(c).toLowerCase() === 'prone')).toHaveLength(1);
    });

    it('writes nothing when the clause is absent (plain attack / miss flow)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({
            name: 'Bite', formula: '2d6 + 4', total: 12, rolls: [2, 6], modifier: 4,
            context: { targetName: 'Bandit 1', damageType: 'Piercing', attackerName: 'Winter Wolf 1' },
        });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });

    it('family gate (§1116): Huge victims are refused; Medium passes byte-identical to MA-1534', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'player', size: 'Huge', ac: 12, currentHp: 11, maxHp: 11 }],
        });
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '2d6 + 4', total: 12, rolls: [2, 6], modifier: 4, context: hitContext() });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
    });
});
