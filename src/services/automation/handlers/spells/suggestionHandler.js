import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation || {};
    const dc = buildSaveDc(auto, playerStats);

    const casterName = playerStats.name;
    const targetInfo = await resolveTarget(campaignName, casterName);
    const targetName = targetInfo?.target?.name;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No target selected. Suggestion has no effect.',
            },
        };
    }

    const { promptId, promise } = createSaveListener(campaignName, {
        targetName,
        saveType: 'WIS',
        saveDc: dc,
        dcSuccess: 'none',
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: casterName,
        abilityName: action.name,
        description: `${casterName} casts Suggestion on ${targetName}! ${targetName} must make a WIS save (DC ${dc}) or become Charmed.`,
        promptId,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    const saveResult = await promise;

    if (saveResult.success) {
        addEntry(campaignName, {
            type: 'save_result',
            characterName: casterName,
            rollType: 'save-suggestion',
            targetName,
            saveDc: dc,
            saveType: 'WIS',
            success: true,
            description: `${targetName} succeeded on WIS save against Suggestion.`,
        }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} succeeded on WIS save against Suggestion.`,
            },
        };
    }

    // Failed save: apply Charmed condition
    const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
    setRuntimeValue(targetName, 'activeConditions', [...filtered, 'charmed'], campaignName);

    const durationHours = auto.duration ? 8 : 24;
    addExpiration(casterName, targetName, [
        { type: 'charmed', condition: 'charmed' },
    ], campaignName, durationHours);

    postLogEntry(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: targetName,
        condition: 'Charmed',
        reason: 'Suggestion spell',
        note: `${targetName} is Charmed by Suggestion and pursues the suggested course of activity. The spell ends if ${casterName} or allies deal damage to the target.`,
        timestamp: Date.now(),
    });

    addEntry(campaignName, {
        type: 'save_result',
        characterName: casterName,
        rollType: 'save-suggestion',
        targetName,
        saveDc: dc,
        saveType: 'WIS',
        success: false,
        description: `${targetName} failed WIS save against Suggestion and is Charmed.`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${targetName} failed WIS save and is Charmed by Suggestion. The Charmed target pursues the suggested course of activity. The spell ends if ${casterName} or allies deal damage to the target.`,
        },
    };
}
