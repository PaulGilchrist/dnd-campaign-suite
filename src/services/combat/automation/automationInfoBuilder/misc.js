import { evaluateAutoExpression } from '../automationExpressions.js'
import { getAbilityModifier } from '../../../shared/abilityLookup.js'

export const miscHandlers = {
    'cantrip_spellcasting_ability': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'cantrip_spellcasting_ability',
            name: feature.name,
            cantripName: auto.cantripName || '',
            spellcastingAbility: auto.spellcastingAbility || '',
            hasAutomation: true
        }
    },

    'auto_effect': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'auto_effect',
            name: feature.name,
            trigger: auto.trigger || '',
            effect: auto.effect || '',
            value: auto.value || null,
            uses: auto.uses || null,
            recharge: auto.recharge || 'long_rest',
            duration: auto.duration || '',
            casting_time: auto.casting_time || '',
            hasAutomation: true
        }
    },

    'survive_and_heal': (feature, playerStats) => {
        const auto = feature.automation
        const maxHp = playerStats.hitPoints?.max || playerStats.level || 1
        const healAmount = auto.healExpression === 'half_max_hp'
            ? Math.floor(maxHp / 2)
            : (auto.healExpression ? parseInt(auto.healExpression, 10) : Math.floor(maxHp / 2))
        return {
            type: 'survive_and_heal',
            name: feature.name,
            trigger: auto.trigger || 'reduced_to_0_hp',
            effect: auto.effect || 'survive_and_heal',
            minHp: auto.minHp || 1,
            healAmount,
            recharge: auto.recharge || 'long_rest',
            hasAutomation: true
        }
    },

    'auto_reroll': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'auto_reroll',
            name: feature.name,
            target: auto.target || 'd20',
            condition: auto.condition || '',
            effect: auto.effect || 'reroll',
            trigger: auto.trigger || '',
            bonus: auto.bonus ?? null,
            range: auto.range || '',
            resourceCost: auto.resourceCost || '',
            casting_time: auto.casting_time || '',
            bonusExpression: auto.bonusExpression || '',
            oncePerRage: !!auto.oncePerRage,
            oncePerTurn: !!auto.oncePerTurn,
            oncePer: auto.oncePer || '',
            hasAutomation: true
        }
    },

    'restore_balance': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'restore_balance',
            name: feature.name,
            target: auto.target || 'd20',
            range: auto.range || '60_ft',
            hasAutomation: true
        }
    },

    'countercharm': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'countercharm',
            name: feature.name,
            trigger: auto.trigger || '',
            range: auto.range || '',
            conditions: auto.conditions || [],
            effect: auto.effect || '',
            uses: auto.uses || 1,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'misty_wanderer': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'misty_wanderer',
            name: feature.name,
            trigger: auto.trigger || '',
            range: auto.range || '5_ft',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'misty_escape': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'misty_escape',
            name: feature.name,
            spell: auto.spell || 'Misty Step',
            saveType: auto.saveType || 'WIS',
            saveDc: auto.saveDc || 'ability',
            saveAbility: auto.saveAbility || 'CHA',
            damageExpression: auto.damageExpression || '',
            damageType: auto.damageType || '',
            condition: auto.condition || 'invisible',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'steps_of_the_fey': (feature, playerStats) => {
        const auto = feature.automation
        let usesMax = auto.uses || 1;
        if (auto.uses_expression) {
            usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 1;
        }
        return {
            type: 'steps_of_the_fey',
            name: feature.name,
            spell: auto.spell || 'Misty Step',
            uses: auto.uses || 1,
            uses_expression: auto.uses_expression || '',
            usesMax,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '1 bonus action',
            saveAbility: auto.saveAbility || 'CHA',
            saveDc: auto.saveDc || 'ability',
            hasAutomation: true
        }
    },

    'moonlight_step_rider': (feature, _playerStats) => {
        return {
            type: 'moonlight_step_rider',
            name: feature.name,
            hasAutomation: true
        }
    },

    'post_cast_rider': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'post_cast_rider',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc: auto.saveDc || 'ability',
            saveAbility: auto.saveAbility || 'CHA',
            condition: auto.condition || '',
            duration: auto.duration || '1_minute',
            range: auto.range || '60 ft',
            spellSchools: auto.spellSchools || [],
            recharge: auto.recharge || 'long_rest',
            hasAutomation: true
        }
    },

    'post_cast_smite_cover': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'post_cast_smite_cover',
            name: feature.name,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'post_cast_inspiring_smite': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'post_cast_inspiring_smite',
            name: feature.name,
            range: auto.range || '30 ft',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'resistance': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'resistance',
            name: feature.name,
            damageTypes: auto.damageTypes || [],
            hasAutomation: true
        }
    },

    'land_resistance': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'land_resistance',
            name: feature.name,
            conditionImmunity: auto.conditionImmunity || '',
            landMappings: auto.landMappings || {},
            hasAutomation: true
        }
    },

    'set_condition': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'set_condition',
            name: feature.name,
            target: auto.target,
            condition: auto.condition,
            additionalCondition: auto.additionalCondition || null,
            cost: auto.cost || '',
            range: auto.range || '60 ft',
            saveType: auto.saveType || 'STR',
            effect: auto.effect || '',
            hasAutomation: true
        }
    },

    'shadow_step_rider': (feature, _playerStats) => {
        return {
            type: 'shadow_step_rider',
            name: feature.name,
            hasAutomation: true
        }
    },

    'relentless_avenger': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'relentless_avenger',
            name: feature.name,
            trigger: auto.trigger || 'after_opportunity_attack_hit',
            duration: auto.duration || 'until_end_of_current_turn',
            hasAutomation: true
        }
    },

    'soul_of_vengeance': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'soul_of_vengeance',
            name: feature.name,
            trigger: auto.trigger || 'after_vow_of_enmity_target_attacks',
            hasAutomation: true
        }
    },

    'hunter_prey': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'hunter_prey',
            name: feature.name,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'defensive_tactics': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'defensive_tactics',
            name: feature.name,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'superior_hunter_prey': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'superior_hunter_prey',
            name: feature.name,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'superior_hunter_defense': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'superior_hunter_defense',
            name: feature.name,
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'bonus_action_choice': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'bonus_action_choice',
            name: feature.name,
            options: auto.options || [],
            action: auto.action || 'bonus_action',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'steady_aim': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'steady_aim',
            name: feature.name,
            duration: auto.duration || 'until_end_of_turn',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'mage_hand_control': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'mage_hand_control',
            name: feature.name,
            range: auto.range || '30_ft',
            action: auto.action || 'bonus_action',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'stroke_of_luck': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'stroke_of_luck',
            name: feature.name,
            target: auto.target || 'd20',
            recharge: auto.recharge || 'short_or_long_rest',
            hasAutomation: true
        }
    },

    'modify_d20_roll': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'modify_d20_roll',
            name: feature.name,
            modifier: auto.modifier || '2d4',
            range: auto.range || '60 ft',
            canBeBonusOrPenalty: !!auto.canBeBonusOrPenalty,
            recharge: auto.recharge || 'initiative_or_short_or_long_rest',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'fast_hands': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'fast_hands',
            name: feature.name,
            options: auto.options || [],
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'use_magic_device': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'use_magic_device',
            name: feature.name,
            attunementLimit: auto.attunementLimit || 4,
            chargeReroll: auto.chargeReroll || '1d6',
            chargeRerollSuccess: auto.chargeRerollSuccess || 6,
            scrollAbility: auto.scrollAbility || 'INT',
            scrollCheckDC: auto.scrollCheckDC || '10 + spell_level',
            scrollDisintegratesOnFail: !!auto.scrollDisintegratesOnFail,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'wild_magic_surge': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'wild_magic_surge',
            name: feature.name,
            trigger: auto.trigger || '',
            oncePerTurn: auto.oncePerTurn || false,
            hasAutomation: true
        }
    },

    'wild_magic_tamed': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'wild_magic_tamed',
            name: feature.name,
            trigger: auto.trigger || '',
            recharge: auto.recharge || 'long_rest',
            uses: auto.uses || 1,
            hasAutomation: true
        }
    },

    'feats_of_chaos': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'feats_of_chaos',
            name: feature.name,
            target: auto.target || 'd20',
            condition: auto.condition || 'feats_of_chaos_active',
            effect: 'advantage',
            abilities: auto.abilities || [],
            hasAutomation: true
        }
    },

    'multi_target_spread': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'multi_target_spread',
            name: feature.name,
            spellFilter: auto.spellFilter || [],
            range: auto.range || '10 ft',
            hasAutomation: true
        }
    },

    'bewitching_magic': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'bewitching_magic',
            name: feature.name,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'radiant_soul': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'radiant_soul',
            name: feature.name,
            damageTypes: auto.damageTypes || [],
            damageExpression: auto.damageExpression || '',
            oncePerTurn: !!auto.oncePerTurn,
            hasAutomation: true
        }
    },

    'celestial_resilience': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'celestial_resilience',
            name: feature.name,
            tempHpExpression: auto.tempHpExpression || '',
            allyTempHpExpression: auto.allyTempHpExpression || '',
            maxAllies: auto.maxAllies || 5,
            range: auto.range || '60_ft',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'dark_ones_luck': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'dark_ones_luck',
            name: feature.name,
            diceExpression: auto.diceExpression || '1d10',
            hasAutomation: true
        }
    },

    'hurl_through_hell': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'hurl_through_hell',
            name: feature.name,
            damageExpression: auto.damageExpression || '',
            damageType: auto.damageType || '',
            saveType: auto.saveType || 'CHA',
            saveDc: auto.saveDc || 'ability',
            saveAbility: auto.saveAbility || 'CHA',
            oncePerTurn: !!auto.oncePerTurn,
            uses: auto.uses || 1,
            pactMagicRecharge: !!auto.pactMagicRecharge,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'clairvoyant_combatant': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'clairvoyant_combatant',
            name: feature.name,
            saveType: auto.saveType || 'WIS',
            saveDc: auto.saveDc || 'ability',
            saveAbility: auto.saveAbility || 'CHA',
            duration: auto.duration || '1_minute',
            uses: auto.uses || 1,
            pactMagicRecharge: !!auto.pactMagicRecharge,
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'memorize_spell': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'memorize_spell',
            name: feature.name,
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'spell_breaker': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'passive_rule',
            name: feature.name,
            effect: 'spell_breaker',
            alwaysPreparedSpells: auto.alwaysPreparedSpells || [],
            bonusActionSpells: auto.bonusActionSpells || [],
            dispelAbilityCheckBonus: auto.dispelAbilityCheckBonus || '',
            slotRetentionSpells: auto.slotRetentionSpells || [],
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'create_thrall': (feature, playerStats) => {
        const auto = feature.automation
        let usesMax = auto.uses || 1;
        if (auto.uses_expression) {
            usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 1;
        }
        return {
            type: 'create_thrall',
            name: feature.name,
            spell: auto.spell || '',
            uses: auto.uses || 1,
            uses_expression: auto.uses_expression || '',
            usesMax,
            recharge: auto.recharge || 'long_rest',
            action: auto.action || 'action',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'portent': (feature, playerStats) => {
        const auto = feature.automation
        const maxDice = (playerStats.level >= 14) ? 3 : 2;
        return {
            type: 'portent',
            name: feature.name,
            effect: auto.effect || '',
            maxDice,
            hasAutomation: true
        }
    },

    'third_eye': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'bonus_action_choice',
            name: feature.name,
            options: [
                { name: 'Darkvision (120 feet)', description: 'You gain Darkvision out to a range of 120 feet.' },
                { name: 'Greater Comprehension', description: 'You can read any language.' },
                { name: 'See Invisibility', description: 'You can see invisible creatures and objects within 10 feet of you that are within line of sight.' },
            ],
            action: 'bonus_action',
            casting_time: '1 bonus action',
            duration: auto.duration || 'short_or_long_rest',
            hasAutomation: true
        }
    },

    'improved_illusions': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'improved_illusions',
            name: feature.name,
            effect: 'improved_illusions',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true
        }
    },

    'phantasmal_creatures': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'phantasmal_creatures',
            name: feature.name,
            effect: 'phantasmal_creatures',
            casting_time: auto.casting_time || 'passive',
            hasAutomation: true,
            alwaysPreparedSpells: auto.alwaysPreparedSpells || [],
            freeCastSpells: auto.freeCastSpells || [],
            usesMax: auto.usesMax || 1,
            recharge: auto.recharge || 'long_rest',
            halvesHp: auto.halvesHp || false,
        }
    },

    'illusory_reality': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'illusory_reality',
            name: feature.name,
            effect: 'illusory_reality',
            casting_time: auto.casting_time || '1 bonus_action',
            objectDuration: auto.objectDuration || '1 minute',
            hasAutomation: true,
        }
    },

    'celestial_revelation': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'celestial_revelation',
            name: feature.name,
            options: auto.options || [],
            chooseOne: !!auto.chooseOne,
            duration: auto.duration || '1_minute',
            action: auto.action || 'bonus_action',
            casting_time: auto.casting_time || '1 bonus action',
            recharge: auto.recharge || 'long_rest',
            minLevel: auto.minLevel || 3,
            hasAutomation: true
        }
    },

    'elfish_lineage': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'elfish_lineage',
            name: feature.name,
            options: auto.options || [],
            chooseOne: !!auto.chooseOne,
            hasAutomation: true
        }
    },

    'gnomish_lineage': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'gnomish_lineage',
            name: feature.name,
            options: auto.options || [],
            chooseOne: !!auto.chooseOne,
            hasAutomation: true
        }
    },

    'fiendish_legacy': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'fiendish_legacy',
            name: feature.name,
            options: auto.options || [],
            chooseOne: !!auto.chooseOne,
            hasAutomation: true
        }
    },

    'lesser_restoration': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'lesser_restoration',
            name: feature.name,
            range: auto.range || 'Touch',
            conditions: auto.conditions || ['blinded', 'deafened', 'paralyzed', 'poisoned'],
            casting_time: auto.casting_time || 'bonus_action',
            hasAutomation: true
        }
    },

    'remove_curse': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'remove_curse',
            name: feature.name,
            range: auto.range || 'Touch',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'protection_from_poison': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'protection_from_poison',
            name: feature.name,
            range: auto.range || 'Touch',
            duration: auto.duration || '1 hour',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'sentinel': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'sentinel',
            name: feature.name,
            effect: auto.effect || 'speed_0_on_oa_hit',
            duration: auto.duration || 'end_of_turn',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'telekinetic_shove': (feature, playerStats) => {
        const auto = feature.automation
        const prof = playerStats.proficiency || 0
        const saveDc = auto.saveDc === 'ability'
            ? 8 + getAbilityModifier(playerStats.abilities, auto.saveAbility || 'INT') + prof
            : auto.saveDc || 10
        let action = auto.action
        if (!action && auto.casting_time) {
            if (auto.casting_time === '1 bonus action' || auto.casting_time === 'bonus_action') {
                action = 'bonus_action'
            } else if (auto.casting_time === '1 action' || auto.casting_time === 'action') {
                action = 'action'
            }
        }
        return {
            type: 'telekinetic_shove',
            name: feature.name,
            saveType: auto.saveType || 'STR',
            saveDc,
            saveAbility: auto.saveAbility || 'INT',
            range: auto.range || '30',
            pushDistance: auto.pushDistance || 5,
            action: action || 'bonus_action',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'arcane_ward': (feature, playerStats) => {
        const auto = feature.automation
        const intMod = getAbilityModifier(playerStats.abilities, 'Intelligence')
        const wizardLevel = playerStats.level
        const maxHp = wizardLevel * 2 + intMod
        return {
            type: 'arcane_ward',
            name: feature.name,
            wardHpExpression: auto.wardHpExpression || `(2 * ${wizardLevel}) + ${intMod}`,
            wardRestoreExpression: auto.wardRestoreExpression || '2 * spell_slot_level',
            wardTrigger: auto.wardTrigger || 'abjuration_spell_cast',
            wardDuration: auto.wardDuration || 'long_rest',
            bonusActionRestore: !!auto.bonusActionRestore,
            maxHp,
            hasAutomation: true
        }
    },

    'arcane_ward_bonus_action': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'arcane_ward_bonus_action',
            name: feature.name,
            action: 'bonus_action',
            casting_time: auto.casting_time || '1 bonus action',
            hasAutomation: true
        }
    },

    'projected_ward': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'projected_ward',
            name: feature.name,
            range: auto.range || 30,
            reaction: true,
            wardTrigger: auto.wardTrigger || 'ally_damage_taken',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'animal_aspect': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'animal_aspect',
            name: feature.name,
            options: auto.options || [],
            casting_time: auto.casting_time || '',
            hasAutomation: true
        }
    },

    'clouds_jaunt': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'clouds_jaunt',
            name: feature.name,
            distance: auto.distance || '30 ft',
            range: auto.range || '30_ft',
            uses: auto.uses || null,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '1 bonus action',
            automation: auto,
            hasAutomation: true
        }
    },

    'fire_burn': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'fire_burn',
            name: feature.name,
            damage: auto.damage || '1d10',
            damageType: auto.damageType || 'Fire',
            trigger: auto.trigger || 'hit',
            uses: auto.uses || null,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'frosts_chill': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'frosts_chill',
            name: feature.name,
            damage: auto.damage || '1d6',
            damageType: auto.damageType || 'Cold',
            condition: auto.condition || 'speed_reduction',
            value: auto.value || '10_ft',
            trigger: auto.trigger || 'hit',
            uses: auto.uses || null,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'hills_tumble': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'hills_tumble',
            name: feature.name,
            trigger: auto.trigger || 'melee_hit',
            effect: auto.effect || 'prone',
            uses: auto.uses || null,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '1 action',
            hasAutomation: true
        }
    },

    'stones_endurance': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'stones_endurance',
            name: feature.name,
            reductionExpression: auto.reductionExpression || '1d12 + CON modifier',
            trigger: auto.trigger || 'damage_received',
            uses: auto.uses || null,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    },

    'storms_thunder': (feature, _playerStats) => {
        const auto = feature.automation
        return {
            type: 'storms_thunder',
            name: feature.name,
            damage: auto.damage || '1d8',
            damageType: auto.damageType || 'Thunder',
            range: auto.range || '60_ft',
            trigger: auto.trigger || 'damage_received_within_range',
            uses: auto.uses || null,
            recharge: auto.recharge || 'long_rest',
            casting_time: auto.casting_time || '1 reaction',
            hasAutomation: true
        }
    }
}
