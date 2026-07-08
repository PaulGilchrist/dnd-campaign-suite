import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || "Nature's Veil";
    const resourceKey = auto.resourceKey || 'naturesVeilUses';

    const storedUses = getRuntimeValue(playerName, resourceKey, campaignName);
    const trackedMax = playerStats._trackedResources?.[resourceKey]?.current;
    const maxUses = trackedMax ?? (() => {
        const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
        return Math.max(wis?.bonus || 0, 1);
    })();
    const currentUses = storedUses != null ? Number(storedUses) : maxUses;
    if (currentUses <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} has been used and cannot be used again until a Long Rest.`,
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, resourceKey, currentUses - 1, campaignName);

    // Apply Invisible condition
    const storedConditions = getRuntimeValue(playerName, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(storedConditions) ? storedConditions : [];
    if (!conditions.some(c => String(c).toLowerCase() === 'invisible')) {
        await setRuntimeValue(playerName, 'activeConditions', [...conditions, 'invisible'], campaignName);
    }

    // Set _activeInvisibility_ key so endInvisibilityOnHostileAction works
    await setRuntimeValue(campaignName, `_activeInvisibility_${playerName}`, playerStats.name, campaignName);

    // Set expiration: Invisible lasts until the creature after this one in initiative order
    // is active on the next round. Use addExpiration with rounds=2 so it expires when
    // appliedRound + 2 <= currentRound (i.e. 2 full rounds later).
    const combatSummary = getCombatSummary(campaignName);
    let nextCreatureName = null;
    if (combatSummary?.creatures) {
        const currentIndex = combatSummary.creatures.findIndex(c => c.name === playerName);
        if (currentIndex >= 0) {
            const nextIndex = (currentIndex + 1) % combatSummary.creatures.length;
            nextCreatureName = combatSummary.creatures[nextIndex].name;
        }
    }
    addExpiration(playerName, playerName, [
        { type: 'condition', condition: 'invisible' }
    ], campaignName, 2, nextCreatureName);

    // Log the ability use
    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} — Bonus Action, gained Invisible condition until end of next turn. Uses remaining: ${currentUses - 1}.`,
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `<b>${featureName}</b><br/><br/>You invoke spirits of nature to magically hide yourself. You gain the <b>Invisible</b> condition until the end of your next turn.<br/><br/>Uses remaining: ${currentUses - 1}`,
            automation: auto,
        },
    };
}
