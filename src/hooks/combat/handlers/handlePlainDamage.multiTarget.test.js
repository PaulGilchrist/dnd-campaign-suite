// @maintained-by-ai
// Lane: handlePlainDamage — MULTI-TARGET ITERATION owner (#789 exact-order precedent).
// Module under test: src/hooks/combat/handlers/handlePlainDamage.js (reached via
// createLogDamageAndShow, src/hooks/combat/useLoggedDiceRollDamage.js). NOT
// services/automation/handlers/combat/multiTargetHandler.js — the #880 damage-swallow
// note lives there, a different module.
// Family map (from #940 header): .hitClause = generic MA-0010 grant owner (:304/:393/:403/:366/:381/:475);
// .test.js = base damage resolution (currentHitPoints :1147, lastAttack :477); .ma1732 = ticket #940
// closed (2 tests); .popupData owns the single-target apply payload bytes (:579) and twin/multi popup
// rendering bytes (queued NEXT). Census here = ITERATION semantics only: fan-out order, exact per-target
// apply payloads and write counts, one log + one popup write per target, dedupe of non-distinct
// follow-ups, honest zero-write for missing targets and failed applies. Per-target internals (resistance,
// interception, hp writes) belong to the base lane, not here.
// Old -> new: 9 -> 3. Census folds old apply-arg-bytes + log-bytes + popup-bytes tests; skip table
// (it.each, #936 fold precedent) collapses twin==primary, multi==primary, twin/multi-not-found, and the
// two mixed dedupe rows; failed-apply continuation is new (partial-failure honesty, #934).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula, rolls, isCrit) => {
        if (!isCrit) return formula;
        const parsed = formula.match(/^(\d+)?d(\d+)((?:[+-]\d+)+)?$/i);
        if (!parsed) return formula;
        const count = parsed[1] || 1;
        const sides = parsed[2];
        const modifierStr = parsed[3];
        let modifier = 0;
        if (modifierStr) {
            const segments = modifierStr.match(/([+-]\d+)/g);
            for (const seg of segments) { modifier += parseInt(seg, 10); }
        }
        const dicePart = count === 1 ? `d${sides}` : `${count}d${sides}`;
        const rollStr = rolls && rolls.length > 0 ? ` (${rolls.join(', ')})` : '';
        let result = `${dicePart}*2${rollStr}`;
        if (modifier > 0) result += `+${modifier}`;
        else if (modifier < 0) result += `${modifier}`;
        return result;
    }),
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
    readAoeContext: vi.fn(() => null),
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

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(() => false),
    getBardicInspirationDieSize: vi.fn(() => 0),
    getBardicInspirationDieSizeFromClass: vi.fn(() => 0),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(() => false),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(() => 0),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('handlePlainDamage — multi-target fan-out iteration', () => {
    const roster = {
        creatures: [
            { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
            { name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 },
            { name: 'Skeleton', type: 'npc', ac: 13, currentHp: 12, maxHp: 12 },
        ],
    };
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [
            {
                name: 'TestFighter',
                computedStats: {
                    armorClass: 16,
                    characterAdvancement: [{ name: 'Sentinel' }],
                },
            },
            { name: 'Goblin', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        getRuntimeValue.mockReset().mockImplementation((key) => (key === 'campaign' ? [] : null));
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 7, newHp: 6, damageReduced: false });
        loadCombatSummary.mockReset().mockResolvedValue(roster);
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    const spell = (context) => ({ name: 'Magic Missile', formula: '4d4+2', total: 10, rolls: [3, 2, 3, 2], modifier: 2, context });
    const applyTargetNames = () => applyDamageToTarget.mock.calls.map(([, targetName]) => targetName);
    const logShapes = () => deps.logEntry.mock.calls.map(([entry]) => ({ name: entry.name, targetName: entry.targetName, note: entry.note }));
    const finalPopup = () => deps.setPopupHtml.mock.calls.reduce((acc, [arg]) => (typeof arg === 'function' ? arg(acc) : arg), {});

    it('fans full damage to primary → twin → multi: exact per-target apply payloads, one authored-order log and popup write each', async () => {
        applyDamageToTarget
            .mockReturnValueOnce({ finalDamage: 8, newHp: 5, damageReduced: false })
            .mockReturnValueOnce({ finalDamage: 5, newHp: 10, damageReduced: false })
            .mockReturnValueOnce({ finalDamage: 6, newHp: 8, damageReduced: false });

        await createLogDamageAndShow(deps)(spell({ targetName: 'Goblin', damageType: 'force', metamagicTwinTarget: 'Orc', multiTarget: 'Skeleton' }));

        expect(applyDamageToTarget).toHaveBeenCalledTimes(3);
        expect(applyDamageToTarget).toHaveBeenNthCalledWith(1, roster, 'Goblin', 10, ['force'], { campaignName: 'test-campaign', characters: deps.characters, ignoreResistance: false, attackerName: 'TestFighter', suppressHpLog: true });
        expect(applyDamageToTarget).toHaveBeenNthCalledWith(2, roster, 'Orc', 10, ['force'], { campaignName: 'test-campaign', characters: deps.characters, ignoreResistance: false, attackerName: 'TestFighter' });
        expect(applyDamageToTarget).toHaveBeenNthCalledWith(3, roster, 'Skeleton', 10, ['force'], { campaignName: 'test-campaign', characters: null, ignoreResistance: false, attackerName: 'TestFighter' });

        expect(logShapes()).toEqual([
            { name: 'Magic Missile', targetName: 'Goblin', note: 'combined_damage_roll' },
            { name: 'Magic Missile (Twinned)', targetName: 'Orc', note: 'twin_damage_roll_before_apply' },
            { name: 'Magic Missile (Words of Creation)', targetName: 'Skeleton', note: 'multi_damage_roll_before_apply' },
        ]);

        expect(deps.setPopupHtml).toHaveBeenCalledTimes(3);
        // Multi is processed after twin and overwrites the shared twin* popup fields — last write wins.
        expect(finalPopup()).toMatchObject({ twinTargetName: 'Skeleton', twinFinalDamage: 6, twinTargetCurrentHp: 8 });
    });

    it('continues the fan-out when a follow-up apply fails — remaining target still takes damage and its popup fields land', async () => {
        applyDamageToTarget.mockImplementation((_summary, targetName) => targetName === 'Orc' ? null : { finalDamage: 7, newHp: 6, damageReduced: false });

        await createLogDamageAndShow(deps)(spell({ targetName: 'Goblin', damageType: 'force', metamagicTwinTarget: 'Orc', multiTarget: 'Skeleton' }));

        expect(applyTargetNames()).toEqual(['Goblin', 'Orc', 'Skeleton']);
        expect(logShapes().map((entry) => entry.targetName)).toEqual(['Goblin', 'Orc', 'Skeleton']);
        expect(finalPopup()).toMatchObject({ twinTargetName: 'Skeleton', twinFinalDamage: 7 });
    });

    // Follow-up handlers run AFTER the primary's log (:1244 log → :1273 follow-ups) and each
    // logs exactly when it applies, so log target names must mirror the apply target names 1:1.
    const followupContexts = [
        { label: 'twin equals primary', context: { metamagicTwinTarget: 'Goblin' }, expected: ['Goblin'] },
        { label: 'multi equals primary', context: { multiTarget: 'Goblin' }, expected: ['Goblin'] },
        { label: 'twin is not in the roster', context: { metamagicTwinTarget: 'NonExistent' }, expected: ['Goblin'] },
        { label: 'multi is not in the roster', context: { multiTarget: 'NonExistent' }, expected: ['Goblin'] },
        { label: 'multi equals primary while twin is distinct', context: { metamagicTwinTarget: 'Orc', multiTarget: 'Goblin' }, expected: ['Goblin', 'Orc'] },
        { label: 'twin equals primary while multi is distinct', context: { metamagicTwinTarget: 'Goblin', multiTarget: 'Orc' }, expected: ['Goblin', 'Orc'] },
    ];

    it.each(followupContexts)('applies and logs damage to $expected only when $label — skipped follow-ups get zero writes and zero logs', async ({ context, expected }) => {
        await createLogDamageAndShow(deps)(spell({ targetName: 'Goblin', damageType: 'force', ...context }));

        expect(applyTargetNames()).toEqual(expected);
        expect(logShapes().map((entry) => entry.targetName)).toEqual(expected);
    });
});
