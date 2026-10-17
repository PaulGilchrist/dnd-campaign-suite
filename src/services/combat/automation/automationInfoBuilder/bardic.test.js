// @maintained-by-ai
// bardic builder envelopes (lane #2095): pins what the BUILDER emits — exact
// toEqual envelopes, hardcoded-field probes (#2094 pattern), discriminating
// level fixtures. Die-ladder-from-disk and runtime readers are canonical in
// bardicInspirationState.test.js (#2073); expression tokens in
// automationExpressions.test.js (#2090); execution payloads in
// services/automation/handlers/class-bard/*. All fixtures here are synthetic.
import { describe, it, expect } from 'vitest'
import { bardicHandlers } from './bardic.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

describe('bardicHandlers.bardic_inspiration – envelope', () => {
    it('emits the exact default envelope and hardcodes fields a feature cannot override', () => {
        // Feature tries to override hardcoded/ignored fields: type,
        // hasAutomation, usesMax (builder derives usesMax only from
        // uses_expression — explicit uses fields must not leak through).
        const feature = makeFeature({
            type: 'custom_override',
            hasAutomation: false,
            usesMax: 99,
            uses: 42,
        })
        expect(bardicHandlers.bardic_inspiration(feature, BASE_STATS)).toEqual({
            type: 'bardic_inspiration',
            name: 'Test Feature',
            range: '60_ft',
            action: 'bonus_action',
            usesMax: 0,
            usesRecharge: 'long_rest',
            dieSize: 6,
            hasAutomation: true,
        })
    })

    it('honours explicit automation fields for range/action/recharge', () => {
        const feature = makeFeature({
            type: 'bardic_inspiration',
            range: '30_ft',
            action: 'action',
            recharge: 'short_rest',
        })
        const result = bardicHandlers.bardic_inspiration(feature, BASE_STATS)

        expect(result.range).toBe('30_ft')
        expect(result.action).toBe('action')
        expect(result.usesRecharge).toBe('short_rest')
    })

    it.each([
        ['proficiency_bonus', 3],
        ['proficiency_bonus * 2', 6],
    ])('derives usesMax through evaluateAutoExpression(%s) as a number', (expr, expected) => {
        // BASE_STATS.proficiency = 3; token semantics canonical in #2090 —
        // this lane pins only that the envelope carries a resolved NUMBER.
        const feature = makeFeature({ type: 'bardic_inspiration', uses_expression: expr })
        const result = bardicHandlers.bardic_inspiration(feature, BASE_STATS)
        expect(result.usesMax).toBe(expected)
    })

    // Builder's own selection preference (synthetic fixtures — disk ladder
    // truth is pinned from disk in bardicInspirationState.test.js, #2073):
    // exact-level match > bardic_die > class_specific fallback > 6.
    it.each([
        ['level-matching entry wins', [{ level: 5, bardic_die: 8 }], 8],
        ['non-matching level entries are ignored', [{ level: 3, bardic_die: 8 }, { level: 10, bardic_die: 12 }], 6],
        ['zero bardic_die falls through to class_specific', [{ level: 5, bardic_die: 0, class_specific: { bardic_inspiration_die: 10 } }], 10],
        ['bardic_die preferred over class_specific', [{ level: 5, bardic_die: 8, class_specific: { bardic_inspiration_die: 10 } }], 8],
        ['entry without die keys defaults', [{ level: 5 }], 6],
    ])('dieSize: %s', (_label, classLevels, expected) => {
        const stats = { ...BASE_STATS, class: { ...BASE_STATS.class, class_levels: classLevels } }
        const feature = makeFeature({ type: 'bardic_inspiration' })
        expect(bardicHandlers.bardic_inspiration(feature, stats).dieSize).toBe(expected)
    })

    it('defaults dieSize to 6 when class data is empty or missing', () => {
        const feature = makeFeature({ type: 'bardic_inspiration' })

        expect(bardicHandlers.bardic_inspiration(
            feature, { ...BASE_STATS, class: { class_levels: [] } }).dieSize).toBe(6)
        expect(bardicHandlers.bardic_inspiration(
            feature, { ...BASE_STATS, class: undefined }).dieSize).toBe(6)
    })
})

describe('bardicHandlers – reaction envelopes', () => {
    it.each(['bardic_inspiration_defense', 'bardic_inspiration_offense'])(
        '%s emits the exact fixed envelope: hardcoded casting_time, no inspiration fields leaked, ignores automation and stats',
        (type) => {
            // Reaction builders ignore both auto fields and playerStats:
            // casting_time must stay hardcoded and dieSize/usesMax must NOT
            // appear even when the stats carry a die and the feature requests one.
            const feature = makeFeature({
                type,
                casting_time: '3 actions',
                range: '5_ft',
                uses_expression: 'proficiency_bonus',
            })
            const stats = {
                ...BASE_STATS,
                class: { class_levels: [{ level: 5, bardic_die: 12 }] },
            }
            expect(bardicHandlers[type](feature, stats)).toEqual({
                type,
                name: 'Test Feature',
                hasAutomation: true,
                casting_time: '1 reaction',
            })
        }
    )
})
