// @improved-by-ai
// ── automationInfoBuilder.diverse.test.js ────────────────────────────
// Tests for the diverse automation handlers via buildAttackInfo dispatcher.
//
// What we test:
//   • Each handler produces the correct `type`, `name`, and `hasAutomation`
//   • Default values are applied when automation fields are missing/falsy
//   • Custom automation fields are passed through unchanged
//   • Boolean coercion (!!) works for extra_action flags
//   • resourceKey generation from feature name (extra_action)
//
// What we don't test:
//   • Dispatcher null/early-return paths (covered in automationInfoBuilder.test.js)
//   • Handler internals directly (covered in diverse.test.js in subdirectory)

import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

// ── divine_intervention ──────────────────────────────────────────────

describe('buildAttackInfo – divine_intervention', () => {
    it('returns correct type, name, and hasAutomation with default fields', () => {
        const feature = makeFeature({ type: 'divine_intervention' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).not.toBeNull()
        expect(result.type).toBe('divine_intervention')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults recharge to long_rest when absent', () => {
        const feature = makeFeature({ type: 'divine_intervention' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.recharge).toBe('long_rest')
    })

    it('defaults upgradeTo to empty string when absent', () => {
        const feature = makeFeature({ type: 'divine_intervention' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.upgradeTo).toBe('')
    })

    it('defaults casting_time to "1 action" when absent', () => {
        const feature = makeFeature({ type: 'divine_intervention' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 action')
    })

    it('falls back to defaults when automation fields are explicitly null', () => {
        const feature = makeFeature({
            type: 'divine_intervention',
            recharge: null,
            upgradeTo: null,
            casting_time: null,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.recharge).toBe('long_rest')
        expect(result.upgradeTo).toBe('')
        expect(result.casting_time).toBe('1 action')
    })

    it('passes through custom automation field values', () => {
        const feature = makeFeature(
            {
                type: 'divine_intervention',
                recharge: 'short_rest',
                upgradeTo: 'greater_intervention',
                casting_time: '1 reaction',
            },
            'Divine Intervention'
        )
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.name).toBe('Divine Intervention')
        expect(result.recharge).toBe('short_rest')
        expect(result.upgradeTo).toBe('greater_intervention')
        expect(result.casting_time).toBe('1 reaction')
    })
})

// ── extra_action ─────────────────────────────────────────────────────

describe('buildAttackInfo – extra_action', () => {
    it('returns correct type, name, and hasAutomation with default fields', () => {
        const feature = makeFeature({ type: 'extra_action' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).not.toBeNull()
        expect(result.type).toBe('extra_action')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults uses to 1 when absent', () => {
        const feature = makeFeature({ type: 'extra_action' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.uses).toBe(1)
    })

    it('defaults recharge to short_rest when absent', () => {
        const feature = makeFeature({ type: 'extra_action' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.recharge).toBe('short_rest')
    })

    it('defaults boolean flags to false when absent', () => {
        const feature = makeFeature({ type: 'extra_action' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(false)
        expect(result.oncePerCombat).toBe(false)
        expect(result.firstRoundOnly).toBe(false)
    })

    it('generates resourceKey from feature name (lowercase, no spaces, + "Uses")', () => {
        const feature = makeFeature({ type: 'extra_action' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.resourceKey).toBe('testfeatureUses')
    })

    it('generates resourceKey with spaces replaced for multi-word names', () => {
        const feature = makeFeature({ type: 'extra_action' }, 'Extra Attack')
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.resourceKey).toBe('extraattackUses')
    })

    it('coerces truthy non-boolean values to true with !!', () => {
        const feature = makeFeature({
            type: 'extra_action',
            oncePerTurn: 'yes',
            oncePerCombat: 1,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(true)
        expect(result.oncePerCombat).toBe(true)
    })

    it('coerces falsy non-boolean values to false with !!', () => {
        const feature = makeFeature({
            type: 'extra_action',
            firstRoundOnly: 0,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.firstRoundOnly).toBe(false)
    })

    it('passes through custom numeric and boolean values', () => {
        const feature = makeFeature(
            {
                type: 'extra_action',
                uses: 3,
                recharge: 'long_rest',
                oncePerTurn: true,
                oncePerCombat: true,
                firstRoundOnly: true,
            },
            'Limited Use Action'
        )
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.name).toBe('Limited Use Action')
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('long_rest')
        expect(result.oncePerTurn).toBe(true)
        expect(result.oncePerCombat).toBe(true)
        expect(result.firstRoundOnly).toBe(true)
    })
})

// ── font_of_magic ────────────────────────────────────────────────────

describe('buildAttackInfo – font_of_magic', () => {
    it('returns correct type, name, and hasAutomation with default casting_time', () => {
        const feature = makeFeature({ type: 'font_of_magic' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).not.toBeNull()
        expect(result.type).toBe('font_of_magic')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
        expect(result.casting_time).toBe('1 bonus action')
    })

    it('falls back to default when casting_time is null', () => {
        const feature = makeFeature({ type: 'font_of_magic', casting_time: null })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 bonus action')
    })

    it('passes through custom casting_time', () => {
        const feature = makeFeature(
            { type: 'font_of_magic', casting_time: '1 action' },
            'Font of Magic'
        )
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.name).toBe('Font of Magic')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── font_of_inspiration ──────────────────────────────────────────────

describe('buildAttackInfo – font_of_inspiration', () => {
    it('returns correct type, name, and hasAutomation with default casting_time', () => {
        const feature = makeFeature({ type: 'font_of_inspiration' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).not.toBeNull()
        expect(result.type).toBe('font_of_inspiration')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
        expect(result.casting_time).toBe('passive')
    })

    it('falls back to default when casting_time is empty string', () => {
        const feature = makeFeature({ type: 'font_of_inspiration', casting_time: '' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.casting_time).toBe('passive')
    })

    it('passes through custom casting_time', () => {
        const feature = makeFeature(
            { type: 'font_of_inspiration', casting_time: '1 action' },
            'Inspiration Font'
        )
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.name).toBe('Inspiration Font')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── meta ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – meta', () => {
    it('returns correct type, name, and hasAutomation with default effect', () => {
        const feature = makeFeature({ type: 'meta' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).not.toBeNull()
        expect(result.type).toBe('meta')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
        expect(result.effect).toBe('')
    })

    it('falls back to default when effect is null', () => {
        const feature = makeFeature({ type: 'meta', effect: null })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.effect).toBe('')
    })

    it('passes through custom effect', () => {
        const feature = makeFeature(
            { type: 'meta', effect: 'heroic_inspiration_on_long_rest' },
            'Meta Ability'
        )
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.name).toBe('Meta Ability')
        expect(result.effect).toBe('heroic_inspiration_on_long_rest')
    })
})

// ── jack_of_all_trades ───────────────────────────────────────────────

describe('buildAttackInfo – jack_of_all_trades', () => {
    it('returns correct type, name, and hasAutomation', () => {
        const feature = makeFeature({ type: 'jack_of_all_trades' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).not.toBeNull()
        expect(result.type).toBe('jack_of_all_trades')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns null when feature has no automation property', () => {
        const feature = { name: 'Jack of All Trades' }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })
})

// ── reliable_talent ──────────────────────────────────────────────────

describe('buildAttackInfo – reliable_talent', () => {
    it('returns correct type, name, and hasAutomation', () => {
        const feature = makeFeature({ type: 'reliable_talent' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).not.toBeNull()
        expect(result.type).toBe('reliable_talent')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns null when feature has no automation property', () => {
        const feature = { name: 'Reliable Talent' }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })
})

// ── divine_order ─────────────────────────────────────────────────────

describe('buildAttackInfo – divine_order', () => {
    it('returns correct type, name, and hasAutomation', () => {
        const feature = makeFeature({ type: 'divine_order' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).not.toBeNull()
        expect(result.type).toBe('divine_order')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns null when feature has no automation property', () => {
        const feature = { name: 'Divine Order' }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })
})
