// @maintained-by-ai
// ── INTERACTIVE LANE: fey_reinforcements row clickability (CLA-138, #961 family) ──
// Dead-button regression (commit "Fey Reinforcements — Special Actions button not
// wired up"): 'fey_reinforcements' was missing from INTERACTIVE_HANDLER_TYPES, so
// the Special Actions "Fey Reinforcements:" row rendered inert text instead of a
// clickable button (CLA-179/CLA-200/CLA-229 family). This lane pins ONLY the
// predicate that makes the row clickable in CharSpecialActions.jsx:938.
// Owned contract: the authored CLA-138 row (public/data/2024/classes.json, single
// half, casting_time 'passive') is interactive so the row dispatches through
// HANDLER_MAP fey_reinforcements → handleFeyReinforcements (automation/index.js:429).
// NOT this lane (cited, never re-run):
//   • automation/handlers/class-warlock/feyReinforcementsHandler.test.js — handle/
//     confirm internals, free-cast latch, popup-vs-modal bytes (CLA-138 owner).
//   • services/rules/spells/spellPreparationService.cla138-fey-reinforcements.test.js
//     — no-Concentration choice + free-cast consumption (CLA-138 owner).
//   • FeyReinforcementsModal.test.jsx — modal UI; automationCollector.types.test.js:67
//     — router bucket routing for this type.
//   • Generic isInteractiveAutomation mechanics (array .some scan, absent-automation
//     guard) owned by automationService.interactive.test.js (#961) — only the
//     fey-specific halves are pinned here.
// Old → new: true-type → strengthened with verbatim authored row bytes, array-half
// case folded into the same test; false-no-automation + array folded into a
// falsifier table that adds the lane-specific fey_reinforcements_confirm falsifier
// (index.js:430 — the confirm half is dispatched BY the modal, never as a row).
// Pure predicate: zero mocks, zero timers, zero writes; turn-based row click only.
import { describe, it, expect } from 'vitest'
import { isInteractiveAutomation } from './automationService.js'

// Exact authored automation bytes from public/data/2024/classes.json (Fey
// Reinforcements, 2024 Ranger lv11) in the row-entry shape CharSpecialActions
// passes to the predicate ({ name, description, automation, hasAutomation }).
function makeFeyRow(automation) {
  return {
    name: 'Fey Reinforcements',
    description: 'Cast Summon Fey without Material component.',
    hasAutomation: true,
    automation,
  }
}

const AUTHORED_FEY_AUTOMATION = {
  type: 'fey_reinforcements',
  spell: 'Summon Fey',
  uses_expression: '1',
  usesMax: 1,
  recharge: 'long_rest',
  action: 'action',
  duration: 'Concentration, up to 1 hour',
  casting_time: 'passive',
}

describe('isInteractiveAutomation — fey_reinforcements (CLA-138)', () => {
  it('makes the authored Fey Reinforcements row clickable, object or array half', () => {
    // Single-object half is the authored shape; the array form keeps the row
    // clickable if the feature ever gains sibling automation halves.
    expect(isInteractiveAutomation(makeFeyRow(AUTHORED_FEY_AUTOMATION))).toBe(true)
    expect(isInteractiveAutomation(makeFeyRow([AUTHORED_FEY_AUTOMATION]))).toBe(true)
  })

  it('keeps inert rows inert: absent automation and the modal-only confirm type', () => {
    // fey_reinforcements_confirm lives in HANDLER_MAP (index.js:430) but is
    // dispatched BY FeyReinforcementsModal's confirm with modal payload — making
    // it an interactive row type would fire the confirm handler sans payload.
    const inert = [
      makeFeyRow(undefined),
      makeFeyRow(null),
      makeFeyRow({ type: 'fey_reinforcements_confirm' }),
    ]
    for (const feature of inert) {
      expect(isInteractiveAutomation(feature), `should be inert: ${JSON.stringify(feature.automation)}`).toBe(false)
    }
  })
})
