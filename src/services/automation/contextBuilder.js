import { buildBaseAttackContext } from './common/damageRoll.js';
import { getCombatContext, getTargetFromAttacker } from '../rules/combat/damageUtils.js';
import * as mapsService from '../maps/mapsService.js';
import { computeRangeEffect, computeMeleeProximityEffect, getDistanceFeet, isHostileNPC, getNearestPlacedItem, rangeToFeet } from '../rules/combat/rangeValidation.js';
import { computeCover } from '../rules/combat/coverService.js';
import { loadNPCs } from '../npcs/npcsService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getInnateSorceryBonus } from '../combat/buffs/buffService.js';
import { getWolfAdvantageAgainst } from '../combat/auras/wolfAuraUtils.js';
import { getDuplicityAdvantageAgainst } from '../combat/auras/duplicityAuraUtils.js';
import { getLionDisadvantageAgainst } from '../combat/auras/lionAuraUtils.js';
import { getCoronaSaveDisadvantage } from '../combat/auras/coronaAuraUtils.js';
import { hasAuraOfProtection } from '../combat/auras/auraOfProtection.js';
import { hasProtectionBuff } from '../combat/auras/protectionBuffUtils.js';
import { isActive as isAvengingAngelActive, isAuraTarget } from '../automation/handlers/class-cleric-paladin/avengingAngelHandler.js';

export function buildAttackContextSync(attack, playerStats, campaignName, conditionAttackMode, _featRangeEffects) {
    const playerName = playerStats.name;

    return buildBaseAttackContext(playerName, campaignName, attack.damageType).then(({ target, targetName, resistanceNotice }) => {

        // Hunter's Lore: reveal full IRV info for Hunter's Mark target
        let hunterLoreNotice = null;
        const lorePassives = playerStats.automation?.passives || [];
        const hasHunterLore = lorePassives.some(p => p.type === 'passive_rule' && p.effect === 'hunter_lore');
        if (hasHunterLore && target) {
            const irvParts = [];
            if (target.vulnerabilities?.length > 0) {
                irvParts.push(`Vulnerabilities: ${target.vulnerabilities.join(', ')}`);
            }
            if (target.resistances?.length > 0) {
                irvParts.push(`Resistances: ${target.resistances.join(', ')}`);
            }
            if (target.immunities?.length > 0) {
                irvParts.push(`Immunities: ${target.immunities.join(', ')}`);
            }
            if (irvParts.length > 0) {
                hunterLoreNotice = irvParts.join('\n');
            }
        }

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
        if (forcedMode === undefined) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const goadEffect = storedEffects.find(
                te => te.effect === 'goad' && te.target === playerName
            );
            if (goadEffect) {
                forcedMode = 'disadvantage';
            }
        }
        if (forcedMode === undefined) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const sapEffect = storedEffects.find(
                te => te.effect === 'disadvantage_next_attack' && te.target === playerName
            );
            if (sapEffect) {
                forcedMode = 'disadvantage';
            }
        }
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

        // Vow of Enmity: Advantage on attack rolls against the vowed creature
        const vowOfEnmityActive = activeBuffs.some(b => b.effect === 'vow_of_enmity');
        if (vowOfEnmityActive && targetName) {
            const vowTarget = getRuntimeValue(playerName, 'vowOfEnmityTarget', campaignName);
            if (vowTarget && targetName === vowTarget && forcedMode === undefined) {
                forcedMode = 'advantage';
            }
        }

        // Clairvoyant Combatant: Advantage on attack rolls against the bonded creature (on failed save)
        const clairvoyantActive = activeBuffs.some(b => b.effect === 'clairvoyant_combatant');
        if (clairvoyantActive && targetName) {
            const clairvoyantTarget = getRuntimeValue(playerName, 'clairvoyantCombatantTarget', campaignName);
            if (clairvoyantTarget && targetName === clairvoyantTarget && forcedMode === undefined) {
                forcedMode = 'advantage';
            }
        }

        // Avenging Angel: Advantage on attack rolls against Frightened creatures in the aura
        const avengingAngelActive = isAvengingAngelActive(playerName, campaignName);
        if (avengingAngelActive && targetName && forcedMode === undefined) {
            if (isAuraTarget(playerName, targetName, campaignName)) {
                forcedMode = 'advantage';
            }
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
            if (hasProtectionBuff(targetName, campaignName)) {
                forcedMode = 'disadvantage';
            }
        }
        if (forcedMode === undefined && targetName) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const distractingEffect = storedEffects.find(
                te => te.effect === 'distracting_strike_advantage' && te.target === targetName && te.source !== playerName
            );
            if (distractingEffect) {
                forcedMode = 'advantage';
                console.log(`[buildAttackContextSync] distracting_strike_advantage for ${playerName} vs ${targetName}`);
                const cleanedEffects = storedEffects.filter(
                    te => !(te.effect === 'distracting_strike_advantage' && te.target === targetName && te.source !== playerName)
                );
                if (cleanedEffects.length !== storedEffects.length) {
                    setRuntimeValue(campaignName, 'targetEffects', cleanedEffects, campaignName);
                }
            }
        }
        if (forcedMode === undefined && targetName) {
            const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
            const vexEffect = storedEffects.find(
                te => te.effect === 'next_attack_advantage' && te.target === playerName && te.vexTarget === targetName
            );
            if (vexEffect) {
                forcedMode = 'advantage';
                console.log(`[buildAttackContextSync] next_attack_advantage for ${playerName} vs ${targetName} (source: ${vexEffect.source})`);
                const cleanedEffects = storedEffects.filter(
                    te => !(te.effect === 'next_attack_advantage' && te.target === playerName && te.vexTarget === targetName)
                );
                if (cleanedEffects.length !== storedEffects.length) {
                    setRuntimeValue(campaignName, 'targetEffects', cleanedEffects, campaignName);
                }
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

        // Compute Glorious Defense AC bonus (on the attacker when they are the Paladin being attacked)
        let gloriousDefenseBonus = 0;
        const gloriousDefenseActive = getRuntimeValue(playerName, 'gloriousDefenseActive', campaignName);
        if (gloriousDefenseActive) {
            gloriousDefenseBonus = Number(getRuntimeValue(playerName, 'gloriousDefenseBonus', campaignName) || 1);
        }

        // Compute Defensive Duelist AC bonus (2024 rules)
        let defensiveDuelistBonus = 0;
        const defensiveDuelistActive = getRuntimeValue(playerName, 'defensiveDuelistActive', campaignName);
        if (defensiveDuelistActive) {
            defensiveDuelistBonus = Number(getRuntimeValue(playerName, 'defensiveDuelistBonus', campaignName) || 0);
        }

        // Compute Bait and Switch AC bonus (2024 rules)
        let baitAndSwitchBonus = 0;
        const baitAndSwitchActive = getRuntimeValue(targetName, 'baitAndSwitchActive', campaignName);
        if (baitAndSwitchActive) {
            baitAndSwitchBonus = Number(getRuntimeValue(targetName, 'baitAndSwitchBonus', campaignName) || 0);
        }

        // Stroke of Luck: check if the player has the passive available
        const hasStrokeOfLuck = (playerStats.automation?.passives || []).some(
            p => p.type === 'stroke_of_luck'
        );
        const strokeOfLuckUsed = hasStrokeOfLuck ? getRuntimeValue(playerName, 'strokeOfLuckUsed', campaignName) : false;
        const strokeOfLuckAvailable = hasStrokeOfLuck && !strokeOfLuckUsed;

        // Graze: check if the graze mastery effect is active for this target
        let grazeDamage = false;
        let grazeAbilityName = null;
        let grazeAbilityMod = 0;
        const storedEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
        const grazeEffect = storedEffects.find(te => te.effect === 'graze' && te.target === targetName);
        if (grazeEffect) {
            grazeDamage = true;
            grazeAbilityName = grazeEffect.abilityName || attack.abilityName || 'STR';
            const grazeAbility = playerStats.abilities?.find(a => a.name === grazeAbilityName);
            grazeAbilityMod = grazeAbility?.bonus || 0;
        }

        // Boon of Fate: check if the player has the passive available
        const hasBoonOfFate = (playerStats.automation?.passives || []).some(
            p => p.type === 'modify_d20_roll'
        );
        const boonOfFateUsed = hasBoonOfFate ? getRuntimeValue(playerName, 'boonOfFateUsed', campaignName) : false;
        const boonOfFateAvailable = hasBoonOfFate && !boonOfFateUsed;

        return {
            damageType: attack.damageType,
            resistanceNotice,
            hunterLoreNotice,
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
            isWeaponAttack: attack.isWeaponAttack !== false,
            criticalRange,
            hitBonus: effectiveHitBonus,
            hitBonusFormula,
            sacredWeaponBonus,
            gloriousDefenseBonus,
            defensiveDuelistBonus,
            baitAndSwitchBonus,
            strokeOfLuck: strokeOfLuckAvailable,
            boonOfFate: boonOfFateAvailable,
            isPsychicBlade: attack.isPsychicBlade === true,
            playerStats,
            grazeDamage,
            grazeAbilityName,
            grazeAbilityMod,
            weaponType: attack.weaponType,
            weaponName: attack.name,
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
                      if (base.forcedMode === undefined && base.targetName) {
                          if (hasProtectionBuff(base.targetName, campaignName)) {
                              base.forcedMode = 'disadvantage';
                          }
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
                      if (base.forcedMode === undefined && base.targetName) {
                          if (hasProtectionBuff(base.targetName, campaignName)) {
                              base.forcedMode = 'disadvantage';
                          }
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

                // Improved Illusions: only apply range bonus to Illusion spells with range 10+ feet
                const hasImprovedIllusions = playerStats.automation?.passives?.some(p => p.type === 'improved_illusions');
                const isIllusionSpell = attack.school && attack.school.toLowerCase() === 'illusion';
                const effectiveRangeBonus = (hasImprovedIllusions && isIllusionSpell && numericRange >= 10)
                    ? (feats.spellRangeBonus || 0) + 60
                    : feats.spellRangeBonus || 0;

                if (targetPos) {
                    const effectiveRange = isRanged ? numericRange + effectiveRangeBonus : attack.range;
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

                    // Check ignore_cover_ranged passive (e.g., Sharpshooter feat bypass cover)
                    const hasIgnoreCoverRanged = (playerStats.automation?.passives || []).some(
                        p => p.type === 'passive_rule' && p.effect === 'ignore_cover_ranged'
                    );
                    if (hasIgnoreCoverRanged) {
                        coverResult = { level: 'none', acBonus: 0 };
                    }

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

                    // Check Smite of Protection half cover (allies within Aura of Protection range)
                    const smiteCoverActive = getRuntimeValue(playerStats.name, 'smiteOfProtectionActive', campaignName);
                    if (smiteCoverActive && coverResult.acBonus < 2) {
                        const auraSource = getAuraSourceForSmiteCover(playerStats, mapData);
                        if (auraSource) {
                            const inAura = checkInAuraOfProtectionSync(auraSource, base.targetName, mapData, playerStats);
                            if (inAura) {
                                coverResult = { level: 'half', acBonus: 2 };
                            }
                        }
                    }

                    // Check Glorious Defense AC bonus (target Paladin has active buff)
                    const gloriousDefenseActive = getRuntimeValue(base.targetName, 'gloriousDefenseActive', campaignName);
                    if (gloriousDefenseActive && coverResult.acBonus < 2) {
                        const targetChar = mapData?.players?.find(p => p.name === base.targetName);
                        const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
                        if (targetChar && attackerPlayer) {
                            const dist = getDistanceFeet(attackerPlayer, targetChar);
                            if (dist <= 10) {
                                const gloriousDefenseBonus = Number(getRuntimeValue(base.targetName, 'gloriousDefenseBonus', campaignName) || 1);
                                coverResult.acBonus = Math.max(coverResult.acBonus, gloriousDefenseBonus);
                            }
                        }
                    }

                    // Check Defensive Duelist AC bonus (2024 rules)
                    const defensiveDuelistActive = getRuntimeValue(base.targetName, 'defensiveDuelistActive', campaignName);
                    if (defensiveDuelistActive) {
                        const defensiveDuelistBonus = Number(getRuntimeValue(base.targetName, 'defensiveDuelistBonus', campaignName) || 0);
                        if (defensiveDuelistBonus > coverResult.acBonus) {
                            coverResult.acBonus = defensiveDuelistBonus;
                        }
                    }

                    // Check Bait and Switch AC bonus (2024 rules)
                    const baitAndSwitchActive = getRuntimeValue(base.targetName, 'baitAndSwitchActive', campaignName);
                    if (baitAndSwitchActive) {
                        const baitAndSwitchBonus = Number(getRuntimeValue(base.targetName, 'baitAndSwitchBonus', campaignName) || 0);
                        if (baitAndSwitchBonus > coverResult.acBonus) {
                            coverResult.acBonus = baitAndSwitchBonus;
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

function getAuraSourceForSmiteCover(playerStats, mapData) {
    if (!mapData?.players?.length) return null;
    return mapData.players.find(p => hasAuraOfProtection(playerStats) && p.name === playerStats.name) || null;
}

function checkInAuraOfProtectionSync(auraSource, targetName, mapData, playerStats) {
    if (!mapData?.players?.length) return true;

    const sourcePlayer = auraSource;
    if (!sourcePlayer) return true;

    const targetPlayer = mapData.players.find(p => p.name === targetName);
    if (!targetPlayer) return true;

    const dist = getDistanceFeet(sourcePlayer, targetPlayer);
    if (dist == null) return true;

    const auraRange = hasAuraOfProtection(playerStats) ? 30 : 10;
    return dist <= auraRange;
}
