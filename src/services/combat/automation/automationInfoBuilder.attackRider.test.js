// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

vi.mock('./automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn((expr, _stats) => {
        if (!expr) return 0
        return 2
    }),
}))

describe('buildAttackInfo – attack_rider', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns null when feature has no automation', () => {
        const feature = { name: 'No Automation' }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null when automation type is unknown', () => {
        const feature = makeFeature({ type: 'unknown_type' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns correct structure with minimal automation', () => {
        const feature = makeFeature({ type: 'attack_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('attack_rider')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
        expect(result.options).toEqual([])
        expect(result.cost).toBeNull()
        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('')
        expect(result.trigger).toBe('')
        expect(result.oncePerTurn).toBe(false)
        expect(result.chooseOne).toBe(false)
        expect(result.maxEffects).toBe(1)
        expect(result.saveType).toBeNull()
        expect(result.saveDc).toBeNull()
        expect(result.saveAbility).toBeNull()
        expect(result.damageDoubled).toBe(false)
        expect(result.restoreCost).toBeNull()
        expect(result.uses).toBeNull()
        expect(result.recharge).toBe('long_rest')
        expect(result.casting_time).toBe('passive')
    })

    it('passes through optional automation fields', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            damageExpression: '2d6 fire',
            options: ['option1'],
            cost: '1 resource',
            damageType: 'fire',
            trigger: 'on_hit',
            oncePerTurn: true,
            chooseOne: true,
            maxEffects: 3,
            saveType: 'DEX',
            saveDc: 15,
            saveAbility: 'CON',
            damageDoubled: true,
            restoreCost: '1 gold',
            uses: 2,
            recharge: 'short_rest',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.damageExpression).toBe('2d6 fire')
        expect(result.options).toEqual(['option1'])
        expect(result.cost).toBe('1 resource')
        expect(result.damageType).toBe('fire')
        expect(result.trigger).toBe('on_hit')
        expect(result.oncePerTurn).toBe(true)
        expect(result.chooseOne).toBe(true)
        expect(result.maxEffects).toBe(3)
        expect(result.saveType).toBe('DEX')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('CON')
        expect(result.damageDoubled).toBe(true)
        expect(result.restoreCost).toBe('1 gold')
        expect(result.uses).toBe(2)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 action')
    })

    it('resolves scaling to highest matching tier by level', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            damageExpression: '1d6',
            scaling: { 3: '2d6', 5: '3d6', 11: '4d6' },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3d6')
    })

    it('uses base expression when level is below all scaling tiers', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            damageExpression: '1d6',
            scaling: { 11: '2d6' },
        })
        const result = buildAttackInfo(feature, { ...BASE_STATS, level: 1 })
        expect(result.damageExpression).toBe('1d6')
    })

    it('handles scaling with string numeric keys', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            damageExpression: '1d4',
            scaling: { '3': '2d4', '5': '3d4' },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3d4')
    })

    it('skips scaling entries with non-numeric keys', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            damageExpression: '1d4',
            scaling: { invalid: '2d4', '5': '3d4' },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3d4')
    })

    it('falls back to base expression when level is missing', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            damageExpression: '1d4',
            scaling: { '3': '2d4' },
        })
        const result = buildAttackInfo(feature, { proficiency: 2 })
        expect(result.damageExpression).toBe('1d4')
    })

    it('generates push option from effect + distance shorthand', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'push',
            distance: '15 ft',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toHaveLength(1)
        expect(result.options[0]).toEqual({
            name: 'Push',
            effect: 'push',
            value: 15,
            sizeLimit: null,
        })
    })

    it('generates push option with default distance when omitted', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'push',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options[0].value).toBe(10)
    })

    it('generates push option with custom sizeLimit', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'push',
            distance: '10 ft',
            sizeLimit: 'Huge',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options[0].sizeLimit).toBe('Huge')
    })

    it('generates reduce_speed option from effect shorthand', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'reduce_speed',
            speedReduction: '20 ft',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toHaveLength(1)
        expect(result.options[0]).toEqual({
            name: 'Reduce Speed',
            effect: 'speed_reduction',
            value: 20,
        })
    })

    it('generates reduce_speed option with default value', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'reduce_speed',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options[0].value).toBe(10)
    })

    it('generates push_or_prone options from effect shorthand', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'push_or_prone',
            distance: '5 ft',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toHaveLength(2)
        expect(result.options[0]).toEqual({
            name: 'Push',
            effect: 'push',
            value: 5,
            sizeLimit: null,
        })
        expect(result.options[1]).toMatchObject({
            name: 'Prone',
            effect: 'prone',
            saveType: 'STR',
            saveDc: 'ability',
            saveAbility: 'STR',
        })
    })

    it('sets saveDc on prone option when oncePerTurn is true', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effect: 'push_or_prone',
            oncePerTurn: true,
            saveDc: 14,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options[1].saveDc).toBe(14)
    })

    it('maps effects array to options with damage_bonus option', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{
                option: 'damage_bonus',
                name: 'Extra Damage',
                dice: '2d8',
                damageType: 'radiant',
            }],
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toHaveLength(1)
        expect(result.options[0]).toEqual({
            name: 'Extra Damage',
            effect: 'damage_bonus',
            damageExpression: '2d8',
            damageType: 'radiant',
        })
    })

    it('maps effects array to options with push option', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{
                option: 'push',
                distance: '10 ft',
                sizeLimit: 'Large',
            }],
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options[0]).toEqual({
            name: 'Push',
            effect: 'push',
            value: 10,
            sizeLimit: 'Large',
        })
    })

    it('maps effects array to options with prone option', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{ option: 'prone' }],
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options[0]).toMatchObject({
            name: 'Prone',
            effect: 'prone',
            saveType: 'DEX',
            saveDc: 'ability',
            saveAbility: 'DEX',
        })
    })

    it('maps effects array to options with poisoned option', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{ option: 'poisoned' }],
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options[0]).toMatchObject({
            name: 'Poisoned',
            effect: 'poisoned',
            saveType: 'CON',
            saveDc: 'ability',
            saveAbility: 'CON',
        })
    })

    it('maps effects array to options with unconscious option', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{ option: 'unconscious' }],
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options[0]).toMatchObject({
            name: 'Unconscious',
            effect: 'unconscious',
            saveType: 'CON',
            saveDc: 'ability',
            saveAbility: 'CON',
        })
    })

    it('maps effects array to options with blinded option', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{ option: 'blinded' }],
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options[0]).toMatchObject({
            name: 'Blinded',
            effect: 'blinded',
            saveType: 'DEX',
            saveDc: 'ability',
            saveAbility: 'DEX',
        })
    })

    it('falls back to generic option mapping for unknown effect types', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{ option: 'custom_effect', value: 42 }],
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options[0]).toMatchObject({
            name: 'custom_effect',
            effect: 'custom_effect',
            value: 42,
            sizeLimit: null,
        })
    })

    it('prefers explicit options over effect shorthand', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            options: [{ name: 'Explicit' }],
            effect: 'push',
            distance: '10 ft',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual([{ name: 'Explicit' }])
    })

    it('prefers effects array over effect shorthand', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [{ option: 'push', distance: '15 ft' }],
            effect: 'push',
            distance: '10 ft',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options[0].value).toBe(15)
    })
})

describe('buildAttackInfo – open_hand_technique', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'open_hand_technique' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('open_hand_technique')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
        expect(result.options).toEqual([])
        expect(result.saveType).toBe('STR')
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('WIS')
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'open_hand_technique',
            options: ['push 15 ft'],
            saveType: 'DEX',
            saveDc: 15,
            saveAbility: 'CON',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual(['push 15 ft'])
        expect(result.saveType).toBe('DEX')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('CON')
    })
})

describe('buildAttackInfo – mastery_rider', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'mastery_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('mastery_rider')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
        expect(result.masteries).toEqual([])
        expect(result.extraMastery).toEqual([])
        expect(result.trigger).toBe('hit')
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'mastery_rider',
            masteries: ['mastery1'],
            extraMastery: ['extra1', 'extra2'],
            trigger: 'miss',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.masteries).toEqual(['mastery1'])
        expect(result.extraMastery).toEqual(['extra1', 'extra2'])
        expect(result.trigger).toBe('miss')
    })
})

describe('buildAttackInfo – bonus_action_attack', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'bonus_action_attack' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('bonus_action_attack')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
        expect(result.trigger).toBe('')
        expect(result.action).toBe('bonus_action')
        expect(result.weaponAttack).toBe(false)
        expect(result.extraDamageExpression).toBe('')
        expect(result.usesMax).toBe(0)
        expect(result.recharge).toBe('long_rest')
        expect(result.resourceKey).toBe('warPriestUses')
        expect(result.weaponRequirement).toBeNull()
    })

    it('evaluates uses_expression via evaluateAutoExpression', () => {
        const feature = makeFeature({
            type: 'bonus_action_attack',
            uses_expression: '2 + Math.floor(level / 2)',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.usesMax).toBe(2)
    })

    it('passes through optional fields', () => {
        const feature = makeFeature({
            type: 'bonus_action_attack',
            trigger: 'on_hit',
            action: 'action',
            weaponAttack: true,
            extraDamageExpression: '1d8',
            recharge: 'short_rest',
            weaponRequirement: 'melee',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('on_hit')
        expect(result.action).toBe('action')
        expect(result.weaponAttack).toBe(true)
        expect(result.extraDamageExpression).toBe('1d8')
        expect(result.recharge).toBe('short_rest')
        expect(result.weaponRequirement).toBe('melee')
    })
})

describe('buildAttackInfo – bonus_attacks', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'bonus_attacks' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('bonus_attacks')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
        expect(result.attacks).toBe(2)
        expect(result.attackType).toBe('unarmed_strike')
        expect(result.cost).toBeNull()
        expect(result.trigger).toBe('after_attack_action')
        expect(result.action).toBeNull()
        expect(result.casting_time).toBeNull()
        expect(result.weaponRequirements).toBeNull()
        expect(result.weaponRestriction).toBeNull()
    })

    it('derives action from casting_time bonus action', () => {
        const feature = makeFeature({
            type: 'bonus_attacks',
            casting_time: '1 bonus action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
    })

    it('derives action from casting_time reaction', () => {
        const feature = makeFeature({
            type: 'bonus_attacks',
            casting_time: '1 reaction',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.action).toBe('reaction')
    })

    it('derives action from casting_time action', () => {
        const feature = makeFeature({
            type: 'bonus_attacks',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.action).toBe('action')
    })

    it('does not derive action when casting_time has no action keyword', () => {
        const feature = makeFeature({
            type: 'bonus_attacks',
            casting_time: 'passive',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.action).toBeNull()
    })

    it('passes through optional fields', () => {
        const feature = makeFeature({
            type: 'bonus_attacks',
            attacks: 3,
            attackType: 'melee',
            cost: '1 resource',
            trigger: 'on_kill',
            weaponRequirements: 'light',
            weaponRestriction: 'not_staff',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.attacks).toBe(3)
        expect(result.attackType).toBe('melee')
        expect(result.cost).toBe('1 resource')
        expect(result.trigger).toBe('on_kill')
        expect(result.weaponRequirements).toBe('light')
        expect(result.weaponRestriction).toBe('not_staff')
    })
})

describe('buildAttackInfo – concentration_bonus_attack', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'concentration_bonus_attack' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('concentration_bonus_attack')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
        expect(result.trigger).toBe('each_turn')
        expect(result.action).toBe('bonus_action')
        expect(result.weaponAttack).toBe(false)
        expect(result.concentrationSpell).toBe('')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.attacks).toBe(2)
        expect(result.weaponRequirement).toBeNull()
        expect(result.attack_type).toBe('ranged')
    })

    it('passes through optional fields', () => {
        const feature = makeFeature({
            type: 'concentration_bonus_attack',
            trigger: 'on_activation',
            action: 'action',
            weaponAttack: true,
            concentrationSpell: 'spirit_guardians',
            casting_time: '1 action',
            attacks: 3,
            weaponRequirement: 'finesse',
            attack_type: 'melee',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('on_activation')
        expect(result.action).toBe('action')
        expect(result.weaponAttack).toBe(true)
        expect(result.concentrationSpell).toBe('spirit_guardians')
        expect(result.casting_time).toBe('1 action')
        expect(result.attacks).toBe(3)
        expect(result.weaponRequirement).toBe('finesse')
        expect(result.attack_type).toBe('melee')
    })
})

describe('buildAttackInfo – stealth_attack', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'stealth_attack' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('stealth_attack')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
        expect(result.cost).toBe('1d6')
        expect(result.casting_time).toBe('passive')
    })

    it('passes through optional fields', () => {
        const feature = makeFeature({
            type: 'stealth_attack',
            cost: '2d6',
            casting_time: '1 reaction',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.cost).toBe('2d6')
        expect(result.casting_time).toBe('1 reaction')
    })
})

describe('buildAttackInfo – war_bond_summon', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'war_bond_summon' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('war_bond_summon')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
        expect(result.action).toBe('bonus_action')
        expect(result.bondedWeaponCount).toBe(2)
        expect(result.casting_time).toBe('1 bonus action')
    })

    it('passes through optional fields', () => {
        const feature = makeFeature({
            type: 'war_bond_summon',
            action: 'action',
            bondedWeaponCount: 3,
            casting_time: '1 minute',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.action).toBe('action')
        expect(result.bondedWeaponCount).toBe(3)
        expect(result.casting_time).toBe('1 minute')
    })
})
