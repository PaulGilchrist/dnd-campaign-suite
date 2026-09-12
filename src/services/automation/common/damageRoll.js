import { rollExpression, rollExpressionDoubled } from '../../dice/diceRoller.js';
import { getTargetFromAttacker, getCombatContext, getResistanceNotice, getAttackerTargetName } from '../../rules/combat/damageUtils.js';
import * as mapsService from '../../maps/mapsService.js';
import { computeRangeEffect, computeMeleeProximityEffect, getDistanceFeet, isHostileNPC, getNearestPlacedItem, rangeToFeet } from '../../rules/combat/rangeValidation.js';
import { computeCover } from '../../rules/combat/coverService.js';
import { loadNPCs } from '../../npcs/npcsService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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

export async function buildBaseAttackContext(playerName, campaignName, damageType) {
    const cs = await getCombatContext(campaignName);
    const target = cs ? getTargetFromAttacker(cs, playerName) : null;
    const targetName = target?.name || (cs ? getAttackerTargetName(cs, playerName) : undefined);
    const resistanceNotice = target ? getResistanceNotice([damageType], target.resistances, target.immunities, target.name) : null;
    return { target, targetName, resistanceNotice };
}

export async function buildAttackContextForDamage(attackContext, playerName, campaignName, mapName) {
    const { targetName, resistanceNotice: initialNotice } = await buildBaseAttackContext(playerName, campaignName, attackContext.damageType);
    let resistanceNotice = initialNotice;

    // Check Nature's Sanctuary resistance for creatures in the sanctuary
    if (!resistanceNotice && targetName && campaignName) {
        resistanceNotice = resolveSanctuaryNotice(attackContext, playerName, campaignName, targetName);
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

        return await computeMapAwareContext({ mapData, npcs, attackContext, playerName, campaignName, targetName, resistanceNotice });
     } catch {
        return buildSyncCtx(targetName, resistanceNotice, attackContext, playerName);
     }
}

async function computeMapAwareContext({ mapData, npcs, attackContext, playerName, campaignName, targetName, resistanceNotice }) {
    const base = buildSyncCtx(targetName, resistanceNotice, attackContext, playerName);
    const attackerPlayer = mapData?.players?.find(p => p.name === playerName);
    if (!attackerPlayer) return base;

    const targetPos = await resolveTargetPosition(mapData, playerName, attackerPlayer, campaignName);
    const numericRange = rangeToFeet(attackContext.range) || 0;
    const isRanged = numericRange > 8;

    if (targetPos) {
        const distanceFt = getDistanceFeet(
            { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
            targetPos
         );
        const rangeResult = computeRangeEffect(isRanged ? numericRange : attackContext.range, distanceFt, {});
        if (rangeResult.mode === 'disadvantage') {
            return { ...base, forcedMode: 'disadvantage', rangeReason: rangeResult.reason };
         }
        if (rangeResult.mode === 'miss') {
            return { ...base, isAutoMiss: true, rangeReason: rangeResult.reason };
         }
     }

    if (isRanged && !targetPos) {
        const meleeResult = computeMeleeProximityEffect(true, attackerPlayer, collectHostileThreats(mapData, npcs), {});
        if (meleeResult.mode === 'disadvantage') {
            return { ...base, forcedMode: 'disadvantage', rangeReason: meleeResult.reason };
         }
     }

    if (isRanged && targetPos && !rangeToFeet(attackContext.range)) {
        const coverAdjustment = computeCoverAdjustment(base, attackerPlayer, targetPos, mapData);
        if (coverAdjustment) return coverAdjustment;
    }

    return base;
}

function computeCoverAdjustment(base, attackerPlayer, targetPos, mapData) {
    const coverResult = computeCover(
        { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
        { gridX: targetPos.gridX, gridY: targetPos.gridY },
        mapData?.walls || new Set(),
        mapData?.placedItems || [],
    );
    if (coverResult.level === 'full') {
        return { ...base, isAutoMiss: true, coverReason: 'Target has full cover' };
    }
    if (coverResult.acBonus > 0) {
        return { ...base, coverAcBonus: coverResult.acBonus, coverLevel: coverResult.level };
    }
    return null;
}

function collectHostileThreats(mapData, npcs) {
    return (mapData?.placedItems || [])
        .filter(i => i.type === 'npc')
        .map(i => {
            const npcData = npcs?.find(n => n.name === i.name || n.name === i.name?.replace(/\s+\d+$/, ''));
            return { ...i, attitude: npcData?.attitude };
         })
        .filter(i => isHostileNPC(i))
        .map(i => ({ gridX: i.gridX, gridY: i.gridY, name: i.name }));
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

function resolveSanctuaryNotice(attackContext, playerName, campaignName, targetName) {
    const sanctuaryCreatures = getRuntimeValue(playerName, 'naturesSanctuaryCreatures', campaignName);
    if (!sanctuaryCreatures?.includes(targetName)) return null;
    const landResistance = getRuntimeValue(playerName, 'naturesSanctuaryResistance', campaignName);
    if (!landResistance) return null;
    if (attackContext.damageType.toLowerCase() !== landResistance.toLowerCase()) return null;
    return `${targetName} resists ${attackContext.damageType} (Nature's Sanctuary)`;
}

async function resolveTargetPosition(mapData, playerName, attackerPlayer, campaignName) {
    const cs2 = await getCombatContext(campaignName);
    if (!cs2) return null;
    const tgt = getTargetFromAttacker(cs2, playerName);
    if (!tgt) return null;
    const targetPlayer = mapData?.players?.find(p => p.name === tgt.name);
    const targetNpc = mapData?.placedItems?.length
        ? getNearestPlacedItem(mapData.placedItems, tgt.name, { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY })
        : null;
    if (targetPlayer) return { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY };
    return targetNpc ? { gridX: targetNpc.gridX, gridY: targetNpc.gridY } : null;
}
