import { getRuntimeValue, setRuntimeBatch, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'

import * as storageService from '../../../services/ui/storage.js'
import { getCombatSummary, setCombatSummaryCache } from '../../../services/encounters/combatData.js'
import { clearAllConcentrations } from '../../../services/combat/concentration/concentrationService.js'
import { addEntry } from '../../../services/ui/logService.js'
import { grantCelestialResilience } from '../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js'
import { setTempHp } from '../../../services/automation/handlers/buffs/tempHpService.js'
import { endInvisibility, endGreaterInvisibility } from '../features/invisibilityService.js'
import { clearHuntersMarkConcentration } from './restRules.js'
import { getShortRestResources, computeShortRestHpNewCurrent } from './restRules-constants.js'
import { computeSuperiorityDiceMax } from '../trackedResources.js'

export async function applyShortRest(playerStats, campaignName, options = {}) {
  const { skipAutoRecovery = false } = options;
  const name = playerStats.name
  const storedHp = getRuntimeValue(name, 'currentHitPoints')
  const currentHp = computeShortRestHpNewCurrent(storedHp, playerStats.hitPoints, 0)

  const updates = { currentHitPoints: currentHp }
  for (const key of getShortRestResources()) {
    updates[key] = null
   }

  if (playerStats.class?.name === 'Fighter') {
    // FS-010: restore superiority dice to the character's ACTUAL max
    // (Battle Master level table, or 1 for a pure Superior Technique
    // fighter) — restoring null here armed the ??4 phantom pool.
    const maxSD = computeSuperiorityDiceMax(playerStats);
    if (maxSD > 0) {
      updates.superiorityDice = maxSD;
    }
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const maxSW = classLevel?.second_wind || 0;
    const currentSW = Number(getRuntimeValue(name, 'secondWindUses', campaignName) ?? 0);
    if (currentSW < maxSW) {
      updates.secondWindUses = Math.min(maxSW, currentSW + 1);
    }
  }

  // Barbarian 2024: Rage recharges 1 use on short rest
  if (playerStats.class?.name === 'Barbarian' && playerStats.rules === '2024') {
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const maxRage = classLevel?.rages || 0;
    const trackedRage = playerStats._trackedResources?.ragePoints;
    const storedRage = getRuntimeValue(name, 'ragePoints', campaignName);
    const currentRage = storedRage != null ? Number(storedRage) : (trackedRage?.current ?? maxRage);
    if (currentRage < maxRage) {
      updates.ragePoints = Math.min(maxRage, currentRage + 1);
    }
  }

  const hasImprovedWardingFlare = playerStats.specialActions?.some(f => f.name === 'Improved Warding Flare')
  if (hasImprovedWardingFlare) {
    updates.wardingflareUses = null
  }

  // Chef: Replenishing Meals reset on Short Rest
  const hasReplenishingMeal = (playerStats.automation?.passives ?? []).some(
    p => p.type === 'passive_rule' && p.effect === 'bonus_healing' && p.name === 'Replenishing Meal'
  )
  if (hasReplenishingMeal) {
    const mealMax = 4 + (playerStats.proficiency || 0)
    setRuntimeValue(name, 'replenishingMeals', mealMax, campaignName, true)
  }

  if (!skipAutoRecovery) {
    const hasFontOfInspiration = (playerStats.automation?.passives ?? []).some(p => p.type === 'font_of_inspiration')
    if (hasFontOfInspiration) {
      const charisma = playerStats.abilities?.find(a => a.name === 'Charisma')
      const maxBI = charisma?.bonus || 0
      const storedBI = getRuntimeValue(name, 'bardicInspirationUses', campaignName)
      const currentBI = storedBI != null ? Number(storedBI) : maxBI
      if (storedBI == null || currentBI < maxBI) {
        updates.bardicInspirationUses = maxBI
      }
    }

    // Arcane Recovery: Wizard spell slot recovery on short rest
    const hasArcaneRecovery = (playerStats.automation?.passives ?? []).some(
      p => p.type === 'resource_restoration' && p.resourceKey === 'arcaneRecoveryLevels'
    )
    if (hasArcaneRecovery && playerStats.class?.name === 'Wizard') {
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
  }

  // Signature Spells: Reset per-spell used flags on short or long rest
  const hasSignatureSpells = (playerStats.automation?.specialActions ?? []).some(
    a => a.type === 'signature_spells'
  )
  if (hasSignatureSpells) {
    const selection = getRuntimeValue(name, 'SignatureSpells_selection', campaignName)
    if (selection && Array.isArray(selection)) {
      for (const spell of selection) {
        const usedKey = `SignatureSpells_${spell.replace(/\s+/g, '_')}_used`
        updates[usedKey] = null
      }
    }
  }

  // Divination Savant: Reset free cast tracking on short or long rest
  const hasDivinationSavant = (playerStats.automation?.passives ?? []).some(
    p => p.type === 'passive_rule' && p.effect === 'divination_savant'
  )
  if (hasDivinationSavant) {
    const divSelection = getRuntimeValue(name, '_Divination_Savant_selection', campaignName)
    if (divSelection && Array.isArray(divSelection)) {
      for (const spell of divSelection) {
        const usedKey = `_Divination_Savant_${spell.replace(/\s+/g, '_')}_used`
        updates[usedKey] = null
      }
    }
  }

  // Evocation Savant: Reset free cast tracking on short or long rest
  const hasEvocationSavant = (playerStats.automation?.passives ?? []).some(
    p => p.type === 'passive_rule' && p.effect === 'evocation_savant'
  )
  if (hasEvocationSavant) {
    const evocSelection = getRuntimeValue(name, '_Evocation_Savant_selection', campaignName)
    if (evocSelection && Array.isArray(evocSelection)) {
      for (const spell of evocSelection) {
        const usedKey = `_Evocation_Savant_${spell.replace(/\s+/g, '_')}_used`
        updates[usedKey] = null
      }
    }
  }

  // Illusion Savant: Reset free cast tracking on short or long rest
  const hasIllusionSavant = (playerStats.automation?.passives ?? []).some(
    p => p.type === 'passive_rule' && p.effect === 'illusion_savant'
  )
  if (hasIllusionSavant) {
    const illusionSelection = getRuntimeValue(name, '_Illusion_Savant_selection', campaignName)
    if (illusionSelection && Array.isArray(illusionSelection)) {
      for (const spell of illusionSelection) {
        const usedKey = `_Illusion_Savant_${spell.replace(/\s+/g, '_')}_used`
        updates[usedKey] = null
      }
    }
  }

  // Pact Magic: Warlock spell slot recovery on short rest
  if (playerStats.class?.name === 'Warlock') {
    const slotLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    for (const level of slotLevels) {
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

  // Clear Vow of Enmity state on short rest
  const vowTarget = getRuntimeValue(name, 'vowOfEnmityTarget', campaignName);
  updates.vowOfEnmityTarget = null;
  updates.vowOfEnmityCostPaid = null;
  if (vowTarget) {
    const targetBuffs = getRuntimeValue(vowTarget, 'activeBuffs', campaignName) || [];
    const filteredTargetBuffs = targetBuffs.filter(b => b.effect !== 'vow_of_enmity');
    await setRuntimeValue(vowTarget, 'activeBuffs', filteredTargetBuffs, campaignName);
  }

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
  let celestialResilienceAllies = null;
  if (playerStats.class?.major?.name === 'Celestial Patron' || playerStats.class?.subclass?.name === 'Celestial Patron') {
      const features = playerStats.specialActions || []
      const feature = features.find(f => f.name === 'Celestial Resilience')
      if (feature) {
         if (playerStats.level == null) {
           console.error('[restRules] applyShortRest: playerStats.level is missing for celestial patron temp HP')
           throw new Error('playerStats.level is required for celestial patron temp HP')
         }
         const warlockLevel = playerStats.level
         const chaMod = (playerStats.abilities || []).find(a => a.name === 'Charisma')?.bonus || 0
         const selfTempHp = warlockLevel + chaMod
          if (selfTempHp > 0) {
             updates.tempHp = setTempHp(name, selfTempHp, campaignName)
           addEntry(campaignName, {
            type: 'ability_use',
            characterName: name,
            abilityName: 'Celestial Resilience',
            description: `${name} gains ${selfTempHp} temporary hit points from Celestial Resilience (short rest).`,
            timestamp: Date.now(),
          }).catch((e) => { console.error('[celestialResilience] Error:', e); });

          // Gather allies for modal
          const combatSummary = getCombatSummary(campaignName);
          if (combatSummary) {
            const celestialResult = await grantCelestialResilience(playerStats, campaignName, 'short_rest');
            if (celestialResult?.allyTempHp && celestialResult?.allies && celestialResult.allies.length > 0) {
              celestialResilienceAllies = {
                creatureTargets: celestialResult.allies,
                allyTempHp: celestialResult.allyTempHp,
                selfTempHp: celestialResult.selfTempHp,
                maxTargets: celestialResult.maxAllies,
              };
            }
          }
       }
    }
 }

    // Clear active buffs and conditions as part of the atomic batch so SSE echo carries correct final state
    // Preserve Mage Armor (8-hour duration, not cleared on short rest)
    const activeBuffsForShortRest = getRuntimeValue(name, 'activeBuffs') || [];
    const filteredBuffsForShortRest = Array.isArray(activeBuffsForShortRest)
        ? activeBuffsForShortRest.filter(b => b.name === 'Mage Armor')
        : [];
    updates.activeBuffs = filteredBuffsForShortRest;
    updates.activeConditions = [];
    updates.activeConditionMeta = {};

    // Clear Globe of Invulnerability target effects on short rest
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    if (Array.isArray(storedEffects)) {
      const filteredEffects = storedEffects.filter(te => te.effect !== 'globe_barrier' && te.effect !== 'antimagic_field' && te.effect !== 'protection_from_evil_and_good' && te.effect !== 'forcecage' && te.effect !== 'starry_form' && te.effect !== 'polymorph' && te.effect !== 'animal_shapes' && te.effect !== 'true_polymorph' && te.effect !== 'object_transform' && te.effect !== 'shapechange');
      setRuntimeValue('campaign', 'targetEffects', filteredEffects, campaignName);
    }

    // Remove True Polymorph summoned creatures on short rest
    const shortRestCs = getCombatSummary(campaignName);
    if (shortRestCs?.creatures) {
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

    // Clear Awakened Mind target on short rest
    updates.awakenedMindTarget = null;

  // Clear Clairvoyant Combatant target on short rest
  updates.clairvoyantCombatantTarget = null;
  updates.clairvoyantCombatantUses = null;

  // Clear Portent once-per-turn flag on short rest
  updates.portentUsedThisTurn = null;

  // Reset Charger once-per-turn flag on short rest
  updates["_Charge_Attack_usedRound"] = null;

   // Reset Psionic Strike once-per-turn flag on short rest
  updates.psionicStrikeUsedThisTurn = null;

  // Reset Hunter's Prey choice on short rest
  updates["_Hunter's_Prey_choice"] = null;

  // Clear Wrath of the Sea badge on short rest
  updates.wrathOfTheSeaActive = null;
  updates.wrathOfTheSeaDc = null;
  updates.wrathOfTheSeaWisMod = null;
  updates.wrathOfTheSeaSource = null;

  // Clear Zealous Presence buff marker on short rest (lasts until start of barbarian's next turn)
  updates.zealousPresenceActive = null;

  // Clear Living Legend active state on short rest
  updates.livingLegendActive = null;
  updates.unerringStrikeUsed = null;

  // Clear Holy Nimbus active state on short rest
  updates.holyNimbusActive = null;

   // Clear Elder Champion active state on short rest
    updates.elderChampionActive = null;

    // Clear Avenging Angel active state on short rest
    updates.avengingAngelActive = null;

    // Clear Peerless Athlete active state on short rest
    updates.peerlessAthleteActive = null;

    // Clear Bastion of Law ward on short rest
    updates.bastionOfLawActive = null;
    updates.bastionOfLawWardDice = null;
    updates.bastionOfLawWardSource = null;
    updates.bastionOfLawWardUsed = null;
    updates.bastionOfLawLastAttackDamage = null;

    // Clear Trance of Order active state on short rest
    updates.tranceOfOrderActive = null;

    // Clear Large Form active state on short rest (rest-used flag persists)
    updates.largeFormActive = null;

    // Clear Wild Magic Surge badge on short rest
    updates.wildMagicSurgeEffects = null;

    // Clear Elemental Attunement active state on short rest
    updates.elementalAttunementActive = null;
    updates.elementalAttunementElement = null;

    // Clear Elemental Epitome active state on short rest
    updates.elementalEpitomeActive = null;
    updates.epitomeResistanceType = null;
    updates.epitomeEmpoweredUsedRound = null;
    updates.destructiveStrideActive = null;
    updates.destructiveStrideDamageType = null;

    setRuntimeBatch(name, updates, campaignName)

    // Clear Clairvoyant Combatant effects from campaign targetEffects on short rest
    const clairvoyantEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredClairvoyantEffects = clairvoyantEffects.filter(e => e.effect !== 'clairvoyant_combatant');
    if (filteredClairvoyantEffects.length !== clairvoyantEffects.length) {
      setRuntimeValue('campaign', 'targetEffects', filteredClairvoyantEffects, campaignName, true)
    }

    // Clear Pass Without Trace on short rest
    const pwtEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredPwtEffects = pwtEffects.filter(e => e.effect !== 'pass_without_trace_bonus');
    if (filteredPwtEffects.length !== pwtEffects.length) {
      setRuntimeValue('campaign', 'targetEffects', filteredPwtEffects, campaignName, true)
    }

    // Clear Blur on short rest
    const blurEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredBlurEffects = blurEffects.filter(e => e.effect !== 'blur');
    if (filteredBlurEffects.length !== blurEffects.length) {
      setRuntimeValue('campaign', 'targetEffects', filteredBlurEffects, campaignName, true)
    }

    // Clear Regenerate on short rest
    const regenEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredRegenEffects = regenEffects.filter(e => e.effect !== 'regenerate');
    if (filteredRegenEffects.length !== regenEffects.length) {
      setRuntimeValue('campaign', 'targetEffects', filteredRegenEffects, campaignName, true)
    }

    // Clear Beacon of Hope on short rest
    const beaconEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredBeaconEffects = beaconEffects.filter(e => e.effect !== 'beacon_of_hope');
    if (filteredBeaconEffects.length !== beaconEffects.length) {
      setRuntimeValue('campaign', 'targetEffects', filteredBeaconEffects, campaignName, true)
    }

    // Clear Resistance on short rest
    const resEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredResEffects = resEffects.filter(e => e.effect !== 'resistance_damage_reduction');
    if (filteredResEffects.length !== resEffects.length) {
      setRuntimeValue('campaign', 'targetEffects', filteredResEffects, campaignName, true)
    }

    // Clear Barkskin on short rest
    const barkskinEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredBarkskinEffects = barkskinEffects.filter(e => e.effect !== 'barkskin');
    if (filteredBarkskinEffects.length !== barkskinEffects.length) {
      setRuntimeValue('campaign', 'targetEffects', filteredBarkskinEffects, campaignName, true)
    }

    // Clear Enhance Ability on short rest
    const enhanceAbilityEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredEnhanceAbilityEffects = enhanceAbilityEffects.filter(e => e.effect !== 'enhance_ability');
    if (filteredEnhanceAbilityEffects.length !== enhanceAbilityEffects.length) {
      setRuntimeValue('campaign', 'targetEffects', filteredEnhanceAbilityEffects, campaignName, true)
    }

    // Clear Circle of Power on short rest
    const circleOfPowerEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const filteredCircleOfPowerEffects = circleOfPowerEffects.filter(e => e.effect !== 'circle_of_power');
    if (filteredCircleOfPowerEffects.length !== circleOfPowerEffects.length) {
      setRuntimeValue('campaign', 'targetEffects', filteredCircleOfPowerEffects, campaignName, true)
    }

    // Clear regenerateActive flag from all targets and set them to full HP
    const { getAllStoreKeys } = await import('../../../hooks/runtime/useRuntimeState.js')
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

  setRuntimeValue(name, 'resistanceUsedThisTurn', null, campaignName)
  clearAllExpirationEffects(name, campaignName)
  clearHuntersMarkConcentration(name, campaignName)
  clearAllConcentrations(campaignName, name)

  // Clear Invisibility buff and condition (not managed by expiration system)
  const invisKey = `_activeInvisibility_${name}`
  const invisCaster = getRuntimeValue('campaign', invisKey, campaignName)
  if (invisCaster) {
    endInvisibility(name, campaignName, 'target finished a rest')
    setRuntimeValue('campaign', invisKey, null, campaignName)
  }

  // Clear Greater Invisibility buff and condition (not managed by expiration system)
  const greaterInvisKey = `_activeGreaterInvisibility_${name}`
  const greaterInvisCaster = getRuntimeValue('campaign', greaterInvisKey, campaignName)
  if (greaterInvisCaster) {
    endGreaterInvisibility(name, campaignName, 'target finished a rest')
    setRuntimeValue('campaign', greaterInvisKey, null, campaignName)
  }

  return { celestialResilienceAllies }
}
