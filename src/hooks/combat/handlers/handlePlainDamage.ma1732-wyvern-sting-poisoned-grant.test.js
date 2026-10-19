// @maintained-by-ai
// MA-1732 grant leg: Wyvern "Sting" poisoned rider. One-field DATA fix
// hit_conditions:["poisoned"] (MA-1723 Winter Wolf / MA-1726 Wolf lane,
// Ettercap byte-twin) arms buildHitConditionClause →
// handlePlainDamage.maybeApplyHitClause → applyHitClauseConditions (:642):
// poisoned lands on the victim's activeConditions + meta.source + a
// condition-applied log on every resolved hit. No escape DC, no expiry clock
// on the pure hit_conditions lane (MA-1541/MA-1723 precedent) — the prose
// "until the start of the wyvern's next turn" anchor is the recorded
// advisory residual of this lane.
//
// handlers family map / cited owners (never duplicated here):
// - handlePlainDamage.test.js + .multiTarget.test.js — base damage resolution
//   and multi-target iteration own the resolved-hit plumbing.
// - handlePlainDamage.hitClause.test.js — generic MA-0010 lane owner: grant
//   payload + provenance meta + reason bytes (:304, poisoned DC-less rows
//   :259/:264/:268), already-active dedupe (:393), Large-or-smaller size
//   ladder incl. Huge refusal and 'Medium or Small' pass (:403), clause-
//   absent zero-write (:366), unresolved-hit zero-write (:381), PFEG ward
//   split (:475).
// - MonsterAction.ma1732-wyvern-sting-hit-conditions.test.jsx — data owner:
//   Sting row bytes + clause fingerprint.
// Ticket residue held here: the real wyvern row's grant leg exact write/log
// bytes, the no-DC / no-clock legs, and a faithful-store zero-write control.
//
// old→new: grant+meta+no-DC+log (old 1-3) → test 1 (exact bytes);
// dedupe (old 4) → cited hitClause.test.js:393, removed;
// clause-absent control (old 5) → test 2 (#934 state survives);
// Huge-gate (old 6) → cited hitClause.test.js:403, removed.
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
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(() => false),
    hasGreatWeaponFighting: vi.fn(() => false),
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
    hasPotentCantrip: vi.fn(() => false),
    isMagicMissileImmune: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(() => false),
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
    hasBardicInspirationOffense: vi.fn(() => false),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(() => false),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import { registerTargetEffect } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import { buildHitConditionClause } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const STING = monsters.find((m) => m.index === 'wyvern').actions.find((a) => a.name === 'Sting');

describe('MA-1732 Wyvern Sting poisoned grant leg', () => {
    const deps = {
        characterName: 'Wyvern 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Wyvern 1', computedStats: { armorClass: 13 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 11, newHp: 987, damageReduced: false });
        // Medium-or-Small victim passes the family-wide Large gate (byte-
        // identical to MA-1723); ladder itself owned by hitClause.test.js:403.
        loadCombatSummary.mockResolvedValue({
            creatures: [
                { name: 'Bandit 1', type: 'player', size: 'Medium or Small', ac: 12, currentHp: 11, maxHp: 11 },
                { name: 'Wyvern 1', type: 'npc', size: 'Large', ac: 13, currentHp: 110, maxHp: 110 },
            ],
        });
    });

    function stingRoll(context) {
        return { name: 'Sting', formula: '2d6 + 4', total: 11, rolls: [4, 5], modifier: 4, context };
    }

    function hitContext(extra = {}) {
        return {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Wyvern 1',
            hitClause: buildHitConditionClause(STING),
            ...extra,
        };
    }

    it('resolved Sting hit grants Poisoned — exact write pair, wyvern-source meta with no escape DC, no expiry clock, one condition log byte', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn(stingRoll(hitContext()));

        const condWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions');
        expect(condWrites).toEqual([['Bandit 1', 'activeConditions', ['poisoned'], 'test-campaign']]);

        // Deep-equal payload: dc/ability keys must be ABSENT (pure hit_conditions lane).
        const metaWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditionMeta');
        expect(metaWrites).toEqual([['Bandit 1', 'activeConditionMeta', { poisoned: { source: 'Wyvern 1' } }, 'test-campaign']]);

        expect(addExpiration).not.toHaveBeenCalled();
        expect(registerTargetEffect).not.toHaveBeenCalled();

        const conditionLogs = deps.logEntry.mock.calls.map(c => c[0]).filter(e => e.type === 'condition');
        expect(conditionLogs).toEqual([expect.objectContaining({
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Poisoned',
            reason: 'Sting (escape DC —)',
            note: null,
        })]);
    });

    it('control: no hitClause armed (plain attack / miss leg) — zero clause writes and pre-existing Poisoned survives byte-identical', async () => {
        getRuntimeValue.mockImplementation((name, prop) => {
            if (name !== 'Bandit 1') return null;
            if (prop === 'activeConditions') return ['poisoned'];
            if (prop === 'activeConditionMeta') return { poisoned: { source: 'Wyvern 1' } };
            return null;
        });
        const fn = createLogDamageAndShow(deps);
        await fn(stingRoll({ targetName: 'Bandit 1', damageType: 'Piercing', attackerName: 'Wyvern 1' }));

        // Base-lane writes (currentHitPoints/hpEffects + campaign lastAttack lanes,
        // owned by handlePlainDamage.test.js) may fire on any resolved hit; the
        // clause lane keys must stay untouched so stored Poisoned survives.
        expect(setRuntimeValue.mock.calls.filter(c =>
            c[1] === 'activeConditions' || c[1] === 'activeConditionMeta')).toEqual([]);
        expect(deps.logEntry.mock.calls.map(c => c[0]).filter(e => e.type === 'condition')).toHaveLength(0);
    });
});
