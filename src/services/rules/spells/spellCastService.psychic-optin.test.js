// @maintained-by-ai
// CLA-268: Psychic Spells (2024 classes.json Warlock majors[3] Great Old One lv3,
// automation {type:'psychic_spells', damageType:'Psychic', componentReduction:['V','S'],
// spellSchools:['enchantment','illusion']}) damage-type swap is OPT-IN at execution.
// Live gate = computePsychicDamageType (execution/index.js:44): swaps only when the
// caster holds the passive AND the cast-time checkbox flag is truthy —
// _psychicSpellsOverride (prepareSpellCast lane) or usePsychicDamage (spell/cantrip
// popup lane, always sent as an explicit boolean per SpellDetailPopup.castCantrip).
// Gate-closed values (missing / false / 0) keep RAW. Swap is type-only: the formula
// and the RAW spell log line stay untouched (CLA-194 family).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

const CAMPAIGN = 'test-campaign'

// Disk-faithful: public/data/2024/classes.json Warlock majors[3] lv3.
const psychicSpellsPassive = {
  type: 'psychic_spells',
  damageType: 'Psychic',
  componentReduction: ['V', 'S'],
  spellSchools: ['enchantment', 'illusion'],
}

// Same passive minus damageType — pins the RAW 'Psychic' fallback default.
const psychicSpellsPassiveNoDamageType = {
  type: 'psychic_spells',
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
    campaignName: CAMPAIGN,
    mapName: null,
    characters: [],
    ...overrides,
  }
}

// Exact key set handed to rollAttack by noSavePath.buildNoSaveAttackContext
// (spread of the cast metaCtx included). No fabricated keys.
const ATTACK_CTX_KEYS = [
  'attackerName',
  'attackName',
  'autoDamageFormula',
  'autoDamageName',
  'autoDamageRollResult',
  'autoDamageSchool',
  'damageType',
  'featsOfChaosArmedAtCast',
  'finalFormula',
  'isCantrip',
  'metamagicHeighten',
  'overchannelActive',
  'overchannelSpellLevel',
  'overchannelUseCount',
  'playerStats',
  'slotLevel',
  'spellName',
  'targetName',
].sort()

async function castFireBoltAndCaptureCtx(services, spellOverrides = {}) {
  const spell = makeFireBolt(spellOverrides)
  await executeSpellCast(spell, { slotLevel: 0 }, services)

  expect(services.rollAttack).toHaveBeenCalledTimes(1)
  const args = services.rollAttack.mock.calls[0]
  expect(args).toHaveLength(3)
  const [attackName, spellToHit, ctx] = args
  expect(attackName).toBe('Fire Bolt')
  expect(spellToHit).toBe(9)
  expect(Object.keys(ctx).sort()).toEqual(ATTACK_CTX_KEYS)
  expect(ctx.targetName).toBe('Ogre Zombie 1')
  expect(ctx.attackerName).toBe('HexWarlock')
  expect(ctx.isCantrip).toBe(true)
  expect(ctx.playerStats).toBe(services.playerStats)
  return ctx
}

describe('executeSpellCast — Psychic Spells opt-in damage type (CLA-268)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // lookupFullSpell traverses for any spell without area_of_effect — stub is
    // URL-aware: only the 2024 ruleset catalog resolves, anything else 404s.
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: url === '/data/2024/spells.json',
      json: async () => (url === '/data/2024/spells.json'
        ? [{ name: 'Fire Bolt', level: 0, school: 'Evocation' }]
        : []),
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    { label: 'flag absent', spell: {}, expected: 'Fire' },
    { label: 'usePsychicDamage:false', spell: { usePsychicDamage: false }, expected: 'Fire' },
    { label: 'usePsychicDamage:0', spell: { usePsychicDamage: 0 }, expected: 'Fire' },
    { label: '_psychicSpellsOverride:false', spell: { _psychicSpellsOverride: false }, expected: 'Fire' },
    { label: '_psychicSpellsOverride:true (prepareSpellCast lane)', spell: { _psychicSpellsOverride: true }, expected: 'Psychic' },
    { label: 'usePsychicDamage:true (spell popup lane)', spell: { usePsychicDamage: true }, expected: 'Psychic' },
    {
      label: 'opt-in with passive lacking damageType falls back to RAW Psychic',
      spell: { usePsychicDamage: true },
      stats: makeWarlockStats([psychicSpellsPassiveNoDamageType]),
      expected: 'Psychic',
    },
  ])('damageType is $expected when the opt-in gate is $label', async ({ spell, stats, expected }) => {
    const services = makeServices(stats ? { playerStats: stats } : {})
    const ctx = await castFireBoltAndCaptureCtx(services, spell)

    expect(ctx.damageType).toBe(expected)
  })

  it('does not swap without the Psychic Spells passive even when opted in', async () => {
    const services = makeServices({ playerStats: makeWarlockStats([]) })
    const ctx = await castFireBoltAndCaptureCtx(services, {
      usePsychicDamage: true,
      _psychicSpellsOverride: true,
    })

    expect(ctx.damageType).toBe('Fire')
  })

  it('swap is type-only: formula unchanged, spell payload unpolluted, cast log keeps RAW Fire', async () => {
    const services = makeServices()
    const spell = makeFireBolt({ usePsychicDamage: true })
    await executeSpellCast(spell, { slotLevel: 0 }, services)

    expect(services.rollAttack).toHaveBeenCalledTimes(1)
    const args = services.rollAttack.mock.calls[0]
    expect(args).toHaveLength(3)
    const [attackName, spellToHit, ctx] = args
    expect(attackName).toBe('Fire Bolt')
    expect(spellToHit).toBe(9)
    expect(Object.keys(ctx).sort()).toEqual(ATTACK_CTX_KEYS)
    expect(ctx.damageType).toBe('Psychic')
    // fix#121(e): CL14 caster — the cantrip ladder now resolves at character
    // level (disk damage_at_character_level tier '11'), so the hub bake is
    // '3d10', not the retired level-1 '1d10' tier.
    expect(ctx.autoDamageFormula).toBe('3d10')
    expect(ctx.autoDamageSchool).toBe('Evocation')

    // Purity: the executed spell object keeps RAW type/components after swap.
    expect(spell.damage.damage_type).toBe('Fire')
    expect(spell.components).toEqual(['V', 'S'])

    // Cast log line keeps the RAW damage type (CLA-194 family): only the
    // attack ctx receives the swap.
    const { addEntry } = await import('../../ui/logService.js')
    expect(addEntry).toHaveBeenCalledTimes(1)
    const [logCampaign, entry] = addEntry.mock.calls[0]
    expect(logCampaign).toBe(CAMPAIGN)
    expect({ ...entry, timestamp: undefined }).toEqual({
      type: 'spell',
      characterName: 'HexWarlock',
      targetName: 'Ogre Zombie 1',
      spellName: 'Fire Bolt',
      spellLevel: 0,
      castingTime: '1 action',
      damageType: 'Fire',
      damageFormula: '3d10', // fix#121(e): character-level cantrip tier at CL14
      saveDC: null,
      concentration: false,
      description: null,
      timestamp: undefined,
    })
    // Ruleset-aware lookup URL (2024 char -> /data/2024/spells.json).
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/data/2024/spells.json')
  })
})
