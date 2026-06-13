import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import storage from '../ui/storage.js';
import { rollD20 } from '../dice/diceRoller.js';
import utils from '../ui/utils.js';
import { sendDeathSavePrompt, sendConcentrationPrompt } from '../combat/savePromptService.js';
import { rollConcentrationSave } from '../combat/concentrationRules.js';
import { postLogEntry } from '../shared/logPoster.js';

/**
 * Save the last damage event under the target's key so reaction features
 * (e.g., Superior Hunter's Defense) can find the most recent damage the
 * target received via getLastDamageEvent(targetName).
 */
function saveDamageEventForTarget(targetName, rawDamage, damageTypes, campaignName) {
    if (!targetName || !campaignName) return;
    const damageType = damageTypes && damageTypes.length > 0 ? damageTypes[0] : 'untyped';
    setRuntimeValue(targetName, 'lastMetamagicDamage', {
        targetName,
        rawDamage,
        damageType,
        damageTypes,
        timestamp: Date.now(),
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
   const playerStats = isPlayer ? (characters || []).find(c => c.name === targetName || c.name.startsWith(targetName + ' ')) : null;
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
   }
    const finalDamage = computeDamageAfterResistances(rawDamage, damageTypes || [], resistances, immunities, ignoreResistance);

   // Save damage event under target's key for reaction features
   if (isPlayer) {
       saveDamageEventForTarget(creature.name, rawDamage, damageTypes || [], campaignName);
   }

   let oldHp, newHp;
  if (isPlayer) {
    oldHp = getRuntimeValue(creature.name, 'currentHitPoints') ?? 0;
    newHp = Math.max(0, oldHp - finalDamage);
    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);
  } else {
    oldHp = creature.currentHp;
    newHp = Math.max(0, oldHp - finalDamage);
    creature.currentHp = newHp;
  }

  if (finalDamage > 0) {
    if (isPlayer) {
      const conditions = getRuntimeValue(creature.name, 'activeConditions') || [];
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
    } else {
      const hadFrightened = creature.conditions.some(c => c.key === 'frightened');
      if (hadFrightened) {
        creature.conditions = creature.conditions.filter(c => c.key !== 'frightened');
        postLogEntry(campaignName, {
          type: 'condition',
          action: 'removed',
          characterName: creature.name,
          condition: 'Frightened',
          reason: 'took damage',
          timestamp: Date.now(),
        });
      }
    }

    if (attackerName && attackerName !== creature.name) {
      const attackerBuffs = getRuntimeValue(attackerName, 'activeBuffs', campaignName);
      const attackerBuffArray = Array.isArray(attackerBuffs) ? attackerBuffs : [];
      if (attackerBuffArray.some(b => b.name === 'Psychic Veil')) {
        const attackerConditions = getRuntimeValue(attackerName, 'activeConditions') || [];
        const attackerCondArray = Array.isArray(attackerConditions) ? attackerConditions : [];
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
        const attackerConditions = getRuntimeValue(attackerName, 'activeConditions') || [];
        const attackerCondArray = Array.isArray(attackerConditions) ? attackerConditions : [];
        const hasInvisible = attackerCondArray.some(c => String(c).toLowerCase() === 'invisible');
        if (hasInvisible) {
          // Preserve Invisible condition — don't remove it
          // The stealthAttackCost will be cleared at start of next turn
        }
      }
    }

  }

  const wasAlive = oldHp > 0;
  const isNowUnconscious = newHp <= 0;

  if (creature.concentration && finalDamage > 0) {
    creature.concentration.dc = Math.max(10, Math.floor(finalDamage / 2));
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
        const activeBuffs = getRuntimeValue(creature.name, 'activeBuffs') || [];
        return activeBuffs.some(b => b.name === 'Starry Form' && b.constellation === 'Dragon');
      })();
      const relentlessHunterActive = (() => {
        const allCharacters = (characters || []);
        const player = allCharacters.find(c => c.name === creature.name || c.name.startsWith(creature.name + ' '));
        const computed = player?.computedStats || player;
        if (!computed || computed.class?.name !== 'Ranger') return false;
        const classLevels = computed.class?.class_levels || [];
        const currentLevel = classLevels.find(cl => cl.level === (player?.level || 1));
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

  return { finalDamage, oldHp, newHp, damageReduced: finalDamage < rawDamage };
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
    maxHp: creature.maxHp,
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
    const allFeatures = playerComputed?.allFeatures || [];
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
    const maxHp = getRuntimeValue(creature.name, 'hitPoints', campaignName) ?? playerComputed?.hitPoints?.max ?? 100;
    const newHp = Math.min(1 + healAmount, maxHp);

    // Set the runtime HP value
    setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);

    // Mark as used
    setRuntimeValue(creature.name, 'undyingSentinelUsed', true, campaignName);

    // Reset death saves since the character is back above 0 HP
    setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
    setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);

    // Remove unconscious condition
    const conditions = getRuntimeValue(creature.name, 'activeConditions', campaignName) || [];
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
