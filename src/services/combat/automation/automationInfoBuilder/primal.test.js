import { describe, it, expect } from 'vitest'
import { primalHandlers } from './primal.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('primalHandlers – primal_companion_summon', () => {
    it('returns primal_companion_summon info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_summon' })
        const result = primalHandlers.primal_companion_summon(feature, BASE_STATS)
        expect(result.type).toBe('primal_companion_summon')
        expect(result.action).toBe('bonus_action')
        expect(result.companionTypes).toEqual([])
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'primal_companion_summon',
            action: 'action',
            companionTypes: ['beast', 'celestial'],
            casting_time: '1 action'
        })
        const result = primalHandlers.primal_companion_summon(feature, BASE_STATS)
        expect(result.action).toBe('action')
        expect(result.companionTypes).toEqual(['beast', 'celestial'])
        expect(result.casting_time).toBe('1 action')
    })
})

describe('primalHandlers – primal_companion_dodge', () => {
    it('returns primal_companion_dodge info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_dodge' })
        const result = primalHandlers.primal_companion_dodge(feature, BASE_STATS)
        expect(result.type).toBe('primal_companion_dodge')
        expect(result.effect).toBe('companion_dodge_default')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'primal_companion_dodge',
            effect: 'companion_dodge_advantage',
            casting_time: '1 reaction'
        })
        const result = primalHandlers.primal_companion_dodge(feature, BASE_STATS)
        expect(result.effect).toBe('companion_dodge_advantage')
        expect(result.casting_time).toBe('1 reaction')
    })
})

describe('primalHandlers – primal_companion_command', () => {
    it('returns primal_companion_command info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_command' })
        const result = primalHandlers.primal_companion_command(feature, BASE_STATS)
        expect(result.type).toBe('primal_companion_command')
        expect(result.action).toBe('action')
        expect(result.commandType).toBe('beasts_strike')
        expect(result.casting_time).toBe('1 action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'primal_companion_command',
            action: 'bonus_action',
            commandType: 'defensive_stance',
            casting_time: '1 bonus action'
        })
        const result = primalHandlers.primal_companion_command(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.commandType).toBe('defensive_stance')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

describe('primalHandlers – primal_companion_restore', () => {
    it('returns primal_companion_restore info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_restore' })
        const result = primalHandlers.primal_companion_restore(feature, BASE_STATS)
        expect(result.type).toBe('primal_companion_restore')
        expect(result.action).toBe('action')
        expect(result.range).toBe('5_ft')
        expect(result.spellSlotCost).toBe(false)
        expect(result.casting_time).toBe('1 action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'primal_companion_restore',
            action: 'bonus_action',
            range: '10_ft',
            spellSlotCost: true
        })
        const result = primalHandlers.primal_companion_restore(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.range).toBe('10_ft')
        expect(result.spellSlotCost).toBe(true)
    })
})

describe('primalHandlers – primal_companion_bonus_action_command', () => {
    it('returns primal_companion_bonus_action_command info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_bonus_action_command' })
        const result = primalHandlers.primal_companion_bonus_action_command(feature, BASE_STATS)
        expect(result.type).toBe('primal_companion_bonus_action_command')
        expect(result.commandActions).toEqual([])
        expect(result.forceDamageOption).toBe(false)
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'primal_companion_bonus_action_command',
            commandActions: ['attack', 'move'],
            forceDamageOption: true
        })
        const result = primalHandlers.primal_companion_bonus_action_command(feature, BASE_STATS)
        expect(result.commandActions).toEqual(['attack', 'move'])
        expect(result.forceDamageOption).toBe(true)
    })
})

describe('primalHandlers – primal_companion_double_strike', () => {
    it('returns primal_companion_double_strike info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_double_strike' })
        const result = primalHandlers.primal_companion_double_strike(feature, BASE_STATS)
        expect(result.type).toBe('primal_companion_double_strike')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'primal_companion_double_strike',
            casting_time: '1 action'
        })
        const result = primalHandlers.primal_companion_double_strike(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 action')
    })
})

describe('primalHandlers – primal_companion_spell_share', () => {
    it('returns primal_companion_spell_share info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_spell_share' })
        const result = primalHandlers.primal_companion_spell_share(feature, BASE_STATS)
        expect(result.type).toBe('primal_companion_spell_share')
        expect(result.range).toBe('30_ft')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'primal_companion_spell_share',
            range: '60_ft',
            casting_time: '1 bonus action'
        })
        const result = primalHandlers.primal_companion_spell_share(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
        expect(result.casting_time).toBe('1 bonus action')
    })
})
