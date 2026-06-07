import { describe, it, expect } from 'vitest'
import { OPPORTUNITY_ATTACK, MELEE_REACH_FEET } from './baseCombatActions.js'

describe('OPPORTUNITY_ATTACK', () => {
  it('exports the correct name and description', () => {
    expect(OPPORTUNITY_ATTACK.name).toBe('Opportunity Attack')
    expect(OPPORTUNITY_ATTACK.description).toBe('Can attack creature that moves out of your reach')
  })
})

describe('MELEE_REACH_FEET', () => {
  it('is set to 5', () => {
    expect(MELEE_REACH_FEET).toBe(5)
  })
})
