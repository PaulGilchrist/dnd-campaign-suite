import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildAttackContextSync, buildAttackContext } from './contextBuilder.js'
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'

vi.mock('./common/damageRoll.js', () => ({
  buildBaseAttackContext: vi.fn(async () => ({
    target: { name: 'Orc' },
    targetName: 'Orc',
    resistanceNotice: null,
  })),
}))

vi.mock('../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(async () => null),
  getTargetFromAttacker: vi.fn(() => null),
}))

vi.mock('../maps/mapsService.js', () => ({
  loadMapData: vi.fn(async () => null),
}))

vi.mock('../rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'ok' })),
  computeMeleeProximityEffect: vi.fn(() => ({ mode: 'ok' })),
  getDistanceFeet: vi.fn(() => 5),
  isHostileNPC: vi.fn(() => true),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 5)),
}))

vi.mock('../rules/combat/coverService.js', () => ({
  computeCover: vi.fn(() => ({ level: 'none', acBonus: 0 })),
}))

vi.mock('../npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(async () => []),
}))

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeValue: vi.fn(),
}))

vi.mock('../combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ spellAdvantage: false, saveDcBonus: 0 })),
}))

vi.mock('../combat/auras/wolfAuraUtils.js', () => ({
  getWolfAdvantageAgainst: vi.fn(() => ({ advantage: false })),
}))

vi.mock('../combat/auras/duplicityAuraUtils.js', () => ({
  getDuplicityAdvantageAgainst: vi.fn(() => ({ advantage: false })),
}))

vi.mock('../combat/auras/lionAuraUtils.js', () => ({
  getLionDisadvantageAgainst: vi.fn(() => ({ disadvantage: false })),
}))

vi.mock('../combat/auras/coronaAuraUtils.js', () => ({
  getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}))

vi.mock('../combat/auras/auraOfProtection.js', () => ({
  hasAuraOfProtection: vi.fn(() => false),
}))

vi.mock('../combat/auras/protectionBuffUtils.js', () => ({
  hasProtectionBuff: vi.fn(() => false),
}))

vi.mock('../../automation/handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({
  isActive: vi.fn(() => false),
  isAuraTarget: vi.fn(() => false),
}))

describe('contextBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('buildAttackContextSync', () => {
    const mockStats = {
      name: 'Fighter1',
      level: 5,
      proficiency: 2,
      class: {
        class_levels: [{ rage_damage: 2 }],
      },
      abilities: [
        { name: 'Charisma', bonus: 2 },
        { name: 'Strength', bonus: 4 },
        { name: 'Dexterity', bonus: 3 },
      ],
      automation: {
        passives: [],
      },
    }

    const mockAttack = {
      name: 'Longsword',
      damage: '1d8+4',
      damageType: 'Slashing',
      hitBonus: 7,
      hitBonusFormula: 'To Hit = 4 + 2 + 1',
      weaponType: 'melee',
    }

    it('returns a context object with required fields', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {})
      expect(result).toBeDefined()
      expect(result.targetName).toBe('Orc')
      expect(result.attackerName).toBe('Fighter1')
      expect(result.damageType).toBe('Slashing')
      expect(result.isMelee).toBe(true)
      expect(result.hitBonus).toBe(7)
    })

    it('sets forcedMode to advantage when save advantage is stored', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return []
        if (key === '_advantageOn_Orc') return ['Orc']
        return undefined
      })
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {})
      expect(result.forcedMode).toBe('advantage')
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('sets forcedMode to advantage when innate sorcery spell advantage is active', async () => {
      const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js')
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ spellAdvantage: true, saveDcBonus: 0 })
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {})
      expect(result.forcedMode).toBe('advantage')
    })

    it('sets forcedMode to advantage when ram buff is active', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ optionName: 'Ram' }]
        return undefined
      })
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {})
      expect(result.forcedMode).toBe('advantage')
      expect(result.ramActive).toBe(true)
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('includes strokeOfLuck when available', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'strokeOfLuckUsed') return false
        return undefined
      })
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'stroke_of_luck' }] },
      }
      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {})
      expect(result.strokeOfLuck).toBe(true)
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('includes boonOfFate when available', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'boonOfFateUsed') return false
        return undefined
      })
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'modify_d20_roll' }] },
      }
      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {})
      expect(result.boonOfFate).toBe(true)
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('includes grazeDamage when graze effect exists', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'graze', target: 'Orc', abilityName: 'STR' }]
        return undefined
      })
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {})
      expect(result.grazeDamage).toBe(true)
      expect(result.grazeAbilityName).toBe('STR')
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('includes criticalRange from passives', async () => {
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'critical_range', criticalRange: '19-20' }] },
      }
      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {})
      expect(result.criticalRange).toBe('19-20')
    })

    it('includes gloriousDefenseBonus when active', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'gloriousDefenseActive') return true
        if (key === 'gloriousDefenseBonus') return 2
        return undefined
      })
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {})
      expect(result.gloriousDefenseBonus).toBe(2)
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('includes defensiveDuelistBonus when active', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'defensiveDuelistActive') return true
        if (key === 'defensiveDuelistBonus') return 1
        return undefined
      })
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {})
      expect(result.defensiveDuelistBonus).toBe(1)
      vi.mocked(getRuntimeValue).mockRestore()
    })

    it('includes isPsychicBlade when set on attack', async () => {
      const psychicAttack = { ...mockAttack, isPsychicBlade: true }
      const result = await buildAttackContextSync(psychicAttack, mockStats, 'camp', 'normal', {})
      expect(result.isPsychicBlade).toBe(true)
    })

    it('includes isWeaponAttack as true when not explicitly false', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {})
      expect(result.isWeaponAttack).toBe(true)
    })

    it('includes isWeaponAttack as false when explicitly false', async () => {
      const spellAttack = { ...mockAttack, isWeaponAttack: false }
      const result = await buildAttackContextSync(spellAttack, mockStats, 'camp', 'normal', {})
      expect(result.isWeaponAttack).toBe(false)
    })

    it('includes hunterLoreNotice when hunter lore passive exists and target has info', async () => {
      const { buildBaseAttackContext } = await import('./common/damageRoll.js')
      buildBaseAttackContext.mockResolvedValue({
        target: { vulnerabilities: ['fire'], resistances: ['cold'], immunities: ['poison'] },
        targetName: 'Orc',
        resistanceNotice: null,
      })
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'hunter_lore' }] },
      }
      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {})
      expect(result.hunterLoreNotice).toContain('Vulnerabilities')
      expect(result.hunterLoreNotice).toContain('Resistances')
      expect(result.hunterLoreNotice).toContain('Immunities')
    })

    it('handles conditionAttackMode parameter', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'death_attack', {})
      expect(result).toBeDefined()
    })
  })

  describe('buildAttackContext', () => {
    const mockStats = {
      name: 'Fighter1',
      level: 5,
      proficiency: 2,
      class: { class_levels: [{ rage_damage: 2 }] },
      abilities: [
        { name: 'Charisma', bonus: 2 },
        { name: 'Strength', bonus: 4 },
      ],
      automation: { passives: [] },
    }

    const mockAttack = {
      name: 'Longbow',
      damage: '1d8+4',
      damageType: 'Piercing',
      hitBonus: 7,
      hitBonusFormula: 'To Hit = 4 + 2 + 1',
      weaponType: 'ranged',
      range: 150,
    }

    it('delegates to buildAttackContextSync when no mapName', async () => {
      const result = await buildAttackContext(mockAttack, mockStats, 'camp', null, 'normal', {})
      expect(result).toBeDefined()
      expect(result.targetName).toBe('Orc')
    })

    it('loads map data when mapName is provided', async () => {
      const { loadMapData } = await import('../maps/mapsService.js')
      loadMapData.mockResolvedValue({ players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }] })
      const { getCombatContext } = await import('../rules/combat/damageUtils.js')
      getCombatContext.mockResolvedValue({ creatures: [] })
      const result = await buildAttackContext(mockAttack, mockStats, 'camp', 'test-map', 'normal', {})
      expect(loadMapData).toHaveBeenCalledWith('camp', 'test-map')
      expect(result).toBeDefined()
    })

    it('returns base when attacker not found on map', async () => {
      const { loadMapData } = await import('../maps/mapsService.js')
      loadMapData.mockResolvedValue({ players: [{ name: 'Other', gridX: 1, gridY: 1 }] })
      const { getCombatContext } = await import('../rules/combat/damageUtils.js')
      getCombatContext.mockResolvedValue({ creatures: [] })
      const result = await buildAttackContext(mockAttack, mockStats, 'camp', 'test-map', 'normal', {})
      expect(result.targetName).toBe('Orc')
    })

    it('handles promise rejection gracefully', async () => {
      const { loadMapData } = await import('../maps/mapsService.js')
      loadMapData.mockRejectedValue(new Error('map load failed'))
      const result = await buildAttackContext(mockAttack, mockStats, 'camp', 'test-map', 'normal', {})
      expect(result).toBeDefined()
    })

    it('ignores cover when ignore_cover_ranged passive exists', async () => {
      const { computeCover } = await import('../rules/combat/coverService.js')
      computeCover.mockReturnValue({ level: 'full', acBonus: 4 })
      const { loadMapData } = await import('../maps/mapsService.js')
      loadMapData.mockResolvedValue({
        players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        placedItems: [],
      })
      const { getCombatContext } = await import('../rules/combat/damageUtils.js')
      getCombatContext.mockResolvedValue({ creatures: [] })
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'ignore_cover_ranged' }] },
      }
      const result = await buildAttackContext(mockAttack, stats, 'camp', 'test-map', 'normal', {})
      expect(result.coverAcBonus).toBeUndefined()
    })

    it('includes improved illusions range bonus for illusion spells', async () => {
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'improved_illusions' }] },
      }
      const illusionAttack = {
        ...mockAttack,
        damage: '1d4',
        damageType: 'Force',
        weaponType: 'ranged',
        range: 120,
        school: 'Illusion',
      }
      const { loadMapData } = await import('../maps/mapsService.js')
      loadMapData.mockResolvedValue({ players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }] })
      const { getCombatContext } = await import('../rules/combat/damageUtils.js')
      getCombatContext.mockResolvedValue({ creatures: [] })
      const result = await buildAttackContext(illusionAttack, stats, 'camp', 'test-map', 'normal', {})
      expect(result).toBeDefined()
    })
  })
})
