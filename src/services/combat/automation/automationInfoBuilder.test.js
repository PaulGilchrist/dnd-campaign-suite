// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

// Map of handler keys to the type they actually return in result.type
// Many handlers transform the handler key into a different output type.
const HANDLER_OUTPUT_TYPES = {
    // attack.js — all return their handler key
    attack_rider: 'attack_rider', open_hand_technique: 'open_hand_technique',
    mastery_rider: 'mastery_rider', bonus_action_attack: 'bonus_action_attack',
    bonus_attacks: 'bonus_attacks', concentration_bonus_attack: 'concentration_bonus_attack',
    stealth_attack: 'stealth_attack', war_bond_summon: 'war_bond_summon',
    // save.js — all return their handler key
    save_attack: 'save_attack', save_only: 'save_only',
    flesh_to_stone: 'flesh_to_stone', hold_monster: 'hold_monster',
    resilient_sphere: 'resilient_sphere', ottos_dance: 'ottos_dance',
    power_word_stun: 'power_word_stun', sleep: 'sleep',
    stinking_cloud: 'stinking_cloud', tashas_laughter: 'tashas_laughter',
    // passive.js — several transform the type
    passive_buff: 'passive_buff',
    ignore_resistance: 'passive_rule',
    passive_immunity: 'passive_immunity',
    holy_nimbus_radiant_damage: 'passive_rule',
    umbral_sight: 'passive_rule', supreme_sneak: 'passive_rule',
    otherworldly_glamour: 'passive_buff',
    create_thrall_temp_hp: 'create_thrall_temp_hp',
    ritual_spells: 'passive_rule', potent_cantrip: 'potent_cantrip',
    soulstitch_spells: 'soulstitch_spells', empowered_evocation: 'empowered_evocation',
    concentration_disadvantage_on_damage_dealt: 'passive_rule',
    tavern_brawler_reroll_ones: 'passive_rule',
    tavern_brawler_push: 'passive_rule',
    ignore_loading_crossbows: 'passive_rule',
    no_melee_disadvantage_crossbows: 'passive_rule',
    naturally_stealthy: 'passive_rule',
    // combatStance.js
    combat_stance: 'combat_stance',
    // bardic.js
    bardic_inspiration: 'bardic_inspiration',
    bardic_inspiration_defense: 'bardic_inspiration_defense',
    bardic_inspiration_offense: 'bardic_inspiration_offense',
    // damage.js — several transform the type
    damage_bonus: 'damage_bonus', damage_modifier: 'damage_modifier',
    damage_type_modifier: 'damage_type_modifier', damage_type_choice: 'damage_type_choice',
    weapon_mastery_choice: 'weapon_mastery_choice', damage_reduction: 'damage_reduction',
    damage_aura: 'damage_aura', psionic_strike: 'psionic_strike',
    primal_companion_double_strike_damage: 'damage_bonus',
    great_weapon_fighting: 'passive_rule', grapple_damage: 'passive_rule',
    two_weapon_fighting: 'passive_rule', reroll_damage_once_per_turn: 'passive_rule',
    // The 'damage' handler key transforms based on feature.type/source
    damage: null, // returns null for features without type==='damage' && source==='feat'
    // healing.js
    healing: 'healing', healing_pool: 'healing_pool', self_healing: 'self_healing',
    buff_ally: 'buff_ally', heroic_inspiration_buff: 'buff_ally',
    divine_spark: 'divine_spark', reaction_save_heal: 'reaction_save_heal',
    post_cast_self_heal: 'post_cast_self_heal', post_cast_ally_heal: 'post_cast_ally_heal',
    heroes_feast: 'heroes_feast', healing_bonus: 'passive_rule',
    // reaction.js
    reaction_bonus: 'reaction_bonus', reaction_damage: 'reaction_damage',
    reaction_debuff: 'reaction_debuff', reaction_save: 'reaction_save',
    shadowy_dodge: 'shadowy_dodge', glorious_defense: 'glorious_defense',
    beguiling_defenses: 'beguiling_defenses', searing_vengeance: 'searing_vengeance',
    illusory_self: 'illusory_self', reaction_counterspell: 'reaction_counterspell',
    lucky_point: 'lucky_point', reaction_spell: 'reaction_spell',
    sentinel_guardian: 'sentinel_guardian',
    // resource.js
    resource_pool: 'resource_pool', resource_restoration: 'resource_restoration',
    // spell.js
    free_spell: 'free_spell', fey_reinforcements: 'fey_reinforcements',
    contact_patron: 'contact_patron', dragon_companion: 'dragon_companion',
    spell_modifier: 'spell_modifier', spell_thief: 'spell_thief',
    war_magic_cantrip: 'war_magic_cantrip', war_magic_spell: 'war_magic_spell',
    arcane_charge: 'arcane_charge', guarded_mind: 'guarded_mind',
    bulwark_of_force: 'bulwark_of_force', signature_spells: 'signature_spells',
    spell_mastery: 'spell_mastery', overchannel: 'overchannel',
    pass_without_trace: 'pass_without_trace', warding_bond: 'warding_bond',
    // diverse.js
    extra_action: 'extra_action', font_of_magic: 'font_of_magic',
    font_of_inspiration: 'font_of_inspiration', meta: 'meta',
    jack_of_all_trades: 'jack_of_all_trades', reliable_talent: 'reliable_talent',
    divine_order: 'divine_order', divine_intervention: 'divine_intervention',
    // misc.js
    auto_effect: 'auto_effect', survive_and_heal: 'survive_and_heal',
    auto_reroll: 'auto_reroll', restore_balance: 'restore_balance',
    countercharm: 'countercharm', misty_wanderer: 'misty_wanderer',
    misty_escape: 'misty_escape', steps_of_the_fey: 'steps_of_the_fey',
    moonlight_step_rider: 'moonlight_step_rider', post_cast_rider: 'post_cast_rider',
    post_cast_smite_cover: 'post_cast_smite_cover',
    post_cast_inspiring_smite: 'post_cast_inspiring_smite',
    resistance: 'resistance', land_resistance: 'land_resistance',
    set_condition: 'set_condition', shadow_step_rider: 'shadow_step_rider',
    relentless_avenger: 'relentless_avenger', soul_of_vengeance: 'soul_of_vengeance',
    hunter_prey: 'hunter_prey', defensive_tactics: 'defensive_tactics',
    superior_hunter_prey: 'superior_hunter_prey',
    superior_hunter_defense: 'superior_hunter_defense',
    bonus_action_choice: 'bonus_action_choice', steady_aim: 'steady_aim',
    mage_hand_control: 'mage_hand_control', stroke_of_luck: 'stroke_of_luck',
    modify_d20_roll: 'modify_d20_roll', fast_hands: 'fast_hands',
    use_magic_device: 'use_magic_device', wild_magic_surge: 'wild_magic_surge',
    wild_magic_tamed: 'wild_magic_tamed',
    feats_of_chaos: 'conditional_advantage', multi_target_spread: 'multi_target_spread',
    bewitching_magic: 'bewitching_magic', radiant_soul: 'radiant_soul',
    celestial_resilience: 'celestial_resilience', dark_ones_look: 'dark_ones_look',
    hurl_through_hell: 'hurl_through_hell', clairvoyant_combatant: 'clairvoyant_combatant',
    memorize_spell: 'memorize_spell', spell_breaker: 'passive_rule',
    create_thrall: 'create_thrall', portent: 'portent',
    third_eye: 'bonus_action_choice', improved_illusions: 'improved_illusions',
    phantasmal_creatures: 'phantasmal_creatures', illusory_reality: 'illusory_reality',
    celestial_revelation: 'celestial_revelation', elfish_lineage: 'elfish_lineage',
    gnomish_lineage: 'gnomish_lineage', fiendish_legacy: 'fiendish_legacy',
    lesser_restoration: 'lesser_restoration', remove_curse: 'remove_curse',
    protection_from_poison: 'protection_from_poison', sentinel: 'sentinel',
    telekinetic_shove: 'telekinetic_shove',
    // nature.js
    nature_sanctuary: 'nature_sanctuary', nature_sanctuary_move: 'nature_sanctuary_move',
    // primal.js
    primal_companion_summon: 'primal_companion_summon',
    primal_companion_dodge: 'primal_companion_dodge',
    primal_companion_command: 'primal_companion_command',
    primal_companion_restore: 'primal_companion_restore',
    primal_companion_bonus_action_command: 'primal_companion_bonus_action_command',
    primal_companion_double_strike: 'primal_companion_double_strike',
    primal_companion_spell_share: 'primal_companion_spell_share',
    // psionic.js
    psychic_spells: 'psychic_spells', psionic_sorcery: 'psionic_sorcery',
    psionic_spells_list: 'psionic_spells_list',
    telekinetic_movement: 'telekinetic_movement', telekinetic_leap: 'telekinetic_leap',
    telekinetic_thrust: 'telekinetic_thrust',
    // sorcery.js
    sorcery_aura: 'sorcery_aura', sorcery_incarnate: 'sorcery_incarnate',
    bastion_of_law: 'bastion_of_law', transe_of_order: 'transe_of_order',
    clockwork_cavalcade: 'clockwork_cavalcade',
    warping_implosion: 'save_attack',
    // starry.js
    starry_form: 'starry_form', cosmic_omen: 'cosmic_omen',
    twinkling_constellations: 'twinkling_constellations',
    // temp.js
    temp_buff: 'temp_buff', temp_hp_buff: 'temp_hp_buff',
    sacred_weapon: 'temp_buff', avenging_angel: 'temp_buff',
    holy_nimbus: 'holy_nimbus', cloak_of_shadows: 'cloak_of_shadows',
    peerless_athlete: 'peerless_athlete', dragon_wings: 'dragon_wings',
    revelation_in_flesh: 'revelation_in_flesh', living_legend: 'living_legend',
    holy_aura: 'holy_aura', elder_champion: 'elder_champion',
    dark_ones_blessing: 'dark_ones_blessing', large_form: 'large_form',
    // initiative.js
    initiative_action: 'initiative_action',
    // misc.js
    cantrip_spellcasting_ability: 'cantrip_spellcasting_ability',
    // conditional.js
    conditional_advantage: 'conditional_advantage',
    conditional_disadvantage: 'conditional_disadvantage',
    conditional_replacement: 'conditional_replacement',
    condition_immunity_while_active: 'condition_immunity_while_active',
    evasion: 'evasion', save_proficiency: 'save_proficiency',
    passive_rule: 'passive_rule',
}

describe('buildAttackInfo', () => {
    describe('null/early-return paths', () => {
        it('returns null when feature has no automation property', () => {
            const feature = { name: 'No Automation' }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })

        it('returns null when automation is null', () => {
            const feature = { name: 'Null Auto', automation: null }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })

        it('returns null when automation is undefined', () => {
            const feature = { name: 'Undefined Auto', automation: undefined }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })

        it('returns null for unknown automation type', () => {
            const feature = makeFeature({ type: 'nonexistent_type' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })

        it('returns null when automation object has no type', () => {
            const feature = makeFeature({ foo: 'bar' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })
    })

    describe('dispatch correctness', () => {
        const knownTypes = Object.keys(HANDLER_OUTPUT_TYPES)

        for (const type of knownTypes) {
            const expectedOutputType = HANDLER_OUTPUT_TYPES[type]
            const expectNull = expectedOutputType === null

            it(`dispatches "${type}"${expectNull ? ' and returns null' : ''}`, () => {
                const feature = makeFeature({ type })
                const result = buildAttackInfo(feature, BASE_STATS)
                if (expectNull) {
                    expect(result).toBeNull()
                } else {
                    expect(result).not.toBeNull()
                    expect(result).toBeDefined()
                    expect(result.type).toBe(expectedOutputType)
                    expect(result.hasAutomation).toBe(true)
                    expect(typeof result.name).toBe('string')
                }
            })
        }
    })

    describe('behavioral assertions — handlers that compute from playerStats', () => {
        it('save_attack computes saveDc from ability scores when saveDc is "ability"', () => {
            const feature = makeFeature({
                type: 'save_attack',
                saveDc: 'ability',
                saveAbility: 'CON',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // CON bonus is 3 in BASE_STATS, so DC = 8 + 3 + proficiency(3) = 14
            expect(result.saveDc).toBe(14)
            expect(result.saveAbility).toBe('CON')
            expect(result.saveType).toBe('DEX')
        })

        it('save_attack uses explicit saveDc when provided', () => {
            const feature = makeFeature({
                type: 'save_attack',
                saveDc: 16,
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.saveDc).toBe(16)
        })

        it('save_attack defaults saveDc to 10 when not "ability" and no explicit value', () => {
            const feature = makeFeature({ type: 'save_attack' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.saveDc).toBe(10)
        })

        it('healing returns healExpression string when expression cannot be evaluated numerically', () => {
            const feature = makeFeature({
                type: 'healing',
                healExpression: '2d8+4',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.type).toBe('healing')
            // When evaluateAutoExpression returns the expression string (unparsed dice),
            // the handler stores it as-is
            expect(typeof result.healAmount).not.toBe('number')
            expect(result.action).toBe('action')
        })

        it('bardic_inspiration computes dieSize from class levels', () => {
            const stats = {
                ...BASE_STATS,
                class: {
                    class_levels: [{ level: 5, bardic_die: 8 }],
                },
            }
            const feature = makeFeature({ type: 'bardic_inspiration' })
            const result = buildAttackInfo(feature, stats)
            expect(result).not.toBeNull()
            expect(result.dieSize).toBe(8)
        })

        it('bardic_inspiration defaults dieSize to 6 when no class level found', () => {
            const stats = { ...BASE_STATS }
            const feature = makeFeature({ type: 'bardic_inspiration' })
            const result = buildAttackInfo(feature, stats)
            expect(result.dieSize).toBe(6)
        })

        it('combat_stance includes resourceKey and uses', () => {
            const feature = makeFeature({
                type: 'combat_stance',
                resourceKey: 'customResource',
                uses: 2,
                effect: 'rage',
                damageBonusExpression: '1d8',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.resourceKey).toBe('customResource')
            expect(result.uses).toBe(2)
            expect(result.effect).toBe('rage')
            expect(result.damageBonusExpression).toBe('1d8')
        })

        it('reaction_damage computes saveDc from WIS when saveDc is "ability"', () => {
            const feature = makeFeature({
                type: 'reaction_damage',
                saveDc: 'ability',
                saveAbility: 'WIS',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // WIS bonus is 5, proficiency is 3, so DC = 8 + 5 + 3 = 16
            expect(result.saveDc).toBe(16)
            expect(result.saveAbility).toBe('WIS')
        })

        it('reaction_damage returns null saveDc when saveDc is neither "ability" nor explicit', () => {
            const feature = makeFeature({
                type: 'reaction_damage',
                saveAbility: 'WIS',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.saveDc).toBeNull()
        })

        it('temp_buff resolves uses="proficiency_bonus" from stats', () => {
            const feature = makeFeature({
                type: 'temp_buff',
                uses: 'proficiency_bonus',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.usesMax).toBe(3)
        })

        it('temp_buff resolves uses="paladin_level" when class matches', () => {
            const stats = {
                ...BASE_STATS,
                class: { name: 'Paladin' },
            }
            const feature = makeFeature({
                type: 'temp_buff',
                uses: 'paladin_level',
            })
            const result = buildAttackInfo(feature, stats)
            expect(result).not.toBeNull()
            expect(result.usesMax).toBe(5)
        })

        it('temp_buff resolves uses="warlock_level" when class does not match', () => {
            const stats = {
                ...BASE_STATS,
                class: { name: 'Rogue', levels: 3 },
            }
            const feature = makeFeature({
                type: 'temp_buff',
                uses: 'warlock_level',
            })
            const result = buildAttackInfo(feature, stats)
            expect(result).not.toBeNull()
            expect(result.usesMax).toBe(3)
        })

        it('glorious_defense computes acBonus from CHA modifier', () => {
            const feature = makeFeature({
                type: 'glorious_defense',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // CHA bonus is 2, so acBonus = Math.max(1, 2) = 2
            expect(result.acBonus).toBe(2)
            expect(result.usesMax).toBe(2)
        })

        it('beguiling_defenses computes saveDc from CHA when saveDc is "ability"', () => {
            const feature = makeFeature({
                type: 'beguiling_defenses',
                saveDc: 'ability',
                saveAbility: 'CHA',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // CHA bonus is 2, proficiency is 3, so DC = 8 + 2 + 3 = 13
            expect(result.saveDc).toBe(13)
        })

        it('reaction_counterspell computes saveBonus from CHA and proficiency', () => {
            const feature = makeFeature({
                type: 'reaction_counterspell',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // CHA bonus is 2, proficiency is 3, so saveBonus = 8 + 2 + 3 = 13
            expect(result.saveBonus).toBe(13)
        })

        it('passive_buff with max_hp_increase returns type "passive_rule"', () => {
            const feature = makeFeature({
                type: 'passive_buff',
                effect: 'max_hp_increase',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.type).toBe('passive_rule')
        })

        it('passive_buff without special effect returns type "passive_buff"', () => {
            const feature = makeFeature({
                type: 'passive_buff',
                effect: 'ac_bonus',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.type).toBe('passive_buff')
        })

        it('free_spell computes usesMax from uses_expression', () => {
            const feature = makeFeature({
                type: 'free_spell',
                uses_expression: '2 + Math.floor(level / 2)',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // level=5, so 2 + Math.floor(5/2) = 2 + 2 = 4
            expect(result.usesMax).toBe(4)
        })

        it('free_spell defaults usesMax to 1 when no uses_expression', () => {
            const feature = makeFeature({
                type: 'free_spell',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.usesMax).toBe(1)
        })

        it('damage_bonus resolves scaling expression by level', () => {
            const feature = makeFeature({
                type: 'damage_bonus',
                damageExpression: '1d6',
                scaling: { '5': '2d6', '11': '3d6' },
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            // Level 5 should resolve to '2d6'
            expect(result.damageExpression).toBe('2d6')
        })

        it('damage_bonus uses base expression when level below all scaling entries', () => {
            const feature = makeFeature({
                type: 'damage_bonus',
                damageExpression: '1d4',
                scaling: { '11': '2d6' },
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.damageExpression).toBe('1d4')
        })

        it('attack_rider resolves scaling expression by level', () => {
            const feature = makeFeature({
                type: 'attack_rider',
                damageExpression: '1d4',
                scaling: { '5': '2d4', '11': '3d4' },
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.damageExpression).toBe('2d4')
        })
    })

    describe('behavioral assertions — handlers with default values', () => {
        it('extra_action defaults uses to 1 and recharge to short_rest', () => {
            const feature = makeFeature({ type: 'extra_action' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.uses).toBe(1)
            expect(result.recharge).toBe('short_rest')
            // resourceKey is built from feature.name: 'testfeature' + 'Uses'
            expect(result.resourceKey).toBe('testfeatureUses')
        })

        it('auto_effect defaults trigger and effect to empty strings', () => {
            const feature = makeFeature({ type: 'auto_effect' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.trigger).toBe('')
            expect(result.effect).toBe('')
            expect(result.recharge).toBe('long_rest')
        })

        it('resource_pool defaults casting_time to passive', () => {
            const feature = makeFeature({ type: 'resource_pool' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.casting_time).toBe('passive')
        })

        it('initiative_action defaults uses to 1 and recharge to long_rest', () => {
            const feature = makeFeature({ type: 'initiative_action' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.uses).toBe(1)
            expect(result.usesMax).toBe(1)
            expect(result.recharge).toBe('long_rest')
        })

        it('diverse handlers without automation object properties still work', () => {
            const feature = makeFeature({ type: 'jack_of_all_trades' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).not.toBeNull()
            expect(result.type).toBe('jack_of_all_trades')
            expect(result.hasAutomation).toBe(true)
        })
    })

    describe('behavioral assertions — handlers that return null', () => {
        it('damage handler returns null when feature has no matching type and source', () => {
            // makeFeature({ type: 'damage' }) creates automation: { type: 'damage' }
            // The damage handler checks feature.type === 'damage' && feature.source === 'feat'
            // But makeFeature doesn't set feature.type or feature.source
            const feature = makeFeature({ type: 'damage' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })

        it('damage handler returns null when feature type is "damage" but source is not "feat"', () => {
            const feature = {
                name: 'Damage from class',
                type: 'damage',
                source: 'class',
                automation: { type: 'damage' },
            }
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toBeNull()
        })
    })

    describe('name passthrough', () => {
        it('preserves custom feature name across multiple handler types', () => {
            const names = ['Flaming Strike', 'Shield of Faith', 'Hunter\'s Mark']
            const types = ['attack_rider', 'passive_buff', 'save_attack']

            for (let i = 0; i < names.length; i++) {
                const feature = makeFeature({ type: types[i] }, names[i])
                const result = buildAttackInfo(feature, BASE_STATS)
                expect(result).not.toBeNull()
                expect(result.name).toBe(names[i])
            }
        })
    })
})
