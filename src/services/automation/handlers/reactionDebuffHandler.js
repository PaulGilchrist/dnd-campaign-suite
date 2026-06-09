import { resolveTarget, resolveMapPositions } from '../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../../rules/rangeValidation.js';
import { getCombatContext } from '../../rules/damageUtils.js';
import { applyHealingToTarget } from '../../rules/applyHealing.js';
import { getLastDamageEvent } from '../../../hooks/useMetamagic.js';

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;

    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const bardicDieSize = classLevel?.bardic_die || 6;

    const usesMax = playerStats?.class?.class_levels?.[(playerStats.level || 1) - 1]?.bardic_inspiration_uses
        ?? (playerStats.proficiency || 0);

    if (usesMax > 0) {
        const usesUsed = Number(getRuntimeValue(playerName, 'bardicInspirationUses', campaignName) ?? 0);
        if (usesUsed >= usesMax) {
            return {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: action.name,
                    description: `${action.name} has no uses remaining. Recharges on a Long Rest.`,
                    automation: auto,
                },
            };
        }
    }

    const targetInfo = await resolveTarget(campaignName, playerName);
    if (!targetInfo?.target) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `${action.name} requires a target. Select a creature in combat and try again.`,
                automation: auto,
            },
        };
    }

    const attackerName = targetInfo.target.name;
    const rangeFt = rangeToFeet(auto.range || '60_ft');

    if (mapName && rangeFt != null) {
        const positions = await resolveMapPositions(campaignName, mapName, playerName);
        if (positions?.attackerPos && positions?.targetPos) {
            const dist = getDistanceFeet(positions.attackerPos, positions.targetPos);
            if (dist != null && dist > rangeFt) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        description: `${attackerName} is out of range (${Math.round(dist)} ft > ${rangeFt} ft).`,
                        automation: auto,
                    },
                };
            }
        }
    }

    const lastEvent = getLastDamageEvent(attackerName);
    if (!lastEvent || !lastEvent.rawDamage) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No recent damage event found for ${attackerName}. Cutting Words can only be used after a damage roll.`,
                automation: auto,
            },
        };
    }

    const defenderName = lastEvent.targetName;
    if (!defenderName) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `Could not determine who ${attackerName} damaged. Cannot apply Cutting Words.`,
                automation: auto,
            },
        };
    }

    const biDieRoll = Math.floor(Math.random() * bardicDieSize) + 1;
    const originalDamage = lastEvent.rawDamage;
    const reducedDamage = Math.max(0, originalDamage - biDieRoll);
    const healAmount = originalDamage - reducedDamage;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: action.name,
                description: `No combat context found. Cannot apply Cutting Words.`,
                automation: auto,
            },
        };
    }

    let defenderHp = null;
    if (healAmount > 0) {
        const healResult = applyHealingToTarget(combatSummary, defenderName, healAmount, campaignName);
        defenderHp = healResult?.newHp ?? null;
    }

    if (usesMax > 0) {
        const usesUsed = Number(getRuntimeValue(playerName, 'bardicInspirationUses', campaignName) ?? 0);
        await setRuntimeValue(playerName, 'bardicInspirationUses', usesUsed + 1, campaignName);
    }

    const logEntry = {
        type: 'ability_use',
        characterName: playerName,
        abilityName: action.name,
        description: `${playerName} used ${action.name} on ${attackerName}'s attack against ${defenderName}: rolled 1d${bardicDieSize} (${biDieRoll}), reducing damage from ${originalDamage} to ${reducedDamage}.`,
        targetName: attackerName,
        biDieRoll,
        biDieSize: bardicDieSize,
        originalDamage,
        reducedDamage,
        timestamp: Date.now(),
    };

    addEntry(campaignName, logEntry).catch(() => {});

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `<b>${action.name}</b><br/>Attacker: ${attackerName}<br/>Defender: ${defenderName}<br/>Bardic Inspiration die: 1d${bardicDieSize} = <b>${biDieRoll}</b><br/>Original damage: ${originalDamage}<br/>Reduced damage: <b>${reducedDamage}</b><br/>${healAmount > 0 ? `Healed ${defenderName} for ${healAmount} HP.` : ''}${defenderHp != null ? `<br/>${defenderName} HP: ${defenderHp}` : ''}`,
            automation: auto,
        },
    };
}
