// @maintained-by-ai
// ── diverse builder unit (automationInfoBuilder family #2104) ───────────────
// Canonical home for diverse.js — the grab-bag lane of remaining handler
// types: divine_intervention · extra_action · font_of_magic ·
// font_of_inspiration · meta · jack_of_all_trades · reliable_talent ·
// divine_order. Grep of every sibling unit lane (#2094–#2103) confirms none
// of these types is covered elsewhere; the facade automationInfoBuilder.test.js
// routes them but pins no values (its own header delegates extra_action here).
//
// All eight handlers are whitelist copiers: each auto.* field rides its own
// `||` / `!!` arm into a fixed envelope and NOTHING is evaluated. Exact
// toEqual envelopes pin both the emitted keys and the dropped disk keys
// (casting_time is on disk for extra_action + the passive trio but never
// emitted here). Falsy probes use '' / 0 / non-boolean truthies — never
// null/undefined, which would pass under ?? too and mask the ||/!! arms.
//
// Cited, not re-pinned here (runtime consumption is a different lane):
//  • extra_action resource consumption / once-per-turn gate:
//    extraActionHandler (+ .cla004) under automation/handlers/combat/;
//    font_of_magic / font_of_inspiration rest economy: fontOfMagicHandler,
//    fontOfInspirationHandler, restRules-shortRest tests.
//  • divine_intervention upgrade consumption of the 'wish' upgradeTo this
//    envelope carries: divineInterventionHandler.test.js.
//  • meta effect consumer liveness: automationRouter.js:172 interprets
//    'heroic_inspiration_on_long_rest' off this envelope's effect field.
//  • dispatch delegation for all eight types: facade automationInfoBuilder
//    .test.js (buildAttackInfo === direct-handler equality).
import { describe, it, expect } from 'vitest'
import { diverseHandlers } from './diverse.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

describe('diverseHandlers', () => {
    it('registers exactly the eight grab-bag types (ledger pin)', () => {
        expect(Object.keys(diverseHandlers).sort()).toEqual([
            'divine_intervention',
            'divine_order',
            'extra_action',
            'font_of_inspiration',
            'font_of_magic',
            'jack_of_all_trades',
            'meta',
            'reliable_talent',
        ])
    })

    // Missing-key (undefined) and falsy ('' / 0 / truthy non-boolean) arms
    // collapse to the exact default envelope; the trio rows use their verbatim
    // disk automation (public/data classes.json) so the dropped casting_time
    // is pinned too.
    it.each([
        { type: 'divine_intervention', auto: { type: 'divine_intervention' },
            exp: { type: 'divine_intervention', name: 'Test Feature', recharge: 'long_rest',
                upgradeTo: '', casting_time: '1 action', hasAutomation: true } },
        { type: 'divine_intervention', auto: { type: 'divine_intervention', recharge: '', upgradeTo: '', casting_time: '' },
            exp: { type: 'divine_intervention', name: 'Test Feature', recharge: 'long_rest',
                upgradeTo: '', casting_time: '1 action', hasAutomation: true } },
        { type: 'extra_action', auto: { type: 'extra_action' },
            exp: { type: 'extra_action', name: 'Test Feature', uses: 1, recharge: 'short_rest',
                oncePerTurn: false, oncePerCombat: false, firstRoundOnly: false,
                resourceKey: 'testfeatureUses', hasAutomation: true } },
        { type: 'extra_action', auto: { type: 'extra_action', uses: 0, oncePerTurn: '', oncePerCombat: 0, firstRoundOnly: '' },
            exp: { type: 'extra_action', name: 'Test Feature', uses: 1, recharge: 'short_rest',
                oncePerTurn: false, oncePerCombat: false, firstRoundOnly: false,
                resourceKey: 'testfeatureUses', hasAutomation: true } },
        { type: 'extra_action', auto: { type: 'extra_action', oncePerTurn: 'yes', oncePerCombat: 1, firstRoundOnly: 0 },
            exp: { type: 'extra_action', name: 'Test Feature', uses: 1, recharge: 'short_rest',
                oncePerTurn: true, oncePerCombat: true, firstRoundOnly: false,
                resourceKey: 'testfeatureUses', hasAutomation: true } },
        { type: 'font_of_magic', auto: { type: 'font_of_magic', casting_time: '' },
            exp: { type: 'font_of_magic', name: 'Test Feature', casting_time: '1 bonus action', hasAutomation: true } },
        { type: 'font_of_inspiration', auto: { type: 'font_of_inspiration', casting_time: '' },
            exp: { type: 'font_of_inspiration', name: 'Test Feature', casting_time: 'passive', hasAutomation: true } },
        { type: 'meta', auto: { type: 'meta', effect: '' },
            exp: { type: 'meta', name: 'Test Feature', effect: '', hasAutomation: true } },
        { type: 'jack_of_all_trades', auto: { type: 'jack_of_all_trades', casting_time: 'passive' },
            exp: { type: 'jack_of_all_trades', name: 'Test Feature', hasAutomation: true } },
        { type: 'reliable_talent', auto: { type: 'reliable_talent', casting_time: 'passive' },
            exp: { type: 'reliable_talent', name: 'Test Feature', hasAutomation: true } },
        { type: 'divine_order', auto: { type: 'divine_order', casting_time: 'passive' },
            exp: { type: 'divine_order', name: 'Test Feature', hasAutomation: true } },
    ])('%type: defaults + falsy || / !! arms, exact envelope', ({ type, auto, exp }) => {
        expect(diverseHandlers[type](makeFeature(auto), BASE_STATS)).toEqual(exp)
    })

    // Custom values pass through verbatim: rows 1–3 are verbatim disk
    // automations (5e + 2024 classes.json) proving every passthrough field
    // AND the dropped casting_time; font/meta customs are synthetic values
    // deliberately distinct from their defaults (disk never carries a custom
    // casting_time there, so a verbatim disk probe cannot discriminate);
    // the resourceKey edges are synthetic, pinning lowercase + /\s+/g strip
    // with non-whitespace preserved.
    it.each([
        { type: 'divine_intervention', name: 'Greater Divine Intervention',
            auto: { type: 'divine_intervention', recharge: 'long_rest', upgradeTo: 'wish', casting_time: '1 action' },
            exp: { type: 'divine_intervention', name: 'Greater Divine Intervention',
                recharge: 'long_rest', upgradeTo: 'wish', casting_time: '1 action', hasAutomation: true } },
        { type: 'extra_action', name: 'Action Surge',
            auto: { type: 'extra_action', uses: 2, recharge: 'short_rest', oncePerTurn: true, casting_time: '1 action' },
            exp: { type: 'extra_action', name: 'Action Surge', uses: 2, recharge: 'short_rest',
                oncePerTurn: true, oncePerCombat: false, firstRoundOnly: false,
                resourceKey: 'actionsurgeUses', hasAutomation: true } },
        { type: 'extra_action', name: "Thief's Reflexes",
            auto: { type: 'extra_action', uses: 1, recharge: 'long_rest', oncePerCombat: true, firstRoundOnly: true, casting_time: 'passive' },
            exp: { type: 'extra_action', name: "Thief's Reflexes", uses: 1, recharge: 'long_rest',
                oncePerTurn: false, oncePerCombat: true, firstRoundOnly: true,
                resourceKey: "thief'sreflexesUses", hasAutomation: true } },
        { type: 'extra_action', name: '  Many   Actions 1st',
            auto: { type: 'extra_action' },
            exp: { type: 'extra_action', name: '  Many   Actions 1st', uses: 1, recharge: 'short_rest',
                oncePerTurn: false, oncePerCombat: false, firstRoundOnly: false,
                resourceKey: 'manyactions1stUses', hasAutomation: true } },
        { type: 'font_of_magic', name: 'Font of Magic',
            auto: { type: 'font_of_magic', casting_time: '1 reaction' },
            exp: { type: 'font_of_magic', name: 'Font of Magic', casting_time: '1 reaction', hasAutomation: true } },
        { type: 'font_of_inspiration', name: 'Font of Inspiration',
            auto: { type: 'font_of_inspiration', casting_time: '1 action' },
            exp: { type: 'font_of_inspiration', name: 'Font of Inspiration', casting_time: '1 action', hasAutomation: true } },
        { type: 'meta', name: 'Meta Ability',
            auto: { type: 'meta', effect: 'heroic_inspiration_on_long_rest' },
            exp: { type: 'meta', name: 'Meta Ability', effect: 'heroic_inspiration_on_long_rest', hasAutomation: true } },
    ])('%type: %name passthrough, exact envelope', ({ type, name, auto, exp }) => {
        expect(diverseHandlers[type](makeFeature(auto, name), BASE_STATS)).toEqual(exp)
    })
})
