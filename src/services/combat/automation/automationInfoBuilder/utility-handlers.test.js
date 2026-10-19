// @maintained-by-ai
import { describe, it, expect } from 'vitest'
import { utilityHandlers } from './utility-handlers.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// Lane owner: utility-handlers.js { brew_poison, apply_poison } envelopes.
// misc.test.js pins ONLY the aggregator merge contract and cites this file as
// the envelope owner — no duplication there. save.test-utils.js is orphaned;
// this file does NOT import it (fixtures come from ../automationInfoBuilder.test-utils.js).
//
// Both handlers hardcode `type` (the automation object's own type field is inert),
// source description from the FEATURE top level (module-wide convention), and
// dereference feature.automation unguarded — pinned by the throw test below.
// BASE_STATS: proficiency 3, DEX 2, INT 1 → poisonerAbilityModifier 2, saveDc 8+2+3=13.
const featureWithDesc = (automation, description) =>
    ({ ...makeFeature(automation), description })

describe('utilityHandlers – census', () => {
    it('owns exactly two handlers, in authored order', () => {
        expect(Object.keys(utilityHandlers)).toEqual(['brew_poison', 'apply_poison'])
    })
})

describe('utilityHandlers – brew_poison', () => {
    it('exact envelope: absent fields, empty strings, and explicit overrides', () => {
        const defaults = {
            type: 'brew_poison',
            name: 'Test Feature',
            description: '',
            casting_time: 'passive',
            hasAutomation: true,
        }
        // Absent automation fields fall back via ||.
        expect(utilityHandlers.brew_poison(makeFeature({}), BASE_STATS)).toEqual(defaults)

        // Explicit empty strings hit the same || sites → identical defaults envelope.
        expect(utilityHandlers.brew_poison(
            makeFeature({ casting_time: '' }),
            BASE_STATS
        )).toEqual(defaults)

        // Provided values pass through verbatim (|| truthy survivors, exact bytes).
        // automation.description is INERT — description sources from feature top level.
        expect(utilityHandlers.brew_poison(
            featureWithDesc({ casting_time: '1 action', description: 'INERT' }, 'Simmer for an hour.'),
            BASE_STATS
        )).toEqual({
            ...defaults,
            description: 'Simmer for an hour.',
            casting_time: '1 action',
        })
    })
})

describe('utilityHandlers – apply_poison', () => {
    it('exact envelope: defaults for absent fields AND explicit empty strings (|| sites)', () => {
        const defaults = {
            type: 'apply_poison',
            name: 'Test Feature',
            description: '',
            casting_time: '1 bonus action',
            damageExpression: '2d8',
            damageType: 'Poison',
            condition: 'poisoned',
            saveType: 'CON',
            saveDc: 13,
            poisonerAbilityModifier: 2,
            hasAutomation: true,
        }
        expect(utilityHandlers.apply_poison(makeFeature({}), BASE_STATS)).toEqual(defaults)
        expect(utilityHandlers.apply_poison(makeFeature({
            casting_time: '', damageExpression: '', damageType: '',
            condition: '', saveType: '', description: 'INERT',
        }), BASE_STATS)).toEqual(defaults)
    })

    it('exact envelope: every automation override passes through verbatim', () => {
        // description is sourced from the FEATURE top level, not automation.
        const result = utilityHandlers.apply_poison(featureWithDesc({
            casting_time: '1 action',
            damageExpression: '4d6',
            damageType: 'Necrotic',
            condition: 'stunned',
            saveType: 'WIS',
            description: 'INERT',
        }, 'A cloud of rot.'), BASE_STATS)
        expect(result).toEqual({
            type: 'apply_poison',
            name: 'Test Feature',
            description: 'A cloud of rot.',
            casting_time: '1 action',
            damageExpression: '4d6',
            damageType: 'Necrotic',
            condition: 'stunned',
            saveType: 'WIS',
            saveDc: 13,
            poisonerAbilityModifier: 2,
            hasAutomation: true,
        })
    })

    // saveDc = 8 + max(DEX, INT) + (proficiency || 0); mods resolve via ?? 0.
    it('computes saveDc/poisonerAbilityModifier across DEX/INT/proficiency boundaries', () => {
        const withAbilities = (dex, int) => ({
            ...BASE_STATS,
            abilities: [
                { name: 'Dexterity', bonus: dex },
                { name: 'Intelligence', bonus: int },
            ],
        })
        const rows = [
            ['DEX higher (BASE_STATS)', BASE_STATS, [13, 2]],
            ['INT higher', withAbilities(0, 4), [15, 4]],
            ['tie picks either', withAbilities(3, 3), [14, 3]],
            ['negative modifiers', withAbilities(-1, -3), [10, -1]],
            ['proficiency || 0 when missing',
                { level: 5, abilities: BASE_STATS.abilities }, [10, 2]],
            ['abilities and proficiency both missing → zeros',
                { level: 1 }, [8, 0]],
        ]
        for (const [label, stats, expected] of rows) {
            const result = utilityHandlers.apply_poison(makeFeature({}), stats)
            expect([result.saveDc, result.poisonerAbilityModifier], label).toEqual(expected)
        }
    })

    it('both handlers throw TypeError when feature.automation is absent (unguarded deref)', () => {
        const bare = { name: 'Bare Feature' }
        expect(() => utilityHandlers.brew_poison(bare, BASE_STATS)).toThrow(TypeError)
        expect(() => utilityHandlers.apply_poison(bare, BASE_STATS)).toThrow(TypeError)
    })
})
