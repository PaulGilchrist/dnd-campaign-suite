import { describe, it, expect } from 'vitest'
import { attackHandlers } from './attack.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('attackHandlers – attack_rider', () => {
    it('returns attack_rider info with default values', () => {
        const feature = makeFeature({ type: 'attack_rider' })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.type).toBe('attack_rider')
        expect(result.name).toBe('Test Feature')
        expect(result.options).toEqual([])
        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('')
        expect(result.trigger).toBe('')
        expect(result.oncePerTurn).toBe(false)
        expect(result.chooseOne).toBe(false)
        expect(result.maxEffects).toBe(1)
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves scaling for damageExpression', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            damageExpression: '1d6',
            scaling: { 5: '2d6', 11: '3d6' }
        })
        const result = attackHandlers.attack_rider(feature, { ...BASE_STATS, level: 5 })
        expect(result.damageExpression).toBe('2d6')
    })

    it('resolves scaling for level 11', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            damageExpression: '1d6',
            scaling: { 5: '2d6', 11: '3d6' }
        })
        const result = attackHandlers.attack_rider(feature, { ...BASE_STATS, level: 11 })
        expect(result.damageExpression).toBe('3d6')
    })

    it('creates push option from effect when options is empty', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'push',
            distance: '10 ft'
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options).toHaveLength(1)
        expect(result.options[0].effect).toBe('push')
        expect(result.options[0].value).toBe(10)
    })

    it('creates push_or_prone options from effect when options is empty', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'push_or_prone',
            distance: '5 ft'
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options).toHaveLength(2)
        expect(result.options[0].effect).toBe('push')
        expect(result.options[0].value).toBe(5)
        expect(result.options[1].effect).toBe('prone')
    })

    it('creates push_or_prone with oncePerTurn saveDc', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'push_or_prone',
            distance: '5 ft',
            oncePerTurn: true
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options[1].saveDc).toBe('ability')
    })

    it('creates speed_reduction option from effect when options is empty', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'reduce_speed',
            speedReduction: '15 ft'
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options).toHaveLength(1)
        expect(result.options[0].effect).toBe('speed_reduction')
        expect(result.options[0].value).toBe(15)
    })

    it('maps effects array to options', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [
                { option: 'damage_bonus', name: 'Fire', damageType: 'Fire', dice: '2d6' },
                { option: 'poisoned', saveType: 'CON' }
            ]
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options).toHaveLength(2)
        expect(result.options[0].effect).toBe('damage_bonus')
        expect(result.options[0].damageExpression).toBe('2d6')
        expect(result.options[0].damageType).toBe('Fire')
        expect(result.options[1].effect).toBe('poisoned')
        expect(result.options[1].saveType).toBe('CON')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            cost: 2,
            damageType: 'Force',
            saveType: 'STR',
            saveDc: 15,
            saveAbility: 'STR',
            damageDoubled: true,
            uses: 3,
            recharge: 'short_rest',
            casting_time: '1 action'
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.cost).toBe(2)
        expect(result.damageType).toBe('Force')
        expect(result.saveType).toBe('STR')
        expect(result.saveDc).toBe(15)
        expect(result.damageDoubled).toBe(true)
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 action')
    })
})

describe('attackHandlers – open_hand_technique', () => {
    it('returns open_hand_technique info', () => {
        const feature = makeFeature({
            type: 'open_hand_technique',
            saveType: 'STR',
            saveDc: 'ability',
            saveAbility: 'WIS'
        })
        const result = attackHandlers.open_hand_technique(feature, BASE_STATS)
        expect(result.type).toBe('open_hand_technique')
        expect(result.saveType).toBe('STR')
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('WIS')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('attackHandlers – mastery_rider', () => {
    it('returns mastery_rider info with defaults', () => {
        const feature = makeFeature({ type: 'mastery_rider' })
        const result = attackHandlers.mastery_rider(feature, BASE_STATS)
        expect(result.type).toBe('mastery_rider')
        expect(result.masteries).toEqual([])
        expect(result.extraMastery).toEqual([])
        expect(result.trigger).toBe('hit')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'mastery_rider',
            masteries: ['push', 'topple'],
            extraMastery: ['trip'],
            trigger: 'miss'
        })
        const result = attackHandlers.mastery_rider(feature, BASE_STATS)
        expect(result.masteries).toEqual(['push', 'topple'])
        expect(result.extraMastery).toEqual(['trip'])
        expect(result.trigger).toBe('miss')
    })
})

describe('attackHandlers – bonus_action_attack', () => {
    it('returns bonus_action_attack info with defaults', () => {
        const feature = makeFeature({ type: 'bonus_action_attack' })
        const result = attackHandlers.bonus_action_attack(feature, BASE_STATS)
        expect(result.type).toBe('bonus_action_attack')
        expect(result.action).toBe('bonus_action')
        expect(result.weaponAttack).toBe(false)
        expect(result.usesMax).toBe(0)
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves uses_expression', () => {
        const feature = makeFeature({
            type: 'bonus_action_attack',
            uses_expression: 'proficiency_bonus'
        })
        const result = attackHandlers.bonus_action_attack(feature, BASE_STATS)
        expect(result.usesMax).toBe(3)
    })
})

describe('attackHandlers – bonus_attacks', () => {
    it('returns bonus_attacks info with defaults', () => {
        const feature = makeFeature({ type: 'bonus_attacks' })
        const result = attackHandlers.bonus_attacks(feature, BASE_STATS)
        expect(result.type).toBe('bonus_attacks')
        expect(result.attacks).toBe(2)
        expect(result.attackType).toBe('unarmed_strike')
        expect(result.action).toBeNull()
        expect(result.hasAutomation).toBe(true)
    })

    it('sets action from casting_time matching', () => {
        const feature = makeFeature({ type: 'bonus_attacks', casting_time: '1 bonus action' })
        const result = attackHandlers.bonus_attacks(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
    })

    it('sets action from reaction casting_time', () => {
        const feature = makeFeature({ type: 'bonus_attacks', casting_time: '1 reaction' })
        const result = attackHandlers.bonus_attacks(feature, BASE_STATS)
        expect(result.action).toBe('reaction')
    })

    it('sets action from action casting_time', () => {
        const feature = makeFeature({ type: 'bonus_attacks', casting_time: '1 action' })
        const result = attackHandlers.bonus_attacks(feature, BASE_STATS)
        expect(result.action).toBe('action')
    })
})

describe('attackHandlers – concentration_bonus_attack', () => {
    it('returns concentration_bonus_attack info with defaults', () => {
        const feature = makeFeature({ type: 'concentration_bonus_attack' })
        const result = attackHandlers.concentration_bonus_attack(feature, BASE_STATS)
        expect(result.type).toBe('concentration_bonus_attack')
        expect(result.trigger).toBe('each_turn')
        expect(result.action).toBe('bonus_action')
        expect(result.weaponAttack).toBe(false)
        expect(result.attacks).toBe(2)
        expect(result.hasAutomation).toBe(true)
    })
})

describe('attackHandlers – stealth_attack', () => {
    it('returns stealth_attack info with defaults', () => {
        const feature = makeFeature({ type: 'stealth_attack' })
        const result = attackHandlers.stealth_attack(feature, BASE_STATS)
        expect(result.type).toBe('stealth_attack')
        expect(result.cost).toBe('1d6')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('attackHandlers – war_bond_summon', () => {
    it('returns war_bond_summon info with defaults', () => {
        const feature = makeFeature({ type: 'war_bond_summon' })
        const result = attackHandlers.war_bond_summon(feature, BASE_STATS)
        expect(result.type).toBe('war_bond_summon')
        expect(result.action).toBe('bonus_action')
        expect(result.bondedWeaponCount).toBe(2)
        expect(result.hasAutomation).toBe(true)
    })
})
