// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'

import {
  getEvasionEffects,
  getAllSaveProficiencies,
} from './automationService.js'
import { makeFeature, makePlayerStats } from './automationService.fixtures.js'

// ── getEvasionEffects ─────────────────────────────────────────────
describe('getEvasionEffects', () => {
  describe('null/empty handling', () => {
    it('returns empty array for null, undefined, or empty input', () => {
      expect(getEvasionEffects(null)).toEqual([])
      expect(getEvasionEffects(undefined)).toEqual([])
      expect(getEvasionEffects([])).toEqual([])
    })
  })

  describe('feature filtering', () => {
    it('skips features without automation or with non-evasion type', () => {
      expect(getEvasionEffects([{ name: 'Passive', damageBonus: 2 }])).toEqual([])
      expect(getEvasionEffects([makeFeature({ type: 'damage_bonus' }, 'Damage')])).toEqual([])
    })
  })

  describe('basic evasion extraction', () => {
    it('returns evasion effect with default saveType DEX', () => {
      const result = getEvasionEffects([makeFeature({ type: 'evasion' }, 'Uncanny')])
      expect(result).toEqual([{
        source: 'Uncanny',
        saveType: 'DEX',
        shareable: false,
        shareRange: 0,
      }])
    })

    it('handles custom saveType and uppercases it', () => {
      const result1 = getEvasionEffects([makeFeature({ type: 'evasion', saveType: 'CON' }, 'Evasion')])
      expect(result1[0].saveType).toBe('CON')

      const result2 = getEvasionEffects([makeFeature({ type: 'evasion', saveType: 'wisdom' }, 'Evasion')])
      expect(result2[0].saveType).toBe('WISDOM')
    })

    it('defaults shareable to false and shareRange to 0', () => {
      const result = getEvasionEffects([makeFeature({ type: 'evasion' }, 'Basic')])
      expect(result[0].shareable).toBe(false)
      expect(result[0].shareRange).toBe(0)
    })
  })

  describe('shareable evasion', () => {
    it('recognizes shareable evasion with range', () => {
      const result = getEvasionEffects([makeFeature({ type: 'evasion', shareable: true, shareRange: 30 }, 'Group Evasion')])
      expect(result).toEqual([{
        source: 'Group Evasion',
        saveType: 'DEX',
        shareable: true,
        shareRange: 30,
      }])
    })
  })

  describe('multiple evasion effects', () => {
    it('collects evasion effects from different features', () => {
      const features = [
        makeFeature({ type: 'evasion', saveType: 'DEX' }, 'Evasion1'),
        makeFeature({ type: 'passive_rule' }, 'Not Evasion'),
        makeFeature({ type: 'evasion', saveType: 'WIS' }, 'Evasion2'),
      ]
      const result = getEvasionEffects(features)
      expect(result).toHaveLength(2)
      expect(result[0].source).toBe('Evasion1')
      expect(result[1].source).toBe('Evasion2')
    })

    it('collects multiple evasion automations from a single feature', () => {
      const result = getEvasionEffects([makeFeature([
        { type: 'evasion', saveType: 'DEX' },
        { type: 'evasion', saveType: 'CON' },
      ], 'Double Evasion')])
      expect(result).toHaveLength(2)
      expect(result[0].saveType).toBe('DEX')
      expect(result[1].saveType).toBe('CON')
    })
  })
})

// ── getAllSaveProficiencies ───────────────────────────────────────
describe('getAllSaveProficiencies', () => {
  describe('null handling', () => {
    it('returns all six save types when features is null/undefined', () => {
      const expected = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
      expect(getAllSaveProficiencies(null)).toEqual(expected)
      expect(getAllSaveProficiencies(undefined)).toEqual(expected)
    })

    it('returns empty array when features is empty', () => {
      expect(getAllSaveProficiencies([])).toEqual([])
    })
  })

  describe('auto_reroll targeting saving_throw', () => {
    it('grants all save proficiencies when auto_reroll targets saving_throw', () => {
      const result = getAllSaveProficiencies([makeFeature({
        type: 'auto_reroll',
        target: 'saving_throw',
      }, 'Reroll All Saves')])
      expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })

    it('does not grant all saves when auto_reroll targets something else', () => {
      const result = getAllSaveProficiencies([makeFeature({
        type: 'auto_reroll',
        target: 'd20',
      }, 'Reroll D20')])
      expect(result).toEqual([])
    })
  })

  describe('save_proficiency primary', () => {
    it('grants the primary save proficiency', () => {
      const result = getAllSaveProficiencies([makeFeature(
        { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Intelligence', 'Charisma'] },
        'Iron Mind',
      )])
      expect(result).toEqual(['Wisdom'])
    })

    it('normalizes saveType casing', () => {
      expect(getAllSaveProficiencies([makeFeature({ type: 'save_proficiency', saveType: 'wisdom' }, 'A')])).toEqual(['Wisdom'])
      expect(getAllSaveProficiencies([makeFeature({ type: 'save_proficiency', saveType: 'cHaRiSmA' }, 'B')])).toEqual(['Charisma'])
    })
  })

  describe('save_proficiency fallback logic', () => {
    it('falls back when primary save is already proficient', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Ranger', saving_throw_proficiencies: ['Dexterity', 'Wisdom'] },
      })
      const result = getAllSaveProficiencies([makeFeature(
        { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Intelligence', 'Charisma'] },
        'Iron Mind',
      )], playerStats)
      expect(result).toEqual(['Intelligence'])
    })

    it('skips all fallbacks when all options are already proficient', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Paladin', saving_throw_proficiencies: ['Wisdom', 'Charisma'] },
      })
      const result = getAllSaveProficiencies([makeFeature(
        { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Charisma'] },
        'No Fallback Left',
      )], playerStats)
      expect(result).toEqual([])
    })

    it('uses result-set proficiency to avoid duplicates within same feature', () => {
      const result = getAllSaveProficiencies([makeFeature(
        { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Wisdom', 'Charisma'] },
        'Duplicate Fallback',
      )])
      expect(result).toEqual(['Wisdom'])
    })
  })

  describe('multiple features and combinations', () => {
    it('combines proficiencies from multiple save_proficiency features', () => {
      const result = getAllSaveProficiencies([
        makeFeature({ type: 'save_proficiency', saveType: 'Wisdom' }, 'Iron Mind'),
        makeFeature({ type: 'save_proficiency', saveType: 'Charisma' }, 'Charm Mind'),
      ])
      expect(result).toEqual(['Wisdom', 'Charisma'])
    })

    it('deduplicates when same save appears in multiple features', () => {
      const result = getAllSaveProficiencies([
        makeFeature({ type: 'save_proficiency', saveType: 'Wisdom' }, 'Iron Mind'),
        makeFeature({ type: 'save_proficiency', saveType: 'wisdom' }, 'Second Iron Mind'),
      ])
      expect(result).toEqual(['Wisdom'])
    })

    it('combines auto_reroll all-saves with save_proficiency fallback', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Ranger', saving_throw_proficiencies: ['Dexterity'] },
      })
      const result = getAllSaveProficiencies([
        makeFeature({ type: 'auto_reroll', target: 'saving_throw' }, 'Reroll All'),
        makeFeature({ type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Charisma'] }, 'Iron Mind'),
      ], playerStats)
      expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })
  })
})
