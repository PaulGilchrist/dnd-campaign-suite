// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle } from './postCastRiderHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
    createSaveListener: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

describe('postCastRiderHandler.handle', () => {
    let action;
    let playerStats;
    let campaignName;
    let consoleErrorSpy;

    beforeEach(() => {
        campaignName = 'test-campaign';
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        action = {
            name: 'Control Spell',
            automation: {
                saveType: 'WIS',
                type: 'spell',
                condition: 'Charmed or Frightened',
            },
        };

        playerStats = {
            name: 'Caster',
        };

        const usesKey = `postCastRider_${action.name.replace(/\s+/g, '_')}`;

        getRuntimeValue.mockImplementation((_char, key) => {
            if (key === usesKey) return 1;
            return [];
        });

        buildSaveDc.mockReturnValue(15);
        resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
        createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        vi.clearAllMocks();
    });

    function dispatchSaveResult(promptId, success) {
        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId, success },
        }));
    }

    it('returns popup with info message when uses are exhausted', async () => {
        getRuntimeValue.mockReturnValue(0);

        const result = await handle(action, playerStats, campaignName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no uses remaining.`,
            },
        });

        expect(buildSaveDc).not.toHaveBeenCalled();
        expect(resolveTarget).not.toHaveBeenCalled();
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns popup with save prompt and sets up listener when uses are available', async () => {
        const result = await handle(action, playerStats, campaignName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                targetName: 'Enemy',
                description: 'Target Enemy must make a WIS saving throw (DC 15). On a failed save, choose Charmed or Frightened for 1 minute.',
                automation: action.automation,
            },
        });

        expect(buildSaveDc).toHaveBeenCalledWith(action.automation, playerStats);
        expect(resolveTarget).toHaveBeenCalledWith(campaignName, playerStats.name);
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
            targetName: 'Enemy',
            saveType: 'WIS',
            saveDc: 15,
        });
    });

    it('uses "Unknown" as targetName when resolveTarget returns null or missing target.name', async () => {
        resolveTarget.mockResolvedValue(null);

        let result = await handle(action, playerStats, campaignName);
        expect(result.payload.targetName).toBe('Unknown');
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'Unknown',
        }));

        vi.clearAllMocks();
        resolveTarget.mockResolvedValue({});
        createSaveListener.mockReturnValue({ promptId: 'test-prompt-id-2' });

        result = await handle(action, playerStats, campaignName);
        expect(result.payload.targetName).toBe('Unknown');
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'Unknown',
        }));
    });

    it('handles successful save: decrements uses and logs result', async () => {
        await handle(action, playerStats, campaignName);

        dispatchSaveResult('test-prompt-id', true);

        await Promise.resolve();

        expect(setRuntimeValue).toHaveBeenCalledWith(
            playerStats.name,
            'postCastRider_Control_Spell',
            0,
            campaignName,
        );

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'save_result',
            success: true,
            targetName: 'Enemy',
            saveType: 'WIS',
            saveDc: 15,
            rollType: 'save-spell',
        }));
    });

    it('handles failed save: shows condition choice modal and applies chosen condition', async () => {
        getRuntimeValue.mockImplementation((_char, key) => {
            if (key === 'postCastRider_Control_Spell') return 1;
            if (key === 'activeConditions' && _char === 'Enemy') return ['blinded'];
            return [];
        });

        await handle(action, playerStats, campaignName);

        const choiceShowPromise = new Promise(resolve => {
            window.addEventListener('condition-choice-show', resolve, { once: true });
        });

        dispatchSaveResult('test-prompt-id', false);

        const choiceEvent = await choiceShowPromise;
        const choiceDetail = choiceEvent.detail;
        expect(choiceDetail.targetName).toBe('Enemy');
        expect(choiceDetail.conditions).toEqual(['charmed', 'frightened']);

        window.dispatchEvent(new CustomEvent('condition-choice-selected', {
            detail: { promptId: choiceDetail.promptId, condition: 'frightened' },
        }));

        await Promise.resolve();

        expect(setRuntimeValue).toHaveBeenCalledWith(
            playerStats.name,
            'postCastRider_Control_Spell',
            0,
            campaignName,
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Enemy',
            'activeConditions',
            ['blinded', 'frightened'],
            campaignName,
        );

        expect(addExpiration).toHaveBeenCalledWith({ attackerName: playerStats.name, targetName: 'Enemy', effects: [{ type: 'condition', condition: 'frightened' }], campaignName });

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'save_result',
            success: false,
            targetName: 'Enemy',
            description: expect.stringContaining('Frightened'),
            rollType: 'save-spell',
        }));
    });

    it('handles failed save with single condition by auto-applying without choice modal', async () => {
        action.automation.condition = 'Prone';

        const choiceShowSpy = vi.fn();
        window.addEventListener('condition-choice-show', choiceShowSpy);

        await handle(action, playerStats, campaignName);

        dispatchSaveResult('test-prompt-id', false);

        await Promise.resolve();

        expect(choiceShowSpy).not.toHaveBeenCalled();
        window.removeEventListener('condition-choice-show', choiceShowSpy);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Enemy',
            'activeConditions',
            ['prone'],
            campaignName,
        );

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'save_result',
            success: false,
        }));
    });

    it('ignores save-result events with mismatched promptId and removes listener after handling', async () => {
        await handle(action, playerStats, campaignName);

        dispatchSaveResult('wrong-id', true);

        await Promise.resolve();

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();

        // After correct handling, listener should be removed (second dispatch is ignored)
        dispatchSaveResult('test-prompt-id', true);
        await Promise.resolve();
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);

        dispatchSaveResult('test-prompt-id', true);
        await Promise.resolve();
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    });

    it('defaults saveType to WIS when automation.saveType is missing', async () => {
        delete action.automation.saveType;

        const result = await handle(action, playerStats, campaignName);

        expect(result.payload.description).toContain('WIS');
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            saveType: 'WIS',
        }));

        dispatchSaveResult('test-prompt-id', true);

        await Promise.resolve();

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'save_result',
            saveType: 'WIS',
        }));
    });

    it('handles failed save with condition choice skipped: removes listener and applies no condition', async () => {
        getRuntimeValue.mockImplementation((_char, key) => {
            if (key === 'postCastRider_Control_Spell') return 1;
            if (key === 'activeConditions' && _char === 'Enemy') return ['blinded'];
            return [];
        });

        await handle(action, playerStats, campaignName);

        const choiceShowPromise = new Promise(resolve => {
            window.addEventListener('condition-choice-show', resolve, { once: true });
        });

        dispatchSaveResult('test-prompt-id', false);

        const choiceEvent = await choiceShowPromise;
        const choiceDetail = choiceEvent.detail;
        expect(choiceDetail.targetName).toBe('Enemy');
        expect(choiceDetail.conditions).toEqual(['charmed', 'frightened']);

        window.dispatchEvent(new CustomEvent('condition-choice-skipped', {
            detail: { promptId: choiceDetail.promptId },
        }));

        await Promise.resolve();

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            playerStats.name,
            'postCastRider_Control_Spell',
            expect.anything(),
            campaignName,
        );

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Enemy',
            'activeConditions',
            expect.anything(),
            campaignName,
        );

        expect(addExpiration).not.toHaveBeenCalled();

        expect(addEntry).not.toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'save_result',
            success: false,
            targetName: 'Enemy',
        }));
    });

    it('handles addEntry rejection gracefully in all paths without throwing', async () => {
        addEntry.mockRejectedValue(new Error('disk write failed'));

        // Test: initial ability_use log rejection
        const result = await handle(action, playerStats, campaignName);
        expect(result).toEqual({
            type: 'popup',
            payload: expect.objectContaining({
                name: action.name,
                targetName: 'Enemy',
            }),
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[postCastRider] Error:',
            expect.any(Error),
        );

        vi.clearAllMocks();
        addEntry.mockRejectedValue(new Error('disk write failed'));
        createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

        // Test: successful save log rejection
        await handle(action, playerStats, campaignName);
        dispatchSaveResult('test-prompt-id', true);
        await Promise.resolve();
        expect(setRuntimeValue).toHaveBeenCalledWith(
            playerStats.name,
            'postCastRider_Control_Spell',
            0,
            campaignName,
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[postCastRider] Error:',
            expect.any(Error),
        );

        vi.clearAllMocks();
        addEntry.mockRejectedValue(new Error('disk write failed'));
        createSaveListener.mockReturnValue({ promptId: 'test-prompt-id-2' });
        getRuntimeValue.mockImplementation((_char, key) => {
            if (key === 'postCastRider_Control_Spell') return 1;
            if (key === 'activeConditions' && _char === 'Enemy') return ['blinded'];
            return [];
        });

        // Test: failed save log rejection
        await handle(action, playerStats, campaignName);

        const choiceShowPromise = new Promise(resolve => {
            window.addEventListener('condition-choice-show', resolve, { once: true });
        });

        dispatchSaveResult('test-prompt-id-2', false);

        const choiceEvent = await choiceShowPromise;

        window.dispatchEvent(new CustomEvent('condition-choice-selected', {
            detail: { promptId: choiceEvent.detail.promptId, condition: 'charmed' },
        }));

        await Promise.resolve();
        await Promise.resolve();

        expect(setRuntimeValue).toHaveBeenCalledWith(
            playerStats.name,
            'postCastRider_Control_Spell',
            0,
            campaignName,
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[postCastRider] addEntry Error:',
            expect.any(Error),
        );
    });

    it('handles non-array activeConditions by falling back to empty array', async () => {
        getRuntimeValue.mockImplementation((_char, key) => {
            if (key === 'postCastRider_Control_Spell') return 1;
            if (key === 'activeConditions' && _char === 'Enemy') return 'not-an-array';
            return [];
        });

        await handle(action, playerStats, campaignName);

        const choiceShowPromise = new Promise(resolve => {
            window.addEventListener('condition-choice-show', resolve, { once: true });
        });

        dispatchSaveResult('test-prompt-id', false);

        const choiceEvent = await choiceShowPromise;

        window.dispatchEvent(new CustomEvent('condition-choice-selected', {
            detail: { promptId: choiceEvent.detail.promptId, condition: 'charmed' },
        }));

        await Promise.resolve();

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Enemy',
            'activeConditions',
            ['charmed'],
            campaignName,
        );
    });
});
