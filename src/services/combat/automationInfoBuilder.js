import { evaluateAutoExpression, resolveHealingPoolExpression, getSaveDc, resolveUses, resolveDiceExpression, resolveScaling } from './automationExpressions.js'

const CONSTELLATION_OPTIONS = ['Archer', 'Chalice', 'Dragon'];

function buildAttackInfo(feature, playerStats) {
    const auto = feature.automation
    if (!auto) return null

    const prof = playerStats.proficiency || 0
    const level = playerStats.level || 1

    switch (auto.type) {
        case 'attack_rider': {
            let resolvedExpr = auto.damageExpression || '';
            if (auto.scaling) {
                const entries = Object.entries(auto.scaling)
                    .map(([k, v]) => ({ level: parseInt(k, 10), expr: String(v) }))
                    .filter(e => !isNaN(e.level))
                    .sort((a, b) => a.level - b.level);
                for (const entry of entries) {
                    if (playerStats.level >= entry.level) {
                        resolvedExpr = entry.expr;
                    }
                }
            }
            return {
                type: 'attack_rider',
                name: feature.name,
                options: auto.options || [],
                cost: auto.cost || null,
                damageExpression: resolvedExpr,
                damageType: auto.damageType || '',
                trigger: auto.trigger || '',
                oncePerTurn: !!auto.oncePerTurn,
                chooseOne: !!auto.chooseOne,
                maxEffects: auto.maxEffects || 1,
                saveType: auto.saveType || null,
                saveDc: auto.saveDc || null,
                saveAbility: auto.saveAbility || null,
                damageDoubled: !!auto.damageDoubled,
                restoreCost: auto.restoreCost || null,
                uses: auto.uses || null,
                recharge: auto.recharge || 'long_rest',
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            }
        }

        case 'open_hand_technique': {
            return {
                type: 'open_hand_technique',
                name: feature.name,
                options: auto.options || [],
                saveType: auto.saveType || 'STR',
                saveDc: auto.saveDc || 'ability',
                saveAbility: auto.saveAbility || 'WIS',
                hasAutomation: true
            }
        }

        case 'mastery_rider': {
            return {
                type: 'mastery_rider',
                name: feature.name,
                masteries: auto.masteries || [],
                extraMastery: auto.extraMastery || [],
                trigger: auto.trigger || 'hit',
                hasAutomation: true
            }
        }

        case 'auto_effect': {
            return {
                type: 'auto_effect',
                name: feature.name,
                trigger: auto.trigger || '',
                effect: auto.effect || '',
                value: auto.value || null,
                uses: auto.uses || null,
                recharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'auto_reroll': {
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
                hasAutomation: true
            }
        }

        case 'restore_balance': {
            return {
                type: 'restore_balance',
                name: feature.name,
                target: auto.target || 'd20',
                range: auto.range || '60_ft',
                hasAutomation: true
            }
        }

        case 'bonus_action_attack': {
            const usesMax = auto.uses_expression
                ? evaluateAutoExpression(auto.uses_expression, playerStats)
                : 0
            return {
                type: 'bonus_action_attack',
                name: feature.name,
                trigger: auto.trigger || '',
                action: auto.action || 'bonus_action',
                weaponAttack: !!auto.weaponAttack,
                extraDamageExpression: auto.extraDamageExpression || '',
                usesMax,
                recharge: auto.recharge || 'long_rest',
                resourceKey: 'warPriestUses',
                hasAutomation: true
            }
        }

        case 'bonus_attacks': {
            return {
                type: 'bonus_attacks',
                name: feature.name,
                attacks: auto.attacks || 2,
                attackType: auto.attackType || 'unarmed_strike',
                cost: auto.cost || null,
                trigger: auto.trigger || 'after_attack_action',
                hasAutomation: true
            }
        }

        case 'buff_ally': {
            const usesMax = auto.uses_expression
                ? evaluateAutoExpression(auto.uses_expression, playerStats)
                : 0
            return {
                type: 'buff_ally',
                name: feature.name,
                buffExpression: auto.buffExpression || '',
                range: auto.range || '60_ft',
                action: auto.action || 'bonus_action',
                usesMax,
                usesRecharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'bardic_inspiration': {
            const usesMax = auto.uses_expression
                ? evaluateAutoExpression(auto.uses_expression, playerStats)
                : 0
            const classLevel = (playerStats.class?.class_levels || []).find(cl => cl.level === playerStats.level);
            const dieSize = classLevel?.bardic_die || 6;
            return {
                type: 'bardic_inspiration',
                name: feature.name,
                range: auto.range || '60_ft',
                action: auto.action || 'bonus_action',
                usesMax,
                usesRecharge: auto.recharge || 'long_rest',
                dieSize,
                hasAutomation: true
            }
        }

        case 'bardic_inspiration_defense':
            return {
                type: 'bardic_inspiration_defense',
                name: feature.name,
                hasAutomation: true,
            }

        case 'bardic_inspiration_offense':
            return {
                type: 'bardic_inspiration_offense',
                name: feature.name,
                hasAutomation: true,
            }

        case 'combat_stance': {
            return {
                type: 'combat_stance',
                name: feature.name,
                effect: auto.effect || '',
                damageBonusExpression: auto.damageBonusExpression || '',
                resistanceTypes: auto.resistanceTypes || [],
                advantages: auto.advantages || [],
                options: auto.options || [],
                duration: auto.duration || '',
                resourceKey: auto.resourceKey || 'ragePoints',
                uses: auto.uses || 0,
                flySpeed: auto.flySpeed || null,
                reactionSave: auto.reactionSave || null,
                blocksSpellcasting: auto.blocksSpellcasting || false,
                hasAutomation: true
            }
        }

        case 'conditional_advantage': {
            return {
                type: 'conditional_advantage',
                name: feature.name,
                target: auto.target || 'saving_throw',
                condition: auto.condition || '',
                effect: auto.effect || 'advantage',
                abilities: auto.abilities || [],
                uses: auto.uses || null,
                recharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'evasion': {
            return {
                type: 'evasion',
                name: feature.name,
                saveType: auto.saveType || 'DEX',
                shareable: !!auto.shareable,
                shareRange: auto.shareRange || 0,
                hasAutomation: true
            }
        }

        case 'conditional_disadvantage': {
            return {
                type: 'conditional_disadvantage',
                name: feature.name,
                target: auto.target || 'attack_roll',
                condition: auto.condition || '',
                effect: auto.effect || 'disadvantage',
                hasAutomation: true
            }
        }

        case 'countercharm': {
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
        }

        case 'damage_aura': {
            return {
                type: 'damage_aura',
                name: feature.name,
                damageType: auto.damageType || '',
                damageExpression: auto.damageExpression || '',
                range: auto.range || '10_ft',
                duration: auto.duration || '1_minute',
                recharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'damage_bonus': {
            let resolvedExpr = auto.damageExpression || '';
            if (auto.scaling) {
                const entries = Object.entries(auto.scaling)
                    .map(([k, v]) => ({ level: parseInt(k, 10), expr: String(v) }))
                    .filter(e => !isNaN(e.level))
                    .sort((a, b) => a.level - b.level);
                for (const entry of entries) {
                    if (playerStats.level >= entry.level) {
                        resolvedExpr = entry.expr;
                    }
                }
            }
            let usesMax = 0;
            if (auto.uses_expression) {
                usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 1;
            } else if (auto.uses) {
                usesMax = auto.uses;
            }
            return {
                type: 'damage_bonus',
                name: feature.name,
                trigger: auto.trigger || '',
                damageExpression: resolvedExpr,
                damageType: auto.damageType || '',
                maxDamage: auto.maxDamage || '',
                extraVs: auto.extraVs || null,
                extraDamage: auto.extraDamage || '',
                resourceType: auto.resourceType || 'spell_slot',
                oncePerTurn: !!auto.oncePerTurn,
                options: auto.options || [],
                tempHpExpression: auto.tempHpExpression || '',
                upgrades: auto.upgrades || '',
                rangeBonusCantrip: auto.rangeBonusCantrip || '',
                uses_expression: auto.uses_expression || '',
                usesMax,
                recharge: auto.recharge || '',
                hasAutomation: true
            }
        }

        case 'damage_modifier': {
            return {
                type: 'damage_modifier',
                name: feature.name,
                trigger: auto.trigger || '',
                modifierExpression: auto.modifierExpression || '',
                hasAutomation: true
            }
        }

        case 'damage_type_modifier': {
            return {
                type: 'damage_type_modifier',
                name: feature.name,
                trigger: auto.trigger || '',
                weaponTypes: auto.weaponTypes || [],
                options: auto.options || [],
                hasAutomation: true
            }
        }

        case 'damage_reduction': {
            return {
                type: 'damage_reduction',
                name: feature.name,
                reductionExpression: auto.reductionExpression || '',
                trigger: auto.trigger || '',
                reaction: auto.reaction || false,
                redirect: auto.redirect || false,
                redirectCost: auto.redirectCost || null,
                redirectDamage: auto.redirectDamage || '',
                redirectSave: auto.redirectSave || 'DEX',
                cost: auto.cost || null,
                hasAutomation: true
            }
        }

        case 'psionic_strike': {
            return {
                type: 'psionic_strike',
                name: feature.name,
                resource: auto.resource || 'psionicEnergy',
                damageExpression: auto.damageExpression || '',
                damageType: auto.damageType || 'Force',
                oncePerTurn: !!auto.oncePerTurn,
                trigger: auto.trigger || 'after_attack_hit',
                hasAutomation: true
            }
        }

        case 'telekinetic_movement': {
            return {
                type: 'telekinetic_movement',
                name: feature.name,
                range: auto.range || '30_ft',
                hasAutomation: true
            }
        }

        case 'telekinetic_leap': {
            return {
                type: 'telekinetic_leap',
                name: feature.name,
                action: auto.action || 'bonus_action',
                duration: auto.duration || 'until_end_of_turn',
                flySpeed: auto.flySpeed || '2x_speed',
                hasAutomation: true
            }
        }

        case 'telekinetic_thrust': {
            return {
                type: 'telekinetic_thrust',
                name: feature.name,
                saveType: auto.saveType || 'STR',
                saveDc: auto.saveDc || 'ability',
                saveAbility: auto.saveAbility || 'INT',
                options: auto.options || [],
                trigger: auto.trigger || 'after_attack_hit',
                oncePerTurn: !!auto.oncePerTurn,
                hasAutomation: true
            }
        }

        case 'extra_action': {
            return {
                type: 'extra_action',
                name: feature.name,
                uses: auto.uses || 1,
                recharge: auto.recharge || 'short_rest',
                oncePerTurn: !!auto.oncePerTurn,
                oncePerCombat: !!auto.oncePerCombat,
                firstRoundOnly: !!auto.firstRoundOnly,
                resourceKey: feature.name.toLowerCase().replace(/\s+/g, '') + 'Uses',
                hasAutomation: true
            }
        }

        case 'divine_intervention': {
            return {
                type: 'divine_intervention',
                name: feature.name,
                recharge: auto.recharge || 'long_rest',
                upgradeTo: auto.upgradeTo || '',
                casting_time: auto.casting_time || '1 action',
                hasAutomation: true
            }
        }

        case 'font_of_magic': {
            return {
                type: 'font_of_magic',
                name: feature.name,
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            }
        }

        case 'font_of_inspiration': {
            return {
                type: 'font_of_inspiration',
                name: feature.name,
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            }
        }

        case 'free_spell': {
            let usesMax = auto.uses || 1;
            if (auto.uses_expression) {
                usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 1;
            }
            return {
                type: 'free_spell',
                name: feature.name,
                spell: auto.spell || '',
                uses: auto.uses || 1,
                uses_expression: auto.uses_expression || '',
                usesMax,
                recharge: auto.recharge || 'long_rest',
                action: auto.action || 'action',
                duration: auto.duration || '',
                concentration: !!auto.concentration,
                noConcentration: !!auto.noConcentration,
                resourceCost: auto.resourceCost || '',
                freeCasts: auto.freeCasts || '',
                casting_time: auto.casting_time || '',
                perSpellTracking: !!auto.perSpellTracking,
                hasAutomation: true
            }
        }

        case 'fey_reinforcements': {
            let usesMax = auto.uses || 1;
            if (auto.uses_expression) {
                usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 1;
            }
            return {
                type: 'fey_reinforcements',
                name: feature.name,
                spell: auto.spell || '',
                uses: auto.uses || 1,
                uses_expression: auto.uses_expression || '',
                usesMax,
                recharge: auto.recharge || 'long_rest',
                action: auto.action || 'action',
                duration: auto.duration || '',
                casting_time: auto.casting_time || '',
                hasAutomation: true
            }
        }

        case 'healing': {
            const healAmount = auto.healExpression
                ? evaluateAutoExpression(auto.healExpression, playerStats, prof, level)
                : 0
            return {
                type: 'healing',
                name: feature.name,
                healAmount,
                healExpression: auto.healExpression || '',
                action: auto.action || 'action',
                uses: auto.uses || null,
                usesMax: auto.uses || null,
                recharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'healing_pool': {
            const baseExpression = auto.poolExpression || ''
            const resolvedExpression = resolveHealingPoolExpression(baseExpression, auto.scaling, playerStats)
            const diceMatch = resolvedExpression.match(/^(\d+)d(\d+)$/i)
            const isDicePool = !!diceMatch
            const pool = isDicePool
                ? parseInt(diceMatch[1], 10)
                : (resolvedExpression ? evaluateAutoExpression(resolvedExpression, playerStats, prof, level) : 0)
            return {
                type: 'healing_pool',
                name: feature.name,
                pool,
                poolExpression: resolvedExpression,
                isDicePool,
                dieType: isDicePool ? parseInt(diceMatch[2], 10) : null,
                action: auto.action || 'action',
                recharge: auto.recharge || 'long_rest',
                alsoCures: auto.alsoCures || [],
                cureCost: auto.cureCost || 5,
                range: auto.range || '',
                resourceCost: auto.resourceCost || '',
                resourceKey: feature.name.toLowerCase().replace(/\s+/g, '') + 'Pool',
                hasAutomation: true
            }
        }

        case 'initiative_action': {
            return {
                type: 'initiative_action',
                name: feature.name,
                effect: auto.effect || '',
                healExpression: auto.healExpression || '',
                trigger: auto.trigger || 'roll_initiative',
                uses: auto.uses ?? 1,
                usesMax: auto.uses ?? 1,
                recharge: auto.recharge || 'long_rest',
                resourceCost: auto.resourceCost || '',
                resourceKey: feature.name.toLowerCase().replace(/\s+/g, '') + 'Uses',
                hasAutomation: true
            }
        }

        case 'meta': {
            return {
                type: 'meta',
                name: feature.name,
                effect: auto.effect || '',
                hasAutomation: true
            }
        }

        case 'moonlight_step_rider': {
            return {
                type: 'moonlight_step_rider',
                name: feature.name,
                hasAutomation: true
            }
        }

        case 'passive_buff': {
            return {
                type: 'passive_buff',
                name: feature.name,
                target: auto.target || 'allies_in_range',
                range_expression: auto.range_expression || '10_ft',
                effect: auto.effect || '',
                bonusExpression: auto.bonusExpression || auto.bonus || '',
                condition: auto.condition || '',
                conditionImmunity: auto.conditionImmunity || '',
                resistances: auto.resistances || [],
                options: auto.options || [],
                extraMastery: auto.extraMastery || [],
                replaceMastery: auto.replaceMastery || [],
                grantsFlySpeed: !!auto.grantsFlySpeed,
                grantsSwimSpeed: !!auto.grantsSwimSpeed,
                hasAutomation: true
            };
        }

        case 'holy_nimbus_radiant_damage': {
            return {
                type: 'passive_rule',
                name: feature.name,
                effect: 'holy_nimbus_radiant_damage',
                damageExpression: auto.damageExpression || '',
                range: auto.range || '',
                casting_time: auto.casting_time || '',
                hasAutomation: true
            };
        }

        case 'passive_immunity': {
            return {
                type: 'passive_immunity',
                name: feature.name,
                target: auto.target || 'self',
                conditionImmunity: auto.conditionImmunity || '',
                damageResistance: auto.damage_resistance || [],
                saveAdvantage: auto.save_advantage || [],
                hasAutomation: true
            }
        }

        case 'psionic_sorcery': {
            return {
                type: 'psionic_sorcery',
                name: feature.name,
                psionicSpells: auto.psionic_spells || [],
                hasAutomation: true
            }
        }

        case 'psionic_spells_list': {
            return {
                type: 'psionic_spells_list',
                name: feature.name,
                psionicSpells: auto.psionic_spells || [],
                hasAutomation: true
            }
        }

        case 'condition_immunity_while_active': {
            return {
                type: 'condition_immunity_while_active',
                name: feature.name,
                target: auto.target || 'self',
                immunities: auto.immunities || [],
                requiresActive: auto.requiresActive || '',
                hasAutomation: true
            }
        }

        case 'conditional_replacement': {
            return {
                type: 'conditional_replacement',
                name: feature.name,
                target: auto.target || 'saving_throw',
                saveType: auto.saveType || '',
                condition: auto.condition || '',
                effect: auto.effect || '',
                replacementAbility: auto.replacementAbility || '',
                hasAutomation: true
            }
        }

        case 'otherworldly_glamour': {
            return {
                type: 'passive_buff',
                name: feature.name,
                effect: 'otherworldly_glamour',
                hasAutomation: true
            }
        }

        case 'save_proficiency': {
            return {
                type: 'save_proficiency',
                name: feature.name,
                saveType: auto.saveType || '',
                fallbackTypes: auto.fallbackTypes || [],
                hasAutomation: true
            }
        }

        case 'passive_rule': {
            return {
                type: 'passive_rule',
                name: feature.name,
                effect: auto.effect || '',
                bonusExpression: auto.bonusExpression || '',
                criticalRange: auto.criticalRange || '',
                spells: auto.spells || [],
                riderSave: auto.riderSave || null,
                primalKnowledge: auto.skills || [],
                casting_time: auto.casting_time || '',
                cost: auto.cost || 0,
                resource: auto.resource || '',
                resistanceTypes: auto.resistanceTypes || [],
                duration: auto.duration || '',
                endsOnCondition: auto.endsOnCondition || '',
                hasAutomation: true
            }
        }

        case 'misty_wanderer': {
            return {
                type: 'misty_wanderer',
                name: feature.name,
                trigger: auto.trigger || '',
                range: auto.range || '5_ft',
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            }
        }

        case 'post_cast_rider': {
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
        }

        case 'reaction_bonus': {
            return {
                type: 'reaction_bonus',
                name: feature.name,
                trigger: auto.trigger || '',
                bonusExpression: auto.bonusExpression || '',
                condition: auto.condition || '',
                selfMovement: auto.selfMovement || '',
                allyMovement: auto.allyMovement || '',
                allyRange: auto.allyRange || '30 ft',
                noOAs: !!auto.noOAs,
                resourceCost: auto.resourceCost || '',
                effect: auto.effect || '',
                saveType: auto.saveType || '',
                saveDc: auto.saveDc || '',
                duration: auto.duration || '',
                casting_time: auto.casting_time || '1 reaction',
                hasAutomation: true
            }
        }

        case 'reaction_damage': {
            let resolvedExpr = auto.damageExpression || ''
            if (auto.scaling) {
                const entries = Object.entries(auto.scaling)
                    .map(([k, v]) => ({ level: parseInt(k, 10), expr: String(v) }))
                    .filter(e => !isNaN(e.level))
                    .sort((a, b) => a.level - b.level)
                for (const entry of entries) {
                    if (playerStats.level >= entry.level) {
                        resolvedExpr = entry.expr
                    }
                }
            }
            return {
                type: 'reaction_damage',
                name: feature.name,
                trigger: auto.trigger || '',
                damageExpression: resolvedExpr,
                damageType: auto.damageType || '',
                saveType: auto.saveType || null,
                saveDc: auto.saveDc === 'ability'
                    ? getSaveDc(playerStats, auto.saveAbility || 'WIS', prof)
                    : auto.saveDc || null,
                saveAbility: auto.saveAbility || 'WIS',
                alsoInflicts: auto.alsoInflicts || null,
                resourceCost: auto.resourceCost || null,
                range: auto.range || '5_ft',
                casting_time: auto.casting_time || '1 reaction',
                hasAutomation: true
            }
        }

        case 'reaction_debuff': {
            const usesMax = auto.uses_expression
                ? evaluateAutoExpression(auto.uses_expression, playerStats)
                : 0
            return {
                type: 'reaction_debuff',
                name: feature.name,
                trigger: auto.trigger || '',
                debuffExpression: auto.debuffExpression || '',
                subtractive: !!auto.subtractive,
                effect: auto.effect || '',
                uses_expression: auto.uses_expression || '',
                usesMax,
                recharge: auto.recharge || 'long_rest',
                range: auto.range || '60_ft',
                casting_time: auto.casting_time || '1 reaction',
                triggerTypes: ['attack_roll', 'damage_roll', 'ability_check'],
                hasAutomation: true
            }
        }

        case 'reaction_save_heal': {
            return {
                type: 'reaction_save_heal',
                name: feature.name,
                saveType: auto.saveType || 'CON',
                saveDc: auto.saveDc || 10,
                dcScaling: auto.dcScaling || 0,
                healExpression: auto.healExpression || '',
                recharge: auto.recharge || 'short_or_long_rest',
                casting_time: auto.casting_time || '1 reaction',
                hasAutomation: true
            }
        }

        case 'resistance': {
            return {
                type: 'resistance',
                name: feature.name,
                damageTypes: auto.damageTypes || [],
                hasAutomation: true
            }
        }

        case 'land_resistance': {
            return {
                type: 'land_resistance',
                name: feature.name,
                conditionImmunity: auto.conditionImmunity || '',
                landMappings: auto.landMappings || {},
                hasAutomation: true
            }
        }

        case 'resource_pool': {
            return {
                type: 'resource_pool',
                name: feature.name,
                resource: auto.resource || '',
                uses_expression: auto.uses_expression || '',
                recharge_short_rest: auto.recharge_short_rest || '',
                recharge_long_rest: auto.recharge_long_rest || '',
                conversion: auto.conversion || '',
                reverseConversion: auto.reverseConversion || '',
                reverseRecharge: auto.reverseRecharge || '',
                conversionRate: auto.conversionRate || '',
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            }
        }

        case 'save_attack': {
            const scaling = resolveScaling(playerStats, auto.scaling)
            const rawDamage = scaling?.damage || auto.damage || ''
            const damage = resolveDiceExpression(rawDamage, playerStats)
            let uses = resolveUses(playerStats, auto.uses)
            if (auto.resourceCost === 'wild_shape') {
                uses = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level)?.wild_shape || 0
            }
            const saveDc = auto.saveDc === 'ability'
                ? getSaveDc(playerStats, auto.saveAbility || 'CON', prof)
                : auto.saveDc || 10
            let healExpression = auto.healExpression || ''
            if (auto.healScaling) {
                const healScaling = resolveScaling(playerStats, auto.healScaling)
                if (healScaling?.healExpression) {
                    healExpression = healScaling.healExpression
                }
            }
            if (healExpression) {
                healExpression = resolveDiceExpression(healExpression, playerStats)
            }
            return {
                type: 'save_attack',
                name: feature.name,
                action: auto.action || 'action',
                damage,
                damageType: auto.damageType || '',
                saveType: auto.saveType || 'DEX',
                saveDc,
                saveAbility: auto.saveAbility || 'CON',
                shape: auto.shape || '',
                range: auto.range || '',
                conditionInflicted: auto.conditionInflicted || null,
                duration: auto.duration || '',
                uses,
                usesMax: uses,
                recharge: auto.recharge || 'long_rest',
                resourceCost: auto.resourceCost || '',
                hasOptions: !!auto.hasOptions,
                options: auto.options || [],
                optionDetails: auto.optionDetails || {},
                healExpression,
                dcSuccess: auto.dcSuccess || null,
                hasAutomation: true
            }
        }

        case 'save_only': {
            return {
                type: 'save_only',
                name: feature.name,
                saveType: auto.saveType || 'DEX',
                saveDc: (auto.saveDc === 'ability') ? getSaveDc(playerStats, 'CON', playerStats.proficiency) : auto.saveDc || 10,
                conditionInflicted: auto.conditionInflicted || null,
                duration: auto.duration || '',
                successEffect: auto.successEffect || null,
                hasAutomation: true,
            };
        }

        case 'self_healing': {
            const healAmount = auto.healExpression
                ? evaluateAutoExpression(auto.healExpression, playerStats, prof, level)
                : 0
            return {
                type: 'self_healing',
                name: feature.name,
                healAmount,
                healExpression: auto.healExpression || '',
                action: auto.action || 'action',
                uses: auto.uses ?? 1,
                usesMax: auto.uses ?? 1,
                recharge: auto.recharge || 'short_rest',
                bloodiedOnly: !!auto.bloodiedOnly,
                hasAutomation: true
            }
        }

        case 'divine_spark': {
            return {
                type: 'divine_spark',
                name: feature.name,
                range: auto.range || '30 ft',
                healExpression: auto.healExpression || '',
                damageExpression: auto.damageExpression || '',
                damageTypes: auto.damageTypes || [],
                saveType: auto.saveType || 'CON',
                resourceCost: auto.resourceCost || '',
                hasAutomation: true
            }
        }

        case 'set_condition': {
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
        }

        case 'spell_modifier': {
            return {
                type: 'spell_modifier',
                name: feature.name,
                options: auto.options || [],
                resource: auto.resource || 'sorcery_points',
                hasAutomation: true
            }
        }

        case 'temp_buff': {
            return {
                type: 'temp_buff',
                name: feature.name,
                effect: auto.effect || '',
                duration: auto.duration || '1_minute',
                action: auto.action || 'bonus_action',
                recharge: auto.recharge || 'long_rest',
                distance: auto.distance || '',
                extendedDistance: auto.extendedDistance || '',
                oncePerRage: !!auto.oncePerRage,
                bringAllies: !!auto.bringAllies,
                allyCount: auto.allyCount || 0,
                teleportRange: auto.teleportRange || '',
                enemiesDisadvantageSaves: auto.enemies_disadvantage_saves || [],
                triggerOnRage: !!auto.triggerOnRage,
                distanceExpression: auto.distanceExpression || '',
                hasAutomation: true
            }
        }

        case 'temp_hp_buff': {
            return {
                type: 'temp_hp_buff',
                name: feature.name,
                buffExpression: auto.buffExpression || '',
                range: auto.range || '60_ft',
                targets: auto.targets || 1,
                targetsExpression: auto.targetsExpression || '',
                bonusMovement: !!auto.bonusMovement,
                extraEffect: auto.extraEffect || null,
                tempHpExpression: auto.tempHpExpression || '',
                triggerOnRage: !!auto.trigger_on_rage,
                ongoingHealingExpression: auto.ongoingHealingExpression || '',
                healingStartOfTurn: !!auto.healingStartOfTurn,
                healingRange: auto.healingRange || '',
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            }
        }


        case 'sorcery_aura': {
            return {
                type: 'sorcery_aura',
                name: feature.name,
                uses_max: 2,
                recharge: auto.recharge || 'long_rest',
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            }
        }

        case 'resource_restoration': {
            const restoreAmount = auto.restore_expression
                ? evaluateAutoExpression(auto.restore_expression, playerStats)
                : 0
            return {
                type: 'resource_restoration',
                name: feature.name,
                trigger: auto.trigger || 'short_rest',
                casting_time: auto.casting_time || 'passive',
                restore_amount: restoreAmount,
                restore_expression: auto.restore_expression || '',
                resourceKey: auto.resourceKey || '',
                uses_max: auto.uses_max ?? 1,
                recharge: auto.recharge || 'long_rest',
                hasAutomation: true
            }
        }

        case 'sorcery_incarnate': {
            return {
                type: 'sorcery_incarnate',
                name: feature.name,
                casting_time: auto.casting_time || '1 bonus action',
                cost: auto.cost || 2,
                hasAutomation: true
            }
        }

        case 'post_cast_self_heal': {
            return {
                type: 'post_cast_self_heal',
                name: feature.name,
                healExpression: auto.healExpression || '0',
                othersOnly: auto.othersOnly ?? true,
                hasAutomation: true
            };
        }

        case 'post_cast_ally_heal': {
            return {
                type: 'post_cast_ally_heal',
                name: feature.name,
                healExpression: auto.healExpression || '0',
                othersOnly: auto.othersOnly ?? true,
                range: auto.range || '30_ft',
                hasAutomation: true
            };
        }

        case 'multi_target_spread': {
            return {
                type: 'multi_target_spread',
                name: feature.name,
                spellFilter: auto.spellFilter || [],
                range: auto.range || '10 ft',
                hasAutomation: true
            }
        }

        case 'jack_of_all_trades': {
            return {
                type: 'jack_of_all_trades',
                name: feature.name,
                hasAutomation: true
            }
        }

        case 'reliable_talent': {
            return {
                type: 'reliable_talent',
                name: feature.name,
                hasAutomation: true
            }
        }

        case 'divine_order': {
            return {
                type: 'divine_order',
                name: feature.name,
                hasAutomation: true
            }
        }

        case 'nature_sanctuary': {
            return {
                type: 'nature_sanctuary',
                name: feature.name,
                range: auto.range || '120_ft',
                cubeSize: auto.cubeSize || 15,
                duration: auto.duration || '1_minute',
                moveRange: auto.moveRange || 60,
                movesPerDuration: auto.movesPerDuration || 1,
                resourceCost: auto.resourceCost || 'wild_shape',
                hasAutomation: true
            }
        }

        case 'nature_sanctuary_move': {
            return {
                type: 'nature_sanctuary_move',
                name: feature.name,
                action: 'bonus_action',
                moveRange: auto.moveRange || 60,
                hasAutomation: true
            };
        }

        case 'starry_form': {
            return {
                type: 'starry_form',
                name: feature.name,
                effect: auto.effect || 'starry_form',
                duration: auto.duration || '1_minute',
                options: auto.options || CONSTELLATION_OPTIONS,
                resourceKey: auto.resourceKey || 'starryFormUses',
                uses: auto.uses || 0,
                hasAutomation: true
            };
        }

        case 'cosmic_omen': {
            let usesMax = 0;
            if (auto.uses_expression) {
                usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 0;
            }
            return {
                type: 'cosmic_omen',
                name: feature.name,
                usesMax,
                usesRecharge: auto.recharge || 'long_rest',
                action: auto.action || 'action',
                casting_time: auto.casting_time || '1 action',
                hasAutomation: true
            };
        }

        case 'twinkling_constellations': {
            return {
                type: 'twinkling_constellations',
                name: feature.name,
                options: auto.options || CONSTELLATION_OPTIONS,
                hasAutomation: true
            };
        }

        case 'tactical_mind': {
            return {
                type: 'tactical_mind',
                name: feature.name,
                bonusExpression: auto.bonusExpression || '',
                hasAutomation: true
            };
        }

        case 'combat_superiority': {
            const saveAbility = auto.saveAbility || 'STR'
            const prof = playerStats.proficiency || 0
            const saveDc = auto.saveDc === 'ability'
                ? getSaveDc(playerStats, saveAbility, prof)
                : auto.saveDc || 10
            return {
                type: 'combat_superiority',
                name: feature.name,
                saveType: auto.saveType || 'WIS',
                saveDc,
                saveAbility,
                dieExpression: auto.dieExpression || 'superiority_die',
                usesMax: auto.uses_max || 4,
                usesRecharge: auto.recharge || 'short_rest',
                options: auto.options || [],
                oncePerTurn: !!auto.oncePerTurn,
                chooseOne: !!auto.chooseOne,
                hasAutomation: true
            };
        }

        case 'know_enemy': {
            return {
                type: 'know_enemy',
                name: feature.name,
                range: auto.range || '30_ft',
                usesMax: auto.uses_max || 4,
                hasAutomation: true
            };
        }

        case 'war_bond_summon': {
            return {
                type: 'war_bond_summon',
                name: feature.name,
                action: auto.action || 'bonus_action',
                bondedWeaponCount: auto.bondedWeaponCount || 2,
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            };
        }

        case 'war_magic_cantrip': {
            return {
                type: 'war_magic_cantrip',
                name: feature.name,
                spellList: auto.spellList || 'wizard_cantrips',
                action: auto.action || 'action',
                casting_time: auto.casting_time || '1 action',
                hasAutomation: true
            };
        }

        case 'war_magic_spell': {
            return {
                type: 'war_magic_spell',
                name: feature.name,
                spellList: auto.spellList || 'wizard_spells',
                maxSpellLevel: auto.maxSpellLevel || 2,
                action: auto.action || 'action',
                casting_time: auto.casting_time || '1 action',
                replacesWarMagic: !!auto.replacesWarMagic,
                hasAutomation: true
            };
        }

        case 'arcane_charge': {
            return {
                type: 'arcane_charge',
                name: feature.name,
                distance: auto.distance || '30 ft',
                casting_time: auto.casting_time || '1 action',
                hasAutomation: true
            };
        }

        case 'guarded_mind': {
            return {
                type: 'guarded_mind',
                name: feature.name,
                resource: auto.resource || 'psionicEnergy',
                action: auto.action || 'action',
                casting_time: auto.casting_time || '1 action',
                hasAutomation: true
            };
        }

        case 'bulwark_of_force': {
            return {
                type: 'bulwark_of_force',
                name: feature.name,
                range: auto.range || '30_ft',
                duration: auto.duration || '1_round',
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            };
        }

        case 'concentration_bonus_attack': {
            return {
                type: 'concentration_bonus_attack',
                name: feature.name,
                trigger: auto.trigger || 'each_turn',
                action: auto.action || 'bonus_action',
                weaponAttack: !!auto.weaponAttack,
                concentrationSpell: auto.concentrationSpell || '',
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            };
        }

        case 'shadow_step_rider': {
            return {
                type: 'shadow_step_rider',
                name: feature.name,
                hasAutomation: true
            };
        }

        case 'sacred_weapon': {
            return {
                type: 'temp_buff',
                name: feature.name,
                effect: 'sacred_weapon',
                duration: auto.duration || '10_minutes',
                resourceCost: auto.resourceCost || '',
                options: auto.options || [],
                casting_time: auto.casting_time || '',
                hasAutomation: true
            };
        }

        case 'post_cast_smite_cover': {
            return {
                type: 'post_cast_smite_cover',
                name: feature.name,
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            };
        }

        case 'post_cast_inspiring_smite': {
            return {
                type: 'post_cast_inspiring_smite',
                name: feature.name,
                range: auto.range || '30 ft',
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            };
        }

        case 'holy_nimbus': {
            return {
                type: 'holy_nimbus',
                name: feature.name,
                duration: auto.duration || '10_minutes',
                casting_time: auto.casting_time || '1_bonus_action',
                resourceCost: auto.resourceCost || '',
                hasAutomation: true
            };
        }

        case 'cloak_of_shadows': {
            return {
                type: 'cloak_of_shadows',
                name: feature.name,
                effect: auto.effect || '',
                duration: auto.duration || '1_minute',
                hasAutomation: true
            };
        }

        case 'peerless_athlete': {
            return {
                type: 'peerless_athlete',
                name: feature.name,
                duration: auto.duration || '1_hour',
                casting_time: auto.casting_time || '1_bonus_action',
                resourceCost: auto.resourceCost || 'channel_divinity',
                hasAutomation: true
            };
        }

        case 'glorious_defense': {
            const chaBonus = playerStats.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;
            const acBonus = Math.max(1, chaBonus);
            const usesMax = Math.max(1, chaBonus);
            return {
                type: 'glorious_defense',
                name: feature.name,
                acBonusExpression: `Math.max(1, CHA modifier)`,
                acBonus: acBonus,
                usesMax: usesMax,
                range: auto.range || '10_ft',
                trigger: auto.trigger || '',
                casting_time: auto.casting_time || '1 reaction',
                hasAutomation: true
            };
        }

        case 'living_legend': {
            return {
                type: 'living_legend',
                name: feature.name,
                duration: auto.duration || '10_minutes',
                casting_time: auto.casting_time || '1 bonus action',
                unerringStrikeTrigger: auto.unerring_strike_trigger || 'attack_miss',
                unerringStrikeOncePerTurn: !!auto.unerring_strike_once_per_turn,
                saveRerollTarget: auto.save_reroll_target || 'saving_throw',
                charismaCheckAdvantage: !!auto.charisma_check_advantage,
                hasAutomation: true
            };
        }

        case 'elder_champion': {
            return {
                type: 'elder_champion',
                name: feature.name,
                duration: auto.duration || '1_minute',
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            };
        }

        case 'umbral_sight': {
            return {
                type: 'passive_rule',
                name: feature.name,
                effect: 'umbral_sight',
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            };
        }

        case 'relentless_avenger': {
            return {
                type: 'relentless_avenger',
                name: feature.name,
                trigger: auto.trigger || 'after_opportunity_attack_hit',
                duration: auto.duration || 'until_end_of_current_turn',
                hasAutomation: true
            };
        }

        case 'soul_of_vengeance': {
            return {
                type: 'soul_of_vengeance',
                name: feature.name,
                trigger: auto.trigger || 'after_vow_of_enmity_target_attacks',
                hasAutomation: true
            };
        }

        case 'avenging_angel': {
            return {
                type: 'temp_buff',
                name: feature.name,
                effect: auto.effect || 'avenging_angel',
                duration: auto.duration || '10_minutes',
                action: auto.action || 'bonus_action',
                flySpeed: auto.flySpeed || 60,
                hover: !!auto.hover,
                auraRange: auto.auraRange || 'aura_of_protection',
                saveType: auto.saveType || 'WIS',
                saveDc: auto.saveDc || 'ability',
                hasAutomation: true
            };
        }

        case 'primal_companion_summon': {
            return {
                type: 'primal_companion_summon',
                name: feature.name,
                action: auto.action || 'bonus_action',
                companionTypes: auto.companionTypes || [],
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            };
        }

        case 'primal_companion_dodge': {
            return {
                type: 'primal_companion_dodge',
                name: feature.name,
                effect: auto.effect || 'companion_dodge_default',
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            };
        }

        case 'primal_companion_command': {
            return {
                type: 'primal_companion_command',
                name: feature.name,
                action: auto.action || 'action',
                commandType: auto.commandType || 'beasts_strike',
                casting_time: auto.casting_time || '1 action',
                hasAutomation: true
            };
        }

        case 'primal_companion_restore': {
            return {
                type: 'primal_companion_restore',
                name: feature.name,
                action: auto.action || 'action',
                range: auto.range || '5_ft',
                spellSlotCost: !!auto.spellSlotCost,
                casting_time: auto.casting_time || '1 action',
                hasAutomation: true
            };
        }

        case 'primal_companion_bonus_action_command': {
            return {
                type: 'primal_companion_bonus_action_command',
                name: feature.name,
                commandActions: auto.commandActions || [],
                forceDamageOption: !!auto.forceDamageOption,
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            };
        }

        case 'primal_companion_double_strike': {
            return {
                type: 'primal_companion_double_strike',
                name: feature.name,
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            };
        }

        case 'primal_companion_double_strike_damage': {
            return {
                type: 'damage_bonus',
                name: feature.name,
                trigger: 'companion_beasts_strike_hit',
                damageExpression: auto.damageExpression || '',
                damageType: auto.damageType || '',
                oncePerTurn: !!auto.oncePerTurn,
                hasAutomation: true
            };
        }

        case 'primal_companion_spell_share': {
            return {
                type: 'primal_companion_spell_share',
                name: feature.name,
                range: auto.range || '30_ft',
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            };
        }

        case 'reaction_save': {
            return {
                type: 'reaction_save',
                name: feature.name,
                trigger: auto.trigger || '',
                saveType: auto.saveType || 'WIS',
                saveDc: auto.saveDc || 'ability',
                saveAbility: auto.saveAbility || 'CHA',
                condition: auto.condition || '',
                duration: auto.duration || '',
                range: auto.range || '120_ft',
                casting_time: auto.casting_time || '1 reaction',
                target: auto.target || 'different_creature',
                hasAutomation: true
            };
        }

        case 'shadowy_dodge': {
            return {
                type: 'shadowy_dodge',
                name: feature.name,
                range: auto.range || '30_ft',
                casting_time: auto.casting_time || '1 reaction',
                hasAutomation: true
            };
        }

        case 'hunter_prey': {
            return {
                type: 'hunter_prey',
                name: feature.name,
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            };
        }

        case 'defensive_tactics': {
            return {
                type: 'defensive_tactics',
                name: feature.name,
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            };
        }

        case 'superior_hunter_prey': {
            return {
                type: 'superior_hunter_prey',
                name: feature.name,
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            };
        }

        case 'superior_hunter_defense': {
            return {
                type: 'superior_hunter_defense',
                name: feature.name,
                casting_time: auto.casting_time || '1 reaction',
                hasAutomation: true
            };
        }

        case 'bonus_action_choice': {
            return {
                type: 'bonus_action_choice',
                name: feature.name,
                options: auto.options || [],
                action: auto.action || 'bonus_action',
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            };
        }

        case 'steady_aim': {
            return {
                type: 'steady_aim',
                name: feature.name,
                duration: auto.duration || 'until_end_of_turn',
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            };
        }

        case 'mage_hand_control': {
            return {
                type: 'mage_hand_control',
                name: feature.name,
                range: auto.range || '30_ft',
                action: auto.action || 'bonus_action',
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            }
        }

        case 'stroke_of_luck': {
            return {
                type: 'stroke_of_luck',
                name: feature.name,
                target: auto.target || 'd20',
                recharge: auto.recharge || 'short_or_long_rest',
                hasAutomation: true
            };
        }

        case 'spell_thief': {
            return {
                type: 'spell_thief',
                name: feature.name,
                saveType: auto.saveType || 'INT',
                saveDc: auto.saveDc || 'ability',
                saveAbility: auto.saveAbility || 'INT',
                trigger: auto.trigger || 'spell_cast',
                oncePerLongRest: !!auto.oncePerLongRest,
                casting_time: auto.casting_time || '1 reaction',
                hasAutomation: true
            };
        }

        case 'stealth_attack': {
            return {
                type: 'stealth_attack',
                name: feature.name,
                cost: auto.cost || '1d6',
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            };
        }

        case 'fast_hands': {
            return {
                type: 'fast_hands',
                name: feature.name,
                options: auto.options || [],
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            };
        }

        case 'supreme_sneak': {
            return {
                type: 'passive_rule',
                name: feature.name,
                effect: 'supreme_sneak',
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            };
        }

        case 'use_magic_device': {
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
            };
        }

        case 'revelation_in_flesh': {
            return {
                type: 'revelation_in_flesh',
                name: feature.name,
                options: auto.options || [],
                duration: auto.duration || '10_minutes',
                action: auto.action || 'bonus_action',
                casting_time: auto.casting_time || '1 bonus action',
                hasAutomation: true
            };
        }

        case 'warping_implosion': {
            return {
                type: 'save_attack',
                name: feature.name,
                action: auto.action || 'action',
                damage: auto.damage || '',
                damageType: auto.damageType || '',
                saveType: auto.saveType || 'STR',
                saveDc: auto.saveDc === 'ability'
                    ? getSaveDc(playerStats, auto.saveAbility || 'CHA', prof)
                    : auto.saveDc || 10,
                saveAbility: auto.saveAbility || 'CHA',
                shape: auto.shape || '',
                range: auto.range || '',
                conditionInflicted: auto.conditionInflicted || null,
                duration: auto.duration || '',
                uses: auto.uses ?? 1,
                usesMax: auto.uses ?? 1,
                recharge: auto.recharge || 'long_rest',
                resourceCost: auto.resourceCost || '',
                resourceKey: 'sorcery_points',
                restoreCost: auto.restoreCost || null,
                hasOptions: !!auto.hasOptions,
                options: auto.options || [],
                optionDetails: auto.optionDetails || {},
                healExpression: null,
                dcSuccess: auto.dcSuccess || null,
                hasAutomation: true
            };
        }

        case 'bastion_of_law': {
            return {
                type: 'bastion_of_law',
                name: feature.name,
                range: auto.range || '30_ft',
                action: auto.action || 'action',
                casting_time: auto.casting_time || '1 action',
                resourceCost: auto.resourceCost || 'sorcery_points',
                maxSP: auto.maxSP || 5,
                minSP: auto.minSP || 1,
                hasAutomation: true
            };
        }

        case 'transe_of_order': {
            return {
                type: 'transe_of_order',
                name: feature.name,
                duration: auto.duration || '1_minute',
                action: auto.action || 'bonus_action',
                restoreCost: auto.restoreCost || 5,
                hasAutomation: true
            };
        }

        case 'clockwork_cavalcade': {
            return {
                type: 'clockwork_cavalcade',
                name: feature.name,
                action: auto.action || 'action',
                range: auto.range || '30_ft_cube',
                maxHeal: auto.maxHeal || 100,
                restoreCost: auto.restoreCost || 7,
                hasAutomation: true
            };
        }

        case 'damage_type_choice': {
            return {
                type: 'damage_type_choice',
                name: feature.name,
                damageTypes: auto.damageTypes || [],
                effect: auto.effect || '',
                casting_time: auto.casting_time || 'passive',
                hasAutomation: true
            };
        }

        case 'dragon_wings': {
            return {
                type: 'dragon_wings',
                name: feature.name,
                action: auto.action || 'bonus_action',
                duration: auto.duration || '1_hour',
                flySpeed: auto.flySpeed || 60,
                hover: auto.hover || false,
                uses: auto.uses ?? 1,
                recharge: auto.recharge || 'long_rest',
                resourceCost: auto.resourceCost || '',
                restoreCost: auto.restoreCost || 3,
                hasAutomation: true
            };
        }

        case 'dragon_companion': {
            let usesMax = auto.uses || 1;
            if (auto.uses_expression) {
                usesMax = evaluateAutoExpression(auto.uses_expression, playerStats) || 1;
            }
            return {
                type: 'dragon_companion',
                name: feature.name,
                spell: auto.spell || '',
                uses: auto.uses || 1,
                uses_expression: auto.uses_expression || '',
                usesMax,
                recharge: auto.recharge || 'long_rest',
                action: auto.action || 'action',
                noConcentration: false,
                hasAutomation: true
            };
        }

        case 'wild_magic_surge': {
            return {
                type: 'wild_magic_surge',
                name: feature.name,
                trigger: auto.trigger || '',
                oncePerTurn: auto.oncePerTurn || false,
                hasAutomation: true
            };
        }

        case 'wild_magic_tamed': {
            return {
                type: 'wild_magic_tamed',
                name: feature.name,
                trigger: auto.trigger || '',
                recharge: auto.recharge || 'long_rest',
                uses: auto.uses || 1,
                hasAutomation: true
            };
        }

        case 'feats_of_chaos': {
            return {
                type: 'conditional_advantage',
                name: feature.name,
                target: auto.target || 'd20',
                condition: auto.condition || 'feats_of_chaos_active',
                effect: 'advantage',
                abilities: auto.abilities || [],
                hasAutomation: true
            };
        }

            case 'contact_patron': {
                return {
                    type: 'contact_patron',
                    name: feature.name,
                    spell: auto.spell || '',
                    uses: auto.uses || 1,
                    uses_expression: auto.uses_expression || '',
                    recharge: auto.recharge || 'long_rest',
                    action: auto.action || 'action',
                    casting_time: auto.casting_time || '',
                    hasAutomation: true
                }
            }

            default:
            return null
    }
}

export { buildAttackInfo }
