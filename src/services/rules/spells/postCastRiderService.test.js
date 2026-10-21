// @maintained-by-ai
// SERVICE lane (CLA-037 family): rules/spells/postCastRiderService.js — saves/spreads
// and school/casting-time gates, NOT heals (postCastHeal twin owns heals, #1452).
// Split vs automation/handlers/combat/postCastRiderService.test.js (declared in its
// header): that twin owns uses-boundary(0/neg), `?? 1` default, usesKey splice,
// throw-on-missing-array, null-result filtering, rider error rethrow, null metaCtx,
// undefined spell — deliberately NOT re-pinned here. This file owns: selectors
// (full-set identity), rider envelope shapes BOTH formats (inline unique producer —
// save creation delegates to generic savePrompt lane via post_cast_rider →
// handlePostCastRider, automation/index.js:363; this service stamps NO te.repeatSave),
// soulstitch/bewitching gates + envelopes + modal bridges, spell_thief discovery
// (deferred to here by spellThiefHandler.test.js:7) + CLA-325 inertness, and the
// multi_target_spread disk-shape mismatch quirk.
// Disk provenance (2024/classes.json): riderSave producer = Bard "Beguiling Magic"
// (riderSave byte-faithful below); bewitching = Warlock automation[0]; soulstitch /
// empowered_evocation = Wizard; spell_thief = Rogue automation (INT save — never
// reached here, inert CLA-325). Top-level type 'multi_target_spread' and
// 'post_cast_rider' have ZERO disk class rows (disk nests spellFilter under
// passive_rule.multi_target_spread on Bard "Words of Creation") — custom-only
// producers; pinned honestly below. No clock stored by this service: duration bytes
// ('1_minute', '1_round') pass through verbatim to the handler lane.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { executeHandler } from '../../automation/index.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import {
  getPostCastRiderSaves,
  getSpellThiefFeatures,
  getMultiTargetSpreads,
  getMultiTargetSpreadForSpell,
  triggerPostCastRiderSaves,
  getSoulstitchFeatures,
  triggerSoulstitchSpells,
  getEmpoweredEvocationFeatures,
  getEmpoweredEvocationIntModifier,
  triggerSpellThief,
  getBewitchingMagicFeatures,
  triggerBewitchingMagic,
  confirmSoulstitchSelection,
} from './postCastRiderService.js'

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => 1),
}))

vi.mock('../../automation/index.js', () => ({
  executeHandler: vi.fn(),
}))

const CAMP = 'camp'
const MAP = 'map'
const defaultPopup = () => ({ type: 'popup', payload: { ok: true } })

// Real disk bytes: 2024 Bard "Beguiling Magic" automation row (riderSave producer).
const diskBardRiderPassive = () => ({
  type: 'passive_rule',
  name: 'Beguiling Magic',
  effect: 'always_prepared_spells',
  spells: ['Charm Person', 'Mirror Image'],
  riderSave: {
    type: 'WIS',
    condition: 'Charmed or Frightened',
    duration: '1_minute',
    after: 'enchantment_or_illusion_spell',
    range: '60 ft',
    recharge: 'long_rest',
  },
  casting_time: 'passive',
})

describe('postCastRiderService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRuntimeValue.mockReturnValue(1)
    executeHandler.mockImplementation(async () => defaultPopup())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getPostCastRiderSaves selector', () => {
    it('accepts post_cast_rider and passive_rule-with-truthy-riderSave only, order-stable, by identity', () => {
      const custom = { type: 'post_cast_rider', name: 'Custom Rider' }
      const bard = diskBardRiderPassive()
      const plainRule = { type: 'passive_rule', name: 'Plain Rule' }
      const falseSave = { type: 'passive_rule', riderSave: false, name: 'False Save' }
      const noise = { type: 'empowered_evocation', name: 'Empowered' }
      const result = getPostCastRiderSaves({ automation: { passives: [noise, custom, plainRule, bard, falseSave] } })
      expect(result).toHaveLength(2)
      expect(result[0]).toBe(custom)
      expect(result[1]).toBe(bard)
    })
  })

  describe('getSpellThiefFeatures selector', () => {
    it('scans reactions only, matching spell_thief type by identity', () => {
      // Disk byte fidelity: 2024 Rogue "Spell Thief" automation row.
      const thief = { type: 'spell_thief', name: 'Spell Thief', saveType: 'INT', saveDc: 'ability', saveAbility: 'INT', trigger: 'spell_cast', oncePerLongRest: true, casting_time: '1 reaction' }
      const otherReaction = { type: 'opportunity_attack', name: 'OA' }
      const passiveLookalike = { type: 'spell_thief', name: 'Passive Lane Thief' }
      const stats = { automation: { reactions: [otherReaction, thief], passives: [passiveLookalike] } }
      const result = getSpellThiefFeatures(stats)
      expect(result).toHaveLength(1)
      expect(result[0]).toBe(thief)
    })
  })

  describe('multi_target_spread selection', () => {
    it('filters top-level type, returns first exact-name match by identity, misses null, throws on missing spellFilter', () => {
      const spreadA = { type: 'multi_target_spread', name: 'Spread A', spellFilter: ['Fireball', 'Power Word Heal'], range: '10 ft' }
      const spreadB = { type: 'multi_target_spread', name: 'Spread B', spellFilter: ['Fireball'], range: '5 ft' }
      const noise = { type: 'bewitching_magic', name: 'Bewitch' }
      const stats = { automation: { passives: [noise, spreadA, spreadB] } }
      expect(getMultiTargetSpreads(stats)).toHaveLength(2)
      // first-match order (both contain Fireball): spreadA wins.
      expect(getMultiTargetSpreadForSpell(stats, 'Fireball')).toBe(spreadA)
      expect(getMultiTargetSpreadForSpell(stats, 'Power Word Heal')).toBe(spreadA)
      // filter.includes is byte-exact — lowercase near-miss misses.
      expect(getMultiTargetSpreadForSpell(stats, 'fireball')).toBeNull()
      expect(getMultiTargetSpreadForSpell(stats, 'Iceball')).toBeNull()
    })

    it('quirk pin: disk passive_rule.multi_target_spread nested shape never matches the type filter', () => {
      // Real 2024 Bard "Words of Creation" row nests spellFilter under a
      // multi_target_spread KEY of a passive_rule — no shipped disk class produces a
      // top-level type 'multi_target_spread' passive, so this lane is custom-data-only.
      const diskRow = {
        type: 'passive_rule',
        name: 'Words of Creation',
        effect: 'always_prepared_spells',
        spells: ['Power Word Heal', 'Power Word Kill'],
        multi_target_spread: { spellFilter: ['Power Word Heal', 'Power Word Kill'], range: '10 ft' },
        casting_time: 'passive',
      }
      expect(getMultiTargetSpreads({ automation: { passives: [diskRow] } })).toEqual([])
      expect(getMultiTargetSpreadForSpell({ automation: { passives: [diskRow] } }, 'Power Word Kill')).toBeNull()
    })

    it('throws with console.error when a matching-passive lacks spellFilter', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const noFilter = { type: 'multi_target_spread', name: 'NoFilter' }
      expect(() => getMultiTargetSpreadForSpell({ automation: { passives: [noFilter] } }, 'Fireball')).toThrow('Expected array, got undefined')
      expect(spy).toHaveBeenCalledWith('[postCastRiderService] Missing array:', undefined)
    })
  })

  describe('triggerPostCastRiderSaves', () => {
    const stats = (passives) => ({ name: 'Player', automation: { passives } })

    it('gates out non-enchantment/illusion schools and missing school before touching uses or handler', async () => {
      const riders = stats([{ type: 'post_cast_rider', name: 'Rider' }])
      for (const spell of [{ name: 'Fireball', school: 'evocation' }, { name: 'Cure Wounds', school: 'necromancy' }, { name: 'Unknown' }]) {
        expect(await triggerPostCastRiderSaves(spell, { slotLevel: 1 }, riders, CAMP, MAP)).toBeNull()
      }
      expect(getRuntimeValue).not.toHaveBeenCalled()
      expect(executeHandler).not.toHaveBeenCalled()
    })

    it('gates out slot-less casts (slotLevel 0 AND spell.level 0) but fires for level>0 without slotLevel', async () => {
      const riders = stats([{ type: 'post_cast_rider', name: 'Rider' }])
      expect(await triggerPostCastRiderSaves({ name: 'Mind Sliver', school: 'enchantment', level: 0 }, { slotLevel: 0 }, riders, CAMP, MAP)).toBeNull()
      expect(executeHandler).not.toHaveBeenCalled()
      const result = await triggerPostCastRiderSaves({ name: 'Charm Person', school: 'enchantment', level: 1 }, {}, riders, CAMP, MAP)
      expect(result).toHaveLength(1)
      expect(executeHandler).toHaveBeenCalledTimes(1)
    })

    it('builds the full post_cast_rider action envelope (all fields copied) with (stats, camp, map) tuple', async () => {
      const rider = {
        type: 'post_cast_rider',
        name: 'Custom Rider',
        saveType: 'CON',
        saveDc: 15,
        saveAbility: 'CON',
        condition: 'stunned',
        duration: '1_round',
        range: '60 ft',
        spellSchools: ['enchantment'],
        recharge: 'long_rest',
      }
      const ps = stats([rider])
      const handlerResult = { type: 'save_prompt', promptId: 'p1' }
      executeHandler.mockImplementation(async () => handlerResult)
      const result = await triggerPostCastRiderSaves({ name: 'Charm Person', school: 'enchantment' }, { slotLevel: 1 }, ps, CAMP, MAP)
      expect(executeHandler).toHaveBeenCalledTimes(1)
      const [action, argStats, argCamp, argMap] = executeHandler.mock.calls[0]
      expect(executeHandler.mock.calls[0]).toHaveLength(4)
      expect(action).toStrictEqual({
        name: 'Custom Rider',
        automation: {
          type: 'post_cast_rider',
          saveType: 'CON',
          saveDc: 15,
          saveAbility: 'CON',
          condition: 'stunned',
          duration: '1_round',
          range: '60 ft',
          spellSchools: ['enchantment'],
          recharge: 'long_rest',
        },
      })
      expect(argStats).toBe(ps)
      expect(argCamp).toBe(CAMP)
      expect(argMap).toBe(MAP)
      expect(result).toHaveLength(1)
      expect(result[0]).toBe(handlerResult)
    })

    it('riderSave branch hardcodes saveDc=ability/saveAbility=CHA, drops after/effect, copies disk bytes verbatim', async () => {
      const bard = diskBardRiderPassive()
      const ps = stats([bard])
      await triggerPostCastRiderSaves({ name: 'Charm Person', school: 'Enchantment' }, { slotLevel: 1 }, ps, CAMP, MAP)
      const [action] = executeHandler.mock.calls[0]
      expect(action).toStrictEqual({
        name: 'Beguiling Magic',
        automation: {
          type: 'post_cast_rider',
          saveType: 'WIS',
          saveDc: 'ability',
          saveAbility: 'CHA',
          condition: 'Charmed or Frightened',
          duration: '1_minute',
          range: '60 ft',
          recharge: 'long_rest',
        },
      })
    })

    it('dispatches every non-exhausted rider, collects truthy results in order, null when all falsy', async () => {
      const ps = stats([
        { type: 'post_cast_rider', name: 'Loud Rider' },
        { type: 'passive_rule', name: 'Beguiling Magic', riderSave: diskBardRiderPassive().riderSave },
        { type: 'post_cast_rider', name: 'Silent Rider' },
      ])
      executeHandler.mockImplementation(async (action) => (action.name === 'Silent Rider' ? null : { id: action.name }))
      const result = await triggerPostCastRiderSaves({ name: 'Charm Person', school: 'illusion' }, { slotLevel: 2 }, ps, CAMP, MAP)
      expect(executeHandler).toHaveBeenCalledTimes(3)
      expect(result).toEqual([{ id: 'Loud Rider' }, { id: 'Beguiling Magic' }])

      executeHandler.mockResolvedValue(null)
      expect(await triggerPostCastRiderSaves({ name: 'Charm Person', school: 'illusion' }, { slotLevel: 2 }, ps, CAMP, MAP)).toBeNull()
    })
  })

  describe('soulstitch lane (2024 Wizard)', () => {
    const evocationSpell = () => ({ name: 'Fireball', school: 'Evocation', level: 3, dc: { dc_type: 'CON' } })
    const soulstitchStats = () => ({ automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch Spells', casting_time: 'passive' }] } })

    it('getSoulstitchFeatures filters type by identity', () => {
      const feature = soulstitchStats().automation.passives[0]
      const noise = { type: 'empowered_evocation', name: 'Empowered' }
      const result = getSoulstitchFeatures({ automation: { passives: [noise, feature] } })
      expect(result).toEqual([feature])
      expect(result[0]).toBe(feature)
    })

    it('gates out no-features, non-evocation, missing school, and save-less spells before dispatch', async () => {
      const cases = [
        [evocationSpell(), { automation: { passives: [] } }],
        [{ name: 'Charm Person', school: 'Enchantment', dc: { dc_type: 'WIS' } }, soulstitchStats()],
        [{ name: 'Mystery', level: 3, dc: { dc_type: 'CON' } }, soulstitchStats()],
        [{ name: 'Fireball', school: 'evocation', level: 3 }, soulstitchStats()],
      ]
      for (const [spell, ps] of cases) {
        expect(await triggerSoulstitchSpells(spell, {}, ps, CAMP, MAP)).toBeNull()
      }
      expect(executeHandler).not.toHaveBeenCalled()
    })

    it('dispatches exact envelope with slot-level derivation (metaCtx wins, spell.level fallback, 0 default) and forwards non-modal results', async () => {
      const cases = [
        [{ slotLevel: 3 }, { ...evocationSpell(), level: 5 }, 3, 'evocation'],
        [{}, evocationSpell(), 3, 'Evocation'],
        [{ slotLevel: 0 }, { name: 'Fire Bolt', school: 'evocation', level: 0, dc: { dc_type: 'CON' } }, 0, 'evocation'],
      ]
      for (const [metaCtx, spell, expectedSlot, school] of cases) {
        executeHandler.mockClear()
        const ps = soulstitchStats()
        const sentSpell = { ...spell, school }
        const handlerResult = { type: 'popup', payload: { slot: expectedSlot } }
        executeHandler.mockImplementation(async () => handlerResult)
        const result = await triggerSoulstitchSpells(sentSpell, metaCtx, ps, CAMP, MAP)
        expect(executeHandler).toHaveBeenCalledTimes(1)
        const [action, argStats, argCamp, argMap] = executeHandler.mock.calls[0]
        expect(executeHandler.mock.calls[0]).toHaveLength(4)
        expect(action).toStrictEqual({
          name: 'Soulstitch Spells',
          automation: { type: 'soulstitch_spells', casting_time: 'passive' },
          spell: sentSpell,
          spellSlotLevel: expectedSlot,
        })
        // spell forwarded by reference, stats tuple exact.
        expect(action.spell).toBe(sentSpell)
        expect(argStats).toBe(ps)
        expect(argCamp).toBe(CAMP)
        expect(argMap).toBe(MAP)
        expect(result).toBe(handlerResult)
      }
      executeHandler.mockResolvedValue(null)
      expect(await triggerSoulstitchSpells(evocationSpell(), {}, soulstitchStats(), CAMP, MAP)).toBeNull()
    })

    it('modal result bridges to soulstitch-modal-show and resolves with selection, decline, or [] for non-array (CLA-321)', async () => {
      const outcomes = [
        [['A'], ['A']],
        [[], []],
        ['not-an-array', []],
      ]
      for (const [confirmValue, expected] of outcomes) {
        executeHandler.mockClear()
        const modalResult = { type: 'modal', payload: { options: ['A', 'B'] } }
        executeHandler.mockReturnValue(Promise.resolve(modalResult))
        const seen = []
        let releaseModal
        const modalShown = new Promise((resolve) => { releaseModal = resolve })
        const listener = (e) => { seen.push(e.detail); releaseModal() }
        window.addEventListener('soulstitch-modal-show', listener)
        const triggerPromise = triggerSoulstitchSpells(evocationSpell(), {}, soulstitchStats(), CAMP, MAP)
        await modalShown
        // Event dispatched with the exact payload reference before the await seam.
        expect(seen[0]).toBe(modalResult.payload)
        confirmSoulstitchSelection(confirmValue)
        expect(await triggerPromise).toEqual(expected)
        window.removeEventListener('soulstitch-modal-show', listener)
      }
      // No pending resolver: second confirm is a harmless no-op.
      expect(() => confirmSoulstitchSelection(['ghost'])).not.toThrow()
    })
  })

  describe('empowered_evocation selectors (both rulesets)', () => {
    it('getEmpoweredEvocationFeatures filters type by identity', () => {
      const feature = { type: 'empowered_evocation', name: 'Empowered Evocation', casting_time: 'passive' }
      const noise = { type: 'soulstitch_spells', name: 'Soulstitch Spells' }
      const result = getEmpoweredEvocationFeatures({ automation: { passives: [noise, feature] } })
      expect(result).toHaveLength(1)
      expect(result[0]).toBe(feature)
    })

    it('getEmpoweredEvocationIntModifier returns exact-name Intelligence bonus, 0 otherwise', () => {
      expect(getEmpoweredEvocationIntModifier({ abilities: [{ name: 'Intelligence', bonus: 3 }] })).toBe(3)
      expect(getEmpoweredEvocationIntModifier({ abilities: [{ name: 'intelligence', bonus: 5 }] })).toBe(0)
      expect(getEmpoweredEvocationIntModifier({ abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Wisdom', bonus: 1 }] })).toBe(0)
      expect(getEmpoweredEvocationIntModifier({ abilities: [] })).toBe(0)
    })
  })

  describe('spell_thief auto-lane (CLA-325)', () => {
    it('stays inert even when the caster owns the disk Rogue spell_thief reaction', async () => {
      const thiefReaction = { type: 'spell_thief', name: 'Spell Thief', saveType: 'INT', saveDc: 'ability', saveAbility: 'INT', trigger: 'spell_cast', oncePerLongRest: true, casting_time: '1 reaction' }
      for (const reactions of [[thiefReaction], []]) {
        expect(await triggerSpellThief({ name: 'Fireball' }, { slotLevel: 3 }, { name: 'Player', automation: { reactions } }, CAMP, MAP)).toBeNull()
      }
      expect(executeHandler).not.toHaveBeenCalled()
      expect(getRuntimeValue).not.toHaveBeenCalled()
    })
  })

  describe('bewitching lane (2024 Warlock, CLA-037)', () => {
    const baseSpell = { name: 'Charm Person', school: 'enchantment', level: 1, casting_time: '1 action' }
    const bewitchStats = () => ({ automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitching Magic', casting_time: 'passive' }] } })

    it('getBewitchingMagicFeatures filters type by identity', () => {
      const feature = bewitchStats().automation.passives[0]
      const noise = { type: 'soulstitch_spells', name: 'Soulstitch Spells' }
      const result = getBewitchingMagicFeatures({ automation: { passives: [noise, feature] } })
      expect(result).toHaveLength(1)
      expect(result[0]).toBe(feature)
    })

    it('gates out school, slot-less cast, casting-time rejects, and no-features before dispatch', async () => {
      const ps = bewitchStats()
      const cases = [
        [{ ...baseSpell, school: 'evocation' }, { slotLevel: 1 }, ps],
        [{ ...baseSpell, school: undefined }, { slotLevel: 1 }, ps],
        [{ ...baseSpell, level: 0 }, { slotLevel: 0 }, ps],
        [{ ...baseSpell, casting_time: '1 bonus action' }, { slotLevel: 1 }, ps],
        [{ ...baseSpell, casting_time: 'Bonus Action' }, { slotLevel: 1 }, ps],
        [{ ...baseSpell, casting_time: '1 reaction' }, { slotLevel: 1 }, ps],
        [{ ...baseSpell, casting_time: 'Reaction' }, { slotLevel: 1 }, ps],
        [{ ...baseSpell, casting_time: '' }, { slotLevel: 1 }, ps],
        [baseSpell, { slotLevel: 1 }, { automation: { passives: [] } }],
      ]
      for (const [spell, metaCtx, stats] of cases) {
        expect(await triggerBewitchingMagic(spell, metaCtx, stats, CAMP, MAP)).toBeNull()
      }
      expect(executeHandler).not.toHaveBeenCalled()
    })

    it('accepts every action-casting-time casing after trim+lowercase (5e "1 action" and 2024 "Action", CLA-037 regression pin)', async () => {
      const ps = bewitchStats()
      for (const castingTime of ['1 action', 'Action', '1 Action', 'ACTION', ' Action ']) {
        executeHandler.mockClear()
        const result = await triggerBewitchingMagic({ ...baseSpell, casting_time: castingTime }, { slotLevel: 1 }, ps, CAMP, MAP)
        expect(executeHandler).toHaveBeenCalledTimes(1)
        expect(result).toHaveLength(1)
      }
    })

    it('builds exact auto-lane envelope with autoTrigger and forwards raw school bytes; multiple features collect in order', async () => {
      const featureA = { type: 'bewitching_magic', name: 'Bewitch A', casting_time: 'passive' }
      const featureB = { type: 'bewitching_magic', name: 'Bewitch B', casting_time: 'passive' }
      const ps = { automation: { passives: [featureA, featureB] } }
      executeHandler.mockImplementation(async (action) => ({ id: action.name }))
      const result = await triggerBewitchingMagic({ ...baseSpell, school: 'Illusion' }, { slotLevel: 1 }, ps, CAMP, MAP)
      expect(executeHandler).toHaveBeenCalledTimes(2)
      expect(executeHandler.mock.calls[0]).toHaveLength(4)
      const [actionA, argStats, argCamp, argMap] = executeHandler.mock.calls[0]
      expect(actionA).toStrictEqual({
        name: 'Bewitch A',
        automation: { type: 'bewitching_magic', casting_time: 'passive' },
        school: 'Illusion',
        autoTrigger: true,
      })
      expect(argStats).toBe(ps)
      expect(argCamp).toBe(CAMP)
      expect(argMap).toBe(MAP)
      expect(executeHandler.mock.calls[1][0].name).toBe('Bewitch B')
      expect(result).toEqual([{ id: 'Bewitch A' }, { id: 'Bewitch B' }])
    })

    it('bridges a modal handler result to bewitching-modal-show with the payload reference and still collects the result', async () => {
      const modalResult = { type: 'modal', modalName: 'stepsOfTheFeyTaunt', payload: { mode: 'bewitchingMagic', unlimited: true } }
      executeHandler.mockImplementation(async () => modalResult)
      const ps = bewitchStats()
      const seen = []
      const listener = (e) => seen.push(e.detail)
      window.addEventListener('bewitching-modal-show', listener)
      const result = await triggerBewitchingMagic(baseSpell, { slotLevel: 1 }, ps, CAMP, MAP)
      window.removeEventListener('bewitching-modal-show', listener)
      expect(seen).toHaveLength(1)
      expect(seen[0]).toBe(modalResult.payload)
      expect(result).toHaveLength(1)
      expect(result[0]).toBe(modalResult)
    })
  })

  describe('async error propagation (not swallowed by soulstitch/bewitching lanes)', () => {
    it('rejects and logs when executeHandler rejects (rider-lane rethrow owned by combat twin)', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const boom = new Error('handler broke')
      executeHandler.mockRejectedValue(boom)
      await expect(triggerSoulstitchSpells({ name: 'Fireball', school: 'evocation', dc: { dc_type: 'CON' } }, {}, { automation: { passives: [{ type: 'soulstitch_spells', name: 'Soulstitch Spells' }] } }, CAMP, MAP)).rejects.toBe(boom)
      await expect(triggerBewitchingMagic({ name: 'Charm Person', school: 'enchantment', level: 1, casting_time: '1 action' }, { slotLevel: 1 }, { automation: { passives: [{ type: 'bewitching_magic', name: 'Bewitching Magic' }] } }, CAMP, MAP)).rejects.toBe(boom)
      expect(spy).toHaveBeenCalledWith('[soulstitch] Failed to execute Soulstitch Spells:', boom)
      expect(spy).toHaveBeenCalledWith('[bewitchingMagic] Failed to execute Bewitching Magic:', boom)
    })
  })
})
