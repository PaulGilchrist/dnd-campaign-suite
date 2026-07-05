import { addEntry } from '../../../ui/logService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getDistanceFeet, rangeToFeet, getNearestPlacedItem } from '../../../rules/combat/rangeValidation.js';
import * as mapsService from '../../../maps/mapsService.js';
import { infoPopup } from '../../common/infoPopup.js';
import { removeCondition } from '../../../combat/conditions/conditionSaveService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

async function checkRange(campaignName, mapName, rangeFt, sourceName, targetName) {
    if (!mapName || !rangeFt) return true;

    try {
        const mapData = await mapsService.loadMapData(campaignName, mapName);
        if (!mapData) return true;

        // Find source position (bard)
        const sourcePlayer = mapData?.players?.find(p => p.name === sourceName);
        if (!sourcePlayer) return true;
        const sourcePos = { gridX: sourcePlayer.gridX, gridY: sourcePlayer.gridY };

        // Find target position — check players first, then placedItems for NPCs
        const targetPlayer = mapData?.players?.find(p => p.name === targetName);
        const targetNpc = mapData?.placedItems?.length
            ? getNearestPlacedItem(mapData.placedItems, targetName, sourcePos)
            : null;
        const targetPos = targetPlayer
            ? { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY }
            : targetNpc ? { gridX: targetNpc.gridX, gridY: targetNpc.gridY } : null;

        if (!targetPos) return true;

        const dist = getDistanceFeet(sourcePos, targetPos);
        if (dist == null) return true;
        return dist <= rangeFt;
    } catch {
        return true;
    }
}

async function findRecentRoll(playerStats, campaignName, mapName, rangeFt) {
    const playerName = playerStats.name;
    const attackResult = await findLastAttack(campaignName);
    const attackEvent = attackResult.attackEvent;

    if (!attackEvent) return null;

    const rollType = attackEvent.rollType;

    // Determine which creature made the roll (the one Countercharm targets)
    // For saves: the target of the spell made the save
    // For attacks/checks: the attacker made the roll
    const rollerName = rollType === 'save' ? attackResult.targetName : attackResult.attackerName;

    if (!rollerName) return null;

    // Range check: bard to the creature who made the roll
    const inRange = await checkRange(campaignName, mapName, rangeFt, playerName, rollerName);
    if (!inRange) return null;

    return {
        name: rollerName,
        event: attackEvent,
        type: rollType,
    };
}

function computeReroll(rollEvent) {
    const d20 = rollEvent.d20;
    const bonus = rollEvent.bonus || 0;
    const newD20 = Math.floor(Math.random() * 20) + 1;
    const rerolledD20 = Math.max(d20, newD20);
    const newTotal = rerolledD20 + bonus;
    return { rerolledD20, newTotal };
}

function computeOutcome(rollEvent, rerolledD20, newTotal) {
    const { d20, bonus } = rollEvent;
    const originalTotal = d20 + bonus;

    if (rollEvent.rollType === 'attack') {
        const { targetAc, hit } = rollEvent;
        const newHit = newTotal >= targetAc;
        if (hit === false && newHit) {
            return { outcome: 'success', effect: 'turned a miss into a hit' };
        } else if (hit === true) {
            return { outcome: 'no effect', effect: 'roll already succeeded' };
        } else {
            return { outcome: 'failure', effect: 'still a miss' };
        }
    } else if (rollEvent.rollType === 'save') {
        const { saveDc, saveResult } = rollEvent;
        const newSuccess = newTotal >= saveDc;
        const oldSuccess = saveResult === 'success';
        if (!oldSuccess && newSuccess) {
            return { outcome: 'success', effect: 'turned a failure into a success' };
        } else if (oldSuccess) {
            return { outcome: 'no effect', effect: 'save already succeeded' };
        } else {
            return { outcome: 'failure', effect: 'still a failure' };
        }
    } else {
        // check or skill
        if (newTotal > originalTotal) {
            return { outcome: 'success', effect: 'improved the result' };
        } else {
            return { outcome: 'no effect', effect: 'result unchanged' };
        }
    }
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Countercharm';

    const rangeFt = rangeToFeet(auto.range || '30 ft');
    const result = await findRecentRoll(playerStats, campaignName, mapName, rangeFt);

    if (!result) {
        return infoPopup(featureName, `No recent D20 test found. ${featureName} must be used as a reaction shortly after a failed attack roll, ability check, or saving throw.`, auto);
    }

    const { name: targetName, event: rollEvent, type: rollType } = result;
    const { rerolledD20, newTotal } = computeReroll(rollEvent);

    let description = `<b>${featureName}</b><br/>Target: ${targetName}<br/>`;

    if (rollType === 'attack') {
        const { d20, bonus, targetAc, hit } = rollEvent;
        const originalTotal = d20 + bonus;

        description += `Original roll: d20(${d20}) + ${bonus} = ${originalTotal} vs AC ${targetAc != null ? targetAc : '\u2014'} → ${hit ? 'HIT' : 'MISS'}<br/>`;
        description += `Reroll with Advantage: d20(${rerolledD20}) + ${bonus} = ${newTotal} vs AC ${targetAc != null ? targetAc : '\u2014'} → ${newTotal >= targetAc ? 'HIT' : 'MISS'}<br/>`;

        if (hit === false && newTotal >= targetAc) {
            description += `<br/><i>Countercharm turned a miss into a hit!</i>`;
        } else if (hit === true) {
            description += `<br/><i>The roll already succeeded — Countercharm has no effect.</i>`;
        } else {
            description += `<br/><i>Still a miss.</i>`;
        }
    } else if (rollType === 'save') {
        const { d20, bonus, saveDc, saveResult, saveType } = rollEvent;
        const originalTotal = d20 + bonus;
        const saveLabel = saveType ? `${saveType} save` : 'save';
        const oldSuccess = saveResult === 'success';
        const newSuccess = newTotal >= saveDc;

        description += `Original ${saveLabel}: d20(${d20}) + ${bonus} = ${originalTotal} vs DC ${saveDc} → ${oldSuccess ? 'Succeeded' : 'Failed'}<br/>`;
        description += `Reroll with Advantage: d20(${rerolledD20}) + ${bonus} = ${newTotal} vs DC ${saveDc} → ${newSuccess ? 'Succeeded' : 'Failed'}<br/>`;

        if (!oldSuccess && newSuccess) {
            description += `<br/><i>Countercharm turned a failure into a success!</i>`;
        } else if (oldSuccess) {
            description += `<br/><i>The save already succeeded — Countercharm has no effect.</i>`;
        } else {
            description += `<br/><i>Still a failure.</i>`;
        }
    } else {
        // check or skill
        const { d20, bonus, checkName } = rollEvent;
        const originalTotal = d20 + bonus;

        description += `${checkName || 'Ability check'}: d20(${d20}) + ${bonus} = ${originalTotal}<br/>`;
        description += `Reroll with Advantage: d20(${rerolledD20}) + ${bonus} = <b>${newTotal}</b>`;

        if (newTotal > originalTotal) {
            description += `<br/><i>The reroll improved the result!</i>`;
        }
    }

    const { outcome, effect } = computeOutcome(rollEvent, rerolledD20, newTotal);

    const cs = await getCombatContext(campaignName);
    const sourceCreature = cs?.creatures?.find(c => c.name === playerName);
    const targetCreature = cs?.creatures?.find(c => c.name === targetName);

    // Remove charmed/frightened condition if save succeeded
    if (rollType === 'save') {
        const { saveResult } = rollEvent;
        const oldSuccess = saveResult === 'success';
        const newSuccess = newTotal >= rollEvent.saveDc;
        if (!oldSuccess && newSuccess) {
            await removeCondition(cs, targetName, 'charmed', getRuntimeValue, setRuntimeValue, campaignName);
            await removeCondition(cs, targetName, 'frightened', getRuntimeValue, setRuntimeValue, campaignName);
        }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} on ${targetName} (${rollType}). Source: ${sourceCreature?.type || 'unknown'}, Target: ${targetCreature?.type || 'unknown'}. ${effect}. Outcome: ${outcome}.`,
        targetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[countercharm] Error:", e); });

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: featureName, description, automation: auto },
    };
}
