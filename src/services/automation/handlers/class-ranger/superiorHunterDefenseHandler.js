import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { findRollsByCreature } from '../../common/damageRollback.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Superior Hunter\'s Defense';

    // Find the last damage event where the player was the target
    // Scan all creatures' lastAttack for events targeting the player
    const rollsByCreature = await findRollsByCreature(campaignName);
    if (!rollsByCreature) {
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

    for (const [, rolls] of Object.entries(rollsByCreature)) {
        const damageEvent = rolls.attackEvent;
        if (damageEvent && damageEvent.targetName === playerName) {
            if (damageEvent.timestamp > timestamp) {
                timestamp = damageEvent.timestamp;
                lastDamageEvent = damageEvent;
            }
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
    }).catch((e) => { console.error("[superiorHunterDefense] Error:", e); throw e; });

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
