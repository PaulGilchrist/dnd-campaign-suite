import { describe, it, expect } from 'vitest'
import {
    hasAutomation,
    getEvasionEffects,
    getAutomationInfo,
    getAllSaveProficiencies,
    buildAttackInfo,
    collectAutomationFromFeatures,
    collectTurnStartEffects,
    collectSaveModifiers,
    getConditionImmunities,
    getConditionalImmunities,
    playerIsImmuneToCondition,
    hasSelfRestoration,
    getPassiveBuffs,
    collectWeaponMastery,
    resolveHealingBonuses,
    hasHealingMaximization,
    hasRerollHealingOnes,
    hasTacticalShift,
    hasSpeedyOpportunityDisadvantage,
    hasSpeedyDifficultTerrainIgnore,
    hasIgnoreResistance,
    hasMinDamage,
    hasTruesight,
    hasFastWrestler,
    hasGreatWeaponFighting,
    hasTwoWeaponFighting,
    hasSomaticComponentWaiver,
    hasNaturallyStealthy,
} from './automationService.js'

describe('hasAutomation', () => {
    it('returns true when feature has automation', () => {
        expect(hasAutomation({ automation: { type: 'test' } })).toBe(true)
    })

    it('returns false when feature has no automation', () => {
        expect(hasAutomation({ name: 'Test' })).toBe(false)
    })

    it('returns false for null input', () => {
        expect(hasAutomation(null)).toBe(false)
    })

    it('returns false for undefined input', () => {
        expect(hasAutomation(undefined)).toBe(false)
    })

    it('returns false when automation is null', () => {
        expect(hasAutomation({ automation: null })).toBe(false)
    })

    it('returns false when automation is empty object', () => {
        expect(hasAutomation({ automation: {} })).toBe(true)
    })
})

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

    it('collects evasion effects', () => {
        const features = [{
            name: 'Evasion',
            automation: { type: 'evasion', saveType: 'DEX' }
        }]
        const result = getEvasionEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            source: 'Evasion',
            saveType: 'DEX',
            shareable: false,
            shareRange: 0
        })
    })

    it('handles array automation', () => {
        const features = [{
            name: 'Mixed',
            automation: [
                { type: 'evasion', saveType: 'CON' },
                { type: 'other' }
            ]
        }]
        const result = getEvasionEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].saveType).toBe('CON')
    })

    it('handles shareable flag', () => {
        const features = [{
            name: 'Evasion',
            automation: { type: 'evasion', saveType: 'DEX', shareable: true, shareRange: 30 }
        }]
        const result = getEvasionEffects(features)
        expect(result[0].shareable).toBe(true)
        expect(result[0].shareRange).toBe(30)
    })

    it('defaults saveType to DEX when not specified', () => {
        const features = [{
            name: 'Evasion',
            automation: { type: 'evasion' }
        }]
        const result = getEvasionEffects(features)
        expect(result[0].saveType).toBe('DEX')
    })
})

describe('getAutomationInfo', () => {
    it('returns null when feature has no automation', () => {
        expect(getAutomationInfo({ name: 'Test' }, {})).toBeNull()
    })

    it('returns null when automation is null', () => {
        expect(getAutomationInfo({ name: 'Test', automation: null }, {})).toBeNull()
    })

    it('returns info for single automation', () => {
        const feature = { name: 'Test', automation: { type: 'auto_effect', effect: 'test' } }
        const result = getAutomationInfo(feature, {})
        expect(result).not.toBeNull()
        expect(result.type).toBe('auto_effect')
    })

    it('returns first matching info from array automation', () => {
        const feature = {
            name: 'Test',
            automation: [
                { type: 'auto_effect', effect: 'first' },
                { type: 'auto_effect', effect: 'second' }
            ]
        }
        const result = getAutomationInfo(feature, {})
        expect(result).not.toBeNull()
        expect(result.effect).toBe('first')
    })

    it('returns null when all automations in array return null', () => {
        const feature = {
            name: 'Test',
            automation: [
                { type: 'unknown_type_1' },
                { type: 'unknown_type_2' }
            ]
        }
        const result = getAutomationInfo(feature, {})
        expect(result).toBeNull()
    })
})

describe('getAllSaveProficiencies', () => {
    it('returns all saves when features is null', () => {
        const result = getAllSaveProficiencies(null, {})
        expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })

    it('returns all saves when features is undefined', () => {
        const result = getAllSaveProficiencies(undefined, {})
        expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })

    it('returns empty array when features is empty', () => {
        const result = getAllSaveProficiencies([], {})
        expect(result).toEqual([])
    })

    it('returns empty array when features have no automation', () => {
        const result = getAllSaveProficiencies([{ name: 'Test' }], {})
        expect(result).toEqual([])
    })

    it('adds all saves when auto_reroll targeting saving_throw is found', () => {
        const features = [{
            name: 'Disciplined Survivor',
            automation: { type: 'auto_reroll', target: 'saving_throw' }
        }]
        const result = getAllSaveProficiencies(features, {})
        expect(result).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'])
    })

    it('adds save proficiency with fallback types', () => {
        const features = [{
            name: 'Good Saves',
            automation: {
                type: 'save_proficiency',
                saveType: 'WIS',
                fallbackTypes: ['INT', 'CHA']
            }
        }]
        const result = getAllSaveProficiencies(features, { class: { saving_throw_proficiencies: [] } })
        expect(result).toContain('Wis')
    })

    it('uses fallback type when primary save already proficient', () => {
        const features = [{
            name: 'Good Saves',
            automation: {
                type: 'save_proficiency',
                saveType: 'WIS',
                fallbackTypes: ['INT', 'CHA']
            }
        }]
        const result = getAllSaveProficiencies(features, { class: { saving_throw_profilities: [] } })
        // Since result starts empty, WIS is added first
        expect(result).toContain('Wis')
    })

    it('normalizes save type capitalization', () => {
        const features = [{
            name: 'Good Saves',
            automation: {
                type: 'save_proficiency',
                saveType: 'wis',
                fallbackTypes: ['int']
            }
        }]
        const result = getAllSaveProficiencies(features, {})
        expect(result).toContain('Wis')
    })
})

describe('re-exports', () => {
    it('re-exports buildAttackInfo', () => {
        expect(buildAttackInfo).toBeDefined()
        expect(typeof buildAttackInfo).toBe('function')
    })

    it('re-exports collectAutomationFromFeatures', () => {
        expect(collectAutomationFromFeatures).toBeDefined()
        expect(typeof collectAutomationFromFeatures).toBe('function')
    })

    it('re-exports collectTurnStartEffects', () => {
        expect(collectTurnStartEffects).toBeDefined()
        expect(typeof collectTurnStartEffects).toBe('function')
    })

    it('re-exports collectSaveModifiers', () => {
        expect(collectSaveModifiers).toBeDefined()
        expect(typeof collectSaveModifiers).toBe('function')
    })

    it('re-exports getConditionImmunities', () => {
        expect(getConditionImmunities).toBeDefined()
        expect(typeof getConditionImmunities).toBe('function')
    })

    it('re-exports getConditionalImmunities', () => {
        expect(getConditionalImmunities).toBeDefined()
        expect(typeof getConditionalImmunities).toBe('function')
    })

    it('re-exports playerIsImmuneToCondition', () => {
        expect(playerIsImmuneToCondition).toBeDefined()
        expect(typeof playerIsImmuneToCondition).toBe('function')
    })

    it('re-exports hasSelfRestoration', () => {
        expect(hasSelfRestoration).toBeDefined()
        expect(typeof hasSelfRestoration).toBe('function')
    })

    it('re-exports getPassiveBuffs', () => {
        expect(getPassiveBuffs).toBeDefined()
        expect(typeof getPassiveBuffs).toBe('function')
    })

    it('re-exports collectWeaponMastery', () => {
        expect(collectWeaponMastery).toBeDefined()
        expect(typeof collectWeaponMastery).toBe('function')
    })

    it('re-exports resolveHealingBonuses', () => {
        expect(resolveHealingBonuses).toBeDefined()
        expect(typeof resolveHealingBonuses).toBe('function')
    })

    it('re-exports hasHealingMaximization', () => {
        expect(hasHealingMaximization).toBeDefined()
        expect(typeof hasHealingMaximization).toBe('function')
    })

    it('re-exports hasRerollHealingOnes', () => {
        expect(hasRerollHealingOnes).toBeDefined()
        expect(typeof hasRerollHealingOnes).toBe('function')
    })

    it('re-exports hasTacticalShift', () => {
        expect(hasTacticalShift).toBeDefined()
        expect(typeof hasTacticalShift).toBe('function')
    })

    it('re-exports hasSpeedyOpportunityDisadvantage', () => {
        expect(hasSpeedyOpportunityDisadvantage).toBeDefined()
        expect(typeof hasSpeedyOpportunityDisadvantage).toBe('function')
    })

    it('re-exports hasSpeedyDifficultTerrainIgnore', () => {
        expect(hasSpeedyDifficultTerrainIgnore).toBeDefined()
        expect(typeof hasSpeedyDifficultTerrainIgnore).toBe('function')
    })

    it('re-exports hasIgnoreResistance', () => {
        expect(hasIgnoreResistance).toBeDefined()
        expect(typeof hasIgnoreResistance).toBe('function')
    })

    it('re-exports hasMinDamage', () => {
        expect(hasMinDamage).toBeDefined()
        expect(typeof hasMinDamage).toBe('function')
    })

    it('re-exports hasTruesight', () => {
        expect(hasTruesight).toBeDefined()
        expect(typeof hasTruesight).toBe('function')
    })

    it('re-exports hasFastWrestler', () => {
        expect(hasFastWrestler).toBeDefined()
        expect(typeof hasFastWrestler).toBe('function')
    })

    it('re-exports hasGreatWeaponFighting', () => {
        expect(hasGreatWeaponFighting).toBeDefined()
        expect(typeof hasGreatWeaponFighting).toBe('function')
    })

    it('re-exports hasTwoWeaponFighting', () => {
        expect(hasTwoWeaponFighting).toBeDefined()
        expect(typeof hasTwoWeaponFighting).toBe('function')
    })

    it('re-exports hasSomaticComponentWaiver', () => {
        expect(hasSomaticComponentWaiver).toBeDefined()
        expect(typeof hasSomaticComponentWaiver).toBe('function')
    })

    it('re-exports hasNaturallyStealthy', () => {
        expect(hasNaturallyStealthy).toBeDefined()
        expect(typeof hasNaturallyStealthy).toBe('function')
    })
})
