// @maintained-by-ai
// ── FRAMEWORK LANE: isInteractiveAutomation generic contract (automationService.js:110) ──
// Owns the framework semantics ONCE: registered-type lookup, automation-array mirror-scan
// (.some — any interactive half makes the row clickable), the passive_rule interactive-effect
// table, unknown-type → false, the full-zero guard battery (#936), and the registration-set
// asymmetry rule (HANDLER_MAP registration ≠ row-clickability).
//
// Ticket lanes cite, never re-pin (their registration bytes live there):
//   CLA-200 post_cast_inspiring_smite   → src/services/automation/inspiringSmiteRowActivation.test.js:116
//   CLA-138 fey_reinforcements (+_confirm falsifier) → automationService.feyReinforcements.test.js (#974)
//   CLA-229 misty_wanderer (+free_spell falsifier)   → automationService.interactive.mistyWanderer.test.js (#975)
//   CLA-368 twinkling_constellations    → automationService.interactive.twinkling.test.js (#961)
//   CLA-374 use_magic_device            → automationService.interactive.useMagicDevice.test.js
//   MN-002/MN-003 combat_superiority_* → automationCollector.combatSuperiority*.test.js
//   component row UI (savant/gnomish/bonus_healing rows) → CharSpecialActions.*.test.jsx
// CLA-218 mage_hand_control has no separate lane file — its predicate bytes live HERE (kept).
//
// Registration census (audited 2026-10-19): INTERACTIVE_HANDLER_TYPES holds 50 types;
// 46 dispatch through HANDLER_MAP (src/services/automation/index.js:299), and 4 are
// authored to dispatch through CharSpecialActions' row-click branches instead
// (animal_aspect :316, brew_poison :333, memorize_spell :335, shapechange_form_change :337) —
// authored asymmetry, pinned below. Interactive-but-undispatched: none (would be a SOURCE BUG).
// Both registries are module-private (not exported), so the census is pinned through the
// observable predicate only — no hardcoded oracle beyond the consulted bytes themselves.
//
// Generics received (#974 fey + #975 misty lanes cut their generics here): bare-type
// lookup, standalone array-scan, unregistered-type control, passive_rule table.
// Old → new map:
//   CLA-200 bare-type/array/row-entry triple        → interactive-faces table (teleport generic face
//                                                      + envelope shape); type byte cited, not re-pinned
//   CLA-200 post_cast_smite_cover control           → inert-faces battery (registered-but-inert)
//   CLA-218 mage_hand_control bare + 3-half array   → interactive-faces table rows (bytes kept)
//   CLA-218 passive-only control                    → inert-faces battery
//   NEW: passive_rule effect-table census (7/7), full-zero guard battery (#936),
//        row-branch asymmetry census, modal-confirm falsifier (#974 pattern).
// Pure predicate: zero mocks, zero timers, zero writes; turn-based row-click only.
import { describe, it, expect } from 'vitest'
import { isInteractiveAutomation } from './automationService.js'
import { makeFeature } from './automationService.test-utils.js'

describe('isInteractiveAutomation — framework: interactive faces', () => {
    // Row-entry envelope is the real payload shape produced by infoBuilder
    // (core-handlers.js) / mergeAutomationSpecialActions (rules-helpers.js):
    // { name, description, automation: <info>, hasAutomation: true }. The
    // predicate consults ONLY feature.automation (object or array), extra
    // envelope fields are irrelevant — pinned once, generically.
    it.each([
        ['bare registered interactive type', makeFeature({ type: 'teleport' })],
        ['row-entry envelope wrapping the automation object', {
            name: 'Teleport',
            description: '…',
            hasAutomation: true,
            automation: { type: 'teleport', casting_time: 'action', hasAutomation: true },
        }],
        ['array scan: interactive half first', makeFeature([
            { type: 'teleport' },
            { type: 'passive_rule', effect: 'something_else' },
        ])],
        ['CLA-218 mage_hand_control bare type (no separate lane — byte lives here)', makeFeature({ type: 'mage_hand_control' })],
        ['CLA-218 live Mage Hand Legerdemain array: interactive half behind two passive halves', makeFeature([
            { type: 'passive_rule', effect: 'mage_hand_legerdemain', casting_time: 'passive' },
            { type: 'conditional_advantage', target: 'ability_check', condition: 'mage_hand_legerdemain', effect: 'advantage', abilities: ['DEX'] },
            { type: 'mage_hand_control', range: '30_ft', action: 'bonus_action', casting_time: '1 bonus action' },
        ])],
    ])('returns true — %s', (_label, feature) => {
        expect(isInteractiveAutomation(feature), _label).toBe(true)
    })

    // INTERACTIVE_PASSIVE_EFFECTS census (automationService.js:100-108): normally-inert
    // passive_rule halves are clickable only via this table; no lane pins these predicate
    // bytes elsewhere (component lanes pin UI on top of them).
    it.each([
        'abjuration_savant',
        'divination_savant',
        'evocation_savant',
        'illusion_savant',
        'persistent_rage',
        'superior_defense',
        'bonus_healing',
    ])('returns true for listed interactive passive_rule effect: %s', effect => {
        expect(isInteractiveAutomation(makeFeature({ type: 'passive_rule', effect }))).toBe(true)
    })

    // Authored registration asymmetry, pinned honestly: these 4 interactive types have NO
    // HANDLER_MAP entry — their row clicks dispatch through CharSpecialActions.jsx:316-337
    // row branches (memorize_spell even bypasses handlers entirely: open-short-rest event).
    it.each([
        'animal_aspect',
        'brew_poison',
        'memorize_spell',
        'shapechange_form_change',
    ])('returns true for row-branch-dispatched interactive type (no HANDLER_MAP entry): %s', type => {
        expect(isInteractiveAutomation(makeFeature({ type }))).toBe(true)
    })
})

describe('isInteractiveAutomation — framework: inert faces', () => {
    // Full-zero guard battery (#936) + lookup falsifiers + registered-but-inert class:
    // HANDLER_MAP registration does NOT imply clickability. post_cast_smite_cover is
    // registered (index.js:406) yet auto-triggers post-cast — its row stays inert.
    // animate_dead_confirm is modal-invoked-directly BY the modal payload, never by a
    // row click (#974 fey_reinforcements_confirm pattern — cited, not re-pinned there).
    it.each([
        ['feature undefined', undefined],
        ['feature null', null],
        ['feature without automation', {}],
        ['automation null', makeFeature(null)],
        ['automation empty array', makeFeature([])],
        ['automation array of nullish halves', makeFeature([null, undefined])],
        ['automation object with no type', makeFeature({})],
        ['automation array of type-less objects', makeFeature([{ note: 'x' }, { note: 'y' }])],
        ['unknown type', makeFeature({ type: 'totally_unknown_type' })],
        ['registered post-cast trigger stays row-inert', makeFeature({ type: 'post_cast_smite_cover' })],
        ['modal-invoked confirm byte stays row-inert', makeFeature({ type: 'animate_dead_confirm' })],
        ['passive_rule with off-table effect', makeFeature({ type: 'passive_rule', effect: 'unknown_effect' })],
        ['passive_rule with no effect', makeFeature({ type: 'passive_rule' })],
        ['interactive passive effect name on a non-passive_rule half is ignored', makeFeature({ type: 'conditional_advantage', effect: 'superior_defense' })],
        ['array of all-inert halves', makeFeature([
            { type: 'passive_rule', effect: 'mage_hand_legerdemain', casting_time: 'passive' },
            { type: 'conditional_advantage', target: 'ability_check', effect: 'advantage' },
        ])],
    ])('returns false — %s', (_label, feature) => {
        expect(isInteractiveAutomation(feature), _label).toBe(false)
    })
})
