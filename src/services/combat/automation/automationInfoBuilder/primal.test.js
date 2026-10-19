// @maintained-by-ai
// ── primal.test.js — automationInfoBuilder primal slice (lane #952 template) ──
// Unit home for the exact emitted info bytes of primalHandlers (primal.js):
// every companion feature automation row → handler-input envelope.
//
// Builder family map (facade automationInfoBuilder.js spreads 21 domain maps;
// unit lanes pin per-type values, facade lane pins delegation only — see
// ../automationInfoBuilder.test.js header):
//   • THIS FILE: primal slice — companion summon / dodge / command / restore /
//     bonus_action_command / double_strike / spell_share. 7 handlers, censused
//     below. No type renames or snake→camel aliases in this slice (unlike the
//     passive slice #952); the distinguishing code paths are the per-field
//     `|| default` fallbacks and the two `!!` booleans (spellSlotCost,
//     forceDamageOption), pinned in the semantics test.
//   • passive slice → passive.test.js · double_strike DAMAGE handler →
//     damage.test.js (different handler, no overlap) · envelope assembly /
//     null contract → facade lane · runtime execution →
//     src/services/automation/handlers/class-ranger/primalCompanionHandler.test.js.
//
// Method: exact-bytes toEqual literals, hand-derived once from primal.js
// source (#820 golden-once, #943 field-set census — fabricated or missing
// keys fail). Builder unmocked (#791); handlers are pure so no timers,
// network, or mock infra needed.
//
// Old → new map (old per-field toBe chains + toMatchObject defaults missed
// absent/extra keys and re-asserted name/hasAutomation 7× via a helper):
//   defaults tests (7) + checkDefaults helper → census + BARE exact loop (1)
//   pass-through tests (7)                    → verbatim table, one full-custom
//                                               case per handler (2)
//   (none)                                    → NEW coercion/falsy semantics pins (3)

import { describe, it, expect } from 'vitest'
import { primalHandlers } from './primal.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

const NAME = 'Test Feature'

// Hand-derived exact envelopes for a bare feature makeFeature({ type }).
// Pins: every default ('bonus_action', 'action', 'beasts_strike', '5_ft',
// '30_ft', 'passive', '1 action', '1 bonus action', []/false), the per-field
// `||` vs `!!` shape, hasAutomation, name forwarding, and the full key set
// of each handler. casting_time is NEVER hardcoded here — every handler reads
// declared data, so its per-handler default is pinned in BARE and its
// override in the verbatim table.
const BARE = {
    primal_companion_summon: {
        type: 'primal_companion_summon',
        name: NAME,
        action: 'bonus_action',
        companionTypes: [],
        casting_time: '1 bonus action',
        hasAutomation: true
    },
    primal_companion_dodge: {
        type: 'primal_companion_dodge',
        name: NAME,
        effect: 'companion_dodge_default',
        casting_time: 'passive',
        hasAutomation: true
    },
    primal_companion_command: {
        type: 'primal_companion_command',
        name: NAME,
        action: 'action',
        commandType: 'beasts_strike',
        casting_time: '1 action',
        hasAutomation: true
    },
    primal_companion_restore: {
        type: 'primal_companion_restore',
        name: NAME,
        action: 'action',
        range: '5_ft',
        spellSlotCost: false,
        casting_time: '1 action',
        hasAutomation: true
    },
    primal_companion_bonus_action_command: {
        type: 'primal_companion_bonus_action_command',
        name: NAME,
        commandActions: [],
        forceDamageOption: false,
        casting_time: '1 bonus action',
        hasAutomation: true
    },
    primal_companion_double_strike: {
        type: 'primal_companion_double_strike',
        name: NAME,
        casting_time: 'passive',
        hasAutomation: true
    },
    primal_companion_spell_share: {
        type: 'primal_companion_spell_share',
        name: NAME,
        range: '30_ft',
        casting_time: 'passive',
        hasAutomation: true
    }
}

describe('primalHandlers', () => {
    it('emits the exact default envelope for every handler (census of all 7)', () => {
        // Census (#781): a new primal handler that dodges this table fails here.
        expect(Object.keys(primalHandlers).sort()).toEqual(Object.keys(BARE).sort())

        for (const [type, expected] of Object.entries(BARE)) {
            expect(primalHandlers[type](makeFeature({ type }), BASE_STATS), type).toEqual(expected)
        }
    })

    it('copies declared automation fields into the envelope verbatim', () => {
        // One full-custom case per handler — every field each handler reads
        // is declared with a custom value, so any dropped or renamed key fails.
        const cases = [
            {
                feature: makeFeature({
                    type: 'primal_companion_summon',
                    action: 'action',
                    companionTypes: ['beast', 'celestial'],
                    casting_time: '1 action'
                }, 'Fetch the Pseudodragon'),
                expected: {
                    type: 'primal_companion_summon',
                    name: 'Fetch the Pseudodragon',
                    action: 'action',
                    companionTypes: ['beast', 'celestial'],
                    casting_time: '1 action',
                    hasAutomation: true
                }
            },
            {
                feature: makeFeature({
                    type: 'primal_companion_dodge',
                    effect: 'companion_dodge_advantage',
                    casting_time: '1 reaction'
                }, 'Evasive Claw'),
                expected: { ...BARE.primal_companion_dodge, name: 'Evasive Claw', effect: 'companion_dodge_advantage', casting_time: '1 reaction' }
            },
            {
                feature: makeFeature({
                    type: 'primal_companion_command',
                    action: 'bonus_action',
                    commandType: 'defensive_stance',
                    casting_time: '1 bonus action'
                }, 'Guard the Ring'),
                expected: { ...BARE.primal_companion_command, name: 'Guard the Ring', action: 'bonus_action', commandType: 'defensive_stance', casting_time: '1 bonus action' }
            },
            {
                feature: makeFeature({
                    type: 'primal_companion_restore',
                    action: 'bonus_action',
                    range: '10_ft',
                    spellSlotCost: true,
                    casting_time: '1 bonus action'
                }, 'Healing Rite'),
                expected: { ...BARE.primal_companion_restore, name: 'Healing Rite', action: 'bonus_action', range: '10_ft', spellSlotCost: true, casting_time: '1 bonus action' }
            },
            {
                feature: makeFeature({
                    type: 'primal_companion_bonus_action_command',
                    commandActions: ['attack', 'move'],
                    forceDamageOption: true,
                    casting_time: '1 reaction'
                }, 'Two-Bird Flurry'),
                expected: { ...BARE.primal_companion_bonus_action_command, name: 'Two-Bird Flurry', commandActions: ['attack', 'move'], forceDamageOption: true, casting_time: '1 reaction' }
            },
            {
                // casting_time is this handler's ONLY readable field.
                feature: makeFeature({ type: 'primal_companion_double_strike', casting_time: '1 action' }, 'Twin Fang Fury'),
                expected: { ...BARE.primal_companion_double_strike, name: 'Twin Fang Fury', casting_time: '1 action' }
            },
            {
                feature: makeFeature({ type: 'primal_companion_spell_share', range: '60_ft', casting_time: '1 bonus action' }, 'Bundle of Blessings'),
                expected: { ...BARE.primal_companion_spell_share, name: 'Bundle of Blessings', range: '60_ft', casting_time: '1 bonus action' }
            }
        ]

        for (const { feature, expected } of cases) {
            expect(primalHandlers[feature.automation.type](feature, BASE_STATS), feature.name).toEqual(expected)
        }
    })

    it('coerces booleans with !! and re-applies defaults on falsy declared values', () => {
        // Falsy (non-undefined) declared values must NOT leak through —
        // falsifiers distinguishing `||` from `??` and `!!` from passthrough.
        const cases = [
            {
                // action:'' and range:'' re-fallback; spellSlotCost:0 → false
                // (`??` would leak 0, plain passthrough would keep '').
                feature: makeFeature({ type: 'primal_companion_restore', action: '', range: '', spellSlotCost: 0, casting_time: '' }, 'Faltering Rite'),
                expected: { ...BARE.primal_companion_restore, name: 'Faltering Rite' }
            },
            {
                // truthy non-boolean → coerced true (passthrough would leak 1).
                feature: makeFeature({ type: 'primal_companion_restore', spellSlotCost: 1 }, 'Earned Mending'),
                expected: { ...BARE.primal_companion_restore, name: 'Earned Mending', spellSlotCost: true }
            },
            {
                // truthy non-boolean → true; commandActions:0 → [] default.
                feature: makeFeature({ type: 'primal_companion_bonus_action_command', commandActions: 0, forceDamageOption: 'yes' }, 'Order to Maim'),
                expected: { ...BARE.primal_companion_bonus_action_command, name: 'Order to Maim', forceDamageOption: true }
            },
            {
                // effect:'' → hardcoded 'companion_dodge_default' re-asserted.
                feature: makeFeature({ type: 'primal_companion_dodge', effect: '', casting_time: '' }, 'Blank Dodge'),
                expected: { ...BARE.primal_companion_dodge, name: 'Blank Dodge' }
            },
            {
                // companionTypes:'' → [] (passthrough would keep '').
                feature: makeFeature({ type: 'primal_companion_summon', action: '', companionTypes: '', casting_time: '' }, 'Ghost Summon'),
                expected: { ...BARE.primal_companion_summon, name: 'Ghost Summon' }
            }
        ]

        for (const { feature, expected } of cases) {
            expect(primalHandlers[feature.automation.type](feature, BASE_STATS), feature.name).toEqual(expected)
        }
    })
})
