import { rollExpression, rollExpressionMaximized } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import storage from '../../../ui/storage.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { hasHealingMaximization } from '../../../combat/automation/automationService.js';

const CUREABLE_CONDITIONS = ['Blinded', 'Deafened', 'Paralyzed', 'Poisoned', 'Stunned'];

function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const costAmount = auto.resourceCostAmount || 5;

    const storedFP = getRuntimeValue(playerName, 'focusPoints', campaignName);
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const maxFP = classLevel?.focus_points || 0;
    const currentFP = storedFP != null ? Number(storedFP) : (playerStats._trackedResources?.focusPoints?.current ?? maxFP);

    if (currentFP < costAmount) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Not enough Focus Points. Need ${costAmount}, have ${currentFP}.`,
                automation: auto,
            },
        };
    }

    const targetInfo = await resolveTarget(campaignName, playerName);
    if (!targetInfo?.target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Select a target in combat first.',
                automation: auto,
            },
        };
    }

    const targetName = targetInfo.target.name;

    let targetHp;
    if (targetInfo.target.type === 'player') {
        targetHp = getRuntimeValue(targetName, 'currentHitPoints', campaignName) ?? 0;
    } else {
        targetHp = targetInfo.target.currentHp ?? 0;
    }

    if (targetHp > 0) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${targetName} is not at 0 Hit Points.`,
                automation: auto,
            },
        };
    }

    const maximize = hasHealingMaximization(playerStats);
    const rollResult = maximize ? rollExpressionMaximized(auto.healExpression || '4d10') : rollExpression(auto.healExpression || '4d10');
    if (!rollResult) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: 'Failed to roll healing dice.',
                automation: auto,
            },
        };
    }

    await setRuntimeValue(playerName, 'focusPoints', currentFP - costAmount, campaignName);
    window.dispatchEvent(new CustomEvent('focus-points-updated'));

    const healAmount = rollResult.total;

    if (targetInfo.target.type === 'player') {
        await setRuntimeValue(targetName, 'currentHitPoints', healAmount, campaignName);
    } else {
        targetInfo.target.currentHp = healAmount;
        const cs = await getCombatContext(campaignName);
        if (cs) {
            storage.set('combatSummary', cs, campaignName);
        }
    }

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
    const condArray = Array.isArray(conditions) ? conditions : [];
    const cureConditions = (auto.cureConditions || CUREABLE_CONDITIONS)
        .filter(c => condArray.some(existing => conditionMatches(existing, c)));

    if (cureConditions.length > 0) {
        const filtered = condArray.filter(c =>
            !cureConditions.some(cc => conditionMatches(c, cc))
        );
        await setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);
    }

    postLogEntry(campaignName, {
        type: 'heal',
        characterName: playerName,
        targetName: targetName,
        amount: healAmount,
        abilityName: action.name,
        timestamp: Date.now(),
    });

    const cureMsg = cureConditions.length > 0
        ? ` Also removed: ${cureConditions.join(', ')}.`
        : '';

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${playerName} uses ${action.name} on ${targetName}. Returns to life with ${healAmount} HP. Expended ${costAmount} Focus Points.${cureMsg}`,
            automation: auto,
        },
    };
}
