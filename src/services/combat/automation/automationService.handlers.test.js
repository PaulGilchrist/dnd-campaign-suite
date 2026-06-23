// @improved-by-ai
import { describe, it, expect } from 'vitest'

import {
    hasAutomation,
    getEvasionEffects,
    getAutomationInfo,
    getAllSaveProficiencies,
} from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── hasAutomation ──────────────────────────────────────────────────
describe('hasAutomation', () => {
    it('returns true when feature has an automation object', () => {
        expect(hasAutomation(makeFeature({ type: 'passive_rule' }))).toBe(true)
    })

    it('returns true when automation is an array', () => {
        expect(hasAutomation(makeFeature([{ type: 'passive_rule' }]))).toBe(true)
    })

    it('returns false when feature has no automation property', () => {
        expect(hasAutomation({ name: 'NoAutomation' })).toBe(false)
    })

    it('returns false when feature is null', () => {
        expect(hasAutomation(null)).toBe(false)
    })

    it('returns false when feature is undefined', () => {
        expect(hasAutomation(undefined)).toBe(false)
    })

    it('returns true when automation is an empty object (truthy value)', () => {
        expect(hasAutomation({ name: 'X', automation: {} })).toBe(true)
    })
})

// ── getEvasionEffects ──────────────────────────────────────────────
describe('getEvasionEffects', () => {
    it('returns empty array when features is null', () => {
        expect(getEvasionEffects(null)).toEqual([])
    })

    it('returns empty array when features is undefined', () => {
        expect(getEvasionEffects(undefined)).toEqual([])
    })

    it('returns empty array when features is empty', () => {
        expect(getEvasionEffects([])).toEqual([])
    })

    it('returns empty array when features have no automation', () => {
        expect(getEvasionEffects([{ name: 'Test' }])).toEqual([])
    })

    it('collects evasion effects from a single feature', () => {
        const features = [makeFeature({ type: 'evasion', saveType: 'DEX' }, 'Evasion')]
        const result = getEvasionEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            source: 'Evasion',
            saveType: 'DEX',
            shareable: false,
            shareRange: 0,
        })
    })

    it('collects evasion effects from array automation', () => {
        const features = [
            makeFeature(
                [
                    { type: 'evasion', saveType: 'CON' },
                    { type: 'other' },
                ],
                'Mixed',
            ),
        ]
        const result = getEvasionEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].saveType).toBe('CON')
    })

    it('defaults saveType to DEX when not specified', () => {
        const features = [makeFeature({ type: 'evasion' }, 'Evasion')]
        const result = getEvasionEffects(features)
        expect(result[0].saveType).toBe('DEX')
    })

    it('normalizes saveType to uppercase', () => {
        const features = [makeFeature({ type: 'evasion', saveType: 'dex' }, 'Evasion')]
        const result = getEvasionEffects(features)
        expect(result[0].saveType).toBe('DEX')
    })

    it('respects shareable and shareRange flags', () => {
        const features = [
            makeFeature(
                { type: 'evasion', saveType: 'DEX', shareable: true, shareRange: 30 },
                'Shared Evasion',
            ),
        ]
        const result = getEvasionEffects(features)
        expect(result[0].shareable).toBe(true)
        expect(result[0].shareRange).toBe(30)
    })

    it('defaults shareable to false and shareRange to 0', () => {
        const features = [makeFeature({ type: 'evasion' }, 'Evasion')]
        const result = getEvasionEffects(features)
        expect(result[0].shareable).toBe(false)
        expect(result[0].shareRange).toBe(0)
    })

    it('collects multiple evasion effects from multiple features', () => {
        const features = [
            makeFeature({ type: 'evasion', saveType: 'DEX' }, 'Evasion1'),
            makeFeature({ type: 'evasion', saveType: 'CON' }, 'Evasion2'),
        ]
        const result = getEvasionEffects(features)
        expect(result).toHaveLength(2)
        expect(result.map((r) => r.saveType)).toEqual(['DEX', 'CON'])
    })

    it('collects multiple evasion effects from a single feature with array automation', () => {
        const feature = makeFeature(
            [
                { type: 'evasion', saveType: 'DEX' },
                { type: 'evasion', saveType: 'CON' },
                { type: 'other' },
            ],
            'Multi-Evasion',
        )
        const result = getEvasionEffects([feature])
        expect(result).toHaveLength(2)
        expect(result.map((r) => r.saveType)).toEqual(['DEX', 'CON'])
    })

    it('skips non-evasion automation types', () => {
        const features = [
            makeFeature({ type: 'passive_rule', effect: 'superior_dice' }, 'Passive'),
            makeFeature({ type: 'evasion', saveType: 'DEX' }, 'Evasion'),
        ]
        const result = getEvasionEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].saveType).toBe('DEX')
    })
})

// ── getAutomationInfo ──────────────────────────────────────────────
describe('getAutomationInfo', () => {
    it('returns null when feature has no automation', () => {
        expect(getAutomationInfo({ name: 'Test' }, makePlayerStats())).toBeNull()
    })

    it('returns null when feature is null', () => {
        expect(getAutomationInfo(null, makePlayerStats())).toBeNull()
    })

    it('returns null when automation is null', () => {
        expect(getAutomationInfo({ name: 'Test', automation: null }, makePlayerStats())).toBeNull()
    })

    it('returns automation info for a valid single automation', () => {
        const feature = makeFeature({ type: 'passive_rule', effect: 'superior_dice' })
        const result = getAutomationInfo(feature, makePlayerStats())
        expect(result).not.toBeNull()
        expect(result.type).toBe('passive_rule')
    })

    it('returns first matching info from array automation', () => {
        const feature = makeFeature(
            [
                { type: 'passive_rule', effect: 'first' },
                { type: 'passive_rule', effect: 'second' },
            ],
            'ArrayAuto',
        )
        const result = getAutomationInfo(feature, makePlayerStats())
        expect(result).not.toBeNull()
        expect(result.effect).toBe('first')
    })

    it('returns null when all automations in array return null', () => {
        const feature = makeFeature(
            [
                { type: 'unknown_type_1' },
                { type: 'unknown_type_2' },
            ],
            'UnknownTypes',
        )
        const result = getAutomationInfo(feature, makePlayerStats())
        expect(result).toBeNull()
    })

    it('returns null for unknown automation type', () => {
        const feature = makeFeature({ type: 'unknown_type' })
        const result = getAutomationInfo(feature, makePlayerStats())
        expect(result).toBeNull()
    })
})

// ── getAllSaveProficiencies ────────────────────────────────────────
describe('getAllSaveProficiencies', () => {
    const allSaves = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']

    it('returns all saves when features is null', () => {
        expect(getAllSaveProficiencies(null, {})).toEqual(allSaves)
    })

    it('returns all saves when features is undefined', () => {
        expect(getAllSaveProficiencies(undefined, {})).toEqual(allSaves)
    })

    it('returns empty array when features is empty', () => {
        expect(getAllSaveProficiencies([], {})).toEqual([])
    })

    it('returns empty array when features have no automation', () => {
        expect(getAllSaveProficiencies([{ name: 'Test' }], {})).toEqual([])
    })

    it('grants all save proficiencies via auto_reroll targeting saving_throw', () => {
        const features = [
            makeFeature({ type: 'auto_reroll', target: 'saving_throw' }, 'Disciplined Survivor'),
        ]
        const result = getAllSaveProficiencies(features, {})
        expect(result).toEqual(allSaves)
    })

    it('adds proficiency for a single save type', () => {
        const features = [
            makeFeature(
                {
                    type: 'save_proficiency',
                    saveType: 'WIS',
                },
                'Good Saves',
            ),
        ]
        const result = getAllSaveProficiencies(features, { class: { saving_throw_proficiencies: [] } })
        expect(result).toContain('Wis')
    })

    it('uses fallback type when primary save is already proficient', () => {
        const stats = { class: { saving_throw_proficiencies: ['Wis'] } }
        const features = [
            makeFeature(
                {
                    type: 'save_proficiency',
                    saveType: 'WIS',
                    fallbackTypes: ['INT', 'CHA'],
                },
                'Good Saves',
            ),
        ]
        const result = getAllSaveProficiencies(features, stats)
        expect(result).toContain('Int')
        expect(result).not.toContain('Wis')
    })

    it('uses first available fallback when primary and first fallback are already proficient', () => {
        const stats = { class: { saving_throw_proficiencies: ['Wis', 'Int'] } }
        const features = [
            makeFeature(
                {
                    type: 'save_proficiency',
                    saveType: 'WIS',
                    fallbackTypes: ['INT', 'CHA'],
                },
                'Good Saves',
            ),
        ]
        const result = getAllSaveProficiencies(features, stats)
        expect(result).toContain('Cha')
    })

    it('normalizes save type capitalization', () => {
        const features = [
            makeFeature(
                {
                    type: 'save_proficiency',
                    saveType: 'wis',
                    fallbackTypes: ['int'],
                },
                'Good Saves',
            ),
        ]
        const result = getAllSaveProficiencies(features, {})
        expect(result).toContain('Wis')
    })

    it('handles array automation with save_proficiency', () => {
        const features = [
            makeFeature(
                [
                    { type: 'save_proficiency', saveType: 'CON' },
                    { type: 'other' },
                ],
                'Multi Save',
            ),
        ]
        const result = getAllSaveProficiencies(features, {})
        expect(result).toContain('Con')
    })

    it('deduplicates save proficiencies', () => {
        const features = [
            makeFeature({ type: 'save_proficiency', saveType: 'WIS' }, 'A'),
            makeFeature({ type: 'save_proficiency', saveType: 'wis' }, 'B'),
        ]
        const result = getAllSaveProficiencies(features, {})
        expect(result.filter((s) => s === 'Wis').length).toBe(1)
    })

    it('combines auto_reroll and save_proficiency from multiple features', () => {
        const features = [
            makeFeature({ type: 'auto_reroll', target: 'saving_throw' }, 'Reroller'),
            makeFeature({ type: 'save_proficiency', saveType: 'STR' }, 'Str Savior'),
        ]
        const result = getAllSaveProficiencies(features, {})
        // auto_reroll adds all 6 saves by full name; save_proficiency adds "Str" separately
        expect(result).toContain('Strength')
        expect(result).toContain('Str')
        expect(result.length).toBeGreaterThan(6)
    })

    it('returns only the added save when auto_reroll is not present', () => {
        const features = [
            makeFeature(
                {
                    type: 'save_proficiency',
                    saveType: 'STR',
                    fallbackTypes: ['DEX'],
                },
                'Str Savior',
            ),
        ]
        const result = getAllSaveProficiencies(features, {})
        expect(result).toEqual(['Str'])
    })
})
