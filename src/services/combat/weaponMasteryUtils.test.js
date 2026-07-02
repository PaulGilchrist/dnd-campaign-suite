// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { getWeaponMastery } from './weaponMasteryUtils.js'

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('../../services/combat/automation/automationService.js', () => ({
  collectWeaponMastery: vi.fn(),
}))

import { collectWeaponMastery } from '../../services/combat/automation/automationService.js'

// ── Tests ──────────────────────────────────────────────────────────

describe('getWeaponMastery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when ruleset is not 2024', () => {
    const result = getWeaponMastery('Longsword', null, { rules: '5e' })
    expect(result).toBeNull()
    expect(collectWeaponMastery).not.toHaveBeenCalled()
  })

  it('returns null when ruleset is undefined', () => {
    const result = getWeaponMastery('Longsword', null, { name: 'Test' })
    expect(result).toBeNull()
    expect(collectWeaponMastery).not.toHaveBeenCalled()
  })

  it('returns null when ruleset is missing entirely', () => {
    const result = getWeaponMastery('Longsword', null, {})
    expect(result).toBeNull()
    expect(collectWeaponMastery).not.toHaveBeenCalled()
  })

  it('returns baseMastery from collectWeaponMastery when truthy', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: 'push', extraMasteries: [] })
    const result = getWeaponMastery('Longsword', null, { rules: '2024' })
    expect(collectWeaponMastery).toHaveBeenCalledWith('Longsword', expect.objectContaining({ rules: '2024' }))
    expect(result).toBe('push')
  })

  it('returns attack.mastery when baseMastery is null', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] })
    const attack = { mastery: 'topple' }
    const result = getWeaponMastery('Longsword', attack, { rules: '2024' })
    expect(result).toBe('topple')
  })

  it('returns attack.mastery when baseMastery is undefined', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: undefined, extraMasteries: [] })
    const attack = { mastery: 'heave' }
    const result = getWeaponMastery('Longsword', attack, { rules: '2024' })
    expect(result).toBe('heave')
  })

  it('returns attack.mastery when baseMastery is empty string', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: '', extraMasteries: [] })
    const attack = { mastery: 'shove' }
    const result = getWeaponMastery('Longsword', attack, { rules: '2024' })
    expect(result).toBe('shove')
  })

  it('prefers baseMastery over attack.mastery when both exist', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: 'trip', extraMasteries: [] })
    const attack = { mastery: 'heave' }
    const result = getWeaponMastery('Longsword', attack, { rules: '2024' })
    expect(result).toBe('trip')
  })

  it('returns null when both baseMastery and attack.mastery are null', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] })
    const result = getWeaponMastery('Longsword', null, { rules: '2024' })
    expect(result).toBeNull()
  })

  it('returns null when attack is null and baseMastery is null', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] })
    const result = getWeaponMastery('Longsword', null, { rules: '2024' })
    expect(result).toBeNull()
  })

  it('returns null when attack is undefined and baseMastery is null', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] })
    const result = getWeaponMastery('Longsword', undefined, { rules: '2024' })
    expect(result).toBeNull()
  })

  it('returns null when attack object has no mastery property', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] })
    const attack = { name: 'Longsword' }
    const result = getWeaponMastery('Longsword', attack, { rules: '2024' })
    expect(result).toBeNull()
  })

  it('passes weaponName and playerStats to collectWeaponMastery', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: 'push', extraMasteries: [] })
    const playerStats = { rules: '2024', name: 'TestCharacter', proficiency: 4 }
    getWeaponMastery('Greatsword', null, playerStats)
    expect(collectWeaponMastery).toHaveBeenCalledWith('Greatsword', playerStats)
  })

  it('returns null when attack.mastery is 0 (falsy)', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] })
    const attack = { mastery: 0 }
    const result = getWeaponMastery('Longsword', attack, { rules: '2024' })
    expect(result).toBeNull()
  })

  it('returns null when attack.mastery is false (falsy)', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] })
    const attack = { mastery: false }
    const result = getWeaponMastery('Longsword', attack, { rules: '2024' })
    expect(result).toBeNull()
  })
})
