import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import storage from '../../ui/storage.js';
import { rollD20 } from '../../dice/diceRoller.js';
import utils from '../../ui/utils.js';
import { sendDeathSavePrompt, sendConcentrationPrompt } from '../../combat/conditions/savePromptService.js';
import { rollConcentrationSave } from '../../combat/concentration/concentrationRules.js';
import { postLogEntry } from '../../shared/logPoster.js';
import { getDamageReduction } from '../../combat/automation/automationPassives.js';
import { isCreatureInSilenceZone } from '../../rules/features/silenceService.js';
import { processTashasLaughterRepeatSave } from '../../automation/handlers/spells/tashasLaughterHandler.js';
import { applyWardingBond } from '../../rules/features/wardingBondService.js';
import { applyThoughtShield } from '../../rules/features/thoughtShieldService.js';
import { checkPsychicVeil } from '../../rules/features/psychicVeilService.js';
import { checkHolyAuraDamage } from '../../rules/features/holyAuraDamageService.js';
import { checkDarkOnesBlessing } from '../../rules/features/darkOnesBlessingService.js';
import { checkUndyingSentinel } from '../../rules/features/undyingSentinelService.js';
import { checkBoonOfRecoveryLastStand } from '../../rules/features/boonOfRecoveryService.js';
import { checkRelentlessEndurance } from '../../rules/features/relentlessEnduranceService.js';

// Tracks which multi-attack sequences have already triggered Relentless Endurance.
// Prevents follow-up hits in the same sequence from re-killing the character.
const _reTriggeredSequenceIds = new Set();

export function clearReTriggeredSequence(damageSequenceId) {
    _reTriggeredSequenceIds.delete(damageSequenceId);
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

const SAVE_TYPE_ABBREVIATIONS = {
  'STRENGTH': 'STR',
  'DEXTERITY': 'DEX',
  'CONSTITUTION': 'CON',
  'INTELLIGENCE': 'INT',
  'WISDOM': 'WIS',
  'CHARISMA': 'CHA',
};

export function normalizeSaveType(saveType) {
  if (!saveType) return '';
  const upper = saveType.toUpperCase();
  return SAVE_TYPE_ABBREVIATIONS[upper] || upper;
}

export function hasEvasionForSave(evasionEffects, saveType) {
  if (!evasionEffects || evasionEffects.length === 0) return false;
  const normalized = normalizeSaveType(saveType);
  return evasionEffects.some(e => e.saveType === normalized);
}

export function computeDamageAfterEvasion(rawDamage, saveSuccess, dcSuccess, evasionActive) {
  if (evasionActive && dcSuccess === 'half') {
    if (saveSuccess) return 0;
    return Math.floor(rawDamage / 2);
  }
  return computeDamageAfterSave(rawDamage, saveSuccess, dcSuccess);
}

export function rollSaveForCreature(creature, saveType, saveDc, disadvantage = false, advantage = false) {
  const bonus = creature?.saveBonuses?.[saveType] ?? 0;
  const roll1 = rollD20();
  const roll2 = disadvantage || advantage ? rollD20() : roll1;
  const finalRoll = disadvantage ? Math.min(roll1, roll2) : advantage ? Math.max(roll1, roll2) : roll1;
  const total = finalRoll + bonus;
  const success = total >= saveDc;
  return { roll: finalRoll, total, bonus, success, rawRolls: [roll1, roll2] };
}

export function applyDamageToTarget(combatSummary, targetName, rawDamage, damageTypes, campaignName, characters, ignoreResistance = false, attackerName = null, suppressHpLog = false, options = {}) {
  if (!combatSummary) return null;
  const creature = combatSummary.creatures.find(c => c.name === targetName);
  if (!creature) return null;
  if (isNaN(rawDamage) || rawDamage === null || rawDamage === undefined) return null;

  // Save unified last attack to combat summary — accessible by any creature for reactions
  // This overwrites the attack roll info with damage results after applyDamageToTarget runs
  const existingAttack = combatSummary.lastAttack;
  const isSecondary = existingAttack?.primaryDamage != null;
  combatSummary.lastAttack = {
    ...existingAttack,
    attackerName: attackerName || existingAttack?.attackerName || null,
    targetName,
    weaponType: existingAttack?.weaponType || 'melee',
    isUnarmedStrike: existingAttack?.isUnarmedStrike || false,
    rawDamage,
    ...(isSecondary ? {} : { primaryDamage: rawDamage }),
    secondaryDamage: isSecondary ? rawDamage : null,
    damageTypes,
    damageApplied: true,
    timestamp: Date.now(),
  };

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

    // Arcane Ward: absorb damage before it hits HP
    let wardDamage = finalDamage;
    let wardAbsorbed;

    // Self-damage: Arcane Ward absorbs damage to the wizard themselves
    if (isPlayer) {
        const wardActive = getRuntimeValue(creature.name, 'arcaneWardActive', campaignName);
        if (wardActive) {
            const wardHp = Number(getRuntimeValue(creature.name, 'arcaneWardHp', campaignName) ?? 0);
            if (wardHp > 0) {
                wardAbsorbed = Math.min(wardDamage, wardHp);
                const newWardHp = wardHp - wardAbsorbed;
                setRuntimeValue(creature.name, 'arcaneWardHp', newWardHp, campaignName);
                wardDamage -= wardAbsorbed;
            }
        }
    }

    let oldHp, newHp;
    if (isPlayer) {
       const storedCurrentHp = getRuntimeValue(creature.name, 'currentHitPoints');
       if (storedCurrentHp == null) {
           console.error(`[applyDamage] Arcane Ward: currentHitPoints not found for ${creature.name}`);
           throw new Error(`Arcane Ward: currentHitPoints not found for ${creature.name}`);
       }

       // Temp HP absorbs damage first
       let damageAfterTempHp = wardDamage;
       const currentTempHp = Number(getRuntimeValue(creature.name, 'tempHp', campaignName) || 0);
       if (currentTempHp > 0) {
           const absorbed = Math.min(damageAfterTempHp, currentTempHp);
           damageAfterTempHp -= absorbed;
           setRuntimeValue(creature.name, 'tempHp', currentTempHp - absorbed, campaignName);
       }

       oldHp = storedCurrentHp;
       newHp = Math.max(0, oldHp - damageAfterTempHp);
       // If RE already fired in this damage sequence, don't let follow-up hits re-kill
       if (options?.damageSequenceId && _reTriggeredSequenceIds.has(options.damageSequenceId) && newHp <= 0 && oldHp > 0) {
           newHp = 1;
       }
       setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
    } else {
       oldHp = creature.currentHp;
       newHp = Math.max(0, oldHp - wardDamage);
       if (options?.damageSequenceId && _reTriggeredSequenceIds.has(options.damageSequenceId) && newHp <= 0 && oldHp > 0) {
           newHp = 1;
       }
       creature.currentHp = newHp;
      }

    // Update lastAttack with actual HP damage dealt (after resistances, feature reduction, ward absorption)
    if (isSecondary) {
        combatSummary.lastAttack.actualDamage = (combatSummary.lastAttack.actualDamage || 0) + wardDamage;
    } else {
        combatSummary.lastAttack.actualDamage = wardDamage;
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
      if (isPlayer) {
        applyWardingBond(creature, combatSummary, campaignName, wardDamage);
      }
      if (isPlayer && attackerName && attackerName !== creature.name) {
        applyThoughtShield(creature, attackerName, playerComputed, damageTypes, combatSummary, campaignName, wardDamage);
      }
      if (isPlayer) {
        const rawConditions = getRuntimeValue(creature.name, 'activeConditions');
        const conditions = rawConditions || [];
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
        const rawConditions = getRuntimeValue(creature.name, 'activeConditions') || [];
        const hadFrightened = rawConditions.some(c => String(c).toLowerCase() === 'frightened');
        if (hadFrightened) {
          const filtered = rawConditions.filter(c => String(c).toLowerCase() !== 'frightened');
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
        const hadCharmed = rawConditions.some(c => String(c).toLowerCase() === 'charmed');
        if (hadCharmed) {
          const filtered = rawConditions.filter(c => String(c).toLowerCase() !== 'charmed');
          setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);
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
        checkPsychicVeil(attackerName, campaignName);
        // Supreme Sneak: if Stealth Attack is active, don't remove Invisible condition
        const stealthAttackCost = getRuntimeValue(attackerName, 'stealthAttackCost', campaignName);
        if (stealthAttackCost && stealthAttackCost > 0) {
          const rawAttackerConditions2 = getRuntimeValue(attackerName, 'activeConditions');
          const attackerConditions2 = rawAttackerConditions2 || [];
          const attackerCondArray2 = attackerConditions2;
          const hasInvisible = attackerCondArray2.some(c => String(c).toLowerCase() === 'invisible');
          if (hasInvisible) {
            // Preserve Invisible condition — don't remove it
            // The stealthAttackCost will be cleared at start of next turn
          }
        }
     }

     checkHolyAuraDamage(creature, attackerName, combatSummary, campaignName, wardDamage);
    }

   const wasAlive = oldHp > 0;
   const isNowUnconscious = newHp <= 0;

   if (!options?.skipConcentration && creature.concentration && (finalDamage > 0 || options?.concentrationTotalDamage > 0)) {
     const dcDamage = options?.concentrationTotalDamage ?? finalDamage;
     creature.concentration.dc = Math.max(10, Math.floor(dcDamage / 2));
   }

    checkDarkOnesBlessing(characters, creature, finalDamage, isPlayer, wasAlive, isNowUnconscious, campaignName);

    if (!suppressHpLog) {
        logDamageApplication(creature, finalDamage, oldHp, newHp, campaignName);
    }

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
        if (options?.damageSequenceId) {
          _reTriggeredSequenceIds.add(options.damageSequenceId);
        }
        return relentlessEnduranceResult;
      }

      const promptId = utils.guid();
      sendDeathSavePrompt(campaignName, {
        promptId,
        targetName: creature.name,
      });
    }

    if (!options?.skipConcentration && creature.concentration && (finalDamage > 0 || options?.concentrationTotalDamage > 0)) {
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
    if (!options?.skipConcentration && creature.concentration && (finalDamage > 0 || options?.concentrationTotalDamage > 0)) {
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

  if (combatSummaryChanged || npcConcentrationBroken || existingAttack) {
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
