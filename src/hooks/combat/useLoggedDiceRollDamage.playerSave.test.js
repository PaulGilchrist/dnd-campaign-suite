// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('./useLoggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { hasPotentCantrip, applyMinDamageAdjustment } from './useLoggedDiceRollUtils.js';
import { computeDamageAfterSave, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('Player save damage edge cases', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Ally1', computedStats: { armorClass: 14, saveBonuses: { DEX: 2 } } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        computeDamageAfterSave.mockImplementation((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 10, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [
                { name: 'Ally1', type: 'player', ac: 14, currentHp: 20, maxHp: 20 },
            ],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
        deps.pendingSaves = {};
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    it('sends save prompt and stores in pendingSaves when no special handling', async () => {
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Ally1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(sendSavePrompt).toHaveBeenCalled();
        const promptId = Object.keys(deps.pendingSaves)[0];
        expect(promptId).toBeDefined();
        expect(deps.pendingSaves[promptId].targetName).toBe('Ally1');
        expect(deps.pendingSaves[promptId].rawDamage).toBe(20);
        expect(deps.pendingSaves[promptId].saveDc).toBe(15);
        expect(deps.pendingSaves[promptId].saveType).toBe('DEX');
        expect(deps.pendingSaves[promptId].isAoe).toBeUndefined();
    });

    it('sends save prompt with disadvantage when metamagicHeighten is set', async () => {
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Ally1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            metamagicHeighten: true,
        });

        expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            disadvantage: true,
        }));
    });

    it('includes overchannel context in pendingSaves', async () => {
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Ally1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            overchannelActive: true,
            overchannelUseCount: 2,
            overchannelSpellLevel: 3,
        });

        const promptId = Object.keys(deps.pendingSaves)[0];
        expect(deps.pendingSaves[promptId].overchannelActive).toBe(true);
        expect(deps.pendingSaves[promptId].overchannelUseCount).toBe(2);
        expect(deps.pendingSaves[promptId].overchannelSpellLevel).toBe(3);
    });

    it('includes statusEffects in pendingSaves', async () => {
        const fn = createFn();
        await fn('Acid Splash', '1d6', 4, [4], 0, {
            targetName: 'Ally1',
            damageType: 'acid',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            statusEffects: ['poisoned'],
        });

        const promptId = Object.keys(deps.pendingSaves)[0];
        expect(deps.pendingSaves[promptId].statusEffects).toEqual(['poisoned']);
    });

    it('includes autoDamageSecondaryFormula in pendingSaves', async () => {
        const fn = createFn();
        await fn('Eldritch Blast', '2d10', 10, [6, 4], 0, {
            targetName: 'Ally1',
            damageType: 'force',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            autoDamageSecondaryFormula: '1d10',
            autoDamageSecondaryName: 'Eldritch Blast',
            autoDamageSecondaryDamageType: 'force',
        });

        const promptId = Object.keys(deps.pendingSaves)[0];
        expect(deps.pendingSaves[promptId].autoDamageSecondaryFormula).toBe('1d10');
        expect(deps.pendingSaves[promptId].autoDamageSecondaryName).toBe('Eldritch Blast');
        expect(deps.pendingSaves[promptId].autoDamageSecondaryDamageType).toBe('force');
    });

    it('includes isCantrip in pendingSaves', async () => {
        const fn = createFn();
        await fn('Shocking Grasp', '1d8', 5, [5], 0, {
            targetName: 'Ally1',
            damageType: 'lightning',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            isCantrip: true,
        });

        const promptId = Object.keys(deps.pendingSaves)[0];
        expect(deps.pendingSaves[promptId].isCantrip).toBe(true);
    });

    it('shows waiting popup when sending save prompt', async () => {
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Ally1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            type: 'save-damage',
            waitingForPlayerSave: true,
            rawDamage: 20,
        }));
    });

    it('returns true from handlePlayerSaveDamage when save prompt is sent', async () => {
        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'Ally1',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });
        // The main function should not fall through to handlePlainDamage
        // since handlePlayerSaveDamage returned true
        const logCalls = deps.logEntry.mock.calls.map(c => c[0]);
        const damageEntry = logCalls.find(entry => entry.rollType === 'damage');
        expect(damageEntry).toBeUndefined();
    });

    it('does not prompt for save when target is not a player and not npc (null target)', async () => {
        loadCombatSummary.mockResolvedValue({ creatures: [] });

        const fn = createFn();
        await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
            targetName: 'NonExistent',
            damageType: 'fire',
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
        });

        // Falls through to handlePlainDamage since target is null
        // sendSavePrompt is only called from handlePlayerSaveDamage which returns early for null target
        const savePromptCalls = deps.logEntry.mock.calls.filter(c => c[0].rollType === 'save-prompt');
        expect(savePromptCalls).toHaveLength(0);
    });
});
