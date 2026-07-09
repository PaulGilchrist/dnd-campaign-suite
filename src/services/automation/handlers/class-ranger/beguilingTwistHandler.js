import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';

const CHARMED_FRIGHTENED_CONDITIONS = ['charmed', 'frightened'];

function findTriggeringSaveOrCondition(lastAttack) {
    if (!lastAttack) return null;

    // Check for GM manual condition event
    if (lastAttack.rollType === 'condition' && CHARMED_FRIGHTENED_CONDITIONS.includes(lastAttack.conditionKey)) {
        return {
            targetName: lastAttack.targetName,
            conditionKey: lastAttack.conditionKey,
            timestamp: lastAttack.timestamp,
        };
    }

    // Check for save event with saveConditions or saveType indicating condition
    if (lastAttack.rollType === 'save' && lastAttack.saveResult === 'success') {
        const saveConditions = lastAttack.saveConditions || [];
        const matchingCondition = saveConditions.find(c => CHARMED_FRIGHTENED_CONDITIONS.includes(c));
        if (matchingCondition) {
            return {
                targetName: lastAttack.targetName,
                conditionKey: matchingCondition,
                timestamp: lastAttack.timestamp,
            };
        }

        // saveType can be 'charmed' or 'frightened' for condition-based saves
        if (CHARMED_FRIGHTENED_CONDITIONS.includes(lastAttack.saveType)) {
            return {
                targetName: lastAttack.targetName,
                conditionKey: lastAttack.saveType,
                timestamp: lastAttack.timestamp,
            };
        }
    }

    return null;
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const featureName = action.name || 'Beguiling Twist';

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `Cannot determine targets. ${featureName} requires combat data to identify potential targets.`,
                automation: auto,
            },
        };
    }

    const trigger = findTriggeringSaveOrCondition(combatSummary.lastAttack);
    if (!trigger) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No recent save against Charmed or Frightened found. ${featureName} must be used shortly after a successful save against Charmed or Frightened.`,
                automation: auto,
            },
        };
    }

    const allCreatures = combatSummary.creatures || [];
    if (allCreatures.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No creatures available to target with ${featureName}.`,
                automation: auto,
            },
        };
    }

    const prof = playerStats.proficiency || 0;
    const chaBonus = getAbilityModifier(playerStats.abilities, 'CHA');
    const saveDc = 8 + chaBonus + prof;

    return {
        type: 'modal',
        modalName: 'beguilingTwist',
        payload: {
            targets: allCreatures,
            action,
            playerStats,
            campaignName,
            conditionKey: trigger.conditionKey,
            saveDc,
            featureName,
        },
    };
}
