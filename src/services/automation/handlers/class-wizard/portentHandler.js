import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { rollD20, rollExpression } from '../../../../services/dice/diceRoller.js';
import { infoPopup } from '../../common/infoPopup.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { findMostRecentRollAcrossCreatures } from '../../common/damageRollback.js';
import storage from '../../../ui/storage.js';

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

function buildPortentDescription(action, eventType, newDie, bonus, label, replacedValue, targetName, outcomeNote) {
    const originalTotal = replacedValue + bonus;
    const newTotal = newDie + bonus;

    let description = `Target: ${targetName}<br/>`;
    description += `${label}: Original d20(${replacedValue}) + ${bonus} = ${originalTotal}`;
    description += ` → Portent d20(${newDie}) + ${bonus} = <strong>${newTotal}</strong>`;
    if (outcomeNote) {
        description += `<br/><i>${outcomeNote}</i>`;
    }

    return description;
}

function getEventLabel(eventData, eventType) {
    if (eventType === 'attack') {
        const acLabel = eventData.targetName || 'unknown';
        return `Attack vs ${acLabel}`;
    }
    if (eventType === 'ability') {
        return eventData.checkName || 'Ability check';
    }
    return eventData.saveType ? eventData.saveType.toUpperCase() : 'Save';
}

function computeHitOutcome(eventData, chosenDie, bonus) {
    const targetAc = eventData.targetAc;
    if (targetAc == null) return null;
    const newHit = (chosenDie + bonus) >= targetAc;
    if (eventData.hit && !newHit) return 'The attack now misses!';
    if (!eventData.hit && newHit) return 'The attack now hits!';
    if (eventData.hit && newHit) return 'The attack still hits.';
    return 'The attack still misses.';
}

async function findMostRecentEvent(campaignName) {
    const result = await findMostRecentRollAcrossCreatures(campaignName);
    if (!result) return null;

    const lastAttack = result.eventData;

    return {
        creatureName: result.creatureName,
        eventType: result.eventType,
        eventData: lastAttack,
        context: {
            damageFormula: lastAttack?.damageFormula || null,
            damageType: lastAttack?.damageType || null,
            saveDc: lastAttack?.saveDc || null,
            oldSuccess: lastAttack?.rollType === 'save' ? (lastAttack?.saveResult === 'success') : null,
            oldHit: lastAttack?.hit ?? null,
        },
    };
}

async function handle(action, playerStats, campaignName, _mapName) {
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

    const result = await findMostRecentEvent(campaignName);
    if (!result) {
        return infoPopup(action.name, `No recent D20 test found. Portent can only be used on a recent attack roll, ability check, or saving throw.`, auto);
    }

    const diceOptions = [...portentDice].sort((a, b) => b - a);

    return {
        type: 'modal',
        modalName: 'portentDiceChoice',
        payload: {
            action,
            playerStats,
            campaignName,
            targetName: result.creatureName,
            eventType: result.eventType,
            eventData: result.eventData,
            context: result.context,
            diceOptions,
        },
    };
}

async function applyPortentChoice(action, playerStats, campaignName, targetName, eventType, eventData, context, chosenDie) {
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

    const { d20: originalD20, bonus } = eventData;
    const label = getEventLabel(eventData, eventType);
    let outcomeNote = null;
    let damageRolled = null;

    if (eventType === 'attack') {
        const targetAc = eventData.targetAc;
        const newHit = targetAc != null ? (chosenDie + bonus >= targetAc) : eventData.hit;
        outcomeNote = computeHitOutcome(eventData, chosenDie, bonus);

        // Update combatSummary.lastAttack with the replaced d20
        const cs = await getCombatContext(campaignName);
        if (cs?.lastAttack) {
            cs.lastAttack = {
                ...cs.lastAttack,
                d20: chosenDie,
                hit: newHit,
                portentUsed: true,
                portentOriginalD20: originalD20,
                timestamp: Date.now(),
            };
            storage.set('combatSummary', cs, campaignName);
        }

        // Miss→hit: trigger damage
        if (!eventData.hit && newHit) {
            const damageFormula = context?.damageFormula || null;
            if (damageFormula) {
                const dmgResult = rollExpression(damageFormula);
                if (dmgResult && dmgResult.total > 0) {
                    const cs = await getCombatContext(campaignName);
                    const characters = [playerStats];
                    try {
                        const appliedDmg = applyDamageToTarget(cs, eventData.targetName, dmgResult.total, [context?.damageType || 'unknown'], campaignName, characters, false, playerName);
                        if (appliedDmg) {
                            damageRolled = dmgResult.total;
                        }
                    } catch (e) {
                        console.error('[portent] applyDamageToTarget failed:', e);
                    }
                }
            }
        }

        // Hit→miss: undo damage using lastAttack's rawDamage
        if (eventData.hit && !newHit) {
            const rawDamage = eventData.primaryDamage || eventData.rawDamage || 0;
            if (rawDamage > 0 && eventData.targetName && eventData.attackerName === targetName) {
                const currentHp = getRuntimeValue(eventData.targetName, 'currentHitPoints', campaignName);
                const maxHp = getRuntimeValue(eventData.targetName, 'maxHitPoints', campaignName);
                if (currentHp != null) {
                    const healedHp = Math.min(currentHp + rawDamage, maxHp != null ? maxHp : 99999);
                    setRuntimeValue(eventData.targetName, 'currentHitPoints', healedHp, campaignName);
                    outcomeNote = `${outcomeNote} Undid ${rawDamage} damage.`;
                }
            }
        }
    } else if (eventType === 'ability') {
        // Portent on ability check — no runtime key update needed, lastAttack is the source of truth
    } else {
        const saveDc = context?.saveDc || null;
        const newTotal = chosenDie + bonus;
        let saveNote = null;
        if (saveDc != null && context?.oldSuccess != null) {
            const newSuccess = newTotal >= saveDc;
            if (context.oldSuccess && !newSuccess) saveNote = 'The save now fails!';
            else if (!context.oldSuccess && newSuccess) saveNote = 'The save now succeeds!';
        }

        if (saveNote) outcomeNote = saveNote;
    }

    setRuntimeValue(playerName, 'portentUsedThisTurn', true, campaignName);

    let logDesc = `${playerName} used ${action.name} on ${targetName}: replaced d20 with ${chosenDie}. Dice remaining: ${remainingDice.length}.`;
    if (damageRolled != null) logDesc += ` Damage rolled: ${damageRolled}.`;
    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: logDesc,
        portentDie: chosenDie,
        targetName,
        diceRemaining: remainingDice.length,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[portent] Error:", e); });

    const description = buildPortentDescription(action, eventType, chosenDie, bonus, label, originalD20, targetName, outcomeNote);
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
