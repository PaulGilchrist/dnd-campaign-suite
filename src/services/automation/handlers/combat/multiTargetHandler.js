import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { applyHealingToTarget } from '../../../rules/combat/applyHealing.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { endInvisibilityOnHostileAction } from '../../../rules/features/invisibilityService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { resolveMapPositions } from '../../common/targetResolver.js';


async function getCreatureTargets(excludeName, withinRangeFt, campaignName, mapName, attackerName) {
    const cs = getCombatSummary(campaignName);
    if (!cs?.creatures) return [];

    const inRangeFilter = withinRangeFt != null && mapName && attackerName ? async (name) => {
        return await isWithinRange(attackerName, name, withinRangeFt);
    } : null;

    return cs.creatures
        .filter(c => {
            if (c.name === excludeName) return false;
            if (inRangeFilter) {
                const targetPlayer = cs.players?.find(p => p.name === c.name);
                if (targetPlayer) {
                    return true;
                }
                return true;
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

    if (mapName) {
        await resolveMapPositions(campaignName, mapName, playerName);
    }

    const creatureTargets = await getCreatureTargets(
        firstTargetName,
        rangeFt,
        campaignName,
        mapName,
        playerName
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
    const playerName = playerStats.name;
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
        if (mapName) {
            const firstInRange = await isWithinRange(playerName, firstTarget.name, rangeFt);
            const secondInRange = await isWithinRange(playerName, secondTarget.name, rangeFt);
            if (!firstInRange || !secondInRange) {
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
                addEntry(campaignName, {
                    type: 'hp_change',
                    targetName: secondTargetName,
                    delta: applyResult.newHp - (secondTarget.currentHp || 0),
                    currentHp: applyResult.newHp,
                    maxHp: secondTarget.maxHp,
                    isHealing: false,
                    sourceName: playerStats.name,
                    note: `${spellName} (multi-target spread)`,
                }).catch((e) => { console.error("[multiTarget] Error:", e); });
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
                addEntry(campaignName, {
                    type: 'hp_change',
                    targetName: secondTargetName,
                    delta: healResult.actualHeal,
                    currentHp: healResult.newHp,
                    maxHp,
                    isHealing: true,
                    sourceName: playerStats.name,
                    note: `${spellName} (multi-target spread)`,
                }).catch((e) => { console.error("[multiTarget] Error:", e); });
            }
        }

        const storedConditions = getRuntimeValue(secondTargetName, 'activeConditions') || [];
        const conditions = Array.isArray(storedConditions) ? storedConditions : [];
        const hasProne = conditions.some(c => String(c).toLowerCase() === 'prone');

        if (spell.status_effects) {
            const conditionsToRemove = spell.status_effects.map(e => e.toLowerCase());
            const newConditions = conditions.filter(c => !conditionsToRemove.includes(String(c).toLowerCase()));
            if (newConditions.length !== conditions.length) {
                setRuntimeValue(secondTargetName, 'activeConditions', newConditions, campaignName);
                for (const removed of conditionsToRemove) {
                    if (!newConditions.some(c => String(c).toLowerCase() === removed)) {
                        addEntry(campaignName, {
                            type: 'condition',
                            action: 'removed',
                            characterName: secondTargetName,
                            condition: removed.charAt(0).toUpperCase() + removed.slice(1),
                            reason: `${spellName} (multi-target spread)`,
                            timestamp: Date.now(),
                        }).catch((e) => { console.error("[multiTarget] Error:", e); });
                    }
                }
            }
        }

        if (hasProne) {
            const existingStance = getRuntimeValue(secondTargetName, 'powerWordHealStandPermission');
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
