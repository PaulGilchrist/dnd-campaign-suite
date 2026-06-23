import { describe, it, expect } from 'vitest'
import { attackHandlers } from './attack.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('attackHandlers – attack_rider', () => {
    it('returns attack_rider info with default values', () => {
        const feature = makeFeature({ type: 'attack_rider' })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'attack_rider',
            name: 'Test Feature',
            options: [],
            cost: null,
            damageExpression: '',
            damageType: '',
            trigger: '',
            oncePerTurn: false,
            chooseOne: false,
            maxEffects: 1,
            saveType: null,
            saveDc: null,
            saveAbility: null,
            damageDoubled: false,
            restoreCost: null,
            uses: null,
            recharge: 'long_rest',
            casting_time: 'passive',
            hasAutomation: true,
        })
    })

    it('resolves damageExpression scaling by level', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            damageExpression: '1d6',
            scaling: { 5: '2d6', 11: '3d6' }
        })
        // Level below all breakpoints keeps base
        expect(attackHandlers.attack_rider(feature, { ...BASE_STATS, level: 3 }).damageExpression).toBe('1d6')
        // Level 5 triggers first tier
        expect(attackHandlers.attack_rider(feature, { ...BASE_STATS, level: 5 }).damageExpression).toBe('2d6')
        // Level 11 triggers second tier
        expect(attackHandlers.attack_rider(feature, { ...BASE_STATS, level: 11 }).damageExpression).toBe('3d6')
        // Level above highest tier keeps highest
        expect(attackHandlers.attack_rider(feature, { ...BASE_STATS, level: 20 }).damageExpression).toBe('3d6')
    })

    it('ignores invalid scaling entries', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            damageExpression: '1d6',
            scaling: { abc: '2d6', 11: '3d6' }
        })
        const result = attackHandlers.attack_rider(feature, { ...BASE_STATS, level: 5 })
        expect(result.damageExpression).toBe('1d6')
    })

    it('creates push option from effect when options is empty', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'push',
            distance: '10 ft'
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options).toEqual([{
            name: 'Push',
            effect: 'push',
            value: 10,
            sizeLimit: null,
        }])
    })

    it('creates push_or_prone options from effect when options is empty', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'push_or_prone',
            distance: '5 ft'
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options).toHaveLength(2)
        expect(result.options[0]).toEqual({
            name: 'Push',
            effect: 'push',
            value: 5,
            sizeLimit: null,
        })
        expect(result.options[1]).toEqual({
            name: 'Prone',
            effect: 'prone',
            saveType: 'STR',
            saveDc: 'ability',
            saveAbility: 'STR',
        })
    })

    it('applies custom saveDc to prone option when oncePerTurn is set', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'push_or_prone',
            distance: '5 ft',
            oncePerTurn: true,
            saveDc: 17,
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options[1].saveDc).toBe(17)
    })

    it('creates speed_reduction option from effect when options is empty', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'reduce_speed',
            speedReduction: '15 ft'
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options).toEqual([{
            name: 'Reduce Speed',
            effect: 'speed_reduction',
            value: 15,
        }])
    })

    it('parses distance with non-numeric characters for push', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'push',
            distance: '20 feet'
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options[0].value).toBe(20)
    })

    it('parses speedReduction using regex for reduce_speed', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'reduce_speed',
            speedReduction: 'half speed to 15 ft'
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options[0].value).toBe(15)
    })

    it('uses default distance when missing for push', () => {
        const feature = makeFeature({ type: 'attack_rider', effect: 'push' })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options[0].value).toBe(10)
    })

    it('uses default speedReduction when missing for reduce_speed', () => {
        const feature = makeFeature({ type: 'attack_rider', effect: 'reduce_speed' })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options[0].value).toBe(10)
    })

    it('maps effects array to options for damage_bonus', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [
                { option: 'damage_bonus', name: 'Fire', damageType: 'Fire', dice: '2d6' },
                { option: 'poisoned', saveType: 'CON' }
            ]
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options).toHaveLength(2)
        expect(result.options[0]).toEqual({
            name: 'Fire',
            effect: 'damage_bonus',
            damageExpression: '2d6',
            damageType: 'Fire',
        })
        expect(result.options[1]).toEqual({
            name: 'Poisoned',
            effect: 'poisoned',
            saveType: 'CON',
            saveDc: 'ability',
            saveAbility: 'CON',
        })
    })

    it('maps effects array for prone option', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{ option: 'prone', saveType: 'DEX' }]
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options[0]).toEqual({
            name: 'Prone',
            effect: 'prone',
            saveType: 'DEX',
            saveDc: 'ability',
            saveAbility: 'DEX',
        })
    })

    it('maps effects array for unconscious option', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{ option: 'unconscious' }]
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options[0]).toEqual({
            name: 'Unconscious',
            effect: 'unconscious',
            saveType: 'CON',
            saveDc: 'ability',
            saveAbility: 'CON',
        })
    })

    it('maps effects array for blinded option', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{ option: 'blinded' }]
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options[0]).toEqual({
            name: 'Blinded',
            effect: 'blinded',
            saveType: 'DEX',
            saveDc: 'ability',
            saveAbility: 'DEX',
        })
    })

    it('maps effects array for push option', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{ option: 'push', distance: '15 ft' }]
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options[0]).toEqual({
            name: 'Push',
            effect: 'push',
            value: 15,
            sizeLimit: null,
        })
    })

    it('passthroughs known effect options to generic fallback', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{ option: 'knock_prone', name: 'Knock Down', value: 5 }]
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options[0]).toEqual({
            name: 'Knock Down',
            effect: 'knock_prone',
            value: 5,
            sizeLimit: null,
        })
    })

    it('passthroughs existing options array without processing effects', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            options: [{ name: 'Custom', effect: 'custom' }],
            effect: 'push',
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options).toEqual([{ name: 'Custom', effect: 'custom' }])
    })

    it('passthroughs custom fields', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            cost: 2,
            damageType: 'Force',
            saveType: 'STR',
            saveDc: 15,
            saveAbility: 'STR',
            damageDoubled: true,
            restoreCost: 5,
            uses: 3,
            recharge: 'short_rest',
            casting_time: '1 action',
            oncePerTurn: true,
            chooseOne: true,
            maxEffects: 3,
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.cost).toBe(2)
        expect(result.damageType).toBe('Force')
        expect(result.saveType).toBe('STR')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('STR')
        expect(result.damageDoubled).toBe(true)
        expect(result.restoreCost).toBe(5)
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 action')
        expect(result.oncePerTurn).toBe(true)
        expect(result.chooseOne).toBe(true)
        expect(result.maxEffects).toBe(3)
    })
})

describe('attackHandlers – open_hand_technique', () => {
    it('returns open_hand_technique info with defaults', () => {
        const feature = makeFeature({ type: 'open_hand_technique' })
        const result = attackHandlers.open_hand_technique(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'open_hand_technique',
            name: 'Test Feature',
            options: [],
            saveType: 'STR',
            saveDc: 'ability',
            saveAbility: 'WIS',
            hasAutomation: true,
        })
    })

    it('passthroughs custom fields', () => {
        const feature = makeFeature({
            type: 'open_hand_technique',
            saveType: 'DEX',
            saveDc: 16,
            saveAbility: 'CHA',
            options: [{ effect: 'shove' }],
        })
        const result = attackHandlers.open_hand_technique(feature, BASE_STATS)
        expect(result.saveType).toBe('DEX')
        expect(result.saveDc).toBe(16)
        expect(result.saveAbility).toBe('CHA')
        expect(result.options).toEqual([{ effect: 'shove' }])
    })
})

describe('attackHandlers – mastery_rider', () => {
    it('returns mastery_rider info with defaults', () => {
        const feature = makeFeature({ type: 'mastery_rider' })
        const result = attackHandlers.mastery_rider(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'mastery_rider',
            name: 'Test Feature',
            masteries: [],
            extraMastery: [],
            trigger: 'hit',
            hasAutomation: true,
        })
    })

    it('passthroughs custom fields', () => {
        const feature = makeFeature({
            type: 'mastery_rider',
            masteries: ['push', 'topple'],
            extraMastery: ['trip'],
            trigger: 'miss',
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
        expect(result).toEqual({
            type: 'bonus_action_attack',
            name: 'Test Feature',
            trigger: '',
            action: 'bonus_action',
            weaponAttack: false,
            extraDamageExpression: '',
            usesMax: 0,
            recharge: 'long_rest',
            resourceKey: 'warPriestUses',
            weaponRequirement: null,
            hasAutomation: true,
        })
    })

    it('resolves uses_expression via evaluateAutoExpression', () => {
        const feature = makeFeature({
            type: 'bonus_action_attack',
            uses_expression: 'proficiency_bonus'
        })
        const result = attackHandlers.bonus_action_attack(feature, BASE_STATS)
        expect(result.usesMax).toBe(3)
    })

    it('passthroughs custom fields', () => {
        const feature = makeFeature({
            type: 'bonus_action_attack',
            trigger: 'after_hit',
            action: 'action',
            weaponAttack: true,
            extraDamageExpression: '1d8',
            recharge: '5-6',
            weaponRequirement: 'melee',
        })
        const result = attackHandlers.bonus_action_attack(feature, BASE_STATS)
        expect(result.trigger).toBe('after_hit')
        expect(result.action).toBe('action')
        expect(result.weaponAttack).toBe(true)
        expect(result.extraDamageExpression).toBe('1d8')
        expect(result.recharge).toBe('5-6')
        expect(result.resourceKey).toBe('warPriestUses')
        expect(result.weaponRequirement).toBe('melee')
    })
})

describe('attackHandlers – bonus_attacks', () => {
    it('returns bonus_attacks info with defaults', () => {
        const feature = makeFeature({ type: 'bonus_attacks' })
        const result = attackHandlers.bonus_attacks(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'bonus_attacks',
            name: 'Test Feature',
            attacks: 2,
            attackType: 'unarmed_strike',
            cost: null,
            trigger: 'after_attack_action',
            action: null,
            casting_time: null,
            weaponRequirements: null,
            weaponRestriction: null,
            hasAutomation: true,
        })
    })

    it('extracts action from casting_time patterns', () => {
        expect(attackHandlers.bonus_attacks(makeFeature({ type: 'bonus_attacks', casting_time: '1 bonus action' }), BASE_STATS).action).toBe('bonus_action')
        expect(attackHandlers.bonus_attacks(makeFeature({ type: 'bonus_attacks', casting_time: '1 reaction' }), BASE_STATS).action).toBe('reaction')
        expect(attackHandlers.bonus_attacks(makeFeature({ type: 'bonus_attacks', casting_time: '1 action' }), BASE_STATS).action).toBe('action')
    })

    it('leaves action null when casting_time does not match', () => {
        const result = attackHandlers.bonus_attacks(makeFeature({ type: 'bonus_attacks', casting_time: '1 minute' }), BASE_STATS)
        expect(result.action).toBeNull()
    })

    it('passthroughs custom fields', () => {
        const feature = makeFeature({
            type: 'bonus_attacks',
            attacks: 3,
            attackType: 'fist',
            cost: '1d4',
            trigger: 'on_hit',
            casting_time: '1 minute',
            weaponRequirements: ['finesse'],
            weaponRestriction: 'melee',
        })
        const result = attackHandlers.bonus_attacks(feature, BASE_STATS)
        expect(result.attacks).toBe(3)
        expect(result.attackType).toBe('fist')
        expect(result.cost).toBe('1d4')
        expect(result.trigger).toBe('on_hit')
        expect(result.casting_time).toBe('1 minute')
        expect(result.weaponRequirements).toEqual(['finesse'])
        expect(result.weaponRestriction).toBe('melee')
    })
})

describe('attackHandlers – concentration_bonus_attack', () => {
    it('returns concentration_bonus_attack info with defaults', () => {
        const feature = makeFeature({ type: 'concentration_bonus_attack' })
        const result = attackHandlers.concentration_bonus_attack(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'concentration_bonus_attack',
            name: 'Test Feature',
            trigger: 'each_turn',
            action: 'bonus_action',
            weaponAttack: false,
            concentrationSpell: '',
            casting_time: '1 bonus action',
            attacks: 2,
            weaponRequirement: null,
            attack_type: 'ranged',
            hasAutomation: true,
        })
    })

    it('passthroughs custom fields', () => {
        const feature = makeFeature({
            type: 'concentration_bonus_attack',
            trigger: 'on_cast',
            action: 'action',
            weaponAttack: true,
            concentrationSpell: 'spirit_guardians',
            casting_time: '1 action',
            attacks: 3,
            weaponRequirement: 'staff',
            attack_type: 'melee',
        })
        const result = attackHandlers.concentration_bonus_attack(feature, BASE_STATS)
        expect(result.trigger).toBe('on_cast')
        expect(result.action).toBe('action')
        expect(result.weaponAttack).toBe(true)
        expect(result.concentrationSpell).toBe('spirit_guardians')
        expect(result.casting_time).toBe('1 action')
        expect(result.attacks).toBe(3)
        expect(result.weaponRequirement).toBe('staff')
        expect(result.attack_type).toBe('melee')
    })
})

describe('attackHandlers – stealth_attack', () => {
    it('returns stealth_attack info with defaults', () => {
        const feature = makeFeature({ type: 'stealth_attack' })
        const result = attackHandlers.stealth_attack(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'stealth_attack',
            name: 'Test Feature',
            cost: '1d6',
            casting_time: 'passive',
            hasAutomation: true,
        })
    })

    it('passthroughs custom fields', () => {
        const feature = makeFeature({
            type: 'stealth_attack',
            cost: '2d6',
            casting_time: '1 action',
        })
        const result = attackHandlers.stealth_attack(feature, BASE_STATS)
        expect(result.cost).toBe('2d6')
        expect(result.casting_time).toBe('1 action')
    })
})

describe('attackHandlers – war_bond_summon', () => {
    it('returns war_bond_summon info with defaults', () => {
        const feature = makeFeature({ type: 'war_bond_summon' })
        const result = attackHandlers.war_bond_summon(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'war_bond_summon',
            name: 'Test Feature',
            action: 'bonus_action',
            bondedWeaponCount: 2,
            casting_time: '1 bonus action',
            hasAutomation: true,
        })
    })

    it('passthroughs custom fields', () => {
        const feature = makeFeature({
            type: 'war_bond_summon',
            action: 'action',
            bondedWeaponCount: 3,
            casting_time: '1 reaction',
        })
        const result = attackHandlers.war_bond_summon(feature, BASE_STATS)
        expect(result.action).toBe('action')
        expect(result.bondedWeaponCount).toBe(3)
        expect(result.casting_time).toBe('1 reaction')
    })
})
