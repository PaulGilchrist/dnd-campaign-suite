import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { toggleBuff } from '../../common/buffToggle.js';
import { addEntry } from '../../../ui/logService.js';

const STONECANNING_USES_KEY = 'stonecunningUses';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Stonecunning';

    const usesKey = `${playerName.toLowerCase().replace(/\s+/g, '')}_${STONECANNING_USES_KEY}`;

    let usesMax;
    if (auto.uses === 'proficiency_bonus') {
        usesMax = playerStats.proficiency || 0;
    } else if (typeof auto.uses === 'number') {
        usesMax = auto.uses;
    } else {
        usesMax = auto.usesMax != null ? auto.usesMax : 1;
    }

    let usesRemaining, canUse;

    const stored = getRuntimeValue(playerName, usesKey, campaignName);
    usesRemaining = stored != null ? Number(stored) : usesMax;
    canUse = usesRemaining > 0;

    if (!canUse) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description: `${featureName} has no uses remaining. Recharges on a Long Rest.`,
                automation: auto,
            },
        };
    }

    const { wasActive } = toggleBuff(playerName, featureName, auto, campaignName, playerName);

    if (wasActive) {
        await addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: featureName,
            description: `${featureName} deactivated.`,
        }).catch((e) => { console.error("[stonecunning] Error:", e); throw e; });

        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description: `${featureName} toggled OFF`,
                automation: auto,
            },
        };
    }

    const newUses = usesRemaining - 1;
    await setRuntimeValue(playerName, usesKey, newUses, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${featureName} activated. Tremorsense 60 ft. (${newUses} use${newUses !== 1 ? 's' : ''} remaining).`,
    }).catch((e) => { console.error("[stonecunning] Error:", e); throw e; });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: auto.type,
            description: `${featureName} activated on yourself (1 bonus action, ${auto.duration || '10 min'}) — ${newUses} use${newUses !== 1 ? 's' : ''} remaining.`,
            automation: auto,
        },
    };
}

export function restoreUses(playerName, campaignName) {
    const usesKey = `${playerName.toLowerCase().replace(/\s+/g, '')}_${STONECANNING_USES_KEY}`;

    setRuntimeValue(playerName, usesKey, null, campaignName);
}
