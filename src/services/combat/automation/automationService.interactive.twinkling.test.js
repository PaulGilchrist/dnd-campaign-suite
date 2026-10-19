// @maintained-by-ai
// CLA-368 regression: twinkling_constellations must be an interactive type so the
// Special Actions "Twinkling Constellations:" row renders clickable and dispatches
// twinklingConstellationHandler (previously missing from INTERACTIVE_HANDLER_TYPES,
// so the row rendered inert <b className=""> text with no click handler — CLA-179 family).
//
// ── interactive-family lane map (row-clickability predicate lane) ──
// Generic isInteractiveAutomation mechanics (bare registered-type lookup, array
// .some scan, unregistered-type / passive-off-table controls) are framework-owned
// by automationService.interactive.test.js (#976, received from #974 fey + #975
// misty lanes) — cited, never re-pinned here. #976's registration census confirms
// twinkling_constellations dispatches through HANDLER_MAP (src/services/automation/
// index.js:376), NOT one of the 4 authored row-branch exceptions (:316-337).
// The predicate has NO extra gating for twinkling beyond type membership
// (automationService.js:110-124 reads auto.type only): the lv<10 info-popup gate,
// turn-start / once-per-turn gates and the constellation chooser modal are handler
// behavior owned by handlers/class-sorcerer/twinklingConstellationHandler.test.js
// (#961); builder bytes live in automationInfoBuilder/starry.test.js; row UI in
// CharSpecialActions.*.test.jsx. NOT re-pinned here.
// THIS lane owns EXCLUSIVELY the CLA-368 ticket-distinct classification bytes:
//   • the verbatim live row (public/data/2024/classes.json Circle of the Stars
//     Druid lv10 "Twinkling Constellations" — sole prod twinkling row): envelope
//     name/description verbatim; automation is the builder's exact output
//     (starry.js:37-45 — prod automation {type, casting_time:'passive'} carries
//     no options key, so CONSTELLATION_OPTIONS ['Archer','Chalice','Dragon'] is
//     injected at build time).
//   • falsifier: the handler's popup-descriptor bytes twinkling_constellations_
//     refused / _advisory (twinklingConstellationHandler.js:45/:81) stay
//     NON-interactive — result payloads, never registered row-dispatch keys.
//     There is no twinkling_constellations_confirm type: the chooser modal
//     confirms internally via applyConstellationOption, never by a row click.
// Old → new map: bare-type-true test folded into the verbatim golden row (the old
// "real row entry" was fabricated — it kept casting_time and hard-coded options in
// the automation, keys the starry.js builder never emits together); array-scan
// test → framework #976 (interactive-faces: array scan + behind-passives rows);
// passive-only control → framework #976 inert-faces battery.
// No timers; turn-based row-click predicate only.
import { describe, it, expect } from 'vitest'
import { isInteractiveAutomation } from './automationService.js'
import { makeFeature } from './automationService.test-utils.js'

describe('isInteractiveAutomation — twinkling_constellations (CLA-368)', () => {
    it('returns true for the verbatim live Special Actions row (classes.json 2024 Circle of the Stars lv10; automation = starry.js builder output)', () => {
        // Envelope name/description: exact bytes from public/data/2024/classes.json
        // [3].majors[3].features[3] (Druid → Circle of the Stars → Twinkling
        // Constellations, level 10 — incl. prod's "Starry Form. you can" punctuation).
        // automation: exact builder output (starry.js:37-45) of that feature's prod
        // automation {type:'twinkling_constellations', casting_time:'passive'} —
        // options injected as CONSTELLATION_OPTIONS because prod data has no options key.
        const feature = {
            name: 'Twinkling Constellations',
            description: 'The constellations of your Starry Form improve. The 1d8 of the Archer and the Chalice becomes 2d8, and while the Dragon is active, you have a Fly Speed of 20 feet and can hover. Moreover, at the start of each of your turns while in your Starry Form. you can change which constellation glimmers on your body.',
            hasAutomation: true,
            automation: {
                type: 'twinkling_constellations',
                name: 'Twinkling Constellations',
                options: ['Archer', 'Chalice', 'Dragon'],
                hasAutomation: true,
            },
        }
        expect(isInteractiveAutomation(feature)).toBe(true)
    })

    it.each([
        ['twinkling_constellations_refused', 'lv<10 / no-Starry-Form refusal popup descriptor (handler.js:45)'],
        ['twinkling_constellations_advisory', 'wrong-turn / already-changed-this-turn popup descriptor (handler.js:81)'],
    ])('control: %s stays row-inert — %s; handler result payload, never a registered row-dispatch key', (type, label) => {
        expect(isInteractiveAutomation(makeFeature({ type })), label).toBe(false)
    })
})
