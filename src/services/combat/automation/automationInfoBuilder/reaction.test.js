// @maintained-by-ai
// ── reaction.test.js — automationInfoBuilder reaction slice (lane #952 template) ──
// reactionHandlers builder contract: census guard + exact bare defaults +
// full-custom passthrough + derived-numeric behavior + name/null-automation
// loops for all 16 handlers. Zero mocks (#791) — all handlers are pure.
//
// Builder family map (facade automationInfoBuilder.js spreads domain maps;
// unit lanes pin per-type values, facade lane pins delegation only):
//   • THIS FILE: the 16 reactionHandlers in reaction.js — census (#952) so a
//     new handler cannot dodge the matrix, exact bare-default envelopes for
//     the 14 self-owned handlers (toEqual catches extra/dropped keys the old
//     toHaveProperty loop could not), full-custom verbatim passthrough with
//     every custom value DIFFERENT from its default (#954 non-vacuity rule),
//     and the shared expression/scaling/??-vs-|| discriminators (#953).
//   • protection + shield exact envelopes (incl. hardcoded requiresShield:true
//     vs declared false/0/'' and non-vacuous shield casting_time) →
//     protection.test.js (#954) — the old per-handler blocks here were
//     byte-superseded there and are cut.
//   • interception exact default/full-custom envelopes (!! coercion, prof||0,
//     damageBonus labels) → interception.test.js (its synthetic prof 2 pins
//     non-vacuously; the BASE prof-3 bare leg here is the census pin) —
//     old interception full-custom/damageBonus dupes cut.
//   • interception runtime store writes → reactions/interceptionHandler.target
//     Effects.test.js (#948) — different module, cited not re-driven.
//
// Old → new map (old file: 16 registerStandardTests blocks ≈ 78 its):
//   defaults loops ×16 (toHaveProperty)   → census + BARE exact loop (test 1)
//   name loops ×16                        → single name loop (test 7)
//   throw loops ×16                     → single null-automation loop (test 8)
//   per-handler passthrough its ×13     → one full-custom exact table (test 2)
//   scaling/saveDc/uses_expression its  → expression resolution table (test 3)
//   acBonus clamp/scale + saveBonus its → CHA-derived test (test 4)
//   sentinel attack-selection its ×5    → one stats-table test (test 5)
//   (none)                              → NEW ?? vs || zero-preservation pins
//                                         (#953: searing keeps 0; others coerce)
//   protection custom + requiresShield, shield vacuous casting_time,
//   interception full-custom + damageBonus-prof → cut, citing owners above

import { describe, it, expect } from 'vitest'
import { reactionHandlers } from './reaction.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

const NAME = 'Test Feature'

// Handlers whose exact envelopes are owned by protection.test.js (#954);
// this lane pins only their census membership, name propagation and
// null-automation contract. All other handlers are pinned exactly below.
const ENVELOPE_OWNED_ELSEWHERE = ['protection', 'shield']

// Hand-derived exact envelopes for a bare feature makeFeature({ type })
// against BASE_STATS (level 5, proficiency 3, CHA 2, WIS 5, CON 3, STR 4).
// Pins every default, the full key set, name forwarding and hasAutomation.
const BARE = {
    reaction_bonus: {
        type: 'reaction_bonus',
        name: NAME,
        trigger: '',
        bonusExpression: '',
        condition: '',
        selfMovement: '',
        allyMovement: '',
        allyRange: '30 ft',
        noOAs: false,
        resourceCost: '',
        effect: '',
        saveType: '',
        saveDc: '',
        duration: '',
        casting_time: '1 reaction',
        hasAutomation: true
    },
    reaction_damage: {
        type: 'reaction_damage',
        name: NAME,
        trigger: '',
        damageExpression: '',
        damageType: '',
        saveType: null,
        saveDc: null,
        saveAbility: 'WIS',
        alsoInflicts: null,
        resourceCost: null,
        range: '5_ft',
        casting_time: '1 reaction',
        effect: null,
        hasAutomation: true
    },
    reaction_debuff: {
        type: 'reaction_debuff',
        name: NAME,
        trigger: '',
        debuffExpression: '',
        subtractive: false,
        effect: '',
        uses_expression: '',
        usesMax: 0,
        recharge: 'long_rest',
        range: '60_ft',
        casting_time: '1 reaction',
        triggerTypes: ['attack_roll', 'damage_roll', 'ability_check'],
        hasAutomation: true
    },
    reaction_save: {
        type: 'reaction_save',
        name: NAME,
        trigger: '',
        saveType: 'WIS',
        saveDc: 'ability',
        saveAbility: 'CHA',
        condition: '',
        duration: '',
        range: '120_ft',
        casting_time: '1 reaction',
        target: 'different_creature',
        hasAutomation: true
    },
    shadowy_dodge: {
        type: 'shadowy_dodge',
        name: NAME,
        range: '30_ft',
        casting_time: '1 reaction',
        hasAutomation: true
    },
    glorious_defense: {
        type: 'glorious_defense',
        name: NAME,
        acBonusExpression: 'Math.max(1, CHA modifier)',
        acBonus: 2,
        usesMax: 2,
        range: '10_ft',
        trigger: '',
        casting_time: '1 reaction',
        hasAutomation: true
    },
    beguiling_defenses: {
        type: 'beguiling_defenses',
        name: NAME,
        saveType: 'WIS',
        saveDc: null,
        saveAbility: 'CHA',
        damageType: 'Psychic',
        uses: 1,
        recharge: 'long_rest',
        pactMagicRecharge: false,
        casting_time: '1 reaction',
        hasAutomation: true
    },
    searing_vengeance: {
        type: 'searing_vengeance',
        name: NAME,
        healExpression: '',
        damageExpression: '',
        damageType: 'Radiant',
        range: '30_ft',
        condition: 'blinded',
        conditionDuration: 'until_end_of_current_turn',
        trigger: 'death_save_by_ally_or_self',
        allyRange: '60_ft',
        uses: 1,
        usesMax: 1,
        recharge: 'long_rest',
        casting_time: '1 reaction',
        hasAutomation: true
    },
    illusory_self: {
        type: 'illusory_self',
        name: NAME,
        trigger: 'attack_hit',
        uses: 1,
        recharge: 'short_or_long_rest',
        spellSlotRestore: null,
        casting_time: '1 reaction',
        hasAutomation: true
    },
    reaction_counterspell: {
        type: 'reaction_counterspell',
        name: NAME,
        trigger: 'creature_casting_spell',
        saveType: 'CON',
        saveDc: 'ability',
        saveAbility: 'CHA',
        saveBonus: 13,
        range: '60 ft',
        casting_time: '1 reaction',
        hasAutomation: true
    },
    lucky_point: {
        type: 'lucky_point',
        name: NAME,
        effect: 'advantage',
        target: 'd20',
        cost: 1,
        casting_time: 'reaction',
        hasAutomation: true
    },
    reaction_spell: {
        type: 'reaction_spell',
        name: NAME,
        trigger: '',
        casting_time: '1 reaction',
        hasAutomation: true
    },
    sentinel_guardian: {
        type: 'sentinel_guardian',
        name: NAME,
        trigger: 'creature_disengages_or_hits_other_within_5ft',
        range: '5_ft',
        oaType: 'any_attack_miss_or_disengage',
        casting_time: '1 reaction',
        attack: null,
        hasAutomation: true
    },
    dread_ambush_damage: {
        type: 'dread_ambush_damage',
        name: NAME,
        trigger: '',
        damageExpression: '2d6',
        damageType: 'Psychic',
        oncePerTurn: false,
        uses_expression: '',
        usesMax: 1,
        recharge: 'long_rest',
        casting_time: '1 reaction',
        hasAutomation: true
    },
    interception: {
        type: 'interception',
        name: NAME,
        trigger: 'ally_within_5ft_attacked',
        range: '5_ft',
        damageExpression: '1d10',
        damageType: '',
        damageBonusExpression: 'proficiency_bonus',
        damageBonus: 3,
        requiresShield: false,
        casting_time: '1 reaction',
        hasAutomation: true
    }
}

describe('reactionHandlers', () => {
    it('emits the exact default envelope for every self-owned handler (census)', () => {
        // Census (#952): a new reaction handler added to neither table fails here.
        expect(Object.keys(reactionHandlers).sort()).toEqual(
            [...Object.keys(BARE), ...ENVELOPE_OWNED_ELSEWHERE].sort()
        )

        for (const [type, expected] of Object.entries(BARE)) {
            expect(reactionHandlers[type](makeFeature({ type }), BASE_STATS), type).toEqual(expected)
        }
    })

    it('copies every custom field verbatim into the exact envelope (#954: all values differ from defaults)', () => {
        // interception full-custom is owned by interception.test.js — not re-driven.
        const cases = [
            {
                feature: makeFeature({
                    type: 'reaction_bonus',
                    trigger: 'after_ally_hit',
                    bonusExpression: '+1d4+2',
                    condition: 'target_within_5ft',
                    selfMovement: '15 ft',
                    allyMovement: '20 ft',
                    allyRange: '60 ft',
                    noOAs: true,
                    resourceCost: '1 ki point',
                    effect: 'push_back',
                    saveType: 'STR',
                    saveDc: 15,
                    duration: '2_rounds',
                    casting_time: 'free reaction'
                }, 'Riposte Bonus'),
                expected: {
                    ...BARE.reaction_bonus,
                    name: 'Riposte Bonus',
                    trigger: 'after_ally_hit',
                    bonusExpression: '+1d4+2',
                    condition: 'target_within_5ft',
                    selfMovement: '15 ft',
                    allyMovement: '20 ft',
                    allyRange: '60 ft',
                    noOAs: true,
                    resourceCost: '1 ki point',
                    effect: 'push_back',
                    saveType: 'STR',
                    saveDc: 15,
                    duration: '2_rounds',
                    casting_time: 'free reaction'
                }
            },
            {
                feature: makeFeature({
                    type: 'reaction_damage',
                    trigger: 'after_ally_damaged',
                    damageExpression: '4d8',
                    damageType: 'Necrotic',
                    saveType: 'DEX',
                    saveDc: 17,
                    saveAbility: 'INT',
                    alsoInflicts: 'restrained',
                    resourceCost: '1 superiority die',
                    range: '30_ft',
                    effect: 'knock_prone',
                    casting_time: '2 reactions'
                }, 'Vengeance Strike'),
                expected: {
                    ...BARE.reaction_damage,
                    name: 'Vengeance Strike',
                    trigger: 'after_ally_damaged',
                    damageExpression: '4d8',
                    damageType: 'Necrotic',
                    saveType: 'DEX',
                    saveDc: 17,
                    saveAbility: 'INT',
                    alsoInflicts: 'restrained',
                    resourceCost: '1 superiority die',
                    range: '30_ft',
                    effect: 'knock_prone',
                    casting_time: '2 reactions'
                }
            },
            {
                // uses_expression is copied AND evaluated into usesMax.
                feature: makeFeature({
                    type: 'reaction_debuff',
                    trigger: 'after_attack_miss',
                    debuffExpression: '-1d4',
                    subtractive: true,
                    effect: 'disadvantage',
                    uses_expression: 'level',
                    recharge: 'short_rest',
                    range: '30_ft',
                    casting_time: 'free reaction'
                }, 'Hexing Retort'),
                expected: {
                    ...BARE.reaction_debuff,
                    name: 'Hexing Retort',
                    trigger: 'after_attack_miss',
                    debuffExpression: '-1d4',
                    subtractive: true,
                    effect: 'disadvantage',
                    uses_expression: 'level',
                    usesMax: 5,
                    recharge: 'short_rest',
                    range: '30_ft',
                    casting_time: 'free reaction'
                }
            },
            {
                feature: makeFeature({
                    type: 'reaction_save',
                    trigger: 'ally_save_fails',
                    saveType: 'CON',
                    saveDc: 18,
                    saveAbility: 'INT',
                    condition: 'frightened',
                    duration: '3_rounds',
                    range: '30_ft',
                    target: 'self',
                    casting_time: 'free reaction'
                }, 'Warding Word'),
                expected: {
                    ...BARE.reaction_save,
                    name: 'Warding Word',
                    trigger: 'ally_save_fails',
                    saveType: 'CON',
                    saveDc: 18,
                    saveAbility: 'INT',
                    condition: 'frightened',
                    duration: '3_rounds',
                    range: '30_ft',
                    target: 'self',
                    casting_time: 'free reaction'
                }
            },
            {
                feature: makeFeature({ type: 'shadowy_dodge', range: '60_ft', casting_time: 'immediate' }, 'Shadow Fade'),
                expected: { ...BARE.shadowy_dodge, name: 'Shadow Fade', range: '60_ft', casting_time: 'immediate' }
            },
            {
                // acBonus/usesMax stay CHA-derived (2) despite custom labels.
                feature: makeFeature({
                    type: 'glorious_defense',
                    range: '15_ft',
                    trigger: 'after_attack_missed',
                    casting_time: 'immediate'
                }, 'Glorious Defense'),
                expected: {
                    ...BARE.glorious_defense,
                    name: 'Glorious Defense',
                    range: '15_ft',
                    trigger: 'after_attack_missed',
                    casting_time: 'immediate'
                }
            },
            {
                // numeric saveDc copied verbatim (the 'ability' leg is in test 3).
                feature: makeFeature({
                    type: 'beguiling_defenses',
                    saveType: 'CON',
                    saveDc: 15,
                    saveAbility: 'INT',
                    damageType: 'Thunder',
                    uses: 3,
                    recharge: 'short_rest',
                    pactMagicRecharge: true,
                    casting_time: 'immediate'
                }, 'Beguiling defenses'),
                expected: {
                    ...BARE.beguiling_defenses,
                    name: 'Beguiling defenses',
                    saveType: 'CON',
                    saveDc: 15,
                    saveAbility: 'INT',
                    damageType: 'Thunder',
                    uses: 3,
                    recharge: 'short_rest',
                    pactMagicRecharge: true,
                    casting_time: 'immediate'
                }
            },
            {
                // uses mirrors into usesMax (test 6 pins the uses:0 leg).
                feature: makeFeature({
                    type: 'searing_vengeance',
                    healExpression: '2d8',
                    damageExpression: '3d6',
                    damageType: 'Fire',
                    range: '60_ft',
                    condition: 'burning',
                    conditionDuration: '1_round',
                    trigger: 'ally_death',
                    allyRange: '30_ft',
                    uses: 2,
                    recharge: 'short_rest',
                    casting_time: 'immediate'
                }, 'Searing Vengeance'),
                expected: {
                    ...BARE.searing_vengeance,
                    name: 'Searing Vengeance',
                    healExpression: '2d8',
                    damageExpression: '3d6',
                    damageType: 'Fire',
                    range: '60_ft',
                    condition: 'burning',
                    conditionDuration: '1_round',
                    trigger: 'ally_death',
                    allyRange: '30_ft',
                    uses: 2,
                    usesMax: 2,
                    recharge: 'short_rest',
                    casting_time: 'immediate'
                }
            },
            {
                feature: makeFeature({
                    type: 'illusory_self',
                    trigger: 'missed_attack',
                    uses: 2,
                    recharge: 'long_rest',
                    spellSlotRestore: 1,
                    casting_time: 'immediate'
                }, 'Illusory Self'),
                expected: {
                    ...BARE.illusory_self,
                    name: 'Illusory Self',
                    trigger: 'missed_attack',
                    uses: 2,
                    recharge: 'long_rest',
                    spellSlotRestore: 1,
                    casting_time: 'immediate'
                }
            },
            {
                // saveBonus stays fixed by the builder (8 + CHA 2 + prof 3).
                feature: makeFeature({
                    type: 'reaction_counterspell',
                    trigger: 'spell_cast_in_range',
                    saveType: 'WIS',
                    saveDc: 15,
                    saveAbility: 'INT',
                    range: '120 ft',
                    casting_time: 'immediate'
                }, 'Counterspell'),
                expected: {
                    ...BARE.reaction_counterspell,
                    name: 'Counterspell',
                    trigger: 'spell_cast_in_range',
                    saveType: 'WIS',
                    saveDc: 15,
                    saveAbility: 'INT',
                    range: '120 ft',
                    casting_time: 'immediate'
                }
            },
            {
                feature: makeFeature({
                    type: 'lucky_point',
                    effect: 'reroll',
                    target: 'attack_roll',
                    cost: 2,
                    casting_time: 'bonus action'
                }, 'Lucky Point'),
                expected: {
                    ...BARE.lucky_point,
                    name: 'Lucky Point',
                    effect: 'reroll',
                    target: 'attack_roll',
                    cost: 2,
                    casting_time: 'bonus action'
                }
            },
            {
                feature: makeFeature({ type: 'reaction_spell', trigger: 'after_spell_cast', casting_time: 'free reaction' }, 'Counterspell Slot'),
                expected: { ...BARE.reaction_spell, name: 'Counterspell Slot', trigger: 'after_spell_cast', casting_time: 'free reaction' }
            },
            {
                // oncePerTurn rides !! — declared true copies through.
                feature: makeFeature({
                    type: 'dread_ambush_damage',
                    trigger: 'surprise_round',
                    damageType: 'Necrotic',
                    oncePerTurn: true,
                    recharge: 'short_rest',
                    casting_time: 'immediate'
                }, 'Dread Ambusher'),
                expected: {
                    ...BARE.dread_ambush_damage,
                    name: 'Dread Ambusher',
                    trigger: 'surprise_round',
                    damageType: 'Necrotic',
                    oncePerTurn: true,
                    recharge: 'short_rest',
                    casting_time: 'immediate'
                }
            },
            {
                // oaType/trigger/range custom; no attacks on BASE_STATS → attack null.
                feature: makeFeature({
                    type: 'sentinel_guardian',
                    trigger: 'after_miss',
                    range: '10_ft',
                    oaType: 'missed_attack',
                    casting_time: 'immediate'
                }, 'Sentinel Guardian'),
                expected: {
                    ...BARE.sentinel_guardian,
                    name: 'Sentinel Guardian',
                    trigger: 'after_miss',
                    range: '10_ft',
                    oaType: 'missed_attack',
                    casting_time: 'immediate'
                }
            }
        ]

        for (const { feature, expected } of cases) {
            expect(reactionHandlers[feature.automation.type](feature, BASE_STATS), feature.name).toEqual(expected)
        }
    })

    it('resolves expressions to numbers and applies level scaling at boundaries', () => {
        // Damage scaling (resolveScaledExpr, two handlers with different fallbacks).
        const scalingCases = [
            ['reaction_damage', '1d6', { 5: '2d6', 11: '3d6' }, ['1d6', '2d6', '3d6']],
            ['dread_ambush_damage', '2d6', { 5: '3d6', 11: '4d6' }, ['2d6', '3d6', '4d6']]
        ]
        for (const [type, base, scaling, expectedByLevel] of scalingCases) {
            const feature = makeFeature({ type, damageExpression: base, scaling })
            const byLevel = [1, 5, 11].map(level =>
                reactionHandlers[type](feature, { ...BASE_STATS, level }).damageExpression
            )
            expect(byLevel, type).toEqual(expectedByLevel)
        }

        // saveDc: numeric wins over expression; 'ability' derives from saveAbility
        // (default WIS 8+5+3=16, CON 8+3+3=14); expression only when saveDc falsy.
        const dc = (auto) => reactionHandlers.reaction_damage(makeFeature({ type: 'reaction_damage', ...auto }), BASE_STATS).saveDc
        expect(dc({ saveDcExpression: 'proficiency_bonus' })).toBe(3)
        expect(dc({ saveDc: 'ability' })).toBe(16)
        expect(dc({ saveDc: 'ability', saveAbility: 'CON' })).toBe(14)
        expect(dc({ saveDc: 18, saveDcExpression: 'proficiency_bonus' })).toBe(18)

        // beguiling_defenses computes its own DC from saveAbility (default CHA 13).
        const bdc = (saveAbility) => reactionHandlers.beguiling_defenses(
            makeFeature({ type: 'beguiling_defenses', saveDc: 'ability', saveAbility }), BASE_STATS
        ).saveDc
        expect(bdc(undefined)).toBe(13)
        expect(bdc('STR')).toBe(15)

        // uses_expression → usesMax, both consumers (absent-expression fallbacks
        // 0 and 1 are pinned in BARE).
        const usesMax = (type) => reactionHandlers[type](makeFeature({ type, uses_expression: 'proficiency_bonus' }), BASE_STATS).usesMax
        expect(usesMax('reaction_debuff')).toBe(3)
        expect(usesMax('dread_ambush_damage')).toBe(3)
        expect(reactionHandlers.reaction_debuff(makeFeature({ type: 'reaction_debuff', uses_expression: 'level' }), BASE_STATS).usesMax).toBe(5)
    })

    it('derives CHA-based bonuses and clamps the Charisma minimum', () => {
        const glorious = (stats) => reactionHandlers.glorious_defense(makeFeature({ type: 'glorious_defense' }), stats)
        const cha = (bonus) => ({ ...BASE_STATS, abilities: [{ name: 'Charisma', bonus }] })

        // Math.max(1, CHA): zero, negative and missing CHA clamp to 1/1.
        for (const stats of [cha(0), cha(-3), { ...BASE_STATS, abilities: undefined }]) {
            const result = glorious(stats)
            expect(result.acBonus).toBe(1)
            expect(result.usesMax).toBe(1)
        }

        const high = glorious(cha(5))
        expect(high.acBonus).toBe(5)
        expect(high.usesMax).toBe(5)

        // counterspell saveBonus = 8 + CHA + proficiency, never undefined legs.
        const csBonus = (stats) => reactionHandlers.reaction_counterspell(makeFeature({ type: 'reaction_counterspell' }), stats).saveBonus
        expect(csBonus(BASE_STATS)).toBe(13)
        expect(csBonus(cha(0))).toBe(11)
        expect(csBonus({ ...BASE_STATS, abilities: undefined })).toBe(11)
        expect(csBonus({ level: 5, abilities: BASE_STATS.abilities })).toBe(10)
    })

    it('selects the attack: first Action melee, else first attack, else null', () => {
        const pick = (attacks) => reactionHandlers.sentinel_guardian(
            makeFeature({ type: 'sentinel_guardian' }),
            attacks === undefined ? BASE_STATS : { ...BASE_STATS, attacks }
        ).attack

        // Action melee wins over ranged and over Bonus Action melee.
        expect(pick([
            { type: 'Action', range: 'melee', name: 'Longsword' },
            { type: 'Action', range: 'ranged', name: 'Longbow' }
        ]).name).toBe('Longsword')
        expect(pick([
            { type: 'Bonus Action', range: 'melee', name: 'Off-hand' },
            { type: 'Action', range: 'melee', name: 'Greataxe' }
        ]).name).toBe('Greataxe')
        // No melee → first attack of any kind; empty/missing → null.
        expect(pick([{ type: 'Action', range: 'ranged', name: 'Longbow' }]).name).toBe('Longbow')
        expect(pick([])).toBeNull()
        expect(pick(undefined)).toBeNull()
    })

    it('zero-valued fields: ?? keeps 0, while || and !! sites coerce to defaults', () => {
        // searing_vengeance uses `??` — a declared 0 must survive (#953 leg).
        expect(reactionHandlers.searing_vengeance(
            makeFeature({ type: 'searing_vengeance', uses: 0 }), BASE_STATS
        )).toEqual({ ...BARE.searing_vengeance, uses: 0, usesMax: 0 })

        // || sites fall back to 1 on zero — exact-equal-to-BARE falsifies a ?? refactor.
        expect(reactionHandlers.illusory_self(
            makeFeature({ type: 'illusory_self', uses: 0 }), BASE_STATS
        )).toEqual(BARE.illusory_self)
        expect(reactionHandlers.beguiling_defenses(
            makeFeature({ type: 'beguiling_defenses', uses: 0 }), BASE_STATS
        )).toEqual(BARE.beguiling_defenses)
        expect(reactionHandlers.lucky_point(
            makeFeature({ type: 'lucky_point', cost: 0 }), BASE_STATS
        )).toEqual(BARE.lucky_point)

        // !! sites flatten zero to false (not 0).
        expect(reactionHandlers.dread_ambush_damage(
            makeFeature({ type: 'dread_ambush_damage', oncePerTurn: 0 }), BASE_STATS
        ).oncePerTurn).toBe(false)
        expect(reactionHandlers.reaction_bonus(
            makeFeature({ type: 'reaction_bonus', noOAs: 0 }), BASE_STATS
        ).noOAs).toBe(false)
    })

    it('forwards feature.name for every handler', () => {
        const keys = [...Object.keys(BARE), ...ENVELOPE_OWNED_ELSEWHERE]
        for (const type of keys) {
            const feature = makeFeature({ type }, `Custom ${type}`)
            expect(reactionHandlers[type](feature, BASE_STATS).name, type).toBe(`Custom ${type}`)
        }
    })

    it('throws TypeError for every handler when automation is null or undefined', () => {
        const keys = [...Object.keys(BARE), ...ENVELOPE_OWNED_ELSEWHERE]
        for (const type of keys) {
            expect(() => reactionHandlers[type]({ name: NAME, automation: null }, BASE_STATS), `${type} null`).toThrow(TypeError)
            expect(() => reactionHandlers[type]({ name: NAME }, BASE_STATS), `${type} undefined`).toThrow(TypeError)
        }
    })
})
