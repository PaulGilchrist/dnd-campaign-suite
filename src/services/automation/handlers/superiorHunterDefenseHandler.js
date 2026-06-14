import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { getLastDamageEvent } from '../../../hooks/useMetamagic.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Superior Hunter\'s Defense';

    // Find the last damage event where the player was the target
    // Scan all creatures' lastMetamagicDamage for events targeting the player
    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No active combat to find recent damage. ${featureName} can only be used after taking damage in combat.`,
                automation: auto,
            },
        };
    }

    let lastDamageEvent = null;
    let timestamp = 0;

    const creatures = cs.creatures || [];
    for (const creature of creatures) {
        const damageEvent = getRuntimeValue(creature.name, 'lastMetamagicDamage');
        if (damageEvent && damageEvent.targetName === playerName && !isStale(damageEvent)) {
            if (damageEvent.timestamp > timestamp) {
                timestamp = damageEvent.timestamp;
                lastDamageEvent = damageEvent;
            }
        }
    }

    // Also check the player's own key (in case damage was saved there directly)
    const playerDamageEvent = getLastDamageEvent(playerName);
    if (playerDamageEvent && playerDamageEvent.targetName === playerName && !isStale(playerDamageEvent)) {
        if (playerDamageEvent.timestamp > timestamp) {
            lastDamageEvent = playerDamageEvent;
        }
    }

    if (!lastDamageEvent) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No recent damage found where you were the target. ${featureName} can only be used shortly after taking damage.`,
                automation: auto,
            },
        };
    }

    const damageType = lastDamageEvent.damageType || 'untyped';
    const rawDamage = lastDamageEvent.rawDamage || 0;

    // Add resistance buff for the damage type until end of current turn
    const stored = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    const activeBuffs = Array.isArray(stored) ? stored : [];

    // Remove any existing Superior Hunter's Defense buff
    const existingBuffs = activeBuffs.filter(b => b.name !== featureName);

    const buff = {
        name: featureName,
        effect: 'damage_resistance',
        duration: 'until_end_of_current_turn',
        resistanceTypes: [damageType.toLowerCase()],
    };

    const newBuffs = [...existingBuffs, buff];
    setRuntimeValue(playerName, 'activeBuffs', newBuffs, campaignName);

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName}, gaining Resistance to ${damageType} damage until end of current turn.`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description: `<b>${featureName}</b><br/>You gained Resistance to ${damageType} damage until end of current turn. (Last damage taken: ${rawDamage} ${damageType})`,
            automation: auto,
        },
    };
}
