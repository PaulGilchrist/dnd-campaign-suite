// @maintained-by-ai: 2026-10-14
// MA-1352 hit-side producer for the ABILITY axis of the Psychic Gray Ooze
// Pseudopod rider — the ability-scoped wiring the generic hit-clause mega
// lane cannot cover (no mega-lane row carries hit_target_effect_ability, and
// no row is psychic-gray-ooze): clause arms with targetEffectAbility:'int',
// registerTargetEffect payload carries ability:'int', ONE attacker-anchored
// clock (no ability-row fork), and the grant log names the INT scope
// (DC-free, advisory anchor). The MA-0016 no_healing byte-shape itself
// (clock/provenance/single-write) is owned by handlePlainDamage.hitClause
// .test.js; the save-roll consumption of this te is owned by
// handleNpcSaveDamage.ma1352-ability-save-disadv.test.js.
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

// Registry-faithful labels for the te lane (targetEffectDefinitions.js).
vi.mock('../../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
    getActiveTargetEffect: vi.fn(() => null),
    getEffectDefinition: vi.fn((key) => key === 'ability_save_disadvantage'
        ? { effect: key, label: 'Save Disadv (Ability)', description: 'Disadvantage on saving throws of the chosen ability until the end of the source\'s next turn.', group: 'Saves & Checks' }
        : { effect: key, label: key, group: 'Defensive' }),
}));

vi.mock('../../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import { buildHitConditionClause } from '../../../components/encounter/MonsterCardHelpers.js';
import { registerTargetEffect } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import monsters from '../../../../public/data/monsters.json';

const OOZE = monsters.find(m => m.index === 'psychic-gray-ooze');
const PSEUDOPOD_ACTION = OOZE.actions[0];
const ATTACKER = 'Psychic Gray Ooze 1';
const TARGET = 'Bandit 1';

describe('MA-1352 Pseudopod ability-scoped hit-clause producer', () => {
    const deps = {
        characterName: ATTACKER,
        campaignName: 'test-campaign',
        characters: [
            { name: ATTACKER, computedStats: { armorClass: 9 } },
            { name: TARGET, computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 11, newHp: 1, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: TARGET, type: 'npc', size: 'Medium', ac: 12, currentHp: 12, maxHp: 12 }],
        });
    });

    async function resolveHit() {
        const fn = createLogDamageAndShow(deps);
        await fn({
            name: 'Pseudopod',
            formula: '3d6 + 1',
            total: 11,
            rolls: [3, 4, 3],
            modifier: 1,
            context: {
                targetName: TARGET,
                damageType: 'Acid',
                attackerName: ATTACKER,
                hitClause: buildHitConditionClause(PSEUDOPOD_ACTION),
            },
        });
    }

    it('data-lock + arms the INT-scoped te with ability payload and ONE attacker-anchored clock', async () => {
        // Data axis: the Pseudopod row rides the ability-scoped keys and the
        // clause parser carries targetEffectAbility through.
        expect(PSEUDOPOD_ACTION.hit_target_effect).toBe('ability_save_disadvantage');
        expect(PSEUDOPOD_ACTION.hit_target_effect_ability).toBe('int');
        expect(buildHitConditionClause(PSEUDOPOD_ACTION)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Pseudopod',
            targetEffect: 'ability_save_disadvantage',
            targetEffectAbility: 'int',
        });

        await resolveHit();

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            TARGET,
            'ability_save_disadvantage',
            ATTACKER,
            { duration: 'until_start_of_next_turn', ability: 'int' },
        );
        // Ability-row fork guard: the ability payload must NOT mint a second
        // clock — one MA-0016 anchor, MA-0016 byte-shape.
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: ATTACKER,
            targetName: TARGET,
            effects: [{ type: 'remove_target_effect', effectKey: 'ability_save_disadvantage', source: ATTACKER, target: TARGET }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: ATTACKER,
        });
    });

    it('logs a DC-free INT-scoped grant naming the advisory anchor', async () => {
        await resolveHit();

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: TARGET,
            condition: 'Save Disadv (Ability) (INT)',
            reason: `Pseudopod — until the start of ${ATTACKER}'s next turn`,
        }));
        const grantLog = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.type === 'condition' && e.action === 'applied');
        expect(grantLog.note).toContain('(INT saves only)');
        expect(grantLog.note).toContain('advisory');
        expect(grantLog.dc).toBeUndefined();
    });
});
