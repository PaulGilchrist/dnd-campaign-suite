// @maintained-by-ai
// ── spell.test.js — automationInfoBuilder spell slice (lane #952 template) ──
// Unit home for the EXACT emitted info bytes of spellHandlers (spell.js):
// spell-oriented feature automation rows (free-cast pools, war magic, patron /
// companion spell slots) → handler-input envelopes as STRINGS/defaults.
// 18 handlers, censused below. Builder output only — executor math, upcast
// flow, and render bytes are cited, never re-driven here.
//
// Distinguishing code paths inside the slice:
//   • free_spell / fey_reinforcements / dragon_companion are the slice's
//     ONLY playerStats readers: uses_expression runs through the REAL
//     automationExpressions.evaluateAutoExpression with hand-derived goldens
//     (#820 golden-once, #710 no formula oracle); result `|| 1` collapses
//     falsy only and OVERWRITES a declared uses.
//   • contact_patron emits uses_expression verbatim but NEVER resolves it
//     (no usesMax key) — the collector's reresolveAutomationUsesMax
//     (automationExpressions.js:196) re-resolves those entries later; the
//     builder's non-resolution is pinned, not fixed.
//   • overchannel pins effect:'overchannel' hardcoded (custom effect drops);
//     dragon_companion hardcodes noConcentration:false (custom drops) —
//     falsifiable hardcoded-override drop pins (#954/#959).
//   • Everything else is per-field `||` fallbacks + `!!` flattening — zero
//     mocks for pure handlers (#791/#953).
//
// Executor/render owners cited, never re-driven (this lane pins BUILDER
// OUTPUT bytes only — info envelopes: damage/DC refs, save types, ranges as
// STRINGS):
//   • free-cast EXECUTOR trigger → automation/handlers castAction lane (#945)
//   • spell pipeline lanes → actionPipeline owner tests
//   • upcast flow → #947/#945 · spell position resolver → #946
//   • spell_effect render → #884 · LogSpell render bytes → #887
//   • spell overlay → #913/#914/#873
//   • facade delegation → ../automationInfoBuilder.test.js (no per-type pins
//     there; this file is the canonical home, incl. spell_modifier's
//     resource:'sorcery_points' default — sorcery.test.js delegates it here)
//   • collector inputs → automationCollector.* lanes · free-cast pool bake/
//     re-resolve → automationService.feyReinforcements.test.js & CLA-229
//     reresolve lane (usesMax re-resolve lives there, not here).
//
// Old → new map (old file: 35 per-field toMatchObject/toBe + 4 vi.spyOn
// evaluator mocks its → 5 tests):
//   per-handler 'returns correct structure with defaults' ×16
//     → census of all 18 + BARE exact-byte envelope loop (1)  [the two
//       untested handlers minor_telekinesis_spell & sanctuary now covered]
//   per-handler 'passes through custom fields' ×15 + overchannel casting_time
//     → one full-custom exact table (customs ≠ defaults #954), unknownKey
//     injected per case (unread-key leak pin), hardcoded-override drop pins
//     (overchannel effect, dragon_companion noConcentration), free_spell
//     uses_expression > declared uses, contact_patron non-resolution (2)
//   free_spell/fey/dragon 'resolves usesMax' + 'falls back to 1' ×5 vi.spyOn
//     mocks → REAL-evaluator golden loop (proficiency_bonus→3, level→5,
//     '0'→||1 collapse, prof-0 stats→1, truthy-string passthrough) (3)
//   free_spell/spell_thief/war_magic 'coerces booleans' ×3 + silent ||
//     defaults → coercion folded table: 0/'' collapse at || sites, !!
//     flattens truthy/0 (this module's real operator sites only) #959 (4)
//   (none)                              → null-automation throw loop (5)

import { describe, it, expect } from 'vitest'
import { spellHandlers } from './spell.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

const NAME = 'Test Feature'

// Hand-derived exact envelopes for a bare feature makeFeature({ type })
// against BASE_STATS (level 5, proficiency 3, STR 4 DEX 2 CON 3 INT 1
// WIS 5 CHA 2). Pins every default, the full key set (extra/dropped keys
// fail), name forwarding and hasAutomation. Only free_spell carries a
// description key; contact_patron carries NO usesMax key (uses_expression
// is echoed unresolved — the collector re-resolves it later).
const BARE = {
    free_spell: {
        type: 'free_spell',
        name: NAME,
        description: '',
        spell: '',
        uses: 1,
        uses_expression: '',
        usesMax: 1,
        recharge: 'long_rest',
        action: 'action',
        duration: '',
        concentration: false,
        noConcentration: false,
        resourceCost: '',
        freeCasts: '',
        casting_time: '',
        perSpellTracking: false,
        hasAutomation: true
    },
    fey_reinforcements: {
        type: 'fey_reinforcements',
        name: NAME,
        spell: '',
        uses: 1,
        uses_expression: '',
        usesMax: 1,
        recharge: 'long_rest',
        action: 'action',
        duration: '',
        casting_time: '',
        hasAutomation: true
    },
    contact_patron: {
        type: 'contact_patron',
        name: NAME,
        spell: '',
        uses: 1,
        uses_expression: '',
        recharge: 'long_rest',
        action: 'action',
        casting_time: '',
        hasAutomation: true
    },
    dragon_companion: {
        type: 'dragon_companion',
        name: NAME,
        spell: '',
        uses: 1,
        uses_expression: '',
        usesMax: 1,
        recharge: 'long_rest',
        action: 'action',
        noConcentration: false,
        hasAutomation: true
    },
    spell_modifier: {
        type: 'spell_modifier',
        name: NAME,
        options: [],
        resource: 'sorcery_points',
        hasAutomation: true
    },
    spell_thief: {
        type: 'spell_thief',
        name: NAME,
        saveType: 'INT',
        saveDc: 'ability',
        saveAbility: 'INT',
        trigger: 'spell_cast',
        oncePerLongRest: false,
        casting_time: '1 reaction',
        hasAutomation: true
    },
    war_magic_cantrip: {
        type: 'war_magic_cantrip',
        name: NAME,
        spellList: 'wizard_cantrips',
        action: 'action',
        casting_time: '1 action',
        hasAutomation: true
    },
    war_magic_spell: {
        type: 'war_magic_spell',
        name: NAME,
        spellList: 'wizard_spells',
        maxSpellLevel: 2,
        action: 'action',
        casting_time: '1 action',
        replacesWarMagic: false,
        hasAutomation: true
    },
    arcane_charge: {
        type: 'arcane_charge',
        name: NAME,
        distance: '30 ft',
        casting_time: '1 action',
        hasAutomation: true
    },
    guarded_mind: {
        type: 'guarded_mind',
        name: NAME,
        resource: 'psionicEnergy',
        action: 'action',
        casting_time: '1 action',
        hasAutomation: true
    },
    bulwark_of_force: {
        type: 'bulwark_of_force',
        name: NAME,
        range: '30_ft',
        duration: '1_round',
        casting_time: '1 bonus action',
        hasAutomation: true
    },
    signature_spells: {
        type: 'signature_spells',
        name: NAME,
        action: 'action',
        casting_time: 'passive',
        hasAutomation: true
    },
    spell_mastery: {
        type: 'spell_mastery',
        name: NAME,
        action: 'action',
        casting_time: 'passive',
        hasAutomation: true
    },
    overchannel: {
        type: 'overchannel',
        name: NAME,
        effect: 'overchannel',
        casting_time: 'passive',
        hasAutomation: true
    },
    pass_without_trace: {
        type: 'pass_without_trace',
        name: NAME,
        duration: '1_hour',
        auraRange: 30,
        casting_time: '1 action',
        hasAutomation: true
    },
    warding_bond: {
        type: 'warding_bond',
        name: NAME,
        range: 'touch',
        duration: '1 hour',
        casting_time: '1 action',
        hasAutomation: true
    },
    minor_telekinesis_spell: {
        type: 'minor_telekinesis_spell',
        name: NAME,
        spell: '',
        hasAutomation: true
    },
    sanctuary: {
        type: 'sanctuary',
        name: NAME,
        range: '30 feet',
        duration: '1 minute',
        casting_time: '1 bonus action',
        hasAutomation: true
    }
}

const TYPES = Object.keys(BARE)

describe('spellHandlers', () => {
    it('emits the exact default envelope for every handler (census of all 18)', () => {
        // Census (#952): a new spell handler added to neither table fails here.
        expect(Object.keys(spellHandlers).sort()).toEqual(TYPES.slice().sort())

        for (const type of TYPES) {
            expect(spellHandlers[type](makeFeature({ type }), BASE_STATS), type).toEqual(BARE[type])
        }
    })

    it('copies declared fields verbatim, drops unread/hardcoded keys (all customs ≠ defaults)', () => {
        // unknownKey + description are injected into EVERY case: exact toEqual
        // fails if the builder ever leaks unread automation keys; description
        // forwarding is free_spell-only (all other envelopes stay key-exact).
        const build = (automation, name = NAME) =>
            spellHandlers[automation.type]({ name, description: 'Some description', automation: { ...automation, unknownKey: 'leak?' } }, BASE_STATS)

        const cases = [
            {
                // free_spell reads every declared field incl. noConcentration
                // (contrast dragon_companion below) and forwards description.
                feature: makeFeature({
                    type: 'free_spell', spell: 'fireball', uses: 3, recharge: 'short_rest',
                    action: 'bonus_action', duration: '1_minute', concentration: true,
                    noConcentration: true, resourceCost: 'spell_slot', freeCasts: 'once_per_rest',
                    casting_time: '1 action', perSpellTracking: true
                }, 'Expeditious Retreat'),
                expected: {
                    ...BARE.free_spell, name: 'Expeditious Retreat', description: 'Some description', spell: 'fireball', uses: 3, usesMax: 3,
                    recharge: 'short_rest', action: 'bonus_action', duration: '1_minute', concentration: true,
                    noConcentration: true, resourceCost: 'spell_slot', freeCasts: 'once_per_rest',
                    casting_time: '1 action', perSpellTracking: true
                }
            },
            {
                feature: makeFeature({
                    type: 'fey_reinforcements', spell: 'call lightning', uses: 2,
                    recharge: 'short_rest', action: 'bonus_action', duration: '1_round',
                    casting_time: '1 reaction'
                }, 'Fey Guard'),
                expected: {
                    ...BARE.fey_reinforcements, name: 'Fey Guard', spell: 'call lightning', uses: 2, usesMax: 2,
                    recharge: 'short_rest', action: 'bonus_action', duration: '1_round', casting_time: '1 reaction'
                }
            },
            {
                // contact_patron NEVER evaluates uses_expression: uses stays at
                // the declared constant and the envelope carries NO usesMax key
                // (collector reresolveAutomationUsesMax owns later resolution).
                feature: makeFeature({
                    type: 'contact_patron', spell: 'contact other plane', uses: 3,
                    uses_expression: 'proficiency_bonus', recharge: 'short_rest',
                    action: 'bonus_action', casting_time: '1 minute'
                }, 'Dark Pact'),
                expected: {
                    ...BARE.contact_patron, name: 'Dark Pact', spell: 'contact other plane', uses: 3,
                    uses_expression: 'proficiency_bonus', recharge: 'short_rest',
                    action: 'bonus_action', casting_time: '1 minute'
                }
            },
            {
                // dragon_companion hardcodes noConcentration:false — declared
                // true must not leak (hardcoded-override drop pin #954).
                feature: makeFeature({
                    type: 'dragon_companion', spell: 'drakonir companion', uses: 2,
                    recharge: 'short_rest', action: 'bonus_action', noConcentration: true
                }, 'Drakonir'),
                expected: {
                    ...BARE.dragon_companion, name: 'Drakonir', spell: 'drakonir companion', uses: 2, usesMax: 2,
                    recharge: 'short_rest', action: 'bonus_action'
                }
            },
            {
                feature: makeFeature({ type: 'spell_modifier', options: [{ name: 'Empowered' }], resource: 'spell_slot' }, 'Empower Spell'),
                expected: { ...BARE.spell_modifier, name: 'Empower Spell', options: [{ name: 'Empowered' }], resource: 'spell_slot' }
            },
            {
                feature: makeFeature({
                    type: 'spell_thief', saveType: 'WIS', saveDc: 15, saveAbility: 'CHA',
                    trigger: 'spell_miss', oncePerLongRest: true, casting_time: '1 action'
                }, 'Arcane Theft'),
                expected: {
                    ...BARE.spell_thief, name: 'Arcane Theft', saveType: 'WIS', saveDc: 15, saveAbility: 'CHA',
                    trigger: 'spell_miss', oncePerLongRest: true, casting_time: '1 action'
                }
            },
            {
                feature: makeFeature({ type: 'war_magic_cantrip', spellList: 'sorcerer_cantrips', action: 'bonus_action', casting_time: '1 bonus action' }, 'Battle Casting'),
                expected: { ...BARE.war_magic_cantrip, name: 'Battle Casting', spellList: 'sorcerer_cantrips', action: 'bonus_action', casting_time: '1 bonus action' }
            },
            {
                feature: makeFeature({ type: 'war_magic_spell', spellList: 'sorcerer_spells', maxSpellLevel: 3, action: 'reaction', casting_time: '1 reaction', replacesWarMagic: true }, 'Overwritten Spell'),
                expected: { ...BARE.war_magic_spell, name: 'Overwritten Spell', spellList: 'sorcerer_spells', maxSpellLevel: 3, action: 'reaction', casting_time: '1 reaction', replacesWarMagic: true }
            },
            {
                feature: makeFeature({ type: 'arcane_charge', distance: '60 ft', casting_time: '1 bonus action' }, 'Surge'),
                expected: { ...BARE.arcane_charge, name: 'Surge', distance: '60 ft', casting_time: '1 bonus action' }
            },
            {
                feature: makeFeature({ type: 'guarded_mind', resource: 'sorcery_points', action: 'bonus_action', casting_time: '1 bonus action' }, 'Iron Will'),
                expected: { ...BARE.guarded_mind, name: 'Iron Will', resource: 'sorcery_points', action: 'bonus_action', casting_time: '1 bonus action' }
            },
            {
                feature: makeFeature({ type: 'bulwark_of_force', range: '60_ft', duration: '1_minute', casting_time: '1 action' }, 'Force Bulwark'),
                expected: { ...BARE.bulwark_of_force, name: 'Force Bulwark', range: '60_ft', duration: '1_minute', casting_time: '1 action' }
            },
            {
                feature: makeFeature({ type: 'signature_spells', action: 'bonus_action', casting_time: '1 action' }, 'Signature Sigil'),
                expected: { ...BARE.signature_spells, name: 'Signature Sigil', action: 'bonus_action', casting_time: '1 action' }
            },
            {
                feature: makeFeature({ type: 'spell_mastery', action: 'bonus_action', casting_time: '1 action' }, 'Mastered Arcana'),
                expected: { ...BARE.spell_mastery, name: 'Mastered Arcana', action: 'bonus_action', casting_time: '1 action' }
            },
            {
                // overchannel: effect is hardcoded 'overchannel' — declared
                // custom must not leak (falsifiable drop pin #842).
                feature: makeFeature({ type: 'overchannel', casting_time: '1 action', effect: 'mega_channel', damage: '9d10' }, 'Overchannel Now'),
                expected: { ...BARE.overchannel, name: 'Overchannel Now', casting_time: '1 action' }
            },
            {
                feature: makeFeature({ type: 'pass_without_trace', duration: '8_hours', auraRange: 60, casting_time: '1 bonus action' }, 'Untraceable'),
                expected: { ...BARE.pass_without_trace, name: 'Untraceable', duration: '8_hours', auraRange: 60, casting_time: '1 bonus action' }
            },
            {
                feature: makeFeature({ type: 'warding_bond', range: '30 ft', duration: '8 hours', casting_time: '1 reaction' }, 'Symbiotic Bond'),
                expected: { ...BARE.warding_bond, name: 'Symbiotic Bond', range: '30 ft', duration: '8 hours', casting_time: '1 reaction' }
            },
            {
                feature: makeFeature({ type: 'minor_telekinesis_spell', spell: 'telekinetic' }, 'Minor Telekinesis'),
                expected: { ...BARE.minor_telekinesis_spell, name: 'Minor Telekinesis', spell: 'telekinetic' }
            },
            {
                feature: makeFeature({ type: 'sanctuary', range: 'touch', duration: '10 minutes', casting_time: '1 action' }, 'Hallow Shield'),
                expected: { ...BARE.sanctuary, name: 'Hallow Shield', range: 'touch', duration: '10 minutes', casting_time: '1 action' }
            }
        ]

        for (const { feature, expected } of cases) {
            expect(build(feature.automation, feature.name), feature.name).toEqual(expected)
        }
    })

    it('resolves uses_expression via the REAL evaluator for the 3 stats-reading handlers, || 1 collapsing falsy only', () => {
        // Goldens hand-derived once from BASE_STATS (level 5, proficiency 3);
        // evaluator internals are unit-owned (automationExpressions.test.js).
        const build = (type, auto, stats = BASE_STATS) =>
            spellHandlers[type](makeFeature({ type, ...auto }), stats)

        // Token resolution is real, not copied: proficiency_bonus→3, level→5.
        expect(build('free_spell', { uses_expression: 'proficiency_bonus' })).toEqual({ ...BARE.free_spell, uses: 3, usesMax: 3, uses_expression: 'proficiency_bonus' })
        expect(build('free_spell', { uses_expression: 'level' })).toEqual({ ...BARE.free_spell, uses: 5, usesMax: 5, uses_expression: 'level' })
        expect(build('fey_reinforcements', { uses_expression: 'proficiency_bonus' })).toEqual({ ...BARE.fey_reinforcements, uses: 3, usesMax: 3, uses_expression: 'proficiency_bonus' })
        expect(build('dragon_companion', { uses_expression: 'level' })).toEqual({ ...BARE.dragon_companion, uses: 5, usesMax: 5, uses_expression: 'level' })

        // Resolved expression OVERWRITES a declared uses (contrast
        // contact_patron, which keeps uses:3 — pinned in the customs table).
        expect(build('free_spell', { uses: 4, uses_expression: 'level' })).toEqual({ ...BARE.free_spell, uses: 5, usesMax: 5, uses_expression: 'level' })

        // Falsy evaluator results collapse to 1 via `|| 1` — declared uses:4
        // must NOT resurrect ('0' is pure arithmetic → numeric 0).
        expect(build('free_spell', { uses: 4, uses_expression: '0' }).usesMax).toBe(1)
        expect(build('dragon_companion', { uses_expression: 'proficiency_bonus' }, { ...BASE_STATS, proficiency: 0 }).usesMax).toBe(1)

        // Truthy NON-numeric (unknown tokens pass through as a string, with a
        // console.warn from the evaluator) — `|| 1` guards falsy only.
        expect(build('fey_reinforcements', { uses_expression: 'no_such_token' }).usesMax).toBe('no_such_token')
    })

    it('collapses 0/"" at || sites back to defaults and flattens booleans at !! sites', () => {
        const build = (type, auto) => spellHandlers[type](makeFeature({ type, ...auto }), BASE_STATS)

        // uses || 1 — declared 0 collapses (all four handlers that mirror it).
        expect(build('free_spell', { uses: 0 })).toEqual(BARE.free_spell)
        expect(build('fey_reinforcements', { uses: 0 })).toEqual(BARE.fey_reinforcements)
        expect(build('contact_patron', { uses: 0 })).toEqual(BARE.contact_patron)
        expect(build('dragon_companion', { uses: 0 })).toEqual(BARE.dragon_companion)

        // Numeric || sites collapse 0 (types differ from the fallback default).
        expect(build('war_magic_spell', { maxSpellLevel: 0 }).maxSpellLevel).toBe(2)
        expect(build('pass_without_trace', { auraRange: 0 }).auraRange).toBe(30)
        expect(build('spell_thief', { saveDc: 0 }).saveDc).toBe('ability')

        // Empty-string || sites fall back to their defaults (= BARE).
        expect(build('free_spell', { spell: '', recharge: '', action: '', duration: '', resourceCost: '', freeCasts: '', casting_time: '', uses_expression: '' })).toEqual(BARE.free_spell)
        expect(build('spell_thief', { saveType: '', saveAbility: '', trigger: '', casting_time: '' })).toEqual(BARE.spell_thief)
        expect(build('war_magic_cantrip', { spellList: '', action: '', casting_time: '' })).toEqual(BARE.war_magic_cantrip)
        expect(build('signature_spells', { action: '', casting_time: '' })).toEqual(BARE.signature_spells)
        expect(build('overchannel', { casting_time: '' })).toEqual(BARE.overchannel)
        expect(build('warding_bond', { range: '', duration: '', casting_time: '' })).toEqual(BARE.warding_bond)
        expect(build('sanctuary', { range: '', duration: '', casting_time: '' })).toEqual(BARE.sanctuary)

        // !! sites: truthy strings flatten to true …
        expect(build('free_spell', { concentration: 'yes', noConcentration: 'yes', perSpellTracking: 'yes' })).toEqual(
            { ...BARE.free_spell, concentration: true, noConcentration: true, perSpellTracking: true })
        expect(build('war_magic_spell', { replacesWarMagic: 'yes' }).replacesWarMagic).toBe(true)
        expect(build('spell_thief', { oncePerLongRest: 'yes' }).oncePerLongRest).toBe(true)
        // … and 0/"" flatten to false (= BARE).
        expect(build('spell_thief', { oncePerLongRest: 0 })).toEqual(BARE.spell_thief)
        expect(build('free_spell', { concentration: 0, perSpellTracking: '' })).toEqual(BARE.free_spell)
    })

    it('throws TypeError for every handler when automation is null or undefined', () => {
        for (const type of TYPES) {
            expect(() => spellHandlers[type]({ name: NAME, automation: null }, BASE_STATS), `${type} null`).toThrow(TypeError)
            expect(() => spellHandlers[type]({ name: NAME }, BASE_STATS), `${type} undefined`).toThrow(TypeError)
        }
    })
})
