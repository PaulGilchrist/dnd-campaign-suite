import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { checkOncePerTurn, markOncePerTurn } from '../../common/oncePerTurn.js';

const OBJECT_KEY = 'illusoryRealityObject';
const USED_ROUND_KEY = 'illusoryRealityUsedRound';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Illusory Reality';

    const skip = await checkOncePerTurn(featureName, 'illusoryRealityUsedRound', playerName, campaignName);
    if (skip) return skip;

    // Check if there's already a real object from this feature active
    const existingObject = getRuntimeValue(playerName, OBJECT_KEY, campaignName);
    if (existingObject) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: An object is already real (${existingObject}). It remains real until you roll initiative, finish a short rest, or finish a long rest. Use this Bonus Action again to make a different object real (the previous object disappears).`,
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'illusoryReality',
        payload: {
            action,
            playerStats,
            campaignName,
        },
    };
}

export async function confirmIllusoryReality(action, playerStats, campaignName, objectName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Illusory Reality';

    if (!objectName || typeof objectName !== 'string' || objectName.trim().length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: You must specify an inanimate, nonmagical object that is part of an illusion spell you cast with a spell slot.`,
                automation: auto,
            },
        };
    }

    const trimmedName = objectName.trim();

    await setRuntimeValue(playerName, OBJECT_KEY, trimmedName, campaignName, true);
    await markOncePerTurn(featureName, USED_ROUND_KEY, playerStats, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — the object "${trimmedName}" becomes real.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[illusoryReality] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `<b>${featureName}</b><br/><br/>You use your Bonus Action to make the object <b>"${trimmedName}"</b> real.<br/><br/>The object cannot deal damage or impose any conditions.<br/><br/><em>The object persists until you roll initiative, finish a short rest, or finish a long rest. It disappears if you use this feature again.</em>`,
            automation: auto,
        },
    };
}

export async function getActiveObject(playerName, campaignName) {
    const objectName = getRuntimeValue(playerName, OBJECT_KEY, campaignName);

    if (!objectName) return null;

    return {
        name: objectName,
    };
}

export async function clearObject(playerName, campaignName) {
    await setRuntimeValue(playerName, OBJECT_KEY, null, campaignName);
    await setRuntimeValue(playerName, USED_ROUND_KEY, null, campaignName);
}

export { OBJECT_KEY as handlerModal };
