// @maintained-by-ai: 2026-10-14
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
    sendAoePlayerSends: vi.fn(),
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
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';

const PROMPT_ID = 'test-guid-1234';
const HIT = {
    name: 'Longsword',
    formula: '1d8+3',
    total: 8,
    rolls: [5, 3],
    modifier: 3,
    context: { targetName: 'Goblin', damageType: 'slashing' },
};

describe('Plain damage death strike', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'TestFighter' }, { name: 'Goblin' }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        getRuntimeValue.mockReset().mockReturnValue(null);
        setRuntimeValue.mockClear();
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        sendSavePrompt.mockClear();
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 10, maxHp: 10 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function armCampaignEffects(...tes) {
        getRuntimeValue.mockImplementation((key, prop) =>
            (key === 'campaign' && prop === 'targetEffects') ? tes : null);
    }

    function slashLegs() {
        return applyDamageToTarget.mock.calls
            .filter((call) => call[1] === 'Goblin' && JSON.stringify(call[3]) === JSON.stringify(['slashing']))
            .map((call) => call[2]);
    }

    function cleanedTargetEffects() {
        const cleanupCall = setRuntimeValue.mock.calls.find(
            (call) => call[0] === 'campaign' && call[1] === 'targetEffects'
        );
        expect(cleanupCall).toBeDefined();
        return cleanupCall[2];
    }

    // Runs a hit through the full damage lane and answers the death-strike
    // save prompt once the lane has actually dispatched it.
    async function hitThenSave(saveResult) {
        const promise = createLogDamageAndShow(deps)(HIT);
        for (let i = 0; i < 50 && sendSavePrompt.mock.calls.length === 0; i++) {
            await new Promise((resolve) => setTimeout(resolve, 2));
        }
        expect(sendSavePrompt).toHaveBeenCalled();
        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId: PROMPT_ID, rawRolls: [saveResult.roll], ...saveResult },
        }));
        await promise;
    }

    it('failed save: prompts, pays only the extra-half delta, logs, updates popup (CLA-080)', async () => {
        armCampaignEffects({ effect: 'death_strike', target: 'Goblin', saveDc: 15, saveType: 'strength' });
        applyDamageToTarget.mockReturnValue({ finalDamage: 14, newHp: -4, damageReduced: false });

        await hitThenSave({ success: false, roll: 5, bonus: 2 });

        expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            promptId: PROMPT_ID,
            targetName: 'Goblin',
            saveType: 'strength',
            saveDc: 15,
            dcSuccess: false,
            advantage: false,
            disadvantage: false,
        }));

        // CLA-080: base 8 applied eagerly, failed save pays ONLY the +8 delta
        // — two legs summing to 16 = 2× base (never a single extra 16 = 3×).
        expect(slashLegs()).toEqual([8, 8]);

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'roll',
            rollType: 'save-damage',
            name: 'Death Strike',
            formula: '+1× 1d8+3',
            total: 8,
            saveType: 'strength',
            saveDc: 15,
            saveResult: 'failure',
            saveRoll: 5,
            saveBonus: 2,
            description: expect.stringContaining('damage doubled (total 16)'),
            note: 'death_strike_double_delta',
        }));

        const popupUpdater = deps.setPopupHtml.mock.calls.find((call) => typeof call[0] === 'function');
        expect(popupUpdater).toBeDefined();
        expect(popupUpdater[0]({})).toMatchObject({
            deathStrikeDoubled: true,
            deathStrikeSaveRoll: 5,
            deathStrikeSaveBonus: 2,
            deathStrikeSaveDc: 15,
            deathStrikeFinalDamage: 14,
        });
    });

    it('save success: base damage only, no delta log, no doubled popup, effect consumed', async () => {
        armCampaignEffects({ effect: 'death_strike', target: 'Goblin', saveDc: 15, saveType: 'strength' });

        await hitThenSave({ success: true, roll: 18, bonus: 3 });

        expect(slashLegs()).toEqual([8]);
        expect(deps.logEntry.mock.calls.some((call) => call[0]?.rollType === 'save-damage')).toBe(false);
        expect(deps.setPopupHtml.mock.calls.some((call) => typeof call[0] === 'function')).toBe(false);
        expect(cleanedTargetEffects()).toEqual([]);
    });

    it('re-arms for the next hit: consumes only this target death_strike, keeps other effects', async () => {
        armCampaignEffects(
            { effect: 'death_strike', target: 'Goblin', saveDc: 15, saveType: 'strength' },
            { effect: 'no_healing', target: 'Goblin', source: 'Slaad' },
            { effect: 'death_strike', target: 'Other', saveDc: 15, saveType: 'strength' },
        );

        await hitThenSave({ success: false, roll: 5, bonus: 2 });

        expect(cleanedTargetEffects()).toEqual([
            { effect: 'no_healing', target: 'Goblin', source: 'Slaad' },
            { effect: 'death_strike', target: 'Other', saveDc: 15, saveType: 'strength' },
        ]);
    });

    it('incomplete death_strike effect (missing saveDc or saveType): no prompt, no delta, still consumed', async () => {
        for (const te of [
            { effect: 'death_strike', target: 'Goblin', saveType: 'strength' },
            { effect: 'death_strike', target: 'Goblin', saveDc: 15 },
        ]) {
            sendSavePrompt.mockClear();
            applyDamageToTarget.mockClear();
            setRuntimeValue.mockClear();
            armCampaignEffects(te);

            await createLogDamageAndShow(deps)(HIT);

            expect(sendSavePrompt).not.toHaveBeenCalled();
            expect(slashLegs()).toEqual([8]);
            expect(cleanedTargetEffects()).toEqual([]);
        }
    });
});
