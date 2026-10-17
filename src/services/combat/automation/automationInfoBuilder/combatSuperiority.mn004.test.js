// @maintained-by-ai
// MN-004: Commanding Presence reaction row never rendered — DISPATCH had no
// combat_superiority_commanding_presence_reaction entry, so the collector's
// `if (!info) continue` dropped the feature before it reached automation.reactions.
// The router already mapped the type to reactions; only the builder was missing.
// Envelope values anchored VERBATIM to the public/data/2024/maneuvers.json disk row
// (WIS save, disadvantage_next_attack until_end_of_next_turn, 30_ft, Charisma → CHA).
// Routing breadth lives in automationCollector.types.test.js, but that matrix has no
// row for this type — test 3 pins this lane's bucket exclusivity end-to-end.
import { describe, it, expect } from 'vitest'
import { combatSuperiorityHandlers } from './combatSuperiority.js'
import { collectAutomationFromFeatures } from '../automationCollector.js'
import { BASE_STATS } from '../automationInfoBuilder.test-utils.js'

const FEATURE_NAME = 'Commanding Presence (Reaction)'
const MINIMAL_NAME = 'X (Reaction)'
const DESCRIPTION = 'When a creature you can see within 30 feet makes an ability check, you can expend one superiority die...'

// Automation shape as authored from the disk row (plus the dispatch type).
const AUTO = {
    type: 'combat_superiority_commanding_presence_reaction',
    maneuverName: 'Commanding Presence',
    reactionSaveType: 'WIS',
    reactionEffect: 'disadvantage_next_attack',
    reactionDuration: 'until_end_of_next_turn',
    reactionRange: '30_ft',
    saveAbility: 'CHA',
}

// Builder output is exactly these 11 keys — the collector pushes the info
// verbatim, so the same envelope re-anchors the routed row.
const FULL_ENVELOPE = {
    type: 'combat_superiority_commanding_presence_reaction',
    name: FEATURE_NAME,
    description: DESCRIPTION,
    maneuverName: 'Commanding Presence',
    reactionSaveType: 'WIS',
    reactionEffect: 'disadvantage_next_attack',
    reactionDuration: 'until_end_of_next_turn',
    reactionRange: '30_ft',
    saveDc: 'ability',
    saveAbility: 'CHA',
    hasAutomation: true,
}

function builder(feature) {
    return combatSuperiorityHandlers.combat_superiority_commanding_presence_reaction(feature, BASE_STATS)
}

describe('MN-004 combat_superiority_commanding_presence_reaction builder', () => {
    it('builds the exact disk-row envelope and a baked numeric saveDc never survives', () => {
        // MN-020: saveDc is hardcoded to the 'ability' token — collect-time numeric DCs
        // bake before ability .bonus folds, so even a poisoned input DC must not pass.
        const feature = { name: FEATURE_NAME, description: DESCRIPTION, automation: { ...AUTO, saveDc: 19 } }
        expect(builder(feature)).toEqual(FULL_ENVELOPE)
    })

    it('reads reaction fields from automation, falling back to disk-row defaults when absent', () => {
        const custom = builder({
            name: 'Maneuver X (Reaction)',
            description: 'custom desc',
            automation: {
                ...AUTO,
                maneuverName: 'Maneuver X',
                reactionSaveType: 'INT',
                reactionEffect: 'frightened',
                reactionDuration: '1_minute',
                reactionRange: '60_ft',
                saveAbility: 'WIS',
            },
        })
        expect(custom).toEqual({
            ...FULL_ENVELOPE,
            name: 'Maneuver X (Reaction)',
            description: 'custom desc',
            maneuverName: 'Maneuver X',
            reactionSaveType: 'INT',
            reactionEffect: 'frightened',
            reactionDuration: '1_minute',
            reactionRange: '60_ft',
            saveAbility: 'WIS',
        })

        // Minimal automation: every default is load-bearing (and CHA matches the
        // disk row's Charisma save anchor), maneuverName falls back to feature name.
        expect(builder({ name: MINIMAL_NAME, automation: { type: AUTO.type } })).toEqual({
            ...FULL_ENVELOPE,
            name: MINIMAL_NAME,
            description: '',
            maneuverName: MINIMAL_NAME,
        })
    })

    it('collector keeps the row, routes it into automation.reactions and nowhere else, envelope intact', () => {
        const automation = collectAutomationFromFeatures(
            [{ name: FEATURE_NAME, description: DESCRIPTION, automation: AUTO }],
            BASE_STATS,
        )
        const BUCKETS = ['actions', 'bonusActions', 'reactions', 'specialActions', 'passives', 'autoEffects', 'saveModifiers', 'primalKnowledge', 'ritualSpells']
        expect(Object.fromEntries(BUCKETS.map(b => [b, automation[b].map(r => r.type)])))
            .toEqual({ ...Object.fromEntries(BUCKETS.map(b => [b, []])), reactions: [AUTO.type] })
        // Same envelope as the direct builder call — the collector stamps nothing.
        expect(automation.reactions[0]).toEqual(FULL_ENVELOPE)
    })
})
