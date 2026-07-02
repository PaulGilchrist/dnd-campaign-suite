import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { infoPopup } from '../../common/infoPopup.js';

function buildStrokeOfLuckDescription(action, d20, bonus, label, rollType, saveDc, saveResult, hit, acTarget) {
    const originalTotal = d20 + bonus;
    const newTotal = 20 + bonus;

    let description = `<b>${action.name}</b><br/>`;
    description += `${label}: d20(${d20}) + ${bonus} = ${originalTotal}`;

    let outcomeNote = '';
    if (rollType === 'save') {
        const oldSuccess = saveResult === 'success';
        const newSuccess = (newTotal >= saveDc);
        if (oldSuccess && !newSuccess) {
            outcomeNote = ' The save now fails!';
        } else if (!oldSuccess && newSuccess) {
            outcomeNote = ' The save now succeeds!';
        } else {
            outcomeNote = oldSuccess ? ' The save still succeeds.' : ' The save still fails.';
        }
    } else if (rollType === 'attack') {
        const oldHit = hit;
        const newHit = (newTotal >= acTarget);
        if (oldHit && !newHit) {
            outcomeNote = ' The attack now misses!';
        } else if (!oldHit && newHit) {
            outcomeNote = ' The attack now hits!';
        } else {
            outcomeNote = oldHit ? ' The attack still hits.' : ' The attack still misses.';
        }
    }

    if (outcomeNote) {
        description += ` → <b>Turned into 20: d20(20) + ${bonus} = <strong>${newTotal}</strong></b>${outcomeNote}`;
    } else {
        description += ` → Already succeeded — no effect.`;
    }

    return description;
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Check usage limit: once per short or long rest
    const strokeOfLuckUsed = getRuntimeValue(playerName, 'strokeOfLuckUsed', campaignName);
    if (strokeOfLuckUsed) {
        return infoPopup(action.name, `${action.name} has no uses remaining. Recharges on a Short or Long Rest.`, auto);
    }

    // Find the most recent D20 test (attack, ability check, or save)
    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;

    if (!attackEvent) {
        return infoPopup(action.name, `No recent D20 test found. This feature can only be used shortly after a failed attack roll, ability check, or saving throw.`, auto);
    }

    const isPlayerTarget = attackResult.targetName === playerName;
    const isPlayerAttacker = attackResult.attackerName === playerName;

    if (!isPlayerTarget && !isPlayerAttacker) {
        return infoPopup(action.name, `No recent D20 test found for ${playerName}. This feature can only be used on your own rolls.`, auto);
    }

    const { d20, bonus, rollType, saveDc, saveResult, targetName: attackTargetName, hit, actionName, saveType, targetAc } = attackEvent;

    // Build appropriate label based on roll type
    let label;
    if (rollType === 'save') {
        label = saveType ? `${saveType} saving throw vs DC ${saveDc}` : (actionName || 'Saving throw') + ` vs DC ${saveDc || 'unknown'}`;
    } else if (rollType === 'check' || rollType === 'skill') {
        label = attackEvent.checkName || 'Ability check';
    } else {
        label = `Attack vs AC ${attackTargetName || 'unknown'}`;
    }

    const description = buildStrokeOfLuckDescription(action, d20, bonus, label, rollType, saveDc, saveResult, hit, targetAc);

    // Mark as used
    await setRuntimeValue(playerName, 'strokeOfLuckUsed', true, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to turn a D20 test into a 20.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[strokeOfLuck] Error:", e); });

    return infoPopup(action.name, description, auto);
}
