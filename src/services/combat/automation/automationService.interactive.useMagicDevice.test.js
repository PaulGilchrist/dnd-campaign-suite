// @maintained-by-ai
// CLA-374 regression: use_magic_device must be an interactive type so the
// Special Actions "Use Magic Device:" row renders clickable and dispatches
// through executeHandler to handleUseMagicDevice (previously missing from
// INTERACTIVE_HANDLER_TYPES, so the row rendered inert <b className=""> text
// with no onClick — CLA-179/42l family).
//
// ── interactive-family lane map (row-clickability predicate lane) ──
// Generic isInteractiveAutomation mechanics (bare registered-type lookup,
// automation-array .some scan, unregistered-type / passive-off-table controls)
// are framework-owned by automationService.interactive.test.js (#976, received
// from #974 fey + #975 misty lanes) — cited, never re-pinned here. This file's
// old generic legs (bare-type-true :33-35, fabricated row :37-39, array-scan
// :41-44, passive-control :46-48) were the pre-#976 twinkling template copied
// verbatim; all four are cut as now framework-owned. #976's registration census
// (2026-10-19: 50 interactive types = 46 HANDLER_MAP + 4 row-branch) lands
// use_magic_device on the HANDLER_MAP side (src/services/automation/index.js:460
// → handleUseMagicDevice), NOT one of the 4 authored row-branch exceptions.
// The predicate has NO extra gating for use_magic_device beyond type membership
// (automationService.js:110-124 reads auto.type only): the activation/deactivation
// toggle, activeBuffs write, ability_use log and clause popup are handler behavior
// owned by handlers/class-fighter-rogue/useMagicDeviceHandler.test.js; row UI +
// click dispatch by CharSpecialActions.useMagicDevice.test.jsx; builder key-mapping
// bytes by automationInfoBuilder/core-handlers-more.test.js:91; the turn-start buff
// half of the same type by turnStartEffects lanes; CLA-374's separate #964 fix —
// dead INT-advantage modifier removed at automationModifiers.js:117 — is the
// modifier lane (automationModifiers.test.js). NOT re-pinned here.
// THIS lane owns EXCLUSIVELY the CLA-374 ticket-distinct classification bytes:
//   • the verbatim live row (public/data/2024/classes.json [8].majors[3].features[3]
//     Rogue → Thief lv13 "Use Magic Device" — sole prod use_magic_device row):
//     envelope name/description verbatim (ASCII-clean, incl. prod's lowercase
//     "Attunement:"/"Charges:" sentence starts); automation is the builder's exact
//     output (core-handlers.js:373-387 — unlike starry's twinkling builder, this
//     builder passes ALL seven prod automation keys through and stamps name +
//     hasAutomation).
//   • falsifiers: there is NO use_magic_device_confirm/_refused type (grep-verified
//     across src/) — the toggle is self-contained in one row click and terminates in
//     popup payload bytes automation_info (useMagicDeviceHandler.js:25/:59) and log
//     entry type ability_use (:16/:50). Both must stay row-inert: result payloads,
//     never registered row-dispatch keys — registering payload types would make every
//     popup/log payload render clickable (#974/#975 modal-direct-falsifier pattern).
// No timers; turn-based row-click predicate only.
import { describe, it, expect } from 'vitest'
import { isInteractiveAutomation } from './automationService.js'
import { makeFeature } from './automationService.test-utils.js'

describe('isInteractiveAutomation — use_magic_device (CLA-374)', () => {
    it('returns true for the verbatim live Special Actions row (classes.json 2024 Thief lv13; automation = core-handlers.js builder output)', () => {
        // Envelope name/description: exact bytes from public/data/2024/classes.json
        // [8].majors[3].features[3] (Rogue → Thief → Use Magic Device, level 13).
        // automation: exact builder output (core-handlers.js:373-387) of that
        // feature's prod automation {type, attunementLimit:4, chargeReroll:'1d6',
        // chargeRerollSuccess:6, scrollAbility:'INT', scrollCheckDC:'10 + spell_level',
        // scrollDisintegratesOnFail:true, casting_time:'passive'} — builder stamps
        // name + hasAutomation:true on top.
        const feature = {
            name: 'Use Magic Device',
            description: 'Attunement: attune to up to 4 magic items at once. Charges: when using magic item property that expends charges, roll 1d6, on 6 use without expending. Scrolls: use any Spell Scroll, Intelligence as spellcasting ability. Cantrip/level 1: cast reliably. Higher level: succeed on Intelligence (Arcana) check (DC 10 + spell level) to cast. On fail, scroll disintegrates.',
            hasAutomation: true,
            automation: {
                type: 'use_magic_device',
                name: 'Use Magic Device',
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
        expect(isInteractiveAutomation(feature)).toBe(true)
    })

    it.each([
        ['automation_info', 'handler terminal popup payload type (useMagicDeviceHandler.js:25/:59; executeHandler error popup index.js:747)'],
        ['ability_use', 'handler campaign-log entry type (useMagicDeviceHandler.js:16/:50)'],
    ])('control: %s stays row-inert — %s; result payload byte, never a registered row-dispatch key', (type, label) => {
        expect(isInteractiveAutomation(makeFeature({ type })), label).toBe(false)
    })
})
