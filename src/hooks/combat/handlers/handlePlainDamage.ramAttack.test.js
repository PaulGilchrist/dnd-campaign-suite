// @maintained-by-ai: 2026-10-14
// Ram-attack lane ONLY: context.ramActive (Power of the Wilds buff scan) +
// isMelee + resolved applyResult → Prone via maybeApplyRamProne in
// handlePlainDamage.js. Size gate: Large-or-smaller (MA-0553 ladder).
// The monsters.json hit_conditions 'prone' Ram rows (Chimera/Giant Elk/
// Giant Goat) are the separate hitClause lane — hitClause.test.js.
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

const CAMPAIGN = 'test-campaign';

const goblin = (extra = {}) => ({ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13, ...extra });

describe('plain damage ram lane (ramActive → Prone)', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: CAMPAIGN,
        characters: [
            { name: 'TestFighter', computedStats: { armorClass: 16 } },
            { name: 'Goblin', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({ creatures: [goblin()] });
    });

    function baseContext(extra = {}) {
        return { targetName: 'Goblin', damageType: 'slashing', ramActive: true, isMelee: true, ...extra };
    }

    // Drive one ram damage roll through the full createLogDamageAndShow lane.
    async function runRam(contextExtra = {}, { summaryCreatures, prevConditions, applyResult } = {}) {
        if (summaryCreatures) loadCombatSummary.mockResolvedValue({ creatures: summaryCreatures });
        if (prevConditions) {
            getRuntimeValue.mockImplementation((key, prop) =>
                (key === 'Goblin' && prop === 'activeConditions') ? prevConditions : null);
        }
        if (applyResult !== undefined) applyDamageToTarget.mockReturnValue(applyResult);
        await createLogDamageAndShow(deps)({ name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3, context: baseContext(contextExtra) });
    }

    const wroteProne = () => setRuntimeValue.mock.calls.some(([key, prop, value]) =>
        key === 'Goblin' && prop === 'activeConditions' && Array.isArray(value) && value.includes('Prone'));

    // Positive gates: ramActive + isMelee + landed damage + size gate → exactly
    // one Prone write (exact array: proves add, provenance-preserving adds, and
    // the condition log).
    it.each([
        { title: 'NPC target', expected: ['Prone'] },
        { title: 'player target', extra: { type: 'player' }, expected: ['Prone'] },
        { title: 'Large target (gate boundary)', extra: { size: 'Large' }, expected: ['Prone'] },
        { title: 'standing conditions are preserved', prevConditions: ['Ensnaring Strike'], expected: ['Ensnaring Strike', 'Prone'] },
    ])('applies Prone for $title', async ({ extra, prevConditions, expected }) => {
        await runRam({}, { summaryCreatures: [goblin(extra)], prevConditions });

        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', expected, CAMPAIGN);
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            condition: 'Prone',
            reason: 'Power of the Wilds (Ram)',
        }));
    });

    // Negative gates: each row kills one maybeApplyRamProne precondition.
    it.each([
        { title: 'ramActive is false', context: { ramActive: false } },
        { title: 'isMelee is false', context: { isMelee: false } },
        { title: 'target is Huge (size gate)', size: 'Huge' },
        { title: 'target is already Prone (idempotent)', prevConditions: ['Prone'] },
        { title: 'target has lowercase prone (case-insensitive dedupe)', prevConditions: ['prone'] },
        { title: 'applyResult is null (damage did not land)', applyResult: null },
    ])('does not write Prone when $title', async ({ context, size, prevConditions, applyResult }) => {
        await runRam(context, { summaryCreatures: size ? [goblin({ size })] : undefined, prevConditions, applyResult });

        expect(wroteProne()).toBe(false);
    });

    it('writes nothing when the target is not in the combat summary', async () => {
        await runRam({}, { summaryCreatures: [{ name: 'Orc', type: 'npc', ac: 14, currentHp: 15, maxHp: 15 }] });

        expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'activeConditions', expect.anything(), CAMPAIGN);
    });

    // FIXME (source bug, handlePlainDamage.js applyRamProneCondition): the
    // 'applied' condition log fires even when the activeConditions write was
    // skipped because the target was ALREADY prone — repeat ram hits log a
    // false "Prone applied". Fix: move the logEntry/dispatchEvent inside the
    // branches that actually write (or gate on a wroteProne flag).
    it.fails('does not log Prone applied when the target was already prone', async () => {
        await runRam({}, { prevConditions: ['Prone'] });

        expect(wroteProne()).toBe(false);
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            condition: 'Prone',
            reason: 'Power of the Wilds (Ram)',
        }));
    });
});
