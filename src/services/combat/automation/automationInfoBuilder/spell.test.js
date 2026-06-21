// @improved-by-ai
import { describe, it, expect, vi } from 'vitest'
import { spellHandlers } from './spell.js'
import * as expressModule from '../automationExpressions.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('spellHandlers – free_spell', () => {
    it('returns free_spell info with defaults', () => {
        const feature = makeFeature({ type: 'free_spell' })
        const result = spellHandlers.free_spell(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'free_spell',
            name: 'Test Feature',
            spell: '',
            uses: 1,
            uses_expression: '',
            usesMax: 1,
            recharge: 'long_rest',
            action: 'action',
            duration: '',
            concentration: false,
            noConcentration: false,
            resourceCost: '',
            freeCasts: '',
            casting_time: '',
            perSpellTracking: false,
            hasAutomation: true,
        })
    })

    it('passes through custom spell fields', () => {
        const feature = makeFeature({
            type: 'free_spell',
            spell: 'fireball',
            uses: 3,
            recharge: 'short_rest',
            action: 'bonus_action',
            duration: '1_minute',
            concentration: true,
            resourceCost: 'spell_slot',
            freeCasts: 'once_per_rest',
            casting_time: '1 action',
            perSpellTracking: true,
        })
        const result = spellHandlers.free_spell(feature, BASE_STATS)
        expect(result).toMatchObject({
            spell: 'fireball',
            uses: 3,
            recharge: 'short_rest',
            action: 'bonus_action',
            duration: '1_minute',
            concentration: true,
            resourceCost: 'spell_slot',
            freeCasts: 'once_per_rest',
            casting_time: '1 action',
            perSpellTracking: true,
        })
    })

    it('coerces concentration and noConcentration to booleans', () => {
        const feature = makeFeature({
            type: 'free_spell',
            concentration: 'yes',
            noConcentration: 1,
        })
        const result = spellHandlers.free_spell(feature, BASE_STATS)
        expect(result.concentration).toBe(true)
        expect(result.noConcentration).toBe(true)
    })

    it('resolves usesMax from uses_expression', () => {
        const evaluateAutoExpression = vi.spyOn(expressModule, 'evaluateAutoExpression')
            .mockReturnValue(5)

        const feature = makeFeature({
            type: 'free_spell',
            uses_expression: 'proficiency_bonus',
        })
        const result = spellHandlers.free_spell(feature, BASE_STATS)
        expect(result.usesMax).toBe(5)
        expect(evaluateAutoExpression).toHaveBeenCalledWith('proficiency_bonus', BASE_STATS)

        evaluateAutoExpression.mockRestore()
    })

    it('falls back to 1 when uses_expression returns falsy', () => {
        const evaluateAutoExpression = vi.spyOn(expressModule, 'evaluateAutoExpression')
            .mockReturnValue(null)

        const feature = makeFeature({
            type: 'free_spell',
            uses_expression: 'proficiency_bonus',
            uses: 4,
        })
        const result = spellHandlers.free_spell(feature, BASE_STATS)
        expect(result.usesMax).toBe(1)

        evaluateAutoExpression.mockRestore()
    })

    it('defaults usesMax to 1 when no uses and no expression', () => {
        const feature = makeFeature({ type: 'free_spell' })
        const result = spellHandlers.free_spell(feature, BASE_STATS)
        expect(result.usesMax).toBe(1)
    })
})

describe('spellHandlers – fey_reinforcements', () => {
    it('returns fey_reinforcements info with defaults', () => {
        const feature = makeFeature({ type: 'fey_reinforcements' })
        const result = spellHandlers.fey_reinforcements(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'fey_reinforcements',
            name: 'Test Feature',
            spell: '',
            uses: 1,
            uses_expression: '',
            usesMax: 1,
            recharge: 'long_rest',
            action: 'action',
            duration: '',
            casting_time: '',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'fey_reinforcements',
            spell: 'call lightess',
            uses: 2,
            recharge: 'short_rest',
            action: 'bonus_action',
            duration: '1_round',
            casting_time: '1 reaction',
        })
        const result = spellHandlers.fey_reinforcements(feature, BASE_STATS)
        expect(result).toMatchObject({
            spell: 'call lightess',
            uses: 2,
            recharge: 'short_rest',
            action: 'bonus_action',
            duration: '1_round',
            casting_time: '1 reaction',
        })
    })

    it('resolves usesMax from uses_expression', () => {
        const evaluateAutoExpression = vi.spyOn(expressModule, 'evaluateAutoExpression')
            .mockReturnValue(3)

        const feature = makeFeature({
            type: 'fey_reinforcements',
            uses_expression: 'proficiency_bonus',
        })
        const result = spellHandlers.fey_reinforcements(feature, BASE_STATS)
        expect(result.usesMax).toBe(3)

        evaluateAutoExpression.mockRestore()
    })
})

describe('spellHandlers – contact_patron', () => {
    it('returns contact_patron info with defaults', () => {
        const feature = makeFeature({ type: 'contact_patron' })
        const result = spellHandlers.contact_patron(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'contact_patron',
            name: 'Test Feature',
            spell: '',
            uses: 1,
            uses_expression: '',
            recharge: 'long_rest',
            action: 'action',
            casting_time: '',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'contact_patron',
            spell: 'contact other plane',
            uses: 3,
            recharge: 'long_rest',
            action: 'action',
            casting_time: '1 action',
        })
        const result = spellHandlers.contact_patron(feature, BASE_STATS)
        expect(result).toMatchObject({
            spell: 'contact other plane',
            uses: 3,
            casting_time: '1 action',
        })
    })
})

describe('spellHandlers – dragon_companion', () => {
    it('returns dragon_companion info with defaults', () => {
        const feature = makeFeature({ type: 'dragon_companion' })
        const result = spellHandlers.dragon_companion(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'dragon_companion',
            name: 'Test Feature',
            spell: '',
            uses: 1,
            uses_expression: '',
            usesMax: 1,
            recharge: 'long_rest',
            action: 'action',
            noConcentration: false,
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'dragon_companion',
            spell: 'drakonir companion',
            uses: 2,
            recharge: 'short_rest',
            action: 'bonus_action',
        })
        const result = spellHandlers.dragon_companion(feature, BASE_STATS)
        expect(result).toMatchObject({
            spell: 'drakonir companion',
            uses: 2,
            recharge: 'short_rest',
            action: 'bonus_action',
        })
    })

    it('resolves usesMax from uses_expression', () => {
        const evaluateAutoExpression = vi.spyOn(expressModule, 'evaluateAutoExpression')
            .mockReturnValue(4)

        const feature = makeFeature({
            type: 'dragon_companion',
            uses_expression: 'proficiency_bonus',
        })
        const result = spellHandlers.dragon_companion(feature, BASE_STATS)
        expect(result.usesMax).toBe(4)

        evaluateAutoExpression.mockRestore()
    })
})

describe('spellHandlers – spell_modifier', () => {
    it('returns spell_modifier info with defaults', () => {
        const feature = makeFeature({ type: 'spell_modifier' })
        const result = spellHandlers.spell_modifier(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'spell_modifier',
            name: 'Test Feature',
            options: [],
            resource: 'sorcery_points',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'spell_modifier',
            options: [{ name: 'Empowered' }],
            resource: 'spell_slot',
        })
        const result = spellHandlers.spell_modifier(feature, BASE_STATS)
        expect(result).toMatchObject({
            options: [{ name: 'Empowered' }],
            resource: 'spell_slot',
        })
    })

    it('defaults options to empty array when undefined', () => {
        const feature = makeFeature({ type: 'spell_modifier' })
        const result = spellHandlers.spell_modifier(feature, BASE_STATS)
        expect(result.options).toEqual([])
    })
})

describe('spellHandlers – spell_thief', () => {
    it('returns spell_thief info with defaults', () => {
        const feature = makeFeature({ type: 'spell_thief' })
        const result = spellHandlers.spell_thief(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'spell_thief',
            name: 'Test Feature',
            saveType: 'INT',
            saveDc: 'ability',
            saveAbility: 'INT',
            trigger: 'spell_cast',
            oncePerLongRest: false,
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'spell_thief',
            saveType: 'WIS',
            saveDc: 15,
            saveAbility: 'CHA',
            trigger: 'spell_miss',
            oncePerLongRest: true,
            casting_time: '1 action',
        })
        const result = spellHandlers.spell_thief(feature, BASE_STATS)
        expect(result).toMatchObject({
            saveType: 'WIS',
            saveDc: 15,
            saveAbility: 'CHA',
            trigger: 'spell_miss',
            oncePerLongRest: true,
            casting_time: '1 action',
        })
    })

    it('coerces oncePerLongRest to boolean', () => {
        const feature = makeFeature({
            type: 'spell_thief',
            oncePerLongRest: 'yes',
        })
        const result = spellHandlers.spell_thief(feature, BASE_STATS)
        expect(result.oncePerLongRest).toBe(true)
    })
})

describe('spellHandlers – war_magic_cantrip', () => {
    it('returns war_magic_cantrip info with defaults', () => {
        const feature = makeFeature({ type: 'war_magic_cantrip' })
        const result = spellHandlers.war_magic_cantrip(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'war_magic_cantrip',
            name: 'Test Feature',
            spellList: 'wizard_cantrips',
            action: 'action',
            casting_time: '1 action',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'war_magic_cantrip',
            spellList: 'sorcerer_cantrips',
            action: 'bonus_action',
            casting_time: '1 bonus action',
        })
        const result = spellHandlers.war_magic_cantrip(feature, BASE_STATS)
        expect(result).toMatchObject({
            spellList: 'sorcerer_cantrips',
            action: 'bonus_action',
            casting_time: '1 bonus action',
        })
    })
})

describe('spellHandlers – war_magic_spell', () => {
    it('returns war_magic_spell info with defaults', () => {
        const feature = makeFeature({ type: 'war_magic_spell' })
        const result = spellHandlers.war_magic_spell(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'war_magic_spell',
            name: 'Test Feature',
            spellList: 'wizard_spells',
            maxSpellLevel: 2,
            action: 'action',
            casting_time: '1 action',
            replacesWarMagic: false,
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'war_magic_spell',
            spellList: 'sorcerer_spells',
            maxSpellLevel: 3,
            replacesWarMagic: true,
            action: 'bonus_action',
        })
        const result = spellHandlers.war_magic_spell(feature, BASE_STATS)
        expect(result).toMatchObject({
            spellList: 'sorcerer_spells',
            maxSpellLevel: 3,
            replacesWarMagic: true,
            action: 'bonus_action',
        })
    })

    it('coerces replacesWarMagic to boolean', () => {
        const feature = makeFeature({
            type: 'war_magic_spell',
            replacesWarMagic: 'yes',
        })
        const result = spellHandlers.war_magic_spell(feature, BASE_STATS)
        expect(result.replacesWarMagic).toBe(true)
    })
})

describe('spellHandlers – arcane_charge', () => {
    it('returns arcane_charge info with defaults', () => {
        const feature = makeFeature({ type: 'arcane_charge' })
        const result = spellHandlers.arcane_charge(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'arcane_charge',
            name: 'Test Feature',
            distance: '30 ft',
            casting_time: '1 action',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'arcane_charge',
            distance: '60 ft',
            casting_time: '1 bonus action',
        })
        const result = spellHandlers.arcane_charge(feature, BASE_STATS)
        expect(result).toMatchObject({
            distance: '60 ft',
            casting_time: '1 bonus action',
        })
    })
})

describe('spellHandlers – guarded_mind', () => {
    it('returns guarded_mind info with defaults', () => {
        const feature = makeFeature({ type: 'guarded_mind' })
        const result = spellHandlers.guarded_mind(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'guarded_mind',
            name: 'Test Feature',
            resource: 'psionicEnergy',
            action: 'action',
            casting_time: '1 action',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'guarded_mind',
            resource: 'sorcery_points',
            action: 'bonus_action',
            casting_time: '1 bonus action',
        })
        const result = spellHandlers.guarded_mind(feature, BASE_STATS)
        expect(result).toMatchObject({
            resource: 'sorcery_points',
            action: 'bonus_action',
            casting_time: '1 bonus action',
        })
    })
})

describe('spellHandlers – bulwark_of_force', () => {
    it('returns bulwark_of_force info with defaults', () => {
        const feature = makeFeature({ type: 'bulwark_of_force' })
        const result = spellHandlers.bulwark_of_force(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'bulwark_of_force',
            name: 'Test Feature',
            range: '30_ft',
            duration: '1_round',
            casting_time: '1 bonus action',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'bulwark_of_force',
            range: '60_ft',
            duration: '1_minute',
            casting_time: '1 action',
        })
        const result = spellHandlers.bulwark_of_force(feature, BASE_STATS)
        expect(result).toMatchObject({
            range: '60_ft',
            duration: '1_minute',
            casting_time: '1 action',
        })
    })
})

describe('spellHandlers – signature_spells', () => {
    it('returns signature_spells info with defaults', () => {
        const feature = makeFeature({ type: 'signature_spells' })
        const result = spellHandlers.signature_spells(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'signature_spells',
            name: 'Test Feature',
            action: 'action',
            casting_time: 'passive',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'signature_spells',
            action: 'bonus_action',
            casting_time: '1 action',
        })
        const result = spellHandlers.signature_spells(feature, BASE_STATS)
        expect(result).toMatchObject({
            action: 'bonus_action',
            casting_time: '1 action',
        })
    })
})

describe('spellHandlers – spell_mastery', () => {
    it('returns spell_mastery info with defaults', () => {
        const feature = makeFeature({ type: 'spell_mastery' })
        const result = spellHandlers.spell_mastery(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'spell_mastery',
            name: 'Test Feature',
            action: 'action',
            casting_time: 'passive',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'spell_mastery',
            action: 'bonus_action',
            casting_time: '1 action',
        })
        const result = spellHandlers.spell_mastery(feature, BASE_STATS)
        expect(result).toMatchObject({
            action: 'bonus_action',
            casting_time: '1 action',
        })
    })
})

describe('spellHandlers – overchannel', () => {
    it('returns overchannel info with defaults', () => {
        const feature = makeFeature({ type: 'overchannel' })
        const result = spellHandlers.overchannel(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'overchannel',
            name: 'Test Feature',
            effect: 'overchannel',
            casting_time: 'passive',
            hasAutomation: true,
        })
    })

    it('passes through custom casting_time', () => {
        const feature = makeFeature({
            type: 'overchannel',
            casting_time: '1 action',
        })
        const result = spellHandlers.overchannel(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 action')
    })
})

describe('spellHandlers – pass_without_trace', () => {
    it('returns pass_without_trace info with defaults', () => {
        const feature = makeFeature({ type: 'pass_without_trace' })
        const result = spellHandlers.pass_without_trace(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'pass_without_trace',
            name: 'Test Feature',
            duration: '1_hour',
            auraRange: 30,
            casting_time: '1 action',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'pass_without_trace',
            duration: '8_hours',
            auraRange: 60,
            casting_time: '1 bonus action',
        })
        const result = spellHandlers.pass_without_trace(feature, BASE_STATS)
        expect(result).toMatchObject({
            duration: '8_hours',
            auraRange: 60,
            casting_time: '1 bonus action',
        })
    })
})

describe('spellHandlers – warding_bond', () => {
    it('returns warding_bond info with defaults', () => {
        const feature = makeFeature({ type: 'warding_bond' })
        const result = spellHandlers.warding_bond(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'warding_bond',
            name: 'Test Feature',
            range: 'touch',
            duration: '1 hour',
            casting_time: '1 action',
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'warding_bond',
            range: '30 ft',
            duration: '8 hours',
            casting_time: '1 reaction',
        })
        const result = spellHandlers.warding_bond(feature, BASE_STATS)
        expect(result).toMatchObject({
            range: '30 ft',
            duration: '8 hours',
            casting_time: '1 reaction',
        })
    })
})
