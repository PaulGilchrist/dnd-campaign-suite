import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || null;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} — <i>No target selected — effect noted for manual application.</i>`,
                automation: auto,
            },
        };
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${action.name} used against ${targetName}`,
    }).catch(() => {});

    const meleeAttacks = (playerStats.attacks || []).filter(
        a => a.type === 'Action' && a.range === 'melee'
    );
    const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : (playerStats.attacks || [])[0];

    if (!attack) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No melee attack available.`,
                automation: auto,
            },
        };
    }

    return {
        type: 'attack_roll',
        payload: {
            attack,
            targetName,
            sourceName: action.name,
        },
    };
}
