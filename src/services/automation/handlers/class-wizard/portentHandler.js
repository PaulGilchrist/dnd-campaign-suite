import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getLastAttackRoll, getLastAbilityCheck, getLastSaveRoll } from '../../../../hooks/combat/useMetamagic.js';
import { rollD20 } from '../../../../services/dice/diceRoller.js';
import { infoPopup } from '../../common/infoPopup.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

function getPortentDice(playerName, campaignName) {
    const stored = getRuntimeValue(playerName, 'portentDice', campaignName);
    if (!stored) return [];
    try {
        const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function setPortentDice(playerName, dice, campaignName) {
    setRuntimeValue(playerName, 'portentDice', JSON.stringify(dice), campaignName);
}

function buildPortentDescription(action, d20, bonus, label, replacedValue) {
    const originalTotal = replacedValue + bonus;
    const newTotal = d20 + bonus;

    let description = `<b>${action.name}</b><br/>`;
    description += `${label}: Original d20(${replacedValue}) + ${bonus} = ${originalTotal}`;
    description += ` → Portent d20(${d20}) + ${bonus} = <strong>${newTotal}</strong>`;

    return description;
}

async function handle(action, playerStats, campaignName, _mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    // Get available Portent dice
    const portentDice = getPortentDice(playerName, campaignName);
    if (portentDice.length === 0) {
        return infoPopup(action.name, `${action.name}: No foretelling rolls remaining. Replenished on a Long Rest.`, auto);
    }

    // Find the most recent d20 test (attack, ability check, or save)
    const attackEvent = getLastAttackRoll(playerName);
    const abilityEvent = getLastAbilityCheck(playerName);
    const saveEvent = getLastSaveRoll(playerName);

    const attackFresh = attackEvent && !isStale(attackEvent);
    const abilityFresh = abilityEvent && !isStale(abilityEvent);
    const saveFresh = saveEvent && !isStale(saveEvent);

    if (!attackFresh && !abilityFresh && !saveFresh) {
        return infoPopup(action.name, `No recent D20 test found for ${playerName}. Portent can only be used shortly after a failed attack roll, ability check, or saving throw.`, auto);
    }

    // Pick the highest Portent die to use
    const sortedDice = [...portentDice].sort((a, b) => b - a);
    const chosenDie = sortedDice[0];
    const remainingDice = sortedDice.slice(1);
    setPortentDice(playerName, remainingDice, campaignName);

    let description;

    if (attackFresh) {
        const { d20: originalD20, bonus, targetName } = attackEvent;
        description = buildPortentDescription(action, chosenDie, bonus, `Attack vs AC ${targetName || 'unknown'}`, originalD20);
    } else if (abilityFresh) {
        const { d20: originalD20, bonus, checkName } = abilityEvent;
        description = buildPortentDescription(action, chosenDie, bonus, checkName, originalD20);
    } else {
        const { d20: originalD20, bonus, saveType } = saveEvent;
        const saveLabel = saveType ? saveType.toUpperCase() : 'Save';
        description = buildPortentDescription(action, chosenDie, bonus, saveLabel, originalD20);
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name}: replaced d20 with ${chosenDie}. Dice remaining: ${remainingDice.length}.`,
        portentDie: chosenDie,
        diceRemaining: remainingDice.length,
        timestamp: Date.now(),
    }).catch(function(e) {
                            console.error("[automation] Failed to log entry:", e);
                            throw e;
                        });

    return infoPopup(action.name, description, auto);
}

async function refreshPortentDice(playerName, campaignName, playerStats) {
    const maxDice = (playerStats.level >= 14) ? 3 : 2;
    const dice = [];
    for (let i = 0; i < maxDice; i++) {
        dice.push(rollD20());
    }
    setPortentDice(playerName, dice, campaignName);
    return dice;
}

export { handle, getPortentDice, setPortentDice, refreshPortentDice };
