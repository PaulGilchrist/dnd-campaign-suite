import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { getDistanceFeet, rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { resolveMapPositions } from '../../common/targetResolver.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { postLogEntry } from '../../../shared/logPoster.js';

function getCreatureTargets(excludeName, withinRangeFt, campaignName, mapName, attackerPos) {
    const cs = getCombatSummary(campaignName);
    if (!cs?.creatures) return [];

    return cs.creatures
        .filter(c => {
            if (c.name === excludeName) return false;
            if (withinRangeFt == null) return true;
            if (!attackerPos) return true;
            const targetPlayer = cs.players?.find(p => p.name === c.name);
            if (targetPlayer) {
                const dist = getDistanceFeet(attackerPos, { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY });
                return dist != null && dist <= withinRangeFt;
            }
            return true;
        })
        .map(c => c.name);
}

export async function handle(action, playerStats, campaignName, mapName) {
    const auto = action.automation;
    const playerName = playerStats.name;
    const featureName = action.name || 'Words of Creation';

    const rangeFt = rangeToFeet(auto.range || '10 ft');

    const positions = mapName ? await resolveMapPositions(campaignName, mapName, playerName) : null;
    const attackerPos = positions?.attackerPos || null;

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No combat context found. Cannot apply ${featureName}.`,
                automation: auto,
            },
        };
    }

    const targetInfo = combatSummary.creatures.find(c => c.name === action.payload?.targetName);
    if (!targetInfo) {
        return {
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: featureName,
                description: `No first target found. ${featureName} requires a target to spread to a second creature.`,
                automation: auto,
            },
        };
    }

    const firstTargetName = targetInfo.name;

    const creatureTargets = getCreatureTargets(
        firstTargetName,
        rangeFt,
        campaignName,
        mapName,
        attackerPos
    );

    return {
        type: 'popup',
        payload: {
            type: 'multi_target_selection',
            name: featureName,
            firstTargetName,
            creatureTargets,
            range: auto.range || '10 ft',
            spellFilter: auto.spellFilter || [],
            automation: auto,
        },
    };
}

export async function applyMultiTarget(
    action,
    playerStats,
    campaignName,
    mapName,
    firstTargetName,
    secondTargetName,
    spell,
    metaCtx
) {
    const auto = action.automation;
    const rangeFt = rangeToFeet(auto.range || '10 ft');

    if (!secondTargetName) {
        return null;
    }

    const combatSummary = await getCombatContext(campaignName);
    if (!combatSummary) return null;

    const firstTarget = combatSummary.creatures.find(c => c.name === firstTargetName);
    const secondTarget = combatSummary.creatures.find(c => c.name === secondTargetName);

    if (!firstTarget || !secondTarget) return null;

    if (rangeFt != null && firstTarget && secondTarget) {
        const positions = mapName ? await resolveMapPositions(campaignName, mapName, playerStats.name) : null;
        if (positions?.attackerPos) {
            const firstDist = getDistanceFeet(positions.attackerPos, {
                gridX: firstTarget.type === 'player'
                    ? (combatSummary.players?.find(p => p.name === firstTarget.name)?.gridX)
                    : (combatSummary.placedItems?.find(i => i.name === firstTarget.name)?.gridX),
                gridY: firstTarget.type === 'player'
                    ? (combatSummary.players?.find(p => p.name === firstTarget.name)?.gridY)
                    : (combatSummary.placedItems?.find(i => i.name === firstTarget.name)?.gridY),
            });
            const secondDist = getDistanceFeet(positions.attackerPos, {
                gridX: secondTarget.type === 'player'
                    ? (combatSummary.players?.find(p => p.name === secondTarget.name)?.gridX)
                    : (combatSummary.placedItems?.find(i => i.name === secondTarget.name)?.gridX),
                gridY: secondTarget.type === 'player'
                    ? (combatSummary.players?.find(p => p.name === secondTarget.name)?.gridY)
                    : (combatSummary.placedItems?.find(i => i.name === secondTarget.name)?.gridY),
            });
            if ((firstDist != null && firstDist > rangeFt) || (secondDist != null && secondDist > rangeFt)) {
                return {
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: action.name,
                        description: `Second target ${secondTargetName} is out of range.`,
                        automation: auto,
                    },
                };
            }
        }
    }

    const spellName = spell?.name || action.payload?.spellName || 'Unknown Spell';
    const damageType = spell?.damage?.damage_type || '';

    if (spell?.damage) {
        const rawDamage = metaCtx?.totalDamage || metaCtx?.rawDamage || 0;
        if (rawDamage > 0) {
            const applyResult = applyDamageToTarget(combatSummary, secondTargetName, rawDamage, [damageType], campaignName, null, false, playerStats.name);
            if (applyResult && applyResult.finalDamage > 0) {
                endInvisibilityOnHostileAction(playerStats.name, campaignName);
            }
            if (applyResult) {
                postLogEntry(campaignName, {
                    type: 'hp_change',
                    targetName: secondTargetName,
                    delta: applyResult.newHp - (secondTarget.currentHp || 0),
                    currentHp: applyResult.newHp,
                    maxHp: secondTarget.maxHp,
                    isHealing: false,
                    sourceName: playerStats.name,
                    note: `${spellName} (multi-target spread)`,
                });
            }
        }
    }

    if (spellName.toLowerCase() === 'power word heal') {
        const maxHp = secondTarget.maxHp || (playerStats.hitPoints || 0);
        const currentHp = secondTarget.currentHp ?? getRuntimeValue(secondTargetName, 'currentHitPoints', campaignName) ?? maxHp;
        const healAmount = maxHp - currentHp;
        if (healAmount > 0) {
            const healResult = applyHealingToTarget(combatSummary, secondTargetName, healAmount, campaignName);
            if (healResult) {
                postLogEntry(campaignName, {
                    type: 'hp_change',
                    targetName: secondTargetName,
                    delta: healResult.actualHeal,
                    currentHp: healResult.newHp,
                    maxHp,
                    isHealing: true,
                    sourceName: playerStats.name,
                    note: `${spellName} (multi-target spread)`,
                });
            }
        }

        const storedConditions = getRuntimeValue(secondTargetName, 'activeConditions', campaignName) || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const hasProne = conditions.some(c => String(c).toLowerCase() === 'prone');

        if (spell.status_effects) {
            const conditionsToRemove = spell.status_effects.map(e => e.toLowerCase());
            const newConditions = conditions.filter(c => !conditionsToRemove.includes(String(c).toLowerCase()));
            if (newConditions.length !== conditions.length) {
                setRuntimeValue(secondTargetName, 'activeConditions', newConditions, campaignName);
                for (const removed of conditionsToRemove) {
                    if (!newConditions.some(c => String(c).toLowerCase() === removed)) {
                        postLogEntry(campaignName, {
                            type: 'condition',
                            action: 'removed',
                            characterName: secondTargetName,
                            condition: removed.charAt(0).toUpperCase() + removed.slice(1),
                            reason: `${spellName} (multi-target spread)`,
                            timestamp: Date.now(),
                        });
                    }
                }
            }
        }

        if (hasProne) {
            const existingStance = getRuntimeValue(secondTargetName, 'powerWordHealStandPermission', campaignName);
            if (!existingStance) {
                setRuntimeValue(secondTargetName, 'powerWordHealStandPermission', true, campaignName);
            }
        }
    }

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: action.name,
        description: `${playerStats.name} used ${action.name} to spread ${spellName} to ${secondTargetName}.`,
        targetName: secondTargetName,
        timestamp: Date.now(),
    }).catch((e) => { console.error("[multiTarget] Error:", e); });

    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: action.name,
            description: `${spellName} applied to ${secondTargetName} (within ${auto.range || '10 ft'} of ${firstTargetName}).`,
            automation: auto,
        },
    };
}
