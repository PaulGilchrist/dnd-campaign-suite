// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

    beforeEach(() => {
        vi.clearAllMocks();

        campaignName = 'TestCampaign';

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

    function usesKeyFor(name) {
        return `postCastRider_${name.replace(/\s+/g, '_')}`;
    }

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

    it('uses "Unknown" as targetName when resolveTarget returns null or missing target', async () => {
        resolveTarget.mockResolvedValue(null);

        const result = await handle(action, playerStats, campaignName);

        expect(result.payload.targetName).toBe('Unknown');
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'Unknown',
        }));

        vi.clearAllMocks();
        resolveTarget.mockResolvedValue({});

        const result2 = await handle(action, playerStats, campaignName);

        expect(result2.payload.targetName).toBe('Unknown');
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'Unknown',
        }));
    });

    it('handles successful save: decrements uses and logs result', async () => {
        await handle(action, playerStats, campaignName);

        dispatchSaveResult('test-prompt-id', true);

        const usesKey = usesKeyFor(action.name);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            playerStats.name,
            usesKey,
            0,
            campaignName,
        );

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'save_result',
            success: true,
            targetName: 'Enemy',
            saveType: 'WIS',
            saveDc: 15,
        }));
    });

    it('handles failed save: applies first mapped condition and expiration', async () => {
        getRuntimeValue.mockImplementation((_char, key) => {
            if (key === usesKeyFor(action.name)) return 1;
            if (key === 'activeConditions' && _char === 'Enemy') return ['blinded'];
            return [];
        });

        await handle(action, playerStats, campaignName);

        dispatchSaveResult('test-prompt-id', false);

        const usesKey = usesKeyFor(action.name);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            playerStats.name,
            usesKey,
            0,
            campaignName,
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Enemy',
            'activeConditions',
            ['blinded', 'charmed'],
            campaignName,
        );

        expect(addExpiration).toHaveBeenCalledWith(
            playerStats.name,
            'Enemy',
            [{ type: 'condition', condition: 'charmed' }],
            campaignName,
            10,
        );

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'save_result',
            success: false,
            targetName: 'Enemy',
        }));
    });

    it('handles failed save with unmapped condition by lowercasing it', async () => {
        action.automation.condition = 'Prone';

        await handle(action, playerStats, campaignName);

        dispatchSaveResult('test-prompt-id', false);

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

    it('ignores save-result event with mismatched promptId', async () => {
        await handle(action, playerStats, campaignName);

        dispatchSaveResult('wrong-id', true);

        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('defaults saveType to WIS when automation.saveType is missing', async () => {
        delete action.automation.saveType;

        const result = await handle(action, playerStats, campaignName);

        expect(result.payload.description).toContain('WIS');
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            saveType: 'WIS',
        }));

        dispatchSaveResult('test-prompt-id', true);

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'save_result',
            saveType: 'WIS',
        }));

        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_char, key) => {
            if (key === usesKeyFor(action.name)) return 1;
            return [];
        });
        buildSaveDc.mockReturnValue(15);
        resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
        createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });

        await handle(action, playerStats, campaignName);

        dispatchSaveResult('test-prompt-id', false);

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            success: false,
            saveType: 'WIS',
        }));
    });

    it('removes save-result event listener after handling', async () => {
        await handle(action, playerStats, campaignName);

        dispatchSaveResult('test-prompt-id', true);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);

        dispatchSaveResult('test-prompt-id', true);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    });

});
