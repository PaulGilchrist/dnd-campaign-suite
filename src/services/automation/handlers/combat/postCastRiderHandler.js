import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

const RIDER_CONDITIONS = {
    'Charmed or Frightened': ['charmed', 'frightened'],
};

function showConditionChoice(targetName, conditions) {
    const promptId = `condition-choice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve) => {
        const handleChoice = (event) => {
            if (event.detail.promptId !== promptId) return;
            window.removeEventListener('condition-choice-selected', handleChoice);
            window.removeEventListener('condition-choice-skipped', handleSkip);
            resolve(event.detail.condition);
        };
        const handleSkip = (event) => {
            if (event.detail.promptId !== promptId) return;
            window.removeEventListener('condition-choice-selected', handleChoice);
            window.removeEventListener('condition-choice-skipped', handleSkip);
            resolve(null);
        };
        window.addEventListener('condition-choice-selected', handleChoice);
        window.addEventListener('condition-choice-skipped', handleSkip);
        window.dispatchEvent(new CustomEvent('condition-choice-show', {
            detail: { promptId, targetName, conditions },
        }));
    });
}

export async function handle(action, playerStats, campaignName, _mapName) {
    console.log('[postCastRiderHandler] handle called for', action.name, 'automation:', JSON.stringify(action.automation));
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
    console.log('[postCastRiderHandler] saveDc:', saveDc);
    const targetInfo = await resolveTarget(campaignName, playerStats.name);
    const targetName = targetInfo?.target?.name || 'Unknown';
    console.log('[postCastRiderHandler] targetName:', targetName, 'targetInfo:', targetInfo ? 'found' : 'null');

    const { promptId } = createSaveListener(campaignName, {
        targetName,
        saveType: auto.saveType || 'WIS',
        saveDc,
    });

    console.log('[postCastRiderHandler] createSaveListener called with promptId:', promptId, 'targetName:', targetName, 'saveType:', auto.saveType || 'WIS', 'saveDc:', saveDc);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${action.name} triggered — target ${targetName} must make ${auto.saveType || 'WIS'} save (DC ${saveDc})`,
        promptId,
    }).catch((e) => { console.error("[postCastRider] Error:", e); });

    console.log('[postCastRiderHandler] Returning popup for', action.name);

    const handleSaveResult = async (event) => {
        if (event.detail.promptId !== promptId) return;

        console.log('[postCastRiderHandler] handleSaveResult called, success:', event.detail.success, 'targetName:', event.detail.targetName);

        const isSuccessful = event.detail.success;

        if (isSuccessful) {
            setRuntimeValue(playerStats.name, usesKey, uses - 1, campaignName);

            addEntry(campaignName, {
                type: 'save_result',
                characterName: playerStats.name,
                rollType: `save-${auto.type}`,
                targetName,
                saveDc,
                saveType: auto.saveType || 'WIS',
                success: true,
                description: `${targetName} succeeded on ${auto.saveType || 'WIS'} save. No effect.`,
            }).catch((e) => { console.error("[postCastRider] Error:", e); });
        } else {
            const conditionChoices = RIDER_CONDITIONS[auto.condition] || [auto.condition.toLowerCase()];
            console.log('[postCastRiderHandler] Condition choices:', conditionChoices, 'from auto.condition:', auto.condition);
            const appliedCondition = conditionChoices.length > 1
                ? await showConditionChoice(targetName, conditionChoices)
                : conditionChoices[0];
            console.log('[postCastRiderHandler] Applied condition:', appliedCondition);

            if (appliedCondition === null) {
                console.log('[postCastRiderHandler] User skipped condition — not consuming use');
                window.removeEventListener('save-result', handleSaveResult);
                return;
            }

            console.log('[postCastRiderHandler] Setting uses to', uses - 1, 'for', usesKey);
            setRuntimeValue(playerStats.name, usesKey, uses - 1, campaignName);

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
            }).then(() => console.log('[postCastRiderHandler] addEntry succeeded'))
            .catch((e) => { console.error("[postCastRider] addEntry Error:", e); });

            console.log('[postCastRiderHandler] Adding expiration for', targetName, 'condition:', appliedCondition);
            addExpiration(playerStats.name, targetName, [
                { type: 'condition', condition: appliedCondition }
            ], campaignName, 10);

            // Log applied condition so user can verify
            console.log('[postCastRiderHandler] Condition applied:', appliedCondition, 'to', targetName, 'activeConditions:', getRuntimeValue(targetName, 'activeConditions', campaignName));
        }

        console.log('[postCastRiderHandler] Removing save-result listener');
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
