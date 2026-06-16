import { describe, it, expect } from 'vitest'
import { spellHandlers } from './spell.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('spellHandlers – free_spell', () => {
    it('returns free_spell info with defaults', () => {
        const feature = makeFeature({ type: 'free_spell' })
        const result = spellHandlers.free_spell(feature, BASE_STATS)
        expect(result.type).toBe('free_spell')
        expect(result.spell).toBe('')
        expect(result.uses).toBe(1)
        expect(result.uses_expression).toBe('')
        expect(result.usesMax).toBe(1)
        expect(result.recharge).toBe('long_rest')
        expect(result.action).toBe('action')
        expect(result.duration).toBe('')
        expect(result.concentration).toBe(false)
        expect(result.noConcentration).toBe(false)
        expect(result.resourceCost).toBe('')
        expect(result.freeCasts).toBe('')
        expect(result.casting_time).toBe('')
        expect(result.perSpellTracking).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves uses_expression', () => {
        const feature = makeFeature({
            type: 'free_spell',
            uses_expression: 'proficiency_bonus'
        })
        const result = spellHandlers.free_spell(feature, BASE_STATS)
        expect(result.usesMax).toBe(3) // mocked value
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'free_spell',
            spell: 'fireball',
            uses: 3,
            recharge: 'short_rest',
            action: 'bonus_action',
            duration: '1_minute',
            concentration: true,
            resourceCost: 'spell_slot'
        })
        const result = spellHandlers.free_spell(feature, BASE_STATS)
        expect(result.spell).toBe('fireball')
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.action).toBe('bonus_action')
        expect(result.duration).toBe('1_minute')
        expect(result.concentration).toBe(true)
        expect(result.resourceCost).toBe('spell_slot')
    })
})

describe('spellHandlers – fey_reinforcements', () => {
    it('returns fey_reinforcements info with defaults', () => {
        const feature = makeFeature({ type: 'fey_reinforcements' })
        const result = spellHandlers.fey_reinforcements(feature, BASE_STATS)
        expect(result.type).toBe('fey_reinforcements')
        expect(result.spell).toBe('')
        expect(result.uses).toBe(1)
        expect(result.uses_expression).toBe('')
        expect(result.usesMax).toBe(1)
        expect(result.recharge).toBe('long_rest')
        expect(result.action).toBe('action')
        expect(result.duration).toBe('')
        expect(result.casting_time).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves uses_expression', () => {
        const feature = makeFeature({
            type: 'fey_reinforcements',
            uses_expression: 'proficiency_bonus'
        })
        const result = spellHandlers.fey_reinforcements(feature, BASE_STATS)
        expect(result.usesMax).toBe(3) // mocked value
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'fey_reinforcements',
            spell: 'call lightess',
            uses: 2,
            recharge: 'short_rest',
            action: 'bonus_action'
        })
        const result = spellHandlers.fey_reinforcements(feature, BASE_STATS)
        expect(result.spell).toBe('call lightess')
        expect(result.uses).toBe(2)
        expect(result.recharge).toBe('short_rest')
        expect(result.action).toBe('bonus_action')
    })
})

describe('spellHandlers – contact_patron', () => {
    it('returns contact_patron info with defaults', () => {
        const feature = makeFeature({ type: 'contact_patron' })
        const result = spellHandlers.contact_patron(feature, BASE_STATS)
        expect(result.type).toBe('contact_patron')
        expect(result.spell).toBe('')
        expect(result.uses).toBe(1)
        expect(result.uses_expression).toBe('')
        expect(result.recharge).toBe('long_rest')
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'contact_patron',
            spell: 'contact other plane',
            uses: 3,
            recharge: 'long_rest',
            action: 'action'
        })
        const result = spellHandlers.contact_patron(feature, BASE_STATS)
        expect(result.spell).toBe('contact other plane')
        expect(result.uses).toBe(3)
    })
})

describe('spellHandlers – dragon_companion', () => {
    it('returns dragon_companion info with defaults', () => {
        const feature = makeFeature({ type: 'dragon_companion' })
        const result = spellHandlers.dragon_companion(feature, BASE_STATS)
        expect(result.type).toBe('dragon_companion')
        expect(result.spell).toBe('')
        expect(result.uses).toBe(1)
        expect(result.uses_expression).toBe('')
        expect(result.usesMax).toBe(1)
        expect(result.recharge).toBe('long_rest')
        expect(result.action).toBe('action')
        expect(result.noConcentration).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves uses_expression', () => {
        const feature = makeFeature({
            type: 'dragon_companion',
            uses_expression: 'proficiency_bonus'
        })
        const result = spellHandlers.dragon_companion(feature, BASE_STATS)
        expect(result.usesMax).toBe(3) // mocked value
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'dragon_companion',
            spell: 'drakonir companion',
            uses: 2,
            recharge: 'short_rest'
        })
        const result = spellHandlers.dragon_companion(feature, BASE_STATS)
        expect(result.spell).toBe('drakonir companion')
        expect(result.uses).toBe(2)
        expect(result.recharge).toBe('short_rest')
    })
})

describe('spellHandlers – spell_modifier', () => {
    it('returns spell_modifier info with defaults', () => {
        const feature = makeFeature({ type: 'spell_modifier' })
        const result = spellHandlers.spell_modifier(feature, BASE_STATS)
        expect(result.type).toBe('spell_modifier')
        expect(result.options).toEqual([])
        expect(result.resource).toBe('sorcery_points')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'spell_modifier',
            options: [{ name: 'Empowered' }],
            resource: 'spell_slot'
        })
        const result = spellHandlers.spell_modifier(feature, BASE_STATS)
        expect(result.options).toEqual([{ name: 'Empowered' }])
        expect(result.resource).toBe('spell_slot')
    })
})

describe('spellHandlers – spell_thief', () => {
    it('returns spell_thief info with defaults', () => {
        const feature = makeFeature({ type: 'spell_thief' })
        const result = spellHandlers.spell_thief(feature, BASE_STATS)
        expect(result.type).toBe('spell_thief')
        expect(result.saveType).toBe('INT')
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('INT')
        expect(result.trigger).toBe('spell_cast')
        expect(result.oncePerLongRest).toBe(false)
        expect(result.casting_time).toBe('1 reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'spell_thief',
            saveType: 'WIS',
            saveDc: 15,
            saveAbility: 'CHA',
            trigger: 'spell_miss',
            oncePerLongRest: true
        })
        const result = spellHandlers.spell_thief(feature, BASE_STATS)
        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('CHA')
        expect(result.trigger).toBe('spell_miss')
        expect(result.oncePerLongRest).toBe(true)
    })
})

describe('spellHandlers – war_magic_cantrip', () => {
    it('returns war_magic_cantrip info with defaults', () => {
        const feature = makeFeature({ type: 'war_magic_cantrip' })
        const result = spellHandlers.war_magic_cantrip(feature, BASE_STATS)
        expect(result.type).toBe('war_magic_cantrip')
        expect(result.spellList).toBe('wizard_cantrips')
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('1 action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'war_magic_cantrip',
            spellList: 'sorcerer_cantrips',
            action: 'bonus_action'
        })
        const result = spellHandlers.war_magic_cantrip(feature, BASE_STATS)
        expect(result.spellList).toBe('sorcerer_cantrips')
        expect(result.action).toBe('bonus_action')
    })
})

describe('spellHandlers – war_magic_spell', () => {
    it('returns war_magic_spell info with defaults', () => {
        const feature = makeFeature({ type: 'war_magic_spell' })
        const result = spellHandlers.war_magic_spell(feature, BASE_STATS)
        expect(result.type).toBe('war_magic_spell')
        expect(result.spellList).toBe('wizard_spells')
        expect(result.maxSpellLevel).toBe(2)
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('1 action')
        expect(result.replacesWarMagic).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'war_magic_spell',
            spellList: 'sorcerer_spells',
            maxSpellLevel: 3,
            replacesWarMagic: true
        })
        const result = spellHandlers.war_magic_spell(feature, BASE_STATS)
        expect(result.spellList).toBe('sorcerer_spells')
        expect(result.maxSpellLevel).toBe(3)
        expect(result.replacesWarMagic).toBe(true)
    })
})

describe('spellHandlers – arcane_charge', () => {
    it('returns arcane_charge info with defaults', () => {
        const feature = makeFeature({ type: 'arcane_charge' })
        const result = spellHandlers.arcane_charge(feature, BASE_STATS)
        expect(result.type).toBe('arcane_charge')
        expect(result.distance).toBe('30 ft')
        expect(result.casting_time).toBe('1 action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'arcane_charge',
            distance: '60 ft',
            casting_time: '1 bonus action'
        })
        const result = spellHandlers.arcane_charge(feature, BASE_STATS)
        expect(result.distance).toBe('60 ft')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

describe('spellHandlers – guarded_mind', () => {
    it('returns guarded_mind info with defaults', () => {
        const feature = makeFeature({ type: 'guarded_mind' })
        const result = spellHandlers.guarded_mind(feature, BASE_STATS)
        expect(result.type).toBe('guarded_mind')
        expect(result.resource).toBe('psionicEnergy')
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('1 action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'guarded_mind',
            resource: 'sorcery_points',
            action: 'bonus_action'
        })
        const result = spellHandlers.guarded_mind(feature, BASE_STATS)
        expect(result.resource).toBe('sorcery_points')
        expect(result.action).toBe('bonus_action')
    })
})

describe('spellHandlers – bulwark_of_force', () => {
    it('returns bulwark_of_force info with defaults', () => {
        const feature = makeFeature({ type: 'bulwark_of_force' })
        const result = spellHandlers.bulwark_of_force(feature, BASE_STATS)
        expect(result.type).toBe('bulwark_of_force')
        expect(result.range).toBe('30_ft')
        expect(result.duration).toBe('1_round')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'bulwark_of_force',
            range: '60_ft',
            duration: '1_minute'
        })
        const result = spellHandlers.bulwark_of_force(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
        expect(result.duration).toBe('1_minute')
    })
})

describe('spellHandlers – signature_spells', () => {
    it('returns signature_spells info with defaults', () => {
        const feature = makeFeature({ type: 'signature_spells' })
        const result = spellHandlers.signature_spells(feature, BASE_STATS)
        expect(result.type).toBe('signature_spells')
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'signature_spells',
            action: 'bonus_action'
        })
        const result = spellHandlers.signature_spells(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
    })
})

describe('spellHandlers – overchannel', () => {
    it('returns overchannel info with defaults', () => {
        const feature = makeFeature({ type: 'overchannel' })
        const result = spellHandlers.overchannel(feature, BASE_STATS)
        expect(result.type).toBe('overchannel')
        expect(result.effect).toBe('overchannel')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('spellHandlers – pass_without_trace', () => {
    it('returns pass_without_trace info with defaults', () => {
        const feature = makeFeature({ type: 'pass_without_trace' })
        const result = spellHandlers.pass_without_trace(feature, BASE_STATS)
        expect(result.type).toBe('pass_without_trace')
        expect(result.duration).toBe('1_hour')
        expect(result.auraRange).toBe(30)
        expect(result.casting_time).toBe('1 action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'pass_without_trace',
            duration: '8_hours',
            auraRange: 60
        })
        const result = spellHandlers.pass_without_trace(feature, BASE_STATS)
        expect(result.duration).toBe('8_hours')
        expect(result.auraRange).toBe(60)
    })
})

describe('spellHandlers – warding_bond', () => {
    it('returns warding_bond info with defaults', () => {
        const feature = makeFeature({ type: 'warding_bond' })
        const result = spellHandlers.warding_bond(feature, BASE_STATS)
        expect(result.type).toBe('warding_bond')
        expect(result.range).toBe('touch')
        expect(result.duration).toBe('1 hour')
        expect(result.casting_time).toBe('1 action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'warding_bond',
            range: '30 ft',
            duration: '8 hours'
        })
        const result = spellHandlers.warding_bond(feature, BASE_STATS)
        expect(result.range).toBe('30 ft')
        expect(result.duration).toBe('8 hours')
    })
})
