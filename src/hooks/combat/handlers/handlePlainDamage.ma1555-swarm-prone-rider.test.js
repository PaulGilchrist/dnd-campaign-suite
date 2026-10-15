// @maintained-by-ai: 2026-10-14
// MA-1555 grant leg: Swarm of Crawling Claws "Swarm of Grasping Hands" prone rider.
// hit_conditions:["prone"] (authored with the conditional_damage Bloodied twin)
// arms buildHitConditionClause → handlePlainDamage.maybeApplyHitClause →
// applyHitClauseConditions: prone lands on the victim's activeConditions +
// meta.source + a condition-applied log on every resolved hit. No escape DC, no
// expiry clock on the pure hit_conditions lane (MA-1541).
//
// This file owns ONLY the swarm row's unique contract (the swarm is deliberately
// NOT in the HIT_CLAUSE_ROWS mega-lane in handlePlainDamage.hitClause.test.js):
// its disk-row data lock and the clause-armed prone grant end-to-end. Generic
// lane semantics — dup suppression, no-clause miss flow, and the family-wide
// §1116/MA-0553 Large-or-smaller size-gate ladder (Medium-or-smaller RAW cap is
// NOT expressible on this lane; Large over-apply is the recorded house caveat,
// Huge refused) — are covered generically there.
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

const TARGET = 'Bandit 1';
const ATTACKER = 'Swarm of Crawling Claws 1';

const GRASPING = monsters.find((m) => m.index === 'swarm-of-crawling-claws')
    .actions.find((a) => a.name === 'Swarm of Grasping Hands');

describe('MA-1555 Swarm of Grasping Hands prone grant leg', () => {
    const deps = {
        characterName: ATTACKER,
        campaignName: 'test-campaign',
        characters: [
            { name: ATTACKER, computedStats: { armorClass: 15 } },
            { name: TARGET, computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 21, newHp: 1, damageReduced: false });
        // "Medium or Small" range-size victim pins the MA-0553 ladder parse on this lane.
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: TARGET, type: 'player', size: 'Medium or Small', ac: 12, currentHp: 11, maxHp: 11 }],
        });
    });

    it('data-lock: swarm disk row arms the prone-only clause (escape_dc / hit_target_effect absent)', () => {
        expect(GRASPING.attack_bonus).toBe(4);
        expect(GRASPING.damage_dice_primary).toBe('4d8 + 2');
        expect(GRASPING.damage_type_primary).toBe('Necrotic');
        expect(GRASPING.conditional_damage).toEqual({ dice: '2d8', modifier: 2, damage_type: 'Necrotic', condition: 'Bloodied' });
        expect(GRASPING.hit_conditions).toEqual(['prone']);
        expect(GRASPING.escape_dc).toBeUndefined();
        expect(GRASPING.hit_target_effect).toBeUndefined();

        expect(buildHitConditionClause(GRASPING)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Swarm of Grasping Hands',
            targetEffect: null,
        });
    });

    it('grants Prone on a resolved hit: exact condition write, swarm provenance with no escape DC, condition-applied log', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({
            name: 'Swarm of Grasping Hands', formula: '4d8 + 2', total: 21, rolls: [4, 3, 6, 6], modifier: 2,
            context: {
                targetName: TARGET,
                damageType: 'Necrotic',
                attackerName: ATTACKER,
                hitClause: buildHitConditionClause(GRASPING),
            },
        });

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[0]).toBe(TARGET);
        expect(condCall[2]).toEqual(['prone']);
        expect(condCall[3]).toBe('test-campaign');

        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2].prone).toMatchObject({ source: ATTACKER });
        expect(metaCall[2].prone.dc).toBeUndefined();
        expect(metaCall[2].prone.ability).toBeUndefined();

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: TARGET,
            condition: 'Prone',
            reason: 'Swarm of Grasping Hands (escape DC —)',
        }));
    });
});
