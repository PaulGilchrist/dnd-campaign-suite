import { getLevelAfterLongRest } from './exhaustionRules.js'

export function getHitDieSize(playerStats) {
  return playerStats.class?.class_levels?.[playerStats.level - 1]?.hit_die || 8
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
  'secondWindUses',
  'psionicEnergy',
  'focusPoints',
  'superiorityDice',
  'kiPoints',
  'actionSurgeUses',
  'layOnHandsPool',
  'luckyPoints'
]

export function getShortRestResources() {
  return [...SHORT_REST_RESOURCES]
}

export const LONG_REST_RESOURCES = [
  'ragePoints',
  'bardicInspirationUses',
  'channelDivinityCharges',
  'wildShapeUses',
  'secondWindUses',
  'psionicEnergy',
  'focusPoints',
  'sorceryPoints',
  'arcaneRecoveryLevels',
  'superiorityDice',
  'kiPoints',
  'actionSurgeUses',
  'layOnHandsPool',
  'warlockPactMagic',
  'luckyPoints'
]

export function getLongRestResources() {
  return [...LONG_REST_RESOURCES]
}

export function spellSlotLevels() {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9]
}

export function applyShortRest(playerStats, campaignName, storage) {
  const name = playerStats.name
  const storedHp = storage.getProperty(name, 'currentHitPoints', campaignName)
  const currentHp = computeShortRestHpNewCurrent(storedHp, playerStats.hitPoints, 0)

  getShortRestResources().forEach((key) => {
    storage.setProperty(name, key, null, campaignName)
  })

  storage.setProperty(name, 'currentHitPoints', currentHp, campaignName)
}

export function applyLongRest(playerStats, campaignName, storage) {
  const name = playerStats.name

  // Read current full character data for atomic batch update
  let charData = storage.get(name)
  if (!charData) charData = {}

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

  const currentExhaustion = charData.exhaustionLevel
  if (typeof currentExhaustion === 'number' && currentExhaustion > 0) {
    charData.exhaustionLevel = getLevelAfterLongRest(currentExhaustion)
  }

  // Grant Heroic Inspiration from Resourceful trait (Human 2024)
  const hasResourceful = playerStats.characterAdvancement?.some(f => f.name === 'Resourceful')
  if (hasResourceful) {
    charData.hasInspiration = true
  }

  // Single atomic write fires ONE SSE event with the complete final state
  storage.set(name, charData, campaignName)
}
