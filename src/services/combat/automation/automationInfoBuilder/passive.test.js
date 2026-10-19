// @maintained-by-ai
// ── passive.test.js — automationInfoBuilder passive slice (lane #867 family) ──
// Unit home for the exact emitted info bytes of passiveHandlers (passive.js):
// every passive feature automation row → handler-input envelope.
//
// Builder family map (facade automationInfoBuilder.js spreads 21 domain maps;
// unit lanes pin per-type values, facade lane pins delegation only — see
// ../automationInfoBuilder.test.js header):
//   • THIS FILE: passive slice — passive_buff (+ fortified_health /
//     max_hp_increase renames), passive_immunity (snake→camel), resist/
//     crossbow/stealth/brawler/ritual/cantrip rules, thrall temp HP,
//     contact_patron_auto_save. 20 handlers, censored below.
//   • primal slice → primal.test.js · free_spell → spell.test.js ·
//     reaction_* → reaction.test.js · envelope assembly/null contract →
//     facade lane. featBuffService threading of ritual_spells →
//     src/services/character/featBuffService.ritualMaster.test.js (upstream
//     raw-row passthrough, not builder bytes — no overlap).
//
// Method: exact-bytes toEqual literals, hand-derived once from passive.js
// source (#820 golden-once, #943 field-set census — fabricated or missing
// keys fail). Builder unmocked (#791); handlers are pure so no timers,
// network, or mock infra needed.
//
// Old → new map (old per-field toBe chains missed absent/extra keys and
// asserted name/hasAutomation 19×):
//   generic contract loop (19)     → census + BARE exact defaults (test 1)
//   passive_buff defaults/custom   → BARE.passive_buff + passthrough table
//   max_hp_increase rename         → renames test (with fortified_health
//                                     falsifier: its envelope OMITS `range`)
//   casting_time loop (9)          → casting_time semantics test
//   ignore_resistance/_immunity/loading/ritual FT-068 → passthrough table

import { describe, it, expect } from 'vitest'
import { passiveHandlers } from './passive.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

const NAME = 'Test Feature'

// Hand-derived exact envelopes for a bare feature makeFeature({ type }).
// Pins: type renames, every default ('allies_in_range', '10_ft', 'passive',
// bonus 2, target 'self', []/false/null), hasAutomation, name forwarding,
// and the full key set of each handler.
const BARE = {
    passive_buff: {
        type: 'passive_buff',
        name: NAME,
        range: '',
        effect: '',
        target: 'allies_in_range',
        range_expression: '10_ft',
        bonusExpression: '',
        condition: '',
        conditionImmunity: '',
        resistances: [],
        options: [],
        extraMastery: [],
        replaceMastery: [],
        grantsFlySpeed: false,
        grantsSwimSpeed: false,
        resistanceType: [],
        validTypes: [],
        amount: 0,
        alsoSelfHealing: null,
        hasAutomation: true
    },
    ignore_resistance: {
        type: 'passive_rule',
        name: NAME,
        effect: 'ignore_resistance',
        damageTypes: [],
        hasAutomation: true
    },
    passive_immunity: {
        type: 'passive_immunity',
        name: NAME,
        target: 'self',
        conditionImmunity: '',
        damageResistance: [],
        saveAdvantage: [],
        hasAutomation: true
    },
    holy_nimbus_radiant_damage: {
        type: 'passive_rule',
        name: NAME,
        effect: 'holy_nimbus_radiant_damage',
        damageExpression: '',
        range: '',
        casting_time: '',
        hasAutomation: true
    },
    umbral_sight: {
        type: 'passive_rule',
        name: NAME,
        effect: 'umbral_sight',
        casting_time: 'passive',
        hasAutomation: true
    },
    supreme_sneak: {
        type: 'passive_rule',
        name: NAME,
        effect: 'supreme_sneak',
        casting_time: 'passive',
        hasAutomation: true
    },
    otherworldly_glamour: {
        type: 'passive_buff',
        name: NAME,
        effect: 'otherworldly_glamour',
        hasAutomation: true
    },
    create_thrall_temp_hp: {
        type: 'create_thrall_temp_hp',
        name: NAME,
        tempHpExpression: '',
        casting_time: 'passive',
        hasAutomation: true
    },
    ritual_spells: {
        type: 'passive_rule',
        name: NAME,
        effect: 'ritual_spells',
        casting_time: 'passive',
        chosenSpells: false,
        quickRitual: false,
        spellCastingAbility: '',
        hasAutomation: true
    },
    potent_cantrip: {
        type: 'potent_cantrip',
        name: NAME,
        effect: 'potent_cantrip',
        casting_time: 'passive',
        hasAutomation: true
    },
    soulstitch_spells: {
        type: 'soulstitch_spells',
        name: NAME,
        effect: 'soulstitch_spells',
        casting_time: 'passive',
        hasAutomation: true
    },
    empowered_evocation: {
        type: 'empowered_evocation',
        name: NAME,
        effect: 'empowered_evocation',
        casting_time: 'passive',
        hasAutomation: true
    },
    concentration_disadvantage_on_damage_dealt: {
        type: 'passive_rule',
        name: NAME,
        effect: 'concentration_disadvantage_on_damage_dealt',
        casting_time: 'passive',
        hasAutomation: true
    },
    tavern_brawler_reroll_ones: {
        type: 'passive_rule',
        name: NAME,
        effect: 'tavern_brawler_reroll_ones',
        casting_time: 'passive',
        hasAutomation: true
    },
    tavern_brawler_push: {
        type: 'passive_rule',
        name: NAME,
        effect: 'tavern_brawler_push',
        oncePerTurn: false,
        casting_time: 'passive',
        hasAutomation: true
    },
    ignore_loading_crossbows: {
        type: 'passive_rule',
        name: NAME,
        effect: 'ignore_loading_crossbows',
        weapons: [],
        casting_time: 'passive',
        hasAutomation: true
    },
    no_melee_disadvantage_crossbows: {
        type: 'passive_rule',
        name: NAME,
        effect: 'no_melee_disadvantage_crossbows',
        casting_time: 'passive',
        hasAutomation: true
    },
    naturally_stealthy: {
        type: 'passive_rule',
        name: NAME,
        effect: 'naturally_stealthy',
        casting_time: 'passive',
        hasAutomation: true
    },
    blessed_warrior: {
        type: 'passive_rule',
        name: NAME,
        effect: 'blessed_warrior',
        bonus: 2,
        hasAutomation: true
    },
    contact_patron_auto_save: {
        type: 'passive_rule',
        name: NAME,
        effect: 'contact_patron_auto_save',
        casting_time: 'passive',
        hasAutomation: true
    }
}

describe('passiveHandlers', () => {
    it('emits the exact default envelope for every handler (census of all 20)', () => {
        // Census (#781): a new passive handler that dodges this table fails here.
        expect(Object.keys(passiveHandlers).sort()).toEqual(Object.keys(BARE).sort())

        for (const [type, expected] of Object.entries(BARE)) {
            expect(passiveHandlers[type](makeFeature({ type }), BASE_STATS), type).toEqual(expected)
        }
    })

    it('renames passive_buff to passive_rule for max_hp_increase and fortified_health', () => {
        expect(passiveHandlers.passive_buff(
            makeFeature({ type: 'passive_buff', effect: 'max_hp_increase' }, 'Savage Fortitude'),
            BASE_STATS
        )).toEqual({ ...BARE.passive_buff, name: 'Savage Fortitude', type: 'passive_rule', effect: 'max_hp_increase' })

        // fortified_health routes to passive_rule but its branch OMITS `range`
        // — falsifier distinguishing the two passive_buff code paths.
        const fortified = passiveHandlers.passive_buff(
            makeFeature({ type: 'passive_buff', effect: 'fortified_health' }, 'Durable Spirit'),
            BASE_STATS
        )
        const fortifiedExpected = {
            ...BARE.passive_buff,
            name: 'Durable Spirit',
            type: 'passive_rule',
            effect: 'fortified_health'
        }
        delete fortifiedExpected.range
        expect(fortified).toEqual(fortifiedExpected)
        expect(fortified).not.toHaveProperty('range')
    })

    it('copies declared automation fields into the envelope verbatim', () => {
        const cases = [
            {
                // Every passive_buff field set at once — full custom exact bytes.
                feature: makeFeature({
                    type: 'passive_buff',
                    target: 'self',
                    effect: 'blindsight',
                    range: '60_ft',
                    range_expression: '60_ft',
                    bonusExpression: '+2',
                    condition: 'adjacent_to_enemy',
                    conditionImmunity: 'charmed',
                    resistances: ['fire', 'cold'],
                    options: ['darkness'],
                    extraMastery: ['serrated'],
                    replaceMastery: ['pushing'],
                    grantsFlySpeed: true,
                    grantsSwimSpeed: true,
                    resistanceType: ['fire'],
                    validTypes: ['fiend', 'undead'],
                    amount: 10,
                    alsoSelfHealing: { extraHealingExpression: '2d8' }
                }, 'Gloom Stalker'),
                expected: {
                    type: 'passive_buff',
                    name: 'Gloom Stalker',
                    range: '60_ft',
                    effect: 'blindsight',
                    target: 'self',
                    range_expression: '60_ft',
                    bonusExpression: '+2',
                    condition: 'adjacent_to_enemy',
                    conditionImmunity: 'charmed',
                    resistances: ['fire', 'cold'],
                    options: ['darkness'],
                    extraMastery: ['serrated'],
                    replaceMastery: ['pushing'],
                    grantsFlySpeed: true,
                    grantsSwimSpeed: true,
                    resistanceType: ['fire'],
                    validTypes: ['fiend', 'undead'],
                    amount: 10,
                    alsoSelfHealing: { extraHealingExpression: '2d8' },
                    hasAutomation: true
                }
            },
            {
                // bare `bonus` aliases into bonusExpression (and stays on `bonus`).
                feature: makeFeature({ type: 'passive_buff', effect: 'attack_bonus', bonus: 2 }, 'Blessed Strike'),
                expected: {
                    ...BARE.passive_buff,
                    name: 'Blessed Strike',
                    effect: 'attack_bonus',
                    bonusExpression: 2,
                    bonus: 2
                }
            },
            {
                feature: makeFeature({ type: 'ignore_resistance', damageTypes: ['fire', 'necrotic'] }, 'Elemental Adept'),
                expected: { ...BARE.ignore_resistance, name: 'Elemental Adept', damageTypes: ['fire', 'necrotic'] }
            },
            {
                // snake_case disk keys map to camelCase envelope keys.
                feature: makeFeature({
                    type: 'passive_immunity',
                    target: 'allies_in_range',
                    conditionImmunity: 'charmed frightened',
                    damage_resistance: ['fire', 'cold'],
                    save_advantage: [{ saveType: 'WIS', condition: 'against_fear' }]
                }, 'Aura of Immunity'),
                expected: {
                    type: 'passive_immunity',
                    name: 'Aura of Immunity',
                    target: 'allies_in_range',
                    conditionImmunity: 'charmed frightened',
                    damageResistance: ['fire', 'cold'],
                    saveAdvantage: [{ saveType: 'WIS', condition: 'against_fear' }],
                    hasAutomation: true
                }
            },
            {
                feature: makeFeature({
                    type: 'holy_nimbus_radiant_damage',
                    damageExpression: '2d6',
                    range: '5_ft',
                    casting_time: 'bonus action'
                }, 'Searing Aura'),
                expected: {
                    ...BARE.holy_nimbus_radiant_damage,
                    name: 'Searing Aura',
                    damageExpression: '2d6',
                    range: '5_ft',
                    casting_time: 'bonus action'
                }
            },
            {
                // No `effect` key on this envelope — absence pinned by exact bytes.
                feature: makeFeature({ type: 'create_thrall_temp_hp', tempHpExpression: '1d4+3', casting_time: 'action' }, 'Thrall Rite'),
                expected: { ...BARE.create_thrall_temp_hp, name: 'Thrall Rite', tempHpExpression: '1d4+3', casting_time: 'action' }
            },
            {
                feature: makeFeature({ type: 'tavern_brawler_push', oncePerTurn: true }, 'Barroom Bull Rush'),
                expected: { ...BARE.tavern_brawler_push, name: 'Barroom Bull Rush', oncePerTurn: true }
            },
            {
                feature: makeFeature({ type: 'ignore_loading_crossbows', weapons: ['heavy crossbow', 'loading crossbow'] }, 'Quick Draw'),
                expected: { ...BARE.ignore_loading_crossbows, name: 'Quick Draw', weapons: ['heavy crossbow', 'loading crossbow'] }
            },
            {
                feature: makeFeature({ type: 'blessed_warrior', bonus: 4 }, 'Divine Favor'),
                expected: { ...BARE.blessed_warrior, name: 'Divine Favor', bonus: 4 }
            },
            {
                // FT-068 ritual markers pass through; defaults stay pinned in BARE.
                feature: makeFeature({
                    type: 'ritual_spells',
                    chosenSpells: true,
                    quickRitual: true,
                    spellCastingAbility: 'Wisdom'
                }, 'Ritual Spells'),
                expected: {
                    ...BARE.ritual_spells,
                    name: 'Ritual Spells',
                    chosenSpells: true,
                    quickRitual: true,
                    spellCastingAbility: 'Wisdom'
                }
            }
        ]

        for (const { feature, expected } of cases) {
            expect(passiveHandlers[feature.automation.type](feature, BASE_STATS), feature.name).toEqual(expected)
        }
    })

    it('casting_time falls back to "passive" except on the two hardened handlers', () => {
        const FALLBACK = [
            'umbral_sight',
            'supreme_sneak',
            'ritual_spells',
            'potent_cantrip',
            'soulstitch_spells',
            'empowered_evocation',
            'concentration_disadvantage_on_damage_dealt',
            'tavern_brawler_push',
            'ignore_loading_crossbows',
            'no_melee_disadvantage_crossbows',
            'naturally_stealthy',
            'create_thrall_temp_hp'
        ]
        for (const type of FALLBACK) {
            const result = passiveHandlers[type](makeFeature({ type, casting_time: 'reaction' }), BASE_STATS)
            expect(result, type).toEqual({ ...BARE[type], casting_time: 'reaction' })
        }

        // Hardened: casting_time is hardcoded — declared data must NOT leak.
        expect(passiveHandlers.tavern_brawler_reroll_ones(
            makeFeature({ type: 'tavern_brawler_reroll_ones', casting_time: 'reaction' }, 'Savage Attacker'),
            BASE_STATS
        )).toEqual({ ...BARE.tavern_brawler_reroll_ones, name: 'Savage Attacker' })
        expect(passiveHandlers.contact_patron_auto_save(
            makeFeature({ type: 'contact_patron_auto_save', casting_time: 'reaction' }, 'Dark Bargain'),
            BASE_STATS
        )).toEqual({ ...BARE.contact_patron_auto_save, name: 'Dark Bargain' })
    })
})
