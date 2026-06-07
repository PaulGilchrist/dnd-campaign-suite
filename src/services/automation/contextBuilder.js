import { getTargetFromAttacker, getCombatContext, getResistanceNotice, getAttackerTargetName } from '../rules/damageUtils.js';
import * as mapsService from '../maps/mapsService.js';
import { computeRangeEffect, computeMeleeProximityEffect, getDistanceFeet, isHostileNPC, getNearestPlacedItem, rangeToFeet } from '../rules/rangeValidation.js';
import { computeCover } from '../rules/coverService.js';
import { loadNPCs } from '../npcs/npcsService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { getInnateSorceryBonus } from '../combat/buffService.js';

export function buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, _featRangeEffects) {
    const playerName = playerStats.name;

    return getCombatContext(campaignName).then(cs => {
        const target = cs ? getTargetFromAttacker(cs, playerName) : null;
        const targetName = target?.name || (cs ? getAttackerTargetName(cs, playerName) : undefined);
        const resistanceNotice = target ? getResistanceNotice([attack.damageType], target.resistances, target.immunities, target.name) : null;

       // Check for Stunning Strike save advantage (consumed on use)
        let hasSaveAdvantage = false;
        if (targetName) {
            const advKey = `_advantageOn_${targetName}`;
            const storedAdvantage = getRuntimeValue(playerName, advKey);
            if (Array.isArray(storedAdvantage)) {
                const idx = storedAdvantage.indexOf(targetName);
                if (idx !== -1) {
                    hasSaveAdvantage = true;
                    storedAdvantage.splice(idx, 1);
                    setRuntimeValue(playerName, advKey, storedAdvantage, campaignName);
                  }
              }
           }

        const innateSorceryBonus = getInnateSorceryBonus(playerName, campaignName);

        let forcedMode = conditionAttackMode !== 'normal' ? conditionAttackMode : undefined;
        if (hasSaveAdvantage && forcedMode === undefined) {
            forcedMode = 'advantage';
          }
        if (innateSorceryBonus.spellAdvantage && forcedMode === undefined) {
            forcedMode = 'advantage';
          }

        // Add stance damage bonus (e.g. Rage) if an active combat buff provides one
        let stanceDamageBonus = 0;
        const activeBuffs = getRuntimeValue(playerName, 'activeBuffs', campaignName) || [];
        for (const buff of activeBuffs) {
            if (buff.damageBonusExpression) {
                const resolved = buff.damageBonusExpression === 'rage_damage'
                    ? (playerStats.class?.class_levels?.[(playerStats.level || 1) - 1]?.rage_damage ?? 2)
                    : 0;
                stanceDamageBonus += resolved;
            }
        }

        // Grant attack advantage if Reckless Attack (or similar buff) is active
        let targetsHaveAdvantage = false;
        for (const buff of activeBuffs) {
            if (buff.effect === 'advantage_attacks_disadvantage_against') {
                if (forcedMode === undefined) {
                    forcedMode = 'advantage';
                }
                targetsHaveAdvantage = true;
            }
        }

        const autoDamageFormula = stanceDamageBonus > 0
            ? `${attack.damage}+${stanceDamageBonus}`
            : attack.damage;

        return {
            damageType: attack.damageType,
            resistanceNotice,
            targetName,
            saveDc: attack.saveDc + innateSorceryBonus.saveDcBonus,
            saveType: attack.saveType,
            dcSuccess: attack.saveSuccess,
            attackerName: playerName,
            forcedMode,
            autoDamageFormula,
            autoDamageName: attack.name,
            targetsHaveAdvantage,
           };
       });
}

export function buildAttackContext(attack, playerStats, campaignName, mapName, conditionAttackMode, featRangeEffects) {
    if (!mapName) {
        return buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, featRangeEffects);
      }

    const basePromise = buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, featRangeEffects);

    return Promise.all([
        basePromise,
        mapsService.loadMapData(campaignName, mapName),
        loadNPCs(campaignName),
       ]).then(([base, mapData, npcs]) => {
            const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
            if (!attackerPlayer) return base;

            let targetPos = null;
            return getCombatContext(campaignName).then(cs => {
                if (cs) {
                    const target = getTargetFromAttacker(cs, playerStats.name);
                    if (target) {
                        const targetPlayer = mapData?.players?.find(p => p.name === target.name);
                        const targetNpc = mapData?.placedItems?.length
                              ? getNearestPlacedItem(mapData.placedItems, target.name, { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY })
                              : null;
                        if (targetPlayer) {
                            targetPos = { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY };
                          } else if (targetNpc) {
                            targetPos = { gridX: targetNpc.gridX, gridY: targetNpc.gridY };
                          }
                      }
                  }

                const numericRange = rangeToFeet(attack.range) || 0;
                const isRanged = numericRange > 8;
                const feats = featRangeEffects || { ignoresMeleeDisadvantage: false, ignoresLongRangeDisadvantage: false, rangeMultiplier: 1, spellRangeBonus: 0 };

                if (targetPos) {
                    const effectiveRange = isRanged ? numericRange + (feats.spellRangeBonus || 0) : attack.range;
                    const distanceFt = getDistanceFeet(
                         { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                        targetPos
                      );
                    const rangeResult = computeRangeEffect(effectiveRange, distanceFt, feats);
                    if (rangeResult.mode === 'disadvantage') {
                        base.forcedMode = 'disadvantage';
                        base.rangeReason = rangeResult.reason;
                      } else if (rangeResult.mode === 'miss') {
                        base.isAutoMiss = true;
                        base.rangeReason = rangeResult.reason;
                        base.forcedMode = undefined;
                      }
                  }

                if (isRanged && !base.isAutoMiss && targetPos) {
                    const walls = mapData?.walls || new Set();
                    const coverResult = computeCover(
                         { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                          { gridX: targetPos.gridX, gridY: targetPos.gridY },
                        walls,
                        mapData?.placedItems || [],
                      );
                    if (coverResult.level === 'full') {
                        base.isAutoMiss = true;
                        base.coverReason = 'Target has full cover';
                      } else if (coverResult.acBonus > 0) {
                        base.coverAcBonus = coverResult.acBonus;
                        base.coverLevel = coverResult.level;
                      }
                  }

                if (isRanged && !base.isAutoMiss) {
                    const nearbyThreats = (mapData?.placedItems || [])
                         .filter(i => i.type === 'npc')
                         .map(i => {
                            const npcData = npcs?.find(n => n.name === i.name || n.name === i.name?.replace(/\s+\d+$/, ''));
                            return { ...i, attitude: npcData?.attitude };
                          })
                         .filter(i => isHostileNPC(i))
                         .map(i => ({ gridX: i.gridX, gridY: i.gridY, name: i.name }));

                    const meleeResult = computeMeleeProximityEffect(true, attackerPlayer, nearbyThreats, feats);
                    if (meleeResult.mode === 'disadvantage' && base.forcedMode !== 'disadvantage') {
                        base.forcedMode = 'disadvantage';
                        base.rangeReason = meleeResult.reason;
                      }
                  }

                return base;
              });
           })
          .catch(() => basePromise);
}
