// @maintained-by-ai
// ── psionic.test.js — automationInfoBuilder psionic slice (lane #952 template) ──
// Unit home for the EXACT emitted info bytes of psionicHandlers (psionic.js):
// psi/telekinetic feature automation rows → handler-input envelopes.
//
// Builder family map (facade automationInfoBuilder.js spreads domain maps;
// unit lanes pin per-type values, facade lane pins delegation only — see
// ../automationInfoBuilder.test.js header):
//   • THIS FILE: psionic slice — psychic_spells / psionic_sorcery /
//     psionic_spells_list / telekinetic_movement / telekinetic_leap /
//     telekinetic_thrust. 6 handlers, censused below, all pure (zero mocks
//     #791; none reads playerStats — BASE_STATS is inert, passed to keep the
//     builder contract honest). Distinguishing code paths: telekinetic_movement
//     is the ONLY handler here routing range through rangeToFeet with a
//     `?? 30` fallback (numeric + 'touch'→'8' + unparseable→'30' legs),
//     telekinetic_thrust owns the slice's only `!!` boolean (oncePerTurn);
//     everything else is per-field `||` fallbacks (#953 coercion legs).
//     casting_time is UNREAD by every handler in this slice (unlike primal
//     #953) — declared casting_time must never appear in any envelope.
//   • rangeToFeet unit semantics → rules/combat/rangeValidation.test.js
//     (own home — its conversions are consumed here only as envelope bytes) ·
//     envelope assembly / null-automation contract → facade lane (#952/#953
//     precedent: buildAttackInfo guards automation before any handler runs,
//     so the 6 duplicate handler-level toThrow(TypeError) tests are dropped
//     — unreachable via the only supported call path) · bucket routing of
//     these types (e.g. telekinetic_leap→bonusActions) →
//     automationCollector.types.test.js · runtime execution →
//     src/services/automation/handlers/class-sorcerer/
//     (telekineticMovementHandler / telekineticLeapHandler /
//     psionicStrikeHandler tests — different module, cited not re-driven) ·
//     metamagic consumption of psionic passives → metamagicRules.test.js ·
//     reaction & resource builder slices queued behind this lane — no overlap.
//     No categorization rebuilt here (#710); real-data goldens #820.
//
// Old → new map (old file was 18 tests: 6× toMatchObject defaults +
// 6× per-field toBe passthrough chains + 1 coercion + 6× null-throw —
// toMatchObject missed absent/extra keys):
//   defaults tests (6)          → census Object.keys guard + BARE exact loop (1)
//   passthrough tests (6)       → verbatim table, one full-custom case per
//                                 handler with unread-junk exact-key-set pins (2)
//   oncePerTurn coercion (1)    → folded into coercion legs, extended with
//                                 saveDc:0 (|| vs ??) and rangeToFeet legs (3)
//   null-automation throws (6)  → removed — null contract owned by facade lane

import { describe, it, expect } from 'vitest'
import { psionicHandlers } from './psionic.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

const NAME = 'Test Feature'

// Hand-derived exact envelopes for a bare feature makeFeature({ type }).
// Pins: every default ('Psychic', '30', 'bonus_action', 'until_end_of_turn',
// '2x_speed', 'STR', 'ability', 'INT', 'after_attack_hit', []/false), the
// per-field `||` vs `??` vs `!!` shape, hasAutomation, name forwarding, and
// the full key set of each handler — any handler adding or dropping a key
// fails toEqual. Fabricated or missing keys fail here (#820 golden-once).
const BARE = {
    psychic_spells: {
        type: 'psychic_spells',
        name: NAME,
        damageType: 'Psychic',
        componentReduction: [],
        spellSchools: [],
        hasAutomation: true
    },
    psionic_sorcery: {
        type: 'psionic_sorcery',
        name: NAME,
        psionicSpells: [],
        hasAutomation: true
    },
    psionic_spells_list: {
        type: 'psionic_spells_list',
        name: NAME,
        psionicSpells: [],
        hasAutomation: true
    },
    telekinetic_movement: {
        type: 'telekinetic_movement',
        name: NAME,
        range: '30',
        hasAutomation: true
    },
    telekinetic_leap: {
        type: 'telekinetic_leap',
        name: NAME,
        action: 'bonus_action',
        duration: 'until_end_of_turn',
        flySpeed: '2x_speed',
        hasAutomation: true
    },
    telekinetic_thrust: {
        type: 'telekinetic_thrust',
        name: NAME,
        saveType: 'STR',
        saveDc: 'ability',
        saveAbility: 'INT',
        options: [],
        trigger: 'after_attack_hit',
        oncePerTurn: false,
        hasAutomation: true
    }
}

describe('psionicHandlers', () => {
    it('emits the exact default envelope for every handler (census of all 6)', () => {
        // Census (#781): a new psionic handler that dodges this table fails here.
        expect(Object.keys(psionicHandlers).sort()).toEqual(Object.keys(BARE).sort())

        for (const [type, expected] of Object.entries(BARE)) {
            expect(psionicHandlers[type](makeFeature({ type }), BASE_STATS), type).toEqual(expected)
        }
    })

    it('copies declared fields verbatim and drops unread inputs (exact key sets)', () => {
        // One full-custom case per handler — every readable field carries a
        // NON-default value (vacuous-override guard #954), and every case
        // declares cross-handler junk (including casting_time, unread by the
        // WHOLE slice) that must never leak — exact toEqual catches adds.
        const cases = [
            {
                feature: makeFeature({
                    type: 'psychic_spells',
                    damageType: 'Force',
                    componentReduction: ['somatic', 'material'],
                    spellSchools: ['divination', 'transmutation'],
                    casting_time: '1 action',
                    saveType: 'DEX'
                }, 'Telepathic Dominion'),
                expected: {
                    type: 'psychic_spells',
                    name: 'Telepathic Dominion',
                    damageType: 'Force',
                    componentReduction: ['somatic', 'material'],
                    spellSchools: ['divination', 'transmutation'],
                    hasAutomation: true
                }
            },
            {
                feature: makeFeature({
                    type: 'psionic_sorcery',
                    psionic_spells: ['psi bolt', 'id insinuation'],
                    casting_time: '1 bonus action',
                    range: '60_ft'
                }, 'Expanded Sorcery'),
                expected: {
                    ...BARE.psionic_sorcery,
                    name: 'Expanded Sorcery',
                    psionicSpells: ['psi bolt', 'id insinuation']
                }
            },
            {
                feature: makeFeature({
                    type: 'psionic_spells_list',
                    psionic_spells: ['telekinetic grasp', 'tower of defense'],
                    casting_time: '1 action',
                    damageType: 'Force'
                }, 'Disciplines of the Mind'),
                expected: {
                    ...BARE.psionic_spells_list,
                    name: 'Disciplines of the Mind',
                    psionicSpells: ['telekinetic grasp', 'tower of defense']
                }
            },
            {
                // rangeToFeet parses '60 ft' and STRIPS the unit — '60_ft'
                // emitted verbatim would fail here.
                feature: makeFeature({
                    type: 'telekinetic_movement',
                    range: '60_ft',
                    casting_time: '1 action',
                    flySpeed: '1.5x_speed'
                }, 'Spectral Shift'),
                expected: {
                    type: 'telekinetic_movement',
                    name: 'Spectral Shift',
                    range: '60',
                    hasAutomation: true
                }
            },
            {
                feature: makeFeature({
                    type: 'telekinetic_leap',
                    action: 'action',
                    duration: '1_round',
                    flySpeed: '1.5x_speed',
                    casting_time: '1 reaction',
                    saveDc: 15
                }, 'Titan Leap'),
                expected: {
                    ...BARE.telekinetic_leap,
                    name: 'Titan Leap',
                    action: 'action',
                    duration: '1_round',
                    flySpeed: '1.5x_speed'
                }
            },
            {
                // oncePerTurn:1 → coerced true (passthrough would leak 1).
                feature: makeFeature({
                    type: 'telekinetic_thrust',
                    saveType: 'CON',
                    saveDc: 15,
                    saveAbility: 'WIS',
                    trigger: 'on_hit',
                    oncePerTurn: 1,
                    options: ['push 10ft', 'knock prone'],
                    casting_time: '1 reaction'
                }, 'Concussive Shove'),
                expected: {
                    ...BARE.telekinetic_thrust,
                    name: 'Concussive Shove',
                    saveType: 'CON',
                    saveDc: 15,
                    saveAbility: 'WIS',
                    trigger: 'on_hit',
                    oncePerTurn: true,
                    options: ['push 10ft', 'knock prone']
                }
            }
        ]

        for (const { feature, expected } of cases) {
            expect(psionicHandlers[feature.automation.type](feature, BASE_STATS), feature.name).toEqual(expected)
        }
    })

    it('distinguishes ??, || and !! legs: falsy declared values fall back; range coerces through rangeToFeet', () => {
        // Falsy (non-undefined) declared values must NOT leak through —
        // falsifiers separating `||` from `??` and `!!` from passthrough (#953).
        const cases = [
            {
                // saveDc:0 is falsy → 'ability' re-engages under ||;
                // a ?? refactor would leak 0 and fail here.
                feature: makeFeature({ type: 'telekinetic_thrust', saveDc: 0 }, 'Overshoot Dampener'),
                expected: { ...BARE.telekinetic_thrust, name: 'Overshoot Dampener' }
            },
            {
                // '' and 0 must fall back — empties leaking under ?? fails.
                feature: makeFeature({
                    type: 'psychic_spells',
                    damageType: '',
                    componentReduction: 0,
                    spellSchools: ''
                }, 'Blank Assault'),
                expected: { ...BARE.psychic_spells, name: 'Blank Assault' }
            },
            {
                // psionic_spells:'' → [] (passthrough would keep '').
                feature: makeFeature({ type: 'psionic_sorcery', psionic_spells: '' }, 'Hollow Sorcery'),
                expected: { ...BARE.psionic_sorcery, name: 'Hollow Sorcery' }
            },
            {
                // Non-obvious rangeToFeet legs (owned by rangeValidation.test.js
                // at unit level; pinned here as this handler's emitted bytes):
                // 'touch' is TRUTHY so `auto.range || 30` would keep 'touch' —
                // '8' proves the parse; 'self' parses null → ?? 30 fires;
                // numeric 120 passes through String(); garbage → '30'.
                feature: makeFeature({ type: 'telekinetic_movement', range: 'touch' }, 'Feather Push'),
                expected: { ...BARE.telekinetic_movement, name: 'Feather Push', range: '8' }
            },
            {
                feature: makeFeature({ type: 'telekinetic_movement', range: 'self' }, 'Inert Ward'),
                expected: { ...BARE.telekinetic_movement, name: 'Inert Ward', range: '30' }
            },
            {
                feature: makeFeature({ type: 'telekinetic_movement', range: 120 }, 'Measured Nudge'),
                expected: { ...BARE.telekinetic_movement, name: 'Measured Nudge', range: '120' }
            },
            {
                // truthy non-boolean oncePerTurn → true; falsy '' → false
                // (!! — passthrough would leak 'yes'/'').
                feature: makeFeature({ type: 'telekinetic_thrust', oncePerTurn: 'yes' }, 'Eager Shove'),
                expected: { ...BARE.telekinetic_thrust, name: 'Eager Shove', oncePerTurn: true }
            },
            {
                feature: makeFeature({ type: 'telekinetic_thrust', oncePerTurn: '' }, 'Listless Shove'),
                expected: { ...BARE.telekinetic_thrust, name: 'Listless Shove' }
            }
        ]

        for (const { feature, expected } of cases) {
            expect(psionicHandlers[feature.automation.type](feature, BASE_STATS), feature.name).toEqual(expected)
        }
    })
})
