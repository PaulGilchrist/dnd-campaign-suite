import { getLevelAfterLongRest } from '../../combat/conditions/exhaustionRules.js'
import { getRuntimeValue, setRuntimeBatch, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'
import { rollD20 } from '../../../services/dice/diceRoller.js'

export function getHitDieSize(playerStats) {
  const storedHitDie = playerStats?.class?.hit_point_die || playerStats?.class?.hit_die;
  if (storedHitDie == null) {
    console.error(`[restRules] hit_point_die/hit_die missing for ${playerStats?.name || 'unknown'}`, { stack: new Error().stack });
  }
  const hitDieStr = storedHitDie || 8;

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
    { key: 'superiorityDice', label: 'Superiority Dice', classes: ['Fighter'], subclasses: ['Battle Master'] },
    { key: 'naturalRecoverySlots', label: 'Natural Recovery (Spell Slots)', classes: ['Druid'], subclasses: ['Circle of the Land'] },
    { key: 'arcaneRecoveryLevels', label: 'Arcane Recovery (Spell Slots)', classes: ['Wizard'] }
];

export function getShortRestResourceLabels(playerStats) {
    const storedClassName = playerStats?.class?.name;
    if (storedClassName == null) {
        console.error(`[restRules] class.name missing for ${playerStats?.name || 'unknown'}`, { stack: new Error().stack });
    }
    const className = storedClassName;
    const storedSubclassName = playerStats?.class?.subclass?.name || playerStats?.class?.major?.name;
    if (storedSubclassName == null) {
        console.error(`[restRules] subclass.name/major.name missing for ${playerStats?.name || 'unknown'}`, { stack: new Error().stack });
    }
    const subclassName = storedSubclassName;

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
    'luckyPoints',
    'adrenalineRushUses'
]

export function getShortRestResources() {
  return [...SHORT_REST_RESOURCES]
}

export const LONG_REST_RESOURCES = [
      'ragePoints',
      'bardicInspirationUses',
      'channelDivinityCharges',
      'wildShapeUses',
      'secondwindUses',
      'psionicEnergy',
      'focusPoints',
      'uncannymetabolismUses',
      'sorceryPoints',
      'arcaneRecoveryLevels',
      'superiorityDice',
      'kiPoints',
      'actionsurgeUses',
      'layOnHandsPool',
      'warlockPactMagic',
      'luckyPoints',
      'innateSorceryUses',
      'sorcerousRestorationUses',
       'zealousPresenceUses',
       'rageOfTheGodsUses',
       'divineInterventionUses',
         'wholenessofbodyUses',
         'wildResurgenceReversedThisRest',
         'indomitableUses',
          'naturalRecoveryFreeCast',
          'naturalRecoverySlots',
          '_Signature_Spells_freeCastCount',
           '_Star_Map_freeCastCount',
           '_Dragon_Companion_freeCastCount',
            '_Contact_Patron_freeCastCount',
            '_Mystic_Arcanum_freeCastCount',
            '_Mystic_Arcanum_(level_7_spell)_freeCastCount',
            '_Mystic_Arcanum_(level_8_spell)_freeCastCount',
             '_Mystic_Arcanum_(level_9_spell)_freeCastCount',
            'magicalCunningUsed',
             '_Phantasmal_Creatures_freeCastCount',
              'breathWeaponUses',
               'stonecunningUses',
               'adrenalineRushUses'
       ]

export function getLongRestResources() {
  return [...LONG_REST_RESOURCES]
}

export function spellSlotLevels() {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9]
}

export async function applyShortRest(playerStats, campaignName) {
  const name = playerStats.name
  const storedHp = getRuntimeValue(name, 'currentHitPoints')
  const currentHp = computeShortRestHpNewCurrent(storedHp, playerStats.hitPoints, 0)

  const updates = { currentHitPoints: currentHp }
  for (const key of getShortRestResources()) {
    updates[key] = null
   }

  if (playerStats.class?.name === 'Fighter') {
    const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
    const storedSecondWind = classLevel?.second_wind;
    if (storedSecondWind == null) {
      console.error(`[restRules] second_wind missing for ${name}`, { stack: new Error().stack });
    }
    const maxSW = storedSecondWind || 0;
    const storedSecondWindUses = getRuntimeValue(name, 'secondWindUses', campaignName);
    if (storedSecondWindUses == null) {
      console.error(`[restRules] secondWindUses not tracked for ${name}`, { stack: new Error().stack });
    }
    const currentSW = Number(storedSecondWindUses ?? 0);
    if (currentSW < maxSW) {
      updates.secondWindUses = Math.min(maxSW, currentSW + 1);
    }
  }

  const hasImprovedWardingFlare = playerStats.characterAdvancement?.some(f => f.name === 'Improved Warding Flare')
  if (hasImprovedWardingFlare) {
    updates.wardingflareUses = null
  }

  const hasFontOfInspiration = (playerStats.automation?.passives ?? []).some(p => p.type === 'font_of_inspiration')
  if (hasFontOfInspiration) {
    const charisma = playerStats.abilities?.find(a => a.name === 'Charisma')
    const maxBI = charisma?.bonus || 0
    const currentBI = Number(getRuntimeValue(name, 'bardicInspirationUses', campaignName) ?? maxBI)
    if (currentBI < maxBI) {
      updates.bardicInspirationUses = maxBI
    }
  }

    // Natural Recovery: Druid Circle of the Land spell slot recovery on short rest
    const hasNaturalRecovery = (playerStats.automation?.passives ?? []).some(
      p => p.type === 'resource_restoration' && p.resourceKey === 'naturalRecoverySlots'
    )
    if (hasNaturalRecovery && playerStats.class?.name === 'Druid') {
      const storedLevel = playerStats.level;
      if (storedLevel == null) {
        console.error(`[restRules] level missing for ${playerStats?.name || 'unknown'}`, { stack: new Error().stack });
      }
      const druidLevel = storedLevel || 1
      const maxSlotsToRecover = Math.floor(druidLevel / 2)
      let slotsRecovered = 0
      const slotLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9]
      for (const level of slotLevels) {
        if (slotsRecovered >= maxSlotsToRecover) break
        const slotKey = `spell_slots_level_${level}`
        const storedSlotMax = playerStats.spellAbilities?.[slotKey];
        if (storedSlotMax == null) {
          console.error(`[restRules] spellAbilities[${slotKey}] missing for ${name}`, { stack: new Error().stack });
        }
        const max = storedSlotMax || 0;
        const storedSlotCurrent = getRuntimeValue(name, slotKey);
        if (storedSlotCurrent == null) {
          console.error(`[restRules] slot current not tracked for ${name} key=${slotKey}`, { stack: new Error().stack });
        }
        const current = Number(storedSlotCurrent ?? max)
        const available = max - current
        if (available > 0) {
          const toRecover = Math.min(available, maxSlotsToRecover - slotsRecovered)
          updates[slotKey] = current + toRecover
          slotsRecovered += toRecover
        }
      }
    }

    // Arcane Recovery: Wizard spell slot recovery on short rest
    const hasArcaneRecovery = (playerStats.automation?.passives ?? []).some(
      p => p.type === 'resource_restoration' && p.resourceKey === 'arcaneRecoveryLevels'
    )
    if (hasArcaneRecovery && playerStats.class?.name === 'Wizard') {
      const storedWizardLevel = playerStats.level;
      if (storedWizardLevel == null) {
        console.error(`[restRules] level missing for ${playerStats?.name || 'unknown'}`, { stack: new Error().stack });
      }
      const wizardLevel = storedWizardLevel || 1
      const maxSlotsToRecover = Math.ceil(wizardLevel / 2)
      let slotsRecovered = 0
      // Only recover slots level 5 and lower (no level 6+)
      const slotLevels = [1, 2, 3, 4, 5]
      for (const level of slotLevels) {
        if (slotsRecovered >= maxSlotsToRecover) break
        const slotKey = `spell_slots_level_${level}`
        const storedSlotMax = playerStats.spellAbilities?.[slotKey];
        if (storedSlotMax == null) {
          console.error(`[restRules] spellAbilities[${slotKey}] missing for ${name}`, { stack: new Error().stack });
        }
        const max = storedSlotMax || 0;
        const storedSlotCurrent = getRuntimeValue(name, slotKey);
        if (storedSlotCurrent == null) {
          console.error(`[restRules] slot current not tracked for ${name} key=${slotKey}`, { stack: new Error().stack });
        }
        const current = Number(storedSlotCurrent ?? max)
        const available = max - current
        if (available > 0) {
          const toRecover = Math.min(available, maxSlotsToRecover - slotsRecovered)
          updates[slotKey] = current + toRecover
          slotsRecovered += toRecover
        }
      }
    }

    // Signature Spells: Reset free cast count on short or long rest
    const hasSignatureSpells = (playerStats.automation?.actions ?? []).some(
      a => a.type === 'signature_spells'
    )
    if (hasSignatureSpells) {
      updates._Signature_Spells_freeCastCount = null
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
        const storedSlotMax = playerStats.spellAbilities?.[slotKey];
        if (storedSlotMax == null) {
          console.error(`[restRules] spellAbilities[${slotKey}] missing for ${name}`, { stack: new Error().stack });
        }
        const max = storedSlotMax || 0
        if (max > 0) {
          const storedSlotCurrent = getRuntimeValue(name, slotKey);
          if (storedSlotCurrent == null) {
            console.error(`[restRules] slot current not tracked for ${name} key=${slotKey}`, { stack: new Error().stack });
          }
          const current = Number(storedSlotCurrent ?? max)
          if (current < max) {
            updates[slotKey] = max
          }
        }
      }
    }

    // Chef: Bolstering Treats crafted on Short Rest (1 hour of work)
    const hasBolsteringTreats = (playerStats.automation?.passives ?? []).some(
        p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats'
    )
    if (hasBolsteringTreats) {
      const storedProficiency = playerStats.proficiency;
      if (storedProficiency == null) {
        console.error(`[restRules] proficiency missing for ${playerStats?.name || 'unknown'}`, { stack: new Error().stack });
      }
      const craftCount = storedProficiency || 0
      updates.chefBolsteringTreats = craftCount
    }

   // Celestial Resilience: Grant temp HP on short rest for Celestial Patron
   if (playerStats.class?.major?.name === 'Celestial Patron' || playerStats.class?.subclass?.name === 'Celestial Patron') {
     const features = playerStats.characterAdvancement || []
     const feature = features.find(f => f.name === 'Celestial Resilience')
     if (feature) {
        const storedLevel = playerStats.level;
        if (storedLevel == null) {
          console.error(`[restRules] level missing for ${playerStats?.name || 'unknown'}`, { stack: new Error().stack });
        }
        const warlockLevel = storedLevel || 0
        const storedCharismaBonus = (playerStats.abilities || []).find(a => a.name === 'Charisma')?.bonus;
        if (storedCharismaBonus == null) {
          console.error(`[restRules] Charisma bonus missing for ${playerStats?.name || 'unknown'}`, { stack: new Error().stack });
        }
        const chaMod = storedCharismaBonus || 0
        const selfTempHp = warlockLevel + chaMod
        if (selfTempHp > 0) {
          const storedTempHp = getRuntimeValue(name, 'tempHp', campaignName);
          if (storedTempHp == null) {
            console.error(`[restRules] tempHp not tracked for ${name}`, { stack: new Error().stack });
          }
          const existingTempHp = Number(storedTempHp || 0)
         updates.tempHp = existingTempHp + selfTempHp
       }
     }
   }

   // Clear active buffs and conditions as part of the atomic batch so SSE echo carries correct final state
   updates.activeBuffs = [];
   updates.activeConditions = [];

   setRuntimeBatch(name, updates, campaignName)

  clearAllExpirationEffects(name, campaignName)
}

export async function applyLongRest(playerStats, campaignName) {
  const name = playerStats.name

  const charData = {}

  charData.currentHitPoints = playerStats.hitPoints

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

  const hasImprovedWardingFlare = playerStats.characterAdvancement?.some(f => f.name === 'Improved Warding Flare')
  if (hasImprovedWardingFlare) {
    charData.wardingflareUses = null
  }

  // Clear active buffs and conditions as part of the atomic batch so SSE echo carries correct final state
  charData.activeBuffs = [];
  charData.activeConditions = [];

  const currentExhaustion = getRuntimeValue(name, 'exhaustionLevel')
  if (typeof currentExhaustion === 'number' && currentExhaustion > 0) {
    charData.exhaustionLevel = getLevelAfterLongRest(currentExhaustion)
        }

     // Grant Heroic Inspiration from Resourceful trait (Human 2024)
  const hasResourceful = playerStats.characterAdvancement?.some(f => f.name === 'Resourceful')
  if (hasResourceful) {
    charData.hasInspiration = true
        }

      // Single atomic write fires ONE SSE event with the complete final state
  setRuntimeBatch(name, charData, campaignName)

   // Natural Recovery: reset free cast tracking on long rest
   const hasNaturalRecovery = (playerStats.automation?.passives ?? []).some(
     p => p.type === 'resource_restoration' && p.resourceKey === 'naturalRecoverySlots'
   )
   if (hasNaturalRecovery) {
     charData.naturalRecoveryFreeCast = null
     charData.naturalRecoverySlots = null
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

    // Reset Uncanny Metabolism tracking on long rest
    setRuntimeValue(name, 'uncannyMetabolismUsed', false, campaignName, true)

    // Reset Undying Sentinel (Oath of Glory level 15) on long rest
    setRuntimeValue(name, 'undyingSentinelUsed', false, campaignName, true)

    // Reset Relentless Endurance (Orc race trait) on long rest
    setRuntimeValue(name, 'relentlessEnduranceUsed', false, campaignName, true)

    // Reset Signature Spells on long rest
    setRuntimeValue(name, '_Signature_Spells_freeCastCount', null, campaignName, true)

    // Celestial Resilience: Grant temp HP on long rest for Celestial Patron
     if (playerStats.class?.major?.name === 'Celestial Patron' || playerStats.class?.subclass?.name === 'Celestial Patron') {
        const features = playerStats.characterAdvancement || []
        const feature = features.find(f => f.name === 'Celestial Resilience')
        if (feature) {
          const storedLevel = playerStats.level;
          if (storedLevel == null) {
            console.error(`[restRules] level missing for ${playerStats?.name || 'unknown'}`, { stack: new Error().stack });
          }
          const warlockLevel = storedLevel || 0
          const storedCharismaBonus = (playerStats.abilities || []).find(a => a.name === 'Charisma')?.bonus;
          if (storedCharismaBonus == null) {
            console.error(`[restRules] Charisma bonus missing for ${playerStats?.name || 'unknown'}`, { stack: new Error().stack });
          }
          const chaMod = storedCharismaBonus || 0
          const selfTempHp = warlockLevel + chaMod
          if (selfTempHp > 0) {
            const storedTempHp = getRuntimeValue(name, 'tempHp', campaignName);
            if (storedTempHp == null) {
              console.error(`[restRules] tempHp not tracked for ${name}`, { stack: new Error().stack });
            }
            const existingTempHp = Number(storedTempHp || 0)
           setRuntimeValue(name, 'tempHp', existingTempHp + selfTempHp, campaignName, true)
         }
       }
     }

      // Reset Bastion of Law ward on long rest
    setRuntimeValue(name, 'bastionOfLawActive', false, campaignName, true)
    setRuntimeValue(name, 'bastionOfLawWardDice', [], campaignName, true)
    setRuntimeValue(name, 'bastionOfLawWardTarget', null, campaignName, true)

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

    // Reset Stonecunning uses on long rest
    setRuntimeValue(name, 'stonecunningUses', null, campaignName, true)
    setRuntimeValue(name, 'stonecunningRestTimestamp', null, campaignName, true)

    // Reset Adrenaline Rush uses on long rest
    setRuntimeValue(name, 'adrenalineRushUses', null, campaignName, true)
    setRuntimeValue(name, 'adrenalineRushRestTimestamp', null, campaignName, true)

    // Chef: Bolstering Treats crafted on Long Rest
    const hasBolsteringTreats = (playerStats.automation?.passives ?? []).some(
        p => p.type === 'temp_hp_buff' && p.name === 'Bolstering Treats'
    )
    if (hasBolsteringTreats) {
        const storedProficiency = playerStats.proficiency;
        if (storedProficiency == null) {
            console.error(`[restRules] proficiency missing for ${playerStats?.name || 'unknown'}`, { stack: new Error().stack });
        }
        const craftCount = storedProficiency || 0
        setRuntimeValue(name, 'chefBolsteringTreats', craftCount, campaignName, true)
    }
}
