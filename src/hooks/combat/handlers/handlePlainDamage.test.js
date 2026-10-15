// @maintained-by-ai: 2026-10-14
// Plain-damage BASE lane: core dispatch (entry → applyDamageToTarget → combined
// damage-roll log → hp_change essentials + primary-leg invisibility), threshold
// stamping, crit log formatting, storeDamageLastAttack, and the ray-of-enfeeble
// reduction seam. Popup field passthrough lives in handlePlainDamage.popupData.test.js,
// HP-effect writes in handlePlainDamage.hpEffects.test.js, secondary/rider families
// in their own handlePlainDamage.<lane>.test.js siblings.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    parseConstant: vi.fn(),
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

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { addEntry } from '../../../services/ui/logService.js';
import { endInvisibilityOnHostileAction } from '../../../services/rules/features/invisibilityService.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

describe('Plain damage core flow', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'TestFighter' }, { name: 'Goblin' }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((key) => (key === 'campaign' ? [] : null));
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
    });

    // One plain longsword hit at the defaults; ctx overrides target one lane seam.
    function attack(ctx = {}, argOverrides = {}) {
        return createLogDamageAndShow(deps)({
            name: 'Longsword', formula: '1d8+3', total: 8, rolls: [5, 3], modifier: 3,
            context: { targetName: 'Goblin', damageType: 'slashing', ...ctx },
            ...argOverrides,
        });
    }

    const hpCall = () => addEntry.mock.calls.find((c) => c[1]?.type === 'hp_change');
    const logRow = () => deps.logEntry.mock.calls[0][0];
    const lastAttackWrites = () => setRuntimeValue.mock.calls.filter((c) => c[1] === 'lastAttack');

    it('applies damage, logs the combined damage-roll row, and ends invisibility', async () => {
        await attack();

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 8, ['slashing'], {
            campaignName: 'test-campaign',
            characters: expect.any(Array),
            ignoreResistance: false,
            attackerName: 'TestFighter',
            suppressHpLog: true,
        });
        expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestFighter', 'test-campaign');

        expect(logRow()).toMatchObject({
            type: 'roll',
            rollType: 'damage',
            name: 'Longsword',
            formula: '1d8+3',
            rolls: [5, 3],
            total: 8,
            finalDamage: 8,
            targetName: 'Goblin',
            damageType: 'slashing',
            isCrit: false,
            note: 'combined_damage_roll',
            gwfApplied: false,
            gwfOriginalRolls: null,
            gwfDisplayRolls: [5, 3],
            rayOfEnfeebleReduction: 0,
            rayOfEnfeebleRoll: null,
            weakeningBreathReduction: 0,
            weakeningBreathRoll: null,
            resistanceReduction: 0,
            resistanceRoll: null,
        });
    });

    it('logs an hp_change entry with delta, HP truth, and damage breakdown', async () => {
        await attack();

        const call = hpCall();
        expect(call[0]).toBe('test-campaign');
        expect(call[1]).toMatchObject({
            targetName: 'Goblin',
            delta: -8,
            currentHp: 5,
            maxHp: 13,
            isHealing: false,
            isUnconscious: false,
            damageBreakdown: [expect.objectContaining({ damageType: 'slashing', amount: 8 })],
        });
    });

    // Thresholds derive from applyResult + combatSummary (npc victim):
    // oldHp = newHp + applied damage, maxHp = 13 (half = 6).
    describe('threshold tracking', () => {
        it.each([
            ['bloodied', { finalDamage: 6, newHp: 4, damageReduced: false }, 'bloodied'],
            ['dead', { finalDamage: 0, newHp: 0, damageReduced: true }, 'dead'],
            ['no crossing', { finalDamage: 3, newHp: 10, damageReduced: false }, undefined],
        ])('stamps %s on the hp_change entry', async (_label, result, threshold) => {
            applyDamageToTarget.mockReturnValue(result);
            await attack();
            expect(hpCall()[1].threshold).toBe(threshold);
        });
    });

    it('doubles the formula and stamps isCrit on the log row for auto-crits', async () => {
        await attack({ isAutoCrit: true });
        expect(logRow().isCrit).toBe(true);
        expect(logRow().formula).toContain('*2');
    });

    describe('lastAttack storage', () => {
        it('stores merged damage data into the campaign lastAttack record', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') return { hit: true, otherField: 'keep' };
                return key === 'campaign' ? [] : null;
            });

            await attack({ attackerName: 'TestFighter', attackName: 'Longsword' });

            const writes = lastAttackWrites();
            expect(writes).toHaveLength(1);
            expect(writes[0][0]).toBe('campaign');
            expect(writes[0][2]).toMatchObject({
                hit: true,
                otherField: 'keep',
                attackerName: 'TestFighter',
                targetName: 'Goblin',
                attackName: 'Longsword',
                rolls: [5, 3],
                primaryDamageType: 'slashing',
                damageTypes: ['slashing'],
                damageApplied: true,
            });
            expect(writes[0][3]).toBe('test-campaign');
        });

        it.each([
            ['rolls absent', {}, { rolls: null }],
            ['damageType absent', { damageType: undefined }, {}],
        ])('skips storage when %s', async (_label, ctx, argOverrides) => {
            await attack(ctx, argOverrides);
            expect(lastAttackWrites()).toHaveLength(0);
        });
    });

    it('rolls the ray-of-enfeeble 1d8 reduction and subtracts it from applied damage', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') {
                return [{ target: 'TestFighter', effect: 'ray_of_enfeeble_debuff' }];
            }
            return key === 'campaign' ? [] : null;
        });
        rollExpression.mockReturnValueOnce({ total: 5, rolls: [5], modifier: 0 });
        applyDamageToTarget.mockReturnValue({ finalDamage: 3, newHp: 10, damageReduced: false });

        await attack();

        expect(rollExpression).toHaveBeenCalledWith('1d8');
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 3, ['slashing'], expect.any(Object));
        expect(logRow()).toMatchObject({
            rayOfEnfeebleReduction: 5,
            rayOfEnfeebleRoll: 5,
            finalDamage: 3,
        });
    });
});
