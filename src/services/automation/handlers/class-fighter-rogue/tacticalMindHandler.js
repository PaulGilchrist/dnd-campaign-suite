import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getLastAbilityCheck } from '../../../../hooks/combat/useMetamagic.js';
import { infoPopup } from '../../common/infoPopup.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const abilityEvent = getLastAbilityCheck(playerName);
    if (!abilityEvent || isStale(abilityEvent)) {
        return infoPopup(action.name, `No recent ability check found for ${playerName}. This feature can only be used shortly after an ability check.`, auto);
    }

    const { d20, bonus: checkBonus, checkName } = abilityEvent;
    const originalTotal = d20 + checkBonus;
    const d10Roll = Math.floor(Math.random() * 10) + 1;
    const modifiedTotal = originalTotal + d10Roll;

    if (d20 === 20) {
        return infoPopup(action.name, `${action.name}: Natural 20 — no bonus needed.`, auto);
    }

    const description = `<b>${action.name}</b><br/>` +
        `${checkName}: d20(${d20}) + ${checkBonus} = ${originalTotal}` +
        ` → +1d10(${d10Roll}) = <b>${modifiedTotal}</b>`;

    let currentUses = Number(getRuntimeValue(playerName, 'secondWindUses', campaignName) ?? 0);
    const maxUses = playerStats.class?.class_levels?.[(playerStats.level || 1) - 1]?.second_wind || 0;

    if (currentUses <= 0) {
        currentUses = maxUses;
        await setRuntimeValue(playerName, 'secondWindUses', currentUses, campaignName);
    }

    if (currentUses <= 0) {
        return infoPopup(action.name, `${action.name}: No Second Wind uses remaining.`, auto);
    }

    await setRuntimeValue(playerName, 'secondWindUses', currentUses - 1, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name}: +${d10Roll} to ${checkName} (d20 ${d20} + ${checkBonus} = ${originalTotal} → ${modifiedTotal}).`,
        d10Roll,
        timestamp: Date.now(),
    }).catch(() => {});

    return infoPopup(action.name, description, auto);
}

export { handle };
