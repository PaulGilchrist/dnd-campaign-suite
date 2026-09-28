// MA-1402: Rug of Smothering "Smother" damageless hit-clause consumer proof —
// RAW grants Grappled (escape DC 13) + Restrained + Blinded ON HIT with ZERO
// immediate damage (the 2d6 + 3 is target-turn-start DoT, §70 advisory parked).
// Post-fix the row authors hit_conditions triple + escape_dc 13 and NO damage,
// so the whole rider rides the resolved hit through the dice-less '0'
// auto-damage arm (MonsterCardModal.buildAutoDamageOptions, MA-1400 lineage).
// This pins the CONSUMER face: handlePlainDamage (via createLogDamageAndShow)
// with total 0 still reaches maybeApplyHitClause — applyDamageToTarget(0)
// passes isUsableRawDamage and returns a non-null applyResult — granting
// Grappled+Restrained+Blinded with escape-meta {dc:13, ability:'str', source}
// + condition-applied log, while damage stays zero. Pre-fix the triple could
// only ever arrive via the RAW-nonexistent save lane (save-fail spray) and
// the attack chip paid 2d6 + 3 FULL on every hit.
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

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import { buildHitConditionClause } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const RUG = monsters.find((m) => m.index === 'rug-of-smothering');
const SMOTHER = RUG.actions[0];

describe('MA-1402 rug-of-smothering Smother damageless hit-clause consumer', () => {
    const deps = {
        characterName: 'Rug of Smothering 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Rug of Smothering 1', computedStats: { armorClass: 12 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 0, oldHp: 999, newHp: 999, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'player', size: 'Medium or Small', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('grants Grappled+Restrained+Blinded with escape-meta and DC-13 log on a ZERO-damage resolved hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Smother', formula: '0', total: 0, rolls: [], modifier: 0, context: {
            targetName: 'Bandit 1',
            damageType: '',
            attackerName: 'Rug of Smothering 1',
            hitClause: buildHitConditionClause(SMOTHER),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['grappled', 'restrained', 'blinded']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall[2]).toMatchObject({
            grappled: { dc: 13, ability: 'str', source: 'Rug of Smothering 1' },
            restrained: { dc: 13, ability: 'str', source: 'Rug of Smothering 1' },
            blinded: { dc: 13, ability: 'str', source: 'Rug of Smothering 1' },
        });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Grappled, Restrained, Blinded',
            reason: 'Smother (escape DC 13)',
        }));
    });

    it('damage leg pays ZERO: damage log finalDamage 0, HP never moves', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Smother', formula: '0', total: 0, rolls: [], modifier: 0, context: {
            targetName: 'Bandit 1',
            damageType: '',
            attackerName: 'Rug of Smothering 1',
            hitClause: buildHitConditionClause(SMOTHER),
        } });

        const dmgLog = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.rollType === 'damage');
        expect(dmgLog).toBeTruthy();
        expect(dmgLog.formula).toBe('0');
        expect(dmgLog.total).toBe(0);
        expect(dmgLog.finalDamage).toBe(0);
        expect(dmgLog.rolls).toEqual([]);
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Bandit 1', 0, [''], expect.anything());
    });

    it('writes no condition when no clause reaches the damage leg (miss flow stays byte-inert)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Smother', formula: '0', total: 0, rolls: [], modifier: 0, context: {
            targetName: 'Bandit 1',
            damageType: '',
            attackerName: 'Rug of Smothering 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});
