import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc } from '../../common/savePrompt.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';

const CHARMED_FRIGHTENED_CONDITIONS = ['charmed', 'frightened'];
const DEFAULT_RANGE_FT = 120;

function normalizeName(name) {
    return String(name || '').trim().toLowerCase();
}

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

    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    const trigger = findTriggeringSaveOrCondition(lastAttack);
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

    // CLA-034: data authors saveDc:"spell_save_dc" — resolve via the shared
    // spell_save_dc seam (Ranger = 8 + WIS + PB), never a hardcoded ability.
    const saveDc = buildSaveDc(auto, playerStats);

    // CLA-034: data authors target:"different_creature" — the creature that
    // made the triggering save is never a valid redirect target. 120 ft range
    // goes through isWithinRange (gridless boards are lenient; advisory noted).
    const rangeFt = rangeToFeet(auto?.range) || DEFAULT_RANGE_FT;
    const eligibleTargets = [];
    for (const creature of allCreatures) {
        if (normalizeName(creature.name) === normalizeName(trigger.targetName)) continue;
        if (!(await isWithinRange(playerStats.name, creature.name, rangeFt))) continue;
        eligibleTargets.push(creature);
    }

    if (eligibleTargets.length === 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} targets a DIFFERENT creature within ${rangeFt} feet — ${trigger.targetName} succeeded on that save and cannot be the target, and no other creature is eligible.`,
                automation: auto,
            },
        };
    }

    return {
        type: 'modal',
        modalName: 'beguilingTwist',
        payload: {
            targets: eligibleTargets,
            action,
            playerStats,
            campaignName,
            conditionKey: trigger.conditionKey,
            saveDc,
            featureName,
            rangeFt,
            triggeredBy: trigger.targetName,
        },
    };
}
