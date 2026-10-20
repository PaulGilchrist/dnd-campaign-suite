// @maintained-by-ai
// weaponMasteryUtils lane — pure resolver: 2024-ruleset gate + baseMastery || attack?.mastery precedence.
// Mastery family map: collector internals → automationPassives.test.js / .wm008-kindgate.test.js (#969/#970);
// mastery step lanes → steps/attackRollDamageSteps-{cleave,topple}Mastery.test.js (#1031/#1037);
// consumers (CharActions/CharBonusActions) mock this util — the guard + precedence truth-table is owned here.
// Old→new: guard 'not 2024' + 'missing rules' → folded guard it.each; baseMastery/fallback/preference/
// both-falsy → resolution it.each (incl. '' falsy + attack:{} legs); call-bytes pin → per-row exact-identity
// toHaveBeenCalledWith (replaces separate Greatsword test; objectContaining upgraded to identity).
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { getWeaponMastery } from './weaponMasteryUtils.js'

// The util delegates collection to automationService (barrel re-export of automationPassives);
// mock injection is the honest seam — extraMasteries is never read by the util (purged, #1049).
vi.mock('../../services/combat/automation/automationService.js', () => ({
  collectWeaponMastery: vi.fn(),
}))

import { collectWeaponMastery } from '../../services/combat/automation/automationService.js'

describe('getWeaponMastery', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['5e ruleset', { rules: '5e' }],
    ['rules missing', { name: 'Test' }],
    ['rules undefined', { rules: undefined, name: 'Test' }],
  ])('ruleset gate: %s → null, collector never consulted', (_label, playerStats) => {
    expect(getWeaponMastery('Longsword', { mastery: 'topple' }, playerStats)).toBeNull()
    expect(collectWeaponMastery).not.toHaveBeenCalled()
  })

  it.each([
    ['base wins over attack', 'Longsword', 'trip', { mastery: 'heave' }, 'trip'],
    ['base returned when attack is null', 'Greatsword', 'push', null, 'push'],
    ['falls back to attack.mastery when base is null', 'Longsword', null, { mastery: 'topple' }, 'topple'],
    ['falls back to attack.mastery when base is empty string', 'Mace', '', { mastery: 'topple' }, 'topple'],
    ['both absent → null', 'Longsword', null, undefined, null],
    ['attack without mastery key → null', 'Longsword', null, { name: 'Longsword' }, null],
  ])('%s', (_label, weaponName, baseMastery, attack, expected) => {
    collectWeaponMastery.mockReturnValue({ baseMastery })
    const playerStats = { rules: '2024' }

    expect(getWeaponMastery(weaponName, attack, playerStats)).toBe(expected)
    // call-bytes: exact identity forwarding of weaponName and playerStats
    expect(collectWeaponMastery).toHaveBeenCalledWith(weaponName, playerStats)
  })
})
