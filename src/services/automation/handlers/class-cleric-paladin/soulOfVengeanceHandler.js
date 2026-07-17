import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { MELEE_REACH_FEET } from '../../../combat/baseCombatActions.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Soul of Vengeance';

    // Check if Vow of Enmity is active
    const vowTarget = getRuntimeValue(playerName, 'vowOfEnmityTarget', campaignName);

    if (!vowTarget) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description: `${featureName} — Vow of Enmity is not active.`,
                automation: auto,
            },
        };
    }

    // Check lastAttack — did the Vow of Enmity target attack someone?
    const { attackEvent, attackerName } = await findLastAttack(campaignName);

    if (!attackEvent || !attackerName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description: `${featureName} — No recent attack found. This reaction must be used when a creature under Vow of Enmity makes an attack.`,
                automation: auto,
            },
        };
    }

    if (attackerName !== vowTarget) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description: `${featureName} — The last attacker (${attackerName}) is not your Vow of Enmity target (${vowTarget}).`,
                automation: auto,
            },
        };
    }

    // Get the Paladin's main melee weapon for the counterattack
    const meleeAttacks = (playerStats.attacks || []).filter(
        a => a.type === 'Action' && a.range === MELEE_REACH_FEET
    );
    const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : (playerStats.attacks || [])[0];

    if (!attack) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                automationType: auto.type,
                description: `${featureName}: No melee attack available for the counterattack.`,
                automation: auto,
            },
        };
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} to make a counterattack against ${vowTarget} after they attacked.`,
        targetName: vowTarget,
    }).catch((e) => { console.error(`[${featureName}] Error:`, e); });

    return {
        type: 'attack_roll',
        payload: {
            attack,
            targetName: vowTarget,
            sourceName: featureName,
        },
    };
}
