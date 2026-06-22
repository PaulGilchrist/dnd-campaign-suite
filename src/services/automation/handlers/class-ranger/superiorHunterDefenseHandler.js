import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Super Hunter\'s Defense';

    const lastAttack = await findLastAttack(campaignName);
    if (!lastAttack.attackEvent) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No recent attack found. ${featureName} can only be used after taking damage in combat.`,
                automation: auto,
            },
        };
    }

    if (lastAttack.targetName !== playerName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `The last attack did not target you. ${featureName} can only be used shortly after taking damage.`,
                automation: auto,
            },
        };
    }

    const damageType = lastAttack.attackEvent.damageType || 'untyped';
    const rawDamage = lastAttack.totalDamage || 0;

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
