import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Steps of the Fey';

    const usesMax = evaluateAutoExpression(auto.uses_expression || 'CHA modifier_min_1', playerStats) || 1;
    const freeCastCountKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`;
    const currentCount = Number(getRuntimeValue(playerName, freeCastCountKey, campaignName) ?? usesMax);

    if (currentCount <= 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: 'No free uses of Steps of the Fey remaining. Finish a Long Rest to regain them.',
                automation: auto,
            },
        };
    }

    // Get combat context for eligible targets
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: Cast Misty Step without expending a spell slot (${currentCount} remaining).<br/><br/>No creatures in combat for Taunting Step.`,
                automation: auto,
                triggerMistyStep: true,
            },
        };
    }

    const eligibleTargets = cs.creatures.filter(c => c.name !== playerName);
    if (eligibleTargets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: Cast Misty Step without expending a spell slot (${currentCount} remaining).<br/><br/>No other creatures in combat for Taunting Step.`,
                automation: auto,
                triggerMistyStep: true,
            },
        };
    }

    const saveDc = 8 + (playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0) + (playerStats.proficiency || 0);

    return {
        type: 'modal',
        modalName: 'stepsOfTheFeyTaunt',
        payload: {
            mode: 'stepsOfTheFey',
            targets: eligibleTargets,
            action,
            playerStats,
            campaignName,
            saveDc,
            featureName,
            newCount: currentCount,
            freeCastCountKey,
        },
    };
}
