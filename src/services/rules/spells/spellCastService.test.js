// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// vi.mock factories are hoisted to the top of the file by Vitest,
// before any top-level variables. We create mock functions inline
// within the factory and expose them via a shared reference that
// tests can assert on.
function createMockRefs() {
  const setRuntimeValue = vi.fn()
  const getRuntimeValue = vi.fn(() => undefined)
  const clearRuntimeState = vi.fn()
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState }
}

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const refs = createMockRefs()
  globalThis.__runtimeStateMock = refs
  return {
    setRuntimeValue: refs.setRuntimeValue,
    getRuntimeValue: refs.getRuntimeValue,
    clearRuntimeState: refs.clearRuntimeState,
  }
})

vi.mock('../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(() => Promise.resolve(null)),
  getResistanceNotice: vi.fn(),
  extractDamageTypes: vi.fn(),
  formatDamageTypes: vi.fn(),
}))

import { refundSpellBreakerSlot } from './spellCastService.js'

const runtimeStateMock = globalThis.__runtimeStateMock

describe('spellCastService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: activeConditions returns [] so executeSpellCast doesn't throw
    runtimeStateMock.getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
      if (propertyName === 'activeConditions') return []
      return undefined
    })
  })

  afterEach(() => {
    // Don't use vi.restoreAllMocks() — it restores the original
    // module, breaking the mock reference in spellCastService.js
    delete globalThis.__runtimeStateMock
  })

  describe('refundSpellBreakerSlot', () => {
    it('refunds a spell slot when currentSlots is a non-negative number', async () => {
      runtimeStateMock.getRuntimeValue.mockReturnValue(2)

      refundSpellBreakerSlot('Wizard1', 3, 'camp')

      expect(runtimeStateMock.setRuntimeValue).toHaveBeenCalledWith(
        'Wizard1',
        'spell_slots_level_3',
        3,
        'camp',
      )
    })

    it('does not refund when currentSlots is null, undefined, or negative', async () => {
      const invalidValues = [null, undefined, -1]

      for (const invalidValue of invalidValues) {
        runtimeStateMock.getRuntimeValue.mockReturnValue(invalidValue)

        refundSpellBreakerSlot('Wizard1', 3, 'camp')

        expect(runtimeStateMock.setRuntimeValue).not.toHaveBeenCalled()
        vi.clearAllMocks()
        runtimeStateMock.getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
          if (propertyName === 'activeConditions') return []
          return undefined
        })
      }
    })
  })

  describe('executeSpellCast', () => {
    function makeSpell(name = 'Fireball', level = 3) {
      return {
        name,
        level,
        damage: { damage_at_slot_level: { 3: '8d6' } },
        school: 'Evocation',
      }
    }

    function makePlayerStats(overrides = {}) {
      return {
        name: 'Wizard1',
        proficiency: 4,
        spellAbilities: { toHit: 7, saveDc: 15, modifier: 3 },
        abilities: [{ name: 'Int', bonus: 3 }],
        hitPoints: 50,
        automation: { passives: [] },
        ...overrides,
      }
    }

    function makeMetaCtx(overrides = {}) {
      return {
        slotLevel: 3,
        targetName: 'Goblin1',
        ...overrides,
      }
    }

    let consoleErrorSpy

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      runtimeStateMock.getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
        if (propertyName === 'activeConditions') return []
        return undefined
      })
    })

    afterEach(() => {
      consoleErrorSpy?.mockRestore()
    })

    describe('spell save DC calculation', () => {
      function makeSpellWithDC(name = 'Fireball', level = 3) {
        return {
          name,
          level,
          dc: { dc_type: 'DEX', dc_success: 'none' },
          damage: { damage_at_slot_level: { 3: '8d6' } },
          school: 'Evocation',
        }
      }

      it('uses spellAbilities.saveDc when available', async () => {
        const spell = makeSpellWithDC('Burning Hands')
        const playerStats = makePlayerStats({ spellAbilities: { saveDc: 13, toHit: 5, modifier: 1 } })
        const metaCtx = makeMetaCtx()

        const rollDamageSpy = vi.fn()
        const { executeSpellCast: spellCast } = await import('./spellCastService.js')
        await spellCast(spell, metaCtx, {
          rollAttack: vi.fn(),
          rollDamage: rollDamageSpy,
          playerStats,
          getTargetInfo: vi.fn(() => ({ name: 'Goblin1' })),
          campaignName: 'camp',
          mapName: 'map1',
        })

        expect(rollDamageSpy).toHaveBeenCalled()
        const context = rollDamageSpy.mock.calls[0][5]
        expect(context.saveDc).toBe(13)
      })

      it('calculates save DC from proficiency when spellAbilities.saveDc is missing', async () => {
        const spell = makeSpellWithDC('Burning Hands')
        const playerStats = makePlayerStats({ spellAbilities: { toHit: 5 } })
        const metaCtx = makeMetaCtx()

        const rollDamageSpy = vi.fn()
        const { executeSpellCast: spellCast } = await import('./spellCastService.js')
        await spellCast(spell, metaCtx, {
          rollAttack: vi.fn(),
          rollDamage: rollDamageSpy,
          playerStats,
          getTargetInfo: vi.fn(() => ({ name: 'Goblin1' })),
          campaignName: 'camp',
          mapName: 'map1',
        })

        // 8 + proficiency(4) = 12
        expect(rollDamageSpy).toHaveBeenCalled()
        const context = rollDamageSpy.mock.calls[0][5]
        expect(context.saveDc).toBe(12)
      })

      it('throws when proficiency is missing and spellAbilities.saveDc is also missing', async () => {
        const spell = makeSpell('Burning Hands')
        const playerStats = makePlayerStats({ proficiency: null, spellAbilities: {} })
        const metaCtx = makeMetaCtx()

        const { executeSpellCast: spellCast } = await import('./spellCastService.js')
        await expect(
          spellCast(spell, metaCtx, {
            rollAttack: vi.fn(),
            rollDamage: vi.fn(),
            playerStats,
            getTargetInfo: vi.fn(() => ({ name: 'Goblin1' })),
            campaignName: 'camp',
          }),
        ).rejects.toThrow('playerStats.proficiency is required for spell save DC calculation')
      })
    })

    describe('range validation', () => {
      function makeSpellWithDC(name = 'Fireball', level = 3) {
        return {
          name,
          level,
          dc: { dc_type: 'DEX', dc_success: 'none' },
          damage: { damage_at_slot_level: { 3: '8d6' } },
          school: 'Evocation',
        }
      }

      it('marks auto miss when target is out of range', async () => {
        const spell = {
          ...makeSpellWithDC('Fireball'),
          range: '150 ft.',
        }
        const playerStats = makePlayerStats()
        const metaCtx = makeMetaCtx()

        const rollAttackSpy = vi.fn()
        const rollDamageSpy = vi.fn()
        const { executeSpellCast: spellCast } = await import('./spellCastService.js')
        await spellCast(spell, metaCtx, {
          rollAttack: rollAttackSpy,
          rollDamage: rollDamageSpy,
          playerStats,
          getTargetInfo: vi.fn(() => ({ name: 'Goblin1' })),
          attackerPos: { x: 0, y: 0 },
          targetPos: { x: 200, y: 0 },
          campaignName: 'camp',
          mapName: 'map1',
        })

        expect(rollDamageSpy).toHaveBeenCalled()
        const context = rollDamageSpy.mock.calls[0][5]
        expect(context.isAutoMiss).toBe(true)
      })
    })

    describe('empowered evocation', () => {
      function makeSpellWithDC(name = 'Fireball', level = 3) {
        return {
          name,
          level,
          dc: { dc_type: 'DEX', dc_success: 'none' },
          damage: { damage_at_slot_level: { 3: '8d6' } },
          school: 'Evocation',
        }
      }

      it('adds INT modifier to damage formula when empowered evocation is active', async () => {
        const playerStats = makePlayerStats({
          automation: {
            passives: [
              { name: 'Empowered Evocation', type: 'empowered_evocation' },
            ],
          },
          abilities: [{ name: 'Intelligence', bonus: 3 }],
        })
        const spell = makeSpellWithDC('Fireball')
        const metaCtx = makeMetaCtx()

        const rollDamageSpy = vi.fn()
        const { executeSpellCast: spellCast } = await import('./spellCastService.js')
        await spellCast(spell, metaCtx, {
          rollAttack: vi.fn(),
          rollDamage: rollDamageSpy,
          playerStats,
          getTargetInfo: vi.fn(() => ({ name: 'Goblin1' })),
          campaignName: 'camp',
          mapName: 'map1',
        })

        expect(rollDamageSpy).toHaveBeenCalled()
        const formula = rollDamageSpy.mock.calls[0][1]
        expect(formula).toContain('Empowered Evocation')
      })
    })

    describe('overchannel', () => {
      function makeSpellWithDC(name = 'Fireball', level = 3) {
        return {
          name,
          level,
          dc: { dc_type: 'DEX', dc_success: 'none' },
          damage: { damage_at_slot_level: { 3: '8d6' } },
          school: 'Evocation',
        }
      }

      it('maximizes damage when overchannel is active for valid slot levels', async () => {
        const playerStats = makePlayerStats({
          automation: {
            passives: [
              { name: 'Overchannel', type: 'overchannel' },
            ],
          },
        })
        const spell = makeSpellWithDC('Fireball')
        const metaCtx = makeMetaCtx({ overchannel: true, slotLevel: 3 })

        const rollDamageSpy = vi.fn()
        const { executeSpellCast: spellCast } = await import('./spellCastService.js')
        await spellCast(spell, metaCtx, {
          rollAttack: vi.fn(),
          rollDamage: rollDamageSpy,
          playerStats,
          getTargetInfo: vi.fn(() => ({ name: 'Goblin1' })),
          campaignName: 'camp',
          mapName: 'map1',
        })

        expect(rollDamageSpy).toHaveBeenCalled()
        const context = rollDamageSpy.mock.calls[0][5]
        expect(context.overchannelActive).toBe(true)
        expect(context.overchannelSpellLevel).toBe(3)
        expect(runtimeStateMock.setRuntimeValue).toHaveBeenCalledWith(
          'Wizard1',
          'Overchannel_useCount',
          1,
          'camp',
        )
      })

      it('does not overchannel for cantrips (level 0) or slot levels above 5', async () => {
        const playerStats = makePlayerStats({
          automation: {
            passives: [
              { name: 'Overchannel', type: 'overchannel' },
            ],
          },
        })

        const invalidSlotLevels = [
          { spell: { ...makeSpellWithDC('Ray of Frost'), level: 0 }, metaCtx: { overchannel: true, slotLevel: 0 } },
          { spell: makeSpellWithDC('Wish', 9), metaCtx: { overchannel: true, slotLevel: 9 } },
        ]

        for (const { spell, metaCtx: mc } of invalidSlotLevels) {
          const rollDamageSpy = vi.fn()
          const { executeSpellCast: spellCast } = await import('./spellCastService.js')
          await spellCast(spell, mc, {
            rollAttack: vi.fn(),
            rollDamage: rollDamageSpy,
            playerStats,
            getTargetInfo: vi.fn(() => ({ name: 'Goblin1' })),
            campaignName: 'camp',
            mapName: 'map1',
          })

          expect(rollDamageSpy).toHaveBeenCalled()
          const formula = rollDamageSpy.mock.calls[0][1]
          expect(formula).not.toContain('Overchannel')
          vi.clearAllMocks()
          runtimeStateMock.getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
            if (propertyName === 'activeConditions') return []
            return undefined
          })
        }
      })
    })

    describe('healing spells', () => {
      it('throws when slot level is missing for healing spell', async () => {
        const spell = {
          name: 'Cure Wounds',
          level: null,
          heal_at_slot_level: { 1: '1d8' },
        }
        const playerStats = makePlayerStats()
        const metaCtx = makeMetaCtx({ slotLevel: null })

        const { executeSpellCast: spellCast } = await import('./spellCastService.js')
        await expect(
          spellCast(spell, metaCtx, {
            rollAttack: vi.fn(),
            rollDamage: vi.fn(),
            playerStats,
            getTargetInfo: vi.fn(() => ({ name: 'Ally1' })),
            campaignName: 'camp',
            mapName: 'map1',
          }),
        ).rejects.toThrow('slot level is required for healing spell')
      })
    })

    describe('error handling', () => {
      it('throws when automation.passives is missing for magical ambush check', async () => {
        const spell = makeSpell('Fireball')
        const playerStats = makePlayerStats({ automation: {} })
        const metaCtx = makeMetaCtx()

        const { executeSpellCast: spellCast } = await import('./spellCastService.js')
        await expect(
          spellCast(spell, metaCtx, {
            rollAttack: vi.fn(),
            rollDamage: vi.fn(),
            playerStats,
            getTargetInfo: vi.fn(() => ({ name: 'Goblin1' })),
            campaignName: 'camp',
          }),
        ).rejects.toThrow('playerStats.automation.passives is required for magical ambush check')
      })

      it('throws when activeConditions is not an array', async () => {
        const spell = makeSpell('Fireball')
        const playerStats = makePlayerStats()
        const metaCtx = makeMetaCtx()

        // Override the default mockImplementation to return null for activeConditions
        runtimeStateMock.getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
          if (propertyName === 'activeConditions') return null
          return undefined
        })

        const { executeSpellCast: spellCast } = await import('./spellCastService.js')
        await expect(
          spellCast(spell, metaCtx, {
            rollAttack: vi.fn(),
            rollDamage: vi.fn(),
            playerStats,
            getTargetInfo: vi.fn(() => ({ name: 'Goblin1' })),
            campaignName: 'camp',
          }),
        ).rejects.toThrow('activeConditions must be an array for caster')
      })
    })
  })
})
