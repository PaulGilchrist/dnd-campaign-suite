// CLA-268: the Psychic Spells damage-type swap must be OPT-IN — it fires only when
// the cast-time checkbox flag (_psychicSpellsOverride / usePsychicDamage) is truthy.
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { executeSpellCast } from './spellCastService.js'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn((_key1, key2) => {
    if (key2 === 'activeConditions' || key2 === 'targetEffects') return []
    return undefined
  }),
}))

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [1, 2, 3, 4], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true })),
}))

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}))

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}))

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  loadCombatSummary: vi.fn(),
}))

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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
  triggerPostCastRiderSaves: vi.fn(() => Promise.resolve()),
  triggerSpellThief: vi.fn(() => Promise.resolve()),
  triggerBewitchingMagic: vi.fn(() => Promise.resolve()),
  triggerSoulstitchSpells: vi.fn(() => Promise.resolve()),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('./postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(() => Promise.resolve()),
  triggerPostCastAllyHeals: vi.fn(() => Promise.resolve()),
}))

vi.mock('../features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(() => Promise.resolve()),
}))

vi.mock('../features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(() => Promise.resolve()),
}))

vi.mock('../features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(() => Promise.resolve()),
}))

vi.mock('../features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}))

vi.mock('../combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  computeEffectiveSpellRange: vi.fn(() => 120),
  getDistanceFeet: vi.fn(() => 30),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 60)),
}))

const psychicSpellsPassive = {
  type: 'psychic_spells',
  damageType: 'Psychic',
  componentReduction: ['V', 'S'],
  spellSchools: ['enchantment', 'illusion'],
}

function makeFireBolt(overrides = {}) {
  return {
    name: 'Fire Bolt',
    level: 0,
    baseLevel: 0,
    school: 'Evocation',
    casting_time: '1 action',
    components: ['V', 'S'],
    range: '120 feet',
    attack_type: 'ranged',
    damage: {
      damage_type: 'Fire',
      damage_at_character_level: { 1: '1d10', 11: '3d10' },
    },
    ...overrides,
  }
}

function makeWarlockStats(passives = [psychicSpellsPassive]) {
  return {
    name: 'HexWarlock',
    class: { name: 'Warlock' },
    rules: '2024',
    abilities: [{ name: 'Charisma', bonus: 4 }],
    proficiency: 5,
    spellAbilities: {
      spellCastingAbility: 'Charisma',
      toHit: 9,
      saveDc: 16,
      modifier: 4,
    },
    automation: { passives },
    hitPoints: 73,
    level: 14,
  }
}

function makeServices(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makeWarlockStats(),
    getTargetInfo: vi.fn(async () => ({ name: 'Ogre Zombie 1' })),
    attackerPos: null,
    targetPos: null,
    featEffects: {},
    campaignName: 'testCampaign',
    mapName: null,
    characters: [],
    ...overrides,
  }
}

describe('executeSpellCast — Psychic Spells opt-in damage type (CLA-268)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps RAW damage type (Fire) when the opt-in flag is absent', async () => {
    const services = makeServices()
    await executeSpellCast(makeFireBolt(), { slotLevel: 0 }, services)

    expect(services.rollAttack).toHaveBeenCalled()
    expect(services.rollAttack.mock.calls[0][2].damageType).toBe('Fire')
  })

  it('keeps RAW damage type (Fire) when usePsychicDamage is explicitly false', async () => {
    const services = makeServices()
    await executeSpellCast(makeFireBolt({ usePsychicDamage: false }), { slotLevel: 0 }, services)

    expect(services.rollAttack.mock.calls[0][2].damageType).toBe('Fire')
  })

  it('swaps to Psychic when _psychicSpellsOverride is set (prepareSpellCast opt-in)', async () => {
    const services = makeServices()
    await executeSpellCast(makeFireBolt({ _psychicSpellsOverride: true }), { slotLevel: 0 }, services)

    expect(services.rollAttack.mock.calls[0][2].damageType).toBe('Psychic')
  })

  it('swaps to Psychic when usePsychicDamage is set (cantrip popup opt-in)', async () => {
    const services = makeServices()
    await executeSpellCast(makeFireBolt({ usePsychicDamage: true }), { slotLevel: 0 }, services)

    expect(services.rollAttack.mock.calls[0][2].damageType).toBe('Psychic')
  })

  it('does not swap without the Psychic Spells passive even when opted in', async () => {
    const services = makeServices({ playerStats: makeWarlockStats([]) })
    await executeSpellCast(makeFireBolt({ usePsychicDamage: true, _psychicSpellsOverride: true }), { slotLevel: 0 }, services)

    expect(services.rollAttack.mock.calls[0][2].damageType).toBe('Fire')
  })
})
