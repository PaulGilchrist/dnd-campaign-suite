// @maintained-by-ai
// Unit lane (canonical home) for attackHandlers in ./attack.js — exact envelopes,
// defaults, and calcs, invoked DIRECTLY (facade dispatch is pinned by the flat
// automationInfoBuilder.test.js delegation table — not re-pinned here).
// Strings are passed through unevaluated ('1d6' stays '1d6'); bonus_action_attack
// uses_expression is the one real-evaluated field (real automationExpressions.js).
import { describe, it, expect } from 'vitest'
import { attackHandlers } from './attack.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

describe('attackHandlers – attack_rider', () => {
    it('returns default attack_rider envelope', () => {
        const feature = makeFeature({ type: 'attack_rider' })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'attack_rider',
            name: 'Test Feature',
            featureLevel: null,
            effect: null,
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

    it('resolves damageExpression to the highest scaling tier at or below level, ignoring non-numeric keys', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            damageExpression: '1d6',
            scaling: { abc: '9d6', 5: '2d6', 11: '3d6' }
        })
        expect(attackHandlers.attack_rider(feature, { ...BASE_STATS, level: 3 }).damageExpression).toBe('1d6')
        expect(attackHandlers.attack_rider(feature, { ...BASE_STATS, level: 5 }).damageExpression).toBe('2d6')
        expect(attackHandlers.attack_rider(feature, { ...BASE_STATS, level: 11 }).damageExpression).toBe('3d6')
        expect(attackHandlers.attack_rider(feature, { ...BASE_STATS, level: 20 }).damageExpression).toBe('3d6')
    })

    it('derives a prone option from effect push_or_prone, defaulting or honouring custom save fields', () => {
        const plain = attackHandlers.attack_rider(makeFeature({ type: 'attack_rider', effect: 'push_or_prone' }), BASE_STATS)
        expect(plain.options).toEqual([{
            name: 'Prone',
            effect: 'prone',
            saveType: 'STR',
            saveDc: 'ability',
            saveAbility: 'STR',
        }])

        const custom = attackHandlers.attack_rider(makeFeature({
            type: 'attack_rider',
            effect: 'push_or_prone',
            saveType: 'CON',
            saveDc: 17,
            saveAbility: 'STR',
        }), BASE_STATS)
        expect(custom.options).toEqual([{
            name: 'Prone',
            effect: 'prone',
            saveType: 'CON',
            saveDc: 17,
            saveAbility: 'STR',
        }])
    })

    it('derives a speed_reduction option parsing the first number of speedReduction, defaulting to 10 ft', () => {
        for (const [speedReduction, value] of [['15 ft', 15], ['half speed to 15 ft', 15], [undefined, 10]]) {
            const result = attackHandlers.attack_rider(makeFeature({
                type: 'attack_rider',
                effect: 'reduce_speed',
                ...(speedReduction === undefined ? {} : { speedReduction }),
            }), BASE_STATS)
            expect(result.options, `speedReduction=${speedReduction}`).toEqual([{
                name: 'Reduce Speed',
                effect: 'speed_reduction',
                value,
            }])
        }
    })

    it('maps every effects-array option type to its exact option shape in one pass', () => {
        // One table covering every branch of mapAutomationEffectOption:
        // damage_bonus explicit + defaults, push custom distance / custom name / defaults,
        // condition saves explicit + registry defaults, unknown-option fallback.
        const feature = makeFeature({
            type: 'attack_rider',
            effects: [
                { option: 'damage_bonus', name: 'Fire', damageType: 'Fire', dice: '2d6' },
                { option: 'damage_bonus' },
                { option: 'push', distance: '15 ft' },
                { option: 'push', name: 'Thunder Push', sizeLimit: 'one_size_larger' },
                { option: 'poisoned', saveType: 'CON' },
                { option: 'prone', saveType: 'DEX' },
                { option: 'unconscious' },
                { option: 'blinded' },
                { option: 'knock_prone', name: 'Knock Down', value: 5 },
            ]
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options).toEqual([
            { name: 'Fire', effect: 'damage_bonus', damageExpression: '2d6', damageType: 'Fire' },
            { name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '1d6', damageType: '' },            { name: 'Push 15 ft', effect: 'push', value: 15, sizeLimit: null },
            { name: 'Thunder Push', effect: 'push', value: 10, sizeLimit: 'one_size_larger' },
            { name: 'Poisoned', effect: 'poisoned', saveType: 'CON', saveDc: 'ability', saveAbility: 'CON' },
            { name: 'Prone', effect: 'prone', saveType: 'DEX', saveDc: 'ability', saveAbility: 'DEX' },
            { name: 'Unconscious', effect: 'unconscious', saveType: 'CON', saveDc: 'ability', saveAbility: 'CON' },
            { name: 'Blinded', effect: 'blinded', saveType: 'DEX', saveDc: 'ability', saveAbility: 'DEX' },
            { name: 'Knock Down', effect: 'knock_prone', value: 5, sizeLimit: null },
        ])
    })

    it('existing options array wins over effect and effects derivation', () => {
        const feature = makeFeature({
            type: 'attack_rider',
            options: [{ name: 'Custom', effect: 'custom' }],
            effect: 'push_or_prone',
            effects: [{ option: 'prone' }],
        })
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result.options).toEqual([{ name: 'Custom', effect: 'custom' }])
    })

    it('passes through custom fields verbatim, including feature-level', () => {
        const feature = {
            ...makeFeature({
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
            }),
            level: 3,
        }
        const result = attackHandlers.attack_rider(feature, BASE_STATS)
        expect(result).toMatchObject({
            featureLevel: 3,
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
    })
})

describe('attackHandlers – open_hand_technique', () => {
    it('returns default envelope with STR save against WIS DC', () => {
        const feature = makeFeature({ type: 'open_hand_technique' })
        expect(attackHandlers.open_hand_technique(feature, BASE_STATS)).toEqual({
            type: 'open_hand_technique',
            name: 'Test Feature',
            options: [],
            saveType: 'STR',
            saveDc: 'ability',
            saveAbility: 'WIS',
            hasAutomation: true,
        })
    })

    it('passes through custom save fields and options', () => {
        const feature = makeFeature({
            type: 'open_hand_technique',
            saveType: 'DEX',
            saveDc: 16,
            saveAbility: 'CHA',
            options: [{ effect: 'shove' }],
        })
        expect(attackHandlers.open_hand_technique(feature, BASE_STATS)).toEqual({
            type: 'open_hand_technique',
            name: 'Test Feature',
            options: [{ effect: 'shove' }],
            saveType: 'DEX',
            saveDc: 16,
            saveAbility: 'CHA',
            hasAutomation: true,
        })
    })
})

describe('attackHandlers – mastery_rider', () => {
    it('returns default envelope triggering on hit', () => {
        const feature = makeFeature({ type: 'mastery_rider' })
        expect(attackHandlers.mastery_rider(feature, BASE_STATS)).toEqual({
            type: 'mastery_rider',
            name: 'Test Feature',
            masteries: [],
            extraMastery: [],
            trigger: 'hit',
            hasAutomation: true,
        })
    })

    it('passes through custom masteries and trigger verbatim', () => {
        const feature = makeFeature({
            type: 'mastery_rider',
            masteries: ['push', 'topple'],
            extraMastery: ['trip'],
            trigger: 'miss',
        })
        expect(attackHandlers.mastery_rider(feature, BASE_STATS)).toEqual({
            type: 'mastery_rider',
            name: 'Test Feature',
            masteries: ['push', 'topple'],
            extraMastery: ['trip'],
            trigger: 'miss',
            hasAutomation: true,
        })
    })
})

describe('attackHandlers – weapon_kind_mastery', () => {
    it('returns default envelope with maxKinds 2', () => {
        const feature = makeFeature({ type: 'weapon_kind_mastery' })
        expect(attackHandlers.weapon_kind_mastery(feature, BASE_STATS)).toEqual({
            type: 'weapon_kind_mastery',
            name: 'Test Feature',
            description: '',
            meleeOnly: false,
            maxKinds: 2,
            hasAutomation: true,
        })
    })

    it('passes through custom maxKinds, meleeOnly, and feature description', () => {
        const feature = {
            ...makeFeature({ type: 'weapon_kind_mastery', maxKinds: 4, meleeOnly: true }),
            description: 'Pick your weapon kinds.',
        }
        expect(attackHandlers.weapon_kind_mastery(feature, BASE_STATS)).toEqual({
            type: 'weapon_kind_mastery',
            name: 'Test Feature',
            description: 'Pick your weapon kinds.',
            meleeOnly: true,
            maxKinds: 4,
            hasAutomation: true,
        })
    })

    it("resolves maxKinds 'class_level_scaling' from the matching class level", () => {
        const feature = makeFeature({ type: 'weapon_kind_mastery', maxKinds: 'class_level_scaling' })
        const stats = {
            ...BASE_STATS,
            class: {
                class_levels: [
                    { level: 1, weapon_mastery: 2 },
                    { level: 5, weapon_mastery: 3 },
                    { level: 9, weapon_mastery: 4 },
                ]
            }
        }
        expect(attackHandlers.weapon_kind_mastery(feature, { ...stats, level: 9 }).maxKinds).toBe(4)
    })

    it("falls back to 2 when 'class_level_scaling' finds no exact level match or class data is missing", () => {
        const feature = makeFeature({ type: 'weapon_kind_mastery', maxKinds: 'class_level_scaling' })
        const stats = {
            ...BASE_STATS,
            class: {
                class_levels: [
                    { level: 1, weapon_mastery: 2 },
                    { level: 5, weapon_mastery: 3 },
                ]
            }
        }
        expect(attackHandlers.weapon_kind_mastery(feature, { ...stats, level: 9 }).maxKinds).toBe(2)
        expect(attackHandlers.weapon_kind_mastery(feature, BASE_STATS).maxKinds).toBe(2)
    })
})

describe('attackHandlers – bonus_action_attack', () => {
    it('returns default envelope with usesMax 0 and canonical warPriestUses resource key', () => {
        const feature = makeFeature({ type: 'bonus_action_attack' })
        expect(attackHandlers.bonus_action_attack(feature, BASE_STATS)).toEqual({
            type: 'bonus_action_attack',
            name: 'Test Feature',
            trigger: '',
            action: 'bonus_action',
            weaponAttack: false,
            extraDamageExpression: '',
            effect: null,
            usesMax: 0,
            recharge: 'long_rest',
            resourceKey: 'warPriestUses',
            weaponRequirement: null,
            hasAutomation: true,
        })
    })

    it('evaluates uses_expression through the real expression engine', () => {
        const feature = makeFeature({ type: 'bonus_action_attack', uses_expression: 'proficiency_bonus' })
        // BASE_STATS.proficiency = 3 — discriminates real evaluation from the 0 default.
        expect(attackHandlers.bonus_action_attack(feature, BASE_STATS).usesMax).toBe(3)
    })

    it('passes through custom fields but keeps resourceKey hardcoded', () => {
        const feature = makeFeature({
            type: 'bonus_action_attack',
            trigger: 'after_hit',
            action: 'action',
            weaponAttack: true,
            extraDamageExpression: '1d8',
            effect: 'grappled',
            recharge: '5-6',
            resourceKey: 'customKey',
            weaponRequirement: 'melee',
        })
        expect(attackHandlers.bonus_action_attack(feature, BASE_STATS)).toEqual({
            type: 'bonus_action_attack',
            name: 'Test Feature',
            trigger: 'after_hit',
            action: 'action',
            weaponAttack: true,
            extraDamageExpression: '1d8',
            effect: 'grappled',
            usesMax: 0,
            recharge: '5-6',
            resourceKey: 'warPriestUses',
            weaponRequirement: 'melee',
            hasAutomation: true,
        })
    })
})

describe('attackHandlers – bonus_attacks', () => {
    it('returns default envelope', () => {
        const feature = makeFeature({ type: 'bonus_attacks' })
        expect(attackHandlers.bonus_attacks(feature, BASE_STATS)).toEqual({
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

    it('derives action from casting_time (bonus > reaction > action) and null otherwise', () => {
        for (const [castingTime, action] of [
            ['1 bonus action', 'bonus_action'],
            ['1 reaction', 'reaction'],
            ['1 action', 'action'],
            ['special', null],
        ]) {
            const result = attackHandlers.bonus_attacks(makeFeature({ type: 'bonus_attacks', casting_time: castingTime }), BASE_STATS)
            expect(result.action, `casting_time=${castingTime}`).toBe(action)
        }
    })

    it('falls back to extraAttacks then 2, preferring explicit attacks', () => {
        expect(attackHandlers.bonus_attacks(makeFeature({ type: 'bonus_attacks', extraAttacks: 3 }), BASE_STATS).attacks).toBe(3)
        expect(attackHandlers.bonus_attacks(makeFeature({ type: 'bonus_attacks', attacks: 4, extraAttacks: 1 }), BASE_STATS).attacks).toBe(4)
    })

    it('passes through custom fields verbatim', () => {
        const feature = makeFeature({
            type: 'bonus_attacks',
            attacks: 3,
            attackType: 'fist',
            cost: '1d4',
            trigger: 'on_hit',
            casting_time: '1 action',
            weaponRequirements: ['finesse'],
            weaponRestriction: 'melee',
        })
        expect(attackHandlers.bonus_attacks(feature, BASE_STATS)).toEqual({
            type: 'bonus_attacks',
            name: 'Test Feature',
            attacks: 3,
            attackType: 'fist',
            cost: '1d4',
            trigger: 'on_hit',
            action: 'action',
            casting_time: '1 action',
            weaponRequirements: ['finesse'],
            weaponRestriction: 'melee',
            hasAutomation: true,
        })
    })
})

describe('attackHandlers – concentration_bonus_attack', () => {
    it('returns default envelope carrying the automation object through', () => {
        const auto = { type: 'concentration_bonus_attack' }
        expect(attackHandlers.concentration_bonus_attack(makeFeature(auto), BASE_STATS)).toEqual({
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
            automation: auto,
        })
    })

    it('passes through custom fields verbatim', () => {
        const auto = {
            type: 'concentration_bonus_attack',
            trigger: 'on_cast',
            action: 'action',
            weaponAttack: true,
            concentrationSpell: 'spirit_guardians',
            casting_time: '1 action',
            attacks: 3,
            weaponRequirement: 'staff',
            attack_type: 'melee',
        }
        expect(attackHandlers.concentration_bonus_attack(makeFeature(auto), BASE_STATS)).toEqual({
            type: 'concentration_bonus_attack',
            name: 'Test Feature',
            trigger: 'on_cast',
            action: 'action',
            weaponAttack: true,
            concentrationSpell: 'spirit_guardians',
            casting_time: '1 action',
            attacks: 3,
            weaponRequirement: 'staff',
            attack_type: 'melee',
            hasAutomation: true,
            automation: auto,
        })
    })
})

describe('attackHandlers – quivering_palm', () => {
    it('returns default envelope with canonical 10d12 Force', () => {
        const feature = makeFeature({ type: 'quivering_palm' })
        expect(attackHandlers.quivering_palm(feature, BASE_STATS)).toEqual({
            type: 'quivering_palm',
            name: 'Test Feature',
            damageExpression: '10d12',
            damageType: 'Force',
            casting_time: 'passive',
            hasAutomation: true,
        })
    })

    it('passes through custom damage and casting time', () => {
        const feature = makeFeature({
            type: 'quivering_palm',
            damageExpression: '8d10',
            damageType: 'Necrotic',
            casting_time: '1 action',
        })
        expect(attackHandlers.quivering_palm(feature, BASE_STATS)).toEqual({
            type: 'quivering_palm',
            name: 'Test Feature',
            damageExpression: '8d10',
            damageType: 'Necrotic',
            casting_time: '1 action',
            hasAutomation: true,
        })
    })
})

describe('attackHandlers – dual_wielder_attack', () => {
    // FT-104: dedicated effect key (was mis-routed through bonus_attacks);
    // action is hardcoded to bonus_action regardless of casting_time.
    it('returns default single off-hand envelope locked to bonus_action', () => {
        const feature = makeFeature({ type: 'dual_wielder_attack' })
        expect(attackHandlers.dual_wielder_attack(feature, BASE_STATS)).toEqual({
            type: 'dual_wielder_attack',
            name: 'Test Feature',
            attacks: 1,
            attackType: 'melee',
            cost: null,
            trigger: 'attack_action_with_light_weapon',
            action: 'bonus_action',
            casting_time: '1 bonus action',
            weaponRequirements: null,
            weaponRestriction: null,
            hasAutomation: true,
        })
    })

    it('falls back to extraAttacks and keeps action hardcoded despite custom casting_time', () => {
        const feature = makeFeature({
            type: 'dual_wielder_attack',
            extraAttacks: 2,
            attackType: 'ranged',
            cost: '1d4',
            casting_time: '1 reaction',
            weaponRequirements: ['light'],
            weaponRestriction: 'one_handened',
        })
        expect(attackHandlers.dual_wielder_attack(feature, BASE_STATS)).toEqual({
            type: 'dual_wielder_attack',
            name: 'Test Feature',
            attacks: 2,
            attackType: 'ranged',
            cost: '1d4',
            trigger: 'attack_action_with_light_weapon',
            action: 'bonus_action',
            casting_time: '1 reaction',
            weaponRequirements: ['light'],
            weaponRestriction: 'one_handened',
            hasAutomation: true,
        })
    })
})

describe('attackHandlers – stealth_attack', () => {
    it('returns default envelope with 1d6 passive cost', () => {
        const feature = makeFeature({ type: 'stealth_attack' })
        expect(attackHandlers.stealth_attack(feature, BASE_STATS)).toEqual({
            type: 'stealth_attack',
            name: 'Test Feature',
            cost: '1d6',
            casting_time: 'passive',
            hasAutomation: true,
        })
    })

    it('passes through custom cost and casting time', () => {
        const feature = makeFeature({ type: 'stealth_attack', cost: '2d6', casting_time: '1 action' })
        expect(attackHandlers.stealth_attack(feature, BASE_STATS)).toEqual({
            type: 'stealth_attack',
            name: 'Test Feature',
            cost: '2d6',
            casting_time: '1 action',
            hasAutomation: true,
        })
    })
})

describe('attackHandlers – war_bond_summon', () => {
    it('returns default envelope bonding 2 weapons as a bonus action', () => {
        const feature = makeFeature({ type: 'war_bond_summon' })
        expect(attackHandlers.war_bond_summon(feature, BASE_STATS)).toEqual({
            type: 'war_bond_summon',
            name: 'Test Feature',
            action: 'bonus_action',
            bondedWeaponCount: 2,
            casting_time: '1 bonus action',
            hasAutomation: true,
        })
    })

    it('passes through custom action, count, and casting time', () => {
        const feature = makeFeature({
            type: 'war_bond_summon',
            action: 'action',
            bondedWeaponCount: 3,
            casting_time: '1 reaction',
        })
        expect(attackHandlers.war_bond_summon(feature, BASE_STATS)).toEqual({
            type: 'war_bond_summon',
            name: 'Test Feature',
            action: 'action',
            bondedWeaponCount: 3,
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })
})
