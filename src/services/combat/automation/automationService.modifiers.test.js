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
    it('returns empty array when features is null', () => {
      expect(getEvasionEffects(null)).toEqual([])
    })

    it('returns empty array when features is undefined', () => {
      expect(getEvasionEffects(undefined)).toEqual([])
    })

    it('returns empty array when features is empty', () => {
      expect(getEvasionEffects([])).toEqual([])
    })
  })

  describe('non-evasion feature filtering', () => {
    it('skips features without automation', () => {
      const features = [{ name: 'Passive', damageBonus: 2 }]
      expect(getEvasionEffects(features)).toEqual([])
    })

    it('skips features with non-evasion automation type', () => {
      const features = [makeFeature({ type: 'damage_bonus' }, 'Damage')]
      expect(getEvasionEffects(features)).toEqual([])
    })

    it('skips features with automation that is not evasion', () => {
      const features = [makeFeature({ type: 'conditional_advantage' }, 'Advantage')]
      expect(getEvasionEffects(features)).toEqual([])
    })
  })

  describe('basic evasion extraction', () => {
    it('returns evasion effect with default saveType DEX', () => {
      const features = [makeFeature({ type: 'evasion' }, 'Uncanny')]
      const result = getEvasionEffects(features)
      expect(result).toEqual([{
        source: 'Uncanny',
        saveType: 'DEX',
        shareable: false,
        shareRange: 0,
      }])
    })

    it('uses custom saveType when provided', () => {
      const features = [makeFeature({ type: 'evasion', saveType: 'CON' }, 'Evasion')]
      const result = getEvasionEffects(features)
      expect(result[0].saveType).toBe('CON')
    })

    it('uppercases saveType', () => {
      const features = [makeFeature({ type: 'evasion', saveType: 'wisdom' }, 'Evasion')]
      const result = getEvasionEffects(features)
      expect(result[0].saveType).toBe('WISDOM')
    })

    it('defaults shareable to false and shareRange to 0', () => {
      const features = [makeFeature({ type: 'evasion' }, 'Basic')]
      const result = getEvasionEffects(features)
      expect(result[0].shareable).toBe(false)
      expect(result[0].shareRange).toBe(0)
    })
  })

  describe('shareable evasion', () => {
    it('recognizes shareable evasion with range', () => {
      const features = [makeFeature({ type: 'evasion', shareable: true, shareRange: 30 }, 'Group Evasion')]
      const result = getEvasionEffects(features)
      expect(result).toEqual([{
        source: 'Group Evasion',
        saveType: 'DEX',
        shareable: true,
        shareRange: 30,
      }])
    })

    it('defaults shareRange to 0 when shareable is true but range not provided', () => {
      const features = [makeFeature({ type: 'evasion', shareable: true }, 'Share Only')]
      const result = getEvasionEffects(features)
      expect(result[0].shareRange).toBe(0)
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

    it('collects multiple evasion automations from a single feature array', () => {
      const features = [makeFeature([
        { type: 'evasion', saveType: 'DEX' },
        { type: 'evasion', saveType: 'CON' },
      ], 'Double Evasion')]
      const result = getEvasionEffects(features)
      expect(result).toHaveLength(2)
      expect(result[0].saveType).toBe('DEX')
      expect(result[1].saveType).toBe('CON')
    })
  })
})

// ── getAllSaveProficiencies with save_proficiency ─────────────────
describe('getAllSaveProficiencies', () => {
  describe('null handling', () => {
    it('returns all six save types when features is null', () => {
      const result = getAllSaveProficiencies(null)
      expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })

    it('returns all six save types when features is undefined', () => {
      const result = getAllSaveProficiencies(undefined)
      expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })

    it('returns empty array when features is empty', () => {
      const result = getAllSaveProficiencies([])
      expect(result).toEqual([])
    })
  })

  describe('auto_reroll targeting saving_throw', () => {
    it('grants all save proficiencies when auto_reroll targets saving_throw', () => {
      const features = [makeFeature({
        type: 'auto_reroll',
        target: 'saving_throw',
      }, 'Reroll All Saves')]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })

    it('does not grant all saves when auto_reroll targets something else', () => {
      const features = [makeFeature({
        type: 'auto_reroll',
        target: 'd20',
      }, 'Reroll D20')]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual([])
    })
  })

  describe('save_proficiency primary', () => {
    it('grants the primary save proficiency', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Intelligence', 'Charisma'] },
          'Iron Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Wisdom'])
    })

    it('normalizes saveType casing', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'wisdom' },
          'Iron Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Wisdom'])
    })

    it('handles saveType with all lowercase', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'strength' },
          'Strong Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Strength'])
    })

    it('handles saveType with mixed case', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'cHaRiSmA' },
          'Charisma Save',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Charisma'])
    })
  })

  describe('save_proficiency fallback logic', () => {
    it('falls back to first available fallback when primary already has proficiency', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Ranger', saving_throw_proficiencies: ['Dexterity', 'Wisdom'] },
      })
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Intelligence', 'Charisma'] },
          'Iron Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features, playerStats)
      expect(result).toEqual(['Intelligence'])
    })

    it('falls through multiple fallbacks until finding one not already proficient', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Ranger', saving_throw_proficiencies: ['Dexterity', 'Wisdom', 'Intelligence'] },
      })
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Intelligence', 'Charisma'] },
          'Iron Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features, playerStats)
      expect(result).toEqual(['Charisma'])
    })

    it('uses result-set proficiency to avoid duplicates within same feature', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Wisdom', 'Charisma'] },
          'Duplicate Fallback',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Wisdom'])
    })

    it('returns empty array when all options are already proficient', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Paladin', saving_throw_proficiencies: ['Wisdom', 'Charisma'] },
      })
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Charisma'] },
          'No Fallback Left',
        ),
      ]
      const result = getAllSaveProficiencies(features, playerStats)
      expect(result).toEqual([])
    })
  })

  describe('multiple save_proficiency features', () => {
    it('combines proficiencies from multiple save_proficiency features', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom' },
          'Iron Mind',
        ),
        makeFeature(
          { type: 'save_proficiency', saveType: 'Charisma' },
          'Charm Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Wisdom', 'Charisma'])
    })

    it('deduplicates when same save appears in multiple features', () => {
      const features = [
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom' },
          'Iron Mind',
        ),
        makeFeature(
          { type: 'save_proficiency', saveType: 'wisdom' },
          'Second Iron Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features)
      expect(result).toEqual(['Wisdom'])
    })
  })

  describe('mixed auto_reroll and save_proficiency', () => {
    it('combines auto_reroll all-saves with save_proficiency fallback', () => {
      const playerStats = makePlayerStats({
        class: { name: 'Ranger', saving_throw_proficiencies: ['Dexterity'] },
      })
      const features = [
        makeFeature({
          type: 'auto_reroll',
          target: 'saving_throw',
        }, 'Reroll All'),
        makeFeature(
          { type: 'save_proficiency', saveType: 'Wisdom', fallbackTypes: ['Charisma'] },
          'Iron Mind',
        ),
      ]
      const result = getAllSaveProficiencies(features, playerStats)
      expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })
  })
})
