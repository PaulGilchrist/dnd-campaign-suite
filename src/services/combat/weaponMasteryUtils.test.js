// @cleaned-by-ai
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

  it('returns null when ruleset is missing or undefined', () => {
    expect(getWeaponMastery('Longsword', null, { name: 'Test' })).toBeNull()
    expect(getWeaponMastery('Longsword', null, {})).toBeNull()
    expect(collectWeaponMastery).not.toHaveBeenCalled()
  })

  it('returns baseMastery from collectWeaponMastery when truthy', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: 'push', extraMasteries: [] })
    const result = getWeaponMastery('Longsword', null, { rules: '2024' })
    expect(collectWeaponMastery).toHaveBeenCalledWith('Longsword', expect.objectContaining({ rules: '2024' }))
    expect(result).toBe('push')
  })

  it('falls back to attack.mastery when baseMastery is falsy', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] })
    const attack = { mastery: 'topple' }
    expect(getWeaponMastery('Longsword', attack, { rules: '2024' })).toBe('topple')
  })

  it('prefers baseMastery over attack.mastery when both exist', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: 'trip', extraMasteries: [] })
    const attack = { mastery: 'heave' }
    expect(getWeaponMastery('Longsword', attack, { rules: '2024' })).toBe('trip')
  })

  it('returns null when both baseMastery and attack.mastery are falsy', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] })
    expect(getWeaponMastery('Longsword', null, { rules: '2024' })).toBeNull()
    expect(getWeaponMastery('Longsword', undefined, { rules: '2024' })).toBeNull()
    expect(getWeaponMastery('Longsword', { name: 'Longsword' }, { rules: '2024' })).toBeNull()
  })

  it('passes weaponName and playerStats to collectWeaponMastery', () => {
    collectWeaponMastery.mockReturnValue({ baseMastery: 'push', extraMasteries: [] })
    const playerStats = { rules: '2024', name: 'TestCharacter', proficiency: 4 }
    getWeaponMastery('Greatsword', null, playerStats)
    expect(collectWeaponMastery).toHaveBeenCalledWith('Greatsword', playerStats)
  })
})
