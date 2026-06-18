import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const RIDER_CONDITIONS = {
    'Charmed or Frightened': ['charmed', 'frightened'],
};

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;

    const usesKey = `postCastRider_${action.name.replace(/\s+/g, '_')}`;
    const uses = getRuntimeValue(playerStats.name, usesKey, campaignName) ?? 1;

    if (uses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} has no uses remaining.`,
            },
        };
    }

    const saveDc = buildSaveDc(auto, playerStats);
    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || 'Unknown';

    const { promptId } = createSaveListener(campaignName, {
        targetName,
        saveType: auto.saveType || 'WIS',
        saveDc,
    });

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} triggered — target ${targetName} must make ${auto.saveType || 'WIS'} save (DC ${saveDc})`,
        promptId,
    }).catch(() => {});

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        setRuntimeValue(playerStats.name, usesKey, uses - 1, campaignName);

        const isSuccessful = event.detail.success;

        if (isSuccessful) {
            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerStats.name,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: auto.saveType || 'WIS',
                success: true,
                description: `${targetName} succeeded on ${auto.saveType || 'WIS'} save. No effect.`,
            }).catch(() => {});
        } else {
            const conditionChoices = RIDER_CONDITIONS[auto.condition] || [auto.condition.toLowerCase()];
            const appliedCondition = conditionChoices[0];

            const storedConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
            const conditions = Array.isArray(storedConditions) ? storedConditions : [];
            const newConditions = [...conditions, appliedCondition];
            setRuntimeValue(targetName, 'activeConditions', newConditions, campaignName);

            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerStats.name,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: auto.saveType || 'WIS',
                success: false,
                description: `${targetName} failed ${auto.saveType || 'WIS'} save. ${appliedCondition.charAt(0).toUpperCase() + appliedCondition.slice(1)} for 1 minute.`,
            }).catch(() => {});

            addExpiration(playerStats.name, targetName, [
                { type: 'condition', condition: appliedCondition }
            ], campaignName, 10);
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
            description: `Target ${targetName} must make a ${auto.saveType || 'WIS'} saving throw (DC ${saveDc}). On a failed save, choose Charmed or Frightened for 1 minute.`,
            automation: auto,
        },
    };
}
