import { describe, it, expect } from 'vitest'
import { diverseHandlers } from './diverse.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('diverseHandlers – divine_intervention', () => {
    it('returns divine_intervention info with defaults', () => {
        const feature = makeFeature({ type: 'divine_intervention' })
        const result = diverseHandlers.divine_intervention(feature, BASE_STATS)
        expect(result.type).toBe('divine_intervention')
        expect(result.recharge).toBe('long_rest')
        expect(result.upgradeTo).toBe('')
        expect(result.casting_time).toBe('1 action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'divine_intervention',
            recharge: 'short_rest',
            upgradeTo: 'greater_intervention',
            casting_time: '1 action'
        })
        const result = diverseHandlers.divine_intervention(feature, BASE_STATS)
        expect(result.recharge).toBe('short_rest')
        expect(result.upgradeTo).toBe('greater_intervention')
    })
})

describe('diverseHandlers – extra_action', () => {
    it('returns extra_action info with defaults', () => {
        const feature = makeFeature({ type: 'extra_action' })
        const result = diverseHandlers.extra_action(feature, BASE_STATS)
        expect(result.type).toBe('extra_action')
        expect(result.uses).toBe(1)
        expect(result.recharge).toBe('short_rest')
        expect(result.oncePerTurn).toBe(false)
        expect(result.oncePerCombat).toBe(false)
        expect(result.firstRoundOnly).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('generates resourceKey from feature name', () => {
        const feature = makeFeature({ type: 'extra_action' }, 'Extra Attack')
        const result = diverseHandlers.extra_action(feature, BASE_STATS)
        expect(result.resourceKey).toBe('extraattackUses')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'extra_action',
            uses: 3,
            recharge: 'long_rest',
            oncePerTurn: true,
            oncePerCombat: true,
            firstRoundOnly: true
        })
        const result = diverseHandlers.extra_action(feature, BASE_STATS)
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('long_rest')
        expect(result.oncePerTurn).toBe(true)
        expect(result.oncePerCombat).toBe(true)
        expect(result.firstRoundOnly).toBe(true)
    })
})

describe('diverseHandlers – font_of_magic', () => {
    it('returns font_of_magic info with defaults', () => {
        const feature = makeFeature({ type: 'font_of_magic' })
        const result = diverseHandlers.font_of_magic(feature, BASE_STATS)
        expect(result.type).toBe('font_of_magic')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({ type: 'font_of_magic', casting_time: '1 action' })
        const result = diverseHandlers.font_of_magic(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 action')
    })
})

describe('diverseHandlers – font_of_inspiration', () => {
    it('returns font_of_inspiration info with defaults', () => {
        const feature = makeFeature({ type: 'font_of_inspiration' })
        const result = diverseHandlers.font_of_inspiration(feature, BASE_STATS)
        expect(result.type).toBe('font_of_inspiration')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('diverseHandlers – meta', () => {
    it('returns meta info with defaults', () => {
        const feature = makeFeature({ type: 'meta' })
        const result = diverseHandlers.meta(feature, BASE_STATS)
        expect(result.type).toBe('meta')
        expect(result.effect).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({ type: 'meta', effect: 'heroic_inspiration_on_long_rest' })
        const result = diverseHandlers.meta(feature, BASE_STATS)
        expect(result.effect).toBe('heroic_inspiration_on_long_rest')
    })
})

describe('diverseHandlers – jack_of_all_trades', () => {
    it('returns jack_of_all_trades info', () => {
        const feature = makeFeature({ type: 'jack_of_all_trades' })
        const result = diverseHandlers.jack_of_all_trades(feature, BASE_STATS)
        expect(result.type).toBe('jack_of_all_trades')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('diverseHandlers – reliable_talent', () => {
    it('returns reliable_talent info', () => {
        const feature = makeFeature({ type: 'reliable_talent' })
        const result = diverseHandlers.reliable_talent(feature, BASE_STATS)
        expect(result.type).toBe('reliable_talent')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('diverseHandlers – divine_order', () => {
    it('returns divine_order info', () => {
        const feature = makeFeature({ type: 'divine_order' })
        const result = diverseHandlers.divine_order(feature, BASE_STATS)
        expect(result.type).toBe('divine_order')
        expect(result.hasAutomation).toBe(true)
    })
})
