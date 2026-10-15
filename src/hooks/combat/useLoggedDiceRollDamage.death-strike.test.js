// @maintained-by-ai: 2026-10-14
// Authoritative save-face death-strike suite: createLogDamageAndShow → plain lane →
// handlePlainDamage.resolveDeathStrike (CON prompt → save-result → CLA-080 delta leg,
// log, popup, te consumption). Attack-side producer lives in hitResolution;
// per-target re-arm breadth lives in handlePlainDamage.deathStrike.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    // No crits roll in this suite — identity is enough to satisfy the lane's import.
    formatDamageFormula: vi.fn((formula) => formula),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    computeDamageAfterEvasion: vi.fn((total, success, _dcSuccess, evasion) => (evasion && success ? 0 : (success ? Math.floor(total / 2) : total))),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

const PROMPT_ID = 'test-guid-1234';
const HIT = {
    name: 'Greatsword',
    formula: '2d6+3',
    total: 10,
    rolls: [4, 3],
    modifier: 3,
    context: { targetName: 'Goblin', damageType: 'slashing' },
};

describe('Death Strike save face (plain damage lane)', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        getRuntimeValue.mockReset().mockReturnValue(null);
        setRuntimeValue.mockClear();
        applyDamageToTarget.mockReset().mockReturnValue({ finalDamage: 10, newHp: 3, damageReduced: false });
        sendSavePrompt.mockClear();
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function armDeathStrike(...tes) {
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
        expect(cleanupCall[2].some((te) => te.effect === 'death_strike' && te.target === 'Goblin')).toBe(false);
        return cleanupCall[2];
    }

    // Runs a hit through the lane and answers the death-strike save prompt once
    // the lane has actually dispatched it (bounded poll — no fixed sleeps).
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

    describe('death strike save failure', () => {
        it('prompts CON save, pays the CLA-080 delta legs, consumes only this target te', async () => {
            armDeathStrike(
                { effect: 'death_strike', target: 'Goblin', saveDc: 15, saveType: 'CON' },
                { effect: 'no_healing', target: 'Goblin', source: 'Slaad' },
            );

            await hitThenSave({ success: false, roll: 5, bonus: 3 });

            expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                promptId: PROMPT_ID,
                targetName: 'Goblin',
                saveType: 'CON',
                saveDc: 15,
                dcSuccess: false,
                advantage: false,
                disadvantage: false,
            }));

            // CLA-080: base 10 applied eagerly; failed save pays ONLY the +10
            // delta — two legs summing to 20 = 2× base (never 10+20=30).
            expect(slashLegs()).toEqual([10, 10]);

            expect(cleanedTargetEffects()).toEqual([{ effect: 'no_healing', target: 'Goblin', source: 'Slaad' }]);
        });

        it('logs save-damage entry with full death strike context', async () => {
            armDeathStrike({ effect: 'death_strike', target: 'Goblin', saveDc: 15, saveType: 'CON' });

            await hitThenSave({ success: false, roll: 5, bonus: 3 });

            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'roll',
                rollType: 'save-damage',
                name: 'Death Strike',
                formula: '+1× 2d6+3',
                total: 10,
                damageType: 'slashing',
                targetName: 'Goblin',
                saveType: 'CON',
                saveDc: 15,
                saveResult: 'failure',
                saveRoll: 5,
                saveBonus: 3,
                saveRawRolls: [5],
                finalDamage: null,
                description: expect.stringContaining('damage doubled (total 20)'),
                note: 'death_strike_double_delta',
            }));
        });

        it('sets popup html with death strike details on failure', async () => {
            armDeathStrike({ effect: 'death_strike', target: 'Goblin', saveDc: 15, saveType: 'CON' });

            await hitThenSave({ success: false, roll: 5, bonus: 3 });

            const popupUpdater = deps.setPopupHtml.mock.calls.find((call) => typeof call[0] === 'function');
            expect(popupUpdater).toBeDefined();
            expect(popupUpdater[0]({})).toMatchObject({
                deathStrikeDoubled: true,
                deathStrikeSaveRoll: 5,
                deathStrikeSaveBonus: 3,
                deathStrikeSaveDc: 15,
                deathStrikeFinalDamage: 10,
            });
        });
    });

    describe('death strike save success', () => {
        it('base leg only, no delta log, no doubled popup updater, te consumed', async () => {
            armDeathStrike({ effect: 'death_strike', target: 'Goblin', saveDc: 15, saveType: 'CON' });

            await hitThenSave({ success: true, roll: 18, bonus: 3 });

            // hpΔ = 1× — only the eager base leg.
            expect(slashLegs()).toEqual([10]);
            expect(deps.logEntry.mock.calls.some((call) => call[0]?.rollType === 'save-damage')).toBe(false);
            expect(deps.setPopupHtml.mock.calls.some((call) => typeof call[0] === 'function')).toBe(false);
            expect(cleanedTargetEffects()).toEqual([]);
        });
    });

    describe('death strike with missing fields', () => {
        it('incomplete te (missing saveDc or saveType): no prompt, base only, still consumed', async () => {
            for (const te of [
                { effect: 'death_strike', target: 'Goblin', saveType: 'CON' },
                { effect: 'death_strike', target: 'Goblin', saveDc: 15 },
            ]) {
                sendSavePrompt.mockClear();
                applyDamageToTarget.mockClear();
                setRuntimeValue.mockClear();
                armDeathStrike(te);

                await createLogDamageAndShow(deps)(HIT);

                expect(sendSavePrompt).not.toHaveBeenCalled();
                expect(slashLegs()).toEqual([10]);
                const cleaned = cleanedTargetEffects();
                expect(cleaned).toEqual([]);
            }
        });
    });
});
