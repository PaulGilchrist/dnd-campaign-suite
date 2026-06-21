import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollD20 } from '../../../../services/dice/diceRoller.js';
import { infoPopup } from '../../common/infoPopup.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

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

function buildPortentDescription(action, d20, bonus, label, replacedValue, targetName, outcomeNote) {
    const originalTotal = replacedValue + bonus;
    const newTotal = d20 + bonus;

    let description = `<b>${action.name}</b><br/>`;
    description += `Target: ${targetName}<br/>`;
    description += `${label}: Original d20(${replacedValue}) + ${bonus} = ${originalTotal}`;
    description += ` → Portent d20(${d20}) + ${bonus} = <strong>${newTotal}</strong>`;
    if (outcomeNote) {
        description += `<br/><i>${outcomeNote}</i>`;
    }

    return description;
}

function getRollEvents(targetName, campaignName) {
    const attackEvent = getRuntimeValue(targetName, 'lastAttackRoll', campaignName);
    const abilityEvent = getRuntimeValue(targetName, 'lastAbilityCheck', campaignName);
    const saveEvent = getRuntimeValue(targetName, 'lastSaveRoll', campaignName);
    return { attackEvent, abilityEvent, saveEvent };
}

function updateStoredRoll(targetName, campaignName, eventType, newEvent) {
    setRuntimeValue(targetName, eventType, newEvent, campaignName);
}

function getEventDetails(event, eventType) {
    const { d20: originalD20, bonus } = event;
    let label;
    if (eventType === 'attack') {
        label = `Attack vs AC ${event.targetName || 'unknown'}`;
    } else if (eventType === 'ability') {
        label = event.checkName || 'Ability check';
    } else {
        label = event.saveType ? event.saveType.toUpperCase() : 'Save';
    }
    return { originalD20, bonus, label };
}

function computeOutcomeNote(eventType, eventData, chosenDie, bonus) {
    if (eventType !== 'attack') return null;
    const targetAc = eventData.targetAc;
    if (targetAc == null) return null;
    const newHit = (chosenDie + bonus) >= targetAc;
    if (eventData.hit && !newHit) return 'The attack now misses!';
    if (!eventData.hit && newHit) return 'The attack now hits!';
    if (eventData.hit && newHit) return 'The attack still hits.';
    return 'The attack still misses.';
}

async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const portentDice = getPortentDice(playerName, campaignName);
    if (portentDice.length === 0) {
        return infoPopup(action.name, `${action.name}: No foretelling rolls remaining. Replenished on a Long Rest.`, auto);
    }

    const usedThisTurn = getRuntimeValue(playerName, 'portentUsedThisTurn', campaignName);
    if (usedThisTurn) {
        return infoPopup(action.name, `${action.name} can only be used once per turn.`, auto);
    }

    let targetName = playerName;
    if (mapName) {
        const targetInfo = await resolveTarget(campaignName, playerName);
        if (targetInfo?.target) {
            targetName = targetInfo.target.name;
        }
    }

    let attackEvent, abilityEvent, saveEvent;
    let attackFresh, abilityFresh, saveFresh;

    function readEvents(name) {
        const events = getRollEvents(name, campaignName);
        attackEvent = events.attackEvent;
        abilityEvent = events.abilityEvent;
        saveEvent = events.saveEvent;
        attackFresh = attackEvent && !isStale(attackEvent);
        abilityFresh = abilityEvent && !isStale(abilityEvent);
        saveFresh = saveEvent && !isStale(saveEvent);
    }

    readEvents(targetName);

    if (!attackFresh && !abilityFresh && !saveFresh && targetName !== playerName) {
        readEvents(playerName);
        if (attackFresh || abilityFresh || saveFresh) {
            targetName = playerName;
        }
    }

    if (!attackFresh && !abilityFresh && !saveFresh && targetName === playerName) {
        const cs = await getCombatContext(campaignName);
        if (cs?.creatures) {
            for (const creature of cs.creatures) {
                if (creature.name === playerName) continue;
                const ae = getRuntimeValue(creature.name, 'lastAttackRoll', campaignName);
                if (ae && ae.targetName === playerName && !isStale(ae)) {
                    targetName = creature.name;
                    readEvents(targetName);
                    break;
                }
            }
        }
    }

    let eventType, eventData;
    if (attackFresh) {
        eventType = 'attack';
        eventData = attackEvent;
    } else if (abilityFresh) {
        eventType = 'ability';
        eventData = abilityEvent;
    } else if (saveFresh) {
        eventType = 'save';
        eventData = saveEvent;
    } else {
        return infoPopup(action.name, `No recent D20 test found for ${targetName}. Portent can only be used on a recent attack roll, ability check, or saving throw.`, auto);
    }

    const diceOptions = [...portentDice].sort((a, b) => b - a);

    return {
        type: 'modal',
        modalName: 'portentDiceChoice',
        payload: {
            action,
            playerStats,
            campaignName,
            targetName,
            eventType,
            eventData,
            diceOptions,
        },
    };
}

async function applyPortentChoice(action, playerStats, campaignName, targetName, eventType, eventData, chosenDie) {
    const playerName = playerStats.name;

    const portentDice = getPortentDice(playerName, campaignName);
    const dieIndex = portentDice.indexOf(chosenDie);
    let remainingDice;
    if (dieIndex !== -1) {
        remainingDice = [...portentDice];
        remainingDice.splice(dieIndex, 1);
    } else {
        const sortedDice = [...portentDice].sort((a, b) => b - a);
        remainingDice = sortedDice.slice(1);
    }
    setPortentDice(playerName, remainingDice, campaignName);

    const { originalD20, bonus, label } = getEventDetails(eventData, eventType);
    const outcomeNote = computeOutcomeNote(eventType, eventData, chosenDie, bonus);

    if (eventType === 'attack') {
        const targetAc = eventData.targetAc;
        const newHit = targetAc != null ? (chosenDie + bonus >= targetAc) : eventData.hit;
        updateStoredRoll(targetName, campaignName, 'lastAttackRoll', {
            ...eventData,
            d20: chosenDie,
            hit: newHit,
            portentUsed: true,
            portentOriginalD20: originalD20,
            timestamp: Date.now(),
        });
    } else if (eventType === 'ability') {
        updateStoredRoll(targetName, campaignName, 'lastAbilityCheck', {
            ...eventData,
            d20: chosenDie,
            portentUsed: true,
            portentOriginalD20: originalD20,
            timestamp: Date.now(),
        });
    } else {
        updateStoredRoll(targetName, campaignName, 'lastSaveRoll', {
            ...eventData,
            d20: chosenDie,
            portentUsed: true,
            portentOriginalD20: originalD20,
            timestamp: Date.now(),
        });
    }

    setRuntimeValue(playerName, 'portentUsedThisTurn', true, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} on ${targetName}: replaced d20 with ${chosenDie}. Dice remaining: ${remainingDice.length}.`,
        portentDie: chosenDie,
        targetName,
        diceRemaining: remainingDice.length,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[portent] Error:", e); throw e; });

    const description = buildPortentDescription(action, chosenDie, bonus, label, originalD20, targetName, outcomeNote);
    return infoPopup(action.name, description, action.automation);
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

export { handle, applyPortentChoice, getPortentDice, setPortentDice, refreshPortentDice };
