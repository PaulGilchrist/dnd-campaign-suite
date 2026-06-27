import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { infoPopup } from '../../common/infoPopup.js';

function buildLuckyDescription(action, d20, bonus, label, effectType) {
    const originalTotal = d20 + bonus;
    const effectLabel = effectType === 'advantage' ? 'Advantage' : 'Disadvantage';
    let description = `<b>${action.name}</b><br/>`;
    description += `${label}: d20(${d20}) + ${bonus} = ${originalTotal}`;
    description += ` → <strong>${effectLabel}</strong>`;
    return description;
}

export async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const effectType = auto.effect || 'advantage';

    const maxLP = playerStats._trackedResources?.luckyPoints?.max || 0;
    const currentLP = Number(getRuntimeValue(playerName, 'luckyPoints', campaignName) ?? maxLP);
    if (currentLP <= 0) {
        return infoPopup(action.name, `${action.name} requires at least 1 Lucid Point. You have ${currentLP} remaining.`, auto);
    }

    const cs = await getCombatContext(campaignName);
    const lastAttack = cs?.lastAttack || null;

    const isPlayerRoll = lastAttack?.attackerName === playerName;
    const attackFresh = lastAttack?.rollType === 'attack' && isPlayerRoll;
    const abilityFresh = (lastAttack?.rollType === 'check' || lastAttack?.rollType === 'skill') && isPlayerRoll;
    const saveFresh = lastAttack?.rollType === 'save' && isPlayerRoll;

    if (!attackFresh && !abilityFresh && !saveFresh) {
        return infoPopup(action.name, `No recent D20 test found for ${playerName}. This feature can only be used shortly after a failed attack roll, ability check, or saving throw.`, auto);
    }

    let description;

    if (attackFresh) {
        const { d20, bonus, targetName } = lastAttack;
        description = buildLuckyDescription(action, d20, bonus, `Attack vs AC ${targetName || 'unknown'}`, effectType);
    } else if (abilityFresh) {
        const { d20, bonus, checkName } = lastAttack;
        description = buildLuckyDescription(action, d20, bonus, checkName || 'Ability check', effectType);
    } else {
        const { d20, bonus, saveType } = lastAttack;
        const saveLabel = saveType ? `${saveType.toUpperCase()} save` : 'Saving throw';
        description = buildLuckyDescription(action, d20, bonus, saveLabel, effectType);
    }

    await setRuntimeValue(playerName, 'luckyPoints', currentLP - 1, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} to apply ${effectType} on a D20 test.`,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[luckyPoint] Error:", e); });

    return infoPopup(action.name, description, auto);
}
