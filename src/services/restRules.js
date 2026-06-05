import { getLevelAfterLongRest } from './exhaustionRules.js'
import { getRuntimeValue, setRuntimeBatch } from '../hooks/useRuntimeState.js'
import { clearAllExpirationEffects } from './expirations.js'

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
    { key: 'superiorityDice', label: 'Superiority Dice', classes: ['Fighter'], subclasses: ['Battle Master'] }
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
  'secondwindUses',
  'psionicEnergy',
  'focusPoints',
  'superiorityDice',
  'kiPoints',
    'actionsurgeUses',
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
     'layOnHandsPool',
     'warlockPactMagic',
     'luckyPoints',
     'innateSorceryUses',
     'sorcerousRestorationUses'
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

  clearAllExpirationEffects(name, campaignName)
}
