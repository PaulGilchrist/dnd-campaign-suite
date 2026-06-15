import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getLastAttackRoll, getLastAbilityCheck, getLastSaveRoll } from '../../../hooks/useMetamagic.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

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
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires at least 1 Lucid Point. You have ${currentLP} remaining.`,
                automation: auto,
            },
        };
    }

    const attackEvent = getLastAttackRoll(playerName);
    const abilityEvent = getLastAbilityCheck(playerName);
    const saveEvent = getLastSaveRoll(playerName);

    const attackFresh = attackEvent && !isStale(attackEvent);
    const abilityFresh = abilityEvent && !isStale(abilityEvent);
    const saveFresh = saveEvent && !isStale(saveEvent);

    if (!attackFresh && !abilityFresh && !saveFresh) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent D20 test found for ${playerName}. This feature can only be used shortly after a failed attack roll, ability check, or saving throw.`,
                automation: auto,
            },
        };
    }

    let description;

    if (attackFresh) {
        const { d20, bonus, targetName } = attackEvent;
        description = buildLuckyDescription(action, d20, bonus, `Attack vs AC ${targetName || 'unknown'}`, effectType);
    } else if (abilityFresh) {
        const { d20, bonus, checkName } = abilityEvent;
        description = buildLuckyDescription(action, d20, bonus, checkName || 'Ability check', effectType);
    } else {
        const { d20, bonus, saveType } = saveEvent;
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
    }).catch(() => {});

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: action.name, description, automation: auto },
    };
}
