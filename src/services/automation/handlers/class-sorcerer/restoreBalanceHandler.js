import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions, resolveTarget } from '../../common/targetResolver.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';

const EVENT_STALENESS_MS = 60000;

function isStale(event) {
    if (!event?.timestamp) return true;
    return (Date.now() - event.timestamp) > EVENT_STALENESS_MS;
}

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
}

function getRuntimeRestTimestampKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'RestTimestamp';
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Restore Balance';

    const rangeFt = rangeToFeet(auto.range || '60_ft');

    const targetInfo = await resolveTarget(campaignName, playerName);
    if (!targetInfo?.target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `${featureName} requires selecting a creature in combat.`,
                automation: auto,
            },
        };
    }

    const targetName = targetInfo.target.name;

    if (mapName && rangeFt != null) {
        const positions = await resolveMapPositions(campaignName, mapName, playerName);
        if (positions?.attackerPos && positions?.targetPos) {
            const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
            if (dist != null && dist > rangeFt) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: featureName,
                        description: `${targetName} is out of range (${Math.round(dist)} ft > ${rangeFt} ft).`,
                        automation: auto,
                    },
                };
            }
        }
    }

    const chaMod = getAbilityModifier(playerStats.abilities, 'CHA');
    const usesMax = Math.max(1, chaMod);

    const usesKey = getRuntimeUsesKey(featureName);
    const restTimestampKey = getRuntimeRestTimestampKey(featureName);
    const lastRestTimestamp = getRuntimeValue(playerName, restTimestampKey, campaignName);
    const now = Date.now();

    let currentUses = 0;
    if (lastRestTimestamp && now - lastRestTimestamp < 86400000) {
        currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);
    } else if (!lastRestTimestamp) {
        currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);
    }

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

    const attackEvent = getRuntimeValue(targetName, 'lastAttackRoll', campaignName);
    const abilityEvent = getRuntimeValue(targetName, 'lastAbilityCheck', campaignName);
    const saveEvent = getRuntimeValue(targetName, 'lastSaveRoll', campaignName);

    const attackFresh = attackEvent && !isStale(attackEvent);
    const abilityFresh = abilityEvent && !isStale(abilityEvent);
    const saveFresh = saveEvent && !isStale(saveEvent);

    if (!attackFresh && !abilityFresh && !saveFresh) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No recent d20 roll found for ${targetName}. ${featureName} can only be used shortly after an attack roll, ability check, or saving throw.`,
                automation: auto,
            },
        };
    }

    let rollDescription;

    if (attackFresh) {
        const { d20, bonus, targetAc, hit } = attackEvent;
        const ac = targetAc;
        rollDescription = `Attack roll: d20(${d20}) + ${bonus} = ${d20 + bonus} vs AC ${ac != null ? ac : '—'} → ${hit ? 'HIT' : 'MISS'}`;
    } else if (abilityFresh) {
        const { d20, bonus, checkName } = abilityEvent;
        rollDescription = `${checkName}: d20(${d20}) + ${bonus} = ${d20 + bonus}`;
    } else {
        const { d20, bonus, saveType } = saveEvent;
        const saveLabel = saveType ? saveType.toUpperCase() : 'Save';
        rollDescription = `${saveLabel}: d20(${d20}) + ${bonus} = ${d20 + bonus}`;
    }

    const description = `<b>${featureName}</b><br/>Target: ${targetName}<br/>${rollDescription}<br/><i>Advantage/Disadvantage neutralized.</i>`;

    await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerName,
        abilityName: featureName,
        description: `${playerName} used ${featureName} on ${targetName}. Advantage/Disadvantage neutralized. Uses: ${currentUses - 1}/${usesMax}.`,
        timestamp: Date.now(),
    }).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            description,
            automation: auto,
        },
    };
}
