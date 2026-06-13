export function collectSaveModifiers(features) {
    const modifiers = []
    if (!features) return modifiers

    features.forEach(feature => {
        if (!feature?.automation) return
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            if (auto.type === 'conditional_advantage') {
                const abilities = auto.abilities || (auto.saveType ? [auto.saveType.toUpperCase()] : []);
                modifiers.push({
                    source: feature.name,
                    target: auto.target,
                    condition: auto.condition,
                    effect: auto.effect,
                    abilities
                })
            }
            if (auto.type === 'combat_stance' && auto.advantages) {
                for (const adv of auto.advantages) {
                    const isSave = adv.toLowerCase().includes('saves');
                    const abilityMatch = adv.match(/^(\w{3})\s+(?:checks|saves)/);
                    if (isSave && abilityMatch) {
                        modifiers.push({
                            source: feature.name,
                            target: 'saving_throw',
                            condition: 'stance_active',
                            effect: 'advantage',
                            abilities: [abilityMatch[1].toUpperCase()]
                        })
                    }
                }
            }
            if (auto.type === 'auto_reroll') {
                const condition = auto.condition || (feature.name === 'Disciplined Survivor' ? 'disciplined_survivor' : '');
                modifiers.push({
                    source: feature.name,
                    target: auto.target,
                    condition,
                    effect: 'reroll',
                    bonusExpression: auto.bonusExpression || '',
                    oncePerRage: !!auto.oncePerRage,
                })
            }
            if (auto.type === 'living_legend') {
                modifiers.push({
                    source: feature.name,
                    target: 'saving_throw',
                    condition: 'living_legend_active',
                    effect: 'reroll',
                    bonusExpression: '',
                })
                modifiers.push({
                    source: feature.name,
                    target: 'ability_check',
                    condition: 'living_legend_active',
                    effect: 'advantage',
                    abilities: ['CHA'],
                })
            }
            if (auto.type === 'conditional_replacement') {
                modifiers.push({
                    source: feature.name,
                    target: auto.target,
                    condition: auto.condition,
                    effect: 'replacement',
                    saveType: auto.saveType || '',
                    replacementAbility: auto.replacementAbility || '',
                })
            }
            if (auto.type === 'tactical_mind') {
                modifiers.push({
                    source: feature.name,
                    target: auto.target || 'ability_check',
                    condition: auto.condition || '',
                    effect: 'tactical_mind',
                    bonusExpression: auto.bonusExpression || '',
                })
            }
            if (auto.type === 'elder_champion') {
                modifiers.push({
                    source: feature.name,
                    target: 'saving_throw',
                    condition: 'elder_champion_active',
                    effect: 'disadvantage',
                })
            }
            if (auto.type === 'otherworldly_glamour') {
                modifiers.push({
                    source: feature.name,
                    target: 'ability_check',
                    condition: 'otherworldly_glamour',
                    effect: 'wis_replacement',
                    abilities: ['CHA'],
                })
            }
            if (auto.type === 'reliable_talent') {
                modifiers.push({
                    source: feature.name,
                    target: 'ability_check',
                    condition: '',
                    effect: 'reliable_talent',
                })
            }
            if (auto.type === 'second_storywork') {
                modifiers.push({
                    source: feature.name,
                    target: 'ability_check',
                    condition: '',
                    effect: 'dex_jump',
                })
            }
            if (auto.type === 'stroke_of_luck') {
                modifiers.push({
                    source: feature.name,
                    target: auto.target || 'd20',
                    condition: '',
                    effect: 'stroke_of_luck',
                })
            }
            if (auto.type === 'use_magic_device') {
                modifiers.push({
                    source: feature.name,
                    target: 'ability_check',
                    condition: '',
                    effect: 'advantage',
                    abilities: ['INT'],
                })
            }
            if (auto.type === 'passive_immunity' && auto.saveAdvantage) {
                for (const sa of auto.saveAdvantage) {
                    modifiers.push({
                        source: feature.name,
                        target: 'saving_throw',
                        condition: sa.condition || '',
                        effect: 'advantage',
                        saveType: sa.saveType || '',
                    })
                }
            }
            if (auto.type === 'restore_balance') {
                modifiers.push({
                    source: feature.name,
                    target: auto.target || 'd20',
                    condition: '',
                    effect: 'restore_balance',
                })
            }
            if (auto.type === 'transe_of_order') {
                modifiers.push({
                    source: feature.name,
                    target: 'attack_roll',
                    condition: 'transe_of_order_active',
                    effect: 'no_advantage_against',
                })
                modifiers.push({
                    source: feature.name,
                    target: 'd20',
                    condition: '',
                    effect: 'd20_floor_10',
                })
            }
            if (auto.type === 'dark_ones_look') {
                modifiers.push({
                    source: feature.name,
                    target: 'saving_throw',
                    condition: '',
                    effect: 'dark_ones_look',
                })
                modifiers.push({
                    source: feature.name,
                    target: 'ability_check',
                    condition: '',
                    effect: 'dark_ones_look',
                })
            }
            if (auto.type === 'clairvoyant_combatant') {
                modifiers.push({
                    source: feature.name,
                    target: 'attack_roll',
                    condition: 'clairvoyant_combatant_active',
                    effect: 'disadvantage',
                })
            }
            if (auto.type === 'potent_cantrip') {
                modifiers.push({
                    source: feature.name,
                    target: 'saving_throw',
                    condition: '',
                    effect: 'potent_cantrip',
                })
            }
            if (auto.type === 'soulstitch_spells') {
                modifiers.push({
                    source: feature.name,
                    target: 'saving_throw',
                    condition: '',
                    effect: 'soulstitch_spells',
                })
            }
            if (auto.type === 'empowered_evocation') {
                modifiers.push({
                    source: feature.name,
                    target: 'damage',
                    condition: '',
                    effect: 'empowered_evocation',
                })
            }
            if (auto.type === 'overchannel') {
                modifiers.push({
                    source: feature.name,
                    target: 'damage',
                    condition: '',
                    effect: 'overchannel',
                })
            }
            if (auto.type === 'passive_rule' && auto.effect === 'spell_breaker') {
                modifiers.push({
                    source: feature.name,
                    target: 'ability_check',
                    condition: '',
                    effect: 'spell_breaker_dispel_bonus',
                    bonusExpression: auto.dispelAbilityCheckBonus || 'proficiency_bonus',
                })
            }
            if (auto.type === 'conditional_disadvantage') {
                const abilities = auto.abilities || (auto.saveType ? [auto.saveType.toUpperCase()] : []);
                const target = auto.target || 'attack_roll';
                if (target === 'saving_throw' || target === 'save') {
                    modifiers.push({
                        source: feature.name,
                        target: 'saving_throw',
                        condition: auto.condition,
                        effect: 'disadvantage',
                        abilities
                    })
                } else {
                    modifiers.push({
                        source: feature.name,
                        target: target,
                        condition: auto.condition,
                        effect: 'disadvantage',
                        abilities
                    })
                }
            }
            if (auto.type === 'portent') {
                modifiers.push({
                    source: feature.name,
                    target: 'd20',
                    condition: '',
                    effect: 'portent',
                })
            }
            if (auto.type === 'improved_illusions') {
                modifiers.push({
                    source: feature.name,
                    target: 'spell_component',
                    condition: '',
                    effect: 'improved_illusions',
                })
            }
            if (auto.type === 'illusory_reality') {
                modifiers.push({
                    source: feature.name,
                    target: 'spell_component',
                    condition: '',
                    effect: 'illusory_reality',
                })
            }
        }
    })

    return modifiers
}
