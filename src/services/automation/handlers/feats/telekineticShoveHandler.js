import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const pushDistance = auto.pushDistance || 5;

    const saveDc = buildSaveDc(auto, playerStats);
    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || playerStats.name;

    const { promptId } = createSaveListener(campaignName, {
        targetName,
        saveType: auto.saveType || 'STR',
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} triggered — target ${targetName} must make ${auto.saveType || 'STR'} save (DC ${saveDc}) or be pushed ${pushDistance} feet`,
        promptId,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
        const isSuccessful = event.detail.success;

        if (!isSuccessful) {
            const newEffect = {
                target: targetName,
                source: action.name,
                effect: 'push',
                value: pushDistance,
                direction: 'toward_or_away',
                duration: 'immediate',
            };
            const updatedEffects = [...storedEffects, newEffect];
            setRuntimeValue(campaignName, 'targetEffects', updatedEffects, campaignName);

            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerStats.name,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: auto.saveType || 'STR',
                success: false,
                description: `${targetName} failed ${auto.saveType || 'STR'} save. Pushed ${pushDistance} feet.`,
            }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });
        } else {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerStats.name,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: auto.saveType || 'STR',
                success: true,
                description: `${targetName} succeeded on ${auto.saveType || 'STR'} save. No effect.`,
            }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });
        }

        window.removeEventListener('save-result', handleSaveResult);
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            targetName,
            description: `Target ${targetName} must make a ${auto.saveType || 'STR'} saving throw (DC ${saveDc}) or be pushed ${pushDistance} feet toward or away from you.`,
            automation: auto,
        },
    };
}
