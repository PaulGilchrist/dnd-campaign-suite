// @maintained-by-ai: 2026-10-14
// MA-1842: Apep Constrict ongoing grapple-damage producer — the hit-clause
// leg registers the registered constrict_grapple te + ONE rounds:100 backstop
// clock ONLY while Grappled stands on the victim, and logs every grant and
// refusal. Rows without the structured grapple_ongoing_damage key (all other
// grapple rows) stay byte-inert.
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

vi.mock('../../../services/combat/aoeService.js', () => ({
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
    getEffectDefinition: vi.fn((key) => ({ effect: key, label: 'Constrict', group: 'Defensive' })),
}));

vi.mock('../../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import { buildHitConditionClause } from '../../../components/encounter/MonsterCardHelpers.js';
import { registerTargetEffect } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import monsters from '../../../../public/data/monsters.json';

// rec #511 / fix#279(b) import-disk recipe: disk BY-name lookup replaces the
// hand-transcribed Apep Constrict mirror — the lane now drives the REAL
// public/data/monsters.json bytes (owner lane MonsterCardHelpers.grapple-
// ongoing-damage.test.js:14 + chilling-gaze :83 same BY-name shape).
// Drift check 2026-10-23: all eight former mirror fields byte-identical vs
// disk (fix#279 CON-vs-Constitution class — none found); disk-only keys
// description/save_effect are not buildHitConditionClause inputs, so the
// clause bytes the consumer reads are unchanged; conversion inert.
const APEP_CONSTRICT_ACTION = monsters
    .find((m) => m.name === 'Apep')
    .actions.find((a) => a.name === 'Constrict');

const deps = {
    characterName: 'Apep 1',
    campaignName: 'test-campaign',
    characters: [
        { name: 'Apep 1', computedStats: { armorClass: 23 } },
        { name: 'ElderPaladin', computedStats: { armorClass: 19 } },
    ],
    setPopupHtml: vi.fn(),
    logEntry: vi.fn(),
    pendingSaves: {},
};

function hitContext(extra = {}) {
    return {
        targetName: 'ElderPaladin',
        damageType: 'Bludgeoning',
        attackerName: 'Apep 1',
        hitClause: buildHitConditionClause(APEP_CONSTRICT_ACTION),
        ...extra,
    };
}

function constrictRoll(context) {
    return { name: 'Constrict', formula: '4d8 + 9', total: 25, rolls: [4, 4, 4, 8], modifier: 9, context };
}

// Models the victim's stored Grappled state at the rider-leg read.
function mockGrappledStanding(standing) {
    getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'ElderPaladin' && prop === 'activeConditions') return standing ? ['grappled'] : [];
        return null;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    applyDamageToTarget.mockReturnValue({ finalDamage: 25, newHp: 175, damageReduced: false });
    loadCombatSummary.mockResolvedValue({
        creatures: [
            { name: 'ElderPaladin', type: 'player', ac: 19, currentHp: 200, maxHp: 224 },
            { name: 'Apep 1', type: 'npc', size: 'Gargantuan', ac: 23, currentHp: 624, maxHp: 624 },
        ],
    });
});

describe('MA-1842 ongoing grapple-damage producer', () => {
    it('when Grappled stands: registers constrict_grapple te + ONE rounds:100 clock, logs grant and condition reason', async () => {
        mockGrappledStanding(true);
        const fn = createLogDamageAndShow(deps);
        await fn(constrictRoll(hitContext()));

        expect(registerTargetEffect).toHaveBeenCalledWith('test-campaign', 'ElderPaladin', 'constrict_grapple', 'Apep 1', {
            duration: 'until_released',
            die: '4d8',
            damageType: 'Bludgeoning',
            escapeDc: 26,
            actionName: 'Constrict',
        });
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
            attackerName: 'Apep 1',
            targetName: 'ElderPaladin',
            campaignName: 'test-campaign',
            rounds: 100,
            effects: [{ type: 'remove_target_effect', effectKey: 'constrict_grapple', source: 'Apep 1', target: 'ElderPaladin' }],
        }));
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'automation',
            automationType: 'constrict_grapple_granted',
            characterName: 'ElderPaladin',
            sourceName: 'Apep 1',
        }));
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            reason: 'Constrict (escape DC 26)',
        }));
    });

    it('when the grapple did not stand: escape DC 26 meta still stamped, zero te / zero clock, refusal logged', async () => {
        mockGrappledStanding(false);
        const fn = createLogDamageAndShow(deps);
        await fn(constrictRoll(hitContext()));

        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2].grappled).toMatchObject({ dc: 26, ability: 'str', source: 'Apep 1' });
        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'automation',
            automationType: 'constrict_grapple_refused',
        }));
    });

    it('is byte-inert for sibling grapple rows without the structured key (Vine Blight)', async () => {
        mockGrappledStanding(true);
        const clause = buildHitConditionClause({ name: 'Constricting Vine', attack_bonus: 4, hit_conditions: ['grappled'], escape_dc: 12 });
        const fn = createLogDamageAndShow(deps);
        await fn(constrictRoll({ targetName: 'ElderPaladin', damageType: 'Bludgeoning', attackerName: 'Apep 1', hitClause: clause }));

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ automationType: 'constrict_grapple_granted' }));
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ automationType: 'constrict_grapple_refused' }));
    });
});
