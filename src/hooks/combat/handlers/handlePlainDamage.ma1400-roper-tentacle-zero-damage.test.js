// @maintained-by-ai: 2026-10-14
// MA-1400: Roper "Tentacle" damageless hit-clause consumer proof — the row
// authors ZERO damage, so the whole rider rides the resolved hit through the
// dice-less '0' auto-damage arm (MonsterCardModal.buildAutoDamageOptions).
// This file owns ONE unique contract: handlePlainDamage (via
// createLogDamageAndShow) with total 0 still reaches maybeApplyHitClause —
// applyDamageToTarget(0) returns a non-null applyResult (the guard is
// !applyResult, never damage > 0) — granting Grappled+Poisoned with
// escape-meta {dc:14, ability:'str', source} + condition-applied log, while
// the damage leg pays zero. Trimmed 2026-10-14: disk row shape and the
// dice-less '0' dispatch arm are locked in
// MonsterAction.ma1400-roper-tentacle-hit-conditions.test.jsx; the generic
// miss flow (no hitClause) and null-applyResult guards are damage-agnostic
// and covered in handlePlainDamage.hitClause.test.js; the damageless
// consumer lane itself has a byte-twin in the MA-1402 rug-smother file.
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

const TENTACLE = monsters.find((m) => m.index === 'roper').actions[2];

describe('MA-1400 roper Tentacle damageless hit-clause consumer', () => {
    const deps = {
        characterName: 'Roper 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Roper 1', computedStats: { armorClass: 20 } },
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

    it('ZERO-damage resolved hit grants Grappled+Poisoned (escape DC 14) and pays zero damage', async () => {
        await createLogDamageAndShow(deps)({
            name: 'Tentacle', formula: '0', total: 0, rolls: [], modifier: 0, context: {
                targetName: 'Bandit 1',
                damageType: '',
                attackerName: 'Roper 1',
                hitClause: buildHitConditionClause(TENTACLE),
            },
        });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['grappled', 'poisoned']);
        expect(setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta')?.[2]).toMatchObject({
            grappled: { dc: 14, ability: 'str', source: 'Roper 1' },
            poisoned: { dc: 14, ability: 'str', source: 'Roper 1' },
        });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Grappled, Poisoned',
            reason: 'Tentacle (escape DC 14)',
        }));

        // Damage leg stays honest: the dice-less '0' rides through without
        // moving HP (applyDamageToTarget receives 0, log finalDamage 0).
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Bandit 1', 0, [''], expect.anything());
        const dmgLog = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.rollType === 'damage');
        expect(dmgLog).toMatchObject({ formula: '0', total: 0, finalDamage: 0 });
    });
});
