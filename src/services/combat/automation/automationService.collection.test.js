// @maintained-by-ai
// CITATION-OWNER (#957/#960): automationService.collection.test.js owns service-level catalog
// categorization — which features the facade collects, what filters them out, and which bucket
// each survivor lands in. Row-bytes belong to the builder lanes; exhaustive type→bucket dispatch
// breadth belongs to the collector lanes.
//
// ── Collector-vs-service split ──────────────────────────────────────────────
// | facet                                             | home                                  |
// | type→bucket breadth matrix (≈100 types)        | automationCollector.types.test.js   |
// | SPECIAL_AUTOMATIONS pre-router exact row bytes | automationCollector.coverage.test.js |
// | builder row shapes (GWF feat, countercharm,     | automationInfoBuilder/*.test.js     |
// | fortified_health rename, font_of_inspiration)    |                                   |
// | filter legs + mixed-roster catalog envelope +   | THIS FILE (via facade import)       |
// | processFeatureAutomation push/dedupe contract    |                                   |
// ─────────────────────────────────────────────────────────────────────────────
// Facade import './automationService.js' is intentional: it pins the service's public
// re-export of collectAutomationFromFeatures/processFeatureAutomation (facade wiring was
// closed in #971's buildAttackInfo lane; the collector lanes import './automationCollector.js'
// directly, so this facade leg would go dark without it).
//
// attack_rider predicate routing (trigger/chooseOne/maxEffects → passives) REMOVED here:
// strict-subset duplicate of automationCollector.types.test.js:252-265, per that file's
// ATTACK_RIDER_OWNER-SPLIT-VERDICT (#2089) which rec'd this exact cut for this turn.
// great_weapon_fighting / fortified_health / countercharm / font_of_inspiration kept as
// CATALOG-BUCKET faces only (type+name fingerprint); their row bytes are cited-owned
// by automationInfoBuilder/damage.test.js, passive.test.js, core-handlers.test.js and
// diverse.test.js respectively — do not re-pin bytes here.
//
// Old → new line map (old file had 27 tests, now 5):
//   old:17  null/undefined/empty buckets        → new "returns nine empty buckets"
//   old:39  no-automation/null skip             → new "filter legs"
//   old:50  empty automation array skip         → new "filter legs"
//   old:66  save_attack/attack_rider/bonus_attacks/resource_pool → actions → golden
//   old:78  healing/buff_ally action split       → golden
//   old:91  warding_bond/font_of_magic actions   → golden (warding_bond name fingerprint)
//   old:98  extra_action bonus_action skip       → golden (row ACTUALLY lands in actions,
//                                                    not skipped — old title was dishonest)
//   old:113 damage_reduction/auto_reroll/reaction_debuff → golden
//   old:124 countercharm reaction                 → golden (bytes: infoBuilder/core-handlers)
//   old:150 passive_rule/evasion/resistance       → golden
//   old:161 fortified_health passive              → golden
//   old:169 font_of_inspiration passive           → golden (now pins dual-bucket too)
//   old:187 combat_stance special                 → golden
//   old:196 attack_rider predicate routing        → REMOVED (types.test.js:252-265 superset)
//   old:222 primalKnowledge skills extract        → golden (exact skills array)
//   old:229 primalKnowledge empty legs            → golden (empty-skills feature)
//   old:246 great_weapon_fighting catalog face    → golden (bytes: infoBuilder/damage.test.js)
//   old:264 mixed categorization                  → golden
//   old:280 array automation per-item             → golden (array feature in roster;
//                                                    CLA-061 Contact Patron stays in types.test.js)
//   old:292 unknown type skip                     → filter legs (full envelope)
//   old:307/315/324 process empty/null buckets    → "returns the empty envelope"
//   old:333/341/353/362 process push/dedupe      → "pushes new rows… deduped by name"
import { describe, it, expect } from 'vitest'

import {
  collectAutomationFromFeatures,
  processFeatureAutomation,
} from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.test-utils.js'

const playerStats = makePlayerStats()

const BUCKETS = ['actions', 'bonusActions', 'reactions', 'specialActions', 'passives', 'autoEffects', 'saveModifiers', 'primalKnowledge', 'ritualSpells']

// Full-catalog fingerprint: every bucket pinned at once so a lost row, a double-push,
// or the specialActions fallback cannot hide. Row objects are fingerprinted as
// {type, name} — builder-owned bytes are pinned in the builder lanes, not here.
function catalog(result) {
    return {
        ...Object.fromEntries(BUCKETS.filter(b => b !== 'primalKnowledge').map(b => [b, result[b].map(({ type, name }) => ({ type, name }))])),
        primalKnowledge: [...result.primalKnowledge],
    }
}

const EMPTY_CATALOG = catalog(Object.fromEntries(BUCKETS.map(b => [b, []])))

// ── collectAutomationFromFeatures (service facade) ─────────────────────────

describe('collectAutomationFromFeatures – input contract', () => {
    it('returns nine empty buckets for null, undefined, and empty feature arrays', () => {
        expect(catalog(collectAutomationFromFeatures(null, playerStats))).toEqual(EMPTY_CATALOG)
        expect(catalog(collectAutomationFromFeatures(undefined, playerStats))).toEqual(EMPTY_CATALOG)
        expect(catalog(collectAutomationFromFeatures([], playerStats))).toEqual(EMPTY_CATALOG)
    })

    it('filters missing/null/empty automations and unknown types, keeping only the automation-bearing survivor', () => {
        const result = collectAutomationFromFeatures([
            { name: 'No Automation' },
            { name: 'Null Automation', automation: null },
            makeFeature([], 'Empty Automation Array'),
            makeFeature({ type: 'some_unknown_type' }, 'Unknown Type'),
            makeFeature({ type: 'warding_bond' }, 'Survivor'),
        ], playerStats)

        // Survivor proves the empty result of the four filter legs is a filter, not a broken collector.
        expect(catalog(result)).toEqual({
            ...EMPTY_CATALOG,
            actions: [{ type: 'warding_bond', name: 'Survivor' }],
        })
    })
})

describe('collectAutomationFromFeatures – mixed roster catalog envelope', () => {
    it('routes every feature to its exact bucket, filtering the non-automation noise', () => {
        const skills = ['Acrobatics', 'Intimidation', 'Perception', 'Stealth', 'Survival']
        const roster = [
            { name: 'Plain Feature' },
            makeFeature({ type: 'save_attack', damageType: 'cold', saveType: 'CON' }, 'Radiance'),
            makeFeature({ type: 'healing', action: 'action' }, 'Action Heal'),
            makeFeature({ type: 'buff_ally', action: 'action' }, 'Group Blessing'),
            makeFeature({ type: 'healing', action: 'bonus_action' }, 'Bonus Heal'),
            makeFeature({ type: 'buff_ally', action: 'bonus_action' }, 'Bonus Blessing'),
            makeFeature({ type: 'extra_action', action: 'bonus_action' }, 'Extra Action'),
            makeFeature({ type: 'resource_pool', resource: 'ki' }, 'Ki Pool'),
            makeFeature({ type: 'font_of_magic' }, 'Font of Magic'),
            makeFeature({ type: 'damage_reduction' }, 'Stone Skin'),
            makeFeature({ type: 'auto_reroll' }, 'Skilled Reroll'),
            makeFeature({ type: 'reaction_debuff' }, 'Vicious Hit'),
            makeFeature({ type: 'countercharm', casting_time: '1 reaction' }, 'Countercharm'),
            makeFeature([{ type: 'save_attack', damageType: 'poison' }, { type: 'resistance', damageTypes: ['fire'] }], 'Multi Automation'),
            makeFeature({ type: 'evasion', saveType: 'DEX' }, 'Evasion'),
            makeFeature({ type: 'font_of_inspiration' }, 'Font of Inspiration'),
            makeFeature({ type: 'combat_stance' }, 'Combat Stance'),
            makeFeature({ type: 'passive_rule', effect: 'fortified_health' }, 'Fortified Health'),
            makeFeature({ type: 'great_weapon_fighting' }, 'Great Weapon Fighting'),
            makeFeature({ type: 'passive_rule', effect: 'primal_knowledge', skills }, 'Primal Knowledge'),
            makeFeature({ type: 'passive_rule', effect: 'primal_knowledge', skills: [] }, 'Empty Primal'),
        ]

        // Hand-derived ONCE from router semantics (save-style/bonus splits, reaction triad,
        // routePassiveSpecial dual-bucket for evasion + font_of_inspiration, passive_rule
        // normalization of great_weapon_fighting, primalKnowledge spread) then pinned — never
        // re-derived by re-running the loop.
        expect(catalog(collectAutomationFromFeatures(roster, playerStats))).toEqual({
            actions: [
                { type: 'save_attack', name: 'Radiance' },
                { type: 'healing', name: 'Action Heal' },
                { type: 'buff_ally', name: 'Group Blessing' },
                // extra_action lands in actions even with action:'bonus_action' — the builder
                // does not carry action through, so routeCtPassiveBonusOrAction takes the default.
                // (The retired old:98 test only checked bonusActions empty and mis-titled this "skipped".)
                { type: 'extra_action', name: 'Extra Action' },
                { type: 'resource_pool', name: 'Ki Pool' },
                { type: 'font_of_magic', name: 'Font of Magic' },
                { type: 'save_attack', name: 'Multi Automation' },
            ],
            bonusActions: [
                { type: 'healing', name: 'Bonus Heal' },
                { type: 'buff_ally', name: 'Bonus Blessing' },
            ],
            reactions: [
                { type: 'damage_reduction', name: 'Stone Skin' },
                { type: 'auto_reroll', name: 'Skilled Reroll' },
                { type: 'reaction_debuff', name: 'Vicious Hit' },
                { type: 'countercharm', name: 'Countercharm' },
            ],
            specialActions: [
                { type: 'evasion', name: 'Evasion' },
                { type: 'font_of_inspiration', name: 'Font of Inspiration' },
                { type: 'combat_stance', name: 'Combat Stance' },
            ],
            passives: [
                { type: 'resistance', name: 'Multi Automation' },
                { type: 'evasion', name: 'Evasion' },
                { type: 'font_of_inspiration', name: 'Font of Inspiration' },
                { type: 'passive_rule', name: 'Fortified Health' },
                { type: 'passive_rule', name: 'Great Weapon Fighting' },
                { type: 'passive_rule', name: 'Primal Knowledge' },
                { type: 'passive_rule', name: 'Empty Primal' },
            ],
            autoEffects: [],
            saveModifiers: [],
            primalKnowledge: skills,
            ritualSpells: [],
        })
    })
})

// ── processFeatureAutomation (wrapper contract, owned here per
//    automationCollector.coverage.test.js header) ───────────────────────────

describe('processFeatureAutomation', () => {
    it('returns the empty envelope for empty or null feature arrays without touching the inputs', () => {
        const emptyInputs = [[], [], [], []]
        expect(catalog(processFeatureAutomation(...emptyInputs, playerStats))).toEqual(EMPTY_CATALOG)
        expect(emptyInputs.every(arr => arr.length === 0)).toBe(true)

        // null arrays must not crash: the collect guard returns before any push.
        expect(catalog(processFeatureAutomation(null, null, null, null, playerStats))).toEqual(EMPTY_CATALOG)
    })

    it('pushes collected action/special rows into their arrays, deduped by name, idempotently', () => {
        const allActions = [{ name: 'Existing', description: '', automation: null }]
        const allSpecialActions = [{ name: 'Existing Special', description: '', automation: null }]
        const allBonusActions = [
            // save_attack collected → actions lane; new name, so it is pushed into allActions
            { name: 'New Action', description: 'Desc', automation: { type: 'save_attack' } },
            // same-name collision: name-dedupe wins even though the existing entry has no automation
            { name: 'Existing', description: 'Dup', automation: { type: 'font_of_magic' } },
            // combat_stance collected → specialActions lane; new name, pushed
            { name: 'New Special', description: 'Desc', automation: { type: 'combat_stance' } },
            { name: 'Existing Special', description: 'Dup', automation: { type: 'combat_stance' } },
        ]

        const automation = processFeatureAutomation(allActions, allBonusActions, [], allSpecialActions, playerStats)
        expect(catalog(automation)).toEqual({
            ...EMPTY_CATALOG,
            actions: [{ type: 'save_attack', name: 'New Action' }, { type: 'font_of_magic', name: 'Existing' }],
            specialActions: [{ type: 'combat_stance', name: 'New Special' }, { type: 'combat_stance', name: 'Existing Special' }],
        })

        expect(allActions).toHaveLength(2)
        expect(allActions[0].name).toBe('Existing')
        expect(allActions[1].name).toBe('New Action')
        // description comes from the collected automation row, not the source feature —
        // the feature's 'Desc' does not propagate through the wrapper.
        expect(allActions[1].description).toBe('')
        expect(allActions[1].hasAutomation).toBe(true)
        expect(allActions[1].automation.type).toBe('save_attack')

        expect(allSpecialActions).toHaveLength(2)
        expect(allSpecialActions[1].name).toBe('New Special')
        expect(allSpecialActions[1].hasAutomation).toBe(true)
        expect(allSpecialActions[1].automation.type).toBe('combat_stance')

        // Second pass over the same names adds nothing.
        processFeatureAutomation(allActions, allBonusActions, [], allSpecialActions, playerStats)
        expect(allActions).toHaveLength(2)
        expect(allSpecialActions).toHaveLength(2)
    })
})
