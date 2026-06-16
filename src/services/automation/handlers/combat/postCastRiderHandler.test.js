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
    let campaignName = 'TestCampaign';
    let mapName = 'TestMap';

    beforeEach(() => {
        vi.clearAllMocks();

        action = {
            name: 'Control Spell',
            automation: {
                saveType: 'WIS',
                type: 'spell',
                condition: 'Charmed or Frightened'
            }
        };

        playerStats = {
            name: 'Caster',
        };

        // Default mocks
        getRuntimeValue.mockImplementation((char, key) => {
            if (key === `postCastRider_${action.name.replace(/\s+/g, '_')}`) return 1;
            return null;
        });
        buildSaveDc.mockReturnValue(15);
        resolveTarget.mockResolvedValue({ target: { name: 'Enemy' } });
        createSaveListener.mockReturnValue({ promptId: 'test-prompt-id' });
    });

    it('should return popup when uses are exhausted', async () => {
        getRuntimeValue.mockReturnValue(0);

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no uses remaining.`,
            },
        });
        expect(buildSaveDc).not.toHaveBeenCalled();
    });

    it('should return popup and setup listener when uses are available', async () => {
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                targetName: 'Enemy',
                description: `Target Enemy must make a WIS saving throw (DC 15). On a failed save, choose Charmed or Frightened for 1 minute.`,
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
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            promptId: 'test-prompt-id'
        }));
    });

    it('should handle unknown target name gracefully', async () => {
        resolveTarget.mockResolvedValue(null);

        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.targetName).toBe('Unknown');
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            targetName: 'Unknown',
        }));
    });

    it('should handle successful save result', async () => {
        await handle(action, playerStats, campaignName, mapName);

        // Simulate the custom event
        window.dispatchEvent(new CustomEvent('save-result', {
            detail: {
                promptId: 'test-prompt-id',
                success: true
            }
        }));

        expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, `postCastRider_${action.name.replace(/\s+/g, '_')}`, 0, campaignName);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'save_result',
            success: true,
            description: 'Enemy succeeded on WIS save. No effect.'
        }));
    });

    it('should handle failed save result with mapped condition', async () => {
        await handle(action, playerStats, campaignName, mapName);

        getRuntimeValue.mockImplementation((char, key) => {
            if (key === 'activeConditions' && char === 'Enemy') return ['blinded'];
            return null;
        });

        window.dispatchEvent(new CustomEvent('save-result', {
            detail: {
                promptId: 'test-prompt-id',
                success: false
            }
        }));

        // Uses decremented
        expect(setRuntimeValue).toHaveBeenCalledWith(playerStats.name, `postCastRider_${action.name.replace(/\s+/g, '_')}`, 0, campaignName);
        
        // Condition 'charmed' applied from mapping 'Charmed or Frightened' -> ['charmed', 'frightened']
        expect(setRuntimeValue).toHaveBeenCalledWith('Enemy', 'activeConditions', ['blinded', 'charmed'], campaignName);
        
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'save_result',
            success: false,
            description: 'Enemy failed WIS save. Charmed for 1 minute.'
        }));

        expect(addExpiration).toHaveBeenCalledWith(playerStats.name, 'Enemy', [
            { type: 'condition', condition: 'charmed' }
        ], campaignName, 10);
    });

    it('should handle failed save result with unmapped condition', async () => {
        action.automation.condition = 'Prone';
        await handle(action, playerStats, campaignName, mapName);

        window.dispatchEvent(new CustomEvent('save-result', {
            detail: {
                promptId: 'test-prompt-id',
                success: false
            }
        }));

        expect(setRuntimeValue).toHaveBeenCalledWith('Enemy', 'activeConditions', ['prone'], campaignName);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            description: 'Enemy failed WIS save. Prone for 1 minute.'
        }));
    });

    it('should ignore save result if promptId does not match', async () => {
        await handle(action, playerStats, campaignName, mapName);

        window.dispatchEvent(new CustomEvent('save-result', {
            detail: {
                promptId: 'wrong-id',
                success: true
            }
        }));

        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should use default WIS save if saveType is missing', async () => {
        delete action.automation.saveType;
        await handle(action, playerStats, campaignName, mapName);

        expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            saveType: 'WIS'
        }));

        window.dispatchEvent(new CustomEvent('save-result', {
            detail: { promptId: 'test-prompt-id', success: true }
        }));

        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            saveType: 'WIS'
        }));
    });
});
