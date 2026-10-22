// @maintained-by-ai
// rules-helpers lane: the rules-helpers.js helper surface (ruleset precedence,
// Fey/Shadow runtime seed, rules-type writer, GENERIC merge contract) plus the
// string-row/guard ownership cited by four neighbors. Incoming-cite map (old -> new):
//   :176-201  2024 string bonusActions/reactions passthrough (#1435/#1444) -> :222-239
//             FLIPPED #1455(a): channels now canonicalize string rows via
//             normalizeActionRows (rules-actions.js) — no silent uniqBy drop.
//   :226-267  5e getActions four-channel not-array throws (#1435 twin cite) -> :197-220
//   :237-260  5e twin bonusActions/reactions throws (rules-2024-actions :73) -> :197-220 (loop rows 2-3)
//   :287      'Missing object: class.major' guard (#1440/#1441/#1442 collector-guard form) -> :250 (table :241-275)
//   :291-317  getLanguages race/class/subrace not-array throws -> :278-313
//   :320-332  Ranger language level bonuses -> :315-336
//   (unnumbered) getMagicItems sync guard, rules-error-handling.test.js:8 -> :340-353
// Removed (covered elsewhere, report-only): old :203-222 2024 cross-source dedup
// (owner core/rules-actions.test.js:127, rec test-maintain-bugs.md:782); old
// :346-351 Spell Scroll desc (same branch as rules.test.js:631 Ring of Spell Storing).
// Guards run through the OWNING modules (rules-actions/rules-proficiencies/
// rules-languages/rules-magicItems), not the facade — facade delegates are owned
// by rules.test.js / rules-core.test.js:73. Stubbed seams only: feature-provider
// collaborators (own lanes exist) + proficiencyUtils (proves guard runs BEFORE pu)
// + useRuntimeState (applyFeyShadowTouchedSpells; complete factory: rules-helpers.js
// imports only getRuntimeValue #1440 lesson). FT-046 featName threading + survivor
// wrapper bytes owned by rules-helpers.ft046-featname-threading.test.js — NOT
// re-run here; this file pins the generic contract ft046 does not touch: dedup is
// vs-existing-only (no in-batch dedup), string-row coercion quirks at :23/:25.
// No clocks; no dice; zero fs; console.error spied locally per throw test.
import { describe, it, expect, vi } from 'vitest'
import { cloneDeep } from 'lodash'

import {
  getRulesType,
  is2024,
  mergeAutomationSpecialActions,
  applyFeyShadowTouchedSpells,
  applyRulesType,
} from './rules-helpers.js'
import { getActions } from './rules-actions.js'
import { getProficiencies } from './rules-proficiencies.js'
import { getLanguages } from './rules-languages.js'
import { getMagicItems } from './rules-magicItems.js'
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import classRules from '../character/classRules.js'
import { getProficiencies as pu5eGetProficiencies } from '../character/proficiencyUtils.js'
import { getProficiencies as pu2024GetProficiencies } from '../character/proficiencyUtils2024.js'

vi.mock('../character/classRules.js', () => ({
  default: {
    featureCategories: {},
    getFeatures: vi.fn(() => ({
      actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [],
    })),
  },
}))
vi.mock('../character/classRules2024.js', () => ({
  default: {
    featureCategories: {},
    getFeatures: vi.fn(() => ({
      actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [],
    })),
  },
}))
vi.mock('../character/race-rules/index.js', () => ({
  rules5e: {
    getTraits: vi.fn(() => ({
      actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [],
    })),
  },
  rules2024: {
    getTraits: vi.fn(() => ({
      actions: [], bonusActions: [], reactions: [], specialActions: [], characterAdvancement: [],
    })),
  },
}))
// Guard-before-call proof: if a bonusSource guard regressed, the call below would
// receive a null bonusSource — the exact-message throws + not-called pair pin it.
vi.mock('../character/proficiencyUtils.js', () => ({
  getProficiencies: vi.fn(() => [0, []]),
  getProficiencyChoiceCount: vi.fn(() => 0),
}))
vi.mock('../character/proficiencyUtils2024.js', () => ({
  getProficiencies: vi.fn(() => [0, []]),
  getProficiencyChoiceCount: vi.fn(() => 0),
}))
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
}))

const spyConsoleError = () => vi.spyOn(console, 'error').mockImplementation(() => {})

describe('rules-helpers.js ruleset selection', () => {
  it('getRulesType prefers playerStats.rules, falls back to summary, defaults 5e; is2024 is exact-byte', () => {
    expect(getRulesType({ rules: '2024' }, { rules: '5e' })).toBe('2024')
    expect(getRulesType({}, { rules: '2024' })).toBe('2024')
    expect(getRulesType({ rules: '' }, { rules: '2024' })).toBe('2024') // falsy falls through
    expect(getRulesType({ rules: null }, null)).toBe('5e')
    expect(getRulesType(undefined, undefined)).toBe('5e')
    expect(is2024({ rules: '2024' }, {})).toBe(true)
    expect(is2024({ rules: '2024 ' }, {})).toBe(false) // whitespace-exact comparison
    expect(is2024({}, { rules: '2024' })).toBe(true)
    expect(is2024({}, { rules: '5e' })).toBe(false)
  })

  it('applyRulesType EXPLICIT-WINS (#1455(b) flipped from the old summary-clobbers quirk pin): stats.rules is the owner choice and is never overwritten', () => {
    const fromSummary = {}
    applyRulesType(fromSummary, { rules: '2024' })
    expect(fromSummary).toStrictEqual({ rules: '2024' })

    // #1455(b): unlike the old :46 behavior, an explicit playerStats.rules is
    // NEVER clobbered by the summary fallback nor by a conflicting summary stamp —
    // same precedence getRulesType enforces on every READ (:8-10). Pre-fix winner
    // bytes captured: {rules:'2024'} + {} -> {"rules":"5e"}; {rules:'2024'} +
    // {rules:'5e'} -> {"rules":"5e"} (summary clobber). Both flip to '2024'.
    const pinned = { rules: '2024' }
    applyRulesType(pinned, {})
    expect(pinned).toStrictEqual({ rules: '2024' })

    const conflict = { rules: '2024' }
    applyRulesType(conflict, { rules: '5e' })
    expect(conflict).toStrictEqual({ rules: '2024' })

    // Agreement is idempotent passthrough.
    const agreed = { rules: '5e' }
    applyRulesType(agreed, { rules: '5e' })
    expect(agreed).toStrictEqual({ rules: '5e' })

    // Truthiness gate matches getRulesType :8 (falsy stats.rules falls through):
    // '' and null on stats yield to an explicit summary stamp.
    const empty = { rules: '' }
    applyRulesType(empty, { rules: '2024' })
    expect(empty).toStrictEqual({ rules: '2024' })

    // Golden unguarded deref (#1360 family) preserved: no stats.rules + undefined
    // summary reads playerSummary.rules unoptional (:58) — TypeError, console untouched.
    const errSpy = spyConsoleError()
    expect(() => applyRulesType({}, undefined)).toThrow(TypeError)
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('applyFeyShadowTouchedSpells reads both runtime keys with exact accessor bytes and never fabricates absent keys', () => {
    const ftRow = { name: 'Misty Step' }
    const stRow = { name: 'Pass Without Trace' }
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
      (key === 'feyTouchedSpell' ? ftRow : key === 'shadowTouchedSpell' ? stRow : undefined))

    const stats = { name: 'FeyTest' }
    applyFeyShadowTouchedSpells(stats)
    expect(stats.feyTouchedSpell).toBe(ftRow) // by-reference seed, no clone
    expect(stats.shadowTouchedSpell).toBe(stRow)
    expect(vi.mocked(getRuntimeValue).mock.calls).toEqual([
      ['FeyTest', 'feyTouchedSpell'],
      ['FeyTest', 'shadowTouchedSpell'],
    ])

    // Absent (undefined) values: keys are NOT created on playerStats (:37/:39 falsy gate).
    vi.mocked(getRuntimeValue).mockImplementation(() => undefined)
    const untouched = { name: 'FeyTest' }
    applyFeyShadowTouchedSpells(untouched)
    expect(untouched).toStrictEqual({ name: 'FeyTest' })
  })
})

describe('mergeAutomationSpecialActions generic contract (rules-helpers.js:21-30)', () => {
  it('dedups vs EXISTING names only — duplicate automation rows both survive, appended in order', () => {
    const existing = { name: 'Existing' }
    const rowA = { name: 'Alpha', description: 'dA', featName: 'Feat A' }
    const rowA2 = { name: 'Alpha', description: 'dA2' } // same name as rowA
    const playerStats = { specialActions: [existing], automation: { specialActions: [rowA, rowA2] } }
    const automationRowsSnapshot = cloneDeep(playerStats.automation.specialActions)

    mergeAutomationSpecialActions(playerStats)

    // existingNames is built once (:23) and never updated on push (:24-29): the
    // in-batch duplicate rowA2 merges TOO — dedup guards collisions with existing
    // rows only (generic contract; exact-name swallow vs existing pinned by ft046 lane).
    expect(playerStats.specialActions.length).toBe(3)
    expect(playerStats.specialActions[0]).toBe(existing) // survivor passthrough by identity
    expect(playerStats.specialActions[1]).toStrictEqual({
      name: 'Alpha', description: 'dA', automation: rowA, featName: 'Feat A', hasAutomation: true,
    })
    expect(playerStats.specialActions[2]).toStrictEqual({
      name: 'Alpha', description: 'dA2', automation: rowA2, featName: undefined, hasAutomation: true,
    })
    // :27 wraps into a FRESH object each pass; the two same-name survivors stay distinct.
    expect(playerStats.specialActions[1]).not.toBe(rowA)
    expect(playerStats.specialActions[1].automation).toBe(rowA)
    expect(playerStats.specialActions[2].automation).toBe(rowA2)
    // Input purity (#1395): automation rows are never mutated.
    expect(playerStats.automation.specialActions).toStrictEqual(automationRowsSnapshot)
  })

  it('string-row quirk: string existing rows poison the name Set with undefined, silently swallowing nameless automation rows; automation string rows never merge', () => {
    // s.name on a string row is undefined (:23) — any automation row lacking a name
    // is then silently skipped (:25). Rows stay the original strings, untouched.
    const stats = { specialActions: ['Attack'], automation: { specialActions: [{ description: 'anon row' }, 'String Row'] } }
    const arr = stats.specialActions
    mergeAutomationSpecialActions(stats)
    expect(stats.specialActions).toBe(arr) // array identity: nothing pushed
    expect(stats.specialActions).toStrictEqual(['Attack'])

    // With no string existing rows, a nameless automation row merges as name: undefined
    // (:1374 silent-null form) — the wrapper is emitted unguarded.
    const fresh = { specialActions: [], automation: { specialActions: [{ description: 'anon row' }] } }
    mergeAutomationSpecialActions(fresh)
    expect(fresh.specialActions).toHaveLength(1)
    expect(fresh.specialActions[0].name).toBeUndefined()
    expect(fresh.specialActions[0]).toStrictEqual({
      name: undefined, description: 'anon row', automation: fresh.automation.specialActions[0], featName: undefined, hasAutomation: true,
    })

    // automation truthiness gate (:22): non-object automation degrades to [] no-op.
    const strAutomation = { specialActions: [{ name: 'Keep' }], automation: 'not-an-object' }
    mergeAutomationSpecialActions(strAutomation)
    expect(strAutomation).toStrictEqual({ specialActions: [{ name: 'Keep' }], automation: 'not-an-object' })
  })
})

describe('getActions 5e guard table (rules-actions.js:94-100 via shared requireArray :12-19)', () => {
  it('throws Missing array with exact byte per channel, logs console.error first, first guard wins', () => {
    // Cited: rules-2024-actions.test.js:5 ("all four channels") and :73
    // (bonusActions/reactions twins of the 2024 tolerance test).
    const channels = ['actions', 'bonusActions', 'reactions', 'specialActions']
    const errSpy = spyConsoleError()
    for (const channel of channels) {
      errSpy.mockClear()
      const stats = { name: 'Guard5e', rules: '5e', actions: [], bonusActions: [], reactions: [], specialActions: [] }
      stats[channel] = 'not an array'
      expect(() => getActions(stats, {})).toThrow(new Error(`Missing array: ${channel} for Guard5e`))
      expect(errSpy.mock.calls).toEqual([[`rules: expected ${channel} to be an array for`, 'Guard5e']])
    }
    // Provider seam ran once per invocation BEFORE the guards dispatch (rules-actions.js:26-28).
    expect(classRules.getFeatures).toHaveBeenCalledTimes(channels.length)
    // Short-circuit order (:97->:100): actions guard fires before bonusActions.
    errSpy.mockClear()
    expect(() => getActions({ name: 'Guard5e', rules: '5e', actions: 'bad', bonusActions: 'bad' }, {}))
      .toThrow(new Error('Missing array: actions for Guard5e'))
    expect(errSpy.mock.calls).toEqual([['rules: expected actions to be an array for', 'Guard5e']])
    expect(classRules.getFeatures).toHaveBeenCalledTimes(channels.length + 1)
    errSpy.mockRestore()
  })
})

describe('getActions 2024 string channels (cited :176-201 -> here; #1455(a) flipped: canonicalize-then-dedupe)', () => {
  it('2024 canonicalizes string bonusActions/reactions into house rows — distinct strings ALL survive, true dupes collapse, garbage rows are loud (#1455(a))', () => {
    // Pre-fix quirk (old :59-64 uniqBy(...,'name') keyed EVERY raw string row
    // to undefined): bonusActions ['Alpha','Bravo'] -> ['Alpha'], Bravo silently
    // dropped with ZERO console output. Fix: normalizeActionRows (rules-actions.js
    // :35-48) joins the fix#115 coercion family, so dedupe keys on real names.
    const stats = { name: 'Str2024', rules: '2024', actions: [], bonusActions: ['Haste'], reactions: ['Reaction Attack'], specialActions: [] }
    const [, bonusActions, reactions] = getActions(stats, {})
    expect(bonusActions).toStrictEqual([{ name: 'Haste', description: '', details: null }])
    expect(reactions).toStrictEqual([{ name: 'Reaction Attack', description: '', details: null }])

    const errSpy = spyConsoleError()
    // Distinct strings ALL survive (#1348 arm 1) — pre-fix winner: ['Alpha'].
    const two = { name: 'Str2024', rules: '2024', actions: [], bonusActions: ['Alpha', 'Bravo'], reactions: [], specialActions: [] }
    expect(getActions(two, {})[1]).toStrictEqual([
      { name: 'Alpha', description: '', details: null },
      { name: 'Bravo', description: '', details: null },
    ])
    expect(errSpy).not.toHaveBeenCalled()

    // True duplicates collapse to one row, distinct names all survive (#1348 arm 2):
    // ['Attack','Dash','Dash'] -> Attack + Dash (pre-fix capture: ['Attack'] only,
    // 2 rows silently gone, 0 stderr bytes).
    const dupes = { name: 'Str2024', rules: '2024', actions: [], bonusActions: ['Attack', 'Dash', 'Dash'], reactions: [], specialActions: [] }
    expect(getActions(dupes, {})[1]).toStrictEqual([
      { name: 'Attack', description: '', details: null },
      { name: 'Dash', description: '', details: null },
    ])
    expect(errSpy).not.toHaveBeenCalled()

    // Mixed string + object rows: house coercion bytes identical to the fix#115
    // actions-channel shape (:73-75); dedupe is cross-shape by canonical name,
    // first-wins keeps the earlier row (#1435(b) player-first law preserved).
    const mixed = { name: 'Str2024', rules: '2024', actions: [], bonusActions: ['Haste', { name: 'Haste', description: 'quickened' }], reactions: [], specialActions: [] }
    const [, mixedBonus] = getActions(mixed, {})
    expect(mixedBonus).toStrictEqual([{ name: 'Haste', description: '', details: null }])

    // Loud garbage arm (#1348 arm 3, no-silent-drop law): rows with no usable
    // name console.error and drop — null, number, ''-string, nameless object.
    errSpy.mockClear()
    const garbage = { name: 'Str2024', rules: '2024', actions: [], bonusActions: [null, 42, '', {}, 'Haste'], reactions: [], specialActions: [] }
    expect(getActions(garbage, {})[1]).toStrictEqual([{ name: 'Haste', description: '', details: null }])
    expect(errSpy.mock.calls).toEqual([
      ['rules: dropping bonusActions row without a name for', 'Str2024', null],
      ['rules: dropping bonusActions row without a name for', 'Str2024', 42],
      ['rules: dropping bonusActions row without a name for', 'Str2024', ''],
      ['rules: dropping bonusActions row without a name for', 'Str2024', {}],
    ])
    errSpy.mockRestore()
  })

  it('5e twin (#1455(a)): string rows canonicalize in ALL four channels too — same normalizeActionRows contract both arms', () => {
    const errSpy = spyConsoleError()
    const stats = { name: 'Str5e', rules: '5e', actions: ['Attack'], bonusActions: ['Cunning Action', 'Second Wind'], reactions: [], specialActions: ['Rally'] }
    const [actions, bonusActions, , specialActions] = getActions(stats, {})
    expect(actions).toStrictEqual([{ name: 'Attack', description: '', details: null }])
    expect(bonusActions).toStrictEqual([
      { name: 'Cunning Action', description: '', details: null },
      { name: 'Second Wind', description: '', details: null },
    ])
    expect(specialActions).toStrictEqual([{ name: 'Rally', description: '', details: null }])
    expect(errSpy).not.toHaveBeenCalled() // lawful strings: canonicalized, not dropped

    // Garbage rows loud in the 5e arm as well.
    errSpy.mockClear()
    expect(getActions({ ...stats, bonusActions: ['Haste', null] }, {})[1])
      .toStrictEqual([{ name: 'Haste', description: '', details: null }])
    expect(errSpy.mock.calls).toEqual([['rules: dropping bonusActions row without a name for', 'Str5e', null]])
    errSpy.mockRestore()
  })
})

describe('getProficiencies guards (rules-proficiencies.js:119-126/:163-170)', () => {
  it('throws Missing object for null/non-object bonusSource with exact byte, before proficiencyUtils runs; missing class is a golden TypeError', () => {
    // Cited by #1440 implementsOfMercy ('class.major guard'). Key-vs-value case gate:
    // near-miss strings mirror REAL disk shapes (classes.json subclass/major are objects;
    // a plain string is the corruption form the guard exists to catch).
    const cases = [
      ['5e', { subclass: null }, 'Missing object: class.subclass for ProfTest',
        'rules: expected class.subclass to be an object for'],
      ['5e', { subclass: 'War Knight' }, 'Missing object: class.subclass for ProfTest',
        'rules: expected class.subclass to be an object for'],
      ['2024', { major: null }, 'Missing object: class.major for ProfTest',
        'rules: expected class.major to be an object for'],
      ['2024', { major: 'War Domain' }, 'Missing object: class.major for ProfTest',
        'rules: expected class.major to be an object for'],
    ]
    const errSpy = spyConsoleError()
    for (const [ruleset, cls, msg, logPrefix] of cases) {
      errSpy.mockClear()
      const stats = { name: 'ProfTest', rules: ruleset, class: cloneDeep(cls) }
      expect(() => getProficiencies(stats, true, {})).toThrow(new Error(msg))
      expect(errSpy.mock.calls).toEqual([[logPrefix, 'ProfTest']])
    }
    // Guard precedes the collaborator call: bonusSource is built while evaluating the
    // argument list, so neither ruleset's getProficiencies is ever entered.
    expect(pu5eGetProficiencies).not.toHaveBeenCalled()
    expect(pu2024GetProficiencies).not.toHaveBeenCalled()

    // Golden unguarded deref: playerStats.class itself missing throws TypeError with
    // no console byte (guard checks val, not the class hop).
    errSpy.mockClear()
    expect(() => getProficiencies({ name: 'NoClass', rules: '5e' }, true, {})).toThrow(TypeError)
    expect(() => getProficiencies({ name: 'NoClass', rules: '2024' }, true, {})).toThrow(TypeError)
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })
})

describe('getLanguages guards + Ranger bonus (rules-languages.js)', () => {
  it('throws Missing array with exact byte for race/class/subrace channels; subrace guard is behind language_options', () => {
    const errSpy = spyConsoleError()

    errSpy.mockClear()
    expect(() => getLanguages({ name: 'LangTest', class: { languages: [] } }, {}))
      .toThrow(new Error('Missing array: race.languages for LangTest'))
    expect(errSpy.mock.calls).toEqual([['rules: expected race.languages to be an array for', 'LangTest']])

    errSpy.mockClear()
    expect(() => getLanguages({
      name: 'LangTest', race: { languages: ['Common'] }, class: { languages: 'not an array' },
    }, {})).toThrow(new Error('Missing array: class.languages for LangTest'))
    expect(errSpy.mock.calls).toEqual([['rules: expected class.languages to be an array for', 'LangTest']])

    errSpy.mockClear()
    expect(() => getLanguages({
      name: 'LangTest',
      race: { languages: ['Common'], subrace: { languages: 'not an array', language_options: { choose: 1 } } },
      class: { languages: [] },
    }, {})).toThrow(new Error('Missing array: subrace.languages for LangTest'))
    expect(errSpy.mock.calls).toEqual([['rules: expected subrace.languages to be an array for', 'LangTest']])

    // Guard-behind-early-return (#1443 form): WITHOUT language_options the subrace
    // branch exits at :5-7 before the :9 isArray guard — bad subrace.languages never throws.
    errSpy.mockClear()
    expect(getLanguages({
      name: 'LangTest', race: { languages: ['Common'], subrace: { languages: 'silently skipped' } }, class: { languages: [] },
    }, {})).toStrictEqual([3, ['Common']])
    expect(errSpy).not.toHaveBeenCalled()

    // Golden unguarded deref: subclassLanguageBonus reads playerStats.class.subclass
    // unoptional (:34) — missing class throws TypeError, console untouched.
    expect(() => getLanguages({ name: 'LangTest', race: { languages: ['Common'] } }, {})).toThrow(TypeError)
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('Ranger language bonus flips at strictly-greater levels 5 and 13; other classes never bonus', () => {
    const rangerStats = (level) => ({
      name: 'RangerTest',
      race: { languages: ['Common'] },
      class: { name: 'Ranger', languages: [], language_choices: { choose: 0 } },
      languages: [],
      level,
    })
    // Boundaries pin the strict > at :23-24: level 5/13 get NO bump, 6/14 do.
    expect(getLanguages(rangerStats(5), {})).toStrictEqual([3, ['Common']])
    expect(getLanguages(rangerStats(6), {})).toStrictEqual([4, ['Common']])
    expect(getLanguages(rangerStats(13), {})).toStrictEqual([4, ['Common']])
    expect(getLanguages(rangerStats(14), {})).toStrictEqual([5, ['Common']])

    // class.language_choices.choose flows additively on top of the Ranger bump.
    const withChoose = rangerStats(6)
    withChoose.class.language_choices = { choose: 1 }
    expect(getLanguages(withChoose, {})).toStrictEqual([5, ['Common']])

    expect(getLanguages({ ...rangerStats(14), class: { name: 'Fighter', languages: [], language_choices: { choose: 0 } } }, {}))
      .toStrictEqual([3, ['Common']])
  })
})

describe('getMagicItems guard (rules-magicItems.js:7-11)', () => {
  it('throws Missing array with summary name, falling back to the literal unknown byte', () => {
    // Cited by rules-error-handling.test.js:8 (sync per-field guards live here).
    const errSpy = spyConsoleError()
    expect(() => getMagicItems([], { name: 'ItemTest', inventory: { magicItems: 'not an array' } }, { rules: '5e' }))
      .toThrow(new Error('Missing array: inventory.magicItems for ItemTest'))
    expect(errSpy.mock.calls).toEqual([['rules: expected inventory.magicItems to be an array for', 'ItemTest']])

    // :9-10 fallback branch: nameless summary reports the literal 'unknown'.
    errSpy.mockClear()
    expect(() => getMagicItems([], { inventory: { magicItems: null } }, { rules: '2024' }))
      .toThrow(new Error('Missing array: inventory.magicItems for unknown'))
    expect(errSpy.mock.calls).toEqual([['rules: expected inventory.magicItems to be an array for', 'unknown']])
    errSpy.mockRestore()
  })
})
