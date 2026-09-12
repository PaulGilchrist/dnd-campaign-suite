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
import { vanishSummonAtZeroHp, stripSummonedFromCombatSummary } from '../../combat/summons/summonedCreatureService.js';

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

function classifyDamageTypeDetails(damageTypes, resistances, immunities, ignoreResistance) {
  const typeDetails = [];
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
  return { typeDetails, isImmune, isResistant };
}

export function computeDamageAfterResistancesWithDetails(rawDamage, damageTypes, resistances, immunities, ignoreResistance = false, spellOrigin = false) {
  if (!damageTypes || damageTypes.length === 0) throw new Error('computeDamageAfterResistancesWithDetails: damageTypes is required');
  const { typeDetails, isImmune, isResistant } = classifyDamageTypeDetails(damageTypes, resistances, immunities, ignoreResistance);
  if (isImmune) {
    return { finalDamage: 0, typeDetails };
  }
  if (isResistant) {
    return { finalDamage: Math.floor(rawDamage / 2), typeDetails };
  }
  if (spellOrigin && !ignoreResistance && resistances?.some(r => String(r).toLowerCase() === 'spell')) {
    // CLA-324: categorical 'Spell' resistance (e.g. Abjurer Spell Resistance passive_immunity
    // damage_resistance:['Spell']) halves spell-origin damage. 'Spell' is never a concrete
    // damage type, so it is matched via the spellOrigin flag, not the damageTypes loop.
    typeDetails.push({ damageType: 'Spell', status: 'resistant' });
    return { finalDamage: Math.floor(rawDamage / 2), typeDetails };
  }
  return { finalDamage: rawDamage, typeDetails };
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

function buildLastAttackUpdate(existingAttack, attackerName, targetName, rawDamage, damageTypes) {
  const isSecondary = existingAttack?.primaryDamage != null;
  return {
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
}

// CLA-336: passive resistances are read LIVE at hit-resolution (name included so
// runtime-key gates inside getDamageResistances resolve), because computedStats is
// only recomputed on character-JSON serial changes — runtime toggles never refresh it.
function getPlayerPassiveResistances(creature, playerComputed, playerStats) {
  const statsForPassives = playerComputed?.automation || playerStats?.automation;
  if (statsForPassives?.passives?.length) {
    return getDamageResistances({ name: creature.name, automation: statsForPassives });
  }
  return [];
}

function addBuffResistances(resistances, activeBuffs) {
  for (const buff of activeBuffs) {
    if (buff.resistanceTypes?.length) {
      resistances = [...new Set([...resistances, ...buff.resistanceTypes])];
    }
  }
  return resistances;
}

// Silence — Thunder immunity for ANY creature (player or monster) inside the silence zone
function applySilenceThunderImmunity(creature, activeBuffs, immunities, campaignName) {
  for (const buff of activeBuffs) {
    if (buff.effect === 'silence' && buff.sourceCharacter) {
      if (isCreatureInSilenceZone(creature.name, buff.sourceCharacter, campaignName)) {
        if (!immunities.some(i => String(i).toLowerCase() === 'thunder')) {
          immunities = [...immunities, 'Thunder'];
        }
        return { immunities, silenceThunderImmunity: true };
      }
    }
  }
  return { immunities, silenceThunderImmunity: false };
}

function logSpellResistance(creature, rawDamage, finalDamage, campaignName) {
  addEntry(campaignName, {
    type: 'automation',
    creatureName: creature.name,
    name: 'Spell Resistance',
    description: `${creature.name} has resistance to damage of spells — ${rawDamage} spell damage halved to ${finalDamage}.`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[applyDamage] Spell Resistance log failed:', e); });
}

// CLA-336: concrete-type resistance from passive passives (e.g. Stormborn
// Cold/Lightning/Thunder while Wrath of the Sea is active) halves damage — log it.
function logPassiveResistance(creature, rawDamage, finalDamage, resistanceDetails, passiveResistances, campaignName) {
  const matchedPassiveTypes = resistanceDetails
    .filter(rd => rd.status === 'resistant' &&
      passiveResistances.some(pr => String(pr).toLowerCase() === String(rd.damageType).toLowerCase()))
    .map(rd => rd.damageType);
  if (matchedPassiveTypes.length === 0) return;
  addEntry(campaignName, {
    type: 'automation',
    creatureName: creature.name,
    name: 'Damage Resistance',
    description: `${creature.name} has resistance to ${matchedPassiveTypes.join(', ')} damage — ${rawDamage} damage halved to ${finalDamage}.`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[applyDamage] Damage Resistance log failed:', e); });
}

function logSilenceImmunity(creature, rawDamage, campaignName) {
  addEntry(campaignName, {
    type: 'automation',
    creatureName: creature.name,
    name: 'Silence',
    description: `${creature.name} is immune to Thunder damage inside the Silence zone — ${rawDamage} damage negated.`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[applyDamage] Silence immunity log failed:', e); });
}

// Apply damage reduction from features (e.g., Heavy Armor Master)
function applyFeatureDamageReduction(creature, playerComputed, playerStats, damageTypes, finalDamage, campaignName) {
  let damageReducedByFeature = 0;
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
  return { finalDamage, damageReducedByFeature };
}

// Self-damage: Arcane Ward absorbs damage to the wizard themselves
function absorbIntoArcaneWard(creature, wardDamage, campaignName) {
  const wardActive = getRuntimeValue(creature.name, 'arcaneWardActive', campaignName);
  if (!wardActive) return wardDamage;
  const wardHp = Number(getRuntimeValue(creature.name, 'arcaneWardHp', campaignName) ?? 0);
  if (wardHp <= 0) return wardDamage;
  const wardAbsorbed = Math.min(wardDamage, wardHp);
  const newWardHp = wardHp - wardAbsorbed;
  setRuntimeValue(creature.name, 'arcaneWardHp', newWardHp, campaignName);
  return wardDamage - wardAbsorbed;
}

// Temp HP absorbs damage first for all creatures
function absorbWithTempHp(creature, damage, campaignName) {
  let damageAfterTempHp = damage;
  const currentTempHp = Number(getRuntimeValue(creature.name, 'tempHp', campaignName) || 0);
  if (currentTempHp > 0) {
    const absorbed = Math.min(damageAfterTempHp, currentTempHp);
    damageAfterTempHp -= absorbed;
    setRuntimeValue(creature.name, 'tempHp', currentTempHp - absorbed, campaignName);
  }
  return damageAfterTempHp;
}

// Polymorph: when the beast form's temp-HP buffer is depleted, the transformation ends
async function revertPolymorphIfBufferDepleted(creature, campaignName) {
  const polymorphBuffer = Number(getRuntimeValue(creature.name, 'polymorphTempHp', campaignName) || 0);
  const tempHpAfterDrain = Number(getRuntimeValue(creature.name, 'tempHp', campaignName) || 0);
  if (polymorphBuffer > 0 && tempHpAfterDrain <= 0) {
    await revertPolymorph(creature.name, campaignName);
  }
}

function applyPlayerHpDamage(creature, damageAfterTempHp, options, campaignName, rawDamage, finalDamage) {
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

  const oldHp = storedCurrentHp;
  let newHp = Math.max(0, oldHp - damageAfterTempHp);
  const actualDamageTaken = oldHp - newHp;
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
  return { oldHp, newHp, actualDamageTaken };
}

function applyCreatureHpDamage(creature, damageAfterTempHp, options, campaignName) {
  const oldHp = creature.currentHp;
  let newHp = Math.max(0, oldHp - damageAfterTempHp);
  const actualDamageTaken = oldHp - newHp;
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
  return { oldHp, newHp, actualDamageTaken };
}

// Update lastAttack with actual HP damage dealt (after resistances, feature reduction, ward absorption)
function recordActualDamageInLastAttack(isSecondary, wardDamage, campaignName) {
  const existing = getRuntimeValue('campaign', 'lastAttack') || null;
  if (!existing) return;
  existing.actualDamage = isSecondary ? (existing.actualDamage || 0) + wardDamage : wardDamage;
  setRuntimeValue('campaign', 'lastAttack', existing, campaignName);
}

// Projected Ward: record recent damage on the damaged player so an Abjurer's
// reaction (arcaneWardHandler) can roll back-absorb it. Mirrors the
// bastionOfLawLastAttackDamage record mechanism (campaign lastAttack).
function recordProjectedWardDamage(creature, actualDamageTaken, isSecondary, attackerName, damageTypes, campaignName) {
  const damagedIsWarden = getRuntimeValue(creature.name, 'arcaneWardActive', campaignName);
  if (damagedIsWarden || actualDamageTaken <= 0) return;
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

function removeConditionFromList(creature, conditions, conditionKey, displayName, reason, campaignName) {
  if (!conditions.some(c => String(c).toLowerCase() === conditionKey)) return;
  const filtered = conditions.filter(c => String(c).toLowerCase() !== conditionKey);
  setRuntimeValue(creature.name, 'activeConditions', filtered, campaignName);
  addEntry(campaignName, {
    type: 'condition',
    action: 'removed',
    characterName: creature.name,
    condition: displayName,
    reason,
    timestamp: Date.now(),
  }).catch((e) => { console.error("[applyDamage] Error:", e); });
}

// Frightened always ends on damage; Charmed ends on damage unless the target is
// dominated (dominated targets get a repeat save instead — see handleDominateRepeatSave).
// Both removals filter the SAME single-read condition list, preserving the original
// last-write-wins semantics when a creature holds both conditions at once.
function removeCombatConditionsOnDamage(creature, domination, isPlayer, campaignName) {
  const conditions = getRuntimeValue(creature.name, 'activeConditions') || [];
  removeConditionFromList(creature, conditions, 'frightened', 'Frightened', 'took damage', campaignName);
  if (!domination) {
    const reason = isPlayer ? 'took damage (Friends)' : 'took damage (Charm)';
    removeConditionFromList(creature, conditions, 'charmed', 'Charmed', reason, campaignName);
  }
}

// Supreme Sneak: while Stealth Attack is active, an attacker that hits while Invisible
// KEEPS the Invisible condition (no removal happens here; the stealthAttackCost is
// cleared at the start of the attacker's next turn).
function preserveInvisibleOnStealthAttack(attackerName, campaignName) {
  const stealthAttackCost = getRuntimeValue(attackerName, 'stealthAttackCost', campaignName);
  if (!stealthAttackCost || stealthAttackCost <= 0) return;
  // Preserve Invisible condition — don't remove it
}

// Compelled Duel: the effect ends if the target takes damage from anyone other than the caster
function endDuelIfDamagedByOther(creature, attackerName, campaignName) {
  if (!attackerName || attackerName === creature.name) return;
  const duelEffects = (getRuntimeValue('campaign', 'targetEffects') || []).filter(
    te => te.effect === 'compelled_duel' && te.target === creature.name && te.source !== attackerName
  );
  if (duelEffects.length > 0) {
    endCompelledDuel(duelEffects[0].source, creature.name, campaignName,
      `${attackerName} damaged ${creature.name}, breaking the duel.`);
  }
}

// Clean up Avenging Angel Frightful Aura tracking list when a creature takes damage
function cleanupAvengingAngelAuras(creature, characters, campaignName) {
  for (const char of characters) {
    if (isAvengingAngelActive(char.name, campaignName)) {
      cleanupAuraTargetOnDamage(char.name, creature.name, campaignName).catch(e => {
        console.error('[applyDamage] Avenging Angel aura cleanup failed:', e);
      });
    }
  }
}

// Dispatch order is rule-significant: features intercept drop-to-0 in this exact order,
// each short-circuiting the rest. Relentless Endurance additionally marks the damage
// sequence so follow-up hits in the same sequence don't re-kill.
const ZERO_HP_INTERCEPTORS = [
  { check: checkUndyingSentinel, name: 'Undying Sentinel' },
  { check: checkBoonOfRecoveryLastStand, name: 'Boon of Recovery' },
  { check: checkRelentlessEndurance, name: 'Relentless Endurance' },
  { check: checkRelentlessRage, name: 'Relentless Rage' },
  { check: checkDeathWard, name: 'Death Ward' },
];

function interceptZeroHitPoints(creature, playerComputed, options, finalDamage, oldHp, campaignName) {
  for (const interceptor of ZERO_HP_INTERCEPTORS) {
    const result = interceptor.check(creature, playerComputed, campaignName);
    if (result.intercepted) {
      if (interceptor.name === 'Relentless Endurance' && options?.damageSequenceId) {
        _reTriggeredSequenceIds.add(options.damageSequenceId);
      }
      return { ...result, damageDealt: finalDamage, oldHp, interceptedFeature: interceptor.name };
    }
  }
  return null;
}

// Player concentration: queue a CON save prompt (or log the Relentless Hunter exemption).
// Returns true when the combat summary was marked changed (prompt queued).
function promptPlayerConcentrationSave(creature, characters, attackerName, campaignName) {
  if (hasRelentlessHunterExemption(creature, characters)) {
    addEntry(campaignName, {
      type: 'condition',
      action: 'maintained',
      characterName: creature.name,
      condition: 'Concentration on Hunter\'s Mark',
      sourceName: 'Relentless Hunter',
    }).catch((e) => { console.error("[applyDamage] Error:", e); });
    return false;
  }
  const promptId = utils.guid();
  sendConcentrationPrompt(campaignName, {
    promptId,
    targetName: creature.name,
    spellName: creature.concentration.spell,
    dc: creature.concentration.dc,
    attackerName,
  });
  return true;
}

// NPC concentration: auto-roll the CON save inline. Returns true when broken.
function handleNpcConcentrationBreak(creature, characters, attackerName, combatSummary, campaignName) {
  const saveBonus = creature?.saveBonuses?.['con'] ?? 0;
  const rawActiveBuffs = getRuntimeValue(creature.name, 'activeBuffs');
  const activeBuffs = Array.isArray(rawActiveBuffs) ? rawActiveBuffs : [];
  const dragonConstellationActive = activeBuffs.some(b => b.name === 'Starry Form' && b.constellation === 'Dragon');

  if (hasRelentlessHunterExemption(creature, characters)) {
    addEntry(campaignName, {
      type: 'condition',
      action: 'maintained',
      characterName: creature.name,
      condition: 'Concentration on Hunter\'s Mark',
      sourceName: 'Relentless Hunter',
    }).catch((e) => { console.error("[applyDamage] Error:", e); });
    return false;
  }

  const attacker = attackerName ? characters.find(c => c.name === attackerName || c.name.startsWith(attackerName + ' ')) : null;
  const attackerModifiers = attacker?.saveModifiers || attacker?.computedStats?.saveModifiers;
  const hasConcentrationBreaker = attackerModifiers?.some(mod =>
    mod.condition === 'concentration_breaker' && mod.effect === 'disadvantage'
  ) ?? false;
  const { success, roll, total, rawRolls } = rollConcentrationSave(saveBonus, creature.concentration.dc, dragonConstellationActive, hasConcentrationBreaker);
  if (!success) {
    const spellName = creature.concentration.spell;
    creature.concentration = null;
    stripSummonedFromCombatSummary(combatSummary, creature.name);
    addEntry(campaignName, {
      type: 'condition',
      action: 'removed',
      characterName: creature.name,
      condition: 'Concentrating on ' + spellName,
      sourceName: 'Concentration broken by damage',
    }).catch((e) => { console.error("[applyDamage] Error:", e); });
    cleanupConcentrationEffects(creature.name, spellName, campaignName);
    return true;
  }
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
  return false;
}

// Resolve the defender's full resistance/immunity profile: computed stats (players),
// passive passives (CLA-336, read LIVE), buff-granted resistances, Silence thunder
// immunity, and aura-granted resistances.
function resolveBaseDefenses(creature, targetName, isPlayer, characters) {
  const playerStats = isPlayer ? characters.find(c => c.name === targetName || c.name.startsWith(targetName + ' ')) : null;
  const playerComputed = playerStats?.computedStats || playerStats;
  const resistances = isPlayer ? (playerComputed?.resistances || []) : (creature.resistances || []);
  const immunities = isPlayer ? (playerComputed?.immunities || []) : (creature.immunities || []);
  return { playerStats, playerComputed, resistances, immunities };
}

async function resolveCreatureDefenses(creature, targetName, isPlayer, characters, campaignName) {
  const { playerStats, playerComputed, resistances: baseResistances, immunities: baseImmunities } = resolveBaseDefenses(creature, targetName, isPlayer, characters);
  let resistances = baseResistances;
  let immunities = baseImmunities;
  let passiveResistances = [];
  if (isPlayer && playerStats) {
    passiveResistances = getPlayerPassiveResistances(creature, playerComputed, playerStats);
    if (passiveResistances.length > 0) {
      resistances = [...new Set([...resistances, ...passiveResistances])];
    }
  }

  const rawBuffs = getRuntimeValue(creature.name, 'activeBuffs', campaignName);
  const activeBuffs = Array.isArray(rawBuffs) ? rawBuffs : [];

  if (isPlayer) {
    resistances = addBuffResistances(resistances, activeBuffs);
  }
  const silenceResult = applySilenceThunderImmunity(creature, activeBuffs, immunities, campaignName);
  immunities = silenceResult.immunities;

  // Aura-granted resistances (e.g., Aura of Warding) — computeAuraComboEffects self-filters
  // to targets that are the source paladin or an ally within Aura of Protection range
  const auraComboEffects = await computeAuraComboEffects({ targetName, characters });
  if (auraComboEffects.resistances.length > 0) {
    resistances = [...new Set([...resistances, ...auraComboEffects.resistances])];
  }

  return { resistances, immunities, passiveResistances, silenceThunderImmunity: silenceResult.silenceThunderImmunity };
}

// Post-computation resistance/immunity logs, in their original evaluation order.
function logResistanceOutcomes({ creature, rawDamage, finalDamage, damageTypes, resistanceDetails, passiveResistances, silenceThunderImmunity, spellOrigin, campaignName }) {
  if (spellOrigin && rawDamage > 0 && resistanceDetails.some(rd => rd.damageType === 'Spell' && rd.status === 'resistant')) {
    logSpellResistance(creature, rawDamage, finalDamage, campaignName);
  }

  if (rawDamage > 0 && finalDamage < rawDamage) {
    logPassiveResistance(creature, rawDamage, finalDamage, resistanceDetails, passiveResistances, campaignName);
  }

  if (silenceThunderImmunity && rawDamage > 0 && damageTypes.some(dt => String(dt).toLowerCase() === 'thunder')) {
    logSilenceImmunity(creature, rawDamage, campaignName);
  }
}

// Reaction/tracking events fired once damage actually lands (wardDamage > 0):
// warding bond, dominate repeat saves, condition removal, psychic veil, holy aura,
// compelled duel. Dispatch order is rule-significant — do not reorder.
async function handleWardedDamageEvents(creature, combatSummary, characters, isPlayer, attackerName, wardDamage, campaignName) {
  applyWardingBond(creature, combatSummary, campaignName, wardDamage);
  let combatSummaryChanged = false;
  // Dominate (Person/Monster/Beast): a dominated target repeats its WIS save
  // on damage instead of the generic unconditional charm-strip.
  const domination = findDomination(creature.name, combatSummary, campaignName);
  if (domination) {
    const summaryChanged = handleDominateRepeatSave(creature, isPlayer, domination, combatSummary, characters, campaignName, attackerName);
    if (summaryChanged) combatSummaryChanged = true;
  }
  removeCombatConditionsOnDamage(creature, domination, isPlayer, campaignName);
  if (attackerName && attackerName !== creature.name) {
    checkPsychicVeil(attackerName, campaignName);
    preserveInvisibleOnStealthAttack(attackerName, campaignName);
  }

  const holyAuraSaveResult = await checkHolyAuraDamage(creature, attackerName, combatSummary, campaignName, wardDamage);

  endDuelIfDamagedByOther(creature, attackerName, campaignName);

  return { combatSummaryChanged, holyAuraSaveResult };
}

// Concentration save is required when the target is concentrating and this hit
// (or the sequence's accumulated total) counts as damage.
function concentrationDamagePending(options, creature, damageTaken) {
  return !options?.skipConcentration && creature.concentration && (damageTaken > 0 || options?.concentrationTotalDamage > 0);
}

// Player drop-to-0 interception + death-save prompt + concentration prompt.
// Returns { interception, combatSummaryChanged } — the interception (when non-null)
// must be returned verbatim from applyDamageToTarget.
function handlePlayerZeroHpAndConcentration({ creature, characters, playerComputed, options, wasAlive, isNowUnconscious, oldHp, finalDamage, actualDamageTaken, attackerName, campaignName }) {
  if (wasAlive && isNowUnconscious) {
    const interception = interceptZeroHitPoints(creature, playerComputed, options, finalDamage, oldHp, campaignName);
    if (interception) {
      return { interception, combatSummaryChanged: false };
    }

    const promptId = utils.guid();
    sendDeathSavePrompt(campaignName, {
      promptId,
      targetName: creature.name,
    });
  }

  let combatSummaryChanged = false;
  if (concentrationDamagePending(options, creature, actualDamageTaken)) {
    if (promptPlayerConcentrationSave(creature, characters, attackerName, campaignName)) {
      combatSummaryChanged = true;
    }
  }
  return { interception: null, combatSummaryChanged };
}

// Feature damage reduction → Arcane Ward → Temp HP absorption, in order.
function absorbThroughFeaturesAndWards(creature, isPlayer, playerComputed, playerStats, damageTypes, finalDamage, campaignName) {
  let damageReducedByFeature = 0;
  if (isPlayer) {
    ({ finalDamage, damageReducedByFeature } = applyFeatureDamageReduction(creature, playerComputed, playerStats, damageTypes, finalDamage, campaignName));
  }
  // Arcane Ward: absorb damage before it hits HP
  let wardDamage = finalDamage;
  if (isPlayer) {
    wardDamage = absorbIntoArcaneWard(creature, wardDamage, campaignName);
  }
  // Temp HP absorbs damage first for all creatures
  const damageAfterTempHp = absorbWithTempHp(creature, wardDamage, campaignName);
  return { finalDamage, damageReducedByFeature, wardDamage, damageAfterTempHp };
}

// Post-HP events for damage that landed on the ward: projected-ward record,
// reaction/tracking events, avenging-angel aura cleanup. Dispatch order is rule-significant.
async function emitWardDamageEvents({ creature, combatSummary, characters, isPlayer, attackerName, isSecondary, actualDamageTaken, damageTypes, wardDamage, campaignName }) {
  let combatSummaryChanged = false;
  let holyAuraSaveResult = null;
  // Projected Ward (Abjurer reaction roll-back record)
  if (isPlayer) {
    recordProjectedWardDamage(creature, actualDamageTaken, isSecondary, attackerName, damageTypes, campaignName);
  }
  if (wardDamage > 0) {
    const wardedEvents = await handleWardedDamageEvents(creature, combatSummary, characters, isPlayer, attackerName, wardDamage, campaignName);
    if (wardedEvents.combatSummaryChanged) combatSummaryChanged = true;
    holyAuraSaveResult = wardedEvents.holyAuraSaveResult;
  }
  if (wardDamage > 0 && characters?.length) {
    cleanupAvengingAngelAuras(creature, characters, campaignName);
  }
  return { combatSummaryChanged, holyAuraSaveResult };
}

// SP-114: summoned creatures disappear at 0 Hit Points (canonical "disappears
// when it drops to 0 Hit Points"). Mutates combatSummary in place — the
// combatSummaryChanged persist below writes the filtered roster.
function handleSummonVanishAndConcentrationDc({ creature, combatSummary, isPlayer, wasAlive, isNowUnconscious, options, actualDamageTaken, campaignName }) {
  if (!isPlayer && wasAlive && isNowUnconscious && creature.summonedBy && creature.summonSource === 'spell') {
    vanishSummonAtZeroHp(creature, combatSummary, campaignName);
  }
  if (concentrationDamagePending(options, creature, actualDamageTaken)) {
    const dcDamage = options?.concentrationTotalDamage ?? actualDamageTaken;
    creature.concentration.dc = Math.max(10, Math.floor(dcDamage / 2));
  }
}

// Zero-HP/concentration outcomes, player vs NPC. A player interception is
// returned verbatim by applyDamageToTarget; NPC concentration breaks fold
// into combatSummaryChanged (both only ever feed the summary persist).
function resolveTargetDamageOutcome({ creature, combatSummary, characters, isPlayer, playerComputed, options, wasAlive, isNowUnconscious, oldHp, finalDamage, actualDamageTaken, attackerName, campaignName }) {
  if (isPlayer) {
    return handlePlayerZeroHpAndConcentration({ creature, characters, playerComputed, options, wasAlive, isNowUnconscious, oldHp, finalDamage, actualDamageTaken, attackerName, campaignName });
  }
  if (concentrationDamagePending(options, creature, finalDamage)) {
    handleNpcConcentrationBreak(creature, characters, attackerName, combatSummary, campaignName);
  }
  return { interception: null, combatSummaryChanged: true };
}

// Persist the (possibly mutated) combat summary, broadcast, and log the HP change.
function persistAndLogDamageOutcome({ combatSummary, combatSummaryChanged, existingAttack, creature, finalDamage, oldHp, newHp, suppressHpLog, campaignName }) {
  if (combatSummaryChanged || existingAttack) {
    storage.set('combatSummary', combatSummary, campaignName);
  }
  window.dispatchEvent(new CustomEvent('combat-summary-updated'));
  if (!suppressHpLog) {
    logDamageApplication(creature, finalDamage, oldHp, newHp, campaignName);
  }
}

// CLA-324: spell-origin is knowable from the damage payload (options.isSpellDamage) or
// the campaign lastAttack (spell-save stamps, monster-card save-attack stamps).
function isSpellOriginDamage(options, existingAttack) {
  return options?.isSpellDamage === true || existingAttack?.rollType === 'spell-save' || existingAttack?.isSpellDamage === true;
}

// Stamp campaign lastAttack with this hit and return the pre-hit attack (if any).
function stampLastAttack(attackerName, targetName, rawDamage, damageTypes, campaignName) {
  const existingAttack = getRuntimeValue('campaign', 'lastAttack') || null;
  setRuntimeValue('campaign', 'lastAttack', buildLastAttackUpdate(existingAttack, attackerName, targetName, rawDamage, damageTypes), campaignName);
  return existingAttack;
}

// HP application split: players track damage-taking options distinctly from creatures.
function applyTargetHpDamage(creature, isPlayer, damageAfterTempHp, options, campaignName, rawDamage, finalDamage) {
  if (isPlayer) {
    return applyPlayerHpDamage(creature, damageAfterTempHp, options, campaignName, rawDamage, finalDamage);
  }
  return applyCreatureHpDamage(creature, damageAfterTempHp, options, campaignName);
}

function findPlayerStatsForTarget(characters, targetName) {
  return characters.find(c => c.name === targetName || c.name.startsWith(targetName + ' '));
}

function isUsableRawDamage(rawDamage) {
  return !isNaN(rawDamage) && rawDamage != null;
}

export async function applyDamageToTarget(combatSummary, targetName, rawDamage, damageTypes, campaignName, characters, { ignoreResistance = false, attackerName = null, suppressHpLog = false, ...options } = {}) {
  if (!combatSummary) return null;
  if (!isUsableRawDamage(rawDamage)) return null;
  const creature = combatSummary.creatures.find(c => c.name === targetName);
  if (!creature) return null;

  const existingAttack = stampLastAttack(attackerName, targetName, rawDamage, damageTypes, campaignName);
  const isSecondary = existingAttack?.primaryDamage != null;

  const isPlayer = creature.type === 'player';
  const playerStats = isPlayer ? findPlayerStatsForTarget(characters, targetName) : null;
  const playerComputed = playerStats?.computedStats || playerStats;

  const defenses = await resolveCreatureDefenses(creature, targetName, isPlayer, characters, campaignName);
  if (!Array.isArray(damageTypes)) { throw new Error('damageTypes must be an array'); }
  const spellOrigin = isSpellOriginDamage(options, existingAttack);
  const resResult = computeDamageAfterResistancesWithDetails(rawDamage, damageTypes, defenses.resistances, defenses.immunities, ignoreResistance, spellOrigin);

  logResistanceOutcomes({ creature, rawDamage, finalDamage: resResult.finalDamage, damageTypes, resistanceDetails: resResult.typeDetails, passiveResistances: defenses.passiveResistances, silenceThunderImmunity: defenses.silenceThunderImmunity, spellOrigin, campaignName });

  const absorbed = absorbThroughFeaturesAndWards(creature, isPlayer, playerComputed, playerStats, damageTypes, resResult.finalDamage, campaignName);
  const { finalDamage, damageReducedByFeature, wardDamage, damageAfterTempHp } = absorbed;

  await revertPolymorphIfBufferDepleted(creature, campaignName);

  const { oldHp, newHp, actualDamageTaken } = applyTargetHpDamage(creature, isPlayer, damageAfterTempHp, options, campaignName, rawDamage, finalDamage);

  // SP-107: Sleep ends on a target that takes damage (staged Incapacitated or Unconscious).
  if (actualDamageTaken > 0) {
    wakeSleepOnDamage(campaignName, creature.name, actualDamageTaken);
  }

  recordActualDamageInLastAttack(isSecondary, wardDamage, campaignName);

  const wardEvents = await emitWardDamageEvents({ creature, combatSummary, characters, isPlayer, attackerName, isSecondary, actualDamageTaken, damageTypes, wardDamage, campaignName });
  let combatSummaryChanged = wardEvents.combatSummaryChanged;

  const wasAlive = oldHp > 0;
  const isNowUnconscious = newHp <= 0;

  handleSummonVanishAndConcentrationDc({ creature, combatSummary, isPlayer, wasAlive, isNowUnconscious, options, actualDamageTaken, campaignName });

  checkDarkOnesBlessing({ characters, creature, finalDamage, isPlayer, wasAlive, isNowUnconscious, campaignName, attackerName });

  const outcome = resolveTargetDamageOutcome({ creature, combatSummary, characters, isPlayer, playerComputed, options, wasAlive, isNowUnconscious, oldHp, finalDamage, actualDamageTaken, attackerName, campaignName });
  if (outcome.interception) {
    return outcome.interception;
  }
  if (outcome.combatSummaryChanged) {
    combatSummaryChanged = true;
  }

  persistAndLogDamageOutcome({ combatSummary, combatSummaryChanged, existingAttack, creature, finalDamage, oldHp, newHp, suppressHpLog, campaignName });

  return { finalDamage, oldHp, newHp, damageReduced: finalDamage < rawDamage, damageReducedByFeature: damageReducedByFeature, resistanceDetails: resResult.typeDetails, holyAuraSaveResult: wardEvents.holyAuraSaveResult };
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

function resolveHpThreshold(oldHp, newHp, maxHp) {
  const isDead = newHp <= 0;
  const wasDead = oldHp <= 0;
  const wasBloodied = oldHp > 0 && oldHp <= Math.floor(maxHp / 2);
  const isBloodied = newHp > 0 && newHp <= Math.floor(maxHp / 2);
  if (!wasDead && isDead) return 'dead';
  if (!wasBloodied && isBloodied) return 'bloodied';
  if (wasBloodied && !isBloodied && newHp > 0) return 'recovering';
  return null;
}

function logDamageApplication(creature, damage, oldHp, newHp, campaignName) {
  const maxHp = creature.type === 'player'
    ? (getRuntimeValue(creature.name, 'hitPoints') ?? newHp)
    : creature.maxHp;
  const delta = newHp - oldHp;
  const isDead = newHp <= 0;

  if (delta === 0) return;

  const threshold = resolveHpThreshold(oldHp, newHp, maxHp);

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
