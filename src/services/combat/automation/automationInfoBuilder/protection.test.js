// @maintained-by-ai
// ── protection.test.js — automationInfoBuilder protection slice (lane #952 template) ──
// Unit home for the EXACT emitted info bytes of the protection-family builders
// in reaction.js: `protection` and `shield`. reaction.test.js's
// registerStandardTests pins per-property defaults (toHaveProperty loop) but
// cannot catch extra/dropped keys — this lane owns the full-envelope toEqual
// falsifiers (#829 exact bytes, #842 falsifiable).
//
// Builder family map (facade automationInfoBuilder.js spreads domain maps;
// unit lanes pin per-type values, facade lane pins delegation only):
//   • THIS FILE: protection slice — reactionHandlers.protection + .shield.
//     2 handlers, both pure (zero mocks #791, no stats consumed). The
//     distinguishing code paths are the hardcoded `requiresShield: true`
//     override (#952 casting_time class — declared data must NOT leak) vs
//     per-field `||` fallbacks (#953 coercion legs), and the unread-input
//     key sets (shield emits 4 keys even when trigger/range are declared).
//   • interception builder exact shape → interception.test.js (distinct owner —
//     not re-pinned here) · runtime store writes → interceptionHandler
//     (#948) executor tests (different module, cited not re-driven) ·
//     ward/abjuration spell handlers → spell.test.js &
//     class-feature-handlers.test.js (arcane_ward / projected_ward owned
//     there) · te/condition registry golden-once → #820 · full reaction-handler
//     partial-key matrix & null-automation throw → reaction.test.js ·
//     envelope assembly → facade lane. No categorization rebuilt here (#710).
//
// Old → new map (old file was 3 weaker duplicates of reaction.test.js
// registerStandardTests('protection') — toMatchObject missed absent/extra keys):
//   toMatchObject defaults          → BARE exact-bytes loop (test 1, + shield)
//   name-when-provided              → folded into custom-name exact case (test 2)
//   requiresShield always true      → hardened override legs (tests 2 & 3)
//   (none)                          → NEW shield exact envelope, non-vacuous
//                                     casting_time override (reaction.test.js's
//                                     shield custom was '1 reaction' === default)
//   (none)                          → NEW falsy-coercion pins: '' must fall back
//                                     via ||, would leak under ?? (#953)

import { describe, it, expect } from 'vitest'
import { reactionHandlers } from './reaction.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

const NAME = 'Test Feature'

// Hand-derived exact envelopes for a bare feature makeFeature({ type }).
// Pins the full key set of each handler: protection emits exactly 7 keys,
// shield exactly 4 — any handler adding or dropping a key fails toEqual.
// Neither handler reads playerStats (shield/protection both ignore it), so
// BASE_STATS is inert here; passing it keeps the builder contract honest.
const BARE = {
    protection: {
        type: 'protection',
        name: NAME,
        trigger: 'ally_within_5ft_attacked',
        range: '5_ft',
        requiresShield: true,
        casting_time: '1 reaction',
        hasAutomation: true
    },
    shield: {
        type: 'shield',
        name: NAME,
        casting_time: '1 reaction',
        hasAutomation: true
    }
}

describe('reactionHandlers – protection slice (exact envelopes)', () => {
    it('emits the exact default envelope for both handlers (exact bytes, full key set)', () => {
        for (const [type, expected] of Object.entries(BARE)) {
            expect(reactionHandlers[type](makeFeature({ type }), BASE_STATS), type).toEqual(expected)
        }
    })

    it('copies declared fields verbatim, drops unread inputs, and hardcodes requiresShield', () => {
        const cases = [
            {
                // protection full-custom: every readable field overridden in one
                // case; declared requiresShield:false is overridden by the
                // hardcoded true (#952 hardened-override pin); unread fields
                // must never leak into the envelope (exact toEqual catches adds).
                feature: makeFeature({
                    type: 'protection',
                    trigger: 'ally_hit_by_melee',
                    range: '10_ft',
                    casting_time: '1 bonus reaction',
                    requiresShield: false,
                    damageExpression: '1d10',
                    saveType: 'DEX',
                    effect: 'interpose'
                }, 'Protection Style (synthetic)'),
                expected: {
                    ...BARE.protection,
                    name: 'Protection Style (synthetic)',
                    trigger: 'ally_hit_by_melee',
                    range: '10_ft',
                    casting_time: '1 bonus reaction'
                }
            },
            {
                // Falsy legs (#953): '' is falsy so the || fallbacks re-engage —
                // under a ?? refactor these empties would leak and fail here.
                feature: makeFeature({ type: 'protection', trigger: '', range: '', casting_time: '' }),
                expected: BARE.protection
            },
            {
                // shield: casting_time override that is NOT the default
                // (reaction.test.js's custom set '1 reaction' === default — vacuous);
                // trigger/range/damageExpression are unread and must stay absent.
                feature: makeFeature({
                    type: 'shield',
                    casting_time: '1 bonus action',
                    trigger: 'melee_attack_roll',
                    range: '60_ft',
                    damageExpression: '1d10'
                }, 'Shield (synthetic)'),
                expected: {
                    type: 'shield',
                    name: 'Shield (synthetic)',
                    casting_time: '1 bonus action',
                    hasAutomation: true
                }
            },
            {
                feature: makeFeature({ type: 'shield', casting_time: '' }),
                expected: BARE.shield
            }
        ]

        for (const { feature, expected } of cases) {
            expect(reactionHandlers[feature.automation.type](feature, BASE_STATS), feature.name).toEqual(expected)
        }
    })

    it('hardcodes requiresShield:true — declared false/0/"" cannot override it', () => {
        // Falsifiable discriminator vs a future `!!auto.requiresShield` or
        // `?? ` refactor (interception uses !! — that contrast is pinned in
        // interception.test.js, not re-driven here).
        for (const declared of [false, 0, '']) {
            const result = reactionHandlers.protection(
                makeFeature({ type: 'protection', requiresShield: declared }),
                BASE_STATS
            )
            expect(result, `requiresShield=${JSON.stringify(declared)}`).toEqual(BARE.protection)
        }
    })
})
