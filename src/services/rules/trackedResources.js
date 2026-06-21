
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
  'arcaneWardHp',
  'arcaneWardMax',
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

  const hitPoints = playerStats.hitPoints || 0
  resources.hitPoints = { current: hitPoints, max: hitPoints }
  resources.currentHitPoints = { current: hitPoints, max: hitPoints }

  for (const level of SPELL_SLOT_LEVELS) {
    const key = `spell_slots_level_${level}`
    const max = playerStats.spellAbilities?.[key] ?? 0
    resources[key] = { current: max, max }
  }

  const shortRestHitDice = playerStats.level || 0
  resources.shortRestHitDice = { current: shortRestHitDice, max: shortRestHitDice }

  const maxSP = features?.maxSorceryPoints || 0
  resources.sorceryPoints = { current: maxSP, max: maxSP }

  const maxIS = features?.maxInnateSorcery || 0
  resources.innateSorceryUses = { current: maxIS, max: maxIS }

  const maxFP = classLevel?.focus_points || features?.maxFocusPoints || 0
  resources.focusPoints = { current: maxFP, max: maxFP }
  resources.kiPoints = { current: maxFP, max: maxFP }

  const maxCD = features?.maxChannelDivinity || 0
  resources.channelDivinityCharges = { current: maxCD, max: maxCD }

  const charisma = playerStats.abilities?.find(a => a.name === 'Charisma')
  const maxBI = charisma?.bonus || 0
  resources.bardicInspirationUses = { current: maxBI, max: maxBI }

  const maxWS = features?.maxWildShapeUses || 0
  resources.wildShapeUses = { current: maxWS, max: maxWS }

  const maxSW = classLevel?.second_wind || 0
  resources.secondWindUses = { current: maxSW, max: maxSW }
  resources.secondwindUses = { current: maxSW, max: maxSW }

  const is2024 = playerStats.rules === '2024'
  const isFighter = playerStats.class?.name === 'Fighter'
  let maxAS = 0
  if (isFighter) {
    if (is2024) {
      maxAS = playerStats.level >= 17 ? 2 : (playerStats.level >= 2 ? 1 : 0)
    } else {
      maxAS = classLevel?.class_specific?.action_surges || 0
    }
  }
  resources.actionSurgeUses = { current: maxAS, max: maxAS }
  resources.actionsurgeUses = { current: maxAS, max: maxAS }

  const isBarbarian = playerStats.class?.name === 'Barbarian'
  let maxRage = 0
  if (isBarbarian) {
    maxRage = is2024
      ? (classLevel?.rages || 0)
      : (classLevel?.class_specific?.rage_count || 0)
  }
  resources.ragePoints = { current: maxRage, max: maxRage }

  const isPaladin = playerStats.class?.name === 'Paladin'
  const maxLoH = isPaladin ? (5 * (playerStats.level || 0)) : 0
  resources.layOnHandsPool = { current: maxLoH, max: maxLoH }

  let maxSD = 0
  if (isFighter) {
    const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name
    const isBattleMaster = majorName === 'Battle Master'
    if (isBattleMaster) {
      maxSD = is2024 ? 4 : (playerStats.level >= 15 ? 6 : (playerStats.level >= 7 ? 5 : 4))
    }
  }
  resources.superiorityDice = { current: maxSD, max: maxSD }

  const hasEnergy = classLevel?.energy && classLevel.energy.required_major
    === (playerStats.class.major?.name || playerStats.class.subclass?.name)
  const maxPE = hasEnergy ? (classLevel?.energy?.energy_die_num || 0) : 0
  resources.psionicEnergy = { current: maxPE, max: maxPE }

  const maxAR = features?.arcaneRecoveryLevels || 0
  resources.arcaneRecoveryLevels = { current: maxAR, max: maxAR }

  const isWizard = playerStats.class?.name === 'Wizard'
  let maxWard = 0
  if (isWizard) {
    const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0
    maxWard = (2 * playerStats.level) + intMod
  }
  resources.arcaneWardMax = { current: maxWard, max: maxWard }
  resources.arcaneWardHp = { current: 0, max: maxWard }

  const isWarlock = playerStats.class?.name === 'Warlock'
  let maxPM = 0
  if (isWarlock) {
    maxPM = is2024
      ? (classLevel?.pact_slot_levels || 0)
      : (classLevel?.class_specific?.pact_slots || 0)
  }
  resources.warlockPactMagic = { current: maxPM, max: maxPM }

  const hasRestoration = (playerStats.automation?.passives ?? [])
    .some(a => a.type === 'resource_restoration')
  resources.sorcerousRestorationUses = { current: hasRestoration ? 1 : 0, max: hasRestoration ? 1 : 0 }

  const maxUM = (features?.uncannymetabolismUses || 0)
  resources.uncannymetabolismUses = { current: maxUM, max: maxUM }

  const isLucky = (playerStats.feats || []).some(f =>
    f.name?.toLowerCase().includes('lucky')
  )
  const maxLP = isLucky ? (3 + Math.floor((playerStats.level || 0) / 2)) : 0
  resources.luckyPoints = { current: maxLP, max: maxLP }

  const isCleric = playerStats.class?.name === 'Cleric'
  const maxDI = isCleric && playerStats.level >= 10 ? 1 : 0
  resources.divineInterventionUses = { current: maxDI, max: maxDI }

  const isMonk = playerStats.class?.name === 'Monk'
  const maxWB = isMonk && playerStats.level >= 6 ? 1 : 0
  resources.wholenessofbodyUses = { current: maxWB, max: maxWB }

  const wis = playerStats.abilities?.find(a => a.name === 'Wisdom')
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
