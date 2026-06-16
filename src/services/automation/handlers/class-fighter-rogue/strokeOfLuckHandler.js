import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getLastAttackRoll, getLastAbilityCheck, getLastSaveRoll } from '../../../../hooks/useMetamagic.js';
import { infoPopup } from '../../common/infoPopup.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

function buildStrokeOfLuckDescription(action, d20, bonus, label, wasFailure) {
    const originalTotal = d20 + bonus;
    const newTotal = 20 + bonus;

    let description = `<b>${action.name}</b><br/>`;
    description += `${label}: d20(${d20}) + ${bonus} = ${originalTotal}`;

    if (wasFailure) {
        description += ` → <b>Turned into 20: d20(20) + ${bonus} = <strong>${newTotal}</strong></b>`;
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

    // Find the most recent failed D20 test (attack, ability check, or save)
    const attackEvent = getLastAttackRoll(playerName);
    const abilityEvent = getLastAbilityCheck(playerName);
    const saveEvent = getLastSaveRoll(playerName);

    const attackFresh = attackEvent && !isStale(attackEvent);
    const abilityFresh = abilityEvent && !isStale(abilityEvent);
    const saveFresh = saveEvent && !isStale(saveEvent);

    if (!attackFresh && !abilityFresh && !saveFresh) {
        return infoPopup(action.name, `No recent D20 test found for ${playerName}. This feature can only be used shortly after a failed attack roll, ability check, or saving throw.`, auto);
    }

    let description;

    if (attackFresh) {
        const { d20, bonus, targetName, hit } = attackEvent;
        const wasFailure = !hit;
        description = buildStrokeOfLuckDescription(action, d20, bonus, `Attack vs AC ${targetName || 'unknown'}`, wasFailure);
    } else if (abilityFresh) {
        const { d20, bonus, checkName } = abilityEvent;
        description = buildStrokeOfLuckDescription(action, d20, bonus, checkName, false);
    } else {
        const { d20, bonus, saveType } = saveEvent;
        const saveLabel = saveType ? saveType.toUpperCase() : 'Save';
        description = buildStrokeOfLuckDescription(action, d20, bonus, saveLabel, false);
    }

    // Mark as used
    await setRuntimeValue(playerName, 'strokeOfLuckUsed', true, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to turn a D20 test into a 20.`,
        timestamp: Date.now(),
    }).catch(() => {});

    return infoPopup(action.name, description, auto);
}
