// @maintained-by-ai
// ── MODIFIERS LANE: automationService-local evasion + save-proficiency rows ──
// Family split (automationService.*, #971-#978):
//   • THIS FILE — the ONLY owner of the transform bytes of the two local entry
//     points defined in automationService.js (not re-exports):
//       1. getEvasionEffects (automationService.js:126-144) — evasion-row stamp:
//          DEX default, saveType uppercase, shareable/shareRange coerced, and
//          automation-array flattening (hand-derived exact bytes, #815/#829).
//       2. getAllSaveProficiencies (automationService.js:183-202) — save-row
//          collection: null→all-six quirk, auto_reroll all-saves grant,
//          save_proficiency primary→fallback chain with class-save guard,
//          save-name normalization, and Set dedup/order.
//   • automationService.core.test.js (#973) — facade-surface pin includes
//     collectSaveModifiers/evasion/proficiency keys BY IDENTITY; modifier-row
//     internals (registry dispatch, normalization roster legs) owned by
//     automationModifiers.test.js (#964) — cited here, never re-run.
//   • rules.cla396-saveProficiencies.test.js mocks these two functions
//     (vi.fn(() => [])) — no transform coverage overlaps there.
// APPLIED REC #973: owned faces trimmed to minimum strong form — 16→9 tests.
// Old → new map:
//   getEvasionEffects 8→4: null/empty + skip-filter 2→1; default-bytes +
//     shareable-default 2→1 (defaults already inside the exact-shape pin);
//     uppercase + shareable-range 2→1 exact stamp; multi-feature + multi-automation
//     2→1 exact-array with interleaved skips.
//   getAllSaveProficiencies 8→5: null + empty 2→1; auto_reroll all + d20-guard +
//     reroll-all-dominates-combo 3→1 folded runs; primary + casing + fallbacks-
//     unused-when-primary-free 3→1 folded runs; fallback-chain + none-left 2→1;
//     multi-combine + dedup 2→1.
// Mock hygiene: real service code, test-utils mocks consumer-exact;
// zero timers, zero network, fully deterministic.
import { describe, it, expect } from 'vitest'

import {
  getEvasionEffects,
  getAllSaveProficiencies,
} from './automationService.js'
import { makeFeature, makePlayerStats } from './automationService.test-utils.js'

const ALL_SAVES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']

// ── getEvasionEffects (automationService.js:126-144) ─────────────────
describe('getEvasionEffects', () => {
  it('returns [] for null/undefined/empty input and for features without evasion automation', () => {
    expect(getEvasionEffects(null)).toEqual([])
    expect(getEvasionEffects(undefined)).toEqual([])
    expect(getEvasionEffects([])).toEqual([])
    expect(getEvasionEffects([
      { name: 'Passive', damageBonus: 2 },                          // no automation key
      makeFeature({ type: 'damage_bonus' }, 'Damage'),               // non-evasion type
    ])).toEqual([])
  })

  it('stamps the exact evasion-row shape with defaults saveType DEX, shareable false, shareRange 0', () => {
    expect(getEvasionEffects([makeFeature({ type: 'evasion' }, 'Uncanny')])).toEqual([{
      source: 'Uncanny',
      saveType: 'DEX',
      shareable: false,
      shareRange: 0,
    }])
  })

  it('uppercases custom saveType and passes shareable/shareRange through', () => {
    expect(getEvasionEffects([
      makeFeature({ type: 'evasion', saveType: 'CON' }, 'Evasion'),
      makeFeature({ type: 'evasion', saveType: 'wisdom', shareable: true, shareRange: 30 }, 'Group Evasion'),
    ])).toEqual([
      { source: 'Evasion', saveType: 'CON', shareable: false, shareRange: 0 },
      { source: 'Group Evasion', saveType: 'WISDOM', shareable: true, shareRange: 30 },
    ])
  })

  it('collects every evasion half across features and automation arrays, skipping everything else', () => {
    const result = getEvasionEffects([
      makeFeature({ type: 'evasion' }, 'Uncanny Dodge'),
      makeFeature({ type: 'passive_rule' }, 'Not Evasion'),
      makeFeature([
        { type: 'evasion', saveType: 'CON' },
        { type: 'damage_bonus' },
        { type: 'evasion', shareable: true, shareRange: 30 },
      ], 'Double Evasion'),
    ])
    expect(result).toEqual([
      { source: 'Uncanny Dodge', saveType: 'DEX', shareable: false, shareRange: 0 },
      { source: 'Double Evasion', saveType: 'CON', shareable: false, shareRange: 0 },
      { source: 'Double Evasion', saveType: 'DEX', shareable: true, shareRange: 30 },
    ])
  })

  // #979: sparse automation arrays — executor tolerates null entries
  // (automation/index.js:718 if (!a) return false) and isInteractiveAutomation
  // guards the same shape (automationService.js:118). getEvasionEffects skips
  // null halves silently: no throw, non-matching subset returned.
  it('skips null automation entries silently — [null] alone and mixed [valid, null, valid] arms (#979)', () => {
    expect(getEvasionEffects([{ name: 'Sparse', automation: [null] }])).toEqual([])
    expect(getEvasionEffects([
      makeFeature({ type: 'evasion' }, 'Uncanny Dodge'),
      { name: 'Sparse', automation: [null] },
      null,
    ])).toEqual([
      { source: 'Uncanny Dodge', saveType: 'DEX', shareable: false, shareRange: 0 },
    ])
    expect(getEvasionEffects([
      makeFeature([
        { type: 'evasion' },
        null,
        { type: 'evasion', saveType: 'CON', shareable: true, shareRange: 30 },
      ], 'Mixed Evasion'),
    ])).toEqual([
      { source: 'Mixed Evasion', saveType: 'DEX', shareable: false, shareRange: 0 },
      { source: 'Mixed Evasion', saveType: 'CON', shareable: true, shareRange: 30 },
    ])
  })
})

// ── getAllSaveProficiencies (automationService.js:183-202) ───────────
describe('getAllSaveProficiencies', () => {
  it('grants all six saves when features is null/undefined, none when the list is empty', () => {
    expect(getAllSaveProficiencies(null)).toEqual(ALL_SAVES)
    expect(getAllSaveProficiencies(undefined)).toEqual(ALL_SAVES)
    expect(getAllSaveProficiencies([])).toEqual([])
  })

  it('auto_reroll granting saves: saving_throw grants all six in canonical order, other targets grant none, and reroll-all dominates combined rows', () => {
    expect(getAllSaveProficiencies([
      makeFeature({ type: 'auto_reroll', target: 'saving_throw' }, 'Reroll All Saves'),
    ])).toEqual(ALL_SAVES)
    expect(getAllSaveProficiencies([
      makeFeature({ type: 'auto_reroll', target: 'd20' }, 'Reroll D20'),
    ])).toEqual([])
    // reroll-all already owns all six — a co-resident save_proficiency adds nothing
    expect(getAllSaveProficiencies([
      makeFeature({ type: 'auto_reroll', target: 'saving_throw' }, 'Reroll All'),
      makeFeature({ type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Charisma'] }, 'Iron Mind'),
    ], makePlayerStats({ class: { name: 'Ranger', saving_throw_proficiencies: ['Dexterity'] } }))).toEqual(ALL_SAVES)
  })

  it('save_proficiency grants its case-normalized primary save and skips fallbacks while primary is free', () => {
    expect(getAllSaveProficiencies([
      makeFeature({ type: 'save_proficiency', saveType: 'wisdom', fallbackTypes: ['Intelligence', 'Charisma'] }, 'Iron Mind'),
    ])).toEqual(['Wisdom'])
    expect(getAllSaveProficiencies([
      makeFeature({ type: 'save_proficiency', saveType: 'cHaRiSmA' }, 'B'),
    ])).toEqual(['Charisma'])
    expect(getAllSaveProficiencies([
      makeFeature({ type: 'save_proficiency', fallbackTypes: ['Wisdom'] }, 'No Primary'),
    ])).toEqual([])
  })

  it('save_proficiency falls through fallbackTypes in order when class saves block, and adds nothing when every option is proficient', () => {
    expect(getAllSaveProficiencies([
      makeFeature({ type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Intelligence', 'Charisma'] }, 'Iron Mind'),
    ], makePlayerStats({ class: { name: 'Ranger', saving_throw_proficiencies: ['Dexterity', 'Wisdom'] } }))).toEqual(['Intelligence'])
    expect(getAllSaveProficiencies([
      makeFeature({ type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Charisma'] }, 'No Fallback Left'),
    ], makePlayerStats({ class: { name: 'Paladin', saving_throw_proficiencies: ['Wisdom', 'Charisma'] } }))).toEqual([])
  })

  it('combines multiple save_proficiency features in order, deduped case-insensitively', () => {
    expect(getAllSaveProficiencies([
      makeFeature({ type: 'save_proficiency', saveType: 'Wisdom' }, 'Iron Mind'),
      makeFeature({ type: 'save_proficiency', saveType: 'Charisma' }, 'Charm Mind'),
      makeFeature({ type: 'save_proficiency', saveType: 'wisdom' }, 'Second Iron Mind'),
    ])).toEqual(['Wisdom', 'Charisma'])
  })
})
