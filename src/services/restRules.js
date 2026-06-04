import { getLevelAfterLongRest } from './exhaustionRules.js'
import { getRuntimeValue, setRuntimeBatch } from '../hooks/useRuntimeState.js'
import { clearAllExpirationEffects } from './turnExpirations.js'

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
  'secondwindUses',
  'psionicEnergy',
  'focusPoints',
  'superiorityDice',
  'kiPoints',
  'actionsurgeUses',
  'layonhandsPool',
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
  'secondwindUses',
  'psionicEnergy',
  'focusPoints',
  'uncannymetabolismUses',
  'sorceryPoints',
  'arcaneRecoveryLevels',
  'superiorityDice',
  'kiPoints',
  'actionsurgeUses',
  'layonhandsPool',
  'warlockPactMagic',
  'luckyPoints'
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

  clearAllExpirationEffects(name, campaignName)
}
