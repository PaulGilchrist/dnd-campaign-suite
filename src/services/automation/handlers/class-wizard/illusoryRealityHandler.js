import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const OBJECT_KEY = 'illusoryRealityObject';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Illusory Reality';

    // Check if there's already a real object from this feature active
    const existingObject = getRuntimeValue(playerName, OBJECT_KEY, campaignName);
    if (existingObject) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: An object is already real (${existingObject}). It remains real for 1 minute from when it was made real. Use this Bonus Action again to make a different object real (the previous object disappears).`,
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

    // Store the object with a timestamp for 1-minute duration
    await setRuntimeValue(playerName, OBJECT_KEY, trimmedName, campaignName);
    await setRuntimeValue(playerName, `${OBJECT_KEY}_timestamp`, Date.now(), campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — the object "${trimmedName}" becomes real for 1 minute.`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `<b>${featureName}</b><br/><br/>You use your Bonus Action to make the object <b>"${trimmedName}"</b> real.<br/><br/>The object remains real for 1 minute. It cannot deal damage or impose any conditions.<br/><br/><em>The object disappears when its duration ends or if you use this feature again.</em>`,
            automation: auto,
        },
    };
}

export async function getActiveObject(playerName, campaignName) {
    const objectName = getRuntimeValue(playerName, OBJECT_KEY, campaignName);
    const timestamp = getRuntimeValue(playerName, `${OBJECT_KEY}_timestamp`, campaignName);

    if (!objectName || !timestamp) return null;

    const elapsed = Date.now() - Number(timestamp);
    const durationMs = 60 * 1000; // 1 minute

    if (elapsed >= durationMs) {
        // Expired — clean up
        await setRuntimeValue(playerName, OBJECT_KEY, null, campaignName);
        await setRuntimeValue(playerName, `${OBJECT_KEY}_timestamp`, null, campaignName);
        return null;
    }

    return {
        name: objectName,
        remainingMs: durationMs - elapsed,
    };
}

export async function clearObject(playerName, campaignName) {
    await setRuntimeValue(playerName, OBJECT_KEY, null, campaignName);
    await setRuntimeValue(playerName, `${OBJECT_KEY}_timestamp`, null, campaignName);
}

export { OBJECT_KEY as handlerModal };
