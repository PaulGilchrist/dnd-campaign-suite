import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { infoPopup } from '../../common/infoPopup.js';

function buildBoonOfFateDescription(action, d20, bonus, label, modifier) {
    const originalTotal = d20 + bonus;
    const newTotal = originalTotal + modifier;

    const modifierLabel = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    let description = `<b>${action.name}</b><br/>`;
    description += `${label}: d20(${d20}) + ${bonus} = ${originalTotal}`;
    description += ` → ${modifierLabel}: d20(${d20}) + ${bonus} + ${modifierLabel} = <strong>${newTotal}</strong>`;

    return description;
}

export async function handle(action, playerStats, campaignName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const boonKey = 'boonOfFateUsed';

    const boonUsed = getRuntimeValue(playerName, boonKey, campaignName);
    if (boonUsed) {
        return infoPopup(action.name, `${action.name} has no uses remaining. Recharges on Initiative or Short or Long Rest.`, auto);
    }

    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;
    const attackFresh = attackEvent && attackResult.targetName === playerName;

    if (!attackFresh) {
        return infoPopup(action.name, `No recent D20 test found for ${playerName}. This feature can only be used shortly after a failed attack roll, ability check, or saving throw.`, auto);
    }

    const modifier = Math.floor(Math.random() * 4) + Math.floor(Math.random() * 4) + 1;

    const { d20, bonus, targetName } = attackEvent;
    const description = buildBoonOfFateDescription(action, d20, bonus, `Attack vs AC ${targetName || 'unknown'}`, modifier);

    await setRuntimeValue(playerName, boonKey, true, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to add ${modifier} to a D20 test.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[boonOfFate] Error:", e); throw e; });

    return infoPopup(action.name, description, auto);
}
