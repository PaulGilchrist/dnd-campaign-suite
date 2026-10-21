// @maintained-by-ai
/* ------------------------------------------------------------------ */
/*  spellCastService.hexEffects — hub-routed Hex EFFECT application   */
/*                                                                     */
/*  Lane span (execution/index.js :492-501 castHex + REAL helpers.js */
/*  :17-73 applyHexEffects): what executeSpellCast('Hex') STORES.    */
/*  Owner split (cited by neighbors — preserved):                     */
/*   - #1475 execution-early-resolutions owns the hex cast LOG        */
/*     full shape and the single applyHexEffects call-tuple census    */
/*     (helpers mocked there; :514 CLA-389 skip pinned there).       */
/*   - helpers.test.js owns applyHexEffects DIRECT unit bytes          */
/*     (guards, stamps, merged expiry legs).                          */
/*   - hexDamage.test.js #1054 owns HIT-time +1d6 necrotic;           */
/*     eldritchStrikes #1051 owns strike consumption. NOT here.       */
/*   - execution-early-resolutions:18 hands 'applyHexEffects writes   */
/*     / CLA-107' to THIS lane: end-to-end hub→REAL-helper store     */
/*     bytes, CLA-107 exact console byte, and expiry-arm censuses     */
/*     that a mocked-helper lane and a helper-direct lane cannot see. */
/*  Registry: te keys hex_ability_check_disadvantage (:450) and       */
/*  hex_save_disadvantage (:476) in targetEffectDefinitions.js; the  */
/*  ability rides UPPERCASE chooser bytes ('DEX') per registry note   */
/*  :1526-1527 (CLA-107). Disk provenance: public/data/2024/spells.  */
/*  json Hex row — 5e spells.json has NO Hex row (ruleset            */
/*  divergence: only the 2024 dataset supplies it).                    */
/*  Old->new map: 6 tests -> 3 (both Eldritch arms table-driven in   */
/*  test 1; log-shape rows folded out — owned by #1475; unit-bytes   */
/*  rows folded out — owned by helpers.test.js).                      */
/* ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cloneDeep } from 'lodash'
import spells2024 from '../../../../../../public/data/2024/spells.json'
import { getEffectDefinition, TARGET_EFFECT_DEFINITIONS } from '../../../../combat/conditions/targetEffectDefinitions.js'

/* Fixture provenance: the REAL 2024 disk row, existence-censused at  */
/* load (CLA-107 #1475-window drift guard).                           */
const HEX_DISK = spells2024.find(s => s.name === 'Hex')
if (!HEX_DISK) throw new Error('disk census: Hex row missing from public/data/2024/spells.json')

/* ------------------------------------------------------------------ */
/*  Mocks — dependencies of execution/index.js + helpers.js reachable */
/*  from the Hex cast lane. fearService/heroismService mocks PURGED: */
/*  dead-module hunt — nothing in the live graph imports them (the    */
/*  only consumers, automation/index.js barrel and concentration       */
/*  Service, are fully replaced / unreachable from spellCastService). */
/* ------------------------------------------------------------------ */

vi.mock('../../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}))

vi.mock('../../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}))

vi.mock('../../../../rules/spells/postCastRiderService.js', () => ({
  triggerPostCastRiderSaves: vi.fn(async () => null),
  triggerSpellThief: vi.fn(async () => null),
  triggerBewitchingMagic: vi.fn(async () => null),
  triggerSoulstitchSpells: vi.fn(async () => null),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('../../../../rules/spells/postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(async () => {}),
  triggerPostCastAllyHeals: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/silenceService.js', () => ({
  getSilenceSource: vi.fn(() => null),
  isCreatureInSilenceZone: vi.fn(() => false),
}))

vi.mock('../../../../rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}))

vi.mock('../../../../rules/features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}))

vi.mock('../../../../rules/features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/falseLifeService.js', () => ({
  triggerFalseLife: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/fleshToStoneService.js', () => ({
  triggerFleshToStone: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/holdMonsterService.js', () => ({
  triggerHoldMonster: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/hypnoticPatternService.js', () => ({
  triggerHypnoticPattern: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/massSuggestionService.js', () => ({
  triggerMassSuggestion: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/suggestionService.js', () => ({
  triggerSuggestion: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/ottoDanceService.js', () => ({
  triggerOttoDance: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/resilientSphereService.js', () => ({
  triggerResilientSphere: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/foresightService.js', () => ({
  triggerForesight: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/rayOfEnfeeblementService.js', () => ({
  triggerRayOfEnfeeblement: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/globeOfInvulnerabilityService.js', () => ({
  triggerGlobeOfInvulnerability: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/forcecageService.js', () => ({
  triggerForcecage: vi.fn(async () => {}),
}))

vi.mock('../../../../automation/handlers/spells/forcecageHandler.js', () => ({
  isForcecageBlocked: vi.fn(() => false),
}))

vi.mock('../../../../rules/features/holyAuraService.js', () => ({
  triggerHolyAura: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/powerWordStunService.js', () => ({
  triggerPowerWordStun: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/seeInvisibilityService.js', () => ({
  triggerSeeInvisibility: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/sleepService.js', () => ({
  triggerSleep: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/stinkingCloudService.js', () => ({
  triggerStinkingCloud: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/tashasHideousLaughterService.js', () => ({
  triggerTashasHideousLaughter: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/removeCurseService.js', () => ({
  triggerRemoveCurse: vi.fn(async () => {}),
}))

vi.mock('../../../../rules/features/slowService.js', () => ({
  triggerSlow: vi.fn(async () => {}),
}))

vi.mock('../../../../combat/buffs/buffService.js', () => ({
  isInnateSorceryActive: vi.fn(() => false),
  getActiveBuffs: vi.fn(() => []),
}))

vi.mock('../../../../rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  computeEffectiveSpellRange: vi.fn(() => 60),
  getDistanceFeet: vi.fn(() => 30),
  rangeToFeet: vi.fn((r) => typeof r === 'number' ? r : 60),
}))

vi.mock('../../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}))

vi.mock('../../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}))

vi.mock('../../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}))

vi.mock('../../../../automation/handlers/class-wizard/arcaneWardHandler.js', () => ({
  onAbjurationSpellCast: vi.fn(),
}))

import { executeSpellCast } from './index.js'
import * as runtimeState from '../../../../../hooks/runtime/useRuntimeState.js'
import { addEntry } from '../../../../ui/logService.js'
import { addExpiration } from '../../../../rules/effects/expirations.js'

const CAMPAIGN = 'test-campaign'
const CASTER = 'TestWarlock'
const CAST_HEX_ABILITY_ERR =
  '[spellCast] castHex: hexAbility is missing from metaCtx — chooser selection was dropped; applying zero hex effects'

/* lookupFullSpell transport stub: serve the same REAL disk dataset the */
/* fixture was cut from; pins the 2024 dual-ruleset path byte.          */
const fetchMock = vi.fn(async (_url) => ({
  ok: true,
  json: async () => spells2024,
}))
vi.stubGlobal('fetch', fetchMock)

function makePlayerStats(passives = []) {
  return {
    name: CASTER,
    rules: '2024',
    abilities: [{ name: 'Charisma', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Charisma', toHit: 9, saveDc: 17, modifier: 5,
    },
    automation: { passives },
  }
}

function makeServices(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn(async () => undefined),
    attackerPos: null, targetPos: null,
    featEffects: {},
    campaignName: CAMPAIGN,
    mapName: 'testMap',
    characters: [],
    ...overrides,
  }
}

function hexWrites() {
  return runtimeState.setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects')
}

async function castHex(services, metaCtx = { slotLevel: 1 }) {
  // Fresh clone per cast: the hub may decorate the spell
  // (applyPsychicComponentReduction) — disk row must stay pristine.
  return executeSpellCast(cloneDeep(HEX_DISK), metaCtx, services)
}

describe('executeSpellCast - Hex targetEffects application (hub to REAL applyHexEffects)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runtimeState.getRuntimeValue.mockImplementation(() => undefined)
  })

  /* Two arms, full-set equality: the Eldritch row also kills the    */
  /* 'always add save te' mutant this lane would not see if only the  */
  /* Eldritch arm ran (helpers.test.js kills it at the direct unit —  */
  /* this lane proves it survives the hub threading).                  */
  it('threads the uppercase chooser ability through castHex into the stored store: stale hex legs replaced in place, bystander tes preserved positionally, and ONE merged expiry armed', async () => {
    const bystander = { target: 'Other', effect: 'sanctuary', source: 'Cleric One' }
    const arms = [
      {
        label: 'base Hex (no Eldritch Hex passive)',
        passives: [],
        seed: [
          { target: 'Goblin', effect: 'hex_ability_check_disadvantage', source: CASTER, ability: 'STR', duration: 'stale' },
          bystander,
        ],
        expectedStored: [
          { target: 'Goblin', effect: 'hex_ability_check_disadvantage', source: CASTER, ability: 'DEX', duration: 'hex_duration' },
          bystander,
        ],
        expectedExpiryKeys: ['hex_ability_check_disadvantage'],
      },
      {
        label: 'Hex with Eldritch Hex passive',
        passives: [{ name: 'Eldritch Hex', type: 'conditional_disadvantage' }],
        seed: [
          { target: 'Goblin', effect: 'hex_ability_check_disadvantage', source: CASTER, ability: 'STR', duration: 'stale' },
          bystander,
          { target: 'Goblin', effect: 'hex_save_disadvantage', source: CASTER, ability: 'STR', duration: 'stale' },
        ],
        expectedStored: [
          { target: 'Goblin', effect: 'hex_ability_check_disadvantage', source: CASTER, ability: 'DEX', duration: 'hex_duration' },
          bystander,
          { target: 'Goblin', effect: 'hex_save_disadvantage', source: CASTER, ability: 'DEX', duration: 'hex_duration' },
        ],
        expectedExpiryKeys: ['hex_ability_check_disadvantage', 'hex_save_disadvantage'],
      },
    ]

    for (const { label, passives, seed, expectedStored, expectedExpiryKeys } of arms) {
      vi.clearAllMocks()
      runtimeState.getRuntimeValue.mockImplementation((_, key) => {
        if (key === 'targetEffects') return [...seed]
        return undefined
      })

      const services = makeServices({
        playerStats: makePlayerStats(passives),
        getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
      })

      await castHex(services, { slotLevel: 1, hexAbility: 'DEX' })

      // Arity-pinned exact tuple, full-set equality: exactly ONE
      // targetEffects write; in-place replacement (positional equality
      // kills push-instead-of-replace and reorder mutants).
      expect(hexWrites(), label).toEqual([
        ['campaign', 'targetEffects', expectedStored, CAMPAIGN],
      ])

      // Registry mandate: every stamped te.effect exists in
      // targetEffectDefinitions.js; the hex legs are ability-scoped.
      const registryKeys = TARGET_EFFECT_DEFINITIONS.map(d => d.effect)
      for (const te of expectedStored) {
        expect(registryKeys, label).toContain(te.effect)
        if (te.effect.startsWith('hex_')) {
          expect(getEffectDefinition(te.effect).fields, label).toContain('ability')
        }
      }

      // CLA-107 merged expiry armed once with this caster/target and the
      // stamped legs (rounds byte itself owned by helpers.test.js :233).
      expect(addExpiration.mock.calls.length, label).toBe(1)
      const expiry = addExpiration.mock.calls[0][0]
      expect(expiry.attackerName, label).toBe(CASTER)
      expect(expiry.targetName, label).toBe('Goblin')
      expect(expiry.campaignName, label).toBe(CAMPAIGN)
      expect(expiry.effects.map(e => e.effectKey), label).toEqual(expectedExpiryKeys)

      // Dual-ruleset transport byte: rules '2024' resolves the 2024 disk.
      expect(fetchMock, label).toHaveBeenCalledWith('/data/2024/spells.json')
    }
  })

  // CLA-107: chooser selection dropped upstream (index.js:495-497) —
  // exact console byte is castHex's own and pinned nowhere else.
  it('CLA-107: missing hexAbility console.errors the exact castHex byte, stores zero hex effects, and arms zero expiry clocks (no STR coercion)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    runtimeState.getRuntimeValue.mockImplementation((_, key) => {
      if (key === 'targetEffects') return []
      return undefined
    })

    const services = makeServices({
      playerStats: makePlayerStats([{ name: 'Eldritch Hex', type: 'conditional_disadvantage' }]),
      getTargetInfo: vi.fn(async () => ({ name: 'Goblin' })),
    })

    await castHex(services)

    expect(errSpy).toHaveBeenCalledTimes(1)
    expect(errSpy).toHaveBeenCalledWith(CAST_HEX_ABILITY_ERR)
    expect(hexWrites()).toEqual([])
    expect(addExpiration.mock.calls).toEqual([])
    // The paid cast still logs its Hex entry (shape owned by #1475 —
    // only the dropped-ability byte is checked here).
    expect(addEntry.mock.calls.length).toBe(1)
    expect(addEntry.mock.calls[0][1].hexAbility).toBeNull()
    errSpy.mockRestore()
  })

  it('an unresolvable target stores zero hex effects and arms zero expiry clocks', async () => {
    runtimeState.getRuntimeValue.mockImplementation((_, key) => {
      if (key === 'targetEffects') return []
      return undefined
    })

    // No metaCtx.targetName AND getTargetInfo resolves nothing:
    // castHex :494 fallback chain must yield an undefined target that
    // applyHexEffects :20 guards before any write.
    await castHex(makeServices())

    expect(hexWrites()).toEqual([])
    expect(addExpiration.mock.calls).toEqual([])
  })
})
