import { getCombatContext } from '../../rules/damageUtils.js';

export async function handle(action, playerStats, campaignName) {
    const cs = await getCombatContext(campaignName);
    if (!cs) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'No active combat to target.',
            },
        };
    }

    const attacker = cs.creatures?.find(c => c.name === playerStats.name);
    if (!attacker?.concentration?.spell) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Hunter\'s Mark is not currently concentrated on.',
            },
        };
    }

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `Superior Hunter's Prey active: When you deal damage to the creature marked by Hunter's Mark, you can deal the spell's extra damage to a different creature within 30 feet of the first creature. Once per turn.`,
        },
    };
}
