// @maintained-by-ai
// ── save.test.js — automationInfoBuilder save slice (lane #952 template) ──
// saveHandlers builder contract: census guard + exact BARE default envelopes +
// full-custom verbatim passthrough (all customs ≠ defaults, #954) + saveDc
// fallback/coercion loop + expression/scaling/uses/casting_time goldens +
// name/null-automation loops for all 18 handlers. Zero mocks (#791) — all
// handlers are pure; REAL automationExpressions evaluators used locally with
// hand-derived literals (#820 golden-once, #710 no formula oracle).
//
// THIS lane pins BUILDER OUTPUT BYTES only (saveType/saveDc/envelope keys).
// SAVE EXECUTION (roll vs DC resolution, save-for-half math, condition
// application) is owned elsewhere — cited, never re-driven here:
//   • saveProcessing lanes #943/#944 · rollConditionSaveHandler #847 ·
//     saveResultHandlers #871 · facade delegation → automationInfoBuilder.test.js
//   • sharing lanes: protection #954 · psionic #955 · reaction #956 ·
//     resource #957 (census + BARE loop + custom≠default + coercion legs).
//
// Old → new map (old file: ~70 per-handler its → 9 tests):
//   per-handler 'returns correct defaults' ×18 + saveType-default its ×18 +
//   makeSaveDcTests saveType legs ×17    → census + BARE exact loop (test 1)
//   per-handler 'passes through custom' ×12 + duration-override its → one
//   full-custom exact table with hardcoded-override & unread-key DROP pins
//   (flesh_to_stone/hold_monster/ottos_dance/power_word_stun/imprisonment
//   customs are silently dropped — falsifiable #842) (test 2)
//   per-handler 'resolves saveDc' ×19    → saveDc loop over all 18 handlers
//   incl. 0/''/numeric coercion legs + charm_person hardcoded-WIS pin (#953
//   ?? vs || sites: no ?? here — every 0 collapses, pinned per handler)
//   (test 3)
//   scaling/heal/object-map CLA-208 ×7   → expression goldens table (test 4),
//   incl. prismatic_spray non-resolver differential pin (save.js:298-299)
//   wild_shape/resolveUses its ×2        → uses table (test 5)
//   casting_time/action ×2 + priority ×2 → one shared table (test 6)
//   hasOptions-false explicit, forcecage !! → boolean coercion test (test 7)
//   (none)                               → NEW name loop (test 8), null-throw
//                                        loop (test 9)

import { describe, it, expect } from 'vitest'
import { saveHandlers } from './save.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

const NAME = 'Test Feature'
const CONCENTRATION = 'Concentration, up to 1 minute'

// Hand-derived exact envelopes for a bare feature makeFeature({ type })
// against BASE_STATS (level 5, proficiency 3, STR 4 DEX 2 CON 3 INT 1
// WIS 5 CHA 2). Pins every default, the full key set (extra/dropped keys
// fail), name forwarding and hasAutomation.
const BARE = {
    save_attack: {
        type: 'save_attack',
        name: NAME,
        action: 'action',
        damage: '',
        saveDc: 10,
        uses: 5,
        usesMax: 5,
        hasOptions: false,
        healExpression: '',
        casting_time: '',
        damageType: '',
        saveType: 'DEX',
        saveAbility: 'CON',
        shape: '',
        range: '',
        conditionInflicted: null,
        duration: '',
        recharge: 'long_rest',
        resourceCost: '',
        options: [],
        optionDetails: {},
        dcSuccess: null,
        hasAutomation: true
    },
    elemental_burst: {
        type: 'elemental_burst',
        name: NAME,
        action: 'action',
        damage: '',
        damageType: '',
        saveType: 'DEX',
        saveDc: 10,
        saveAbility: 'CON',
        shape: '',
        range: '',
        conditionInflicted: null,
        duration: '',
        uses: 5,
        usesMax: 5,
        recharge: 'long_rest',
        resourceCost: 'focus_points',
        hasOptions: false,
        options: [],
        optionDetails: {},
        healExpression: '',
        dcSuccess: null,
        casting_time: '',
        hasAutomation: true
    },
    save_only: {
        type: 'save_only',
        name: NAME,
        saveType: 'DEX',
        saveDc: 10,
        conditionInflicted: null,
        duration: '',
        successEffect: null,
        hasAutomation: true
    },
    charm_person: {
        type: 'charm_person',
        name: NAME,
        saveType: 'WIS',
        saveDc: 10,
        range: '',
        duration: '',
        hasAutomation: true
    },
    flesh_to_stone: {
        type: 'flesh_to_stone',
        name: NAME,
        saveType: 'CON',
        saveDc: 10,
        conditionInflicted: 'restrained',
        duration: CONCENTRATION,
        hasAutomation: true
    },
    hold_monster: {
        type: 'hold_monster',
        name: NAME,
        saveType: 'WIS',
        saveDc: 10,
        conditionInflicted: 'paralyzed',
        duration: CONCENTRATION,
        hasAutomation: true
    },
    banishment: {
        type: 'banishment',
        name: NAME,
        saveType: 'CHA',
        saveDc: 10,
        conditionInflicted: 'incapacitated',
        duration: CONCENTRATION,
        range: '',
        hasAutomation: true
    },
    resilient_sphere: {
        type: 'resilient_sphere',
        name: NAME,
        saveType: 'DEX',
        saveDc: 10,
        duration: CONCENTRATION,
        hasAutomation: true
    },
    ottos_dance: {
        type: 'ottos_dance',
        name: NAME,
        saveType: 'WIS',
        saveDc: 10,
        duration: CONCENTRATION,
        hasAutomation: true
    },
    power_word_stun: {
        type: 'power_word_stun',
        name: NAME,
        saveType: 'CON',
        saveDc: 10,
        hasAutomation: true
    },
    sleep: {
        type: 'sleep',
        name: NAME,
        saveType: 'WIS',
        saveDc: 10,
        conditionInflicted: 'incapacitated',
        duration: '',
        hasAutomation: true
    },
    stinking_cloud: {
        type: 'stinking_cloud',
        name: NAME,
        saveType: 'CON',
        saveDc: 10,
        conditionInflicted: 'poisoned',
        duration: '',
        hasAutomation: true
    },
    sleet_storm: {
        type: 'sleet_storm',
        name: NAME,
        saveType: 'DEX',
        saveDc: 10,
        conditionInflicted: 'prone',
        duration: '',
        hasAutomation: true
    },
    confusion: {
        type: 'confusion',
        name: NAME,
        saveType: 'WIS',
        saveDc: 10,
        conditionInflicted: 'charmed',
        duration: CONCENTRATION,
        hasAutomation: true
    },
    tashas_laughter: {
        type: 'tashas_laughter',
        name: NAME,
        saveType: 'WIS',
        saveDc: 10,
        conditionInflicted: ['prone', 'incapacitated'],
        duration: '',
        hasAutomation: true
    },
    imprisonment: {
        type: 'imprisonment',
        name: NAME,
        saveType: 'WIS',
        saveDc: 10,
        duration: 'Until dispelled',
        options: [],
        hasAutomation: true
    },
    prismatic_spray: {
        type: 'prismatic_spray',
        name: NAME,
        saveType: 'DEX',
        saveDc: 10,
        damage: '10d6',
        hasAutomation: true
    },
    forcecage: {
        type: 'forcecage',
        name: NAME,
        saveType: 'CHA',
        saveDc: 10,
        duration: 'Concentration, up to 1 hour',
        concentration: false,
        ruleset: '5e',
        hasAutomation: true
    }
}

const TYPES = Object.keys(BARE)

// 'ability'-derived saveDc per handler from its HARDCODED fallback ability
// (8 + mod + prof 3): CON→14, WIS→16, DEX/CHA→13. charm_person is excluded
// — its branch hardcodes WIS and never reads saveAbility (pinned separately).
const ABILITY_DC = {
    save_attack: 14, elemental_burst: 14, save_only: 14, flesh_to_stone: 14,
    power_word_stun: 14, stinking_cloud: 14, hold_monster: 16, ottos_dance: 16,
    sleep: 16, confusion: 16, tashas_laughter: 16, imprisonment: 16,
    resilient_sphere: 13, sleet_storm: 13, prismatic_spray: 13,
    banishment: 13, forcecage: 13
}

describe('saveHandlers', () => {
    it('emits the exact default envelope for every handler (census of all 18)', () => {
        // Census (#952): a new save handler added to neither table fails here.
        expect(Object.keys(saveHandlers).sort()).toEqual(TYPES.slice().sort())

        for (const type of TYPES) {
            expect(saveHandlers[type](makeFeature({ type }), BASE_STATS), type).toEqual(BARE[type])
        }
    })

    it('copies declared fields verbatim, drops unread/hardcoded keys (all customs ≠ defaults)', () => {
        const cases = [
            {
                // save_attack full custom: every field differs from BARE; token
                // 'proficiency_bonus' resolves to 3; unread key must not leak.
                feature: makeFeature({
                    type: 'save_attack', action: 'reaction', damage: '2d6 + proficiency_bonus',
                    damageType: 'Fire', saveType: 'CON', saveAbility: 'WIS', shape: 'cone',
                    range: '15_ft', conditionInflicted: 'poisoned', duration: '1_round',
                    uses: 7, recharge: 'short_rest', resourceCost: 'spell_slot', hasOptions: true,
                    options: [{ name: 'Option A' }], optionDetails: { 'Option A': { effect: 'extra' } },
                    dcSuccess: 'no effect', casting_time: '1 bonus action', unknownKey: 'leak?'
                }, 'Draconic Fury'),
                expected: {
                    ...BARE.save_attack, name: 'Draconic Fury', action: 'reaction',
                    damage: '2d6 + 3', damageType: 'Fire', saveType: 'CON', saveAbility: 'WIS',
                    shape: 'cone', range: '15_ft', conditionInflicted: 'poisoned',
                    duration: '1_round', uses: 7, usesMax: 7, recharge: 'short_rest',
                    resourceCost: 'spell_slot', hasOptions: true,
                    options: [{ name: 'Option A' }], optionDetails: { 'Option A': { effect: 'extra' } },
                    dcSuccess: 'no effect', casting_time: '1 bonus action'
                }
            },
            {
                // elemental_burst: hasOptions/options/uses/recharge/resourceCost/
                // healExpression are HARDCODED — every custom here is dropped.
                feature: makeFeature({
                    type: 'elemental_burst', action: 'bonus_action', damage: '3d6',
                    damageType: 'Cold', saveType: 'CON', saveAbility: 'INT', shape: 'sphere',
                    range: '30_ft', conditionInflicted: 'stunned', duration: '2_rounds',
                    uses: 9, recharge: 'short_rest', resourceCost: 'spell_slot', hasOptions: true,
                    options: [{ name: 'Nope' }], healExpression: '1d4', dcSuccess: 'half',
                    casting_time: '1 action'
                }, 'Elemental Burst'),
                expected: {
                    ...BARE.elemental_burst, name: 'Elemental Burst', action: 'bonus_action',
                    damage: '3d6', damageType: 'Cold', saveType: 'CON', saveAbility: 'INT',
                    shape: 'sphere', range: '30_ft', conditionInflicted: 'stunned',
                    duration: '2_rounds', dcSuccess: 'half', casting_time: '1 action'
                }
            },
            {
                feature: makeFeature({
                    type: 'save_only', saveType: 'CON', saveDc: 15,
                    conditionInflicted: 'poisoned', duration: '1_round', successEffect: 'half damage'
                }, 'Toxic Exhale'),
                expected: {
                    ...BARE.save_only, name: 'Toxic Exhale', saveType: 'CON', saveDc: 15,
                    conditionInflicted: 'poisoned', duration: '1_round', successEffect: 'half damage'
                }
            },
            {
                feature: makeFeature({ type: 'charm_person', saveType: 'CON', range: '30_ft', duration: '24_hours' }, 'Beguiling Gaze'),
                expected: { ...BARE.charm_person, name: 'Beguiling Gaze', saveType: 'CON', range: '30_ft', duration: '24_hours' }
            },
            {
                // Fixed-condition handlers: declared condition/duration are
                // hardcoded overrides — customs here are falsifiable drop pins.
                feature: makeFeature({ type: 'flesh_to_stone', saveType: 'WIS', conditionInflicted: 'petrified', duration: '1_hour' }, 'Flesh to Stone'),
                expected: { ...BARE.flesh_to_stone, name: 'Flesh to Stone', saveType: 'WIS' }
            },
            {
                feature: makeFeature({ type: 'hold_monster', saveType: 'CON', duration: '1_round' }, 'Hold Monster'),
                expected: { ...BARE.hold_monster, name: 'Hold Monster', saveType: 'CON' }
            },
            {
                feature: makeFeature({ type: 'banishment', saveType: 'WIS', range: '60_ft', conditionInflicted: 'stunned' }, 'Banishment'),
                expected: { ...BARE.banishment, name: 'Banishment', saveType: 'WIS', range: '60_ft' }
            },
            {
                feature: makeFeature({ type: 'resilient_sphere', saveType: 'CON', duration: '1_round' }, 'Resilient Sphere'),
                expected: { ...BARE.resilient_sphere, name: 'Resilient Sphere', saveType: 'CON', duration: '1_round' }
            },
            {
                feature: makeFeature({ type: 'ottos_dance', saveType: 'CON', duration: '1_round' }, "Otto's Irresistible Dance"),
                expected: { ...BARE.ottos_dance, name: "Otto's Irresistible Dance", saveType: 'CON' }
            },
            {
                // power_word_stun envelope has NO duration key — declared one drops.
                feature: makeFeature({ type: 'power_word_stun', saveType: 'INT', duration: '1_round' }, 'Power Word Stun'),
                expected: { ...BARE.power_word_stun, name: 'Power Word Stun', saveType: 'INT' }
            },
            {
                feature: makeFeature({ type: 'sleep', saveType: 'CON', duration: '1_minute' }, 'Sleep'),
                expected: { ...BARE.sleep, name: 'Sleep', saveType: 'CON', duration: '1_minute' }
            },
            {
                feature: makeFeature({ type: 'stinking_cloud', saveType: 'WIS', duration: '1_round' }, 'Stinking Cloud'),
                expected: { ...BARE.stinking_cloud, name: 'Stinking Cloud', saveType: 'WIS', duration: '1_round' }
            },
            {
                feature: makeFeature({ type: 'sleet_storm', saveType: 'CON', duration: '1_round' }, 'Sleet Storm'),
                expected: { ...BARE.sleet_storm, name: 'Sleet Storm', saveType: 'CON', duration: '1_round' }
            },
            {
                feature: makeFeature({ type: 'confusion', saveType: 'INT', duration: '2_rounds' }, 'Confusion'),
                expected: { ...BARE.confusion, name: 'Confusion', saveType: 'INT', duration: '2_rounds' }
            },
            {
                feature: makeFeature({ type: 'tashas_laughter', saveType: 'CHA', duration: '1_round' }, "Tasha's Hides in Plain Sight"),
                expected: { ...BARE.tashas_laughter, name: "Tasha's Hides in Plain Sight", saveType: 'CHA', duration: '1_round' }
            },
            {
                // imprisonment: options propagate; duration is hardcoded 'Until dispelled'.
                feature: makeFeature({ type: 'imprisonment', options: [{ name: 'Buried Alive' }], duration: '1_round' }, 'Imprisonment'),
                expected: { ...BARE.imprisonment, name: 'Imprisonment', options: [{ name: 'Buried Alive' }] }
            },
            {
                feature: makeFeature({ type: 'prismatic_spray', saveType: 'CON', damage: '12d6' }, 'Prismatic Spray'),
                expected: { ...BARE.prismatic_spray, name: 'Prismatic Spray', saveType: 'CON', damage: '12d6' }
            },
            {
                feature: makeFeature({ type: 'forcecage', saveType: 'WIS', duration: '1_day', ruleset: '2024', concentration: true }, 'Forcecage'),
                expected: {
                    ...BARE.forcecage, name: 'Forcecage', saveType: 'WIS',
                    duration: '1_day', ruleset: '2024', concentration: true
                }
            }
        ]

        for (const { feature, expected } of cases) {
            expect(saveHandlers[feature.automation.type](feature, BASE_STATS), feature.name).toEqual(expected)
        }
    })

    it('resolves saveDc from hardcoded ability fallbacks and coerces zero/empty/numeric (#953)', () => {
        // Every saveDc site is `=== 'ability' ? getSaveDc(...) : auto.saveDc || 10`
        // — no ?? sites, so a declared 0 collapses to 10 for every handler.
        for (const [type, abilityDc] of Object.entries(ABILITY_DC)) {
            const dc = (auto) => saveHandlers[type](makeFeature({ type, ...auto }), BASE_STATS).saveDc
            expect(dc({ saveDc: 'ability' }), `${type} ability`).toBe(abilityDc)
            expect(dc({ saveDc: 'ability', saveAbility: 'STR' }), `${type} STR`).toBe(15)
            expect(dc({ saveDc: 0 }), `${type} zero`).toBe(10)
            expect(dc({ saveDc: '' }), `${type} empty`).toBe(10)
            expect(dc({ saveDc: 15 }), `${type} numeric`).toBe(15)
        }

        // charm_person hardcodes WIS in its getSaveDc call — saveAbility unread.
        const cp = (auto) => saveHandlers.charm_person(makeFeature({ type: 'charm_person', ...auto }), BASE_STATS).saveDc
        expect(cp({ saveDc: 'ability' })).toBe(16)
        expect(cp({ saveDc: 'ability', saveAbility: 'CON' })).toBe(16)
    })

    it('resolves scaling and dice tokens; prismatic_spray keeps raw bytes', () => {
        const damage = (type, auto, stats = BASE_STATS) =>
            saveHandlers[type](makeFeature({ type, ...auto }), stats).damage
        const heal = (auto, stats = BASE_STATS) =>
            saveHandlers.save_attack(makeFeature({ type: 'save_attack', ...auto }), stats).healExpression

        // Token golden: proficiency_bonus → 3 (BASE_STATS.proficiency).
        expect(damage('save_attack', { damage: '1d8 + proficiency_bonus' })).toBe('1d8 + 3')
        expect(damage('elemental_burst', { damage: '1d8 + proficiency_bonus' })).toBe('1d8 + 3')
        expect(heal({ healExpression: '2d8 + proficiency_bonus' })).toBe('2d8 + 3')

        // Array scaling wins over declared damage at level boundaries (lv5 base).
        const scaling = [{ level: 1, damage: '1d6' }, { level: 6, damage: '2d6' }]
        for (const type of ['save_attack', 'elemental_burst']) {
            const byLevel = [1, 5, 6].map(level => damage(type, { damage: '9d9', scaling }, { ...BASE_STATS, level }))
            expect(byLevel, type).toEqual(['1d6', '1d6', '2d6'])
        }

        // CLA-208: object-map scaling/healScaling (Land's Aid) at lv20 …
        const objectMap = {
            type: 'save_attack', damage: '2d6', healExpression: '2d6',
            scaling: { '10': '3d6', '14': '4d6' }, healScaling: { '10': '3d6', '14': '4d6' }
        }
        expect(saveHandlers.save_attack(makeFeature(objectMap), { ...BASE_STATS, level: 20 })).toEqual(
            { ...BARE.save_attack, damage: '4d6', healExpression: '4d6', uses: 20, usesMax: 20 }
        )
        // … and stays base below the first threshold.
        expect(saveHandlers.save_attack(makeFeature(objectMap), { ...BASE_STATS, level: 3 })).toEqual(
            { ...BARE.save_attack, damage: '2d6', healExpression: '2d6', uses: 3, usesMax: 3 }
        )

        // healScaling wins over healExpression only when a threshold is met.
        expect(heal({ healExpression: '2d8', healScaling: [{ level: 5, damage: '4d8' }] })).toBe('4d8')
        expect(heal({ healExpression: '2d8', healScaling: [{ level: 6, damage: '4d8' }] })).toBe('2d8')

        // prismatic_spray assigns raw bytes — NO token resolution, NO scaling below threshold.
        expect(damage('prismatic_spray', { damage: '2d6 + proficiency_bonus' })).toBe('2d6 + proficiency_bonus')
        expect(damage('prismatic_spray', { scaling: [{ level: 1, damage: '8d6' }] })).toBe('8d6')
        expect(damage('prismatic_spray', { scaling: { '7': '12d6' } })).toBe('10d6')
    })

    it('resolves uses: wild_shape table, numeric passthrough (0 preserved), expressions, level defaults', () => {
        const usesOf = (auto, stats = BASE_STATS) => {
            const r = saveHandlers.save_attack(makeFeature({ type: 'save_attack', ...auto }), stats)
            return [r.uses, r.usesMax]
        }
        const druid = (level, wildShape) =>
            ({ ...BASE_STATS, level, class: { class_levels: [{ level: 5, wild_shape: wildShape }] } })

        // wild_shape exact-level lookup → mirrored into usesMax.
        expect(usesOf({ resourceCost: 'wild_shape' }, druid(5, 2))).toEqual([2, 2])
        // wild_shape with no entry at the current level → 0 (|| 0 site).
        expect(usesOf({ resourceCost: 'wild_shape' }, druid(7, 2))).toEqual([0, 0])
        // Declared numbers passthrough — including 0 (typeof-number leg).
        expect(usesOf({ uses: 3 })).toEqual([3, 3])
        expect(usesOf({ uses: 0 })).toEqual([0, 0])
        // Expression uses.
        expect(usesOf({ uses: 'proficiency_bonus' })).toEqual([3, 3])
        // elemental_burst hardcodes uses = level, ignoring declared uses.
        const eb = saveHandlers.elemental_burst(makeFeature({ type: 'elemental_burst', uses: 9 }), { ...BASE_STATS, level: 7 })
        expect(eb.uses).toBe(7)
        expect(eb.usesMax).toBe(7)
    })

    it('maps casting_time to action and lets auto.action win (save_attack + elemental_burst)', () => {
        for (const type of ['save_attack', 'elemental_burst']) {
            const build = (auto) => saveHandlers[type](makeFeature({ type, ...auto }), BASE_STATS)
            const cases = [
                ['1 bonus action', 'bonus_action'],
                ['bonus action', 'bonus_action'],
                ['bonus_action', 'bonus_action'],
                ['1 action', 'action'],
                ['action', 'action'],
                ['1 reaction', 'reaction'],
                ['reaction', 'reaction'],
                // Unmapped casting_time → action default, echoed verbatim.
                ['concentration', 'action']
            ]
            for (const [castingTime, action] of cases) {
                expect(build({ casting_time: castingTime }), `${type} ${castingTime}`)
                    .toEqual({ ...BARE[type], action, casting_time: castingTime })
            }
            // auto.action outranks the casting_time-derived action.
            expect(build({ action: 'reaction', casting_time: '1 bonus action' }), type)
                .toEqual({ ...BARE[type], action: 'reaction', casting_time: '1 bonus action' })
        }
    })

    it('flattens truthy/falsy flags at !! sites without leaking raw values', () => {
        // hasOptions: !!auto.hasOptions — 0 stays false (envelope = BARE), truthy string → true.
        expect(saveHandlers.save_attack(makeFeature({ type: 'save_attack', hasOptions: 0 }), BASE_STATS)).toEqual(BARE.save_attack)
        expect(saveHandlers.save_attack(makeFeature({ type: 'save_attack', hasOptions: 'yes' }), BASE_STATS)).toEqual({ ...BARE.save_attack, hasOptions: true })
        // forcecage concentration: !! — truthy → true, 0 → false (= BARE).
        expect(saveHandlers.forcecage(makeFeature({ type: 'forcecage', concentration: 'always' }), BASE_STATS).concentration).toBe(true)
        expect(saveHandlers.forcecage(makeFeature({ type: 'forcecage', concentration: 0 }), BASE_STATS)).toEqual(BARE.forcecage)
    })

    it('forwards feature.name for every handler', () => {
        for (const type of TYPES) {
            const feature = makeFeature({ type }, `Custom ${type}`)
            expect(saveHandlers[type](feature, BASE_STATS).name, type).toBe(`Custom ${type}`)
        }
    })

    it('throws TypeError for every handler when automation is null or undefined', () => {
        for (const type of TYPES) {
            expect(() => saveHandlers[type]({ name: NAME, automation: null }, BASE_STATS), `${type} null`).toThrow(TypeError)
            expect(() => saveHandlers[type]({ name: NAME }, BASE_STATS), `${type} undefined`).toThrow(TypeError)
        }
    })
})
