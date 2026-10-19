// @maintained-by-ai
// CLA-229 regression: misty_wanderer must be an interactive type so the
// Special Actions "Misty Wanderer:" row renders clickable and dispatches
// mistyWandererHandler (previously missing from INTERACTIVE_HANDLER_TYPES, so
// the row rendered inert <b className=""> text with no click handler — CLA-179 family).
//
// ── interactive-family lane map (row-clickability predicate lane) ──
// Generic isInteractiveAutomation mechanics (array .some scan, passive_rule
// effect table, unregistered-type control) live in automationService.interactive.test.js
// (CLA-200 + CLA-218, #974 pattern: row-clickability + payload-sans-confirm
// falsifier exemplar). Twinkling interactivity is owned by CLA-368
// (automationService.interactive.twinkling.test.js, #961); use_magic_device by
// CLA-374. executeHandler dispatch-priority (free_spell shadowing, prefer-branch
// L723-728) lives in src/services/automation/index.mistyWanderer.test.js;
// handler internals/modal in handlers/class-warlock/mistyWandererHandler.test.js
// + MistyWandererModal.jsx lanes. NOT re-pinned here.
// THIS lane owns EXCLUSIVELY the CLA-229 ticket-distinct classification bytes:
//   • the verbatim live row (public/data/2024/classes.json, Fey Wanderer Ranger
//     lv15 "Misty Wanderer" — the sole prod misty_wanderer row, 2024-only):
//     its [free_spell, misty_wanderer] array must resolve interactive.
//   • the ticket's explicit non-add: 'free_spell' is deliberately NOT in
//     INTERACTIVE_HANDLER_TYPES (automationService.js L68-71 — clicking those
//     rows would dispatch handleSpellCast on unrelated free-cast features).
//   • confirm-flow falsifier: misty_wanderer_confirm (registered in the
//     HANDLER_MAP, index.js L432) stays NON-interactive — the confirm half is
//     invoked directly by MistyWandererModal, never by a row click.
// Old → new map: bare-type-true + array-alongside-free_spell-true tests were
// consolidated into the verbatim golden-row test; free_spell falsifier kept
// (unique to this lane); misty_wanderer_confirm falsifier added (#974 pattern).
// No timers; turn-based row-click predicate only.
import { describe, it, expect } from 'vitest'
import { isInteractiveAutomation } from './automationService.js'
import { makeFeature } from './automationService.test-utils.js'

describe('isInteractiveAutomation — misty_wanderer (CLA-229)', () => {
    it('returns true for the verbatim live Special Actions row (classes.json 2024 Fey Wanderer lv15 automation array)', () => {
        // Exact bytes from public/data/2024/classes.json feature "Misty Wanderer"
        // (the sole prod misty_wanderer row). Carries the row-entry shape built
        // by infoBuilder/mergeAutomationSpecialActions.
        const feature = {
            name: 'Misty Wanderer',
            description: 'Cast Misty Step without spell slot, uses = Wisdom modifier (minimum once). When casting Misty Step, bring one willing creature within 5 feet to an unoccupied space within 5 feet of your destination.',
            hasAutomation: true,
            automation: [
                { type: 'free_spell', spell: 'Misty Step', uses_expression: 'WIS modifier_min_1', recharge: 'long_rest', casting_time: 'passive', hasAutomation: true },
                { type: 'misty_wanderer', uses_expression: 'WIS modifier_min_1', recharge: 'long_rest', range: '5_ft', casting_time: 'passive', hasAutomation: true },
            ],
        }
        expect(isInteractiveAutomation(feature)).toBe(true)
    })

    it('control: free_spell alone stays inert (deliberate non-add — those rows consume their pool via the spell row, clickable here would misdispatch handleSpellCast)', () => {
        expect(isInteractiveAutomation(makeFeature({ type: 'free_spell', spell: 'Misty Step', uses_expression: 'WIS modifier_min_1', recharge: 'long_rest', casting_time: 'passive', hasAutomation: true }))).toBe(false)
    })

    it('control: misty_wanderer_confirm stays non-interactive (confirm half is invoked directly by MistyWandererModal, never by a row click)', () => {
        expect(isInteractiveAutomation(makeFeature({ type: 'misty_wanderer_confirm' }))).toBe(false)
    })
})
