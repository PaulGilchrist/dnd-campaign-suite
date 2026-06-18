
import { getClassFeatures } from '../character/classFeatures.js'

export const ALL_TRACKED_RESOURCES = [
  'currentHitPoints',
  'hitPoints',
  'sorceryPoints',
  'innateSorceryUses',
  'focusPoints',
  'kiPoints',
  'channelDivinityCharges',
  'bardicInspirationUses',
  'wildShapeUses',
  'secondWindUses',
  'secondwindUses',
  'actionSurgeUses',
  'actionsurgeUses',
  'ragePoints',
  'layOnHandsPool',
  'superiorityDice',
  'psionicEnergy',
  'arcaneRecoveryLevels',
  'warlockPactMagic',
  'sorcerousRestorationUses',
  'uncannymetabolismUses',
  'rageOfTheGodsUses',
  'warPriestUses',
  'luckyPoints',
  'divineInterventionUses',
  'wholenessofbodyUses',
  'shortRestHitDice',
  'spell_slots_level_1',
  'spell_slots_level_2',
  'spell_slots_level_3',
  'spell_slots_level_4',
  'spell_slots_level_5',
  'spell_slots_level_6',
  'spell_slots_level_7',
  'spell_slots_level_8',
  'spell_slots_level_9',
]

const SPELL_SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function computeTrackedResources(playerStats) {
  if (!playerStats) return {}
  const features = getClassFeatures(playerStats)
  const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level)
  const resources = {}

  const storedHp = playerStats.hitPoints;
  if (storedHp == null) {
    console.error(`[trackedResources] hitPoints missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const hitPoints = storedHp || 0
  resources.hitPoints = { current: hitPoints, max: hitPoints }
  resources.currentHitPoints = { current: hitPoints, max: hitPoints }

  for (const level of SPELL_SLOT_LEVELS) {
    const key = `spell_slots_level_${level}`
    const storedSpellSlot = playerStats.spellAbilities?.[key];
    if (storedSpellSlot == null) {
      console.error(`[trackedResources] spellAbilities[${key}] missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
    }
    const spellSlot = storedSpellSlot ?? 0;
    const max = spellSlot;
    resources[key] = { current: max, max }
  }

  const storedLevel = playerStats.level;
  if (storedLevel == null) {
    console.error(`[trackedResources] level missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const level = storedLevel || 0;
  const shortRestHitDice = level
  resources.shortRestHitDice = { current: shortRestHitDice, max: shortRestHitDice }

  const storedMaxSP = features?.maxSorceryPoints;
  if (storedMaxSP == null) {
    console.error(`[trackedResources] maxSorceryPoints missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const maxSP = storedMaxSP || 0
  resources.sorceryPoints = { current: maxSP, max: maxSP }

  const storedMaxIS = features?.maxInnateSorcery;
  if (storedMaxIS == null) {
    console.error(`[trackedResources] maxInnateSorcery missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const maxIS = storedMaxIS || 0
  resources.innateSorceryUses = { current: maxIS, max: maxIS }

  const storedFocus = classLevel?.focus_points || features?.maxFocusPoints;
  if (storedFocus == null) {
    console.error(`[trackedResources] focus_points missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const maxFP = storedFocus || 0
  resources.focusPoints = { current: maxFP, max: maxFP }
  resources.kiPoints = { current: maxFP, max: maxFP }

  const storedMaxCD = features?.maxChannelDivinity;
  if (storedMaxCD == null) {
    console.error(`[trackedResources] maxChannelDivinity missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const maxCD = storedMaxCD || 0
  resources.channelDivinityCharges = { current: maxCD, max: maxCD }

  const storedCharisma = playerStats.abilities?.find(a => a.name === 'Charisma');
  if (storedCharisma == null) {
    console.error(`[trackedResources] Charisma ability missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const charisma = storedCharisma;
  const storedChaBonus = charisma?.bonus;
  if (storedChaBonus == null) {
    console.error(`[trackedResources] Charisma bonus missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const chaBonus = storedChaBonus || 0;
  const maxBI = chaBonus
  resources.bardicInspirationUses = { current: maxBI, max: maxBI }

  const storedMaxWS = features?.maxWildShapeUses;
  if (storedMaxWS == null) {
    console.error(`[trackedResources] maxWildShapeUses missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const maxWS = storedMaxWS || 0
  resources.wildShapeUses = { current: maxWS, max: maxWS }

  const storedSW = classLevel?.second_wind;
  if (storedSW == null) {
    console.error(`[trackedResources] second_wind missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const maxSW = storedSW || 0
  resources.secondWindUses = { current: maxSW, max: maxSW }
  resources.secondwindUses = { current: maxSW, max: maxSW }

  const is2024 = playerStats.rules === '2024'
  const isFighter = playerStats.class?.name === 'Fighter'
  let maxAS = 0
  if (isFighter) {
    if (is2024) {
      maxAS = playerStats.level >= 17 ? 2 : (playerStats.level >= 2 ? 1 : 0)
    } else {
      const storedAS = classLevel?.class_specific?.action_surges;
      if (storedAS == null) {
        console.error(`[trackedResources] action_surges missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
      }
      maxAS = storedAS || 0
    }
  }
  resources.actionSurgeUses = { current: maxAS, max: maxAS }
  resources.actionsurgeUses = { current: maxAS, max: maxAS }

  const isBarbarian = playerStats.class?.name === 'Barbarian'
  let maxRage = 0
  if (isBarbarian) {
    const storedRages = classLevel?.rages;
    if (storedRages == null) {
      console.error(`[trackedResources] rages missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
    }
    const storedRageCount = classLevel?.class_specific?.rage_count;
    if (storedRageCount == null) {
      console.error(`[trackedResources] rage_count missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
    }
    maxRage = is2024
      ? (storedRages || 0)
      : (storedRageCount || 0)
  }
  resources.ragePoints = { current: maxRage, max: maxRage }

  const isPaladin = playerStats.class?.name === 'Paladin'
  const maxLoH = isPaladin ? (5 * (playerStats.level || 0)) : 0
  resources.layOnHandsPool = { current: maxLoH, max: maxLoH }

  let maxSD = 0
  if (isFighter) {
    const storedMajorName = playerStats.class.major?.name;
    if (storedMajorName == null) {
      console.error(`[trackedResources] class.major.name missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
    }
    const storedSubclassName = playerStats.class.subclass?.name;
    if (storedSubclassName == null) {
      console.error(`[trackedResources] class.subclass.name missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
    }
    const majorName = storedMajorName || storedSubclassName;
    const isBattleMaster = majorName === 'Battle Master'
    if (isBattleMaster) {
      maxSD = is2024 ? 4 : (playerStats.level >= 15 ? 6 : (playerStats.level >= 7 ? 5 : 4))
    }
  }
  resources.superiorityDice = { current: maxSD, max: maxSD }

  const storedMajorName2 = playerStats.class.major?.name;
  if (storedMajorName2 == null) {
    console.error(`[trackedResources] class.major.name missing for energy check (${playerStats.name || 'unknown'})`, { stack: new Error().stack });
  }
  const storedSubclassName2 = playerStats.class.subclass?.name;
  if (storedSubclassName2 == null) {
    console.error(`[trackedResources] class.subclass.name missing for energy check (${playerStats.name || 'unknown'})`, { stack: new Error().stack });
  }
  const className = storedMajorName2 || storedSubclassName2;
  const hasEnergy = classLevel?.energy && classLevel.energy.required_major === className
  const storedEnergyDieNum = classLevel?.energy?.energy_die_num;
  if (storedEnergyDieNum == null) {
    console.error(`[trackedResources] energy_die_num missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const maxPE = hasEnergy ? (storedEnergyDieNum || 0) : 0
  resources.psionicEnergy = { current: maxPE, max: maxPE }

  const storedAR = features?.arcaneRecoveryLevels;
  if (storedAR == null) {
    console.error(`[trackedResources] arcaneRecoveryLevels missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const maxAR = storedAR || 0
  resources.arcaneRecoveryLevels = { current: maxAR, max: maxAR }

  const isWarlock = playerStats.class?.name === 'Warlock'
  let maxPM = 0
  if (isWarlock) {
    const storedPactLevels = classLevel?.pact_slot_levels;
    if (storedPactLevels == null) {
      console.error(`[trackedResources] pact_slot_levels missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
    }
    const storedPactSlots = classLevel?.class_specific?.pact_slots;
    if (storedPactSlots == null) {
      console.error(`[trackedResources] pact_slots missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
    }
    maxPM = is2024
      ? (storedPactLevels || 0)
      : (storedPactSlots || 0)
  }
  resources.warlockPactMagic = { current: maxPM, max: maxPM }

  const storedPassives = playerStats.automation?.passives;
  if (storedPassives == null) {
    console.error(`[trackedResources] automation.passives missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const hasRestoration = (storedPassives || [])
    .some(a => a.type === 'resource_restoration')
  resources.sorcerousRestorationUses = { current: hasRestoration ? 1 : 0, max: hasRestoration ? 1 : 0 }

  const storedUM = features?.uncannymetabolismUses;
  if (storedUM == null) {
    console.error(`[trackedResources] uncannymetabolismUses missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const maxUM = (storedUM || 0)
  resources.uncannymetabolismUses = { current: maxUM, max: maxUM }

  const isLucky = (playerStats.feats || []).some(f =>
    f.name?.toLowerCase().includes('lucky')
  )
  const storedLevel2 = playerStats.level;
  if (storedLevel2 == null) {
    console.error(`[trackedResources] level missing for lucky points (${playerStats.name || 'unknown'})`, { stack: new Error().stack });
  }
  const level2 = storedLevel2 || 0;
  const maxLP = isLucky ? (3 + Math.floor(level2 / 2)) : 0
  resources.luckyPoints = { current: maxLP, max: maxLP }

  const isCleric = playerStats.class?.name === 'Cleric'
  const maxDI = isCleric && playerStats.level >= 10 ? 1 : 0
  resources.divineInterventionUses = { current: maxDI, max: maxDI }

  const isMonk = playerStats.class?.name === 'Monk'
  const maxWB = isMonk && playerStats.level >= 6 ? 1 : 0
  resources.wholenessofbodyUses = { current: maxWB, max: maxWB }

  const storedWis = playerStats.abilities?.find(a => a.name === 'Wisdom');
  if (storedWis == null) {
    console.error(`[trackedResources] Wisdom ability missing for ${playerStats.name || 'unknown'}`, { stack: new Error().stack });
  }
  const wis = storedWis;
  const maxWP = wis ? Math.max(wis.bonus, 1) : 1
  resources.warPriestUses = { current: maxWP, max: maxWP }

  return resources
}

export function applyServerOverride(computedResources, serverData) {
  if (!serverData || typeof serverData !== 'object') return { ...computedResources }
  const merged = { ...computedResources }
  for (const [key, serverValue] of Object.entries(serverData)) {
    if (key in merged) {
      if (serverValue != null) {
        merged[key] = { ...merged[key], current: serverValue }
      }
    } else if (ALL_TRACKED_RESOURCES.includes(key)) {
      if (serverValue != null) {
        merged[key] = { current: serverValue, max: serverValue }
      }
    }
  }
  return merged
}

export function trackedResourcesToStoreEntries(trackedResources) {
  const entries = {}
  for (const [key, { current }] of Object.entries(trackedResources)) {
    entries[key] = current
  }
  return entries
}
