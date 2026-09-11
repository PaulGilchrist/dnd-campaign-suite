import { getRuntimeValue, setRuntimeBatch, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'
import { rollD20 } from '../../../services/dice/diceRoller.js'
import * as storageService from '../../../services/ui/storage.js'
import { getCombatSummary, setCombatSummaryCache } from '../../../services/encounters/combatData.js'
import { clearAllConcentrations } from '../../../services/combat/concentration/concentrationService.js'
import { addEntry } from '../../../services/ui/logService.js'
import { grantCelestialResilience } from '../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js'
import { setTempHp } from '../../../services/automation/handlers/buffs/tempHpService.js'
import { endInvisibility, endGreaterInvisibility } from '../features/invisibilityService.js'
import { clearHuntersMarkConcentration } from './restRules.js'
import { getLongRestResources, spellSlotLevels, getLevelAfterLongRest } from './restRules-constants.js'

// Campaign targetEffect keys cleared on long rest, in original evaluation order.
// Each entry is a list of effect keys removed by one read/filter/write cycle.
const LONG_REST_TARGET_EFFECT_CLEAR_KEYS = [
  ['clairvoyant_combatant'],
  ['pass_without_trace_bonus'],
  ['blur'],
  ['regenerate'],
  ['beacon_of_hope'],
  ['resistance_damage_reduction'],
  ['barkskin'],
  ['enhance_ability'],
  ['circle_of_power'],
  ['foresight', 'advantage_attacks', 'advantage_saves', 'advantage_abilities'],
  ['starry_form'],
]

// Set each [key, value] entry for a character with skipSync=true, in order.
function resetFlags(name, campaignName, entries) {
  for (const [key, value] of entries) {
    setRuntimeValue(name, key, value, campaignName, true)
  }
}

function buildLongRestCharData(playerStats) {
  const charData = {}

  charData.currentHitPoints = playerStats.hitPoints
  charData.tempHp = null

  if (playerStats.spellAbilities) {
    for (const level of spellSlotLevels()) {
      const key = `spell_slots_level_${level}`
      const max = playerStats.spellAbilities[key]
      if (max != null) {
        charData[key] = max
      }
    }
  }

  charData.shortRestHitDice = playerStats.level

  getLongRestResources().forEach((key) => {
    charData[key] = null
  })

  // Clear post-cast rider uses on long rest (e.g. Beguiling Magic)
  const passives = playerStats.automation?.passives ?? []
  for (const p of passives) {
    if ((p.type === 'post_cast_rider' || (p.type === 'passive_rule' && p.riderSave)) && p.riderSave?.recharge === 'long_rest') {
      const riderName = p.name
      const usesKey = `postCastRider_${riderName.replace(/\s+/g, '_')}`
      charData[usesKey] = null
    }
  }

  // Clear active buffs and conditions as part of the atomic batch so SSE echo carries correct final state
  charData.activeBuffs = []
  charData.activeConditions = []
  charData.activeConditionMeta = {}

  return charData
}

// Clear Globe of Invulnerability target effects and remove True Polymorph
// summoned creatures / object transforms on long rest.
function clearLongRestSummonEffects(campaignName) {
  const storedEffects = getRuntimeValue('campaign', 'targetEffects') || []
  if (Array.isArray(storedEffects)) {
    setRuntimeValue('campaign', 'targetEffects', storedEffects.filter(te => te.effect !== 'globe_barrier' && te.effect !== 'antimagic_field' && te.effect !== 'protection_from_evil_and_good' && te.effect !== 'forcecage' && te.effect !== 'polymorph' && te.effect !== 'animal_shapes' && te.effect !== 'true_polymorph' && te.effect !== 'object_transform' && te.effect !== 'shapechange'), campaignName)
  }

  const longRestCs = getCombatSummary(campaignName)
  if (!longRestCs?.creatures) return

  const summonedToRemove = longRestCs.creatures.filter(c => c.summonSource === 'true_polymorph')
  if (summonedToRemove.length > 0) {
    longRestCs.creatures = longRestCs.creatures.filter(c => c.summonSource !== 'true_polymorph')
    storageService.default.set('combatSummary', longRestCs, campaignName)
    setCombatSummaryCache(longRestCs, campaignName)
  }

  const objectTransforms = longRestCs.creatures.filter(c => c.polymorphObject)
  if (objectTransforms.length > 0) {
    for (const creature of objectTransforms) {
      const original = creature.polymorphOriginal || {}
      if (original.maxHp !== undefined) creature.maxHp = original.maxHp
      if (original.ac !== undefined) creature.ac = original.ac
      if (original.speed !== undefined) creature.speed = original.speed
      delete creature.polymorphObject
      delete creature.objectType
      const activeConditions = getRuntimeValue(creature.name, 'activeConditions', campaignName) || []
      const filteredConds = activeConditions.filter(c => String(c).toLowerCase() !== 'incapacitated')
      if (filteredConds.length !== activeConditions.length) {
        setRuntimeValue(creature.name, 'activeConditions', filteredConds, campaignName)
      }
    }
    storageService.default.set('combatSummary', longRestCs, campaignName)
    setCombatSummaryCache(longRestCs, campaignName)
  }
}

function clearLongRestCharacterFlags(charData) {
  // Clear Awakened Mind target on long rest
  charData.awakenedMindTarget = null

  // Clear Clairvoyant Combatant target on long rest
  charData.clairvoyantCombatantTarget = null
  charData.clairvoyantCombatantUses = null

  // Clear death save state on long rest
  charData.deathSaves = [false, false, false]
  charData.deathFailures = [false, false, false]
  charData.isDead = 0

  // Clear Zealous Presence buff marker on long rest (recharges on long rest or rage expenditure)
  charData.zealousPresenceActive = null

  // Clear Living Legend active state on long rest
  charData.livingLegendActive = null
  charData.unerringStrikeUsed = null

  // Clear Holy Nimbus active state on long rest
  charData.holyNimbusActive = null

  // Clear Elder Champion active state on long rest
  charData.elderChampionActive = null

  // Clear Avenging Angel active state on long rest
  charData.avengingAngelActive = null

  // Clear Peerless Athlete active state on long rest
  charData.peerlessAthleteActive = null

  // Clear Trance of Order active state on long rest
  charData.tranceOfOrderActive = null

  // Clear Fanatical Focus used state on long rest (Barbarian feature, per long rest)
  charData.fanaticalFocusUsed = null

  // Clear Wild Magic Surge badge on long rest
  charData.wildMagicSurgeEffects = null

  // Clear Large Form active state and rest-used flag on long rest
  charData.largeFormActive = null
  charData.largeFormActive_restUsed = null

  // Clear Vow of Enmity active state on long rest
  charData.vowOfEnmityTarget = null
  charData.vowOfEnmityCostPaid = null
}

async function clearVowOfEnmityTargets(name, campaignName) {
  const vowTarget = getRuntimeValue(name, 'vowOfEnmityTarget', campaignName)
  if (!vowTarget) return
  const targetBuffs = getRuntimeValue(vowTarget, 'activeBuffs', campaignName) || []
  const filteredTargetBuffs = targetBuffs.filter(b => b.effect !== 'vow_of_enmity')
  await setRuntimeValue(vowTarget, 'activeBuffs', filteredTargetBuffs, campaignName)
}

// Spell Thief: reset uses to 1 and clear blocked/stolen spell tracking on long rest
async function resetSpellThiefTracking(name, playerStats, charData, campaignName) {
  const hasSpellThief = (playerStats.automation?.reactions ?? []).some(
    r => r.type === 'spell_thief'
  )
  if (!hasSpellThief) return

  charData.spellthiefUses = 1
  const blockList = getRuntimeValue(name, '_spellThiefBlockedList', campaignName)
  if (blockList) {
    const entries = JSON.parse(blockList)
    for (const entry of entries) {
      charData[`spellThiefBlocked_${entry.casterName}_${entry.spellName}`] = null
    }
  }
  const stolenList = getRuntimeValue(name, '_spellThiefStolenList', campaignName)
  if (stolenList) {
    const entries = JSON.parse(stolenList)
    for (const entry of entries) {
      charData[`spellThiefStolen_${entry.casterName}_${entry.spellName}`] = null
    }
  }
  charData._spellThiefBlockedList = null
  charData._spellThiefStolenList = null

  // Clear blocked spell entries from each caster's runtime store
  if (blockList) {
    const entries = JSON.parse(blockList)
    for (const entry of entries) {
      const casterBlockList = getRuntimeValue(entry.casterName, '_spellThiefCasterBlock', campaignName)
      if (casterBlockList) {
        const casterEntries = JSON.parse(casterBlockList)
        const updated = casterEntries.filter(e => !(e.thiefName === name && e.spellName === entry.spellName))
        if (updated.length > 0) {
          await setRuntimeValue(entry.casterName, '_spellThiefCasterBlock', JSON.stringify(updated), campaignName)
        } else {
          await setRuntimeValue(entry.casterName, '_spellThiefCasterBlock', null, campaignName)
        }
      }
    }
  }
}

function clearLongRestCampaignTargetEffects(campaignName) {
  for (const effectKeys of LONG_REST_TARGET_EFFECT_CLEAR_KEYS) {
    const effects = getRuntimeValue('campaign', 'targetEffects') || []
    const filtered = effects.filter(e => !effectKeys.includes(e.effect))
    if (filtered.length !== effects.length) {
      setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true)
    }
  }
}

function endWildShapesOnLongRest(campaignName) {
  const wildShapeEffects = getRuntimeValue('campaign', 'targetEffects') || []
  const wildShapeTargets = wildShapeEffects.filter(te => te.effect === 'wild_shape').map(te => te.source)
  for (const wsSource of wildShapeTargets) {
    const cs = getCombatSummary(campaignName)
    if (cs) {
      const druidCreature = cs.creatures?.find(c => c.name === wsSource && c.type === 'player')
      if (druidCreature) {
        delete druidCreature.wildShapeSource
        delete druidCreature.beastIndex
        delete druidCreature.beastName
      }
      cs.creatures = cs.creatures.filter(c => !(c.wildShapeSource === wsSource && c.type !== 'player'))
      storageService.default.set('combatSummary', cs, campaignName)
    }
    const te = getRuntimeValue('campaign', 'targetEffects') || []
    const filtered = te.filter(e => !(e.effect === 'wild_shape' && e.source === wsSource))
    if (filtered.length !== te.length) {
      setRuntimeValue('campaign', 'targetEffects', filtered, campaignName, true)
    }
    const buffs = getRuntimeValue(wsSource, 'activeBuffs') || []
    setRuntimeValue(wsSource, 'activeBuffs', buffs.filter(b => b.effect !== 'shape_shift'), campaignName)
    setRuntimeValue(wsSource, 'circleFormsAC', null, campaignName)
    setRuntimeValue(wsSource, 'tempHp', 0, campaignName)
  }
}

// Clear regenerateActive flag from all targets and set them to full HP on long rest
function clearRegenerateActiveFlags(campaignName) {
  for (const key of getAllStoreKeys()) {
    if (typeof key !== 'string') continue
    const regenActive = getRuntimeValue(key, 'regenerateActive', campaignName)
    if (regenActive) {
      setRuntimeValue(key, 'regenerateActive', false, campaignName)
      const storedMaxHp = getRuntimeValue(key, 'hitPoints', campaignName)
      if (storedMaxHp != null) {
        setRuntimeValue(key, 'currentHitPoints', storedMaxHp, campaignName)
      }
    }
  }
}

// Handle Greater Divine Intervention Wish cooldown (2d4 long rests) — must run AFTER batch reset
function resetWishCooldown(name, campaignName) {
  const wishCooldown = getRuntimeValue(name, '_divineInterventionWishCooldown', campaignName)
  if (wishCooldown == null || !(Number(wishCooldown) > 0)) return
  const newCooldown = Number(wishCooldown) - 1
  if (newCooldown <= 0) {
    setRuntimeValue(name, '_divineInterventionWishCooldown', 0, campaignName, true)
  } else {
    setRuntimeValue(name, '_divineInterventionWishCooldown', newCooldown, campaignName, true)
    setRuntimeValue(name, 'divineInterventionUses', -1, campaignName, true)
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

function resetMagicInitiateFreeCasts(name, playerStats, campaignName) {
  // Reset Magic Initiate free cast counters on long rest
  const miInstances = getRuntimeValue(name, '_magicInitiateInstances', campaignName) || playerStats.magicInitiateInstances
  if (miInstances && Array.isArray(miInstances)) {
    miInstances.forEach((inst, idx) => {
      const featureName = `Level 1 Spell [Instance ${idx + 1}]`
      const freeCastKey = `_${featureName.replace(/\s+/g, '_')}_freeCastCount`
      setRuntimeValue(name, freeCastKey, null, campaignName, true)
    })
  }
}

function resetSignatureSpells(name, campaignName) {
  // Reset Signature Spells on long rest
  const selection = getRuntimeValue(name, 'SignatureSpells_selection', campaignName)
  if (selection && Array.isArray(selection)) {
    for (const spell of selection) {
      setRuntimeValue(name, `SignatureSpells_${spell.replace(/\s+/g, '_')}_used`, null, campaignName, true)
    }
  }
}

// Celestial Resilience: Grant temp HP on long rest for Celestial Patron.
// Returns the modal ally-target payload when allies were gifted temp HP, else null.
async function grantCelestialResilienceOnLongRest(name, playerStats, campaignName) {
  if (playerStats.class?.major?.name !== 'Celestial Patron' && playerStats.class?.subclass?.name !== 'Celestial Patron') return null
  const features = playerStats.specialActions || []
  const feature = features.find(f => f.name === 'Celestial Resilience')
  if (!feature) return null
  if (playerStats.level == null) {
    console.error('[restRules] applyLongRest: playerStats.level is missing for celestial patron temp HP')
    throw new Error('playerStats.level is required for celestial patron temp HP')
  }
  const warlockLevel = playerStats.level
  const chaMod = (playerStats.abilities || []).find(a => a.name === 'Charisma')?.bonus || 0
  const selfTempHp = warlockLevel + chaMod
  if (selfTempHp <= 0) return null

  setTempHp(name, selfTempHp, campaignName)
  addEntry(campaignName, {
    type: 'ability_use',
    characterName: name,
    abilityName: 'Celestial Resilience',
    description: `${name} gains ${selfTempHp} temporary hit points from Celestial Resilience (long rest).`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[celestialResilience] Error:', e); });

  // Gather allies for modal
  const combatSummary = getCombatSummary(campaignName)
  if (!combatSummary) return null
  const celestialResult = await grantCelestialResilience(playerStats, campaignName, 'long_rest')
  if (celestialResult?.allyTempHp && celestialResult?.allies && celestialResult.allies.length > 0) {
    return {
      creatureTargets: celestialResult.allies,
      allyTempHp: celestialResult.allyTempHp,
      selfTempHp: celestialResult.selfTempHp,
      maxTargets: celestialResult.maxAllies,
    }
  }
  return null
}

// Reset Bastion of Law ward on long rest
function resetBastionOfLaw(name, campaignName) {
  const wardTarget = getRuntimeValue(name, 'bastionOfLawWardTarget', campaignName)
  setRuntimeValue(name, 'bastionOfLawActive', false, campaignName, true)
  setRuntimeValue(name, 'bastionOfLawWardDice', [], campaignName, true)
  setRuntimeValue(name, 'bastionOfLawWardTarget', null, campaignName, true)
  // Clear ward from the target character
  if (wardTarget) {
    setRuntimeValue(wardTarget, 'bastionOfLawActive', false, campaignName, true)
    setRuntimeValue(wardTarget, 'bastionOfLawWardDice', [], campaignName, true)
    setRuntimeValue(wardTarget, 'bastionOfLawWardSource', null, campaignName, true)
    setRuntimeValue(wardTarget, 'bastionOfLawWardUsed', null, campaignName, true)
    setRuntimeValue(wardTarget, 'bastionOfLawLastAttackDamage', null, campaignName, true)
  }
}

// Restore Arcane Ward on long rest (only for Abjurers)
function resetArcaneWard(name, playerStats, campaignName) {
  const hasArcaneWard = (playerStats.automation?.passives ?? []).some(p => p.type === 'arcane_ward' || (p.type === 'passive_rule' && p.effect === 'arcane_ward'))
  if (!hasArcaneWard) return
  const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0
  const wardMax = (2 * playerStats.level) + intMod
  setRuntimeValue(name, 'arcaneWardActive', false, campaignName, true)
  setRuntimeValue(name, 'arcaneWardHp', wardMax, campaignName, true)
  setRuntimeValue(name, 'arcaneWardMax', wardMax, campaignName, true)
}

// Refresh Portent dice on long rest — returns whether the caster has Portent.
function refreshPortentDice(name, playerStats, campaignName) {
  const hasPortent = (playerStats.automation?.specialActions ?? []).some(
    a => a.type === 'portent' || a.name === 'Portent'
  ) || (playerStats.automation?.passives ?? []).some(
    a => a.type === 'portent' || a.name === 'Portent'
  )
  if (!hasPortent) return false
  const maxDice = playerStats.level >= 14 ? 3 : 2
  const dice = []
  for (let i = 0; i < maxDice; i++) {
    dice.push(rollD20())
  }
  setRuntimeValue(name, 'portentDice', JSON.stringify(dice), campaignName, true)
  setRuntimeValue(name, 'portentUsedThisTurn', null, campaignName, true)
  return true
}

function resetNaturalRecoveryTracking(charData) {
  // Natural Recovery: reset free cast tracking on long rest
  charData.naturalRecoveryFreeCast = null
  charData.naturalRecoveryFreeCastUsed = null
  charData.naturalRecoverySlots = null
  charData._circleOfTheLandType = null
}

// Chef: Bolstering Treats crafted and Replenishing Meals reset on Long Rest.
// Returns the feature-presence flags used by the long rest log.
function resetChefFeatures(name, playerStats, campaignName) {
  const hasBolsteringTreats = (playerStats.automation?.specialActions ?? []).some(
    p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats'
  )
  if (hasBolsteringTreats) {
    const craftCount = playerStats.proficiency || 0
    setRuntimeValue(name, 'chefBolsteringTreats', craftCount, campaignName, true)
  }

  // Clear recipient's bolstering treats on long rest
  setRuntimeValue(name, 'bolsteringTreat', null, campaignName, true)

  const hasReplenishingMeal = (playerStats.automation?.passives ?? []).some(
    p => p.type === 'passive_rule' && p.effect === 'bonus_healing' && p.name === 'Replenishing Meal'
  )
  if (hasReplenishingMeal) {
    const mealMax = 4 + (playerStats.proficiency || 0)
    setRuntimeValue(name, 'replenishingMeals', mealMax, campaignName, true)
  }

  return { hasBolsteringTreats, hasReplenishingMeal }
}

// Resources-restored list for the long rest log, in original push order.
function buildLongRestResourcesList(playerStats, flags) {
  const { hasPortent, hasNaturalRecovery, hasBolsteringTreats, hasReplenishingMeal } = flags
  const isWarlock = playerStats.class?.name === 'Warlock'
  const resources = []
  resources.push('All hit dice restored')
  resources.push('All spell slots restored')
  if (isWarlock) resources.push('Pact Magic (Warlock spell slots)')
  if (hasPortent) resources.push('Portent dice')
  if (hasBolsteringTreats) resources.push('Bolstering Treats')
  if (hasReplenishingMeal) resources.push('Replenishing Meals')
  const hasCelestialResilience = playerStats.class?.major?.name === 'Celestial Patron' || playerStats.class?.subclass?.name === 'Celestial Patron'
  if (hasCelestialResilience && playerStats.specialActions?.some(f => f.name === 'Celestial Resilience')) resources.push('Celestial Resilience (temp HP)')
  if (hasNaturalRecovery) resources.push('Natural Recovery (spell slots)')
  if (isWarlock) resources.push('Magical Cunning (feature reset)')
  if ((playerStats.automation?.reactions ?? []).some(r => r.type === 'telekinetic_thrust')) resources.push('Telekinetic Thrust (use restored)')
  return resources
}

// Circle of the Stars: Star Map free cast count and Cosmic Omen roll on Long Rest.
// Appends its log lines to logEntries; runtime writes run in original order.
function resetStarMapOnLongRest(name, playerStats, campaignName, logEntries) {
  const isDruid = playerStats.class?.name === 'Druid'
  const isCircleOfTheStars = playerStats.class?.major?.name === 'Circle of the Stars' || playerStats.class?.subclass?.name === 'Circle of the Stars'
  // Star Map free cast count (reset to WIS modifier, min 1)
  if (isDruid && isCircleOfTheStars && playerStats.level >= 3) {
    const wis = playerStats.abilities?.find(a => a.name === 'Wisdom')
    const maxUses = Math.max(wis?.bonus || 0, 1)
    setRuntimeValue(name, '_Star_Map_freeCastCount', maxUses, campaignName, true)
    logEntries.push(`Star Map free casts: ${maxUses}`)
  }
  // Cosmic Omen Star Map roll
  if (isDruid && isCircleOfTheStars && playerStats.level >= 6) {
    const starMapRoll = rollD20()
    const isEven = starMapRoll % 2 === 0
    const omenType = isEven ? 'Weal' : 'Woe'
    setRuntimeValue(name, 'cosmicOmenEffect', JSON.stringify({
      type: omenType,
      isEven,
      starMapRoll,
    }), campaignName, true)
    clearAllExpirationEffects(name, campaignName)
    logEntries.push(`Cosmic Omen Star Map: ${starMapRoll} → ${omenType}`)
  }
}

// Log long rest to campaign log
function logLongRestSummary(name, playerStats, campaignName, flags) {
  const { currentExhaustion } = flags

  const logEntries = []
  logEntries.push(`${name} takes a long rest.`)
  const resources = buildLongRestResourcesList(playerStats, flags)
  if (resources.length > 0) {
    logEntries.push(`Resources restored: ${resources.join(', ')}`)
  }
  if (typeof currentExhaustion === 'number' && currentExhaustion > 0) {
    const newExhaustion = getLevelAfterLongRest(currentExhaustion);
    logEntries.push(`Exhaustion: ${currentExhaustion} → ${newExhaustion}`)
  }

  resetStarMapOnLongRest(name, playerStats, campaignName, logEntries)

  try {
    addEntry(campaignName, { type: 'long_rest', message: logEntries.join(' | ') });
  } catch (err) {
    console.error('[restRules] Failed to log long rest:', err.message)
  }
}

// CLA-252 + CLA-308: reset passive per-spell free-cast counters on long rest (one
// free cast PER SPELL per long rest — each freeCastSpells counter re-arms to null).
// FT-070 also resets per-spell-tracking free_spell feature counters (Shadow Touched's
// Shadow Magic: chosen spell + Invisibility) — consumer keys in spellPreparationService
// are `_${feature}_${Spell}_freeCastCount`; the old `_shadowTouchedSpell_freeCastCount`
// reset matched no writer/consumer, leaving those free casts permanently spent.
function resetPerSpellFreeCastCounters(name, playerStats, campaignName) {
  const passives = playerStats.automation?.passives ?? []
  const phantasmalPassive = passives.find(p => p.type === 'phantasmal_creatures')
  if (phantasmalPassive) {
    (phantasmalPassive.freeCastSpells ?? []).forEach(spellName => setRuntimeValue(name, `_Phantasmal_Creatures_${spellName.replace(/\s+/g, '_')}_freeCastCount`, null, campaignName, true))
    setRuntimeValue(name, '_phantasmalCreatures_list', [], campaignName, true)
  }
  const shadowArtsPassive = passives.find(p => p.type === 'shadow_arts')
  if (shadowArtsPassive) {
    (shadowArtsPassive.freeCastSpells ?? []).forEach(spellName => setRuntimeValue(name, `_Shadow_Arts_${spellName.replace(/\s+/g, '_')}_freeCastCount`, null, campaignName, true))
  }
  const perSpellFreeCastFeatures = [
    ...(playerStats.automation?.actions ?? []),
    ...(playerStats.automation?.bonusActions ?? []),
    ...(playerStats.automation?.specialActions ?? []),
  ].filter(e => e.type === 'free_spell' && e.perSpellTracking)
  for (const feature of perSpellFreeCastFeatures) {
    const featureSpells = Array.isArray(feature.spell) ? feature.spell : [feature.spell]
    featureSpells.forEach(spellName => {
      if (!spellName) return
      setRuntimeValue(name, `_${feature.name.replace(/\s+/g, '_')}_${spellName.replace(/\s+/g, '_')}_freeCastCount`, null, campaignName, true)
    })
  }
}

export async function applyLongRest(playerStats, campaignName) {
  const name = playerStats.name

  const charData = buildLongRestCharData(playerStats)

  clearLongRestSummonEffects(campaignName)

  clearLongRestCharacterFlags(charData)

  await clearVowOfEnmityTargets(name, campaignName)

  const currentExhaustion = getRuntimeValue(name, 'exhaustionLevel')
  if (typeof currentExhaustion === 'number' && currentExhaustion > 0) {
    charData.exhaustionLevel = getLevelAfterLongRest(currentExhaustion)
  }

  // Grant Heroic Inspiration from Resourceful trait (Human 2024)
  const hasResourceful = playerStats.specialActions?.some(f => f.name === 'Resourceful')
  if (hasResourceful) {
    charData.hasInspiration = true
  }

  await resetSpellThiefTracking(name, playerStats, charData, campaignName)

  // Single atomic write fires ONE SSE event with the complete final state
  setRuntimeBatch(name, charData, campaignName)

  clearLongRestCampaignTargetEffects(campaignName)

  // End Wild Shape on long rest
  endWildShapesOnLongRest(campaignName)

  clearRegenerateActiveFlags(campaignName)

  setRuntimeValue(name, 'resistanceUsedThisTurn', null, campaignName)

  // Clear Wrath of the Sea badge on long rest
  resetFlags(name, campaignName, [
    ['wrathOfTheSeaActive', null],
    ['wrathOfTheSeaDc', null],
    ['wrathOfTheSeaWisMod', null],
    ['wrathOfTheSeaSource', null],
  ])

  // Natural Recovery: reset free cast tracking on long rest
  const hasNaturalRecovery = (playerStats.automation?.passives ?? []).some(
    p => p.type === 'natural_recovery'
  )
  if (hasNaturalRecovery) {
    resetNaturalRecoveryTracking(charData)
  }

  resetWishCooldown(name, campaignName)

  clearAllExpirationEffects(name, campaignName)
  clearHuntersMarkConcentration(name, campaignName)
  clearAllConcentrations(campaignName, name)

  endInvisibilityEffects(name, campaignName)

  // Reset Psionic Strike once-per-turn flag on long rest
  resetFlags(name, campaignName, [
    ['psionicStrikeUsedThisTurn', null],
    ['uncannyMetabolismUsed', false],
    ['elementalAttunementActive', null],
    ['elementalAttunementElement', null],
    ['elementalEpitomeActive', null],
    ['epitomeResistanceType', null],
    ['epitomeEmpoweredUsedRound', null],
    ['destructiveStrideActive', null],
    ['destructiveStrideDamageType', null],
    ['_Energy_Resistances_chosenTypes', null],
  ])

  resetMagicInitiateFreeCasts(name, playerStats, campaignName)

  // Reset Fey Touched free cast counter on long rest
  if (playerStats.feyTouchedSpell) {
    setRuntimeValue(name, '_feyTouchedSpell_freeCastCount', null, campaignName, true)
  }

  // FT-070: Shadow Touched per-spell free-cast counter resets moved into
  // resetPerSpellFreeCastCounters (aligned consumer keys, shared machinery).

  // FT-068: Reset Ritual Master Quick Ritual counter on long rest
  const hasRitualMasterGrant = (playerStats.automation?.ritualSpells || []).some(f => f.chosenSpells)
    || (playerStats.feats || []).includes('Ritual Master')
  if (hasRitualMasterGrant) {
    setRuntimeValue(name, '_Ritual_Master_quickRitualUsed', null, campaignName, true)
  }

  resetFlags(name, campaignName, [
    ['undyingSentinelUsed', false],
    ['relentlessEnduranceUsed', false],
    ['boonOfFateUsed', false],
  ])

  resetSignatureSpells(name, campaignName)

  const celestialResilienceAllies = await grantCelestialResilienceOnLongRest(name, playerStats, campaignName)

  resetBastionOfLaw(name, campaignName)

  resetArcaneWard(name, playerStats, campaignName)

  const hasPortent = refreshPortentDice(name, playerStats, campaignName)

  // Reset per-spell free-cast counters on long rest — CLA-252 Phantasmal Creatures +
  // CLA-308 Shadow Arts (one free cast PER SPELL per long rest — each freeCastSpells
  // counter re-arms to null; null = re-armed/available).
  resetPerSpellFreeCastCounters(name, playerStats, campaignName)

  // Reset Favored Enemy / Stonecunning / Hurl Through Hell / Adrenaline Rush /
  // Giant Ancestry / Overchannel / Hunter's Prey counters on long rest
  resetFlags(name, campaignName, [
    ['_Favored_Enemy_freeCastCount', null],
    ['stonecunningUses', null],
    ['stonecunningRestTimestamp', null],
    ['hurlThroughHellUses', null],
    ['hurlThroughHellTurnUsed', null],
    ['adrenalineRushUses', null],
    ['adrenalineRushRestTimestamp', null],
    ['cloudsJauntUses', null],
    ['firesBurnUses', null],
    ['frostsChillUses', null],
    ['hillsTumbleUses', null],
    ['stonesEnduranceUses', null],
    ['stormsThunderUses', null],
    ['Overchannel_useCount', 0],
    ["_Hunter's_Prey_choice", null],
    ["_Hunter's_Prey_choice", null],
  ])

  const { hasBolsteringTreats, hasReplenishingMeal } = resetChefFeatures(name, playerStats, campaignName)

  logLongRestSummary(name, playerStats, campaignName, { hasPortent, hasNaturalRecovery, hasBolsteringTreats, hasReplenishingMeal, currentExhaustion })

  return { celestialResilienceAllies }
}
