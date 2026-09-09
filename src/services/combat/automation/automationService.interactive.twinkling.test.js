// CLA-368 regression: twinkling_constellations must be an interactive type so
// the Special Actions "Twinkling Constellations:" row renders clickable and
// dispatches twinklingConstellationHandler (lv<10 info-popup gate + constellation
// chooser modal). Previously missing from INTERACTIVE_HANDLER_TYPES, so the row
// rendered inert <b className=""> text with no click handler (CLA-179 family).
import { describe, it, expect } from 'vitest'
import { isInteractiveAutomation } from './automationService.js'
import { makeFeature } from './automationService.test-utils.js'

// Exact row-entry shape produced by automationInfoBuilder/starry.js and
// pushed to result.specialActions by automationRouter.js:
// { name, description, automation: { type: 'twinkling_constellations', ... } }
function makeTwinklingRowEntry() {
    return {
        name: 'Twinkling Constellations',
        description: '…',
        hasAutomation: true,
        automation: {
            type: 'twinkling_constellations',
            options: ['Archer', 'Chalice', 'Dragon'],
            casting_time: 'passive',
            hasAutomation: true,
        },
    }
}

describe('isInteractiveAutomation — twinkling_constellations (CLA-368)', () => {
    it('returns true for twinkling_constellations automation type', () => {
        expect(isInteractiveAutomation(makeFeature({ type: 'twinkling_constellations' }))).toBe(true)
    })

    it('returns true for the real Special Actions row entry shape', () => {
        expect(isInteractiveAutomation(makeTwinklingRowEntry())).toBe(true)
    })

    it('returns true when twinkling_constellations sits in an automation array', () => {
        const feature = makeFeature([{ type: 'passive_rule', effect: 'something_else' }, { type: 'twinkling_constellations' }])
        expect(isInteractiveAutomation(feature)).toBe(true)
    })

    it('control: returns false for an unregistered passive-only type', () => {
        expect(isInteractiveAutomation(makeFeature({ type: 'passive_rule', effect: 'something_else' }))).toBe(false)
    })
})
