import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import storage from '../../ui/storage.js';
import { rollD20 } from '../../dice/diceRoller.js';
import utils from '../../ui/utils.js';
import { sendDeathSavePrompt, sendConcentrationPrompt } from '../../combat/conditions/savePromptService.js';
import { rollConcentrationSave } from '../../combat/concentration/concentrationRules.js';
import { postLogEntry } from '../../shared/logPoster.js';
import { isHolyAuraActive, getHolyAuraTargets } from '../../automation/handlers/buffs/holyAuraHandler.js';
import { getDamageReduction } from '../../combat/automation/automationPassives.js';
import { isCreatureInSilenceZone } from '../../rules/features/silenceService.js';
import { processTashasLaughterRepeatSave } from '../../automation/handlers/spells/tashasLaughterHandler.js';
import { getDistanceFeet } from './rangeValidation.js';

/**
 * Save the last damage event under the target's key so reaction features
 * (e.g., Superior Hunter's Defense) can find the most recent damage the
 * target received via getLastDamageEvent(targetName).
 *
 * Accumulates primary and secondary damage from a single NPC action into
 * a single event with combined rawDamage and all damageTypes.
 */
function saveDamageEventForTarget(targetName, rawDamage, damageTypes, campaignName) {
    if (!targetName || !campaignName) return;
    const existing = getRuntimeValue(targetName, 'lastMetamagicDamage', campaignName);
    let combinedDamage = rawDamage;
    let combinedTypes = [...damageTypes];
    if (existing && existing.rawDamage) {
        combinedDamage += existing.rawDamage;
        combinedTypes = [...(existing.damageTypes || []), ...damageTypes];
    }
    setRuntimeValue(targetName, 'lastMetamagicDamage', {
        targetName,
        rawDamage: combinedDamage,
        damageType: combinedTypes[0],
        damageTypes: combinedTypes,
    }, campaignName);
}

export function computeDamageAfterResistances(rawDamage, damageTypes, resistances, immunities, ignoreResistance = false) {
  if (!damageTypes || damageTypes.length === 0) throw new Error('computeDamageAfterResistances: damageTypes is required');
  for (const dt of damageTypes) {
    if (!dt) throw new Error('computeDamageAfterResistances: each damageType must be a non-empty string');
    const lower = dt.toLowerCase();
    if (immunities?.some(i => i.toLowerCase() === lower)) return 0;
    if (!ignoreResistance && resistances?.some(r => r.toLowerCase() === lower)) return Math.floor(rawDamage / 2);
   }
  return rawDamage;
}

export function computeDamageAfterResistancesWithDetails(rawDamage, damageTypes, resistances, immunities, ignoreResistance = false) {
  if (!damageTypes || damageTypes.length === 0) throw new Error('computeDamageAfterResistancesWithDetails: damageTypes is required');
  const typeDetails = [];
  let finalDamage = rawDamage;
  let isImmune = false;
  let isResistant = false;
  for (const dt of damageTypes) {
    if (!dt) continue;
    const lower = dt.toLowerCase();
    if (immunities?.some(i => i.toLowerCase() === lower)) {
      isImmune = true;
      typeDetails.push({ damageType: dt, status: 'immune' });
      break;
    }
    if (!ignoreResistance && resistances?.some(r => r.toLowerCase() === lower)) {
      isResistant = true;
      typeDetails.push({ damageType: dt, status: 'resistant' });
    }
  }
  if (isImmune) {
    finalDamage = 0;
  } else if (isResistant) {
    finalDamage = Math.floor(rawDamage / 2);
  }
  return { finalDamage, typeDetails };
}

export function computeDamageAfterSave(rawDamage, saveSuccess, dcSuccess) {
  if (!saveSuccess) return rawDamage;
  if (dcSuccess === 'half') return Math.floor(rawDamage / 2);
  return 0;
}

export function hasEvasionForSave(evasionEffects, saveType) {
  if (!evasionEffects || evasionEffects.length === 0) return false;
  const upper = (saveType || '').toUpperCase();
  return evasionEffects.some(e => e.saveType === upper);
}

export function computeDamageAfterEvasion(rawDamage, saveSuccess, dcSuccess, evasionActive) {
  if (evasionActive && dcSuccess === 'half') {
    if (saveSuccess) return 0;
    return Math.floor(rawDamage / 2);
  }
  return computeDamageAfterSave(rawDamage, saveSuccess, dcSuccess);
}

export function rollSaveForCreature(creature, saveType, saveDc, disadvantage = false) {
  const bonus = creature?.saveBonuses?.[saveType] ?? 0;
  const roll1 = rollD20();
  const roll2 = disadvantage ? rollD20() : roll1;
  const finalRoll = disadvantage ? Math.min(roll1, roll2) : roll1;
  const total = finalRoll + bonus;
  const success = total >= saveDc;
  return { roll: finalRoll, total, bonus, success, rawRolls: [roll1, roll2] };
}

export function applyDamageToTarget(combatSummary, targetName, rawDamage, damageTypes, campaignName, characters, ignoreResistance = false, attackerName = null) {
  if (!combatSummary) return null;
  const creature = combatSummary.creatures.find(c => c.name === targetName);
  if (!creature) return null;

    const isPlayer = creature.type === 'player';
    if (!Array.isArray(characters)) { console.error('[applyDamage] characters is not an array'); throw new Error('characters must be an array'); }
    const playerStats = isPlayer ? characters.find(c => c.name === targetName || c.name.startsWith(targetName + ' ')) : null;
   const playerComputed = playerStats?.computedStats || playerStats;
    let resistances = isPlayer ? (playerComputed?.resistances || []) : (creature.resistances || []);
    const immunities = isPlayer ? (playerComputed?.immunities || []) : (creature.immunities || []);
    if (isPlayer) {
        const rawBuffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName);
        const activeBuffs = Array.isArray(rawBuffs) ? rawBuffs : [];
        for (const buff of activeBuffs) {
            if (buff.resistanceTypes?.length) {
                resistances = [...new Set([...resistances, ...buff.resistanceTypes])];
            }
        }
        // Silence — Thunder immunity for creatures in the silence zone
        for (const buff of activeBuffs) {
            if (buff.effect === 'silence' && buff.sourceCharacter) {
                if (isCreatureInSilenceZone(creature.name, buff.sourceCharacter, campaignName)) {
                    if (!immunities.includes('Thunder')) {
                        immunities.push('Thunder');
                    }
                }
            }
        }
    }
    if (!Array.isArray(damageTypes)) { console.error('[applyDamage] damageTypes is not an array'); throw new Error('damageTypes must be an array'); }
    const resResult = computeDamageAfterResistancesWithDetails(rawDamage, damageTypes, resistances, immunities, ignoreResistance);
    let finalDamage = resResult.finalDamage;
    let resistanceDetails = resResult.typeDetails;

    // Apply damage reduction from features (e.g., Heavy Armor Master)
    let damageReducedByFeature = 0;
    if (isPlayer) {
        const allEquipment = (playerComputed?.equipment || playerStats?.equipment || []);
        const equippedArmor = allEquipment.find(e => e.equipped);
        const armorName = equippedArmor?.name;
        let isWearingHeavyArmor = false;
        if (armorName) {
            const armor = allEquipment.find(e => e.name === armorName && e.equipped);
            if (armor && ['Heavy', 'heavy'].includes(armor.armor_category)) {
                isWearingHeavyArmor = true;
            }
        }
        const reduction = getDamageReduction(playerComputed, damageTypes[0], isWearingHeavyArmor);
        if (reduction !== null && reduction > 0) {
            damageReducedByFeature = reduction;
            finalDamage = Math.max(0, finalDamage - reduction);
            const hasResistanceTrigger = (playerComputed.automation?.passives || []).some(
                p => p.type === 'damage_reduction' && p.trigger === 'damage_taken_of_chosen_resistance_type'
            );
            if (hasResistanceTrigger) {
                setRuntimeValue(creature.name, 'resistanceUsedThisTurn', true, campaignName);
            }
        }
    }

    // Arcane Ward / Projected Ward: absorb damage before it hits HP
    let wardDamage = finalDamage;
    let wardAbsorbed;
    if (isPlayer) {
        const wardActive = getRuntimeValue(creature.name, 'arcaneWardActive', campaignName);
        if (wardActive) {
            const wardHp = Number(getRuntimeValue(creature.name, 'arcaneWardHp', campaignName) ?? 0);
            if (wardHp > 0) {
                wardAbsorbed = Math.min(wardDamage, wardHp);
                const newWardHp = wardHp - wardAbsorbed;
                setRuntimeValue(creature.name, 'arcaneWardHp', newWardHp, campaignName);
                wardDamage -= wardAbsorbed;

                // If ward reaches 0, check for Projected Ward (absorbs for nearby allies too)
                if (newWardHp <= 0) {
                    // Ward is depleted — remaining damage will hit the target
                }
            }
        }
    }

    // Save damage event under target's key for reaction features
    if (isPlayer) {
        saveDamageEventForTarget(creature.name, rawDamage, damageTypes, campaignName);
    }

    let oldHp, newHp;
   if (isPlayer) {
      const storedCurrentHp = getRuntimeValue(creature.name, 'currentHitPoints');
      if (storedCurrentHp == null) {
          console.error(`[applyDamage] Arcane Ward: currentHitPoints not found for ${creature.name}`);
          throw new Error(`Arcane Ward: currentHitPoints not found for ${creature.name}`);
      }
      oldHp = storedCurrentHp;
      newHp = Math.max(0, oldHp - wardDamage);
      setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
   } else {
     oldHp = creature.currentHp;
     newHp = Math.max(0, oldHp - wardDamage);
     creature.currentHp = newHp;
    }

    // Tasha's Hideous Laughter: damage-triggered repeat WIS save with Advantage
    if (wardDamage > 0 && !isPlayer) {
        // For NPCs, check creature.conditions directly (no getRuntimeValue call needed)
        const rawConditions = creature.conditions || [];
        const hasIncapacitated = rawConditions.some(c => {
            const condKey = typeof c === 'object' ? c.key : String(c);
            return String(condKey).toLowerCase() === 'incapacitated';
        });
        if (hasIncapacitated) {
            const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
            const tashasEffect = Array.isArray(targetEffects) ? targetEffects.find(
                te => te.target === creature.name && te.effect === 'tashas_laughter_repeat_save'
            ) : null;
            if (tashasEffect) {
                processTashasLaughterRepeatSave(tashasEffect.source, creature.name, tashasEffect.dc, campaignName).catch(e => {
                    console.error('[applyDamage] Tasha\'s damage-triggered repeat save failed:', e);
                });
            }
        }
    }

    if (wardDamage > 0) {
      // Warding Bond: caster takes the same damage as the target (only if within 60 feet)
      if (isPlayer) {
        const targetBondSource = getRuntimeValue(creature.name, 'activeBuffs', campaignName);
        const targetActiveBuffs = Array.isArray(targetBondSource) ? targetBondSource : [];
        const wardingBondBuff = targetActiveBuffs.find(b => b.effect === 'warding_bond');
        if (wardingBondBuff && wardingBondBuff.sourceCharacter && wardingBondBuff.sourceCharacter !== creature.name) {
          const casterName = wardingBondBuff.sourceCharacter;
          const casterCreature = combatSummary.creatures.find(c => c.name === casterName);
          const targetCreature = combatSummary.creatures.find(c => c.name === creature.name);
          const distance = casterCreature && targetCreature ? getDistanceFeet(casterCreature.position, targetCreature.position) : null;
          if (distance === null || distance <= 60) {
            if (casterCreature && casterCreature.currentHp > 0) {
              const sharedDamage = wardDamage;
              casterCreature.currentHp = Math.max(0, casterCreature.currentHp - sharedDamage);
              postLogEntry(campaignName, {
                type: 'hp_change',
                targetName: casterName,
                delta: -sharedDamage,
                currentHp: casterCreature.currentHp,
                maxHp: casterCreature.maxHp,
                isHealing: false,
                isUnconscious: casterCreature.currentHp <= 0,
                abilityName: 'Warding Bond',
              });
              if (casterCreature.concentration && sharedDamage > 0) {
                casterCreature.concentration.dc = Math.max(10, Math.floor(sharedDamage / 2));
              }
            }
          }
        }
      }
      // Thought Shield: reflect Psychic damage back to the attacker
     if (isPlayer && attackerName && attackerName !== creature.name) {
      const hasThoughtShield = playerComputed?.characterAdvancement?.some(f => f.name === 'Thought Shield');
      if (hasThoughtShield && damageTypes?.some(d => d.toLowerCase() === 'psychic')) {
        const attackerCreature = combatSummary.creatures.find(c => c.name === attackerName);
        if (attackerCreature && attackerCreature.currentHp > 0) {
          const reflectedDamage = wardDamage;
          attackerCreature.currentHp = Math.max(0, attackerCreature.currentHp - reflectedDamage);
          postLogEntry(campaignName, {
            type: 'hp_change',
            targetName: attackerName,
            delta: -reflectedDamage,
            currentHp: attackerCreature.currentHp,
            maxHp: attackerCreature.maxHp,
            isHealing: false,
            isUnconscious: attackerCreature.currentHp <= 0,
            abilityName: "Thought Shield",
          });
          if (attackerCreature.concentration && reflectedDamage > 0) {
            attackerCreature.concentration.dc = Math.max(10, Math.floor(reflectedDamage / 2));
          }
        }
      }
    }
    if (isPlayer) {
      const rawConditions = getRuntimeValue(creature.name, 'activeConditions');
      if (rawConditions == null || !Array.isArray(rawConditions)) { console.error('[applyDamage] activeConditions is not an array'); throw new Error('activeConditions must be an array'); }
      const conditions = rawConditions;
      if (conditions.some(c => String(c).toLowerCase() === 'frightened')) {
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'frightened');
        setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);
        postLogEntry(campaignName, {
          type: 'condition',
          action: 'removed',
          characterName: creature.name,
          condition: 'Frightened',
          reason: 'took damage',
          timestamp: Date.now(),
        });
      }
      if (conditions.some(c => String(c).toLowerCase() === 'charmed')) {
        const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
        setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);
        postLogEntry(campaignName, {
          type: 'condition',
          action: 'removed',
          characterName: creature.name,
          condition: 'Charmed',
          reason: 'took damage (Friends)',
          timestamp: Date.now(),
        });
      }
    } else {
      const rawConditions = creature.conditions || [];
      const hadFrightened = rawConditions.some(c => c.key === 'frightened');
      if (hadFrightened) {
        creature.conditions = rawConditions.filter(c => c.key !== 'frightened');
        postLogEntry(campaignName, {
          type: 'condition',
          action: 'removed',
          characterName: creature.name,
          condition: 'Frightened',
          reason: 'took damage',
          timestamp: Date.now(),
        });
      }
      const charmedOnDamage = rawConditions.find(c => c.key === 'charmed' && c.endsOnDamage);
      if (charmedOnDamage) {
        creature.conditions = rawConditions.filter(c => c.key !== 'charmed');
        postLogEntry(campaignName, {
          type: 'condition',
          action: 'removed',
          characterName: creature.name,
          condition: 'Charmed',
          reason: 'took damage (Animal Friendship)',
          timestamp: Date.now(),
        });
      }
    }

    if (attackerName && attackerName !== creature.name) {
      const attackerBuffs = getRuntimeValue(attackerName, 'activeBuffs', campaignName);
      const attackerBuffArray = Array.isArray(attackerBuffs) ? attackerBuffs : [];
      if (attackerBuffArray.some(b => b.name === 'Psychic Veil')) {
        const rawAttackerConditions = getRuntimeValue(attackerName, 'activeConditions');
        if (rawAttackerConditions == null || !Array.isArray(rawAttackerConditions)) { console.error('[applyDamage] attacker activeConditions is not an array'); throw new Error('activeConditions must be an array'); }
        const attackerConditions = rawAttackerConditions;
        const attackerCondArray = attackerConditions;
        const filteredConditions = attackerCondArray.filter(c => String(c).toLowerCase() !== 'invisible');
        if (filteredConditions.length !== attackerCondArray.length) {
          setRuntimeValue(attackerName, 'activeConditions', filteredConditions, campaignName);
        }
        const filteredBuffs = attackerBuffArray.filter(b => b.name !== 'Psychic Veil');
        if (filteredBuffs.length !== attackerBuffArray.length) {
          setRuntimeValue(attackerName, 'activeBuffs', filteredBuffs, campaignName);
        }
      }
      // Supreme Sneak: if Stealth Attack is active, don't remove Invisible condition
      const stealthAttackCost = getRuntimeValue(attackerName, 'stealthAttackCost', campaignName);
      if (stealthAttackCost && stealthAttackCost > 0) {
        const rawAttackerConditions2 = getRuntimeValue(attackerName, 'activeConditions');
        if (rawAttackerConditions2 == null || !Array.isArray(rawAttackerConditions2)) { console.error('[applyDamage] attacker activeConditions is not an array'); throw new Error('activeConditions must be an array'); }
        const attackerConditions2 = rawAttackerConditions2;
        const attackerCondArray2 = attackerConditions2;
        const hasInvisible = attackerCondArray2.some(c => String(c).toLowerCase() === 'invisible');
        if (hasInvisible) {
          // Preserve Invisible condition — don't remove it
          // The stealthAttackCost will be cleared at start of next turn
        }
      }
   }

    // Holy Aura: Fiend/Undead melee attacker vs affected creature — CON save or Blinded until end of next turn
    if (attackerName && attackerName !== creature.name && wardDamage > 0) {
      const casterName = attackerName;
      if (isHolyAuraActive(casterName, campaignName)) {
        const holyAuraTargets = getHolyAuraTargets(casterName, campaignName);
        const isTargetProtected = holyAuraTargets.includes(creature.name) || holyAuraTargets.length === 0;
        if (isTargetProtected) {
          const attackerCreature = combatSummary.creatures.find(c => c.name === attackerName);
          if (attackerCreature) {
            const attackerType = (attackerCreature.type || '').toLowerCase();
            const attackerTemplate = (() => { const raw = attackerCreature.template; if (raw == null || !Array.isArray(raw)) { console.error('[applyDamage] attacker template is not an array'); throw new Error('attacker template must be an array'); } return raw; }).map(t => t.toLowerCase());
            const isFiendOrUndead = attackerType === 'fiend' || attackerType === 'undead' ||
              attackerTemplate.includes('fiend') || attackerTemplate.includes('undead');
            if (isFiendOrUndead) {
              const conSaveDc = getRuntimeValue(casterName, 'holyAuraSaveDc', campaignName);
              if (conSaveDc) {
                const saveRoll = rollD20();
                const conBonus = attackerCreature.ability_score_modifiers?.CON ?? attackerCreature.ability_score_modifiers?.constitution ?? 0;
                const saveTotal = saveRoll + conBonus;
                if (saveTotal < conSaveDc) {
                  const rawAttackerConditions = getRuntimeValue(attackerName, 'activeConditions');
                  if (rawAttackerConditions == null || !Array.isArray(rawAttackerConditions)) { console.error('[applyDamage] attacker activeConditions is not an array'); throw new Error('activeConditions must be an array'); }
                  const attackerConditions = rawAttackerConditions;
                  const attackerCondArray = attackerConditions;
                  const existingBlinded = attackerCondArray.find(c => String(c).toLowerCase() === 'blinded');
                  if (!existingBlinded) {
                    setRuntimeValue(attackerName, 'activeConditions', [...attackerCondArray, 'blinded'], campaignName);
                    postLogEntry(campaignName, {
                      type: 'condition',
                      action: 'added',
                      characterName: attackerName,
                      condition: 'Blinded',
                      reason: 'Holy Aura (Fiend/Undead melee hit)',
                      timestamp: Date.now(),
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

   }

   const wasAlive = oldHp > 0;
   const isNowUnconscious = newHp <= 0;

   if (creature.concentration && finalDamage > 0) {
     creature.concentration.dc = Math.max(10, Math.floor(finalDamage / 2));
   }

    if (!isPlayer && wasAlive && isNowUnconscious && finalDamage > 0) {
       const allCharacters = characters;
       for (const charStats of allCharacters) {
         const computed = charStats?.computedStats || charStats;
         if (!computed) continue;
         const isFiendPatron = computed.class?.subclass?.name === 'Fiend Patron';
         if (!isFiendPatron) continue;
         const rawFeatures = computed.characterAdvancement;
         if (rawFeatures == null || !Array.isArray(rawFeatures)) { console.error('[applyDamage] characterAdvancement is not an array'); throw new Error('characterAdvancement must be an array'); }
         const features = rawFeatures;
        const feature = features.find(f => f.name === "Dark One's Blessing");
        if (!feature || !feature.automation) continue;
        const chaMod = (() => {
          const cha = computed.abilities?.find(a => a.name === 'Charisma');
          return cha ? Math.floor((cha.score - 10) / 2) : 0;
        })();
        const warlockLevel = (() => {
          const rawClassLevels = computed.class?.class_levels;
          if (rawClassLevels == null || !Array.isArray(rawClassLevels)) { console.error('[applyDamage] class_levels is not an array'); throw new Error('class_levels must be an array'); }
          const cl = rawClassLevels.find(c => c.level === computed.level);
          return cl ? cl.level : computed.level;
        })();
        let amount = chaMod + warlockLevel;
        amount = Math.max(1, amount);
        const existingTempHp = Number(getRuntimeValue(charStats.name, 'tempHp', campaignName) || 0);
        setRuntimeValue(charStats.name, 'tempHp', existingTempHp + amount, campaignName);
      }
    }

   logDamageApplication(creature, finalDamage, oldHp, newHp, campaignName);

  let npcConcentrationBroken = false;
  let combatSummaryChanged = false;
    if (creature.type === 'player') {
    if (wasAlive && isNowUnconscious) {
      // Check for Undying Sentinel (Oath of Glory level 15)
      const undyingResult = checkUndyingSentinel(creature, playerComputed, campaignName);
      if (undyingResult.intercepted) {
        return undyingResult;
      }

      // Check for Boon of Recovery - Last Stand
      const boonOfRecoveryResult = checkBoonOfRecoveryLastStand(creature, playerComputed, campaignName);
      if (boonOfRecoveryResult.intercepted) {
        return boonOfRecoveryResult;
      }

      // Check for Relentless Endurance (Orc race trait)
      const relentlessEnduranceResult = checkRelentlessEndurance(creature, playerComputed, campaignName);
      if (relentlessEnduranceResult.intercepted) {
        return relentlessEnduranceResult;
      }

      const promptId = utils.guid();
      sendDeathSavePrompt(campaignName, {
        promptId,
        targetName: creature.name,
      });
    }

    if (creature.concentration && finalDamage > 0) {
      const promptId = utils.guid();
      sendConcentrationPrompt(campaignName, {
        promptId,
        targetName: creature.name,
        spellName: creature.concentration.spell,
        dc: creature.concentration.dc,
      });
      combatSummaryChanged = true;
    }
  } else {
    combatSummaryChanged = true;
    if (creature.concentration && finalDamage > 0) {
      const saveBonus = creature?.saveBonuses?.['con'] ?? 0;
      const dragonConstellationActive = (() => {
        const rawActiveBuffs = getRuntimeValue(creature.name, 'activeBuffs');
        if (rawActiveBuffs == null || !Array.isArray(rawActiveBuffs)) { console.error('[applyDamage] activeBuffs is not an array'); throw new Error('activeBuffs must be an array'); }
        const activeBuffs = rawActiveBuffs;
        return activeBuffs.some(b => b.name === 'Starry Form' && b.constellation === 'Dragon');
      })();
      const relentlessHunterActive = (() => {
        const allCharacters = characters;
        const player = allCharacters.find(c => c.name === creature.name || c.name.startsWith(creature.name + ' '));
        const computed = player?.computedStats || player;
        if (!computed || computed.class?.name !== 'Ranger') return false;
        const rawClassLevels = computed.class?.class_levels;
        if (rawClassLevels == null || !Array.isArray(rawClassLevels)) { console.error('[applyDamage] class_levels is not an array'); throw new Error('class_levels must be an array'); }
        const classLevels = rawClassLevels;
        if (player?.level == null) {
          console.error('[applyDamage] Relentless Hunter: player level is missing')
          throw new Error('player level is required for relentless hunter check')
        }
        const currentLevel = classLevels.find(cl => cl.level === player.level);
        return (currentLevel?.level || 0) >= 13;
      })();
      if (!relentlessHunterActive) {
        const { success, roll, total } = rollConcentrationSave(saveBonus, creature.concentration.dc, dragonConstellationActive);
        if (!success) {
          const spellName = creature.concentration.spell;
          const dc = creature.concentration.dc;
          creature.concentration = null;
          npcConcentrationBroken = true;
          postLogEntry(campaignName, {
            type: 'concentration-broken',
            characterName: creature.name,
            spellName,
            roll,
            total,
            dc,
          });
        } else {
          postLogEntry(campaignName, {
            type: 'concentration-save',
            characterName: creature.name,
            spellName: creature.concentration.spell,
            roll,
            total,
            dc: creature.concentration.dc,
            success: true,
          });
        }
      }
    }
  }

  if (combatSummaryChanged || npcConcentrationBroken) {
    storage.set('combatSummary', combatSummary, campaignName);
  }

  window.dispatchEvent(new CustomEvent('combat-summary-updated'));

  return { finalDamage, oldHp, newHp, damageReduced: finalDamage < rawDamage, damageReducedByFeature: damageReducedByFeature, resistanceDetails };
}

function logDamageApplication(creature, damage, oldHp, newHp, campaignName) {
  const maxHp = creature.type === 'player'
    ? (getRuntimeValue(creature.name, 'hitPoints') ?? newHp)
    : creature.maxHp;
  const delta = newHp - oldHp;
  const isDead = newHp <= 0;
  const wasDead = oldHp <= 0;
  const wasBloodied = oldHp > 0 && oldHp <= Math.floor(maxHp / 2);
  const isBloodied = newHp > 0 && newHp <= Math.floor(maxHp / 2);

  let threshold;
  if (!wasDead && isDead) threshold = 'dead';
  else if (!wasBloodied && isBloodied) threshold = 'bloodied';
  else if (wasBloodied && !isBloodied && newHp > 0) threshold = 'recovering';

  const entry = {
    type: 'hp_change',
    targetName: creature.name,
    delta,
    currentHp: newHp,
    maxHp,
    isHealing: false,
    isUnconscious: isDead,
   };
  if (threshold) entry.threshold = threshold;

  if (creature.type === 'player') {
    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
    if (oldHp > 0 && isDead) {
      setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
      setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);
       }
     }

  postLogEntry(campaignName, entry);
}

function checkUndyingSentinel(creature, playerComputed, campaignName) {
    const rawAllFeatures = playerComputed?.allFeatures;
    if (rawAllFeatures == null || !Array.isArray(rawAllFeatures)) {
        return { intercepted: false };
    }
    const allFeatures = rawAllFeatures;
    let hasUndyingSentinel = false;

    for (const feature of allFeatures) {
        if (feature?.name === 'Undying Sentinel') {
            hasUndyingSentinel = true;
            break;
        }
    }

    if (!hasUndyingSentinel) {
        return { intercepted: false };
    }

    // Check if already used this long rest
    const alreadyUsed = getRuntimeValue(creature.name, 'undyingSentinelUsed', campaignName);
    if (alreadyUsed) {
        return { intercepted: false };
    }

    // Undying Sentinel triggers: set HP to 1 + (3 x paladin level)
    const paladinClassLevel = playerComputed?.class?.class_levels?.find(cl => cl.level === playerComputed.level);
    const paladinLevel = paladinClassLevel?.level || playerComputed.level;
    const healAmount = paladinLevel * 3;
    const storedMaxHp = getRuntimeValue(creature.name, 'hitPoints', campaignName);
    if (storedMaxHp == null) {
        console.error(`[applyDamage] Undying Sentinel: hitPoints not found for ${creature.name} in ${campaignName}`);
        throw new Error(`Undying Sentinel: hitPoints not found for ${creature.name}`);
    }
    const maxHp = storedMaxHp;
    const newHp = Math.min(1 + healAmount, maxHp);

    // Set the runtime HP value
    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);

    // Mark as used
    setRuntimeValue(creature.name, 'undyingSentinelUsed', true, campaignName);

    // Reset death saves since the character is back above 0 HP
    setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
    setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);

    // Remove unconscious condition
    const rawConditions = getRuntimeValue(creature.name, 'activeConditions', campaignName);
    if (rawConditions == null || !Array.isArray(rawConditions)) { console.error('[applyDamage] activeConditions is not an array'); throw new Error('activeConditions must be an array'); }
    const conditions = rawConditions;
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'unconscious');
    setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);

    // Update the creature in combat summary
    if (creature.type === 'player') {
        creature.currentHp = newHp;
    }

    // Log the healing
    postLogEntry(campaignName, {
        type: 'heal',
        targetName: creature.name,
        delta: newHp,
        currentHp: newHp,
        maxHp: maxHp,
        isHealing: true,
        isUnconscious: false,
        abilityName: 'Undying Sentinel',
    });

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return {
        intercepted: true,
        finalDamage: 0,
        newHp,
    };
}

function checkBoonOfRecoveryLastStand(creature, playerComputed, campaignName) {
    const rawAllFeatures = playerComputed?.allFeatures;
    if (rawAllFeatures == null || !Array.isArray(rawAllFeatures)) {
        return { intercepted: false };
    }
    const allFeatures = rawAllFeatures;
    let hasBoonOfRecovery = false;

    for (const feature of allFeatures) {
        if (feature?.name === 'Boon Of Recovery') {
            hasBoonOfRecovery = true;
            break;
        }
    }

    if (!hasBoonOfRecovery) {
        return { intercepted: false };
    }

    // Check if Last Stand has already been used this long rest
    const lastStandUsed = getRuntimeValue(creature.name, 'boonOfRecoveryLastStandUsed', campaignName);
    if (lastStandUsed) {
        return { intercepted: false };
    }

    const storedMaxHp = getRuntimeValue(creature.name, 'hitPoints', campaignName);
    if (storedMaxHp == null) {
        console.error(`[applyDamage] Last Stand: hitPoints not found for ${creature.name} in ${campaignName}`);
        throw new Error(`Last Stand: hitPoints not found for ${creature.name}`);
    }
    const maxHp = storedMaxHp;
    const healAmount = Math.floor(maxHp / 2);
    const newHp = Math.min(1 + healAmount, maxHp);

    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
    setRuntimeValue(creature.name, 'boonOfRecoveryLastStandUsed', true, campaignName);

    setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
    setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);

    const rawConditions = getRuntimeValue(creature.name, 'activeConditions', campaignName);
    if (rawConditions == null || !Array.isArray(rawConditions)) { console.error('[applyDamage] activeConditions is not an array'); throw new Error('activeConditions must be an array'); }
    const conditions = rawConditions;
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'unconscious');
    setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);

    if (creature.type === 'player') {
        creature.currentHp = newHp;
    }

    postLogEntry(campaignName, {
        type: 'heal',
        targetName: creature.name,
        delta: newHp,
        currentHp: newHp,
        maxHp,
        isHealing: true,
        isUnconscious: false,
        abilityName: 'Boon Of Recovery - Last Stand',
    });

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return {
        intercepted: true,
        finalDamage: 0,
        newHp,
    };
}

function checkRelentlessEndurance(creature, playerComputed, campaignName) {
    const rawAllFeatures = playerComputed?.allFeatures;
    if (rawAllFeatures == null || !Array.isArray(rawAllFeatures)) {
        return { intercepted: false };
    }
    const allFeatures = rawAllFeatures;
    let hasRelentlessEndurance = false;

    for (const feature of allFeatures) {
        if (feature?.name === 'Relentless Endurance') {
            hasRelentlessEndurance = true;
            break;
        }
    }

    if (!hasRelentlessEndurance) {
        return { intercepted: false };
    }

    // Check if already used this long rest
    const alreadyUsed = getRuntimeValue(creature.name, 'relentlessEnduranceUsed', campaignName);
    if (alreadyUsed) {
        return { intercepted: false };
    }

    // Relentless Endurance: set HP to 1 instead of 0
    const storedMaxHp = getRuntimeValue(creature.name, 'hitPoints', campaignName);
    if (storedMaxHp == null) {
        console.error(`[applyDamage] Relentless Endurance: hitPoints not found for ${creature.name} in ${campaignName}`);
        throw new Error(`Relentless Endurance: hitPoints not found for ${creature.name}`);
    }
    const maxHp = storedMaxHp;
    const newHp = 1;

    // Set the runtime HP value
    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);

    // Mark as used
    setRuntimeValue(creature.name, 'relentlessEnduranceUsed', true, campaignName);

    // Reset death saves since the character is back above 0 HP
    setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
    setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);

    // Remove unconscious condition
    const rawConditions = getRuntimeValue(creature.name, 'activeConditions', campaignName);
    if (rawConditions == null || !Array.isArray(rawConditions)) { console.error('[applyDamage] activeConditions is not an array'); throw new Error('activeConditions must be an array'); }
    const conditions = rawConditions;
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'unconscious');
    setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);

    // Update the creature in combat summary
    if (creature.type === 'player') {
        creature.currentHp = newHp;
    }

    // Log the healing
    postLogEntry(campaignName, {
        type: 'heal',
        targetName: creature.name,
        delta: newHp,
        currentHp: newHp,
        maxHp: maxHp,
        isHealing: true,
        isUnconscious: false,
        abilityName: 'Relentless Endurance',
    });

    window.dispatchEvent(new CustomEvent('combat-summary-updated'));

    return {
        intercepted: true,
        finalDamage: 0,
        newHp,
    };
}
