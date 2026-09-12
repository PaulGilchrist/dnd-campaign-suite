import { getRuntimeValue, setRuntimeBatch, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'

import * as storageService from '../../../services/ui/storage.js'
import { getCombatSummary, setCombatSummaryCache } from '../../../services/encounters/combatData.js'
import { clearAllConcentrations } from '../../../services/combat/concentration/concentrationService.js'
import { addEntry } from '../../../services/ui/logService.js'
import { grantCelestialResilience } from '../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js'
import { setTempHp } from '../../../services/automation/handlers/buffs/tempHpService.js'
import { endInvisibility, endGreaterInvisibility } from '../features/invisibilityService.js'
import { clearHuntersMarkConcentration } from './restRules.js'
import { getShortRestResources, computeShortRestHpNewCurrent, spellSlotLevels } from './restRules-constants.js'
import { getCelestialResilienceSelfTempHp } from './restRules-celestialResilience.js'
import { computeSuperiorityDiceMax } from '../trackedResources.js'

// Wizard school savants: reset per-spell free cast tracking on short rest,
// in original evaluation order.
const SAVANT_RESETS = [
  { effect: 'divination_savant', selectionKey: '_Divination_Savant_selection', usedPrefix: '_Divination_Savant' },
  { effect: 'evocation_savant', selectionKey: '_Evocation_Savant_selection', usedPrefix: '_Evocation_Savant' },
  { effect: 'illusion_savant', selectionKey: '_Illusion_Savant_selection', usedPrefix: '_Illusion_Savant' },
]

// Campaign targetEffect keys cleared after the batch write, in original
// evaluation order. Each entry is one read/filter/write cycle (skipSync=true).
const SHORT_REST_TARGET_EFFECT_CLEAR_KEYS = [
  ['clairvoyant_combatant'],
  ['pass_without_trace_bonus'],
  ['blur'],
  ['regenerate'],
  ['beacon_of_hope'],
  ['resistance_damage_reduction'],
  ['barkskin'],
  ['enhance_ability'],
  ['circle_of_power'],
]

// Character keys nulled in the batch update, in original assignment order.
const SHORT_REST_NULL_FLAG_KEYS = [
  'awakenedMindTarget',
  'clairvoyantCombatantTarget',
  'clairvoyantCombatantUses',
  'portentUsedThisTurn',
  '_Charge_Attack_usedRound',
  'psionicStrikeUsedThisTurn',
  "_Hunter's_Prey_choice",
  'wrathOfTheSeaActive',
  'wrathOfTheSeaDc',
  'wrathOfTheSeaWisMod',
  'wrathOfTheSeaSource',
  'zealousPresenceActive',
  'livingLegendActive',
  'unerringStrikeUsed',
  'holyNimbusActive',
  'elderChampionActive',
  'avengingAngelActive',
  'peerlessAthleteActive',
  'bastionOfLawActive',
  'bastionOfLawWardDice',
  'bastionOfLawWardSource',
  'bastionOfLawWardUsed',
  'bastionOfLawLastAttackDamage',
  'tranceOfOrderActive',
  'largeFormActive',
  'wildMagicSurgeEffects',
  'elementalAttunementActive',
  'elementalAttunementElement',
  'elementalEpitomeActive',
  'epitomeResistanceType',
  'epitomeEmpoweredUsedRound',
  'destructiveStrideActive',
  'destructiveStrideDamageType',
]

function findClassLevel(playerStats) {
  return (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level)
}

function addFighterResourceUpdates(name, playerStats, updates, campaignName) {
  // FS-010: restore superiority dice to the character's ACTUAL max
  // (Battle Master level table, or 1 for a pure Superior Technique
  // fighter) — restoring null here armed the ??4 phantom pool.
  const maxSD = computeSuperiorityDiceMax(playerStats)
  if (maxSD > 0) {
    updates.superiorityDice = maxSD
  }
  const maxSW = findClassLevel(playerStats)?.second_wind || 0
  const currentSW = Number(getRuntimeValue(name, 'secondWindUses', campaignName) ?? 0)
  if (currentSW < maxSW) {
    updates.secondWindUses = Math.min(maxSW, currentSW + 1)
  }
}

function addBarbarianRageUpdate(name, playerStats, updates, campaignName) {
  const maxRage = findClassLevel(playerStats)?.rages || 0
  const trackedRage = playerStats._trackedResources?.ragePoints
  const storedRage = getRuntimeValue(name, 'ragePoints', campaignName)
  const currentRage = storedRage != null ? Number(storedRage) : (trackedRage?.current ?? maxRage)
  if (currentRage < maxRage) {
    updates.ragePoints = Math.min(maxRage, currentRage + 1)
  }
}

// Fighter: superiority dice to actual max (FS-010) + Second Wind recharge;
// Barbarian 2024: Rage recharges 1 use on short rest.
function addClassResourceUpdates(name, playerStats, updates, campaignName) {
  if (playerStats.class?.name === 'Fighter') {
    addFighterResourceUpdates(name, playerStats, updates, campaignName)
  }

  if (playerStats.class?.name === 'Barbarian' && playerStats.rules === '2024') {
    addBarbarianRageUpdate(name, playerStats, updates, campaignName)
  }
}

function resetReplenishingMeals(name, playerStats, campaignName) {
  // Chef: Replenishing Meals reset on Short Rest
  const hasReplenishingMeal = (playerStats.automation?.passives ?? []).some(
    p => p.type === 'passive_rule' && p.effect === 'bonus_healing' && p.name === 'Replenishing Meal'
  )
  if (hasReplenishingMeal) {
    const mealMax = 4 + (playerStats.proficiency || 0)
    setRuntimeValue(name, 'replenishingMeals', mealMax, campaignName, true)
  }
}

function addFontOfInspirationUpdates(name, playerStats, updates, campaignName) {
  const hasFontOfInspiration = (playerStats.automation?.passives ?? []).some(p => p.type === 'font_of_inspiration')
  if (!hasFontOfInspiration) return
  const charisma = playerStats.abilities?.find(a => a.name === 'Charisma')
  const maxBI = charisma?.bonus || 0
  const storedBI = getRuntimeValue(name, 'bardicInspirationUses', campaignName)
  const currentBI = storedBI != null ? Number(storedBI) : maxBI
  if (storedBI == null || currentBI < maxBI) {
    updates.bardicInspirationUses = maxBI
  }
}

// Arcane Recovery: Wizard spell slot recovery on short rest
function addArcaneRecoveryUpdates(name, playerStats, updates) {
  const hasArcaneRecovery = (playerStats.automation?.passives ?? []).some(
    p => p.type === 'resource_restoration' && p.resourceKey === 'arcaneRecoveryLevels'
  )
  if (!hasArcaneRecovery || playerStats.class?.name !== 'Wizard') return
  if (playerStats.level == null) {
    console.error('[restRules] applyShortRest: playerStats.level is missing for wizard arcane recovery')
    throw new Error('playerStats.level is required for arcane recovery')
  }
  const wizardLevel = playerStats.level
  const maxSlotsToRecover = Math.ceil(wizardLevel / 2)
  let slotsRecovered = 0
  // Only recover slots level 5 and lower (no level 6+)
  const slotLevels = [1, 2, 3, 4, 5]
  for (const level of slotLevels) {
    if (slotsRecovered >= maxSlotsToRecover) break
    const slotKey = `spell_slots_level_${level}`
    const max = playerStats.spellAbilities?.[slotKey] || 0
    const current = Number(getRuntimeValue(name, slotKey) ?? max)
    const available = max - current
    if (available > 0) {
      const remaining = maxSlotsToRecover - slotsRecovered
      const toRecover = Math.min(available, Math.floor(remaining / level))
      updates[slotKey] = current + toRecover
      slotsRecovered += level * toRecover
    }
  }
}

// Signature Spells: Reset per-spell used flags on short or long rest
function addSignatureSpellResets(name, playerStats, updates, campaignName) {
  const hasSignatureSpells = (playerStats.automation?.specialActions ?? []).some(
    a => a.type === 'signature_spells'
  )
  if (!hasSignatureSpells) return
  const selection = getRuntimeValue(name, 'SignatureSpells_selection', campaignName)
  if (selection && Array.isArray(selection)) {
    for (const spell of selection) {
      const usedKey = `SignatureSpells_${spell.replace(/\s+/g, '_')}_used`
      updates[usedKey] = null
    }
  }
}

// Divination/Evocation/Illusion Savant: Reset free cast tracking on short or long rest
function addSavantSelectionResets(name, playerStats, updates, campaignName) {
  const passives = playerStats.automation?.passives ?? []
  for (const savant of SAVANT_RESETS) {
    if (!passives.some(p => p.type === 'passive_rule' && p.effect === savant.effect)) continue
    const selection = getRuntimeValue(name, savant.selectionKey, campaignName)
    if (selection && Array.isArray(selection)) {
      for (const spell of selection) {
        updates[`${savant.usedPrefix}_${spell.replace(/\s+/g, '_')}_used`] = null
      }
    }
  }
}

// Pact Magic: Warlock spell slot recovery on short rest
function addPactMagicUpdates(name, playerStats, updates) {
  if (playerStats.class?.name !== 'Warlock') return
  for (const level of spellSlotLevels()) {
    const slotKey = `spell_slots_level_${level}`
    const max = playerStats.spellAbilities?.[slotKey] || 0
    if (max > 0) {
      const current = Number(getRuntimeValue(name, slotKey) ?? max)
      if (current < max) {
        updates[slotKey] = max
      }
    }
  }
}

async function clearVowOfEnmity(name, updates, campaignName) {
  const vowTarget = getRuntimeValue(name, 'vowOfEnmityTarget', campaignName);
  updates.vowOfEnmityTarget = null;
  updates.vowOfEnmityCostPaid = null;
  if (!vowTarget) return
  const targetBuffs = getRuntimeValue(vowTarget, 'activeBuffs', campaignName) || [];
  const filteredTargetBuffs = targetBuffs.filter(b => b.effect !== 'vow_of_enmity');
  await setRuntimeValue(vowTarget, 'activeBuffs', filteredTargetBuffs, campaignName);
}

// Celestial Resilience: Grant temp HP on short rest for Celestial Patron.
// Returns the batch tempHp value plus the modal ally-target payload when
// allies were gifted temp HP, else null.
async function grantCelestialResilienceOnShortRest(name, playerStats, campaignName) {
  const selfTempHp = getCelestialResilienceSelfTempHp(playerStats, 'applyShortRest')
  if (selfTempHp == null) return null

  const tempHp = setTempHp(name, selfTempHp, campaignName)
  addEntry(campaignName, {
    type: 'ability_use',
    characterName: name,
    abilityName: 'Celestial Resilience',
    description: `${name} gains ${selfTempHp} temporary hit points from Celestial Resilience (short rest).`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[celestialResilience] Error:', e); });

  // Gather allies for modal
  const combatSummary = getCombatSummary(campaignName);
  if (!combatSummary) return { tempHp, allies: null }
  const celestialResult = await grantCelestialResilience(playerStats, campaignName, 'short_rest');
  if (celestialResult?.allyTempHp && celestialResult?.allies && celestialResult.allies.length > 0) {
    return {
      tempHp,
      allies: {
        creatureTargets: celestialResult.allies,
        allyTempHp: celestialResult.allyTempHp,
        selfTempHp: celestialResult.selfTempHp,
        maxTargets: celestialResult.maxAllies,
      },
    };
  }
  return { tempHp, allies: null }
}

// Clear active buffs and conditions as part of the atomic batch so SSE echo carries correct final state.
// Preserve Mage Armor (8-hour duration, not cleared on short rest) and
// Wild Shape (CLA-391: its te/THP/combatSummary marks already survive a
// short rest — keeping the buff keeps the form's state coherent; a Short
// Rest restores uses rather than ending the form).
// Returns the shape_shift buffs so the caller can re-stamp them after cleanup.
function applyShortRestBuffClears(name, updates) {
  const activeBuffsForShortRest = getRuntimeValue(name, 'activeBuffs') || [];
  const shapeShiftBuffsForShortRest = (Array.isArray(activeBuffsForShortRest) ? activeBuffsForShortRest : [])
    .filter(b => b.effect === 'shape_shift');
  updates.activeBuffs = Array.isArray(activeBuffsForShortRest)
    ? activeBuffsForShortRest.filter(b => b.name === 'Mage Armor' || b.effect === 'shape_shift')
    : [];
  updates.activeConditions = [];
  updates.activeConditionMeta = {};
  return shapeShiftBuffsForShortRest;
}

// Clear Globe of Invulnerability target effects and remove True Polymorph
// summoned creatures / object transforms on short rest.
function clearShortRestSummonEffects(campaignName) {
  const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
  if (Array.isArray(storedEffects)) {
    setRuntimeValue('campaign', 'targetEffects', storedEffects.filter(te => te.effect !== 'globe_barrier' && te.effect !== 'antimagic_field' && te.effect !== 'protection_from_evil_and_good' && te.effect !== 'forcecage' && te.effect !== 'starry_form' && te.effect !== 'polymorph' && te.effect !== 'animal_shapes' && te.effect !== 'true_polymorph' && te.effect !== 'object_transform' && te.effect !== 'shapechange'), campaignName);
  }

  // Remove True Polymorph summoned creatures on short rest
  const shortRestCs = getCombatSummary(campaignName);
  if (!shortRestCs?.creatures) return

  const summonedToRemove = shortRestCs.creatures.filter(c => c.summonSource === 'true_polymorph');
  if (summonedToRemove.length > 0) {
    shortRestCs.creatures = shortRestCs.creatures.filter(c => c.summonSource !== 'true_polymorph');
    storageService.default.set('combatSummary', shortRestCs, campaignName);
    setCombatSummaryCache(shortRestCs, campaignName);
  }
  const objectTransforms = shortRestCs.creatures.filter(c => c.polymorphObject);
  if (objectTransforms.length > 0) {
    for (const creature of objectTransforms) {
      const original = creature.polymorphOriginal || {};
      if (original.maxHp !== undefined) creature.maxHp = original.maxHp;
      if (original.ac !== undefined) creature.ac = original.ac;
      if (original.speed !== undefined) creature.speed = original.speed;
      delete creature.polymorphObject;
      delete creature.objectType;
      const activeConditions = getRuntimeValue(creature.name, 'activeConditions', campaignName) || [];
      const filteredConds = activeConditions.filter(c => String(c).toLowerCase() !== 'incapacitated');
      if (filteredConds.length !== activeConditions.length) {
        setRuntimeValue(creature.name, 'activeConditions', filteredConds, campaignName);
      }
    }
    storageService.default.set('combatSummary', shortRestCs, campaignName);
    setCombatSummaryCache(shortRestCs, campaignName);
  }
}

function addShortRestFlagResets(updates) {
  for (const key of SHORT_REST_NULL_FLAG_KEYS) {
    updates[key] = null
  }
}

function clearShortRestCampaignTargetEffects(campaignName) {
  for (const effectKeys of SHORT_REST_TARGET_EFFECT_CLEAR_KEYS) {
    const effects = getRuntimeValue('campaign', 'targetEffects') || []
    const filtered = effects.filter(e => !effectKeys.includes(e.effect))
    if (filtered.length !== effects.length) {
      setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true)
    }
  }
}

// Clear regenerateActive flag from all targets and set them to full HP on short rest
function clearRegenerateActiveFlags(campaignName) {
  for (const key of getAllStoreKeys()) {
    if (typeof key !== 'string') continue;
    const regenActive = getRuntimeValue(key, 'regenerateActive', campaignName);
    if (regenActive) {
      setRuntimeValue(key, 'regenerateActive', false, campaignName);
      const storedMaxHp = getRuntimeValue(key, 'hitPoints', campaignName);
      if (storedMaxHp != null) {
        setRuntimeValue(key, 'currentHitPoints', storedMaxHp, campaignName);
      }
    }
  }
}

// CLA-391: shared rest cleanup preserves only Mage Armor/Death Ward —
// re-stamp the Wild Shape buff so its te/THP/combatSummary state stays coherent.
function restoreWildShapeBuffs(name, shapeShiftBuffsForShortRest, campaignName) {
  if (shapeShiftBuffsForShortRest.length === 0) return;
  const buffsAfterClear = getRuntimeValue(name, 'activeBuffs') || [];
  if (!(Array.isArray(buffsAfterClear) ? buffsAfterClear : []).some(b => b.effect === 'shape_shift')) {
    setRuntimeValue(name, 'activeBuffs', [...(Array.isArray(buffsAfterClear) ? buffsAfterClear : []), ...shapeShiftBuffsForShortRest], campaignName);
  }
}

// Clear Invisibility / Greater Invisibility buffs and conditions (not managed by expiration system)
function endInvisibilityEffects(name, campaignName) {
  const invisKey = `_activeInvisibility_${name}`
  const invisCaster = getRuntimeValue('campaign', invisKey, campaignName)
  if (invisCaster) {
    endInvisibility(name, campaignName, 'target finished a rest')
    setRuntimeValue('campaign', invisKey, null, campaignName)
  }

  const greaterInvisKey = `_activeGreaterInvisibility_${name}`
  const greaterInvisCaster = getRuntimeValue('campaign', greaterInvisKey, campaignName)
  if (greaterInvisCaster) {
    endGreaterInvisibility(name, campaignName, 'target finished a rest')
    setRuntimeValue('campaign', greaterInvisKey, null, campaignName)
  }
}

export async function applyShortRest(playerStats, campaignName, options = {}) {
  const { skipAutoRecovery = false } = options;
  const name = playerStats.name
  const storedHp = getRuntimeValue(name, 'currentHitPoints')
  const currentHp = computeShortRestHpNewCurrent(storedHp, playerStats.hitPoints, 0)

  const updates = { currentHitPoints: currentHp }
  for (const key of getShortRestResources()) {
    updates[key] = null
  }

  addClassResourceUpdates(name, playerStats, updates, campaignName)

  const hasImprovedWardingFlare = playerStats.specialActions?.some(f => f.name === 'Improved Warding Flare')
  if (hasImprovedWardingFlare) {
    updates.wardingflareUses = null
  }

  resetReplenishingMeals(name, playerStats, campaignName)

  if (!skipAutoRecovery) {
    addFontOfInspirationUpdates(name, playerStats, updates, campaignName)
    addArcaneRecoveryUpdates(name, playerStats, updates)
  }

  addSignatureSpellResets(name, playerStats, updates, campaignName)
  addSavantSelectionResets(name, playerStats, updates, campaignName)
  addPactMagicUpdates(name, playerStats, updates)

  // Clear Vow of Enmity state on short rest
  await clearVowOfEnmity(name, updates, campaignName)

  // Tireless: decrease exhaustion by 1 on short rest
  if (playerStats.class?.name === 'Ranger' && playerStats.level >= 10) {
    const currentExhaustion = getRuntimeValue(name, 'exhaustionLevel', campaignName)
    if (typeof currentExhaustion === 'number' && currentExhaustion > 0) {
      updates.exhaustionLevel = currentExhaustion - 1
    }
  }

  // Reset Boon of Fate (Epic Boon) on short rest
  updates.boonOfFateUsed = false

  // Celestial Resilience: Grant temp HP on short rest for Celestial Patron
  const celestialGrant = await grantCelestialResilienceOnShortRest(name, playerStats, campaignName)
  if (celestialGrant) {
    updates.tempHp = celestialGrant.tempHp
  }

  const shapeShiftBuffsForShortRest = applyShortRestBuffClears(name, updates)

  clearShortRestSummonEffects(campaignName)

  addShortRestFlagResets(updates)

  setRuntimeBatch(name, updates, campaignName)

  clearShortRestCampaignTargetEffects(campaignName)
  clearRegenerateActiveFlags(campaignName)

  setRuntimeValue(name, 'resistanceUsedThisTurn', null, campaignName)
  clearAllExpirationEffects(name, campaignName)
  restoreWildShapeBuffs(name, shapeShiftBuffsForShortRest, campaignName)
  clearHuntersMarkConcentration(name, campaignName)
  clearAllConcentrations(campaignName, name)

  endInvisibilityEffects(name, campaignName)

  return { celestialResilienceAllies: celestialGrant?.allies ?? null }
}
