// @maintained-by-ai
// ── temp.test.js — automationInfoBuilder temp slice (lane #952 template) ──
// Unit home for the EXACT emitted info bytes of tempHandlers (temp.js):
// temporary-buff / temporary-hit-point feature automation rows → handler-input
// envelopes. 14 handlers, censused in the default loop. temp.js has ZERO
// imports — the module is pure (#791), so this lane runs zero mocks (no
// vi.mock paths here that could fail to intercept real source imports).
//
// Slice code-path map:
//   • temp_buff is the slice's ONLY playerStats reader (resolveTempBuffUsesMax
//     at temp.js:1: 'proficiency_bonus'→proficiency, '<class>_level'
//     case-insensitive match→level, else class.levels→level→0 ladder) and it
//     reads camelCase triggerOnRage while its list key is snake
//     (enemies_disadvantage_saves); options preserved verbatim (CLA-301).
//   • temp_hp_buff is the only feature-level reader (featName/description at
//     the feature ROOT, FT-046) and reads snake trigger_on_rage — camel
//     DROPS. living_legend reads all-snake, temp_buff reads camel
//     triggerOnRage: the cross-ignore directions are pinned in the
//     full-custom table.
//   • sacred_weapon / avenging_angel emit hardcoded type 'temp_buff';
//     sacred_weapon additionally hardcodes effect (declared effect DROPS);
//     dragon_wings' `uses ?? 1` preserves declared 0 while every || site
//     (temp_buff uses || null, dragon_wings hover || false) collapses falsy.
//   • holy_nimbus / cloak_of_shadows / peerless_athlete / revelation_in_flesh
//     / holy_aura / elder_champion / dark_ones_blessing / large_form are
//     per-field || fallbacks with hardcoded type/name/hasAutomation.
//
// TEMP HP APPLICATION / stacking math is EXECUTOR-owned — cited, never
// re-driven here (this lane pins BUILDER OUTPUT only):
//   • THP grant / replace-if-larger / damage absorb → automation/handlers/
//     buffs/tempHpService.js + automation/handlers/buffs/tempHpBuffHandler.*
//     .test.js (handle, multiTargetAlly, vitalityOfTheTree,
//     grantTempHpOnRage, mantleOfInspiration, bolsteringTreats) ·
//     temp_buff row toggle / choice-picker execution → components/char-sheet/
//     useCharActionsModalHandlers.buffs.test.js · CLA-301 sacred_weapon
//     collector fingerprint / fallThrough routing →
//     automationCollector.sacredWeapon.test.js · temp_hp_buff
//     healingStartOfTurn turn-start remap →
//     automationCollector.turnStartEffects.test.js +
//     automationCollector.coverage.test.js · type→rowType routing →
//     automationCollector.types.test.js · living_legend / holy_aura modifier
//     rows → automationModifiers.test.js · envelope assembly / facade
//     delegation → facade lane ../automationInfoBuilder.test.js.
//
// Old → new map (old file: 45 partial toMatchObject/toBe its → 5 tests):
//   per-handler 'returns correct structure with defaults' ×14 (toMatchObject
//     missed trigger/multiTarget/targets/resourceCost/freeFirstUseAfterLongRest
//     /featName/description/craftCount/craftTime keys)
//       → census guard + BARE exact-byte default loop (1)
//   per-handler 'passes through custom fields' ×14 + CLA-301 options ×2 +
//     snake_case-map its ×2 + 'coerces snake trigger_on_rage' + 'does not
//     mutate options' (reference identity = implementation detail, dropped)
//       → one full-custom exact table per handler, customs ≠ defaults (#954),
//         unread-key/unknownKey DROP + hardcoded-override pins (2)
//   temp_buff 'resolves uses' ×3 → usesMax resolver table on the REAL
//     resolver lines (class.levels precedence now distinguished vs old
//     indistinguishable 5-vs-5) (3)
//   coercion its (!! ×3, allyCount, extraEffect, dragon ?? / ||, hover)
//       → null-collapse loop over all 14 handlers + falsy-survivor pins at
//         REAL operator sites only (#959: ?? vs ||, numeric 0, truthy non-bool) (4)
//   (none) → NEW null-automation throw loop (5)

import { describe, it, expect } from 'vitest'
import { tempHandlers } from './temp.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

const NAME = 'Test Feature'

// Hand-derived exact envelopes for a bare feature makeFeature({ type })
// against BASE_STATS (level 5, proficiency 3, no `class`). Pins every default
// AND the full key set — extra/dropped keys fail (the old partial
// toMatchObject tables silently missed eight keys).
const BARE = {
    temp_buff: {
        type: 'temp_buff', name: NAME, effect: '', duration: '1_minute', action: 'bonus_action',
        recharge: 'long_rest', distance: '', extendedDistance: '', oncePerRage: false,
        bringAllies: false, allyCount: 0, teleportRange: '', enemiesDisadvantageSaves: [],
        triggerOnRage: false, distanceExpression: '', casting_time: '', trigger: null,
        uses: null, usesMax: null, multiTarget: false, targets: null, resourceCost: '',
        freeFirstUseAfterLongRest: false, options: [], hasAutomation: true
    },
    temp_hp_buff: {
        type: 'temp_hp_buff', name: NAME, featName: '', description: '', buffExpression: '',
        range: '60_ft', targets: 1, targetsExpression: '', bonusMovement: false, extraEffect: null,
        tempHpExpression: '', triggerOnRage: false, ongoingHealingExpression: '',
        healingStartOfTurn: false, healingRange: '', casting_time: '1 bonus action',
        includesSelf: false, multiTargetAlly: false, craftCount: null, craftTime: '',
        hasAutomation: true
    },
    sacred_weapon: {
        type: 'temp_buff', name: NAME, effect: 'sacred_weapon', duration: '10_minutes',
        resourceCost: '', options: [], casting_time: '', hasAutomation: true
    },
    avenging_angel: {
        type: 'temp_buff', name: NAME, effect: 'avenging_angel', duration: '10_minutes',
        action: 'bonus_action', flySpeed: 60, hover: false, auraRange: 'aura_of_protection',
        saveType: 'WIS', saveDc: 'ability', hasAutomation: true
    },
    holy_nimbus: {
        type: 'holy_nimbus', name: NAME, duration: '10_minutes', casting_time: '1_bonus_action',
        resourceCost: '', hasAutomation: true
    },
    cloak_of_shadows: {
        type: 'cloak_of_shadows', name: NAME, effect: '', duration: '1_minute', hasAutomation: true
    },
    peerless_athlete: {
        type: 'peerless_athlete', name: NAME, duration: '1_hour', casting_time: '1_bonus_action',
        resourceCost: 'channel_divinity', hasAutomation: true
    },
    dragon_wings: {
        type: 'dragon_wings', name: NAME, action: 'bonus_action', duration: '1_hour', flySpeed: 60,
        hover: false, uses: 1, recharge: 'long_rest', resourceCost: '', restoreCost: 3,
        hasAutomation: true
    },
    revelation_in_flesh: {
        type: 'revelation_in_flesh', name: NAME, options: [], duration: '10_minutes',
        action: 'bonus_action', casting_time: '1 bonus action', hasAutomation: true
    },
    living_legend: {
        type: 'living_legend', name: NAME, duration: '10_minutes', casting_time: '1 bonus action',
        unerringStrikeTrigger: 'attack_miss', unerringStrikeOncePerTurn: false,
        saveRerollTarget: 'saving_throw', charismaCheckAdvantage: false, hasAutomation: true
    },
    holy_aura: {
        type: 'holy_aura', name: NAME, duration: 'Concentration, up to 1 minute', auraRange: 30,
        casting_time: '1 action', hasAutomation: true
    },
    elder_champion: {
        type: 'elder_champion', name: NAME, duration: '1_minute', casting_time: '1 bonus action',
        hasAutomation: true
    },
    dark_ones_blessing: {
        type: 'dark_ones_blessing', name: NAME, tempHpExpression: '', range: '10_ft',
        hasAutomation: true
    },
    large_form: {
        type: 'large_form', name: NAME, duration: '10_minutes', casting_time: '1_bonus_action',
        resourceCost: 'long_rest', hasAutomation: true
    }
}

const TYPES = Object.keys(BARE)

const build = (type, auto = {}, name = NAME) =>
    tempHandlers[type](makeFeature({ type, ...auto }, name), BASE_STATS)

describe('tempHandlers', () => {
    it('emits the exact default envelope for every handler (census of all 14)', () => {
        // Census (#952): a new temp handler added to neither table fails here.
        expect(Object.keys(tempHandlers).sort()).toEqual(TYPES.slice().sort())

        for (const type of TYPES) {
            expect(build(type), type).toEqual(BARE[type])
        }
    })

    it('copies declared fields verbatim, drops unread keys (all customs ≠ defaults)', () => {
        const cases = [
            {
                // temp_buff reads CAMEL triggerOnRage; snake trigger_on_rage and
                // camel enemiesDisadvantageSaves are UNREAD drops. uses:3 numeric
                // passes through || to uses AND usesMax (resolver guard-skip).
                feature: makeFeature({
                    type: 'temp_buff', effect: 'haste', duration: '10_minutes', action: 'action',
                    recharge: 'short_rest', distance: '30 ft', extendedDistance: '60 ft',
                    oncePerRage: true, bringAllies: true, allyCount: 3, teleportRange: '30 ft',
                    enemies_disadvantage_saves: ['goblins', 'undead'], triggerOnRage: true,
                    distanceExpression: 'level * 5', casting_time: '1 action', trigger: 'turn start',
                    uses: 3, multiTarget: true, targets: 2, resourceCost: 'ki points',
                    freeFirstUseAfterLongRest: true, options: [{ name: 'Option A' }],
                    enemiesDisadvantageSaves: ['leak?'], trigger_on_rage: false, unknownKey: 'leak?'
                }, 'Haste'),
                expected: {
                    ...BARE.temp_buff, name: 'Haste', effect: 'haste', duration: '10_minutes',
                    action: 'action', recharge: 'short_rest', distance: '30 ft',
                    extendedDistance: '60 ft', oncePerRage: true, bringAllies: true, allyCount: 3,
                    teleportRange: '30 ft', enemiesDisadvantageSaves: ['goblins', 'undead'],
                    triggerOnRage: true, distanceExpression: 'level * 5', casting_time: '1 action',
                    trigger: 'turn start', uses: 3, usesMax: 3, multiTarget: true, targets: 2,
                    resourceCost: 'ki points', freeFirstUseAfterLongRest: true,
                    options: [{ name: 'Option A' }]
                }
            },
            {
                // temp_hp_buff reads featName/description from the feature ROOT
                // (FT-046) — automation-level featName is an UNREAD drop; reads
                // snake trigger_on_rage (declared camel false is ignored).
                feature: {
                    name: 'Inspiring Leader',
                    featName: 'Inspiring Leader',
                    description: 'Rally bonus action',
                    automation: {
                        type: 'temp_hp_buff', buffExpression: '2d8', range: '30_ft', targets: 5,
                        targetsExpression: '3 + level', bonusMovement: true, extraEffect: 'speed_boost',
                        tempHpExpression: '1d10', trigger_on_rage: true,
                        ongoingHealingExpression: '1d6', healingStartOfTurn: true,
                        healingRange: '10_ft', casting_time: '1 action', includesSelf: true,
                        multiTargetAlly: true, craftCount: 2, craftTime: '1 hour',
                        triggerOnRage: false, featName: 'leak?', unknownKey: 'leak?'
                    }
                },
                expected: {
                    ...BARE.temp_hp_buff, name: 'Inspiring Leader', featName: 'Inspiring Leader',
                    description: 'Rally bonus action', buffExpression: '2d8', range: '30_ft',
                    targets: 5, targetsExpression: '3 + level', bonusMovement: true,
                    extraEffect: 'speed_boost', tempHpExpression: '1d10', triggerOnRage: true,
                    ongoingHealingExpression: '1d6', healingStartOfTurn: true,
                    healingRange: '10_ft', casting_time: '1 action', includesSelf: true,
                    multiTargetAlly: true, craftCount: 2, craftTime: '1 hour'
                }
            },
            {
                // sacred_weapon: effect and type are HARDCODED — declared
                // effect:'leak?' drops (hardcoded-override pin, CLA-301 row);
                // custom options copy verbatim.
                feature: makeFeature({
                    type: 'sacred_weapon', effect: 'leak?', duration: '1_minute',
                    resourceCost: 'divine favor', casting_time: '1 action',
                    options: [{ name: 'Radiant Damage', damageType: 'Radiant' }],
                    unknownKey: 'leak?'
                }, 'Sacred Weapon'),
                expected: {
                    ...BARE.sacred_weapon, name: 'Sacred Weapon', duration: '1_minute',
                    resourceCost: 'divine favor', casting_time: '1 action',
                    options: [{ name: 'Radiant Damage', damageType: 'Radiant' }]
                }
            },
            {
                // avenging_angel: emits type 'temp_buff'; every declared field
                // survives || untouched (saveDc:15 numeric ≠ default 'ability').
                feature: makeFeature({
                    type: 'avenging_angel', effect: 'custom_angel', duration: '1_minute',
                    action: 'action', flySpeed: 30, hover: true, auraRange: '30_ft',
                    saveType: 'CON', saveDc: 15, unknownKey: 'leak?'
                }, 'Avenging Angel'),
                expected: {
                    ...BARE.avenging_angel, name: 'Avenging Angel', effect: 'custom_angel',
                    duration: '1_minute', action: 'action', flySpeed: 30, hover: true,
                    auraRange: '30_ft', saveType: 'CON', saveDc: 15
                }
            },
            {
                feature: makeFeature({
                    type: 'holy_nimbus', duration: '1_minute', casting_time: '1 action',
                    resourceCost: 'channel divinity', unknownKey: 'leak?'
                }, 'Holy Nimbus'),
                expected: {
                    ...BARE.holy_nimbus, name: 'Holy Nimbus', duration: '1_minute',
                    casting_time: '1 action', resourceCost: 'channel divinity'
                }
            },
            {
                feature: makeFeature({
                    type: 'cloak_of_shadows', effect: 'invisibility', duration: '1_round',
                    unknownKey: 'leak?'
                }, 'Cloak of Shadows'),
                expected: {
                    ...BARE.cloak_of_shadows, name: 'Cloak of Shadows',
                    effect: 'invisibility', duration: '1_round'
                }
            },
            {
                feature: makeFeature({
                    type: 'peerless_athlete', duration: '1_minute', casting_time: '1 action',
                    resourceCost: 'sorcery points', unknownKey: 'leak?'
                }, 'Peerless Athlete'),
                expected: {
                    ...BARE.peerless_athlete, name: 'Peerless Athlete', duration: '1_minute',
                    casting_time: '1 action', resourceCost: 'sorcery points'
                }
            },
            {
                // dragon_wings custom: uses:2 survives `??`; every other ||
                // site propagates.
                feature: makeFeature({
                    type: 'dragon_wings', action: 'action', duration: '10_minutes', flySpeed: 90,
                    hover: true, uses: 2, recharge: 'short_rest', resourceCost: 'ki points',
                    restoreCost: 5, unknownKey: 'leak?'
                }, 'Dragon Wings'),
                expected: {
                    ...BARE.dragon_wings, name: 'Dragon Wings', action: 'action',
                    duration: '10_minutes', flySpeed: 90, hover: true, uses: 2,
                    recharge: 'short_rest', resourceCost: 'ki points', restoreCost: 5
                }
            },
            {
                feature: makeFeature({
                    type: 'revelation_in_flesh', options: [{ name: 'Option A' }],
                    duration: '1_minute', action: 'action', casting_time: '1 action',
                    unknownKey: 'leak?'
                }, 'Revelation in the Flesh'),
                expected: {
                    ...BARE.revelation_in_flesh, name: 'Revelation in the Flesh',
                    options: [{ name: 'Option A' }], duration: '1_minute', action: 'action',
                    casting_time: '1 action'
                }
            },
            {
                // living_legend reads ALL-snake inputs → camel outputs; the
                // declared camelCase twin leaks nothing.
                feature: makeFeature({
                    type: 'living_legend', duration: '1_minute', casting_time: '1 action',
                    unerring_strike_trigger: 'spell_miss', unerring_strike_once_per_turn: true,
                    save_reroll_target: 'ability_check', charisma_check_advantage: true,
                    unerringStrikeTrigger: 'leak?', unknownKey: 'leak?'
                }, 'Living Legend'),
                expected: {
                    ...BARE.living_legend, name: 'Living Legend', duration: '1_minute',
                    casting_time: '1 action', unerringStrikeTrigger: 'spell_miss',
                    unerringStrikeOncePerTurn: true, saveRerollTarget: 'ability_check',
                    charismaCheckAdvantage: true
                }
            },
            {
                feature: makeFeature({
                    type: 'holy_aura', duration: '10_minutes', auraRange: 60,
                    casting_time: '1 bonus action', unknownKey: 'leak?'
                }, 'Holy Aura'),
                expected: {
                    ...BARE.holy_aura, name: 'Holy Aura', duration: '10_minutes',
                    auraRange: 60, casting_time: '1 bonus action'
                }
            },
            {
                feature: makeFeature({
                    type: 'elder_champion', duration: '10_minutes', casting_time: '1 action',
                    unknownKey: 'leak?'
                }, 'Elder Champion'),
                expected: {
                    ...BARE.elder_champion, name: 'Elder Champion', duration: '10_minutes',
                    casting_time: '1 action'
                }
            },
            {
                feature: makeFeature({
                    type: 'dark_ones_blessing', tempHpExpression: '2d8', range: '15_ft',
                    unknownKey: 'leak?'
                }, "Dark One's Blessing"),
                expected: {
                    ...BARE.dark_ones_blessing, name: "Dark One's Blessing",
                    tempHpExpression: '2d8', range: '15_ft'
                }
            },
            {
                feature: makeFeature({
                    type: 'large_form', duration: '1_minute', casting_time: '1 action',
                    resourceCost: 'wild shape', unknownKey: 'leak?'
                }, 'Large Form'),
                expected: {
                    ...BARE.large_form, name: 'Large Form', duration: '1_minute',
                    casting_time: '1 action', resourceCost: 'wild shape'
                }
            }
        ]

        for (const { feature, expected } of cases) {
            expect(
                tempHandlers[feature.automation.type](feature, BASE_STATS),
                feature.name
            ).toEqual(expected)
        }
    })

    it('resolves temp_buff usesMax at the REAL resolver lines (slice\'s only playerStats reader)', () => {
        const buff = (uses, stats = BASE_STATS) =>
            tempHandlers.temp_buff(makeFeature({ type: 'temp_buff', uses }, NAME), stats)

        // 'proficiency_bonus' → proficiency 3; the token itself survives || verbatim.
        expect(buff('proficiency_bonus'), 'proficiency_bonus').toMatchObject({ uses: 'proficiency_bonus', usesMax: 3 })
        // '<class>_level' match is case-insensitive → playerStats.level.
        expect(buff('barbarian_level', { ...BASE_STATS, class: { name: 'Barbarian' } }), 'name match').toMatchObject({ uses: 'barbarian_level', usesMax: 5 })
        // Mismatch reads class.levels FIRST — 2 ≠ level 5 (the old lane tested
        // 5-vs-5 and could not distinguish the two branches).
        expect(buff('barbarian_level', { ...BASE_STATS, class: { name: 'Wizard', levels: 2 } }), 'levels precedence').toMatchObject({ usesMax: 2 })
        // ...then falls back to level, then 0.
        expect(buff('barbarian_level', { ...BASE_STATS, class: { name: 'Wizard' } }), 'level fallback').toMatchObject({ usesMax: 5 })
        expect(buff('barbarian_level', { level: 0 }), 'zero floor').toMatchObject({ usesMax: 0 })
        // Guard skip (no '_level' suffix, non-string): uses passes through and
        // usesMax mirrors it via `auto.uses || null`.
        expect(buff('free'), 'non-_level string').toMatchObject({ uses: 'free', usesMax: 'free' })
        expect(buff(3), 'number passthrough').toMatchObject({ uses: 3, usesMax: 3 })
    })

    it('collapses every falsy input to BARE defaults and pins falsy survivors at REAL operator sites', () => {
        // Every emitted key set to null: each ||/??/!! site lands on its
        // default, snake-only reads ignore their camel twins, and unread keys
        // (usesMax input, featName on auto, unknownKey) never leak — so each
        // row must equal BARE byte-for-byte.
        for (const type of TYPES) {
            const auto = Object.fromEntries(Object.keys(BARE[type]).map(k => [k, null]))
            expect(build(type, { ...auto, unknownKey: 'leak?' }), type).toEqual(BARE[type])
        }

        // ?? vs || (falsy survivors distinct #842): dragon_wings' `uses ?? 1`
        // preserves declared 0…
        expect(build('dragon_wings', { uses: 0 }).uses, '?? keeps 0').toBe(0)
        // …while temp_buff's uses || null collapses 0 → null (usesMax too).
        expect(build('temp_buff', { uses: 0 })).toMatchObject({ uses: null, usesMax: null })
        // || preserves truthy non-booleans — dragon_wings hover is NOT !!:
        expect(build('dragon_wings', { hover: 'yes' }).hover, 'truthy hover survives').toBe('yes')
        expect(build('dragon_wings', { hover: '' }).hover, "'' collapses").toBe(false)
        // avenging_angel saveDc || 'ability' collapses NUMERIC 0, keeps 15.
        expect(build('avenging_angel', { saveDc: 0 }).saveDc, 'numeric 0 collapses').toBe('ability')
        // !! sites coerce 1/'yes' → true, 0 → false (temp_buff triple +
        // living_legend snake pair).
        expect(build('temp_buff', { oncePerRage: 'yes', bringAllies: 1, triggerOnRage: 0 }))
            .toMatchObject({ oncePerRage: true, bringAllies: true, triggerOnRage: false })
        expect(build('living_legend', { unerring_strike_once_per_turn: 1, charisma_check_advantage: 0 }))
            .toMatchObject({ unerringStrikeOncePerTurn: true, charismaCheckAdvantage: false })
    })

    it('throws TypeError for every handler when automation is null or undefined', () => {
        for (const type of TYPES) {
            expect(() => tempHandlers[type]({ name: NAME, automation: null }, BASE_STATS), `${type} null`).toThrow(TypeError)
            expect(() => tempHandlers[type]({ name: NAME }, BASE_STATS), `${type} undefined`).toThrow(TypeError)
        }
    })
})
