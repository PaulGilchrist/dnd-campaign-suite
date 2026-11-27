// @maintained-by-ai 2026-11-26
// Per-target re-arm breadth seam for Death Strike (see hitResolution.death-strike
// and useLoggedDiceRollDamage.death-strike headers, which point here for it):
// consumption must evict ONLY this target's death_strike row — a sibling effect
// on the same target and a death_strike armed on another target both survive for
// later hits. The save-face happy paths (CON prompt → CLA-080 delta leg, log,
// popup, base-only success, incomplete-te) run the identical createLogDamageAndShow
// entry and live authoritatively in useLoggedDiceRollDamage.death-strike.test.js.
// This file adds the success-verdict audit row, which that suite does not assert.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    // No crits roll in this suite — identity is enough to satisfy the lane's import.
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

    function cleanedTargetEffects() {
        const cleanupCall = setRuntimeValue.mock.calls.find(
            (call) => call[0] === 'campaign' && call[1] === 'targetEffects'
        );
        expect(cleanupCall).toBeDefined();
        return cleanupCall[2];
    }

    // Runs a hit through the full damage lane and answers the death-strike
    // save prompt once the lane has actually dispatched it, using the exact
    // detail shape SavePromptModal emits (saveBonus/total — never bare `bonus`).
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

    it('save success logs its verdict: prompt names its producer and exactly one save_result row lands (no silent eviction)', async () => {
        armCampaignEffects({ effect: 'death_strike', target: 'Goblin', saveDc: 15, saveType: 'CON' });

        await hitThenSave({ success: true, roll: 18, total: 21, saveBonus: 3 });

        // The prompt names its producer (Source: Death Strike) on the modal —
        // sibling prompts (Shield Bash et al.) never render nameless.
        expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            targetName: 'Goblin',
            sourceName: 'Death Strike',
        }));

        const saveRows = deps.logEntry.mock.calls
            .map((call) => call[0])
            .filter((entry) => entry?.type === 'save_result');
        expect(saveRows).toHaveLength(1);
        expect(saveRows[0]).toMatchObject({
            characterName: 'TestFighter',
            targetName: 'Goblin',
            saveDc: 15,
            saveType: 'CON',
            success: true,
            roll: 18,
            total: 21,
            saveBonus: 3,
            description: expect.stringContaining('Death Strike'),
        });
        expect(saveRows[0].description).toContain('not doubled');
    });

    it('re-arms for the next hit: consumes only this target death_strike, keeps sibling effects and other-target strikes', async () => {
        armCampaignEffects(
            { effect: 'death_strike', target: 'Goblin', saveDc: 15, saveType: 'CON' },
            { effect: 'no_healing', target: 'Goblin', source: 'Slaad' },
            { effect: 'death_strike', target: 'Other', saveDc: 15, saveType: 'CON' },
        );

        await hitThenSave({ success: false, roll: 5, total: 7, saveBonus: 2 });

        expect(cleanedTargetEffects()).toEqual([
            { effect: 'no_healing', target: 'Goblin', source: 'Slaad' },
            { effect: 'death_strike', target: 'Other', saveDc: 15, saveType: 'CON' },
        ]);
    });
});
