// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { primalHandlers } from './primal.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── Helpers ──────────────────────────────────────────────────────────

const checkDefaults = (result, expected) => {
    expect(result).toMatchObject(expected)
    expect(result.hasAutomation).toBe(true)
    expect(result.name).toBe('Test Feature')
}

// ── primal_companion_summon ──────────────────────────────────────────

describe('primalHandlers – primal_companion_summon', () => {
    it('returns primal_companion_summon info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_summon' })
        const result = primalHandlers.primal_companion_summon(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'primal_companion_summon',
            action: 'bonus_action',
            companionTypes: [],
            casting_time: '1 bonus action'
        })
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

    it('falls back to defaults when automation fields are null', () => {
        const feature = makeFeature({
            type: 'primal_companion_summon',
            action: null,
            companionTypes: null,
            casting_time: null
        })
        const result = primalHandlers.primal_companion_summon(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.companionTypes).toEqual([])
        expect(result.casting_time).toBe('1 bonus action')
    })

    it('falls back to defaults when automation fields are undefined', () => {
        const feature = makeFeature({
            type: 'primal_companion_summon',
            action: undefined,
            companionTypes: undefined,
            casting_time: undefined
        })
        const result = primalHandlers.primal_companion_summon(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.companionTypes).toEqual([])
        expect(result.casting_time).toBe('1 bonus action')
    })
})

// ── primal_companion_dodge ───────────────────────────────────────────

describe('primalHandlers – primal_companion_dodge', () => {
    it('returns primal_companion_dodge info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_dodge' })
        const result = primalHandlers.primal_companion_dodge(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'primal_companion_dodge',
            effect: 'companion_dodge_default',
            casting_time: 'passive'
        })
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

    it('falls back to defaults when automation fields are null', () => {
        const feature = makeFeature({
            type: 'primal_companion_dodge',
            effect: null,
            casting_time: null
        })
        const result = primalHandlers.primal_companion_dodge(feature, BASE_STATS)
        expect(result.effect).toBe('companion_dodge_default')
        expect(result.casting_time).toBe('passive')
    })
})

// ── primal_companion_command ─────────────────────────────────────────

describe('primalHandlers – primal_companion_command', () => {
    it('returns primal_companion_command info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_command' })
        const result = primalHandlers.primal_companion_command(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'primal_companion_command',
            action: 'action',
            commandType: 'beasts_strike',
            casting_time: '1 action'
        })
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

    it('falls back to defaults when automation fields are null', () => {
        const feature = makeFeature({
            type: 'primal_companion_command',
            action: null,
            commandType: null,
            casting_time: null
        })
        const result = primalHandlers.primal_companion_command(feature, BASE_STATS)
        expect(result.action).toBe('action')
        expect(result.commandType).toBe('beasts_strike')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── primal_companion_restore ─────────────────────────────────────────

describe('primalHandlers – primal_companion_restore', () => {
    it('returns primal_companion_restore info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_restore' })
        const result = primalHandlers.primal_companion_restore(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'primal_companion_restore',
            action: 'action',
            range: '5_ft',
            spellSlotCost: false,
            casting_time: '1 action'
        })
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

    it('coerces spellSlotCost with !! from truthy non-boolean', () => {
        const feature = makeFeature({
            type: 'primal_companion_restore',
            spellSlotCost: 'yes'
        })
        const result = primalHandlers.primal_companion_restore(feature, BASE_STATS)
        expect(result.spellSlotCost).toBe(true)
    })

    it('coerces spellSlotCost with !! from falsy value', () => {
        const feature = makeFeature({
            type: 'primal_companion_restore',
            spellSlotCost: 0
        })
        const result = primalHandlers.primal_companion_restore(feature, BASE_STATS)
        expect(result.spellSlotCost).toBe(false)
    })

    it('falls back to defaults when automation fields are null', () => {
        const feature = makeFeature({
            type: 'primal_companion_restore',
            action: null,
            range: null,
            spellSlotCost: null
        })
        const result = primalHandlers.primal_companion_restore(feature, BASE_STATS)
        expect(result.action).toBe('action')
        expect(result.range).toBe('5_ft')
        expect(result.spellSlotCost).toBe(false)
    })
})

// ── primal_companion_bonus_action_command ────────────────────────────

describe('primalHandlers – primal_companion_bonus_action_command', () => {
    it('returns primal_companion_bonus_action_command info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_bonus_action_command' })
        const result = primalHandlers.primal_companion_bonus_action_command(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'primal_companion_bonus_action_command',
            commandActions: [],
            forceDamageOption: false,
            casting_time: '1 bonus action'
        })
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

    it('coerces forceDamageOption with !! from truthy non-boolean', () => {
        const feature = makeFeature({
            type: 'primal_companion_bonus_action_command',
            forceDamageOption: 'yes'
        })
        const result = primalHandlers.primal_companion_bonus_action_command(feature, BASE_STATS)
        expect(result.forceDamageOption).toBe(true)
    })

    it('coerces forceDamageOption with !! from falsy value', () => {
        const feature = makeFeature({
            type: 'primal_companion_bonus_action_command',
            forceDamageOption: 0
        })
        const result = primalHandlers.primal_companion_bonus_action_command(feature, BASE_STATS)
        expect(result.forceDamageOption).toBe(false)
    })

    it('falls back to defaults when automation fields are null', () => {
        const feature = makeFeature({
            type: 'primal_companion_bonus_action_command',
            commandActions: null,
            forceDamageOption: null,
            casting_time: null
        })
        const result = primalHandlers.primal_companion_bonus_action_command(feature, BASE_STATS)
        expect(result.commandActions).toEqual([])
        expect(result.forceDamageOption).toBe(false)
        expect(result.casting_time).toBe('1 bonus action')
    })
})

// ── primal_companion_double_strike ───────────────────────────────────

describe('primalHandlers – primal_companion_double_strike', () => {
    it('returns primal_companion_double_strike info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_double_strike' })
        const result = primalHandlers.primal_companion_double_strike(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'primal_companion_double_strike',
            casting_time: 'passive'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'primal_companion_double_strike',
            casting_time: '1 action'
        })
        const result = primalHandlers.primal_companion_double_strike(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 action')
    })

    it('falls back to defaults when automation fields are null', () => {
        const feature = makeFeature({
            type: 'primal_companion_double_strike',
            casting_time: null
        })
        const result = primalHandlers.primal_companion_double_strike(feature, BASE_STATS)
        expect(result.casting_time).toBe('passive')
    })
})

// ── primal_companion_spell_share ─────────────────────────────────────

describe('primalHandlers – primal_companion_spell_share', () => {
    it('returns primal_companion_spell_share info with defaults', () => {
        const feature = makeFeature({ type: 'primal_companion_spell_share' })
        const result = primalHandlers.primal_companion_spell_share(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'primal_companion_spell_share',
            range: '30_ft',
            casting_time: 'passive'
        })
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

    it('falls back to defaults when automation fields are null', () => {
        const feature = makeFeature({
            type: 'primal_companion_spell_share',
            range: null,
            casting_time: null
        })
        const result = primalHandlers.primal_companion_spell_share(feature, BASE_STATS)
        expect(result.range).toBe('30_ft')
        expect(result.casting_time).toBe('passive')
    })
})
