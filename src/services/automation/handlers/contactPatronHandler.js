import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const featureName = action.name || 'Contact Patron';
    const playerName = playerStats.name;

    const usesMax = auto.uses || 1;
    const freeCastCountKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`;
    const currentCount = Number(getRuntimeValue(playerName, freeCastCountKey, campaignName) ?? usesMax);

    if (currentCount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No free casts remaining. Finish a Long Rest to regain them.',
                automation: auto,
            },
        };
    }

    const newCount = currentCount - 1;
    await setRuntimeValue(playerName, freeCastCountKey, newCount, campaignName);

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `${featureName}: Contact Other Plane is prepared and ready to cast without expending a spell slot. You automatically succeed on the spell's saving throw. (${newCount} remaining).`,
            automation: auto,
        },
    };
}
