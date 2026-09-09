// CLA-374 regression: use_magic_device must be an interactive type so the
// Special Actions "Use Magic Device:" row renders clickable and dispatches
// handleUseMagicDevice (CLA-368 twinkling_constellations template). Previously
// missing from INTERACTIVE_HANDLER_TYPES, so the row rendered inert
// <b className=""> text with no onClick (CLA-179/42l family).
import { describe, it, expect } from 'vitest'
import { isInteractiveAutomation } from './automationService.js'
import { makeFeature } from './automationService.test-utils.js'

// Exact row-entry shape produced by automationInfoBuilder/core-handlers.js
// 'use_magic_device' and pushed to result.specialActions by
// automationRouter.js:515-518 (2024 Thief lv13 ground truth):
function makeUseMagicDeviceRowEntry() {
    return {
        name: 'Use Magic Device',
        description: 'Attunement: attune to up to 4 magic items at once.',
        hasAutomation: true,
        automation: {
            type: 'use_magic_device',
            attunementLimit: 4,
            chargeReroll: '1d6',
            chargeRerollSuccess: 6,
            scrollAbility: 'INT',
            scrollCheckDC: '10 + spell_level',
            scrollDisintegratesOnFail: true,
            casting_time: 'passive',
            hasAutomation: true,
        },
    }
}

describe('isInteractiveAutomation — use_magic_device (CLA-374)', () => {
    it('returns true for use_magic_device automation type', () => {
        expect(isInteractiveAutomation(makeFeature({ type: 'use_magic_device' }))).toBe(true)
    })

    it('returns true for the real Special Actions row entry shape', () => {
        expect(isInteractiveAutomation(makeUseMagicDeviceRowEntry())).toBe(true)
    })

    it('returns true when use_magic_device sits in an automation array', () => {
        const feature = makeFeature([{ type: 'passive_rule', effect: 'something_else' }, { type: 'use_magic_device' }])
        expect(isInteractiveAutomation(feature)).toBe(true)
    })

    it('control: returns false for an unregistered passive-only type', () => {
        expect(isInteractiveAutomation(makeFeature({ type: 'passive_rule', effect: 'something_else' }))).toBe(false)
    })
})
