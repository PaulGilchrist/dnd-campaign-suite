import { getRuntimeValue, setRuntimeValue, getStore } from '../../../hooks/runtime/useRuntimeState.js';
import storage from '../../ui/storage.js';
import { rollD20 } from '../../dice/diceRoller.js';
import utils from '../../ui/utils.js';
import { sendDeathSavePrompt, sendConcentrationPrompt } from '../../combat/conditions/savePromptService.js';
import { rollConcentrationSave } from '../../combat/concentration/concentrationRules.js'
import { cleanupConcentrationEffects } from '../../combat/concentration/concentrationService.js';
import { addEntry } from '../../ui/logService.js';
import { getDamageReduction, getDamageResistances } from '../../combat/automation/automationPassives.js';
import { computeAuraComboEffects } from '../../combat/auras/auraComboEffects.js';
import { isCreatureInSilenceZone } from '../../rules/features/silenceService.js';
import { applyWardingBond } from '../../rules/features/wardingBondService.js';
import { wakeSleepOnDamage } from '../../rules/features/sleepService.js';
import { checkPsychicVeil } from '../../rules/features/psychicVeilService.js';
import { checkHolyAuraDamage } from '../../rules/features/holyAuraDamageService.js';
import { checkDarkOnesBlessing } from '../../rules/features/darkOnesBlessingService.js';
import { checkUndyingSentinel } from '../../rules/features/undyingSentinelService.js';
import { checkBoonOfRecoveryLastStand } from '../../rules/features/boonOfRecoveryService.js';
import { checkRelentlessEndurance } from '../../rules/features/relentlessEnduranceService.js';
import { checkRelentlessRage } from '../../rules/features/relentlessRageService.js';
import { checkDeathWard } from '../../rules/features/deathWardService.js';
import { isActive as isAvengingAngelActive, cleanupAuraTargetOnDamage } from '../../automation/handlers/class-cleric-paladin/avengingAngelHandler.js';
import { endCompelledDuel } from '../../automation/handlers/spells/compelledDuelHandler.js';
import { createSaveListener } from '../../automation/common/savePrompt.js';
import { revertPolymorph } from '../../automation/handlers/spells/polymorphService.js';
import { cleanupWildShape } from '../../automation/handlers/class-druid/wildShapeCreatureBuilder.js';

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

export function computeDamageAfterResistancesWithDetails(rawDamage, damageTypes, resistances, immunities, ignoreResistance = false, spellOrigin = false) {
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
  } else if (spellOrigin && !ignoreResistance && resistances?.some(r => String(r).toLowerCase() === 'spell')) {
    // CLA-324: categorical 'Spell' resistance (e.g. Abjurer Spell Resistance passive_immunity
    // damage_resistance:['Spell']) halves spell-origin damage. 'Spell' is never a concrete
    // damage type, so it is matched via the spellOrigin flag, not the damageTypes loop.
    finalDamage = Math.floor(rawDamage / 2);
    typeDetails.push({ damageType: 'Spell', status: 'resistant' });
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
  // CLA-303: saveBonuses keys are lowercase (getMonsterSaveBonuses contract);
  // callers pass uppercase ('WIS') — normalize so the bonus is never silently +0.
  const bonusKey = String(saveType ?? '').toLowerCase();
  const bonus = creature?.saveBonuses?.[bonusKey] ?? creature?.saveBonuses?.[saveType] ?? 0;
  const roll1 = rollD20();
  const roll2 = disadvantage || advantage ? rollD20() : roll1;
  const finalRoll = disadvantage ? Math.min(roll1, roll2) : advantage ? Math.max(roll1, roll2) : roll1;
  const total = finalRoll + bonus;
  const success = total >= saveDc;
  return { roll: finalRoll, total, bonus, success, rawRolls: [roll1, roll2] };
}

// Relentless Hunter (Ranger): "Taking damage can't break your Concentration on Hunter's
// Mark." The exemption is rule-exact ONLY while the concentrated spell IS Hunter's Mark.
// Feature availability is resolved from class_levels data (feature presence at the
// character's level) — NOT a hardcoded magic number. Reuses the established feature-name
// pattern (see WizardStepMagicItems.jsx:31-33).
function hasRelentlessHunterExemption(creature, characters) {
  if (creature?.concentration?.spell !== "Hunter's Mark") return false;
  const player = (characters || []).find(c => c.name === creature.name || c.name.startsWith(creature.name + ' '));
  const computed = player?.computedStats || player;
  if (!computed || computed.class?.name !== 'Ranger') return false;
  const rawClassLevels = computed.class?.class_levels;
  if (rawClassLevels == null || !Array.isArray(rawClassLevels)) { console.error('[applyDamage] class_levels is not an array'); throw new Error('class_levels must be an array'); }
  const level = player?.level ?? computed.level;
  if (level == null) {
    console.error('[applyDamage] Relentless Hunter: player level is missing');
    throw new Error('player level is required for relentless hunter check');
  }
  return rawClassLevels.some(cl => cl.level <= level && (cl.features || []).some(f => f.name === 'Relentless Hunter'));
}

export async function applyDamageToTarget(combatSummary, targetName, rawDamage, damageTypes, campaignName, characters, ignoreResistance = false, attackerName = null, suppressHpLog = false, options = {}) {
  if (!combatSummary) return null;
  const creature = combatSummary.creatures.find(c => c.name === targetName);
  if (!creature) return null;
  if (isNaN(rawDamage) || rawDamage === null || rawDamage === undefined) return null;

  const existingAttack = getRuntimeValue('campaign', 'lastAttack') || null;
  const isSecondary = existingAttack?.primaryDamage != null;
  let holyAuraSaveResult = null;
  const newLastAttack = {
    ...existingAttack,
    attackerName: attackerName || existingAttack?.attackerName || null,
    targetName,
    weaponType: existingAttack?.weaponType || 'melee',
    isUnarmedStrike: existingAttack?.isUnarmedStrike || false,
    rawDamage,
    ...(isSecondary ? {} : {
      primaryDamage: rawDamage,
      primaryDamageType: damageTypes[0] || null
    }),
    secondaryDamage: isSecondary ? rawDamage : null,
    secondaryDamageType: isSecondary ? damageTypes[0] || null : null,
    damageTypes,
    damageApplied: true,
    timestamp: Date.now(),
  };
  setRuntimeValue('campaign', 'lastAttack', newLastAttack, campaignName);

  const isPlayer = creature.type === 'player';
  if (!Array.isArray(characters)) { throw new Error('characters must be an array'); }
  const playerStats = isPlayer ? characters.find(c => c.name === targetName || c.name.startsWith(targetName + ' ')) : null;
  const playerComputed = playerStats?.computedStats || playerStats;
  let resistances = isPlayer ? (playerComputed?.resistances || []) : (creature.resistances || []);
  if (isPlayer && playerStats) {
    const statsForPassives = playerComputed?.automation || playerStats?.automation;
    if (statsForPassives?.passives?.length) {
      const passiveResistances = statsForPassives ? getDamageResistances({ automation: statsForPassives }) : [];
      if (passiveResistances.length > 0) {
        resistances = [...new Set([...resistances, ...passiveResistances])];
      }
    }
  }
  let immunities = isPlayer ? (playerComputed?.immunities || []) : (creature.immunities || []);

  const rawBuffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName);
  const activeBuffs = Array.isArray(rawBuffs) ? rawBuffs : [];

  if (isPlayer) {
    for (const buff of activeBuffs) {
       if (buff.resistanceTypes?.length) {
           resistances = [...new Set([...resistances, ...buff.resistanceTypes])];
       }
   }
  }
  // Silence — Thunder immunity for ANY creature (player or monster) inside the silence zone
  let silenceThunderImmunity = false;
  for (const buff of activeBuffs) {
      if (buff.effect === 'silence' && buff.sourceCharacter) {
          if (isCreatureInSilenceZone(creature.name, buff.sourceCharacter, campaignName)) {
              if (!immunities.some(i => String(i).toLowerCase() === 'thunder')) {
                  immunities = [...immunities, 'Thunder'];
              }
              silenceThunderImmunity = true;
              break;
          }
      }
  }
// Aura-granted resistances (e.g., Aura of Warding) — computeAuraComboEffects self-filters
// to targets that are the source paladin or an ally within Aura of Protection range
const auraComboEffects = await computeAuraComboEffects({ targetName, characters });
if (auraComboEffects.resistances.length > 0) {
  resistances = [...new Set([...resistances, ...auraComboEffects.resistances])];
}
if (!Array.isArray(damageTypes)) { throw new Error('damageTypes must be an array'); }
    let combatSummaryChanged = false;
    // CLA-324: spell-origin is knowable from the damage payload (options.isSpellDamage) or
    // the campaign lastAttack (spell-save stamps, monster-card save-attack stamps).
    const spellOrigin = options?.isSpellDamage === true || existingAttack?.rollType === 'spell-save' || existingAttack?.isSpellDamage === true;
    const resResult = computeDamageAfterResistancesWithDetails(rawDamage, damageTypes, resistances, immunities, ignoreResistance, spellOrigin);
     let finalDamage = resResult.finalDamage;
    let resistanceDetails = resResult.typeDetails;

    if (spellOrigin && rawDamage > 0 && resistanceDetails.some(rd => rd.damageType === 'Spell' && rd.status === 'resistant')) {
        addEntry(campaignName, {
            type: 'automation',
            creatureName: creature.name,
            name: 'Spell Resistance',
            description: `${creature.name} has resistance to damage of spells — ${rawDamage} spell damage halved to ${finalDamage}.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[applyDamage] Spell Resistance log failed:', e); });
    }

    if (silenceThunderImmunity && rawDamage > 0 && damageTypes.some(dt => String(dt).toLowerCase() === 'thunder')) {
        addEntry(campaignName, {
            type: 'automation',
            creatureName: creature.name,
            name: 'Silence',
            description: `${creature.name} is immune to Thunder damage inside the Silence zone — ${rawDamage} damage negated.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[applyDamage] Silence immunity log failed:', e); });
    }

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

    let oldHp, newHp, actualDamageTaken;

    // Temp HP absorbs damage first for all creatures
    let damageAfterTempHp = wardDamage;
    const currentTempHp = Number(getRuntimeValue(creature.name, 'tempHp', campaignName) || 0);
    if (currentTempHp > 0) {
        const absorbed = Math.min(damageAfterTempHp, currentTempHp);
        damageAfterTempHp -= absorbed;
        setRuntimeValue(creature.name, 'tempHp', currentTempHp - absorbed, campaignName);
    }

    // Polymorph: when the beast form's temp-HP buffer is depleted, the transformation ends
    const polymorphBuffer = Number(getRuntimeValue(creature.name, 'polymorphTempHp', campaignName) || 0);
    const tempHpAfterDrain = Number(getRuntimeValue(creature.name, 'tempHp', campaignName) || 0);
    if (polymorphBuffer > 0 && tempHpAfterDrain <= 0) {
        await revertPolymorph(creature.name, campaignName);
    }

    if (isPlayer) {
       const storedCurrentHp = getRuntimeValue(creature.name, 'currentHitPoints');
       if (storedCurrentHp == null) {
           const store = getStore(creature.name);
           const storeKeys = [...store.keys()];
           console.error(`[applyDamage] currentHitPoints not found for "${creature.name}"`, {
               creatureNameChars: JSON.stringify(creature.name),
               campaignName,
               storeKeys,
               creatureType: creature.type,
               rawDamage,
               finalDamage,
           });
           throw new Error(`currentHitPoints not found for ${JSON.stringify(creature.name)}`);
       }

       oldHp = storedCurrentHp;
       newHp = Math.max(0, oldHp - damageAfterTempHp);
       actualDamageTaken = oldHp - newHp;
       // If RE already fired in this damage sequence, don't let follow-up hits re-kill
       if (options?.damageSequenceId && _reTriggeredSequenceIds.has(options.damageSequenceId) && newHp <= 0 && oldHp > 0) {
           newHp = 1;
       }
        setRuntimeValue(creature.name, 'currentHitPoints', newHp, campaignName);

        if (creature.wildShapeSource && newHp <= 0 && oldHp > 0) {
            cleanupWildShape(creature.name, campaignName);
            setRuntimeValue(creature.name, 'deathSaves', [false, false, false], campaignName);
            setRuntimeValue(creature.name, 'deathFailures', [false, false, false], campaignName);
        }
      } else {
        oldHp = creature.currentHp;
        newHp = Math.max(0, oldHp - damageAfterTempHp);
        actualDamageTaken = oldHp - newHp;
        if (options?.damageSequenceId && _reTriggeredSequenceIds.has(options.damageSequenceId) && newHp <= 0 && oldHp > 0) {
            newHp = 1;
        }
        creature.currentHp = newHp;

        if (creature.wildShapeSource && newHp <= 0 && oldHp > 0) {
            const druidName = creature.wildShapeSource;
            cleanupWildShape(druidName, campaignName);
            setRuntimeValue(druidName, 'currentHitPoints', 0, campaignName);
            setRuntimeValue(druidName, 'deathSaves', [false, false, false], campaignName);
            setRuntimeValue(druidName, 'deathFailures', [false, false, false], campaignName);
        }
       }

    // SP-107: Sleep ends on a target that takes damage (staged Incapacitated or Unconscious).
    if (actualDamageTaken > 0) {
        wakeSleepOnDamage(campaignName, creature.name, actualDamageTaken);
    }

    // Update lastAttack with actual HP damage dealt (after resistances, feature reduction, ward absorption)
    if (isSecondary) {
        const existing = getRuntimeValue('campaign', 'lastAttack') || null;
        if (existing) {
            existing.actualDamage = (existing.actualDamage || 0) + wardDamage;
            setRuntimeValue('campaign', 'lastAttack', existing, campaignName);
        }
    } else {
        const existing = getRuntimeValue('campaign', 'lastAttack') || null;
        if (existing) {
            existing.actualDamage = wardDamage;
            setRuntimeValue('campaign', 'lastAttack', existing, campaignName);
        }
    }

    // Projected Ward: record recent damage on the damaged player so an Abjurer's
    // reaction (arcaneWardHandler) can roll back-absorb it. Mirrors the
    // bastionOfLawLastAttackDamage record mechanism (campaign lastAttack).
    const damagedIsWarden = isPlayer && getRuntimeValue(creature.name, 'arcaneWardActive', campaignName);
    if (isPlayer && actualDamageTaken > 0 && !damagedIsWarden) {
        const prevRecord = getRuntimeValue(creature.name, 'projectedWardDamage', campaignName);
        const sameSequence = isSecondary && prevRecord && attackerName && prevRecord.attackerName === attackerName;
        const recordedDamage = actualDamageTaken + (sameSequence ? Number(prevRecord.rawDamage || 0) : 0);
        setRuntimeValue(creature.name, 'projectedWardDamage', {
            rawDamage: recordedDamage,
            damageType: damageTypes[0] || null,
            attackerName: attackerName || null,
            timestamp: Date.now(),
        }, campaignName);
    }

    if (wardDamage > 0) {
        applyWardingBond(creature, combatSummary, campaignName, wardDamage);
      // Dominate (Person/Monster/Beast): a dominated target repeats its WIS save
      // on damage instead of the generic unconditional charm-strip.
      const domination = findDomination(creature.name, combatSummary, campaignName);
      if (domination) {
        const summaryChanged = handleDominateRepeatSave(creature, isPlayer, domination, combatSummary, characters, campaignName, attackerName);
        if (summaryChanged) combatSummaryChanged = true;
      }
      if (isPlayer) {
        const rawConditions = getRuntimeValue(creature.name, 'activeConditions');
        const conditions = rawConditions || [];
        if (conditions.some(c => String(c).toLowerCase() === 'frightened')) {
          const filtered = conditions.filter(c => String(c).toLowerCase() !== 'frightened');
          setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);
          addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: creature.name,
            condition: 'Frightened',
            reason: 'took damage',
            timestamp: Date.now(),
          }).catch((e) => { console.error("[applyDamage] Error:", e); });
        }
        if (!domination && conditions.some(c => String(c).toLowerCase() === 'charmed')) {
          const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
          setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);
          addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: creature.name,
            condition: 'Charmed',
            reason: 'took damage (Friends)',
            timestamp: Date.now(),
          }).catch((e) => { console.error("[applyDamage] Error:", e); });
        }
      } else {
        const rawConditions = getRuntimeValue(creature.name, 'activeConditions') || [];
        const hadFrightened = rawConditions.some(c => String(c).toLowerCase() === 'frightened');
        if (hadFrightened) {
          const filtered = rawConditions.filter(c => String(c).toLowerCase() !== 'frightened');
          setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);
          addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: creature.name,
            condition: 'Frightened',
            reason: 'took damage',
            timestamp: Date.now(),
          }).catch((e) => { console.error("[applyDamage] Error:", e); });
        }
        const hadCharmed = rawConditions.some(c => String(c).toLowerCase() === 'charmed');
        if (!domination && hadCharmed) {
          const filtered = rawConditions.filter(c => String(c).toLowerCase() !== 'charmed');
          setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);
          addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: creature.name,
            condition: 'Charmed',
            reason: 'took damage (Charm)',
            timestamp: Date.now(),
          }).catch((e) => { console.error("[applyDamage] Error:", e); });
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

      holyAuraSaveResult = await checkHolyAuraDamage(creature, attackerName, combatSummary, campaignName, wardDamage);

       // Compelled Duel: the effect ends if the target takes damage from anyone other than the caster
       if (attackerName && attackerName !== creature.name) {
         const duelEffects = (getRuntimeValue('campaign', 'targetEffects') || []).filter(
           te => te.effect === 'compelled_duel' && te.target === creature.name && te.source !== attackerName
         );
         if (duelEffects.length > 0) {
           endCompelledDuel(duelEffects[0].source, creature.name, campaignName,
             `${attackerName} damaged ${creature.name}, breaking the duel.`);
         }
        }

       }

      // Clean up Avenging Angel Frightful Aura tracking list when a creature takes damage
     if (wardDamage > 0 && characters?.length) {
         for (const char of characters) {
             if (isAvengingAngelActive(char.name, campaignName)) {
                 cleanupAuraTargetOnDamage(char.name, creature.name, campaignName).catch(e => {
                     console.error('[applyDamage] Avenging Angel aura cleanup failed:', e);
                 });
             }
         }
     }

    const wasAlive = oldHp > 0;
   const isNowUnconscious = newHp <= 0;

   if (!options?.skipConcentration && creature.concentration && (actualDamageTaken > 0 || options?.concentrationTotalDamage > 0)) {
     const dcDamage = options?.concentrationTotalDamage ?? actualDamageTaken;
     creature.concentration.dc = Math.max(10, Math.floor(dcDamage / 2));
   }

        checkDarkOnesBlessing(characters, creature, finalDamage, isPlayer, wasAlive, isNowUnconscious, campaignName, attackerName);

  let npcConcentrationBroken = false;
    if (creature.type === 'player') {
    if (wasAlive && isNowUnconscious) {
      // Check for Undying Sentinel (Oath of Glory level 15)
      const undyingResult = checkUndyingSentinel(creature, playerComputed, campaignName);
      if (undyingResult.intercepted) {
        return { ...undyingResult, damageDealt: finalDamage, oldHp, interceptedFeature: 'Undying Sentinel' };
      }

      // Check for Boon of Recovery - Last Stand
      const boonOfRecoveryResult = checkBoonOfRecoveryLastStand(creature, playerComputed, campaignName);
      if (boonOfRecoveryResult.intercepted) {
        return { ...boonOfRecoveryResult, damageDealt: finalDamage, oldHp, interceptedFeature: 'Boon of Recovery' };
      }

      // Check for Relentless Endurance (Orc race trait)
      const relentlessEnduranceResult = checkRelentlessEndurance(creature, playerComputed, campaignName);
      if (relentlessEnduranceResult.intercepted) {
        if (options?.damageSequenceId) {
          _reTriggeredSequenceIds.add(options.damageSequenceId);
        }
        return { ...relentlessEnduranceResult, damageDealt: finalDamage, oldHp, interceptedFeature: 'Relentless Endurance' };
      }

      // Check for Relentless Rage (Barbarian class feature)
      const relentlessRageResult = checkRelentlessRage(creature, playerComputed, campaignName);
      if (relentlessRageResult.intercepted) {
        return { ...relentlessRageResult, damageDealt: finalDamage, oldHp, interceptedFeature: 'Relentless Rage' };
      }

      // Check for Death Ward (4th level abjuration spell)
      const deathWardResult = checkDeathWard(creature, playerComputed, campaignName);
      if (deathWardResult.intercepted) {
        return { ...deathWardResult, damageDealt: finalDamage, oldHp, interceptedFeature: 'Death Ward' };
      }

      const promptId = utils.guid();
      sendDeathSavePrompt(campaignName, {
        promptId,
        targetName: creature.name,
      });
    }

    if (!options?.skipConcentration && creature.concentration && (actualDamageTaken > 0 || options?.concentrationTotalDamage > 0)) {
      if (hasRelentlessHunterExemption(creature, characters)) {
        addEntry(campaignName, {
          type: 'condition',
          action: 'maintained',
          characterName: creature.name,
          condition: 'Concentration on Hunter\'s Mark',
          sourceName: 'Relentless Hunter',
        }).catch((e) => { console.error("[applyDamage] Error:", e); });
      } else {
        const promptId = utils.guid();
        sendConcentrationPrompt(campaignName, {
          promptId,
          targetName: creature.name,
          spellName: creature.concentration.spell,
          dc: creature.concentration.dc,
          attackerName,
        });
        combatSummaryChanged = true;
      }
    }
  } else {
    combatSummaryChanged = true;
    if (!options?.skipConcentration && creature.concentration && (finalDamage > 0 || options?.concentrationTotalDamage > 0)) {
      const saveBonus = creature?.saveBonuses?.['con'] ?? 0;
      const dragonConstellationActive = (() => {
        const rawActiveBuffs = getRuntimeValue(creature.name, 'activeBuffs');
        const activeBuffs = Array.isArray(rawActiveBuffs) ? rawActiveBuffs : [];
        return activeBuffs.some(b => b.name === 'Starry Form' && b.constellation === 'Dragon');
      })();
      if (hasRelentlessHunterExemption(creature, characters)) {
        addEntry(campaignName, {
          type: 'condition',
          action: 'maintained',
          characterName: creature.name,
          condition: 'Concentration on Hunter\'s Mark',
          sourceName: 'Relentless Hunter',
        }).catch((e) => { console.error("[applyDamage] Error:", e); });
      } else {
        const attacker = attackerName ? characters.find(c => c.name === attackerName || c.name.startsWith(attackerName + ' ')) : null;
        const attackerModifiers = attacker?.saveModifiers || attacker?.computedStats?.saveModifiers;
        const hasConcentrationBreaker = attackerModifiers?.some(mod =>
          mod.condition === 'concentration_breaker' && mod.effect === 'disadvantage'
        ) ?? false;
        const { success, roll, total, rawRolls } = rollConcentrationSave(saveBonus, creature.concentration.dc, dragonConstellationActive, hasConcentrationBreaker);
        if (!success) {
          const spellName = creature.concentration.spell;
          creature.concentration = null;
          npcConcentrationBroken = true;
          addEntry(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: creature.name,
            condition: 'Concentrating on ' + spellName,
            sourceName: 'Concentration broken by damage',
          }).catch((e) => { console.error("[applyDamage] Error:", e); });
          cleanupConcentrationEffects(creature.name, spellName, campaignName);
        } else {
          addEntry(campaignName, {
            type: 'roll',
            characterName: creature.name,
            rollType: 'save',
            name: 'Concentration Save',
            targetName: creature.concentration.spell,
            rolls: rawRolls || [roll],
            mode: hasConcentrationBreaker ? 'disadvantage' : 'normal',
            total: total,
            bonus: total - roll,
            saveType: 'CON',
            saveDc: creature.concentration.dc,
            saveResult: 'success',
          }).catch((e) => { console.error("[applyDamage] Error:", e); });
        }
      }
    }
  }

  if (combatSummaryChanged || npcConcentrationBroken || existingAttack) {
    storage.set('combatSummary', combatSummary, campaignName);
  }

  window.dispatchEvent(new CustomEvent('combat-summary-updated'));

  if (!suppressHpLog) {
    logDamageApplication(creature, finalDamage, oldHp, newHp, campaignName);
  }

  return { finalDamage, oldHp, newHp, damageReduced: finalDamage < rawDamage, damageReducedByFeature: damageReducedByFeature, resistanceDetails, holyAuraSaveResult };
}

// Identifies a Dominate (Person/Monster/Beast) target: Charmed condition + a caster
// concentrating on a Dominate spell whose pendingExpirations carry a 'dominated'
// marker for this target. 'dominated' expirations are written ONLY by dominateHandler,
// so this gates the repeat-save behavior to domination — not every charm.
export function findDomination(targetName, combatSummary, campaignName) {
  const rawConditions = getRuntimeValue(targetName, 'activeConditions', campaignName) || [];
  const conditions = Array.isArray(rawConditions) ? rawConditions : [];
  if (!conditions.some(c => String(c).toLowerCase() === 'charmed')) return null;
  for (const caster of combatSummary?.creatures || []) {
    const spell = String(caster.concentration?.spell || '').trim();
    if (!/^dominate (person|monster|beast)$/i.test(spell)) continue;
    const expirations = getRuntimeValue(caster.name, 'pendingExpirations', campaignName) || [];
    if (!Array.isArray(expirations)) continue;
    const dominated = expirations.some(e => e.target === targetName && Array.isArray(e.effects) && e.effects.some(ef => ef.type === 'dominated'));
    if (dominated) return { casterName: caster.name, spellName: spell };
  }
  return null;
}

function resolveDominateSaveDc(domination, characters, combatSummary) {
  const casterChar = (characters || []).find(c => c && (c.name === domination.casterName || c.name.startsWith(domination.casterName + ' ')));
  const computed = casterChar?.computedStats || casterChar;
  const saveDc = computed?.spellAbilities?.saveDc;
  if (saveDc != null) return saveDc;
  const casterCreature = combatSummary?.creatures?.find(c => c.name === domination.casterName);
  if (casterCreature?.concentration?.dc != null) return casterCreature.concentration.dc;
  console.error(`[applyDamage] No save DC available for ${domination.spellName} repeat save by ${domination.casterName}`);
  return null;
}

// Repeat WIS save when a dominated target takes damage — mirrors the established
// damage-triggered concentration-save round trip: NPCs AUTO-ROLL inline
// (concentration NPC branch), PCs get a queued save prompt via createSaveListener
// (the same subsystem dominateHandler uses on the initial cast) resolved via 'save-result'.
// On success: Charmed + dominated expiration removed, caster concentration cleared, spell ends.
// On failure: Charmed retained, spell continues.
function handleDominateRepeatSave(creature, isPlayer, domination, combatSummary, characters, campaignName, attackerName) {
  const { casterName, spellName } = domination;
  const saveDc = resolveDominateSaveDc(domination, characters, combatSummary);
  if (saveDc == null) return false;
  const damageWord = attackerName && attackerName !== creature.name ? ` from ${attackerName}` : '';

  const endDomination = (detail) => {
    const casterCreature = combatSummary.creatures.find(c => c.name === casterName);
    if (casterCreature && casterCreature.concentration) casterCreature.concentration = null;
    cleanupConcentrationEffects(casterName, spellName, campaignName);
    const stored = getRuntimeValue(creature.name, 'activeConditions', campaignName) || [];
    const conditions = Array.isArray(stored) ? stored : [];
    const filtered = conditions.filter(c => String(c).toLowerCase() !== 'charmed');
    if (filtered.length !== conditions.length) {
      setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);
    }
    addEntry(campaignName, {
      type: 'roll',
      characterName: creature.name,
      rollType: 'save',
      name: `${spellName} Repeat Save`,
      rolls: detail.rawRolls || [detail.roll],
      total: detail.total,
      bonus: detail.saveBonus ?? detail.bonus ?? 0,
      saveType: 'WIS',
      saveDc,
      saveResult: 'success',
    }).catch((e) => { console.error('[applyDamage] Error:', e); });
    addEntry(campaignName, {
      type: 'condition',
      action: 'removed',
      characterName: creature.name,
      condition: 'Charmed',
      reason: `${spellName} — spell ends on successful save against damage`,
      timestamp: Date.now(),
    }).catch((e) => { console.error('[applyDamage] Error:', e); });
    storage.set('combatSummary', combatSummary, campaignName);
    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
  };

  const resistDomination = (detail) => {
    addEntry(campaignName, {
      type: 'roll',
      characterName: creature.name,
      rollType: 'save',
      name: `${spellName} Repeat Save`,
      rolls: detail.rawRolls || [detail.roll],
      total: detail.total,
      bonus: detail.saveBonus ?? detail.bonus ?? 0,
      saveType: 'WIS',
      saveDc,
      saveResult: 'failure',
    }).catch((e) => { console.error('[applyDamage] Error:', e); });
    addEntry(campaignName, {
      type: 'ability_use',
      characterName: creature.name,
      abilityName: spellName,
      description: `${creature.name} failed the repeat WIS save (DC ${saveDc}) after taking damage${damageWord} — remains Charmed (dominated by ${casterName}).`,
      timestamp: Date.now(),
    }).catch((e) => { console.error('[applyDamage] Error:', e); });
  };

  if (isPlayer) {
    const { promise } = createSaveListener(campaignName, {
      targetName: creature.name,
      attackerName: casterName,
      saveType: 'WIS',
      saveDc,
      dcSuccess: 'none',
      condition: 'charmed',
      sourceName: casterName,
    });
    promise.then((detail) => {
      if (detail.success) {
        endDomination(detail);
      } else {
        resistDomination(detail);
      }
    });
    return false;
  }

  const saveResult = rollSaveForCreature(creature, 'wis', saveDc);
  if (saveResult.success) {
    endDomination(saveResult);
    return true;
  }
  resistDomination(saveResult);
  return false;
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

  if (delta === 0) return;

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

  addEntry(campaignName, entry);
}
