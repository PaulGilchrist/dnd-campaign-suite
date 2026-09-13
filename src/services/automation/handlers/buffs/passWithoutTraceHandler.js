import { toggleBuff } from '../../common/buffToggle.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const auraRange = auto.auraRange || 30;

    const { wasActive } = toggleBuff(
        playerName,
        action.name,
        {
            ...auto,
            effect: 'pass_without_trace',
            auraRange,
        },
        campaignName
    );

    if (!wasActive) {
        addExpiration({ attackerName: playerName, targetName: playerName, effects: [
            { type: 'remove_active_buff', buffName: action.name }
        ], campaignName });
    }

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply ${action.name}.`,
            },
        };
    }

    const creatureTargets = combatSummary.creatures.map(c => c.name);

    return {
        type: 'popup',
        payload: {
            type: 'pass_without_trace_target_selection',
            name: action.name,
            creatureTargets,
            auraRange,
            automation: auto,
        },
    };
}

export function isPassWithoutTraceActive(playerName, campaignName) {
    const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName);
    return Array.isArray(activeBuffs) && activeBuffs.some(b => b.name === 'Pass Without Trace' && b.effect === 'pass_without_trace');
}
