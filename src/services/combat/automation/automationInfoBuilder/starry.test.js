// @maintained-by-ai
// ── starry.test.js — automationInfoBuilder starry slice (lane #952 template) ──
// Unit home for the EXACT emitted info bytes of starryHandlers (starry.js):
// sorcerer Starry Vision family feature automation rows → handler-input
// envelopes. 3 handlers, censused below, all pure — zero mocks (#791);
// cosmic_omen runs the REAL automationExpressions.evaluateAutoExpression
// with goldens hand-derived ONCE (#820, #710 no formula oracle).
//
// Builder family map (facade automationInfoBuilder.js spreads 21 domain maps;
// unit lanes pin per-type values, facade lane pins delegation only — see
// ../automationInfoBuilder.test.js header):
//   • THIS FILE: starry slice — starry_form / cosmic_omen /
//     twinkling_constellations. Distinguishing code paths: cosmic_omen is the
//     slice's only playerStats reader and its only guarded-read site
//     (`if (auto.uses_expression)` then eval-result `|| 0`); the other two are
//     per-field `||` fallbacks with hardcoded type/name/hasAutomation;
//     starry_form's `auto.options ||` lets a declared EMPTY array pass
//     through untouched (truthy [] ≠ default). Constellation SELECTION and
//     resource CONSUMPTION are executor-owned — cited, never re-driven here
//     (this lane pins BUILDER OUTPUT only):
//   • starry_form EXECUTION (form transform, Arrow of the Stars rider) →
//     automation/handlers/class-sorcerer/starryFormHandler.test.js ·
//     cosmic_omen EXECUTION (pending stores, restore) →
//     automation/handlers/class-sorcerer/cosmicOmenHandler.test.js (+
//     .pending-store.test.js) · twinkling EXECUTION / interactive row gate →
//     automation/handlers/class-sorcerer/twinklingConstellationHandler.test.js
//     and automationService.interactive.twinkling.test.js (CLA-368) ·
//     type→rowType routing → automationCollector.types.test.js ·
//     envelope assembly / null-automation facade contract → facade lane ·
//     real starry-vision DATA in /data → golden-once #820.
//
// Old → new map (old file: 12 toMatchObject/toBe its → 4 tests):
//   per-handler 'returns correct structure with defaults' ×3
//     → census + BARE exact-byte loop (1)
//   per-handler 'propagates the feature name' ×3 + 'passes through truthy/
//     custom fields' ×3 → one full-custom exact table, customs ≠ defaults
//     (#954), unread-key DROP pins (cosmic_omen ignores uses/effect;
//     starry_form ignores recharge; unknownKey never leaks) (2)
//   cosmic_omen 'resolves uses_expression' + 'defaults falsy' ×2
//     + starry_form 'replaces falsy values' → coercion + REAL-evaluator
//     golden loop on THIS module's actual operator sites only (guard-skip
//     '', eval→numeric goldens, dice-string passthrough past || 0, empty
//     options [] truthy survives) (3)
//   (none)                            → NEW null-automation throw loop (4)

import { describe, it, expect } from 'vitest'
import { starryHandlers } from './starry.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

const NAME = 'Test Feature'

// Hand-derived exact envelopes for a bare feature makeFeature({ type })
// against BASE_STATS (level 5, proficiency 3). Pins every default — including
// the module-local CONSTELLATION_OPTIONS contents — the full key set (extra/
// dropped keys fail), name forwarding and hasAutomation.
const BARE = {
    starry_form: {
        type: 'starry_form',
        name: NAME,
        effect: 'starry_form',
        duration: '1_minute',
        options: ['Archer', 'Chalice', 'Dragon'],
        resourceKey: 'starryFormUses',
        uses: 0,
        hasAutomation: true
    },
    cosmic_omen: {
        type: 'cosmic_omen',
        name: NAME,
        usesMax: 0,
        usesRecharge: 'long_rest',
        action: 'action',
        casting_time: '1 reaction',
        hasAutomation: true
    },
    twinkling_constellations: {
        type: 'twinkling_constellations',
        name: NAME,
        options: ['Archer', 'Chalice', 'Dragon'],
        hasAutomation: true
    }
}

const TYPES = Object.keys(BARE)

describe('starryHandlers', () => {
    it('emits the exact default envelope for every handler (census of all 3)', () => {
        // Census (#952): a new starry handler added to neither table fails here.
        expect(Object.keys(starryHandlers).sort()).toEqual(TYPES.slice().sort())

        for (const type of TYPES) {
            expect(starryHandlers[type](makeFeature({ type }), BASE_STATS), type).toEqual(BARE[type])
        }
    })

    it('copies declared fields verbatim, drops unread keys (all customs ≠ defaults)', () => {
        const build = (feature) => starryHandlers[feature.automation.type](feature, BASE_STATS)

        const cases = [
            {
                // starry_form: recharge is unread here (cosmic_omen owns it);
                // unknownKey must never leak into the envelope.
                feature: makeFeature({
                    type: 'starry_form', effect: 'starry_form_archer', duration: '10_minutes',
                    options: ['Serpent', 'Phoenix'], resourceKey: 'customFormUses', uses: 4,
                    recharge: 'short_rest', unknownKey: 'leak?'
                }, 'Starry Form'),
                expected: {
                    ...BARE.starry_form, name: 'Starry Form', effect: 'starry_form_archer',
                    duration: '10_minutes', options: ['Serpent', 'Phoenix'],
                    resourceKey: 'customFormUses', uses: 4
                }
            },
            {
                // cosmic_omen full custom: recharge/action/casting_time
                // propagate at ||; 'level' resolves via the REAL evaluator to
                // BASE_STATS.level 5; uses/effect are UNREAD keys — declared
                // uses:50 and effect custom drop (exact toEqual pins the drop,
                // #842 falsifiable).
                feature: makeFeature({
                    type: 'cosmic_omen', recharge: 'short_rest', action: 'bonus_action',
                    casting_time: '1 bonus action', uses_expression: 'level',
                    uses: 50, effect: 'leak?', unknownKey: 'leak?'
                }, 'Cosmic Omen'),
                expected: {
                    ...BARE.cosmic_omen, name: 'Cosmic Omen', usesMax: 5,
                    usesRecharge: 'short_rest', action: 'bonus_action',
                    casting_time: '1 bonus action'
                }
            },
            {
                // twinkling: options is its ONLY readable automation key.
                feature: makeFeature({
                    type: 'twinkling_constellations', options: ['Serpent'],
                    duration: 'instant', unknownKey: 'leak?'
                }, 'Twinkling Constellations'),
                expected: { ...BARE.twinkling_constellations, name: 'Twinkling Constellations', options: ['Serpent'] }
            }
        ]

        for (const { feature, expected } of cases) {
            expect(build(feature), feature.name).toEqual(expected)
        }
    })

    it('collapses falsy at || sites, passes truthy falsy-lookalikes through, and runs the REAL evaluator for cosmic_omen', () => {
        const build = (type, auto) => starryHandlers[type](makeFeature({ type, ...auto }), BASE_STATS)

        // Empty-string || sites fall back to their defaults (= BARE).
        expect(build('starry_form', { effect: '', duration: '', resourceKey: '' })).toEqual(BARE.starry_form)
        expect(build('cosmic_omen', { recharge: '', action: '', casting_time: '' })).toEqual(BARE.cosmic_omen)
        // Declared 0 at uses || 0 lands on the default 0 (indistinguishable —
        // folded here rather than given its own its).
        expect(build('starry_form', { uses: 0 })).toEqual(BARE.starry_form)

        // options || CONSTELLATION_OPTIONS: [] is TRUTHY — a declared empty
        // constellation list survives verbatim instead of re-filling defaults.
        expect(build('starry_form', { options: [] }).options).toEqual([])
        expect(build('twinkling_constellations', { options: [] }).options).toEqual([])

        // uses:50 on cosmic_omen is an UNREAD key — pool stays 0 with no
        // uses_expression (default guard skip also pinned in BARE).
        expect(build('cosmic_omen', { uses: 50 })).toEqual(BARE.cosmic_omen)

        // REAL evaluateAutoExpression goldens, hand-derived once (#820/#710):
        // guard '' skips evaluation → 0; token+pure-arith goldens below.
        expect(build('cosmic_omen', { uses_expression: '' }).usesMax).toBe(0)
        // 'proficiency_bonus' → BASE_STATS.proficiency 3 → 3 || 0 → 3.
        expect(build('cosmic_omen', { uses_expression: 'proficiency_bonus' }).usesMax).toBe(3)
        // '\blevel\b' token → 5 → pure arithmetic → 5.
        expect(build('cosmic_omen', { uses_expression: 'level' }).usesMax).toBe(5)
        // Dice notation is NOT evaluated: evaluator returns the string, which
        // is truthy and survives the eval-result || 0 untouched.
        expect(build('cosmic_omen', { uses_expression: '2d4' }).usesMax).toBe('2d4')
    })

    it('throws TypeError for every handler when automation is null or undefined', () => {
        for (const type of TYPES) {
            expect(() => starryHandlers[type]({ name: NAME, automation: null }, BASE_STATS), `${type} null`).toThrow(TypeError)
            expect(() => starryHandlers[type]({ name: NAME }, BASE_STATS), `${type} undefined`).toThrow(TypeError)
        }
    })
})
