import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn((_key1, key2) => {
    if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
    return undefined
  }),
}))

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [4], modifier: 1 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 5, rolls: [4], modifier: 1, maximized: false })),
}))

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
  getLog: vi.fn(),
}))

vi.mock('../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}))

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}))

vi.mock('../effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}))

vi.mock('../combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  computeEffectiveSpellRange: vi.fn(() => 60),
  getDistanceFeet: vi.fn(() => 30),
  rangeToFeet: vi.fn((r) => typeof r === 'number' ? r : 60),
}))

vi.mock('../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}))

vi.mock('../features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
  triggerSilence: vi.fn(),
}))

vi.mock('../features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}))

vi.mock('../features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
  triggerFriends: vi.fn(),
}))

vi.mock('./postCastRiderService.js', () => ({
  triggerPostCastRiderSaves: vi.fn(),
  triggerSpellThief: vi.fn(),
  triggerBewitchingMagic: vi.fn(),
  triggerSoulstitchSpells: vi.fn(),
  hasEmpoweredEvocation: vi.fn(() => false),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('./postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(async () => {}),
  triggerPostCastAllyHeals: vi.fn(async () => {}),
}))

vi.mock('../features/falseLifeService.js', () => ({
  triggerFalseLife: vi.fn(async () => {}),
}))

vi.mock('../features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(async () => {}),
}))

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 5, damageReduced: false })),
}))

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}))

import { executeSpellCast } from './spellCastService.js'

function makeSpell(overrides = {}) {
  return {
    name: 'Magic Missile',
    level: 1,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '120 feet',
    damage: {
      damage_type: 'Force',
      damage_at_slot_level: { 1: '1d4 + 1', 2: '2d4 + 2', 3: '3d4 + 3' },
    },
    ...overrides,
  }
}

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Intelligence', toHit: 9, saveDc: 17, modifier: 5 },
    automation: { passives: [] },
    hitPoints: 100,
    ...overrides,
  }
}

function makeMetaCtx(overrides = {}) {
  return { slotLevel: 1, ...overrides }
}

function makeServices(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn(),
    attackerPos: null, targetPos: null,
    featEffects: {},
    campaignName: 'testCampaign',
    mapName: 'testMap',
    ...overrides,
  }
}

async function resetMocks() {
  const mock = async (path, fnMap) => {
    const m = await import(path)
    for (const [key, value] of Object.entries(fnMap)) {
      m[key].mockImplementation(value)
    }
  }

  await mock('../../../hooks/runtime/useRuntimeState.js', {
    getRuntimeValue: (key1, key2) => {
      if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
      return undefined
    },
    setRuntimeValue: () => {},
  })
  await mock('./postCastRiderService.js', {
    triggerPostCastRiderSaves: async () => null,
    triggerSpellThief: async () => null,
    triggerBewitchingMagic: async () => null,
    triggerSoulstitchSpells: async () => null,
    hasEmpoweredEvocation: () => false,
    getEmpoweredEvocationIntModifier: () => 0,
  })
  await mock('./postCastHealService.js', {
    triggerPostCastSelfHeals: async () => {},
    triggerPostCastAllyHeals: async () => {},
  })
  await mock('../features/falseLifeService.js', {
    triggerFalseLife: async () => {},
  })
  await mock('../features/healingWordService.js', {
    triggerHealingWord: async () => {},
  })
  await mock('../features/invisibilityService.js', {
    endInvisibilityOnHostileAction: () => {},
  })
  await mock('../features/silenceService.js', {
    getSilenceSource: () => null,
    isCreatureInSilenceZone: () => false,
  })
  await mock('../../combat/buffs/buffService.js', {
    isInnateSorceryActive: () => false,
    getActiveBuffs: () => [],
  })
}

describe('executeSpellCast - Magic Missile', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetMocks()
  })

  it('returns early if magicMissileDistribution is empty', async () => {
    const combatData = await import('../../../services/encounters/combatData.js')
    const logService = await import('../../../services/ui/logService.js')

    vi.mocked(combatData.getCombatSummary).mockReturnValue({ creatures: [] })

    const services = makeServices({
      getTargetInfo: async () => ({ name: 'Target' }),
    })

    const metaCtx = makeMetaCtx({ magicMissileDistribution: {} })
    const spell = makeSpell()
    delete spell.dc

    await executeSpellCast(spell, metaCtx, services)
    expect(logService.addEntry).not.toHaveBeenCalled()
  })

  it('fires missiles at targets from distribution', async () => {
    const combatData = await import('../../../services/encounters/combatData.js')
    const applyDamage = await import('../../../services/rules/combat/applyDamage.js')
    const logService = await import('../../../services/ui/logService.js')

    vi.mocked(combatData.getCombatSummary).mockReturnValue({
      creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
    })
    vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

    const services = makeServices({
      getTargetInfo: async () => ({ name: 'Goblin' }),
    })

    const metaCtx = makeMetaCtx({ slotLevel: 1, magicMissileDistribution: { Goblin: 3 } })
    const spell = makeSpell()
    delete spell.dc

    await executeSpellCast(spell, metaCtx, services)
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
      expect.anything(), 'Goblin', 15, ['Force'], 'testCampaign', undefined, false, 'TestWizard'
    )
    expect(logService.addEntry).toHaveBeenCalled()
  })

  it('resolves missile damage individually and sums per-target', async () => {
    const dice = await import('../../dice/diceRoller.js')
    const combatData = await import('../../../services/encounters/combatData.js')
    const applyDamage = await import('../../../services/rules/combat/applyDamage.js')

    vi.mocked(dice.rollExpression).mockReturnValue({ total: 5, rolls: [4], modifier: 1 })
    vi.mocked(combatData.getCombatSummary).mockReturnValue({
      creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
    })
    vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 15, damageReduced: false })

    const services = makeServices({
      getTargetInfo: async () => ({ name: 'Goblin' }),
    })

    const metaCtx = makeMetaCtx({ slotLevel: 1, magicMissileDistribution: { Goblin: 3 } })
    const spell = makeSpell()
    delete spell.dc

    await executeSpellCast(spell, metaCtx, services)
    expect(dice.rollExpression).toHaveBeenCalledWith('1d4 + 1')
  })

  it('blocks damage if target has Shield active', async () => {
    const runtime = await import('../../../hooks/runtime/useRuntimeState.js')
    const combatData = await import('../../../services/encounters/combatData.js')
    const applyDamage = await import('../../../services/rules/combat/applyDamage.js')

    vi.mocked(runtime.getRuntimeValue).mockImplementation((char, key) => {
      if (key === 'activeBuffs') return [{ effect: 'shield' }]
      if (key === 'activeConditions' || key === 'targetEffects') return []
      return undefined
    })
    vi.mocked(combatData.getCombatSummary).mockReturnValue({
      creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
    })

    const services = makeServices({
      getTargetInfo: async () => ({ name: 'Goblin' }),
    })

    const metaCtx = makeMetaCtx({ slotLevel: 1, magicMissileDistribution: { Goblin: 3 } })
    const spell = makeSpell()
    delete spell.dc

    await executeSpellCast(spell, metaCtx, services)
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled()
  })

  it('computes correct missile count for higher slot levels', async () => {
    const dice = await import('../../dice/diceRoller.js')
    const combatData = await import('../../../services/encounters/combatData.js')
    const applyDamage = await import('../../../services/rules/combat/applyDamage.js')

    vi.mocked(dice.rollExpression).mockImplementation(() => ({ total: 5, rolls: [4], modifier: 1 }))
    vi.mocked(combatData.getCombatSummary).mockReturnValue({
      creatures: [{ name: 'Goblin', maxHp: 30, currentHp: 30 }],
    })
    vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

    const services = makeServices({
      getTargetInfo: async () => ({ name: 'Goblin' }),
    })

    const metaCtx = makeMetaCtx({ slotLevel: 3, magicMissileDistribution: { Goblin: 5 } })
    const spell = makeSpell()
    delete spell.dc

    await executeSpellCast(spell, metaCtx, services)
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
      expect.anything(), 'Goblin', 25, ['Force'], 'testCampaign', undefined, false, 'TestWizard'
    )
  })

  it('handles ignore_resistance passive', async () => {
    const combatData = await import('../../../services/encounters/combatData.js')
    const applyDamage = await import('../../../services/rules/combat/applyDamage.js')

    vi.mocked(combatData.getCombatSummary).mockReturnValue({
      creatures: [{ name: 'Goblin', maxHp: 15, currentHp: 15 }],
    })
    vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

    const services = makeServices({
      playerStats: makePlayerStats({
        automation: {
          passives: [{ type: 'auto_effect', effect: 'ignore_resistance' }],
        },
      }),
      getTargetInfo: async () => ({ name: 'Goblin' }),
    })

    const metaCtx = makeMetaCtx({ slotLevel: 1, magicMissileDistribution: { Goblin: 3 } })
    const spell = makeSpell()
    delete spell.dc

    await executeSpellCast(spell, metaCtx, services)
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(
      expect.anything(), 'Goblin', 15, ['Force'], 'testCampaign', undefined, true, 'TestWizard'
    )
  })

  it('targets multiple creatures from distribution', async () => {
    const combatData = await import('../../../services/encounters/combatData.js')
    const applyDamage = await import('../../../services/rules/combat/applyDamage.js')
    const logService = await import('../../../services/ui/logService.js')

    vi.mocked(combatData.getCombatSummary).mockReturnValue({
      creatures: [
        { name: 'Goblin', maxHp: 15, currentHp: 15 },
        { name: 'Orc', maxHp: 30, currentHp: 30 },
      ],
    })
    vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

    const services = makeServices({
      getTargetInfo: async () => ({ name: 'Goblin' }),
    })

    const metaCtx = makeMetaCtx({
      slotLevel: 2,
      magicMissileDistribution: { Goblin: 2, Orc: 2 },
    })
    const spell = makeSpell()
    delete spell.dc

    await executeSpellCast(spell, metaCtx, services)
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(2)
    expect(logService.addEntry).toHaveBeenCalled()
  })

  it('logs each target in the spell entry', async () => {
    const combatData = await import('../../../services/encounters/combatData.js')
    const applyDamage = await import('../../../services/rules/combat/applyDamage.js')
    const logService = await import('../../../services/ui/logService.js')

    vi.mocked(combatData.getCombatSummary).mockReturnValue({
      creatures: [
        { name: 'Goblin', maxHp: 15, currentHp: 15 },
      ],
    })
    vi.mocked(applyDamage.applyDamageToTarget).mockReturnValue({ finalDamage: 5, damageReduced: false })

    const services = makeServices({
      getTargetInfo: async () => ({ name: 'Goblin' }),
    })

    const metaCtx = makeMetaCtx({ slotLevel: 1, magicMissileDistribution: { Goblin: 3 } })
    const spell = makeSpell()
    delete spell.dc

    await executeSpellCast(spell, metaCtx, services)
    expect(logService.addEntry).toHaveBeenCalledWith(
      'testCampaign',
      expect.objectContaining({
        type: 'spell',
        spellName: 'Magic Missile',
        targets: expect.arrayContaining([
          expect.objectContaining({ name: 'Goblin', missiles: 3 }),
        ]),
      })
    )
  })
})
