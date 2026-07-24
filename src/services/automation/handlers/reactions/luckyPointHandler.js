import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { infoPopup } from '../../common/infoPopup.js';

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const effectType = auto.effect || 'advantage';
    const effectLabel = effectType === 'advantage' ? 'Advantage' : 'Disadvantage';

    const maxLP = playerStats._trackedResources?.luckyPoints?.max || 0;
    const currentLP = Number(getRuntimeValue(playerName, 'luckyPoints', campaignName) ?? maxLP);
    if (currentLP <= 0) {
        return infoPopup('Lucky Feat', `Requires at least 1 Luck Point. You have ${currentLP} remaining.`, auto);
    }

    await setRuntimeValue(playerName, 'luckyPoints', currentLP - 1, campaignName);

    if (effectType === 'advantage') {
        await setRuntimeValue(playerName, 'luckyAdvantageActive', true, campaignName);
    } else {
        await setRuntimeValue(playerName, 'luckyDisadvantageActive', true, campaignName);
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: 'Lucky Feat',
        description: `${playerName} used Lucky Feat — ${effectLabel} active on next d20 test (1 LP spent, ${currentLP - 1} LP remaining).`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[luckyPoint] Error:", e); });

    const popupMessage = effectType === 'advantage'
        ? 'Advantage on next d20 test.'
        : 'Disadvantage on next d20 attack roll against you.';

    return infoPopup('Lucky Feat', popupMessage, auto);
}
