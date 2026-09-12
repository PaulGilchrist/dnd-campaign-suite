
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
  'actionSurgeUsedThisRound',
  'ragePoints',
  'layOnHandsPool',
  'preserveLifePool',
  'gloriousDefenseUses',
  'superiorityDice',
  'psionicEnergy',
  'telekineticThrustUses',
  'arcaneRecoveryLevels',
  'naturalRecoverySlots',
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
  'adrenalineRushUses',
  'naturesVeilUses',
  'favoredEnemyUses',
  'stonecunningUses',
  'stonesEnduranceUses',
  'stormsThunderUses',
  'tirelessUses',
  'moonlightStepUses',
  'dreadambushUses',
  'cosmicomenUses',
  'tranceOfOrderUses',
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
  'tamedSurgeUses',
   'featsOfChaosUses',
   'mysticArcanumLevel6',
   'mysticArcanumLevel7',
   'mysticArcanumLevel8',
   'mysticArcanumLevel9',
   'isDead',
    '_Steps_of_the_Fey_freeCastCount',
    'healinglightPool',
 ]

const SPELL_SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// FS-010: single source of truth for a Fighter's superiority die COUNT.
// Battle Master → level-table dice; non-Battle-Master with the Superior
// Technique fighting style → exactly 1.
export function computeSuperiorityDiceMax(playerStats) {
  if (playerStats?.class?.name !== 'Fighter') return 0
  const is2024 = playerStats.rules === '2024'
  const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level)
  const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name
  if (majorName === 'Battle Master') {
    return is2024 ? (classLevel?.superiority_dice || 0) : (playerStats.level >= 15 ? 6 : (playerStats.level >= 7 ? 5 : 4))
  }
  if (playerStats.class.fightingStyles?.includes('Superior Technique')) return 1
  return 0
}

function addCoreResources(resources, { playerStats }) {
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
}

function addCasterResources(resources, { playerStats, features, classLevel }) {
  const maxSP = features?.maxSorceryPoints || 0
  resources.sorceryPoints = { current: maxSP, max: maxSP }

  const maxIS = features?.maxInnateSorcery || 0
  resources.innateSorceryUses = { current: maxIS, max: maxIS }

  const maxFP = classLevel?.focus_points || features?.maxFocusPoints || 0
  resources.focusPoints = { current: maxFP, max: maxFP }
  resources.kiPoints = { current: maxFP, max: maxFP }

  const maxAR = features?.arcaneRecoveryLevels || 0
  resources.arcaneRecoveryLevels = { current: maxAR, max: maxAR }

  const hasArcaneWard = playerStats.automation?.passives?.some(p => p.type === 'arcane_ward' || (p.type === 'passive_rule' && p.effect === 'arcane_ward'))
  let maxWard = 0
  if (hasArcaneWard) {
    const intMod = playerStats.abilities?.find(a => a.name === 'Intelligence')?.bonus || 0
    maxWard = (2 * playerStats.level) + intMod
  }
  resources.arcaneWardMax = { current: maxWard, max: maxWard }
  resources.arcaneWardHp = { current: maxWard, max: maxWard }
}

function resolveActionSurgeMax(playerStats, classLevel, is2024) {
  if (playerStats.class?.name !== 'Fighter') return 0
  if (!is2024) return classLevel?.class_specific?.action_surges || 0
  return playerStats.level >= 17 ? 2 : (playerStats.level >= 2 ? 1 : 0)
}

function resolveRageMax(playerStats, classLevel, is2024) {
  if (playerStats.class?.name !== 'Barbarian') return 0
  return is2024
    ? (classLevel?.rages || 0)
    : (classLevel?.class_specific?.rage_count || 0)
}

function resolvePsionicEnergyMax(classLevel, playerStats) {
  const majorName = playerStats.class.major?.name || playerStats.class.subclass?.name
  const hasEnergy = classLevel?.energy && classLevel.energy.required_major === majorName
  return hasEnergy ? (classLevel?.energy?.energy_die_num || 0) : 0
}

// CLA-355: Telekinetic Adept (Psi Warrior lv7) Telekinetic Thrust — once per
// Short or Long Rest (re-arm = null). One use until a rest re-arms it.
function resolveTelekineticThrustMax(playerStats) {
  const hasTelekineticThrust = (playerStats.automation?.reactions ?? [])
    .some(a => a.type === 'telekinetic_thrust')
  return hasTelekineticThrust ? 1 : 0
}

function resolveAdrenalineRushMax(playerStats) {
  const hasAdrenalineRush = (playerStats.automation?.specialActions ?? [])
    .some(a => a.effect === 'bonus_action_dash')
  return hasAdrenalineRush ? (playerStats.proficiency || 0) : 0
}

function addMartialResources(resources, { playerStats, classLevel, is2024 }) {
  const maxSW = classLevel?.second_wind || 0
  resources.secondWindUses = { current: maxSW, max: maxSW }
  resources.secondwindUses = { current: maxSW, max: maxSW }

  const maxAS = resolveActionSurgeMax(playerStats, classLevel, is2024)
  resources.actionSurgeUses = { current: maxAS, max: maxAS }
  resources.actionsurgeUses = { current: maxAS, max: maxAS }

  const maxRage = resolveRageMax(playerStats, classLevel, is2024)
  resources.ragePoints = { current: maxRage, max: maxRage }

  const maxSD = computeSuperiorityDiceMax(playerStats)
  resources.superiorityDice = { current: maxSD, max: maxSD }

  const maxPE = resolvePsionicEnergyMax(classLevel, playerStats)
  resources.psionicEnergy = { current: maxPE, max: maxPE }

  const maxTT = resolveTelekineticThrustMax(playerStats)
  resources.telekineticThrustUses = { current: maxTT, max: maxTT }

  const maxAR = resolveAdrenalineRushMax(playerStats)
  resources.adrenalineRushUses = { current: maxAR, max: maxAR }
}

function matchesPatron(playerStats, names) {
  return names.includes(playerStats.class?.major?.name) || names.includes(playerStats.class?.subclass?.name)
}

function addFiendBlessing(resources, { playerStats, isWarlock, charisma }) {
  const isFiendPatron = isWarlock && matchesPatron(playerStats, ['Fiend', 'Fiend Patron'])
  const maxDOL = isFiendPatron ? Math.max(1, charisma?.bonus || 0) : 0
  resources.darkOnesLuckUses = { current: maxDOL, max: maxDOL }
}

function arcanumPool(levelUses) {
  const value = levelUses || 0
  return { current: value, max: value }
}

function addPactAndArcanum(resources, { features, classLevel, is2024, isWarlock }) {
  const pactSlots = isWarlock
    ? (is2024 ? (classLevel?.pact_slot_levels || 0) : (classLevel?.class_specific?.pact_slots || 0))
    : 0
  resources.warlockPactMagic = { current: pactSlots, max: pactSlots }

  // Mystic Arcanum: one free cast per long rest for levels 6-9
  if (isWarlock && features?.arcanumLevels) {
    resources.mysticArcanumLevel6 = arcanumPool(features.arcanumLevels.level6)
    resources.mysticArcanumLevel7 = arcanumPool(features.arcanumLevels.level7)
    resources.mysticArcanumLevel8 = arcanumPool(features.arcanumLevels.level8)
    resources.mysticArcanumLevel9 = arcanumPool(features.arcanumLevels.level9)
  }
}

function addPatronPoolResources(resources, { playerStats, isWarlock, charisma }) {
  // Healing Light: Celestial Patron dice pool (1 + warlock level dice)
  const isCelestialPatron = isWarlock && matchesPatron(playerStats, ['Celestial Patron'])
  const maxHealingLight = isCelestialPatron ? (1 + (playerStats.level || 0)) : 0
  resources.healinglightPool = { current: maxHealingLight, max: maxHealingLight }

  const isWarlockArchfey = isWarlock && matchesPatron(playerStats, ['Archfey Patron'])
  const hasStepsOfTheFey = (playerStats.automation?.bonusActions ?? []).some(a => a.type === 'steps_of_the_fey')
  const maxStepsOfTheFey = isWarlockArchfey && hasStepsOfTheFey ? Math.max(charisma?.bonus || 0, 1) : 0
  resources._Steps_of_the_Fey_freeCastCount = { current: maxStepsOfTheFey, max: maxStepsOfTheFey }
}

function addWarlockResources(resources, ctx) {
  const isWarlock = ctx.playerStats.class?.name === 'Warlock'
  const scoped = { ...ctx, isWarlock }
  addFiendBlessing(resources, scoped)
  addPactAndArcanum(resources, scoped)
  addPatronPoolResources(resources, scoped)
}

function addChannelAndInspiration(resources, { playerStats, features, charisma }) {
  const maxCD = features?.maxChannelDivinity || 0
  resources.channelDivinityCharges = { current: maxCD, max: maxCD }

  const isBard = playerStats.class?.name === 'Bard'
  const maxBI = isBard ? (charisma?.bonus || 0) : 0
  resources.bardicInspirationUses = { current: maxBI, max: maxBI }
}

function addPaladinDivineResources(resources, { playerStats, charisma }) {
  const isPaladin = playerStats.class?.name === 'Paladin'
  const maxLoH = isPaladin ? (5 * (playerStats.level || 0)) : 0
  resources.layOnHandsPool = { current: maxLoH, max: maxLoH }

  const maxGD = isPaladin ? Math.max(charisma?.bonus || 0, 1) : 0
  resources.gloriousDefenseUses = { current: maxGD, max: maxGD }
}

function addClericDivineResources(resources, { playerStats }) {
  const isCleric = playerStats.class?.name === 'Cleric'
  const maxDI = isCleric && playerStats.level >= 10 ? 1 : 0
  resources.divineInterventionUses = { current: maxDI, max: maxDI }

  const isLifeDomain = (playerStats.class?.major?.name === 'Life Domain') || (playerStats.class?.subclass?.name === 'Life Domain')
  const maxPL = isCleric && isLifeDomain ? (5 * (playerStats.level || 0)) : 0
  resources.preserveLifePool = { current: maxPL, max: maxPL }

  const wis = playerStats.abilities?.find(a => a.name === 'Wisdom')
  const maxWP = wis ? Math.max(wis.bonus, 1) : 1
  resources.warPriestUses = { current: maxWP, max: maxWP }
}

function addDivineResources(resources, ctx) {
  addChannelAndInspiration(resources, ctx)
  addPaladinDivineResources(resources, ctx)
  addClericDivineResources(resources, ctx)
}

function addRangerPrimalResources(resources, { playerStats, wis }) {
  const isRanger = playerStats.class?.name === 'Ranger'
  const maxNV = isRanger && playerStats.level >= 14 ? Math.max(wis?.bonus || 0, 1) : 0
  resources.naturesVeilUses = { current: maxNV, max: maxNV }

  const favoredEnemyValue = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level)?.favored_enemy || 0
  const favoredEnemyMax = Math.max(1, favoredEnemyValue)
  resources.favoredEnemyUses = { current: favoredEnemyMax, max: favoredEnemyMax }

  const maxTU = isRanger && playerStats.level >= 10 ? Math.max(wis?.bonus || 0, 1) : 0
  resources.tirelessUses = { current: maxTU, max: maxTU }
}

// WIS-gated use pool: max(WIS bonus, 1) when allowed, else 0.
function wisGatedPool(allowed, wis) {
  const value = allowed ? Math.max(wis?.bonus || 0, 1) : 0
  return { current: value, max: value }
}

function addDruidPrimalResources(resources, { playerStats, features, wis }) {
  const maxWS = features?.maxWildShapeUses || 0
  resources.wildShapeUses = { current: maxWS, max: maxWS }

  const isDruid = playerStats.class?.name === 'Druid'
  const maxNR = isDruid ? Math.floor(playerStats.level / 2) : 0
  resources.naturalRecoverySlots = { current: maxNR, max: maxNR }

  const isMoonCircle = isDruid && matchesPatron(playerStats, ['Circle of the Moon'])
  resources.moonlightStepUses = wisGatedPool(isMoonCircle, wis)

  const isStarsCircle = isDruid && matchesPatron(playerStats, ['Circle of the Stars'])
  resources.cosmicomenUses = wisGatedPool(isStarsCircle && playerStats.level >= 6, wis)

  resources._Star_Map_freeCastCount = wisGatedPool(isStarsCircle && playerStats.level >= 3, wis)
}

function hasAncestralTrait(playerStats, traitName, fromSubrace) {
  const traits = (fromSubrace ? playerStats.race?.subrace?.traits : playerStats.race?.traits) || []
  return traits.some(t => t.name === traitName && t.automation)
}

function addAncestralPrimalResources(resources, { playerStats }) {
  const maxSC = hasAncestralTrait(playerStats, 'Stonecunning', false) ? (playerStats.proficiency || 0) : 0
  resources.stonecunningUses = { current: maxSC, max: maxSC }

  const maxSE = hasAncestralTrait(playerStats, "Stone's Endurance", true) ? (playerStats.proficiency || 0) : 0
  resources.stonesEnduranceUses = { current: maxSE, max: maxSE }

  const maxST = hasAncestralTrait(playerStats, "Storm's Thunder", true) ? (playerStats.proficiency || 0) : 0
  resources.stormsThunderUses = { current: maxST, max: maxST }
}

function addPrimalResources(resources, ctx) {
  addDruidPrimalResources(resources, ctx)
  addRangerPrimalResources(resources, ctx)
  addAncestralPrimalResources(resources, ctx)
}

function addRestorationAndTranceResources(resources, { playerStats, features }) {
  const hasRestoration = (playerStats.automation?.passives ?? [])
    .some(a => a.type === 'resource_restoration')
  resources.sorcerousRestorationUses = { current: hasRestoration ? 1 : 0, max: hasRestoration ? 1 : 0 }

  const hasTrance = (playerStats.automation?.bonusActions ?? [])
    .some(a => a.type === 'trance_of_order')
  resources.tranceOfOrderUses = { current: hasTrance ? 1 : 0, max: hasTrance ? 1 : 0 }

  const maxUM = (features?.uncannymetabolismUses || 0)
  resources.uncannymetabolismUses = { current: maxUM, max: maxUM }
}

function addLuckyAndMonkResources(resources, { playerStats }) {
  const isLucky = (playerStats.feats || []).some(f =>
    f?.toLowerCase?.().includes('lucky')
  )
  const maxLP = isLucky ? (playerStats.proficiency || 0) : 0
  resources.luckyPoints = { current: maxLP, max: maxLP }

  const isMonk = playerStats.class?.name === 'Monk'
  const maxWB = isMonk && playerStats.level >= 6 ? 1 : 0
  resources.wholenessofbodyUses = { current: maxWB, max: maxWB }
}

function addFeatsOfChaosResources(resources, { playerStats, is2024 }) {
  const isWildMagic = playerStats.class?.subclass?.name === 'Wild Magic Sorcery'
  const isWildMagic2024 = is2024 && isWildMagic
  const hasFeatsOfChaos = (playerStats.automation?.specialActions ?? []).some(a => a.type === 'feats_of_chaos') ||
    (playerStats.automation?.passives ?? []).some(a => a.type === 'feats_of_chaos')
  const maxFoC = (isWildMagic2024 || hasFeatsOfChaos) ? 1 : 0
  resources.featsOfChaosUses = { current: maxFoC, max: maxFoC }
}

function addMiscResources(resources, ctx) {
  addRestorationAndTranceResources(resources, ctx)
  addLuckyAndMonkResources(resources, ctx)
  addFeatsOfChaosResources(resources, ctx)
}

export function computeTrackedResources(playerStats) {
  if (!playerStats) return {}
  const features = getClassFeatures(playerStats)
  const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level)
  const ctx = {
    playerStats,
    features,
    classLevel,
    is2024: playerStats.rules === '2024',
    charisma: playerStats.abilities?.find(a => a.name === 'Charisma'),
    wis: playerStats.abilities?.find(a => a.name === 'Wisdom'),
  }
  const resources = {}

  addCoreResources(resources, ctx)
  addCasterResources(resources, ctx)
  addMartialResources(resources, ctx)
  addWarlockResources(resources, ctx)
  addDivineResources(resources, ctx)
  addPrimalResources(resources, ctx)
  addMiscResources(resources, ctx)

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
