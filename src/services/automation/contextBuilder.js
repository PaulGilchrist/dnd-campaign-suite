import { getTargetFromAttacker, getCombatContext, getResistanceNotice, getAttackerTargetName } from '../rules/damageUtils.js';
import * as mapsService from '../maps/mapsService.js';
import { computeRangeEffect, computeMeleeProximityEffect, getDistanceFeet, isHostileNPC, getNearestPlacedItem, rangeToFeet } from '../rules/rangeValidation.js';
import { computeCover } from '../rules/coverService.js';
import { loadNPCs } from '../npcs/npcsService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { getInnateSorceryBonus } from '../combat/buffService.js';
import { getWolfAdvantageAgainst } from '../combat/wolfAuraUtils.js';
import { getDuplicityAdvantageAgainst } from '../combat/duplicityAuraUtils.js';
import { getLionDisadvantageAgainst } from '../combat/lionAuraUtils.js';
import { getCoronaSaveDisadvantage } from '../combat/coronaAuraUtils.js';

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
        let ramActive = false;
        for (const buff of activeBuffs) {
            if (buff.effect === 'advantage_attacks_disadvantage_against') {
                if (forcedMode === undefined) {
                    forcedMode = 'advantage';
                }
            }
            if (buff.optionName === 'Ram') {
                ramActive = true;
            }
        }

        // Sacred Weapon: Add Charisma modifier to attack rolls (minimum +1) for melee attacks
        let sacredWeaponBonus = 0;
        const sacredWeaponActive = activeBuffs.some(b => b.effect === 'sacred_weapon');
        if (sacredWeaponActive && (isMelee || attack.weaponType === 'melee')) {
            const cha = playerStats.abilities?.find(a => a.name === 'Charisma');
            const chaMod = Math.max(1, cha?.bonus || 0);
            sacredWeaponBonus = chaMod;
        }

        const autoDamageFormula = stanceDamageBonus > 0
            ? `${attack.damage}+${stanceDamageBonus}`
            : attack.damage;

        const effectiveHitBonus = attack.hitBonus + sacredWeaponBonus;
        const hitBonusFormula = sacredWeaponBonus > 0
            ? `${attack.hitBonusFormula} + Charisma Bonus (${sacredWeaponBonus})`
            : attack.hitBonusFormula;

        const isMelee = attack.weaponType === 'melee' || attack.weaponType === 'unarmed';

        // Invoke Duplicity: Distract grants Advantage on attack rolls while the illusion is active
        if (activeBuffs.some(b => b.effect === 'create_illusion')) {
            if (forcedMode === undefined) {
                forcedMode = 'advantage';
            }
        }

        // Aura checks when no map is active — all creatures considered in range
        if (forcedMode === undefined) {
            const noMapWolf = getWolfAdvantageAgainst({
                attackerName: playerName,
                campaignName,
                skipRangeCheck: true,
            });
            if (noMapWolf.advantage) {
                forcedMode = 'advantage';
            }
        }
        if (forcedMode === undefined) {
            const noMapDuplicity = getDuplicityAdvantageAgainst({
                attackerName: playerName,
                campaignName,
                skipRangeCheck: true,
            });
            if (noMapDuplicity.advantage) {
                forcedMode = 'advantage';
            }
        }
        if (forcedMode === undefined) {
            const noMapLion = getLionDisadvantageAgainst({
                attackerName: playerName,
                campaignName,
                skipRangeCheck: true,
            });
            if (noMapLion.disadvantage) {
                forcedMode = 'disadvantage';
            }
        }
        if (forcedMode === undefined && targetName) {
            const noMapCorona = getCoronaSaveDisadvantage({
                targetName,
                campaignName,
                damageType: attack.damageType,
                skipRangeCheck: true,
            });
            if (noMapCorona.disadvantage) {
                forcedMode = 'disadvantage';
            }
        }

        // Compute critical range from passives (e.g., Improved Critical, Superior Critical)
        let criticalRange = '';
        const passives = playerStats.automation?.passives || [];
        for (const passive of passives) {
            if (passive.type === 'passive_rule' && passive.effect === 'critical_range' && passive.criticalRange) {
                criticalRange = passive.criticalRange;
            }
        }

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
            ramActive,
            isMelee,
            criticalRange,
            hitBonus: effectiveHitBonus,
            hitBonusFormula,
            sacredWeaponBonus,
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

                 if (targetPos && base.forcedMode === undefined) {
                      const wolfResult = getWolfAdvantageAgainst({
                          targetPos,
                          attackerName: playerStats.name,
                          campaignName,
                          mapData,
                      });
                      if (wolfResult.advantage) {
                          base.forcedMode = 'advantage';
                      }
                      if (base.forcedMode === undefined) {
                          const duplicityResult = getDuplicityAdvantageAgainst({
                              targetPos,
                              attackerName: playerStats.name,
                              campaignName,
                              mapData,
                          });
                          if (duplicityResult.advantage) {
                              base.forcedMode = 'advantage';
                          }
                      }
                      const lionResult = getLionDisadvantageAgainst({
                         attackerName: playerStats.name,
                         campaignName,
                         mapData,
                     });
                     if (lionResult.disadvantage) {
                         base.forcedMode = 'disadvantage';
                     }
                     const coronaResult = getCoronaSaveDisadvantage({
                         targetName: base.targetName,
                         campaignName,
                         mapData,
                         damageType: base.damageType,
                     });
                     if (coronaResult.disadvantage && base.forcedMode === undefined) {
                         base.forcedMode = 'disadvantage';
                     }
                 }

                  // When map is active but target has no position, fall back to no-map aura checks
                  if (!targetPos && base.forcedMode === undefined) {
                      const noMapWolf = getWolfAdvantageAgainst({
                          attackerName: playerStats.name,
                          campaignName,
                          mapData,
                          skipRangeCheck: true,
                      });
                      if (noMapWolf.advantage) {
                          base.forcedMode = 'advantage';
                      }
                      if (base.forcedMode === undefined) {
                          const noMapDuplicity = getDuplicityAdvantageAgainst({
                              attackerName: playerStats.name,
                              campaignName,
                              mapData,
                              skipRangeCheck: true,
                          });
                          if (noMapDuplicity.advantage) {
                              base.forcedMode = 'advantage';
                          }
                      }
                      const noMapLion = getLionDisadvantageAgainst({
                         attackerName: playerStats.name,
                         campaignName,
                         mapData,
                         skipRangeCheck: true,
                     });
                     if (noMapLion.disadvantage) {
                         base.forcedMode = 'disadvantage';
                     }
                     if (base.forcedMode === undefined) {
                         const noMapCorona = getCoronaSaveDisadvantage({
                             targetName: base.targetName,
                             campaignName,
                             mapData,
                             damageType: base.damageType,
                             skipRangeCheck: true,
                         });
                         if (noMapCorona.disadvantage) {
                             base.forcedMode = 'disadvantage';
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
                    let coverResult = computeCover(
                         { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                          { gridX: targetPos.gridX, gridY: targetPos.gridY },
                        walls,
                        mapData?.placedItems || [],
                      );

                    // Check Nature's Sanctuary half cover (15-ft cube = 3x3 grid centered on placement)
                    const sanctuaryActive = getRuntimeValue(playerStats.name, 'naturesSanctuaryActive', campaignName);
                    if (sanctuaryActive) {
                        const sanctuaryX = Number(getRuntimeValue(playerStats.name, 'naturesSanctuaryCubeX', campaignName) || 0);
                        const sanctuaryY = Number(getRuntimeValue(playerStats.name, 'naturesSanctuaryCubeY', campaignName) || 0);
                        const cubeHalfSize = 1; // 15ft cube = 3 cells wide, half-size = 1 cell from center
                        if (sanctuaryX > 0 && sanctuaryY > 0) {
                            const dx = Math.abs(targetPos.gridX - sanctuaryX);
                            const dy = Math.abs(targetPos.gridY - sanctuaryY);
                            const inCube = dx <= cubeHalfSize && dy <= cubeHalfSize;
                            if (inCube && coverResult.acBonus < 2) {
                                coverResult = { level: 'half', acBonus: 2 };
                            }
                        }
                    }

                    // Check Bulwark of Force half cover (target must be in the allowed targets list)
                    const bulwarkActive = getRuntimeValue(playerStats.name, 'bulwarkOfForceActive', campaignName);
                    if (bulwarkActive) {
                        const bulwarkTargets = getRuntimeValue(playerStats.name, 'bulwarkOfForceTargets', campaignName) || [];
                        if (bulwarkTargets.includes(base.targetName) && coverResult.acBonus < 2) {
                            coverResult = { level: 'half', acBonus: 2 };
                        }
                    }

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
