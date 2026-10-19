// @maintained-by-ai
// ── resource.test.js — automationInfoBuilder resource slice (lane #952 template) ──
// resourceHandlers builder contract: census guard + exact BARE default envelopes +
// full-custom passthrough + restore_expression numeric contract + ?? vs ||
// falsifiers + null-automation loop for all 4 handlers. Zero mocks —
// all handlers are pure; evaluateAutoExpression runs REAL (tokens pinned:
// proficiency_bonus→3, level→5, 'druid_level / 2'→2.5 on BASE_STATS).
//
// Lane ownership: THIS file pins builder OUTPUT bytes for resource_pool,
// resource_restoration, natural_recovery, circle_of_the_land_spells.
// Resource CONSUMPTION side-effects (runtime-store writes for ki/superiority/
// sorcery pools) are executor/handler-lane contracts, not re-driven here;
// automationService.collection.test.js owns catalog categorization of
// resource_pool entries, and the facade automationInfoBuilder.test.js pins
// delegation only. circle_of_the_land_spells had ZERO coverage before this
// rewrite — census + BARE + custom legs are net-new.
//
// Old → new map (old file: 13 its across 3 describes):
//   type/name/hasAutomation its ×3        → census + BARE exact loop (test 1)
//   empty-string unresolved it            → BARE exact toEqual (#829: catches
//                                           extra/dropped keys the per-field loop missed)
//   casting_time passive default it     → BARE (test 1)
//   resource_pool / restoration / natural passthrough its → one full-custom exact
//                                           table, every value ≠ default (#954)
//   restore 0/null + resolve numeric its ×4 → restore contract table (test 3)
//   uses_max 0 preservation it          → ?? vs || falsifier (test 4)
//   (none) → NEW census guard (#952), circle_of_the_land_spells coverage,
//            null-automation TypeError loop (test 5). No separate name loop:
//            BARE pins the default name and every full-custom case pins a
//            custom name for all 4 handlers already.

import { describe, it, expect } from 'vitest'
import { resourceHandlers } from './resource.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

const NAME = 'Test Feature'

// Hand-derived exact envelopes for makeFeature({ type }) against BASE_STATS
// (level 5, proficiency 3). Pins every default, the full key set, name
// forwarding and hasAutomation.
const BARE = {
    resource_pool: {
        type: 'resource_pool',
        name: NAME,
        resource: '',
        uses_expression: '',
        recharge_short_rest: '',
        recharge_long_rest: '',
        conversion: '',
        reverseConversion: '',
        reverseRecharge: '',
        conversionRate: '',
        casting_time: 'passive',
        hasAutomation: true
    },
    resource_restoration: {
        type: 'resource_restoration',
        name: NAME,
        trigger: 'short_rest',
        casting_time: 'passive',
        restore_amount: 0,
        restore_expression: '',
        resourceKey: '',
        uses_max: 1,
        recharge: 'long_rest',
        hasAutomation: true
    },
    natural_recovery: {
        type: 'natural_recovery',
        name: NAME,
        trigger: 'short_rest',
        casting_time: 'passive',
        restore_amount: 0,
        restore_expression: '',
        resourceKey: '',
        uses_max: 1,
        hasAutomation: true
    },
    circle_of_the_land_spells: {
        type: 'circle_of_the_land_spells',
        name: NAME,
        casting_time: 'passive',
        hasAutomation: true
    }
}

const KEYS = Object.keys(BARE)
// The restoration family shares the restore_expression truthiness guard.
const RESTORE_FAMILY = ['resource_restoration', 'natural_recovery']

describe('resourceHandlers', () => {
    it('emits the exact default envelope for every handler (census)', () => {
        // Census (#952): a new resource handler added without a golden fails here.
        expect(Object.keys(resourceHandlers).sort()).toEqual(KEYS.slice().sort())

        for (const type of KEYS) {
            expect(resourceHandlers[type](makeFeature({ type }), BASE_STATS), type).toEqual(BARE[type])
        }
    })

    it('copies every custom field verbatim into the exact envelope (#954: all values differ from defaults)', () => {
        const cases = [
            {
                feature: makeFeature({
                    type: 'resource_pool',
                    resource: 'sorcery_points',
                    uses_expression: 'proficiency_bonus',
                    recharge_short_rest: '2',
                    recharge_long_rest: '1',
                    conversion: 'spell_slot_to_sp',
                    reverseConversion: 'sp_to_spell_slot',
                    reverseRecharge: 'short_rest',
                    conversionRate: '2:1',
                    casting_time: '1 action'
                }, 'Arcane Font'),
                expected: {
                    ...BARE.resource_pool,
                    name: 'Arcane Font',
                    resource: 'sorcery_points',
                    uses_expression: 'proficiency_bonus',
                    recharge_short_rest: '2',
                    recharge_long_rest: '1',
                    conversion: 'spell_slot_to_sp',
                    reverseConversion: 'sp_to_spell_slot',
                    reverseRecharge: 'short_rest',
                    conversionRate: '2:1',
                    casting_time: '1 action'
                }
            },
            {
                // restore_expression is copied verbatim AND evaluated (test 3 owns
                // the numeric ladder); uses_max 3 overrides the ?? default of 1.
                feature: makeFeature({
                    type: 'resource_restoration',
                    trigger: 'long_rest',
                    restore_expression: 'proficiency_bonus',
                    resourceKey: 'sorcery_points',
                    uses_max: 3,
                    recharge: 'short_rest',
                    casting_time: '1 action'
                }, 'Arcane Recovery'),
                expected: {
                    ...BARE.resource_restoration,
                    name: 'Arcane Recovery',
                    trigger: 'long_rest',
                    restore_expression: 'proficiency_bonus',
                    restore_amount: 3,
                    resourceKey: 'sorcery_points',
                    uses_max: 3,
                    recharge: 'short_rest',
                    casting_time: '1 action'
                }
            },
            {
                // Arithmetic token expression: 'druid_level / 2' → 5 / 2 → 2.5.
                feature: makeFeature({
                    type: 'natural_recovery',
                    trigger: 'long_rest',
                    restore_expression: 'druid_level / 2',
                    resourceKey: 'naturalRecoverySlots',
                    uses_max: 2,
                    casting_time: 'bonus action'
                }, 'Natural Recovery'),
                expected: {
                    ...BARE.natural_recovery,
                    name: 'Natural Recovery',
                    trigger: 'long_rest',
                    restore_expression: 'druid_level / 2',
                    restore_amount: 2.5,
                    resourceKey: 'naturalRecoverySlots',
                    uses_max: 2,
                    casting_time: 'bonus action'
                }
            },
            {
                feature: makeFeature({ type: 'circle_of_the_land_spells', casting_time: 'bonus action' }, 'Land Circle Spells'),
                expected: { ...BARE.circle_of_the_land_spells, name: 'Land Circle Spells', casting_time: 'bonus action' }
            }
        ]

        for (const { feature, expected } of cases) {
            expect(resourceHandlers[feature.automation.type](feature, BASE_STATS), feature.name).toEqual(expected)
        }
    })

    it('restoration family: restore_amount = guard(0) else evaluated expression (real evaluator)', () => {
        // Truthiness guard collapses absent/null/'' to numeric 0 while the
        // expression field itself stays '' (|| ''); tokens resolve against
        // BASE_STATS with zero mocks.
        const legs = [
            [undefined, 0], [null, 0], ['', 0],
            ['proficiency_bonus', 3], ['level', 5], ['druid_level / 2', 2.5]
        ]
        for (const type of RESTORE_FAMILY) {
            for (const [expr, amount] of legs) {
                const result = resourceHandlers[type](makeFeature({ type, restore_expression: expr }), BASE_STATS)
                expect(result.restore_amount, `${type} ${JSON.stringify(expr)}`).toBe(amount)
                expect(result.restore_expression, `${type} expression`).toBe(expr || '')
            }
        }
    })

    it('zero-valued fields: ?? keeps uses_max 0, while || sites coerce to defaults', () => {
        // ?? site — declared 0 must survive; '' legs on trigger/casting_time/
        // recharge fall back to their exact BARE defaults (#953 legs).
        for (const type of RESTORE_FAMILY) {
            const zeroed = resourceHandlers[type](
                makeFeature({ type, uses_max: 0, trigger: '', casting_time: '', recharge: '', restore_expression: '' }),
                BASE_STATS
            )
            expect(zeroed, type).toEqual({ ...BARE[type], uses_max: 0 })
        }

        // resource_pool || sites — number 0 and false flatten to '' and
        // casting_time 0 to 'passive'; exact BARE falsifies a ?? refactor.
        expect(resourceHandlers.resource_pool(
            makeFeature({ type: 'resource_pool', resource: 0, conversion: false, conversionRate: 0, casting_time: '' }),
            BASE_STATS
        )).toEqual(BARE.resource_pool)

        expect(resourceHandlers.circle_of_the_land_spells(
            makeFeature({ type: 'circle_of_the_land_spells', casting_time: 0 }), BASE_STATS
        )).toEqual(BARE.circle_of_the_land_spells)
    })

    it('throws TypeError for every handler when automation is null or undefined', () => {
        for (const type of KEYS) {
            expect(() => resourceHandlers[type]({ name: NAME, automation: null }, BASE_STATS), `${type} null`).toThrow(TypeError)
            expect(() => resourceHandlers[type]({ name: NAME }, BASE_STATS), `${type} undefined`).toThrow(TypeError)
        }
    })
})
