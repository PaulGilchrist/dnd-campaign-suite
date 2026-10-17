// @maintained-by-ai
// ── elemental builder unit (automationInfoBuilder family #2105) ─────────────
// Canonical home for the five 2024 Giant-ancestry aspect handlers, verbatim
// from public/data/2024/races.json: Fire's Burn · Frost's Chill ·
// Hill's Tumble · Stone's Endurance · Storm's Thunder. This module is one of
// the four hidden modules spread into misc.js (#2093) — misc.test.js (#2109)
// tests the aggregator; this file invokes the unit handlers directly.
//
// All five handlers are whitelist copiers: each auto.* field rides its own
// `||` arm into a fixed envelope and NOTHING is evaluated — no clocks, no
// dice math, no ability resolution. `type` is hardcoded per handler and never
// read off disk. Exact toEqual envelopes pin every emitted field AND the
// dropped junk keys (see the notes key on the fire_burn passthrough row).
// Falsy probes feed '' / 0 — never null/undefined, which would pass under ??
// too and mask the || arms. uses: 0 → null is the ||-vs-?? discriminator.
//
// The passthrough rows feed every passthrough field a synthetic value
// DISTINCT from the handler default (disk damage/damageType/trigger happen to
// equal the defaults, so verbatim disk values cannot discriminate there).
// uses stays the verbatim disk 'proficiency_bonus' STRING — the builder must
// copy it, not evaluate it to BASE_STATS.proficiency (tokens-are-strings,
// #2090 canonical damage.test lane).
//
// ⚠ Registry-insurance-only defaults: hills_tumble's default effect 'prone'
// and frosts_chill/stones defaults never fire from disk data — races.json
// always ships the full automation, and 'prone' is NOT a registered key in
// targetEffectDefinitions.js (the executor stamps the registered
// 'disadvantage_next_attack' / 'speed_reduction' te instead). Pinned as-is,
// flagged, survives as insurance (#1916 lane note).
//
// Cited, not re-pinned here (runtime consumption is a different lane):
//  • executor refusals/spends/te stamps: giantAncestry-firesBurn,
//    -frostsChill, -hillsTumble, -stonesEndurance, -stormsThunder suites
//    under automation/handlers/class-other/.
//  • dispatch routing of all five types: automationRouter.js:218-221
//    (routeFireBurn trio + reaction pair) and the misc.js aggregator chain —
//    consumer liveness confirmed, no dead dispatch keys here.
import { describe, it, expect } from 'vitest'
import { elementalHandlers } from './elemental-handlers.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

describe('elementalHandlers', () => {
    it('registers exactly the five giant-ancestry aspect types (ledger pin)', () => {
        expect(Object.keys(elementalHandlers).sort()).toEqual([
            'fire_burn',
            'frosts_chill',
            'hills_tumble',
            'stones_endurance',
            'storms_thunder',
        ])
    })

    // Missing keys and falsy ('' / 0) arms collapse to the exact default
    // envelope; uses: 0 → null pins `||` over `??` (#2104 discriminator).
    it.each([
        { type: 'fire_burn', auto: { type: 'fire_burn', damage: '', damageType: '', trigger: '', uses: 0, recharge: '', casting_time: '' },
            exp: { type: 'fire_burn', name: 'Test Feature', damage: '1d10', damageType: 'Fire',
                trigger: 'hit', uses: null, recharge: 'long_rest', casting_time: '1 action',
                hasAutomation: true } },
        { type: 'frosts_chill', auto: { type: 'frosts_chill', damage: '', damageType: '', condition: '', value: '', trigger: '', uses: 0, recharge: '', casting_time: '' },
            exp: { type: 'frosts_chill', name: 'Test Feature', damage: '1d6', damageType: 'Cold',
                condition: 'speed_reduction', value: '10_ft', trigger: 'hit', uses: null,
                recharge: 'long_rest', casting_time: '1 action', hasAutomation: true } },
        { type: 'hills_tumble', auto: { type: 'hills_tumble', trigger: '', effect: '', uses: 0, recharge: '', casting_time: '' },
            exp: { type: 'hills_tumble', name: 'Test Feature', trigger: 'melee_hit', effect: 'prone',
                uses: null, recharge: 'long_rest', casting_time: '1 action', hasAutomation: true } },
        { type: 'stones_endurance', auto: { type: 'stones_endurance', reductionExpression: '', trigger: '', uses: 0, recharge: '', casting_time: '' },
            exp: { type: 'stones_endurance', name: 'Test Feature', reductionExpression: '1d12 + CON modifier',
                trigger: 'damage_received', uses: null, recharge: 'long_rest', casting_time: '1 reaction',
                hasAutomation: true } },
        { type: 'storms_thunder', auto: { type: 'storms_thunder', damage: '', damageType: '', range: '', trigger: '', uses: 0, recharge: '', casting_time: '' },
            exp: { type: 'storms_thunder', name: 'Test Feature', damage: '1d8', damageType: 'Thunder',
                range: '60_ft', trigger: 'damage_received_within_range', uses: null,
                recharge: 'long_rest', casting_time: '1 reaction', hasAutomation: true } },
    ])('%type: empty + falsy || arms collapse to exact default envelope', ({ type, auto, exp }) => {
        expect(elementalHandlers[type](makeFeature(auto), BASE_STATS)).toEqual(exp)
    })

    // Every passthrough field fed a synthetic value ≠ its default (distinct
    // per row); trait names are verbatim disk (2024 races.json). uses stays
    // the verbatim disk 'proficiency_bonus' token — copied as a string, not
    // evaluated to BASE_STATS.proficiency (3). The fire_burn row's `notes`
    // key proves the whitelist drops non-emitted automation keys.
    it.each([
        { type: 'fire_burn', name: "Fire's Burn",
            auto: { type: 'fire_burn', damage: '2d10', damageType: 'Lightning', trigger: 'melee_hit', uses: 'proficiency_bonus', recharge: 'short_rest', casting_time: '1 bonus action', notes: 'not whitelisted — dropped' },
            exp: { type: 'fire_burn', name: "Fire's Burn", damage: '2d10', damageType: 'Lightning',
                trigger: 'melee_hit', uses: 'proficiency_bonus', recharge: 'short_rest',
                casting_time: '1 bonus action', hasAutomation: true } },
        { type: 'frosts_chill', name: "Frost's Chill",
            auto: { type: 'frosts_chill', damage: '2d6', damageType: 'Acid', condition: 'no_reactions', value: '15_ft', trigger: 'melee_hit', uses: 'proficiency_bonus', recharge: 'short_rest', casting_time: '1 bonus action' },
            exp: { type: 'frosts_chill', name: "Frost's Chill", damage: '2d6', damageType: 'Acid',
                condition: 'no_reactions', value: '15_ft', trigger: 'melee_hit',
                uses: 'proficiency_bonus', recharge: 'short_rest', casting_time: '1 bonus action',
                hasAutomation: true } },
        { type: 'hills_tumble', name: "Hill's Tumble",
            auto: { type: 'hills_tumble', trigger: 'ranged_hit', effect: 'disadvantage_next_attack', uses: 'proficiency_bonus', recharge: 'short_rest', casting_time: '1 bonus action' },
            exp: { type: 'hills_tumble', name: "Hill's Tumble", trigger: 'ranged_hit',
                effect: 'disadvantage_next_attack', uses: 'proficiency_bonus',
                recharge: 'short_rest', casting_time: '1 bonus action', hasAutomation: true } },
        { type: 'stones_endurance', name: "Stone's Endurance",
            auto: { type: 'stones_endurance', reductionExpression: '2d12 + CON modifier', trigger: 'damage_dealt', uses: 'proficiency_bonus', recharge: 'short_rest', casting_time: '1 action' },
            exp: { type: 'stones_endurance', name: "Stone's Endurance", reductionExpression: '2d12 + CON modifier',
                trigger: 'damage_dealt', uses: 'proficiency_bonus', recharge: 'short_rest',
                casting_time: '1 action', hasAutomation: true } },
        { type: 'storms_thunder', name: "Storm's Thunder",
            auto: { type: 'storms_thunder', damage: '2d8', damageType: 'Fire', range: '120_ft', trigger: 'damage_received', uses: 'proficiency_bonus', recharge: 'short_rest', casting_time: '1 bonus action' },
            exp: { type: 'storms_thunder', name: "Storm's Thunder", damage: '2d8', damageType: 'Fire',
                range: '120_ft', trigger: 'damage_received', uses: 'proficiency_bonus',
                recharge: 'short_rest', casting_time: '1 bonus action', hasAutomation: true } },
    ])('%type: %name — every passthrough field verbatim, exact envelope', ({ type, name, auto, exp }) => {
        expect(elementalHandlers[type](makeFeature(auto, name), BASE_STATS)).toEqual(exp)
    })
})
