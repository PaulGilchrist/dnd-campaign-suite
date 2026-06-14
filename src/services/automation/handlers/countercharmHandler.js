import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getLastAttackRoll, getLastAbilityCheck } from '../../../hooks/useMetamagic.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';
import { getDistanceFeet, rangeToFeet } from '../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../common/targetResolver.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

function findRecentFailedSave(playerStats, campaignName, mapName, rangeFt) {
    const playerName = playerStats.name;

    const checkSelf = () => {
        const attackEvent = getLastAttackRoll(playerName);
        if (attackEvent && !isStale(attackEvent)) {
            return { name: playerName, event: attackEvent, type: 'attack_roll' };
        }
        const abilityEvent = getLastAbilityCheck(playerName);
        if (abilityEvent && !isStale(abilityEvent)) {
            return { name: playerName, event: abilityEvent, type: 'ability_check' };
        }
        return null;
    };

    const selfResult = checkSelf();
    if (selfResult) return selfResult;

    if (!rangeFt) return null;

    const findAlly = async () => {
        const combatSummary = await getCombatContext(campaignName);
        if (!combatSummary?.creatures) return null;

        for (const creature of combatSummary.creatures) {
            if (creature.name === playerName) continue;

            const attackEvent = getLastAttackRoll(creature.name);
            if (attackEvent && !isStale(attackEvent)) {
                if (mapName && rangeFt != null) {
                    const positions = await resolveMapPositions(campaignName, mapName, playerName);
                    if (positions?.attackerPos && positions?.targetPos) {
                        const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
                        if (dist != null && dist > rangeFt) continue;
                    }
                }
                return { name: creature.name, event: attackEvent, type: 'attack_roll' };
            }

            const abilityEvent = getLastAbilityCheck(creature.name);
            if (abilityEvent && !isStale(abilityEvent)) {
                if (mapName && rangeFt != null) {
                    const positions = await resolveMapPositions(campaignName, mapName, playerName);
                    if (positions?.attackerPos && positions?.targetPos) {
                        const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
                        if (dist != null && dist > rangeFt) continue;
                    }
                }
                return { name: creature.name, event: abilityEvent, type: 'ability_check' };
            }
        }
        return null;
    };

    return findAlly();
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Countercharm';

    const usesKey = getRuntimeUsesKey(featureName);
    const usesMax = auto.uses || 1;

    if (usesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);
        if (currentUses <= 0) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: featureName,
                    description: `${featureName} has no uses remaining. Recharges on a Long Rest.`,
                    automation: auto,
                },
            };
        }
    }

    const rangeFt = rangeToFeet(auto.range || '30 ft');
    const result = await findRecentFailedSave(playerStats, campaignName, mapName, rangeFt);

    if (!result) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No recent save (attack roll or ability check) found for you or any ally within ${auto.range || '30 ft'}. ${featureName} must be used shortly after a failed save against a Charmed or Frightened effect.`,
                automation: auto,
            },
        };
    }

    const { name: targetName, event: saveEvent, type: saveType } = result;

    let description = `<b>${featureName}</b><br/>Target: ${targetName}<br/>`;

    if (saveType === 'attack_roll') {
        const { d20, bonus, targetAc, hit } = saveEvent;
        const originalTotal = d20 + bonus;
        const newD20 = Math.floor(Math.random() * 20) + 1;
        const newTotal = Math.max(d20, newD20) + bonus;

        description += `Original save: d20(${d20}) + ${bonus} = ${originalTotal} vs AC ${targetAc != null ? targetAc : '\u2014'}\u2192 ${hit ? 'HIT' : 'MISS'}<br/>`;
        description += `Reroll with Advantage: d20(${newD20}) + ${bonus} = ${newTotal} vs AC ${targetAc != null ? targetAc : '\u2014'}\u2192 ${newTotal >= targetAc ? 'HIT' : 'MISS'}<br/>`;

        if (hit === false && newTotal >= targetAc) {
            description += `<br/><i>Countercharm turned a miss into a hit!</i>`;
        } else if (hit === true) {
            description += `<br/><i>The save already succeeded \u2014 Countercharm has no effect.</i>`;
        } else if (newTotal < targetAc) {
            description += `<br/><i>Still a miss.</i>`;
        }
    } else {
        const { d20, bonus, checkName } = saveEvent;
        const originalTotal = d20 + bonus;
        const newD20 = Math.floor(Math.random() * 20) + 1;
        const newTotal = Math.max(d20, newD20) + bonus;

        description += `${checkName}: d20(${d20}) + ${bonus} = ${originalTotal}<br/>`;
        description += `Reroll with Advantage: d20(${newD20}) + ${bonus} = <b>${newTotal}</b>`;

        if (newTotal > originalTotal) {
            description += `<br/><i>The reroll improved the result!</i>`;
        }
    }

    if (usesMax > 0) {
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);
        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} on ${targetName}.`,
        targetName,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: { type: 'automation_info', name: featureName, description, automation: auto },
    };
}
