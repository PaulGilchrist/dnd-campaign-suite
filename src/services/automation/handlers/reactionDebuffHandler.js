import { createSaveListener } from '../common/savePrompt.js';
import { resolveTarget } from '../common/targetResolver.js';
import { setRuntimeValue, getRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { addExpiration } from '../../rules/expirations.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    const saveDc = auto.saveDc || 10;
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
        description: `${action.name} triggered — target ${targetName} must make ${auto.saveType || 'STR'} save (DC ${saveDc})`,
        promptId,
    }).catch(() => {});

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;
        window.removeEventListener('save-result', handleSaveResult);

        if (event.detail.success) {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerStats.name,
                rollType: 'save-reaction_debuff',
                targetName,
                saveDc,
                saveType: auto.saveType || 'STR',
                success: true,
                description: `${targetName} succeeded on ${auto.saveType || 'STR'} save. No effect.`,
            }).catch(() => {});
            return;
        }

        const conditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
        const newConditions = Array.isArray(conditions) ? [...conditions, 'speed_zero'] : ['speed_zero'];
        setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);

        addExpiration(playerStats.name, targetName, [
            { type: 'condition', condition: 'speed_zero' }
        ], campaignName);

        addEntry(campaignName, {
            type: 'save_result',
            characterName: playerStats.name,
            rollType: 'save-reaction_debuff',
            targetName,
            saveDc,
            saveType: auto.saveType || 'STR',
            success: false,
            description: `${targetName} failed ${auto.saveType || 'STR'} save. Teleported within ${auto.teleportRange || '5'} ft and speed reduced to 0 until end of turn.`,
        }).catch(() => {});
    };

    window.addEventListener('save-result', handleSaveResult);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            targetName,
            description: `${targetName} must make a ${auto.saveType || 'STR'} saving throw (DC ${saveDc}). On failure, teleported within ${auto.teleportRange || '5'} ft and speed is reduced to 0 until end of turn.`,
            automation: auto,
        },
    };
}
