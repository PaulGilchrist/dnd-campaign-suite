import { getCombatContext, getTargetFromAttacker } from '../../rules/damageUtils.js';
import { MELEE_REACH_FEET } from '../../combat/baseCombatActions.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
    const targetName = target?.name || null;

    const meleeAttacks = (playerStats.attacks || []).filter(
        a => a.type === 'Action' && a.range === MELEE_REACH_FEET
    );
    const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : (playerStats.attacks || [])[0];

    if (!attack) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name}: No melee attack available.`,
                automation: action.automation,
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
