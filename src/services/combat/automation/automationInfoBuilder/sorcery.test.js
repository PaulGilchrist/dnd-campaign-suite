// @maintained-by-ai
// ── sorcery.test.js — automationInfoBuilder sorcery slice (lane #952 template) ──
// Unit home for the EXACT emitted info bytes of sorceryHandlers (sorcery.js):
// sorcerer sorcery-point / metamagic-adjacent feature automation rows →
// handler-input envelopes. 6 handlers, censused below, all pure — zero mocks
// (#791); warping_implosion runs the REAL automationExpressions.getSaveDc
// with hand-derived goldens (#820 golden-once, #710 no formula oracle).
//
// Builder family map (facade automationInfoBuilder.js spreads 21 domain maps;
// unit lanes pin per-type values, facade lane pins delegation only — see
// ../automationInfoBuilder.test.js header):
//   • THIS FILE: sorcery slice — sorcery_aura / sorcery_incarnate /
//     bastion_of_law / trance_of_order / clockwork_cavalcade /
//     warping_implosion. Distinguishing code paths: warping_implosion is the
//     only handler here that reads playerStats (saveDc via REAL getSaveDc),
//     the slice's only ?? site (uses) and only !! site (hasOptions), folds
//     13 keys through withAutoDefaults(infoDefaults.js `||`-per-key), and
//     RENAMES type→'save_attack' while emitting NO casting_time key; the
//     other five are per-field `||` fallbacks with zero mocks (#953).
//     Sorcery-point CONSUMPTION (store writes) is executor-owned — cited,
//     never re-driven here (this lane pins BUILDER OUTPUT only):
//   • metamagic passive consumption → src/rules/spells/metamagicRules.test.js
//     (#955 precedent) · SP debit / insufficient-SP refusal →
//     automation/handlers/resources/sorceryHandler.test.js ·
//     warping_implosion EXECUTION + save_attack sorcery_points+restoreCost
//     dispatch fingerprint → automation/index.warpingImplosion.test.js
//     (#938: consume bytes live at the d20 seams there) ·
//     trance/clockwork executors → automation/handlers/.../*Handler.test.js ·
//     envelope assembly / null-automation facade contract → facade lane ·
//     spell_modifier resource:'sorcery_points' → spell.test.js (different
//     module) · resourceKey pins → resource.test.js (resource.js, not here).
//
// Old → new map (old file: 23 per-field toMatchObject/toBe its → 5 tests):
//   per-handler 'returns correct defaults' ×6      → census + BARE exact loop (1)
//   per-handler 'passes through custom' ×6 + option/name its ×3 → one
//     full-custom exact table (customs ≠ defaults #954) with hardcoded-
//     override & unread-key DROP pins (aura uses_max stays 2; warping drops
//     casting_time/healExpression/resourceKey customs, keeps type rename) (2)
//   warping saveDc its ×3 → saveDc loop: 'ability' goldens per ability incl.
//     real-name normalization + unknown-ability→0 + prof-0 leg, numeric/0/''
//     || collapse (3)
//   per-handler 'empty-string/zero fallback' ×5     → coercion table: 0/''
//     per operator site present HERE only — || collapses zero, ?? preserves
//     uses:0, !! flattens hasOptions (#936/#953) (4)
//   (none)                            → NEW name coverage folded into tables (1–2)
//     + null-automation throw loop (5)

import { describe, it, expect } from 'vitest'
import { sorceryHandlers } from './sorcery.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

const NAME = 'Test Feature'

// Hand-derived exact envelopes for a bare feature makeFeature({ type })
// against BASE_STATS (level 5, proficiency 3, STR 4 DEX 2 CON 3 INT 1
// WIS 5 CHA 2). Pins every default, the full key set (extra/dropped keys
// fail), name forwarding and hasAutomation. warping_implosion's input type
// 'warping_implosion' is renamed to 'save_attack'; its envelope carries NO
// casting_time key.
const BARE = {
    sorcery_aura: {
        type: 'sorcery_aura',
        name: NAME,
        uses_max: 2,
        recharge: 'long_rest',
        casting_time: '1 bonus action',
        hasAutomation: true
    },
    sorcery_incarnate: {
        type: 'sorcery_incarnate',
        name: NAME,
        casting_time: '1 bonus action',
        cost: 2,
        hasAutomation: true
    },
    bastion_of_law: {
        type: 'bastion_of_law',
        name: NAME,
        range: '30_ft',
        action: 'action',
        casting_time: '1 action',
        resourceCost: 'sorcery_points',
        maxSP: 5,
        minSP: 1,
        hasAutomation: true
    },
    trance_of_order: {
        type: 'trance_of_order',
        name: NAME,
        duration: '1_minute',
        action: 'bonus_action',
        casting_time: '1 bonus action',
        restoreCost: 5,
        hasAutomation: true
    },
    clockwork_cavalcade: {
        type: 'clockwork_cavalcade',
        name: NAME,
        action: 'action',
        range: '30_ft_cube',
        maxHeal: 100,
        restoreCost: 7,
        hasAutomation: true
    },
    warping_implosion: {
        type: 'save_attack',
        name: NAME,
        action: 'action',
        damage: '',
        damageType: '',
        saveType: 'STR',
        shape: '',
        range: '',
        conditionInflicted: null,
        duration: '',
        recharge: 'long_rest',
        resourceCost: '',
        restoreCost: null,
        options: [],
        optionDetails: {},
        dcSuccess: null,
        saveDc: 10,
        saveAbility: 'CHA',
        uses: 1,
        usesMax: 1,
        resourceKey: 'sorcery_points',
        hasOptions: false,
        healExpression: null,
        hasAutomation: true
    }
}

const TYPES = Object.keys(BARE)

describe('sorceryHandlers', () => {
    it('emits the exact default envelope for every handler (census of all 6)', () => {
        // Census (#952): a new sorcery handler added to neither table fails here.
        expect(Object.keys(sorceryHandlers).sort()).toEqual(TYPES.slice().sort())

        for (const type of TYPES) {
            expect(sorceryHandlers[type](makeFeature({ type }), BASE_STATS), type).toEqual(BARE[type])
        }
    })

    it('copies declared fields verbatim, drops unread/hardcoded keys (all customs ≠ defaults)', () => {
        const build = (feature) => sorceryHandlers[feature.automation.type](feature, BASE_STATS)

        const cases = [
            {
                // aura: uses_max is hardcoded 2 — declared 7 must not leak.
                feature: makeFeature({
                    type: 'sorcery_aura', recharge: 'short_rest', casting_time: '1 action',
                    uses_max: 7, cost: 9, unknownKey: 'leak?'
                }, 'Radiant Aura'),
                expected: { ...BARE.sorcery_aura, name: 'Radiant Aura', recharge: 'short_rest', casting_time: '1 action' }
            },
            {
                feature: makeFeature({ type: 'sorcery_incarnate', casting_time: '1 reaction', cost: 5, unknownKey: 'leak?' }, 'Incarnate Force'),
                expected: { ...BARE.sorcery_incarnate, name: 'Incarnate Force', casting_time: '1 reaction', cost: 5 }
            },
            {
                feature: makeFeature({
                    type: 'bastion_of_law', range: '60_ft', action: 'bonus_action',
                    casting_time: '1 reaction', resourceCost: 'channel_divinity', maxSP: 10, minSP: 2,
                    unknownKey: 'leak?'
                }, 'Lawful Bulwark'),
                expected: {
                    ...BARE.bastion_of_law, name: 'Lawful Bulwark', range: '60_ft', action: 'bonus_action',
                    casting_time: '1 reaction', resourceCost: 'channel_divinity', maxSP: 10, minSP: 2
                }
            },
            {
                feature: makeFeature({
                    type: 'trance_of_order', duration: '10_minutes', action: 'action',
                    casting_time: '1 action', restoreCost: 10, unknownKey: 'leak?'
                }, 'Ordered Trance'),
                expected: {
                    ...BARE.trance_of_order, name: 'Ordered Trance', duration: '10_minutes', action: 'action',
                    casting_time: '1 action', restoreCost: 10
                }
            },
            {
                feature: makeFeature({
                    type: 'clockwork_cavalcade', action: 'bonus_action', range: '15_ft_cube',
                    maxHeal: 50, restoreCost: 5, unknownKey: 'leak?'
                }, 'Clockwork Host'),
                expected: {
                    ...BARE.clockwork_cavalcade, name: 'Clockwork Host', action: 'bonus_action',
                    range: '15_ft_cube', maxHeal: 50, restoreCost: 5
                }
            },
            {
                // warping_implosion full custom: every withAutoDefaults key and
                // saveDc/saveAbility/uses/hasOptions propagate raw (NO token
                // resolution); type stays 'save_attack'; healExpression and
                // resourceKey are hardcoded — declared customs drop; this
                // envelope has NO casting_time key (unread) — exact toEqual
                // pins every drop (#842 falsifiable).
                feature: makeFeature({
                    type: 'warping_implosion', action: 'bonus_action', damage: '8d8', damageType: 'Force',
                    saveType: 'CON', shape: 'sphere', range: '60_ft', conditionInflicted: 'stunned',
                    duration: '1_round', recharge: 'short_rest', resourceCost: 'Focus', restoreCost: 6,
                    options: ['collapse'], optionDetails: { collapse: 'Squeeze' }, dcSuccess: 'half',
                    saveDc: 18, saveAbility: 'INT', uses: 2, hasOptions: true,
                    casting_time: '1 action', healExpression: '1d4', resourceKey: 'meters', unknownKey: 'leak?'
                }, 'Warping Doom'),
                expected: {
                    ...BARE.warping_implosion, name: 'Warping Doom', action: 'bonus_action',
                    damage: '8d8', damageType: 'Force', saveType: 'CON', shape: 'sphere', range: '60_ft',
                    conditionInflicted: 'stunned', duration: '1_round', recharge: 'short_rest',
                    resourceCost: 'Focus', restoreCost: 6, options: ['collapse'],
                    optionDetails: { collapse: 'Squeeze' }, dcSuccess: 'half', saveDc: 18,
                    saveAbility: 'INT', uses: 2, usesMax: 2, hasOptions: true
                }
            }
        ]

        for (const { feature, expected } of cases) {
            expect(build(feature), feature.name).toEqual(expected)
        }
    })

    it('resolves warping saveDc via the REAL getSaveDc and collapses zero/empty at ||', () => {
        const dc = (auto, stats = BASE_STATS) =>
            sorceryHandlers.warping_implosion(makeFeature({ type: 'warping_implosion', ...auto }), stats).saveDc

        // 'ability' branch: 8 + mod + prof(3). CHA is the || fallback ability.
        expect(dc({ saveDc: 'ability' })).toBe(13)
        expect(dc({ saveDc: 'ability', saveAbility: 'WIS' })).toBe(16)
        expect(dc({ saveDc: 'ability', saveAbility: 'STR' })).toBe(15)
        // Real abilityLookup normalizes full names …
        expect(dc({ saveDc: 'ability', saveAbility: 'Wisdom' })).toBe(16)
        // … while '' collapses to CHA at the || site …
        expect(dc({ saveDc: 'ability', saveAbility: '' })).toBe(13)
        // … and an unknown ability contributes modifier 0 (8+0+3).
        expect(dc({ saveDc: 'ability', saveAbility: 'Mystery' })).toBe(11)
        // proficiency||0 site.
        expect(dc({ saveDc: 'ability', saveAbility: 'WIS' }, { ...BASE_STATS, proficiency: 0 })).toBe(13)
        // Non-'ability' branch: auto.saveDc || 10 — numeric passthrough,
        // 0 and '' collapse to 10 (contrasts uses' ?? below).
        expect(dc({ saveDc: 15 })).toBe(15)
        expect(dc({ saveDc: 0 })).toBe(10)
        expect(dc({ saveDc: '' })).toBe(10)
        // Absent → 10 pinned in BARE.
    })

    it('coerces 0/"" at || sites but preserves uses:0 at the sole ?? site and flattens !!', () => {
        const build = (type, auto) => sorceryHandlers[type](makeFeature({ type, ...auto }), BASE_STATS)

        // Numeric || sites collapse declared 0 back to the default (= BARE).
        expect(build('sorcery_incarnate', { cost: 0 })).toEqual(BARE.sorcery_incarnate)
        expect(build('bastion_of_law', { maxSP: 0, minSP: 0 })).toEqual(BARE.bastion_of_law)
        expect(build('trance_of_order', { restoreCost: 0 })).toEqual(BARE.trance_of_order)
        expect(build('clockwork_cavalcade', { maxHeal: 0, restoreCost: 0 })).toEqual(BARE.clockwork_cavalcade)
        // warping restoreCost || null — declared 0 becomes null, not 0.
        expect(build('warping_implosion', { restoreCost: 0 }).restoreCost).toBeNull()

        // Empty-string || sites fall back to their defaults (= BARE).
        expect(build('sorcery_aura', { recharge: '', casting_time: '' })).toEqual(BARE.sorcery_aura)
        expect(build('bastion_of_law', { range: '', action: '', resourceCost: '' })).toEqual(BARE.bastion_of_law)
        expect(build('trance_of_order', { duration: '', action: '', casting_time: '' })).toEqual(BARE.trance_of_order)
        expect(build('clockwork_cavalcade', { action: '', range: '' })).toEqual(BARE.clockwork_cavalcade)
        expect(build('warping_implosion', { conditionInflicted: '', dcSuccess: '' })).toEqual(BARE.warping_implosion)

        // The slice's ONLY ?? site: uses 0 is preserved and mirrored to usesMax.
        expect(build('warping_implosion', { uses: 0 })).toEqual({ ...BARE.warping_implosion, uses: 0, usesMax: 0 })

        // hasOptions: !! — truthy string flattens to true, 0 stays false (= BARE).
        expect(build('warping_implosion', { hasOptions: 'yes' }).hasOptions).toBe(true)
        expect(build('warping_implosion', { hasOptions: 0 })).toEqual(BARE.warping_implosion)
    })

    it('throws TypeError for every handler when automation is null or undefined', () => {
        for (const type of TYPES) {
            expect(() => sorceryHandlers[type]({ name: NAME, automation: null }, BASE_STATS), `${type} null`).toThrow(TypeError)
            expect(() => sorceryHandlers[type]({ name: NAME }, BASE_STATS), `${type} undefined`).toThrow(TypeError)
        }
    })
})
