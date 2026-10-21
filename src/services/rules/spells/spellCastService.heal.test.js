// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cloneDeep } from 'lodash'

import { executeSpellCast } from './spellCastService.js'
import spells5e from '../../../../public/data/spells.json'
import spells2024 from '../../../../public/data/2024/spells.json'

import * as applyHealing from '../combat/applyHealing.js'
import * as automation from '../../automation/index.js'
import * as damageUtils from '../combat/damageUtils.js'
import * as runtime from '../../../hooks/runtime/useRuntimeState.js'
import * as dice from '../../dice/diceRoller.js'
import * as expirations from '../effects/expirations.js'
import * as logService from '../../../services/ui/logService.js'
import * as healRider from './postCastHealService.js'

/* ------------------------------------------------------------------ */
/*  HEAL LANE (#1454 split-table face: "heal path + regenerate +   */
/*  power word heal", routed through the hub executeSpellCast).     */
/*                                                                    */
/*  REAL internals run: index.js no-damage + early chains,            */
/*  helpers.js (applyPowerWordHealToTarget / powerWordHealDamage /   */
/*  powerWordHealConditions), modalSpells.js CLA-392 spread gate,    */
/*  automationPassives bonus math, computeSpellStats,                 */
/*  lookupFullSpell (URL-aware fetch stub — no unmocked-fetch noise, */
/*  #1454 fresh-fixed pattern). Mocked edges: runtime store           */
/*  (per-character HP truth), diceRoller (faithful null guard        */
/*  mirroring diceRoller.js:78, #1449), log, applyHealing producer, */
/*  feature services. Spell fixtures are REAL disk rows — no         */
/*  fabricated keys.                                                  */
/*                                                                    */
/*  Boundary vs siblings (covered there, cited only):               */
/*   - .execute .......... caller-boundary integration (#1454)      */
/*   - master .test.js ... save-DC/range/emp-evoc/overchannel/     */
/*                        heal-throw slot-null throw (#1454)         */
/*   - execution/helpers-powerWordHeal.test.js — module-direct PWH */
/*     condition-strip + stand-permission + full-HP guard bytes     */
/*   - execution/spellCastService.powerWordHeal.test.js — PWH hub  */
/*     edge cases incl. multiTarget-equals-first dedup + strip      */
/*   - execution/helpers-regenerate.test.js + regenerateHandler / */
/*     spellGates+regenerateService lanes — ALL regenerate apply/ */
/*     envelope/tick bytes (hub route for disk rows is the generic */
/*     automation consumption pinned below — handleRegenerate and   */
/*     helpers.applyRegenerateSpell are unreachable legacy-callable */
/*     parallel lanes for REAL disk rows, per regenerateHandler */
/*     liveness audit 2026-10-16; #1398 DORMANT stands).            */
/*   - execution/aoeSpells.test.js "generic healing" — same         */
/*     scenarios but bare toHaveBeenCalled(); the exact forwarding */
/*     tuple + genericHealResult key-set is this lane's face.       */
/*   - producers/delegates: disk-tier heal math #1278, healService */
/*     ladder #1372, healingWord #1371, massCW #1384, massHW #1385,*/
/*     prayer #1393/94, postCastHeal riders #1452, dormant          */
/*     regenerate tick #1398, PWH absent-from-5e-disk #1450, HP   */
/*     apply/revive #1182-#1210 — cited, never re-owned.           */
/*                                                                    */
/*  Forward-vs-compute verdict (#1335): the hub COMPUTES the        */
/*  clamped heal (resolveTargetHpBounds + min/max, index.js:        */
/*  373-420) and FORWARDS (summary, name, amount, campaign) to the */
/*  applyHealingToTarget producer; the producer's return value is   */
/*  folded back ONLY in the PWH helper (helpers.js:195 amount ??   */
/*  computed) — pinned below.                                       */
/*                                                                    */
/*  No-clock: heals are instantaneous. Regenerate's addExpiration   */
/*  is the pre-existing combat-scoped removal stamp (#1398) — not  */
/*  a wall-clock timer; this file stores no expiry of its own.     */
/* ------------------------------------------------------------------ */

const CAMPAIGN = 'testCampaign'

const disk = (name, rules) => cloneDeep((rules === '2024' ? spells2024 : spells5e).find(s => s.name === name))

/* Per-character HP/conditions truth served by the runtime mock. */
globalThis.__healHp = {}
globalThis.__healConditions = []

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn((char, key) => {
    const hp = globalThis.__healHp || {}
    if (key === 'activeConditions') return globalThis.__healConditions || []
    if (key === 'targetEffects') return []
    if (key === 'hitPoints') return hp[char]?.max
    if (key === 'currentHitPoints') return hp[char]?.current
    return undefined
  }),
}))

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    if (!formula) return null // mirrors real null-guard, diceRoller.js:78 (#1449)
    if (/^\d+$/.test(formula.trim())) return { total: Number(formula.trim()), rolls: [], modifier: 0 }
    return { total: 15, rolls: [6, 5, 4], modifier: 0 }
  }),
  rollExpressionMaximized: vi.fn((formula) => (formula ? { total: 24, rolls: [6, 6, 6, 6], modifier: 0, maximized: true } : null)),
  // Export completeness: consumed by execution/index.js:25 + helpers.js:11;
  // never fires here (hasRerollHealingOnes is real and false on zero passives).
  applyHealingRerollOnes: vi.fn((rolls) => ({ displayRolls: rolls, originalRolls: null })),
}))

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
  getLog: vi.fn(),
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
  triggerPostCastRiderSaves: vi.fn(async () => null),
  triggerSpellThief: vi.fn(async () => null),
  triggerBewitchingMagic: vi.fn(async () => null),
  triggerSoulstitchSpells: vi.fn(),
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}))

vi.mock('./postCastHealService.js', () => ({
  triggerPostCastSelfHeals: vi.fn(async () => null),
  triggerPostCastAllyHeals: vi.fn(async () => null),
}))

vi.mock('../features/smiteOfProtectionService.js', () => ({
  triggerSmiteOfProtection: vi.fn(async () => null),
}))

vi.mock('../features/inspiringSmiteService.js', () => ({
  triggerInspiringSmite: vi.fn(async () => null),
}))

vi.mock('../features/primalCompanionSpellShareService.js', () => ({
  triggerPrimalCompanionSpellShare: vi.fn(async () => null),
}))

vi.mock('../features/wildMagicSurgeService.js', () => ({
  triggerWildMagicSurge: vi.fn(async () => null),
}))

vi.mock('../features/falseLifeService.js', () => ({
  triggerFalseLife: vi.fn(async () => {}),
}))

vi.mock('../features/healingWordService.js', () => ({
  triggerHealingWord: vi.fn(async () => {}),
}))

vi.mock('../combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}))

vi.mock('../combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}))

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    abilities: [{ name: 'Wisdom', bonus: 5 }],
    proficiency: 4,
    spellAbilities: { spellCastingAbility: 'Wisdom', toHit: 9, saveDc: 17, modifier: 5 },
    automation: { passives: [] },
    activeBuffs: [],
    level: 5,
    hitPoints: 100,
    ...overrides,
  }
}

function makeServices(overrides = {}) {
  return {
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    playerStats: makePlayerStats(),
    getTargetInfo: vi.fn(async () => ({ name: 'Target' })),
    attackerPos: null,
    targetPos: null,
    featEffects: {},
    campaignName: CAMPAIGN,
    mapName: 'testMap',
    characters: [{ name: 'Target', type: 'player' }],
    ...overrides,
  }
}

/** CAMPAIGN addEntry calls of one type, volatile timestamp stripped. */
function entriesOfType(type) {
  return vi.mocked(logService.addEntry).mock.calls
    .filter(([campaign]) => campaign === CAMPAIGN)
    .map(([, entry]) => entry)
    .filter(e => e.type === type)
    .map((entry) => {
      const rest = { ...entry } // strip volatile timestamp; keep exact key-set otherwise
      delete rest.timestamp
      return rest
    })
}

describe('executeSpellCast — hub heal lane (heal path + regenerate + power word heal)', () => {
  let consoleError

  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.__healHp = { Target: { max: 100, current: 30 }, Target2: { max: 80, current: 20 } }
    globalThis.__healConditions = []
    // URL-aware fetch stub (#1454 pattern): both catalog tiers resolve via the
    // REAL lookupFullSpell without unmocked-fetch noise.
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('/2024/') ? spells2024 : spells5e),
    })))
    vi.mocked(damageUtils.getCombatContext).mockResolvedValue(null)
    vi.mocked(applyHealing.applyHealingToTarget).mockReturnValue(null)
    consoleError = vi.spyOn(console, 'error')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    consoleError.mockRestore()
  })

  describe('generic heal_at_slot_level path (index.js:337 -> runGenericHealPath)', () => {
    it('computes the clamped heal from runtime HP and forwards the exact tuple + genericHealResult envelope, never touching activeConditions', async () => {
      const spell = disk('Heal') // REAL disk row: heal_at_slot_level {6:'70'}, no automation/damage keys
      const summary = { creatures: [{ name: 'Target', maxHp: 100, currentHp: 99 }] }
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue(summary)
      globalThis.__healConditions = ['Blinded', 'Poisoned'] // generic heal must NOT strip (strip is PWH-only, helpers lane)
      const services = makeServices()

      const result = await executeSpellCast(spell, { slotLevel: 6 }, services)

      // Forward tuple: shared snapshot identity + hub-computed clamp min(70, 100-30); producer return ignored on this path (#1335).
      expect(vi.mocked(applyHealing.applyHealingToTarget).mock.calls).toEqual([[summary, 'Target', 70, CAMPAIGN]])
      expect(result).toEqual({
        targetName: 'Target', healAmount: 70, formula: '70', rolls: [], rawTotal: 70,
        bonusHeal: 0, bonusDetails: [], healingRerollOriginalRolls: null, healingRerollDisplayRolls: [],
      })
      expect(entriesOfType('hp_change')).toEqual([{
        type: 'hp_change', targetName: 'Target', delta: 70, currentHp: 100, maxHp: 100,
        isHealing: true, sourceName: 'TestCaster', note: 'Heal', formula: '70', bonusDetails: undefined,
      }])
      expect(entriesOfType('spell')).toEqual([{
        type: 'spell', characterName: 'TestCaster', targetName: 'Target', spellName: 'Heal', spellLevel: 6,
        castingTime: '1 action', damageType: null, damageFormula: null, saveDC: null, concentration: false,
        description: spell.description.join(' '),
      }])
      // Generic heal never writes conditions; caster lastActionSpellCast stamp is early-resolutions-lane-owned (cited).
      expect(vi.mocked(runtime.setRuntimeValue).mock.calls.filter(([, key]) => key === 'activeConditions')).toEqual([])
      // QUIRK pin (#1357/58 inline-dup; riders #1452 cited): the heal path fires
      // self-heal riders in runGenericHealPath AND again via runPostCastTriggers.
      expect(vi.mocked(healRider.triggerPostCastSelfHeals)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(healRider.triggerPostCastSelfHeals).mock.calls.map(([, ctx]) => ctx)).toEqual([
        { slotLevel: 6, metamagicHeighten: false, targetNames: ['Target'] },
        { slotLevel: 6, metamagicHeighten: false, targetNames: ['Target'] },
      ])
      expect(consoleError).not.toHaveBeenCalled()
    })

    it('delta-0 full-HP target: no forward to applyHealingToTarget, but hp_change delta-0 log + envelope still emitted', async () => {
      globalThis.__healHp.Target = { max: 100, current: 100 }
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue({ creatures: [{ name: 'Target', maxHp: 100, currentHp: 100 }] })
      const spell = disk('Heal')

      const result = await executeSpellCast(spell, { slotLevel: 6 }, makeServices())

      expect(vi.mocked(applyHealing.applyHealingToTarget)).not.toHaveBeenCalled()
      expect(result).toEqual({
        targetName: 'Target', healAmount: 0, formula: '70', rolls: [], rawTotal: 70,
        bonusHeal: 0, bonusDetails: [], healingRerollOriginalRolls: null, healingRerollDisplayRolls: [],
      })
      // Family-consistent zero-heal behavior (vs #1384/85 delta-0 over-log): hub logs the zero heal anyway.
      expect(entriesOfType('hp_change')).toEqual([{
        type: 'hp_change', targetName: 'Target', delta: 0, currentHp: 100, maxHp: 100,
        isHealing: true, sourceName: 'TestCaster', note: 'Heal', formula: '70', bonusDetails: undefined,
      }])
    })

    it('null combat context degrades ONLY the forward — heal still computed, envelope + hp_change log emitted', async () => {
      const spell = disk('Heal')

      const result = await executeSpellCast(spell, { slotLevel: 6 }, makeServices())

      expect(vi.mocked(damageUtils.getCombatContext)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(applyHealing.applyHealingToTarget)).not.toHaveBeenCalled()
      expect(result).toEqual({
        targetName: 'Target', healAmount: 70, formula: '70', rolls: [], rawTotal: 70,
        bonusHeal: 0, bonusDetails: [], healingRerollOriginalRolls: null, healingRerollDisplayRolls: [],
      })
      expect(entriesOfType('hp_change')).toHaveLength(1)
      expect(entriesOfType('hp_change')[0].delta).toBe(70)
    })

    it('target short-circuit (getTargetInfo undefined): resolves null, never fetches combat context, riders still paid', async () => {
      const spell = disk('Heal')

      const result = await executeSpellCast(spell, { slotLevel: 6 }, makeServices({ getTargetInfo: async () => undefined }))

      expect(result).toBeNull()
      expect(vi.mocked(damageUtils.getCombatContext)).not.toHaveBeenCalled()
      expect(vi.mocked(applyHealing.applyHealingToTarget)).not.toHaveBeenCalled()
      expect(entriesOfType('hp_change')).toEqual([])
      expect(vi.mocked(healRider.triggerPostCastSelfHeals).mock.calls[0][1]).toEqual({ slotLevel: 6, metamagicHeighten: false, targetNames: undefined })
    })

    it('dice-branch spell (Cure Wounds): substitutes MOD with the Wisdom modifier, rolls once, forwards the rolled total', async () => {
      globalThis.__healHp.Target = { max: 100, current: 20 }
      const spell = disk('Cure Wounds') // REAL disk row {1:'1d8 + MOD'}
      const summary = { creatures: [{ name: 'Target', maxHp: 100, currentHp: 20 }] }
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue(summary)

      const result = await executeSpellCast(spell, { slotLevel: 1 }, makeServices())

      expect(vi.mocked(dice.rollExpression).mock.calls).toEqual([['1d8 + 5']])
      expect(vi.mocked(applyHealing.applyHealingToTarget).mock.calls).toEqual([[summary, 'Target', 15, CAMPAIGN]])
      expect(result).toEqual({
        targetName: 'Target', healAmount: 15, formula: '1d8 + 5', rolls: [6, 5, 4], rawTotal: 15,
        bonusHeal: 0, bonusDetails: [], healingRerollOriginalRolls: null, healingRerollDisplayRolls: [6, 5, 4],
      })
    })
  })

  describe('Regenerate via hub early chain (disk row consumed by handleGenericAutomation)', () => {
    it('REAL disk rows (both tiers carry automation.type healing_start_of_turn) are consumed at index.js:710 -> executeHandler; the hub writes no regenerate bytes and returns undefined (#1398 dormant — live lane is regenerateService, module bytes owned by helpers-regenerate/regenerateHandler lanes)', async () => {
      const spell = disk('Regenerate')
      vi.mocked(automation.executeHandler).mockResolvedValue(null) // registry: no 'healing_start_of_turn' key -> null

      const result = await executeSpellCast(spell, { slotLevel: 7 }, makeServices())

      // Consumed by the generic-automation gate BEFORE runNoDamagePath: the
      // chain's first entry (handleRegenerate, index.js:278) is unreachable for
      // disk rows — hub must NOT write envelope/expiration/HP itself.
      expect(vi.mocked(automation.executeHandler)).toHaveBeenCalledTimes(1)
      const action = vi.mocked(automation.executeHandler).mock.calls[0][0]
      expect(action.name).toBe('Regenerate')
      expect(action.automation).toEqual(spell.automation)
      expect(action.metaCtx).toEqual({ slotLevel: 7, metamagicHeighten: false })
      expect(result).toBeUndefined()
      expect(vi.mocked(applyHealing.applyHealingToTarget)).not.toHaveBeenCalled()
      expect(vi.mocked(expirations.addExpiration)).not.toHaveBeenCalled()
      expect(vi.mocked(runtime.setRuntimeValue).mock.calls.filter(([, key]) => String(key).startsWith('regenerate'))).toEqual([])
      expect(consoleError).not.toHaveBeenCalled()
    })
  })

  describe('Power Word Heal via hub early chain (index.js:702 -> modalSpells CLA-392 spread)', () => {
    it('spreads FIRST + multiTarget through ONE shared snapshot, runtime HP beats snapshot HP, emits one healing-popup per target, bypasses post-cast riders', async () => {
      // 2024 disk row — Power Word Heal is absent from the 5e disk (#1450);
      // rules:'2024' routes lookupFullSpell to the tier where it resolves,
      // pinning honest zero-console-noise handling.
      const spell = disk('Power Word Heal', '2024')
      const services = makeServices({ playerStats: makePlayerStats({ rules: '2024' }) })
      const summary = {
        creatures: [
          { name: 'Target', type: 'player', maxHp: 100, currentHp: 99 }, // runtime 100/30 must win -> 70
          { name: 'Target2', type: 'player', maxHp: 77, currentHp: 10 }, // runtime 80/20 must win -> 60
        ],
      }
      vi.mocked(damageUtils.getCombatContext).mockResolvedValue(summary)
      const popups = []
      const onPopup = (e) => popups.push(e.detail)
      window.addEventListener('healing-popup', onPopup)
      try {
        const result = await executeSpellCast(spell, { slotLevel: 9, multiTarget: 'Target2' }, services)

        // CLA-392: one shared snapshot, first target AND multiTarget.
        expect(vi.mocked(damageUtils.getCombatContext)).toHaveBeenCalledTimes(1)
        expect(vi.mocked(applyHealing.applyHealingToTarget).mock.calls).toEqual([
          [summary, 'Target', 70, CAMPAIGN],
          [summary, 'Target2', 60, CAMPAIGN],
        ])
        // Producer returned null -> amount ?? computed fallback (helpers.js:195).
        expect(entriesOfType('hp_change')).toEqual([
          { type: 'hp_change', targetName: 'Target', delta: 70, currentHp: 100, maxHp: 100, isHealing: true, sourceName: 'TestCaster', note: 'Power Word Heal' },
          { type: 'hp_change', targetName: 'Target2', delta: 60, currentHp: 80, maxHp: 80, isHealing: true, sourceName: 'TestCaster', note: 'Power Word Heal' },
        ])
        // healing-popup consume-trail payload (#1392) — asserted nowhere else.
        expect(popups).toEqual([
          { targetName: 'Target', sourceName: 'TestCaster', healingName: 'Power Word Heal', rollInfo: '', maximizeHealingDice: false, popupText: 'Power Word Heal on Target: Regained 70 HP' },
          { targetName: 'Target2', sourceName: 'TestCaster', healingName: 'Power Word Heal', rollInfo: '', maximizeHealingDice: false, popupText: 'Power Word Heal on Target2: Regained 60 HP' },
        ])
        // Empty stored conditions -> no condition writes; strip bytes owned by
        // helpers-powerWordHeal.test.js / spellCastService.powerWordHeal.test.js (cited).
        expect(vi.mocked(runtime.setRuntimeValue).mock.calls).toEqual([['TestCaster', 'lastActionSpellCast', 1, CAMPAIGN]])
        // Early-chain handled casts return undefined and bypass runPostCastTriggers.
        expect(result).toBeUndefined()
        expect(vi.mocked(healRider.triggerPostCastSelfHeals)).not.toHaveBeenCalled()
        expect(consoleError).not.toHaveBeenCalled()
      } finally {
        window.removeEventListener('healing-popup', onPopup)
      }
    })
  })
})
