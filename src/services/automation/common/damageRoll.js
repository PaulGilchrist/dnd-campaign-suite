import { rollExpression, rollExpressionDoubled } from '../../dice/diceRoller.js';
import { getTargetFromAttacker, getCombatContext, getResistanceNotice, getAttackerTargetName } from '../../rules/combat/damageUtils.js';
import * as mapsService from '../../maps/mapsService.js';
import { computeRangeEffect, computeMeleeProximityEffect, getDistanceFeet, isHostileNPC, getNearestPlacedItem, rangeToFeet } from '../../rules/combat/rangeValidation.js';
import { computeCover } from '../../rules/combat/coverService.js';
import { loadNPCs } from '../../npcs/npcsService.js';

export function rollDamageForAction(auto, options = {}) {
    const damage = auto.damage;
    let result = options.preRolledResult;

    if (!result) {
        result = options.isCrit ? rollExpressionDoubled(damage) : rollExpression(damage);
     }
    if (!result) return null;

    return {
        result,
        attackContext: {
            name: auto.name || '',
            damage,
            damageType: auto.damageType || '',
            saveDc: auto.saveDc,
            saveType: auto.saveType || 'DEX',
            saveSuccess: auto.dcSuccess ?? (auto.shape === 'cone' ? 0.5 : 0),
         },
     };
}

import { getRuntimeValue } from '../../../hooks/useRuntimeState.js';

export async function buildAttackContextForDamage(attackContext, playerName, campaignName, mapName) {
    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || (cs ? getAttackerTargetName(cs, playerName) : undefined);
    let resistanceNotice = target ? getResistanceNotice([attackContext.damageType], target.resistances, target.immunities, target.name) : null;

    // Check Nature's Sanctuary resistance for allies in the cube
    if (!resistanceNotice && targetName && mapName && campaignName) {
        const sanctuaryActive = getRuntimeValue(playerName, 'naturesSanctuaryActive', campaignName);
        if (sanctuaryActive) {
            const sanctuaryX = Number(getRuntimeValue(playerName, 'naturesSanctuaryCubeX', campaignName) || 0);
            const sanctuaryY = Number(getRuntimeValue(playerName, 'naturesSanctuaryCubeY', campaignName) || 0);
            if (sanctuaryX > 0 && sanctuaryY > 0 && targetName) {
                // Check if target is in the sanctuary cube (3x3 grid centered on placement)
                const mapData = await mapsService.loadMapData(campaignName, mapName);
                const targetPlayer = mapData?.players?.find(p => p.name === targetName);
                const targetNpc = mapData?.placedItems?.find(i => i.name === targetName || i.name?.startsWith(targetName + ' '));
                let targetGridPos = null;
                if (targetPlayer) {
                    targetGridPos = { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY };
                } else if (targetNpc) {
                    targetGridPos = { gridX: targetNpc.gridX, gridY: targetNpc.gridY };
                }
                if (targetGridPos) {
                    const dx = Math.abs(targetGridPos.gridX - sanctuaryX);
                    const dy = Math.abs(targetGridPos.gridY - sanctuaryY);
                    if (dx <= 1 && dy <= 1) {
                        // Target is in the sanctuary cube - check if attacker has land resistance
                        const landResistance = getRuntimeValue(playerName, 'naturesSanctuaryResistance', campaignName);
                        if (landResistance) {
                            const lowerDamageType = attackContext.damageType.toLowerCase();
                            if (lowerDamageType === landResistance.toLowerCase()) {
                                resistanceNotice = `${targetName} resists ${attackContext.damageType} (Nature's Sanctuary)`;
                            }
                        }
                    }
                }
            }
        }
    }

    if (!mapName) {
        return {
            damageType: attackContext.damageType,
            resistanceNotice,
            targetName,
            saveDc: attackContext.saveDc || 0,
            saveType: attackContext.saveType,
            dcSuccess: attackContext.saveSuccess,
            attackerName: playerName,
         };
     }

    try {
        const [mapData, npcs] = await Promise.all([
            mapsService.loadMapData(campaignName, mapName),
            loadNPCs(campaignName),
         ]);

        const attackerPlayer = mapData?.players?.find(p => p.name === playerName);
        if (attackerPlayer) {
            let targetPos = null;
            const cs2 = await getCombatContext(campaignName);
            if (cs2) {
                const tgt = getTargetFromAttacker(cs2, playerName);
                if (tgt) {
                    const targetPlayer = mapData?.players?.find(p => p.name === tgt.name);
                    const targetNpc = mapData?.placedItems?.length
                        ? getNearestPlacedItem(mapData.placedItems, tgt.name, { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY })
                        : null;
                    if (targetPlayer) {
                        targetPos = { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY };
                     } else if (targetNpc) {
                        targetPos = { gridX: targetNpc.gridX, gridY: targetNpc.gridY };
                     }
                 }
             }

            const numericRange = rangeToFeet(attackContext.range) || 0;
            const isRanged = numericRange > 8;

            if (targetPos) {
                const distanceFt = getDistanceFeet(
                    { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                    targetPos
                 );
                const rangeResult = computeRangeEffect(isRanged ? numericRange : attackContext.range, distanceFt, {});
                if (rangeResult.mode === 'disadvantage') {
                    return { ...buildSyncCtx(targetName, resistanceNotice, attackContext, playerName), forcedMode: 'disadvantage', rangeReason: rangeResult.reason };
                 } else if (rangeResult.mode === 'miss') {
                    return { ...buildSyncCtx(targetName, resistanceNotice, attackContext, playerName), isAutoMiss: true, rangeReason: rangeResult.reason };
                 }
             }

            if (isRanged && !targetPos) {
                const nearbyThreats = (mapData?.placedItems || [])
                    .filter(i => i.type === 'npc')
                    .map(i => {
                        const npcData = npcs?.find(n => n.name === i.name || n.name === i.name?.replace(/\s+\d+$/, ''));
                        return { ...i, attitude: npcData?.attitude };
                     })
                    .filter(i => isHostileNPC(i))
                    .map(i => ({ gridX: i.gridX, gridY: i.gridY, name: i.name }));

                const meleeResult = computeMeleeProximityEffect(true, attackerPlayer, nearbyThreats, {});
                if (meleeResult.mode === 'disadvantage') {
                    return { ...buildSyncCtx(targetName, resistanceNotice, attackContext, playerName), forcedMode: 'disadvantage', rangeReason: meleeResult.reason };
                 }
             }

            if (isRanged && targetPos && !rangeToFeet(attackContext.range)) {
                const walls = mapData?.walls || new Set();
                const coverResult = computeCover(
                    { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                    { gridX: targetPos.gridX, gridY: targetPos.gridY },
                    walls,
                    mapData?.placedItems || [],
                 );
                if (coverResult.level === 'full') {
                    return { ...buildSyncCtx(targetName, resistanceNotice, attackContext, playerName), isAutoMiss: true, coverReason: 'Target has full cover' };
                 } else if (coverResult.acBonus > 0) {
                    return { ...buildSyncCtx(targetName, resistanceNotice, attackContext, playerName), coverAcBonus: coverResult.acBonus, coverLevel: coverResult.level };
                 }
             }
         }

        return buildSyncCtx(targetName, resistanceNotice, attackContext, playerName);
     } catch {
        return buildSyncCtx(targetName, resistanceNotice, attackContext, playerName);
     }
}

function buildSyncCtx(targetName, resistanceNotice, attackContext, attackerName) {
    return {
        damageType: attackContext.damageType,
        resistanceNotice,
        targetName,
        saveDc: attackContext.saveDc || 0,
        saveType: attackContext.saveType,
        dcSuccess: attackContext.saveSuccess,
        attackerName,
     };
}
