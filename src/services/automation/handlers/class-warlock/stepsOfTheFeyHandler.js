import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationExpressions.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

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

    const newCount = currentCount - 1;
    await setRuntimeValue(playerName, freeCastCountKey, newCount, campaignName);

    // Refreshing Step: gain 1d10 Temporary Hit Points
    const tempHpRoll = rollDie(10);
    const existingTempHp = Number(getRuntimeValue(playerName, 'tempHp', campaignName) ?? 0);
    const newTempHp = Math.max(existingTempHp, tempHpRoll);
    await setRuntimeValue(playerName, 'tempHp', newTempHp, campaignName);

    // Get combat context for eligible targets
    const cs = await getCombatContext(campaignName);
    if (!cs?.creatures || cs.creatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName}: Cast Misty Step without expending a spell slot (${newCount} remaining).<br/><br/><b>Refreshing Step:</b> Gained ${tempHpRoll} Temporary Hit Points.<br/><br/>No creatures in combat for Taunting Step.`,
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
                description: `${featureName}: Cast Misty Step without expending a spell slot (${newCount} remaining).<br/><br/><b>Refreshing Step:</b> Gained ${tempHpRoll} Temporary Hit Points.<br/><br/>No other creatures in combat for Taunting Step.`,
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
            targets: eligibleTargets,
            action,
            playerStats,
            campaignName,
            saveDc,
            featureName,
            tempHpRoll,
            newCount,
        },
    };
}
