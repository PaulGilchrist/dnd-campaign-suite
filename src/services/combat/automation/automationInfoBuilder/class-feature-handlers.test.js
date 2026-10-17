// @maintained-by-ai
// ── class-feature-handlers unit lane (#2096 — hidden module) ──────────────
// Aggregated internally by misc.js into the facade DISPATCH (#2093 family
// map; 251 types, zero collisions). THIS lane invokes these six handlers
// directly — facade delegation for every registered type is already pinned
// generically in automationInfoBuilder.test.js, so nothing is re-routed
// through buildAttackInfo here. Successor sibling hidden-modules core-handlers
// #2101/#2102 cover the co-resident coreHandlers map — distinct maps, distinct
// types; do not blur the lanes.
//
// Disciplines:
//   • Exact toEqual full-envelopes (toMatchObject banned class).
//   • Hardcoded-field-probes: custom values cannot be shadowed by defaults.
//   • Verbatim disk where feature-sourced: telekinetic_shove automation copied
//     verbatim from public/data/2024/feats.json [63].benefits[2]; animal_aspect
//     and projected_ward and arcane_ward_bonus_action verbatim from
//     public/data/2024/classes.json (2014 projected_ward is identical).
//   • Synthetic fixtures are labeled machinery-tests-only, not content.
//   • Every branch of a filter/ternary is proven discriminating — the legacy
//     "casting_time '1 bonus action' → bonus_action" row folded: it passed
//     with the whole derivation block deleted (identical fallback default).
//
// Consumers (distinct modules, not overlap): execution lanes live in
// services/automation/handlers/feats/telekineticShoveHandler.js,
// …/class-wizard/arcaneWardHandler.js, and …/class-other/giantAncestryHandler.js
// (clouds_jaunt). Collector lanes for passive-rule arcane_ward /
// projected_ward rows: automationCollector.* (#2082). No clocks here; all
// handlers are pure (feature, playerStats) → envelope.
//
// clouds_jaunt has NO disk-sourced automation of this type (races.json ships
// Cloud's Jaunt as type 'teleport') — only custom user-created features reach
// this handler, so its fixtures are synthetic shape tests of the machinery.
import { describe, it, expect } from 'vitest'
import { classFeatureHandlers } from './class-feature-handlers.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// ── telekinetic_shove ────────────────────────────────────────────────

describe('classFeatureHandlers – telekinetic_shove', () => {
    it('builds the full envelope from verbatim feats.json Telekinetic automation', () => {
        // Verbatim: public/data/2024/feats.json [63].benefits[2].automation
        const auto = {
            type: 'telekinetic_shove',
            saveType: 'STR',
            saveDc: 'ability',
            saveAbility: 'INT',
            range: '30',
            pushDistance: 5,
            action: 'bonus_action',
            casting_time: '1 bonus action'
        }
        const result = classFeatureHandlers.telekinetic_shove(
            makeFeature(auto, 'Telekinetic Shove'), BASE_STATS)
        // saveDc "ability": 8 + INT mod (1) + proficiency (3) = 12
        expect(result).toEqual({
            type: 'telekinetic_shove',
            name: 'Telekinetic Shove',
            saveType: 'STR',
            saveDc: 12,
            saveAbility: 'INT',
            range: '30',
            pushDistance: 5,
            action: 'bonus_action',
            casting_time: '1 bonus action',
            hasAutomation: true
        })
    })

    it.each([
        ['ability keyword computes 8 + mod + prof', { saveDc: 'ability' }, 12],
        ['explicit numeric passes through', { saveDc: 15 }, 15],
        ['missing saveDc falls back to 10', {}, 10]
    ])('saveDc ternary: %s', (_label, automation, expectedDc) => {
        const result = classFeatureHandlers.telekinetic_shove(
            makeFeature({ type: 'telekinetic_shove', ...automation }), BASE_STATS)
        expect(result.saveDc).toBe(expectedDc)
    })

    it('FT-094: ASI chosen for the Telekinesis feat overrides static saveAbility', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            saveDc: 'ability',
            saveAbility: 'INT'
        })
        const stats = {
            ...BASE_STATS,
            featAbilityChoices: { 'Telekinesis-0': { assignment: 'CHA' } }
        }
        const result = classFeatureHandlers.telekinetic_shove(feature, stats)
        expect(result.saveAbility).toBe('CHA')
        // 8 + CHA mod (2) + prof (3) = 13, not the INT-based 12
        expect(result.saveDc).toBe(13)
    })

    it.each([
        ['casting_time 1 action derives action', { casting_time: '1 action' }, 'action'],
        ['explicit action beats casting_time', { action: 'action', casting_time: '1 bonus action' }, 'action'],
        ['unmatched casting_time falls back to bonus_action', { casting_time: '1 reaction' }, 'bonus_action']
    ])('action derivation: %s', (_label, automation, expectedAction) => {
        const result = classFeatureHandlers.telekinetic_shove(
            makeFeature({ type: 'telekinetic_shove', ...automation }), BASE_STATS)
        expect(result.action).toBe(expectedAction)
    })
})

// ── arcane_ward ──────────────────────────────────────────────────────

describe('classFeatureHandlers – arcane_ward', () => {
    it.each([
        ['computes defaults from wizard level and INT mod (expressions stay verbatim strings)',
            {},
            {
                type: 'arcane_ward',
                name: 'Test Feature',
                wardHpExpression: '(2 * 5) + 1',
                wardRestoreExpression: '2 * spell_slot_level',
                wardTrigger: 'abjuration_spell_cast',
                wardDuration: 'long_rest',
                bonusActionRestore: false,
                maxHp: 11,
                hasAutomation: true
            }],
        ['custom fields pass through, defaults cannot override them',
            {
                wardHpExpression: 'custom_hp',
                wardRestoreExpression: 'custom_restore',
                wardTrigger: 'custom_trigger',
                wardDuration: 'custom_duration',
                bonusActionRestore: true
            },
            {
                type: 'arcane_ward',
                name: 'Test Feature',
                wardHpExpression: 'custom_hp',
                wardRestoreExpression: 'custom_restore',
                wardTrigger: 'custom_trigger',
                wardDuration: 'custom_duration',
                bonusActionRestore: true,
                maxHp: 11,
                hasAutomation: true
            }]
    ])('%s', (_label, automation, expected) => {
        const result = classFeatureHandlers.arcane_ward(
            makeFeature({ type: 'arcane_ward', ...automation }), BASE_STATS)
        expect(result).toEqual(expected)
    })
})

// ── arcane_ward_bonus_action ─────────────────────────────────────────

describe('classFeatureHandlers – arcane_ward_bonus_action', () => {
    it.each([
        ['verbatim classes.json casting_time',
            { casting_time: '1 bonus action' }, 'Arcane Ward - Bonus Action Restore',
            { type: 'arcane_ward_bonus_action', name: 'Arcane Ward - Bonus Action Restore', action: 'bonus_action', casting_time: '1 bonus action', hasAutomation: true }],
        ['custom casting_time passes through',
            { casting_time: '1 reaction' }, 'Test Feature',
            { type: 'arcane_ward_bonus_action', name: 'Test Feature', action: 'bonus_action', casting_time: '1 reaction', hasAutomation: true }]
    ])('envelope: %s', (_label, automation, name, expected) => {
        // Row 1 verbatim from public/data/2024/classes.json Wizard lv3.
        // action is hardcoded bonus_action — custom casting_time cannot change it.
        const result = classFeatureHandlers.arcane_ward_bonus_action(
            makeFeature({ type: 'arcane_ward_bonus_action', ...automation }, name),
            BASE_STATS)
        expect(result).toEqual(expected)
    })
})

// ── projected_ward ───────────────────────────────────────────────────

describe('classFeatureHandlers – projected_ward', () => {
    it.each([
        ['verbatim classes.json automation',
            { wardTrigger: 'ally_damage_taken', range: 30, reaction: true, casting_time: '1 reaction' },
            { type: 'projected_ward', name: 'Test Feature', range: 30, reaction: true, wardTrigger: 'ally_damage_taken', casting_time: '1 reaction', hasAutomation: true }],
        ['custom values pass through',
            { wardTrigger: 'self_damage_taken', range: 60, casting_time: '1 reaction, below 50% hp' },
            { type: 'projected_ward', name: 'Test Feature', range: 60, reaction: true, wardTrigger: 'self_damage_taken', casting_time: '1 reaction, below 50% hp', hasAutomation: true }]
    ])('envelope: %s', (_label, automation, expected) => {
        // Row 1 verbatim from public/data/2024/classes.json Wizard lv6
        // (public/data/classes.json lv6 is identical). reaction is always
        // true — a custom wardTrigger/casting_time cannot suppress it.
        const result = classFeatureHandlers.projected_ward(
            makeFeature({ type: 'projected_ward', ...automation }), BASE_STATS)
        expect(result).toEqual(expected)
    })
})

// ── animal_aspect ────────────────────────────────────────────────────

describe('classFeatureHandlers – animal_aspect', () => {
    it.each([
        ['verbatim classes.json Aspect of the Wilds',
            { options: ['Owl', 'Panther', 'Salmon'], casting_time: 'passive' },
            { type: 'animal_aspect', name: 'Aspect of the Wilds', options: ['Owl', 'Panther', 'Salmon'], casting_time: 'passive', hasAutomation: true }],
        ['missing fields default to empty (synthetic custom-feature shape)',
            {},
            { type: 'animal_aspect', name: 'Test Feature', options: [], casting_time: '', hasAutomation: true }]
    ])('envelope: %s', (_label, automation, expected) => {
        // Row 1 verbatim from public/data/2024/classes.json Druid lv6.
        const result = classFeatureHandlers.animal_aspect(
            makeFeature({ type: 'animal_aspect', ...automation }, expected.name), BASE_STATS)
        expect(result).toEqual(expected)
    })
})

// ── clouds_jaunt (custom-feature lane — synthetic fixtures) ─────────

describe('classFeatureHandlers – clouds_jaunt', () => {
    it.each([
        ['defaults with automation passthrough',
            { type: 'clouds_jaunt' },
            { type: 'clouds_jaunt', name: 'Test Feature', distance: '30 ft', range: '30_ft', uses: null, recharge: 'long_rest', casting_time: '1 bonus action', automation: { type: 'clouds_jaunt' }, hasAutomation: true }],
        ['custom distance/range/uses/recharge pass through',
            { type: 'clouds_jaunt', distance: '60 ft', range: '60_ft', uses: 3, recharge: 'short_rest' },
            { type: 'clouds_jaunt', name: 'Test Feature', distance: '60 ft', range: '60_ft', uses: 3, recharge: 'short_rest', casting_time: '1 bonus action', automation: { type: 'clouds_jaunt', distance: '60 ft', range: '60_ft', uses: 3, recharge: 'short_rest' }, hasAutomation: true }]
    ])('envelope: %s', (_label, automation, expected) => {
        // Synthetic fixtures: no disk data ships type 'clouds_jaunt'
        // (races.json Cloud's Jaunt is type 'teleport') — custom-created
        // features only; these rows test envelope machinery, not content.
        const result = classFeatureHandlers.clouds_jaunt(
            makeFeature(automation), BASE_STATS)
        expect(result).toEqual(expected)
    })
})
