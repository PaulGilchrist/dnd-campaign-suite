import { describe, it, expect } from 'vitest'
import { coreHandlers } from './core-handlers.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// ── modify_d20_roll ──────────────────────────────────────────────────

describe('coreHandlers – modify_d20_roll', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'modify_d20_roll' })
        const result = coreHandlers.modify_d20_roll(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'modify_d20_roll',
            modifier: '2d4',
            range: '60 ft',
            canBeBonusOrPenalty: false,
            recharge: 'initiative_or_short_or_long_rest',
            casting_time: '1 reaction',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── fast_hands ───────────────────────────────────────────────────────

describe('coreHandlers – fast_hands', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'fast_hands' })
        const result = coreHandlers.fast_hands(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'fast_hands',
            options: [],
            casting_time: '1 bonus action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── use_magic_device ─────────────────────────────────────────────────

describe('coreHandlers – use_magic_device', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'use_magic_device' })
        const result = coreHandlers.use_magic_device(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'use_magic_device',
            attunementLimit: 4,
            chargeReroll: '1d6',
            chargeRerollSuccess: 6,
            scrollAbility: 'INT',
            scrollCheckDC: '10 + spell_level',
            scrollDisintegratesOnFail: false,
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── wild_magic_surge ─────────────────────────────────────────────────

describe('coreHandlers – wild_magic_surge', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'wild_magic_surge' })
        const result = coreHandlers.wild_magic_surge(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'wild_magic_surge',
            trigger: '',
            oncePerTurn: false,
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── wild_magic_tamed ─────────────────────────────────────────────────

describe('coreHandlers – wild_magic_tamed', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'wild_magic_tamed' })
        const result = coreHandlers.wild_magic_tamed(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'wild_magic_tamed',
            trigger: '',
            recharge: 'long_rest',
            uses: 1,
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── feats_of_chaos ───────────────────────────────────────────────────

describe('coreHandlers – feats_of_chaos', () => {
    it('returns feats_of_chaos type with defaults', () => {
        const feature = makeFeature({ type: 'feats_of_chaos' })
        const result = coreHandlers.feats_of_chaos(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'feats_of_chaos',
            target: 'd20',
            condition: 'feats_of_chaos_active',
            effect: 'advantage',
            abilities: [],
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── multi_target_spread ──────────────────────────────────────────────

describe('coreHandlers – multi_target_spread', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'multi_target_spread' })
        const result = coreHandlers.multi_target_spread(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'multi_target_spread',
            spellFilter: [],
            range: '10 ft',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── radiant_soul ─────────────────────────────────────────────────────

describe('coreHandlers – radiant_soul', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'radiant_soul' })
        const result = coreHandlers.radiant_soul(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'radiant_soul',
            damageTypes: [],
            damageExpression: '',
            oncePerTurn: false,
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── celestial_resilience ─────────────────────────────────────────────

describe('coreHandlers – celestial_resilience', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'celestial_resilience' })
        const result = coreHandlers.celestial_resilience(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'celestial_resilience',
            tempHpExpression: '',
            allyTempHpExpression: '',
            maxAllies: 5,
            range: '60_ft',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── dark_ones_luck ───────────────────────────────────────────────────

describe('coreHandlers – dark_ones_luck', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'dark_ones_luck' })
        const result = coreHandlers.dark_ones_luck(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'dark_ones_luck',
            diceExpression: '1d10',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── hurl_through_hell ────────────────────────────────────────────────

describe('coreHandlers – hurl_through_hell', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'hurl_through_hell' })
        const result = coreHandlers.hurl_through_hell(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'hurl_through_hell',
            damageExpression: '',
            damageType: '',
            saveType: 'CHA',
            saveDc: 'ability',
            saveAbility: 'CHA',
            oncePerTurn: false,
            uses: 1,
            pactMagicRecharge: false,
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── clairvoyant_combatant ────────────────────────────────────────────

describe('coreHandlers – clairvoyant_combatant', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'clairvoyant_combatant' })
        const result = coreHandlers.clairvoyant_combatant(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'clairvoyant_combatant',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            duration: '1_minute',
            uses: 1,
            pactMagicRecharge: false,
            casting_time: '1 bonus action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── spell_breaker ────────────────────────────────────────────────────

describe('coreHandlers – spell_breaker', () => {
    it('returns passive_rule with spell_breaker effect', () => {
        const feature = makeFeature({ type: 'spell_breaker' })
        const result = coreHandlers.spell_breaker(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'passive_rule',
            name: 'Test Feature',
            effect: 'spell_breaker',
            alwaysPreparedSpells: [],
            bonusActionSpells: [],
            dispelAbilityCheckBonus: '',
            slotRetentionSpells: [],
            casting_time: 'passive',
            hasAutomation: true
        })
    })
})

// ── create_thrall ────────────────────────────────────────────────────

describe('coreHandlers – create_thrall', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'create_thrall' })
        const result = coreHandlers.create_thrall(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'create_thrall',
            spell: '',
            uses: 1,
            uses_expression: '',
            usesMax: 1,
            recharge: 'long_rest',
            action: 'action',
            casting_time: '1 action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })

    it('resolves uses_expression via evaluateAutoExpression', () => {
        const feature = makeFeature({
            type: 'create_thrall',
            uses_expression: 'proficiency_bonus'
        })
        const result = coreHandlers.create_thrall(feature, BASE_STATS)
        expect(result.usesMax).toBe(3)
    })
})

// ── portent ──────────────────────────────────────────────────────────

describe('coreHandlers – portent', () => {
    it('returns 2 dice for level 5', () => {
        const feature = makeFeature({ type: 'portent' })
        const result = coreHandlers.portent(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'portent',
            effect: '',
            maxDice: 2,
            hasAutomation: true,
            name: 'Test Feature'
        })
    })

    it('returns 3 dice for level 14+', () => {
        const stats = { ...BASE_STATS, level: 14 }
        const feature = makeFeature({ type: 'portent' })
        const result = coreHandlers.portent(feature, stats)
        expect(result.maxDice).toBe(3)
    })

    it('returns 2 dice for level below 14', () => {
        const stats = { ...BASE_STATS, level: 13 }
        const feature = makeFeature({ type: 'portent' })
        const result = coreHandlers.portent(feature, stats)
        expect(result.maxDice).toBe(2)
    })
})

// ── third_eye ────────────────────────────────────────────────────────

describe('coreHandlers – third_eye', () => {
    it('returns bonus_action_choice type with predefined options and default duration', () => {
        const feature = makeFeature({ type: 'third_eye' })
        const result = coreHandlers.third_eye(feature, BASE_STATS)
        expect(result.type).toBe('bonus_action_choice')
        expect(result.name).toBe('Test Feature')
        expect(result.options).toHaveLength(3)
        expect(result.options[0].name).toBe('Darkvision (120 feet)')
        expect(result.options[1].name).toBe('Greater Comprehension')
        expect(result.options[2].name).toBe('See Invisibility')
        expect(result.action).toBe('bonus_action')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.duration).toBe('short_or_long_rest')
        expect(result.hasAutomation).toBe(true)
    })

    it('respects custom duration field', () => {
        const feature = makeFeature({
            type: 'third_eye',
            duration: 'long_rest'
        })
        const result = coreHandlers.third_eye(feature, BASE_STATS)
        expect(result.duration).toBe('long_rest')
    })
})

// ── improved_illusions ───────────────────────────────────────────────

describe('coreHandlers – improved_illusions', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'improved_illusions' })
        const result = coreHandlers.improved_illusions(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'improved_illusions',
            effect: 'improved_illusions',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── phantasmal_creatures ─────────────────────────────────────────────

describe('coreHandlers – phantasmal_creatures', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'phantasmal_creatures' })
        const result = coreHandlers.phantasmal_creatures(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'phantasmal_creatures',
            effect: 'phantasmal_creatures',
            casting_time: 'passive',
            alwaysPreparedSpells: [],
            freeCastSpells: [],
            usesMax: 1,
            recharge: 'long_rest',
            halvesHp: false,
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── celestial_revelation ─────────────────────────────────────────────

describe('coreHandlers – celestial_revelation', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'celestial_revelation' })
        const result = coreHandlers.celestial_revelation(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'celestial_revelation',
            options: [],
            chooseOne: false,
            duration: '1_minute',
            action: 'bonus_action',
            casting_time: '1 bonus action',
            recharge: 'long_rest',
            minLevel: 3,
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── lineage handlers (elfish, gnomish, fiendish) ─────────────────────

describe('coreHandlers – lineage handlers', () => {
    const lineageHandlers = [
        ['elfish_lineage', 'elfish_lineage'],
        ['gnomish_lineage', 'gnomish_lineage'],
        ['fiendish_legacy', 'fiendish_legacy']
    ]

    for (const [handlerName, type] of lineageHandlers) {
        it(`returns ${type} info with defaults`, () => {
            const feature = makeFeature({ type: handlerName })
            const result = coreHandlers[handlerName](feature, BASE_STATS)
            expect(result.type).toBe(type)
            expect(result.name).toBe('Test Feature')
            expect(result.options).toEqual([])
            expect(result.chooseOne).toBe(false)
            expect(result.hasAutomation).toBe(true)
        })
    }
})

// ── lesser_restoration ───────────────────────────────────────────────

describe('coreHandlers – lesser_restoration', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'lesser_restoration' })
        const result = coreHandlers.lesser_restoration(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'lesser_restoration',
            range: 'Touch',
            conditions: ['blinded', 'deafened', 'paralyzed', 'poisoned'],
            casting_time: '1 bonus action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── sentinel ─────────────────────────────────────────────────────────

describe('coreHandlers – sentinel', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'sentinel' })
        const result = coreHandlers.sentinel(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'sentinel',
            effect: 'speed_0_on_oa_hit',
            duration: 'end_of_turn',
            casting_time: '1 action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})
