// @maintained-by-ai
import { describe, it, expect } from 'vitest'

import { conditionalHandlers } from './conditional.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// Unit home for conditional.js envelope VALUES. Dispatch through the facade and
// registry liveness are pinned by automationInfoBuilder.test.js; modifier
// extraction by automationModifiers.test.js; collector routing by
// automationCollector.*.test.js. This file pins exact output envelopes only —
// every custom value is deliberately distinct from its default so a silently
// hardcoded field fails (input-equals-default blindness audit).
//
// Inputs are verbatim disk anchors (path cited inline) or explicitly labelled
// synthetic discriminating feeds (machinery-tests — real features never carry
// these exact shapes; they exist to separate read-vs-hardcoded arms).

// ── exact envelopes: discriminating custom feeds ─────────────────────

const CUSTOM_CASES = [
    {
        // Synthetic: effect 'disadvantage' through the ADVANTAGE builder proves
        // effect is read from automation, not hardcoded (mirrored in the
        // disadvantage case below — no default leaks across builders).
        handler: 'conditional_advantage',
        automation: {
            target: 'ability_check',
            condition: 'adjacent_to_enemy',
            effect: 'disadvantage',
            abilities: ['STR', 'DEX'],
            uses: 3,
            recharge: 'short_rest',
            casting_time: '1 action',
            trigger: 'on_spell_cast'
        },
        expected: {
            type: 'conditional_advantage',
            name: 'Test Feature',
            target: 'ability_check',
            condition: 'adjacent_to_enemy',
            effect: 'disadvantage',
            abilities: ['STR', 'DEX'],
            uses: 3,
            recharge: 'short_rest',
            casting_time: '1 action',
            trigger: 'on_spell_cast',
            hasAutomation: true
        }
    },
    {
        // Synthetic (see above): effect 'advantage' through the DISADVANTAGE builder.
        handler: 'conditional_disadvantage',
        automation: {
            target: 'saving_throw',
            condition: 'below_half_hp',
            effect: 'advantage',
            abilities: ['CON']
        },
        expected: {
            type: 'conditional_disadvantage',
            name: 'Test Feature',
            target: 'saving_throw',
            condition: 'below_half_hp',
            effect: 'advantage',
            abilities: ['CON'],
            hasAutomation: true
        }
    },
    {
        // Verbatim public/data/2024/classes.json conditional_replacement
        // (psionic psion-shown mechanics); casting_time is on disk but the
        // builder drops it — exact toEqual pins that truncation.
        handler: 'conditional_replacement',
        automation: {
            target: 'ability_check',
            saveType: 'STR',
            condition: 'low_total',
            effect: 'replacement',
            replacementAbility: 'STR',
            casting_time: 'passive'
        },
        expected: {
            type: 'conditional_replacement',
            name: 'Test Feature',
            target: 'ability_check',
            saveType: 'STR',
            condition: 'low_total',
            effect: 'replacement',
            replacementAbility: 'STR',
            hasAutomation: true
        }
    },
    {
        // Synthetic: Rage-shaped immunity (public/data/2024/classes.json uses
        // target 'self', identical to the default — this feed uses a
        // non-default target so target-read vs default is distinguishable.
        handler: 'condition_immunity_while_active',
        automation: {
            target: 'allies_in_range',
            immunities: ['charmed', 'frightened'],
            requiresActive: 'aura_of_protection'
        },
        expected: {
            type: 'condition_immunity_while_active',
            name: 'Test Feature',
            target: 'allies_in_range',
            immunities: ['charmed', 'frightened'],
            requiresActive: 'aura_of_protection',
            hasAutomation: true
        }
    },
    {
        // Synthetic: saveType 'CON' distinguishes read from the hardcoded
        // 'DEX' default. shareable:'yes' pins the !! coercion (non-boolean
        // truthy → true) and shareRange:'30' pins verbatim token passthrough
        // (|| does not coerce numbers) — observed behavior, not sanitized.
        handler: 'evasion',
        automation: { saveType: 'CON', shareable: 'yes', shareRange: '30' },
        expected: {
            type: 'evasion',
            name: 'Test Feature',
            saveType: 'CON',
            shareable: true,
            shareRange: '30',
            hasAutomation: true
        }
    },
    {
        // Verbatim public/data/feats.json Brawny save_proficiency.
        handler: 'save_proficiency',
        automation: {
            saveType: 'Strength',
            fallbackTypes: ['Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
        },
        expected: {
            type: 'save_proficiency',
            name: 'Test Feature',
            saveType: 'Strength',
            fallbackTypes: ['Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'],
            hasAutomation: true
        }
    }
]

// ── exact envelopes: empty-automation defaults arm ───────────────────

const DEFAULTS_CASES = [
    {
        handler: 'conditional_advantage',
        expected: {
            type: 'conditional_advantage',
            name: 'Test Feature',
            target: 'saving_throw',
            condition: '',
            effect: 'advantage',
            abilities: [],
            uses: null,
            recharge: 'long_rest',
            casting_time: 'passive',
            trigger: '',
            hasAutomation: true
        }
    },
    {
        handler: 'conditional_disadvantage',
        expected: {
            type: 'conditional_disadvantage',
            name: 'Test Feature',
            target: 'attack_roll',
            condition: '',
            effect: 'disadvantage',
            abilities: [],
            hasAutomation: true
        }
    },
    {
        handler: 'conditional_replacement',
        expected: {
            type: 'conditional_replacement',
            name: 'Test Feature',
            target: 'saving_throw',
            saveType: '',
            condition: '',
            effect: '',
            replacementAbility: '',
            hasAutomation: true
        }
    },
    {
        handler: 'condition_immunity_while_active',
        expected: {
            type: 'condition_immunity_while_active',
            name: 'Test Feature',
            target: 'self',
            immunities: [],
            requiresActive: '',
            hasAutomation: true
        }
    },
    {
        handler: 'evasion',
        expected: {
            type: 'evasion',
            name: 'Test Feature',
            saveType: 'DEX',
            shareable: false,
            shareRange: 0,
            hasAutomation: true
        }
    },
    {
        handler: 'save_proficiency',
        expected: {
            type: 'save_proficiency',
            name: 'Test Feature',
            saveType: '',
            fallbackTypes: [],
            hasAutomation: true
        }
    }
]

describe('conditional builders – custom feeds, exact envelope', () => {
    it.each(CUSTOM_CASES)('$handler reads every field', ({ handler, automation, expected }) => {
        expect(conditionalHandlers[handler](makeFeature(automation), BASE_STATS)).toEqual(expected)
    })
})

describe('conditional builders – empty automation, exact defaults envelope', () => {
    it.each(DEFAULTS_CASES)('$handler', ({ handler, expected }) => {
        expect(conditionalHandlers[handler](makeFeature({}), BASE_STATS)).toEqual(expected)
    })
})

describe('conditional builders – hardcoded fields cannot be overridden', () => {
    it.each(Object.keys(conditionalHandlers))(
        '%s hardcodes type/name despite poison input',
        (handler) => {
            const result = conditionalHandlers[handler](
                makeFeature({ type: 'poison_type', name: 'poison_name' }, 'Real Name'),
                BASE_STATS
            )
            expect(result.type).toBe(handler)
            expect(result.name).toBe('Real Name')
            expect(result.hasAutomation).toBe(true)
        }
    )
})

describe('conditional_advantage – loose || truthiness quirks (pinned as observed)', () => {
    it('collapses every falsy automation value to the || default', () => {
        const result = conditionalHandlers.conditional_advantage(makeFeature({
            target: '',
            condition: '',
            effect: '',
            abilities: [],
            uses: 0,
            recharge: '',
            casting_time: '',
            trigger: ''
        }), BASE_STATS)

        // uses:0 → null is the load-bearing quirk: a zero-use feature reports
        // unlimited (null), NOT 0. Pinned honestly, not sanitized.
        expect(result).toEqual({
            type: 'conditional_advantage',
            name: 'Test Feature',
            target: 'saving_throw',
            condition: '',
            effect: 'advantage',
            abilities: [],
            uses: null,
            recharge: 'long_rest',
            casting_time: 'passive',
            trigger: '',
            hasAutomation: true
        })
    })
})

// ── passive_rule: three-way branch on effect (=== 'ignore_resistance') ──

describe('passive_rule', () => {
    it('ignore_resistance: short envelope, generic fields truncated despite poison input', () => {
        // damageTypes verbatim public/data/2024/feats.json (Crushing-advance-style feat);
        // generic fields added as poison to prove the branch drops them.
        const result = conditionalHandlers.passive_rule(makeFeature({
            effect: 'ignore_resistance',
            damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
            casting_time: '1 action',
            bonusExpression: '+2d6',
            criticalRange: '18-20',
            spells: ['fire bolt'],
            riderSave: 'DEX',
            skills: ['stealth'],
            resistanceTypes: ['fire'],
            duration: '1_minute',
            endsOnCondition: 'blinded',
            resource: 'ki'
        }), BASE_STATS)

        expect(result).toEqual({
            type: 'passive_rule',
            name: 'Test Feature',
            effect: 'ignore_resistance',
            damageTypes: ['Bludgeoning', 'Piercing', 'Slashing'],
            hasAutomation: true
        })
    })

    it.each([
        {
            // Verbatim near-miss token public/data/feats.json: effect is
            // DISTINCT from the branch key (=== not startsWith), so it routes
            // generic with the token verbatim and damageTypes dropped.
            label: 'public/data/feats.json ignore_resistance_and_treat_1s_as_2s',
            automation: {
                effect: 'ignore_resistance_and_treat_1s_as_2s',
                damageTypes: ['player_choice'],
                casting_time: '1 action'
            },
            effect: 'ignore_resistance_and_treat_1s_as_2s'
        },
        {
            label: 'missing effect routes generic as empty string',
            automation: {},
            effect: ''
        }
    ])('$label routes generic arm', ({ automation, effect }) => {
        const result = conditionalHandlers.passive_rule(makeFeature(automation), BASE_STATS)

        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe(effect)
        expect(result.hasAutomation).toBe(true)
        expect(result).not.toHaveProperty('damageTypes')
    })

    it('generic arm maps skills→primalKnowledge and carries casting_time verbatim', () => {
        // Verbatim public/data/2024/classes.json primal_knowledge passive_rule.
        const result = conditionalHandlers.passive_rule(makeFeature({
            effect: 'primal_knowledge',
            skills: ['Acrobatics', 'Intimidation', 'Perception', 'Stealth', 'Survival'],
            casting_time: 'passive'
        }), BASE_STATS)

        expect(result).toEqual({
            type: 'passive_rule',
            name: 'Test Feature',
            effect: 'primal_knowledge',
            bonusExpression: '',
            criticalRange: '',
            spells: [],
            riderSave: null,
            primalKnowledge: ['Acrobatics', 'Intimidation', 'Perception', 'Stealth', 'Survival'],
            casting_time: 'passive',
            cost: 0,
            resource: '',
            resistanceTypes: [],
            duration: '',
            endsOnCondition: '',
            hasAutomation: true
        })
    })
})
