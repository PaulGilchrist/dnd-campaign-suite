import { describe, it, expect } from 'vitest'
import { classFeatureHandlers } from './class-feature-handlers.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// ── telekinetic_shove ────────────────────────────────────────────────

describe('classFeatureHandlers – telekinetic_shove', () => {
    it('computes saveDc from ability modifier + proficiency when saveDc is ability', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            saveDc: 'ability',
            saveAbility: 'INT'
        })
        const result = classFeatureHandlers.telekinetic_shove(feature, BASE_STATS)
        expect(result.type).toBe('telekinetic_shove')
        expect(result.saveType).toBe('STR')
        expect(result.saveAbility).toBe('INT')
        // getAbilityModifier(abilities, 'INT') + proficiency = 1 + 3 = 4, so 8 + 4 = 12
        expect(result.saveDc).toBe(12)
        expect(result.range).toBe('30')
        expect(result.pushDistance).toBe(5)
        expect(result.action).toBe('bonus_action')
        expect(result.hasAutomation).toBe(true)
    })

    it('uses explicit numeric saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            saveDc: 15
        })
        const result = classFeatureHandlers.telekinetic_shove(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('derives action from casting_time bonus action', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            casting_time: '1 bonus action'
        })
        const result = classFeatureHandlers.telekinetic_shove(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
    })

    it('derives action from casting_time action', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            casting_time: '1 action'
        })
        const result = classFeatureHandlers.telekinetic_shove(feature, BASE_STATS)
        expect(result.action).toBe('action')
    })
})

// ── arcane_ward ──────────────────────────────────────────────────────

describe('classFeatureHandlers – arcane_ward', () => {
    it('computes maxHp from wizard level and INT modifier', () => {
        const feature = makeFeature({ type: 'arcane_ward' })
        const result = classFeatureHandlers.arcane_ward(feature, BASE_STATS)
        expect(result.type).toBe('arcane_ward')
        // level(5) * 2 + intMod(1) = 11
        expect(result.maxHp).toBe(11)
        expect(result.wardHpExpression).toBe('(2 * 5) + 1')
        expect(result.wardRestoreExpression).toBe('2 * spell_slot_level')
        expect(result.wardTrigger).toBe('abjuration_spell_cast')
        expect(result.wardDuration).toBe('long_rest')
        expect(result.bonusActionRestore).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('respects custom wardHpExpression and wardRestoreExpression', () => {
        const feature = makeFeature({
            type: 'arcane_ward',
            wardHpExpression: 'custom_expression',
            wardRestoreExpression: 'custom_restore'
        })
        const result = classFeatureHandlers.arcane_ward(feature, BASE_STATS)
        expect(result.wardHpExpression).toBe('custom_expression')
        expect(result.wardRestoreExpression).toBe('custom_restore')
    })

    it('respects bonusActionRestore flag', () => {
        const feature = makeFeature({
            type: 'arcane_ward',
            bonusActionRestore: true
        })
        const result = classFeatureHandlers.arcane_ward(feature, BASE_STATS)
        expect(result.bonusActionRestore).toBe(true)
    })
})

// ── arcane_ward_bonus_action ─────────────────────────────────────────

describe('classFeatureHandlers – arcane_ward_bonus_action', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'arcane_ward_bonus_action' })
        const result = classFeatureHandlers.arcane_ward_bonus_action(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'arcane_ward_bonus_action',
            action: 'bonus_action',
            casting_time: '1 bonus action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── projected_ward ───────────────────────────────────────────────────

describe('classFeatureHandlers – projected_ward', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'projected_ward' })
        const result = classFeatureHandlers.projected_ward(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'projected_ward',
            range: 30,
            reaction: true,
            wardTrigger: 'ally_damage_taken',
            casting_time: '1 reaction',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── animal_aspect ────────────────────────────────────────────────────

describe('classFeatureHandlers – animal_aspect', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'animal_aspect' })
        const result = classFeatureHandlers.animal_aspect(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'animal_aspect',
            options: [],
            casting_time: '',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── clouds_jaunt ─────────────────────────────────────────────────────

describe('classFeatureHandlers – clouds_jaunt', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'clouds_jaunt' })
        const result = classFeatureHandlers.clouds_jaunt(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'clouds_jaunt',
            distance: '30 ft',
            range: '30_ft',
            uses: null,
            recharge: 'long_rest',
            casting_time: '1 bonus action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })

    it('includes automation object', () => {
        const feature = makeFeature({ type: 'clouds_jaunt', distance: '60 ft' })
        const result = classFeatureHandlers.clouds_jaunt(feature, BASE_STATS)
        expect(result.automation).toBeDefined()
        expect(result.distance).toBe('60 ft')
    })
})
