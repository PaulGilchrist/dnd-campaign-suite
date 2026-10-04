// MN-004: Commanding Presence reaction row never rendered — DISPATCH had no
// combat_superiority_commanding_presence_reaction entry, so the collector's
// `if (!info) continue` dropped the feature before it reached automation.reactions.
// The router already mapped the type to reactions; only the builder was missing.
import { describe, it, expect } from 'vitest'
import { combatSuperiorityHandlers } from './combatSuperiority.js'
import { collectAutomationFromFeatures } from '../automationCollector.js'
import { BASE_STATS } from '../automationInfoBuilder.test-utils.js'

const REACTION_AUTO = {
    type: 'combat_superiority_commanding_presence_reaction',
    maneuverName: 'Commanding Presence',
    reactionSaveType: 'WIS',
    reactionEffect: 'disadvantage_next_attack',
    reactionDuration: 'until_end_of_next_turn',
    reactionRange: '30_ft',
    saveDc: 'ability',
    saveAbility: 'CHA',
    hasAutomation: true,
}

function makeReactionFeature() {
    return {
        name: 'Commanding Presence (Reaction)',
        description: 'When a creature you can see within 30 feet makes an ability check, you can expend one superiority die...',
        automation: REACTION_AUTO,
        hasAutomation: true,
    }
}

describe('MN-004 combat_superiority_commanding_presence_reaction builder', () => {
    it('DISPATCH has the reaction entry', () => {
        expect(combatSuperiorityHandlers.combat_superiority_commanding_presence_reaction).toBeTypeOf('function')
    })

    it('builds reaction info with reaction fields and the ability saveDc token', () => {
        const feature = { name: 'Commanding Presence (Reaction)', description: 'desc', automation: REACTION_AUTO }
        const result = combatSuperiorityHandlers.combat_superiority_commanding_presence_reaction(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'combat_superiority_commanding_presence_reaction',
            name: 'Commanding Presence (Reaction)',
            maneuverName: 'Commanding Presence',
            reactionSaveType: 'WIS',
            reactionEffect: 'disadvantage_next_attack',
            reactionDuration: 'until_end_of_next_turn',
            reactionRange: '30_ft',
            hasAutomation: true,
        })
        // MN-020: never bake a numeric DC at collect time.
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('CHA')
    })

    it('defaults save fields when absent from the feature automation', () => {
        const feature = {
            name: 'X (Reaction)',
            description: '',
            automation: { type: 'combat_superiority_commanding_presence_reaction' },
        }
        const result = combatSuperiorityHandlers.combat_superiority_commanding_presence_reaction(feature, BASE_STATS)
        expect(result).toMatchObject({
            reactionSaveType: 'WIS',
            reactionEffect: 'disadvantage_next_attack',
            reactionDuration: 'until_end_of_next_turn',
            reactionRange: '30_ft',
            saveDc: 'ability',
            saveAbility: 'CHA',
        })
    })

    it('collector keeps the feature and routes it into automation.reactions', () => {
        const automation = collectAutomationFromFeatures([makeReactionFeature()], BASE_STATS)
        const row = automation.reactions.find(r => r.type === 'combat_superiority_commanding_presence_reaction')
        expect(row).toBeDefined()
        expect(row).toMatchObject({
            name: 'Commanding Presence (Reaction)',
            maneuverName: 'Commanding Presence',
            reactionSaveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            hasAutomation: true,
        })
    })
})
