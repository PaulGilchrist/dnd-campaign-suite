import { describe, it, expect } from 'vitest'

import {
  collectSaveModifiers,
  getEvasionEffects,
} from './automationService.js'
import { makeFeature } from './automationService.fixtures.js'

// ── collectSaveModifiers ──────────────────────────────────────────
describe('collectSaveModifiers', () => {
  it('returns empty array when features is null', () => {
    expect(collectSaveModifiers(null)).toEqual([])
  })

  it('returns empty array for features without automation', () => {
    expect(collectSaveModifiers([{ name: 'No Auto' }])).toEqual([])
  })

  it('collects conditional_advantage modifiers from raw automation fields', () => {
    // source reads effect/condition from the raw auto object, not buildAttackInfo
    const features = [makeFeature({ type: 'conditional_advantage', abilities: ['STR'], condition: 'rage_active', effect: 'advantage' })]
    const result = collectSaveModifiers(features)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('Test Feature')
    expect(result[0].abilities).toEqual(['STR'])
    expect(result[0].effect).toBe('advantage')
  })

  it('uses saveType to derive abilities when abilities not specified', () => {
    const features = [makeFeature({ type: 'conditional_advantage', saveType: 'DEX' })]
    const result = collectSaveModifiers(features)
    expect(result[0].abilities).toEqual(['DEX'])
  })

  it('defaults to empty abilities array when neither abilities nor saveType present', () => {
    const features = [makeFeature({ type: 'conditional_advantage' })]
    const result = collectSaveModifiers(features)
    expect(result[0].abilities).toEqual([])
  })

  it('collects auto_reroll modifiers', () => {
    const features = [makeFeature({ type: 'auto_reroll', condition: 'nat1', bonusExpression: '!d20' })]
    const result = collectSaveModifiers(features)
    expect(result).toHaveLength(1)
    expect(result[0].effect).toBe('reroll')
    expect(result[0].bonusExpression).toBe('!d20')
  })

  it('collects advantage from combat_stance.advantages', () => {
    const features = [makeFeature({ type: 'combat_stance', advantages: ['STR saves'] })]
    const result = collectSaveModifiers(features)
    expect(result).toHaveLength(1)
    expect(result[0].abilities).toEqual(['STR'])
  })

  it('handles combat_stance advantages with multiple entries', () => {
    const features = [makeFeature({
      type: 'combat_stance',
      advantages: ['STR saves', 'DEX checks'],
    }, 'Stance')]
    const result = collectSaveModifiers(features)
    // Only entries containing 'saves' get collected as save modifiers
    expect(result).toHaveLength(1)
    expect(result[0].abilities).toEqual(['STR'])
  })

  it('returns empty array for non-save combat_stance advantages', () => {
    const features = [makeFeature({ type: 'combat_stance', advantages: ['DEX checks'] })]
    const result = collectSaveModifiers(features)
    expect(result).toHaveLength(0)
  })
})

// ── getEvasionEffects ─────────────────────────────────────────────
describe('getEvasionEffects', () => {
  it('returns empty array when features is null', () => {
    expect(getEvasionEffects(null)).toEqual([])
  })

  it('returns empty array for non-evasion features', () => {
    const features = [makeFeature({ type: 'passive_rule' })]
    expect(getEvasionEffects(features)).toEqual([])
  })

  it('returns evasion effect with default saveType DEX', () => {
    const features = [makeFeature({ type: 'evasion' }, 'Uncanny')]
    const result = getEvasionEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('Uncanny')
    expect(result[0].saveType).toBe('DEX')
    expect(result[0].shareable).toBe(false)
    expect(result[0].shareRange).toBe(0)
  })

  it('uses custom saveType when provided', () => {
    const features = [makeFeature({ type: 'evasion', saveType: 'CON' }, 'Evasion')]
    const result = getEvasionEffects(features)
    expect(result[0].saveType).toBe('CON')
  })

  it('recognizes shareable evasion with range', () => {
    const features = [makeFeature({ type: 'evasion', shareable: true, shareRange: 30 }, 'Group Evasion')]
    const result = getEvasionEffects(features)
    expect(result[0].shareable).toBe(true)
    expect(result[0].shareRange).toBe(30)
  })

  it('collects multiple evasion effects from different features', () => {
    const features = [
      makeFeature({ type: 'evasion', saveType: 'DEX' }, 'Evasion1'),
      makeFeature({ type: 'passive_rule' }, 'Not Evasion'),
      makeFeature({ type: 'evasion', saveType: 'WIS' }, 'Evasion2'),
    ]
    const result = getEvasionEffects(features)
    expect(result).toHaveLength(2)
  })
})
