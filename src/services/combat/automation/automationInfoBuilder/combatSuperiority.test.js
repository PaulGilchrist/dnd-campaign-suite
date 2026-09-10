// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect } from 'vitest'
import { combatSuperiorityHandlers } from './combatSuperiority.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

describe('combatSuperiorityHandlers – combat_superiority', () => {
    it('returns combat_superiority info with defaults', () => {
        const feature = makeFeature({ type: 'combat_superiority' })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'combat_superiority',
            name: 'Test Feature',
            saveType: 'WIS',
            saveAbility: 'STR',
            dieExpression: 'superiority_die',
            usesMax: 4,
            usesRecharge: 'short_rest',
            options: [],
            oncePerTurn: false,
            chooseOne: false,
            hasAutomation: true,
        })
        expect(result.saveDc).toBe('ability')
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({ type: 'combat_superiority', saveDc: 15 })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    // MN-020: the builder must NOT bake a numeric DC — collectAutomationFromFeatures
    // runs before rules.getAbilities folds ability `.bonus`, so baking produced DC 14
    // for a STR +3 lv18 host. The 'ability' token resolves at prompt time via
    // buildSaveDc (CLA-342 precedent).
    it('passes the saveDc token through without baking a number', () => {
        const feature = makeFeature({ type: 'combat_superiority', saveDc: 'ability' })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('STR')
    })

    it('passes through custom saveAbility with the saveDc token', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            saveDc: 'ability',
            saveAbility: 'WIS',
            saveType: 'WIS',
        })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('WIS')
        expect(result.saveType).toBe('WIS')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            dieExpression: '2d8',
            uses_max: 6,
            recharge: 'long_rest',
            oncePerTurn: true,
            chooseOne: true,
        })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.dieExpression).toBe('2d8')
        expect(result.usesMax).toBe(6)
        expect(result.usesRecharge).toBe('long_rest')
        expect(result.oncePerTurn).toBe(true)
        expect(result.chooseOne).toBe(true)
    })

    it('coerces oncePerTurn and chooseOne to boolean', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            oncePerTurn: 1,
            chooseOne: 'yes',
        })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(true)
        expect(result.chooseOne).toBe(true)
    })

    it('handles missing proficiency in playerStats', () => {
        const feature = makeFeature({ type: 'combat_superiority', saveDc: 'ability' })
        const result = combatSuperiorityHandlers.combat_superiority(feature, { ...BASE_STATS, proficiency: undefined })
        expect(result.saveDc).toBe('ability')
    })

    it('handles empty abilities array in playerStats', () => {
        const feature = makeFeature({ type: 'combat_superiority', saveDc: 'ability' })
        const result = combatSuperiorityHandlers.combat_superiority(feature, { ...BASE_STATS, abilities: [] })
        expect(result.saveDc).toBe('ability')
    })

    // MN-020: DC resolution moved to prompt time (buildSaveDc) — a STR +3 PB +6
    // host must resolve 17 there, not the old baked 8 + 0 + 6 = 14.
    it('resolves 17 for a STR +3 PB +6 host via buildSaveDc at prompt time', async () => {
        const { buildSaveDc } = await import('../../../automation/common/savePrompt.js')
        const feature = makeFeature({ type: 'combat_superiority', saveDc: 'ability', saveAbility: ['STR', 'DEX'] })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        const computedStats = {
            proficiency: 6,
            abilities: [
                { name: 'Strength', bonus: 3 },
                { name: 'Dexterity', bonus: 0 },
            ],
        }
        expect(result.saveDc).toBe('ability')
        expect(buildSaveDc(result, computedStats)).toBe(17)
    })
})

describe('combatSuperiorityHandlers – tactical_mind', () => {
    it('returns tactical_mind info with defaults and passes through custom fields', () => {
        const feature = makeFeature({ type: 'tactical_mind', bonusExpression: '+2d4' })
        const result = combatSuperiorityHandlers.tactical_mind(feature, BASE_STATS)

        expect(result.type).toBe('tactical_mind')
        expect(result.name).toBe('Test Feature')
        expect(result.bonusExpression).toBe('+2d4')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom name', () => {
        const feature = makeFeature({ type: 'tactical_mind' }, 'Tactical Genius')
        const result = combatSuperiorityHandlers.tactical_mind(feature, BASE_STATS)
        expect(result.name).toBe('Tactical Genius')
    })
})

describe('combatSuperiorityHandlers – know_enemy', () => {
    it('returns know_enemy info with defaults and passes through custom fields', () => {
        const feature = makeFeature({ type: 'know_enemy', range: '60_ft', uses_max: 6 })
        const result = combatSuperiorityHandlers.know_enemy(feature, BASE_STATS)

        expect(result.type).toBe('know_enemy')
        expect(result.name).toBe('Test Feature')
        expect(result.range).toBe('60_ft')
        expect(result.usesMax).toBe(6)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom name', () => {
        const feature = makeFeature({ type: 'know_enemy' }, 'Know Foe')
        const result = combatSuperiorityHandlers.know_enemy(feature, BASE_STATS)
        expect(result.name).toBe('Know Foe')
    })
})
