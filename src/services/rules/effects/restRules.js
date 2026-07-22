import { getLevelAfterLongRest } from '../../combat/conditions/exhaustionRules.js'
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'
import { rollD20 } from '../../../services/dice/diceRoller.js'
import * as storageService from '../../../services/ui/storage.js'
import { getCombatSummary } from '../../../services/encounters/combatData.js'
import { clearAllConcentrations } from '../../../services/combat/concentration/concentrationService.js'
import { addEntry } from '../../../services/ui/logService.js'
import { grantCelestialResilience } from '../../../services/automation/handlers/class-warlock/celestialResilienceHandler.js'

export function clearHuntersMarkConcentration(name, campaignName) {
  const cs = getCombatSummary(campaignName)
  if (!cs || !cs.creatures) return
  const creature = cs.creatures.find(c => c.name === name)
  if (creature && creature.concentration?.spell === "Hunter's Mark") {
    creature.concentration = null
    storageService.default.set('combatSummary', cs, campaignName)
    const existingBuffs = getRuntimeValue(name, 'activeBuffs') || []
    const filteredBuffs = Array.isArray(existingBuffs) ? existingBuffs.filter(b => b.name !== "Hunter's Mark") : []
    if (filteredBuffs.length !== existingBuffs.length) {
      setRuntimeValue(name, 'activeBuffs', filteredBuffs, campaignName)
    }
    window.dispatchEvent(new CustomEvent('combat-summary-updated'))
  }
}

export function getHitDieSize(playerStats) {
  const hitDieStr = playerStats?.class?.hit_point_die || playerStats?.class?.hit_die;

  if (hitDieStr != null) {
    const die = parseInt(String(hitDieStr).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(die)) return die;
   }

  return 8;
}

const SHORT_REST_RESOURCE_LABELS = [
    { key: 'channelDivinityCharges', label: 'Channel Divinity', classes: ['Cleric', 'Paladin'] },
    { key: 'wildShapeUses', label: 'Wild Shape', classes: ['Druid'] },
    { key: 'secondWindUses', label: 'Second Wind', classes: ['Fighter'] },
    { key: 'actionSurgeUses', label: 'Action Surge', classes: ['Fighter'] },
    { key: 'focusPoints', label: 'Focus Points', classes: ['Monk'] },
    { key: 'psionicEnergy', label: 'Psionic Energy', classes: ['Fighter'], subclasses: ['Psi Warrior'] },
    { key: 'psionicEnergy', label: 'Psionic Energy', classes: ['Rogue'], subclasses: ['Soulknife'] },
    { key: 'superiorityDice', label: 'Superiority Dice', classes: ['Fighter'], subclasses: ['Battle Master'] },
    { key: 'naturalRecoverySlots', label: 'Natural Recovery (Spell Slots)', classes: ['Druid'], subclasses: ['Circle of the Land'] },
    { key: 'arcaneRecoveryLevels', label: 'Arcane Recovery (Spell Slots)', classes: ['Wizard'] }
];

export function getShortRestResourceLabels(playerStats) {
    const className = playerStats?.class?.name;
    const subclassName = playerStats?.class?.subclass?.name || playerStats?.class?.major?.name;

    return SHORT_REST_RESOURCE_LABELS.filter(entry => {
        if (!entry.classes.includes(className)) return false;
        if (entry.subclasses && !entry.subclasses.includes(subclassName)) return false;
        return true;
       }).map(entry => entry.label);
}

export function computeHitDieRecovery(rollValue, conBonus) {
  return Math.max(1, rollValue + conBonus)
}

export function computeShortRestHpNewCurrent(currentHp, maxHp, recoveredAmount) {
  const base = currentHp != null && currentHp !== '' ? Number(currentHp) : maxHp
  return Math.min(maxHp, base + (recoveredAmount || 0))
}

export const SHORT_REST_RESOURCES = [
  'channelDivinityCharges',
  'wildShapeUses',
  'psionicEnergy',
  'focusPoints',
  'superiorityDice',
  'kiPoints',
  'actionsurgeUses',
  'actionSurgeUses',
  'actionSurgeUsedThisRound',
  'luckyPoints',
  'adrenalineRushUses',
  '_celestialRevelationUses',
  '_War_Gods_Blessing_active',
   'spellthiefUses',
   'strokeOfLuckUsed',
   'boonOfCombatProwessUsed'
]

export function getShortRestResources() {
  return [...SHORT_REST_RESOURCES]
}

export const LONG_REST_RESOURCES = [
  'healinghandsUses',
  'ragePoints',
  'bardicInspirationUses',
  'channelDivinityCharges',
  'wildShapeUses',
  'secondWindUses',
  'psionicEnergy',
  'focusPoints',
  'uncannymetabolismUses',
  'sorceryPoints',
  'arcaneRecoveryLevels',
  'superiorityDice',
  'kiPoints',
  'actionSurgeUses',
  'actionSurgeUsedThisRound',
   'layOnHandsPool',
   'preserveLifePool',
   'gloriousDefenseUses',
   'warlockPactMagic',
  'luckyPoints',
  'innateSorceryUses',
  'sorcerousRestorationUses',
  'zealousPresenceUses',
  'intimidatingPresenceUses',
  'rageOfTheGodsUses',
  'divineInterventionUses',
  'wholenessofbodyUses',
  'wildResurgenceReversedThisRest',
  'indomitableUses',
  'warriorofthegodsPool',
  'naturalRecoveryFreeCast',
  'naturalRecoveryFreeCastUsed',
  'naturalRecoverySlots',
  'wardingflareUses',
  '_Star_Map_freeCastCount',
  '_Dragon_Companion_freeCastCount',
  '_Contact_Patron_freeCastCount',
  'mysticArcanumLevel6',
  'mysticArcanumLevel7',
  'mysticArcanumLevel8',
  'mysticArcanumLevel9',
  '_Phantasmal_Creatures_freeCastCount',
   '_Fey_Reinforcements_freeCastCount',
    '_Misty_Wanderer_freeCastCount',
    "_Paladin's_Smite_freeCastCount",
       'breathweaponUses',
  'stonecunningUses',
  'naturesVeilUses',
  'favoredEnemyUses',
   'tirelessUses',
   'moonlightStepUses',
   'dreadambushUses',
   'cosmicomenUses',
      'relentlessrageUses',
      'persistentRageUsed',
       'aspectOfTheWildsUsedThisRest',
       'aspectOfTheWildsOption',
    'elderChampionRestUsed',
    'avengingAngelRestUsed',
  'warpingimplosionUses',
  'restorebalanceUses',
  'tranceOfOrderUses',
  'tamedSurgeUses',
    'featsOfChaosUses',
    'featsOfChaosActive',
    'magicalCunningUsed',
    '_Steps_of_the_Fey_freeCastCount',
    'beguilingDefensesUses',
    'healinglightPool',
    'searingvengeanceUses',
    'darkOnesLuckUses',
    '_fiendishResilienceUsed',
    'boonOfCombatProwessUsed',
    'strokeOfLuckUsed',
      '_boonOfEnergyResistanceUsedThisRest',
      '_Energy_Resistances_chosenTypes'
]

export function getLongRestResources() {
  return [...LONG_REST_RESOURCES]
}

export function spellSlotLevels() {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9]
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

  if (playerStats.class?.name === 'Fighter') {
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
          const toRecover = Math.min(available, maxSlotsToRecover - slotsRecovered)
          updates[slotKey] = current + toRecover
          slotsRecovered += toRecover
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
            const existingTempHp = Number(getRuntimeValue(name, 'tempHp', campaignName) || 0)
            updates.tempHp = Math.max(existingTempHp, selfTempHp)
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
   updates.activeBuffs = [];
   updates.activeConditions = [];
   updates.activeConditionMeta = {};

    // Clear Awakened Mind target on short rest
    updates.awakenedMindTarget = null;

    // Clear Clairvoyant Combatant target on short rest
    updates.clairvoyantCombatantTarget = null;
    updates.clairvoyantCombatantUses = null;

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
    const clairvoyantEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const filteredClairvoyantEffects = clairvoyantEffects.filter(e => e.effect !== 'clairvoyant_combatant');
    if (filteredClairvoyantEffects.length !== clairvoyantEffects.length) {
      setRuntimeValue(campaignName, 'targetEffects', filteredClairvoyantEffects, campaignName, true)
    }

  clearAllExpirationEffects(name, campaignName)
  clearHuntersMarkConcentration(name, campaignName)
  clearAllConcentrations(campaignName)

  return { celestialResilienceAllies }
}

export async function applyLongRest(playerStats, campaignName) {
  const name = playerStats.name

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
     charData.activeBuffs = [];
     charData.activeConditions = [];
     charData.activeConditionMeta = {};

      // Clear Awakened Mind target on long rest
      charData.awakenedMindTarget = null;

      // Clear Clairvoyant Combatant target on long rest
      charData.clairvoyantCombatantTarget = null;
      charData.clairvoyantCombatantUses = null;

     // Clear death save state on long rest
    charData.deathSaves = [false, false, false];
    charData.deathFailures = [false, false, false];
    charData.isDead = 0;

    // Clear Zealous Presence buff marker on long rest (recharges on long rest or rage expenditure)
    charData.zealousPresenceActive = null;

    // Clear Living Legend active state on long rest
    charData.livingLegendActive = null;
    charData.unerringStrikeUsed = null;

    // Clear Holy Nimbus active state on long rest
    charData.holyNimbusActive = null;

    // Clear Elder Champion active state on long rest
     charData.elderChampionActive = null;

    // Clear Avenging Angel active state on long rest
     charData.avengingAngelActive = null;

     // Clear Peerless Athlete active state on long rest
        charData.peerlessAthleteActive = null;

       // Clear Trance of Order active state on long rest
       charData.tranceOfOrderActive = null;

       // Clear Fanatical Focus used state on long rest (Barbarian feature, per long rest)
       charData.fanaticalFocusUsed = null;

       // Clear Wild Magic Surge badge on long rest
       charData.wildMagicSurgeEffects = null;

       // Clear Large Form active state and rest-used flag on long rest
       charData.largeFormActive = null;
       charData.largeFormActive_restUsed = null;

      // Clear Vow of Enmity active state on long rest
    charData.vowOfEnmityTarget = null;
    charData.vowOfEnmityCostPaid = null;
    const vowTarget = getRuntimeValue(name, 'vowOfEnmityTarget', campaignName);
    if (vowTarget) {
      const targetBuffs = getRuntimeValue(vowTarget, 'activeBuffs', campaignName) || [];
      const filteredTargetBuffs = targetBuffs.filter(b => b.effect !== 'vow_of_enmity');
      await setRuntimeValue(vowTarget, 'activeBuffs', filteredTargetBuffs, campaignName);
    }

      const currentExhaustion = getRuntimeValue(name, 'exhaustionLevel')
   if (typeof currentExhaustion === 'number' && currentExhaustion > 0) {
     charData.exhaustionLevel = getLevelAfterLongRest(currentExhaustion)
         }

      // Grant Heroic Inspiration from Resourceful trait (Human 2024)
    const hasResourceful = playerStats.specialActions?.some(f => f.name === 'Resourceful')
   if (hasResourceful) {
     charData.hasInspiration = true
         }

   // Spell Thief: reset uses to 1 and clear blocked/stolen spell tracking on long rest
   const hasSpellThief = (playerStats.automation?.reactions ?? []).some(
     r => r.type === 'spell_thief'
   )
    if (hasSpellThief) {
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

        // Single atomic write fires ONE SSE event with the complete final state
    setRuntimeBatch(name, charData, campaignName)

    // Clear Clairvoyant Combatant effects from campaign targetEffects on long rest
    const clairvoyantEffects = getRuntimeValue(campaignName, 'targetEffects') || [];
    const filteredClairvoyantEffects = clairvoyantEffects.filter(e => e.effect !== 'clairvoyant_combatant');
    if (filteredClairvoyantEffects.length !== clairvoyantEffects.length) {
      setRuntimeValue(campaignName, 'targetEffects', filteredClairvoyantEffects, campaignName, true)
    }

    // Clear Wrath of the Sea badge on long rest
    setRuntimeValue(name, 'wrathOfTheSeaActive', null, campaignName, true)
    setRuntimeValue(name, 'wrathOfTheSeaDc', null, campaignName, true)
    setRuntimeValue(name, 'wrathOfTheSeaWisMod', null, campaignName, true)
    setRuntimeValue(name, 'wrathOfTheSeaSource', null, campaignName, true)

    // Natural Recovery: reset free cast tracking on long rest
    const hasNaturalRecovery = (playerStats.automation?.passives ?? []).some(
      p => p.type === 'natural_recovery'
    )
    if (hasNaturalRecovery) {
      charData.naturalRecoveryFreeCast = null
      charData.naturalRecoveryFreeCastUsed = null
      charData.naturalRecoverySlots = null
      charData._circleOfTheLandType = null
    }

    // Handle Greater Divine Intervention Wish cooldown (2d4 long rests) — must run AFTER batch reset
    const wishCooldown = getRuntimeValue(name, '_divineInterventionWishCooldown', campaignName)
    if (wishCooldown != null && Number(wishCooldown) > 0) {
      const newCooldown = Number(wishCooldown) - 1
      if (newCooldown <= 0) {
        setRuntimeValue(name, '_divineInterventionWishCooldown', 0, campaignName, true)
      } else {
        setRuntimeValue(name, '_divineInterventionWishCooldown', newCooldown, campaignName, true)
        setRuntimeValue(name, 'divineInterventionUses', -1, campaignName, true)
      }
    }

    clearAllExpirationEffects(name, campaignName)
    clearHuntersMarkConcentration(name, campaignName)
    clearAllConcentrations(campaignName)

      // Reset Psionic Strike once-per-turn flag on long rest
     setRuntimeValue(name, 'psionicStrikeUsedThisTurn', null, campaignName, true)

    // Reset Uncanny Metabolism tracking on long rest
    setRuntimeValue(name, 'uncannyMetabolismUsed', false, campaignName, true)

    // Clear Elemental Attunement active state on long rest
    setRuntimeValue(name, 'elementalAttunementActive', null, campaignName, true)
    setRuntimeValue(name, 'elementalAttunementElement', null, campaignName, true)

    // Clear Elemental Epitome active state on long rest
    setRuntimeValue(name, 'elementalEpitomeActive', null, campaignName, true)
    setRuntimeValue(name, 'epitomeResistanceType', null, campaignName, true)
    setRuntimeValue(name, 'epitomeEmpoweredUsedRound', null, campaignName, true)
    setRuntimeValue(name, 'destructiveStrideActive', null, campaignName, true)
    setRuntimeValue(name, 'destructiveStrideDamageType', null, campaignName, true)

    // Reset Boon Of Energy Resistance chosen types on long rest
    setRuntimeValue(name, '_Energy_Resistances_chosenTypes', null, campaignName, true)

    // Reset Undying Sentinel (Oath of Glory level 15) on long rest
    setRuntimeValue(name, 'undyingSentinelUsed', false, campaignName, true)

    // Reset Relentless Endurance (Orc race trait) on long rest
    setRuntimeValue(name, 'relentlessEnduranceUsed', false, campaignName, true)

    // Reset Signature Spells on long rest
    const selection = getRuntimeValue(name, 'SignatureSpells_selection', campaignName)
    if (selection && Array.isArray(selection)) {
      for (const spell of selection) {
        setRuntimeValue(name, `SignatureSpells_${spell.replace(/\s+/g, '_')}_used`, null, campaignName, true)
      }
    }

    // Celestial Resilience: Grant temp HP on long rest for Celestial Patron
    let celestialResilienceAllies = null;
     if (playerStats.class?.major?.name === 'Celestial Patron' || playerStats.class?.subclass?.name === 'Celestial Patron') {
       const features = playerStats.specialActions || []
          const feature = features.find(f => f.name === 'Celestial Resilience')
         if (feature) {
            if (playerStats.level == null) {
              console.error('[restRules] applyLongRest: playerStats.level is missing for celestial patron temp HP')
              throw new Error('playerStats.level is required for celestial patron temp HP')
            }
            const warlockLevel = playerStats.level
            const chaMod = (playerStats.abilities || []).find(a => a.name === 'Charisma')?.bonus || 0
            const selfTempHp = warlockLevel + chaMod
            if (selfTempHp > 0) {
              const existingTempHp = Number(getRuntimeValue(name, 'tempHp', campaignName) || 0)
              setRuntimeValue(name, 'tempHp', Math.max(existingTempHp, selfTempHp), campaignName, true)
              addEntry(campaignName, {
                type: 'ability_use',
                characterName: name,
                abilityName: 'Celestial Resilience',
                description: `${name} gains ${selfTempHp} temporary hit points from Celestial Resilience (long rest).`,
                timestamp: Date.now(),
           }).catch((e) => { console.error('[celestialResilience] Error:', e); });

           // Gather allies for modal
           const combatSummary = getCombatSummary(campaignName);
           if (combatSummary) {
             const celestialResult = await grantCelestialResilience(playerStats, campaignName, 'long_rest');
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

        // Reset Bastion of Law ward on long rest
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

    // Reset Arcane Ward on long rest
    setRuntimeValue(name, 'arcaneWardActive', false, campaignName, true)
    setRuntimeValue(name, 'arcaneWardHp', 0, campaignName, true)
    setRuntimeValue(name, 'arcaneWardMax', 0, campaignName, true)

    // Refresh Portent dice on long rest
    const hasPortent = (playerStats.automation?.specialActions ?? []).some(
      a => a.type === 'portent' || a.name === 'Portent'
    )
    if (hasPortent) {
      const maxDice = playerStats.level >= 14 ? 3 : 2
      const dice = []
      for (let i = 0; i < maxDice; i++) {
        dice.push(rollD20())
      }
      setRuntimeValue(name, 'portentDice', JSON.stringify(dice), campaignName, true)
    }

    // Reset Phantasmal Creatures free cast on long rest
    const hasPhantasmalCreatures = (playerStats.automation?.passives ?? []).some(
      p => p.type === 'phantasmal_creatures'
    )
    if (hasPhantasmalCreatures) {
      setRuntimeValue(name, '_Phantasmal_Creatures_freeCastCount', null, campaignName, true)
      setRuntimeValue(name, '_phantasmalCreatures_list', [], campaignName, true)
    }

    // Reset Favored Enemy free cast count on long rest
    setRuntimeValue(name, '_Favored_Enemy_freeCastCount', null, campaignName, true)

    // Reset Stonecunning uses on long rest
    setRuntimeValue(name, 'stonecunningUses', null, campaignName, true)
    setRuntimeValue(name, 'stonecunningRestTimestamp', null, campaignName, true)

    // Reset Hurl Through Hell uses on long rest
    setRuntimeValue(name, 'hurlThroughHellUses', null, campaignName, true)
    setRuntimeValue(name, 'hurlThroughHellTurnUsed', null, campaignName, true)

    // Reset Adrenaline Rush uses on long rest
    setRuntimeValue(name, 'adrenalineRushUses', null, campaignName, true)
    setRuntimeValue(name, 'adrenalineRushRestTimestamp', null, campaignName, true)

    // Reset Giant Ancestry uses on long rest
    setRuntimeValue(name, 'cloudsJauntUses', null, campaignName, true)
    setRuntimeValue(name, 'firesBurnUses', null, campaignName, true)
    setRuntimeValue(name, 'frostsChillUses', null, campaignName, true)
    setRuntimeValue(name, 'hillsTumbleUses', null, campaignName, true)
    setRuntimeValue(name, 'stonesEnduranceUses', null, campaignName, true)
    setRuntimeValue(name, 'stormsThunderUses', null, campaignName, true)

    // Reset Overchannel use count on long rest
    setRuntimeValue(name, 'Overchannel_useCount', 0, campaignName, true)

    // Reset Hunter's Prey choice on long rest
    setRuntimeValue(name, "_Hunter's_Prey_choice", null, campaignName, true)

    // Reset Hunter's Prey choice on long rest
    setRuntimeValue(name, "_Hunter's_Prey_choice", null, campaignName, true)

    // Chef: Bolstering Treats crafted on Long Rest
    const hasBolsteringTreats = (playerStats.automation?.passives ?? []).some(
        p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats'
    )
    if (hasBolsteringTreats) {
        const craftCount = playerStats.proficiency || 0
        setRuntimeValue(name, 'chefBolsteringTreats', craftCount, campaignName, true)
    }

    // Log long rest to campaign log
    const logEntries = [];
    logEntries.push(`${name} takes a long rest.`);
    const resources = [];
    resources.push('All hit dice restored');
    resources.push('All spell slots restored');
    if (playerStats.class?.name === 'Warlock') resources.push('Pact Magic (Warlock spell slots)');
    if (hasPortent) resources.push('Portent dice');
    if (hasBolsteringTreats) resources.push('Bolstering Treats');
    const hasCelestialResilience = playerStats.class?.major?.name === 'Celestial Patron' || playerStats.class?.subclass?.name === 'Celestial Patron';
    if (hasCelestialResilience && playerStats.specialActions?.some(f => f.name === 'Celestial Resilience')) resources.push('Celestial Resilience (temp HP)');
    if (hasNaturalRecovery) resources.push('Natural Recovery (spell slots)');
    if (playerStats.class?.name === 'Warlock') resources.push('Magical Cunning (feature reset)');
    if (resources.length > 0) {
        logEntries.push(`Resources restored: ${resources.join(', ')}`);
    }
    if (typeof currentExhaustion === 'number' && currentExhaustion > 0) {
        const newExhaustion = getLevelAfterLongRest(currentExhaustion);
        logEntries.push(`Exhaustion: ${currentExhaustion} → ${newExhaustion}`);
    }

    // Circle of the Stars: Star Map free cast count on Long Rest (reset to WIS modifier, min 1)
    const isDruid = playerStats.class?.name === 'Druid'
    const isCircleOfTheStars = playerStats.class?.major?.name === 'Circle of the Stars' || playerStats.class?.subclass?.name === 'Circle of the Stars'
    if (isDruid && isCircleOfTheStars && playerStats.level >= 3) {
        const wis = playerStats.abilities?.find(a => a.name === 'Wisdom')
        const maxUses = Math.max(wis?.bonus || 0, 1)
        setRuntimeValue(name, '_Star_Map_freeCastCount', maxUses, campaignName, true)
        logEntries.push(`Star Map free casts: ${maxUses}`)
    }

    // Circle of the Stars: Cosmic Omen Star Map roll on Long Rest
    const isDruid2 = playerStats.class?.name === 'Druid'
    const isCircleOfTheStars2 = playerStats.class?.major?.name === 'Circle of the Stars' || playerStats.class?.subclass?.name === 'Circle of the Stars'
    if (isDruid2 && isCircleOfTheStars2 && playerStats.level >= 6) {
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
    try {
        addEntry(campaignName, { type: 'long_rest', message: logEntries.join(' | ') });
    } catch (err) {
        console.error('[restRules] Failed to log long rest:', err.message);
    }

    return { celestialResilienceAllies }
}
