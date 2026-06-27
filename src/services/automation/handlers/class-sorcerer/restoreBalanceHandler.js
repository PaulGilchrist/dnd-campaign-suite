import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions, resolveTarget } from '../../common/targetResolver.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';

function getRuntimeUsesKey(featureName) {
    return featureName.toLowerCase().replace(/\s+/g, '') + 'Uses';
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

    const currentUses = Number(getRuntimeValue(playerName, usesKey) ?? usesMax);

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

    const cs = await getCombatContext(campaignName);
    const lastAttack = cs?.lastAttack || null;

    const isTargetRoll = lastAttack?.attackerName === targetName;
    const attackFresh = lastAttack?.rollType === 'attack' && isTargetRoll;
    const abilityFresh = (lastAttack?.rollType === 'check' || lastAttack?.rollType === 'skill') && isTargetRoll;
    const saveFresh = lastAttack?.rollType === 'save' && isTargetRoll;

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
        const { d20, bonus, targetAc, hit } = lastAttack;
        const ac = targetAc;
        rollDescription = `Attack roll: d20(${d20}) + ${bonus} = ${d20 + bonus} vs AC ${ac != null ? ac : '—'} → ${hit ? 'HIT' : 'MISS'}`;
    } else if (abilityFresh) {
        const { d20, bonus, checkName } = lastAttack;
        rollDescription = `${checkName}: d20(${d20}) + ${bonus} = ${d20 + bonus}`;
    } else {
        const { d20, bonus, saveType } = lastAttack;
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
    }).catch((e) => { console.error("[restoreBalance] Error:", e); });

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
