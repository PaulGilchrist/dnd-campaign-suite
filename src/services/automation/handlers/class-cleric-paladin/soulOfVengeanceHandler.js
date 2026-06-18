import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { MELEE_REACH_FEET } from '../../../combat/baseCombatActions.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check if Vow of Enmity is active
    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
    const vowOfEnmityActive = activeBuffs.some(b => b.effect === 'vow_of_enmity');

    if (!vowOfEnmityActive) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} — Vow of Enmity is not active.`,
                automation: auto,
            },
        };
    }

    // Get the Vow of Enmity target
    const vowTarget = getRuntimeValue(playerName, 'vowOfEnmityTarget', campaignName);

    if (!vowTarget) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} — No Vow of Enmity target selected.`,
                automation: auto,
            },
        };
    }

    // Use the current combat target; if it matches the vow target, proceed
    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || null;

    if (!targetName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                automationType: auto.type,
                description: `${action.name} — No target selected in combat.`,
                automation: auto,
            },
        };
    }

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
                automationType: auto.type,
                description: `${action.name}: No melee attack available.`,
                automation: auto,
            },
        };
    }

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${action.name} used against ${targetName}`,
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return {
        type: 'attack_roll',
        payload: {
            attack,
            targetName,
            sourceName: action.name,
        },
    };
}
